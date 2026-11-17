from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import timedelta
import os
import secrets
import shutil

# Import db from extensions
from .extensions import db, add_missing_columns

# Shared data: data/static.db (in git), the Tatoeba sentences, never written at runtime; instance/accounts.db, the
# accounts. Each account's own data (the lexicon with its known words and review state, flashcards, calibration,
# reviews, settings) is instance/users/<uid>.db (see auth.py). instance/user.db is the data from before accounts,
# also the database scripts work on.
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
STATIC_DB = os.path.join(DATA_DIR, 'static.db')
EXAMPLE_USER_DB = os.path.join(DATA_DIR, 'example_user.db')


def prepare_user_db(instance_path):
    """instance/user.db, creating it if needed: from a database made before the split (instance/demo.db,
    which held everything), else from the example data."""
    os.makedirs(instance_path, exist_ok=True)
    user, legacy = os.path.join(instance_path, 'user.db'), os.path.join(instance_path, 'demo.db')
    if not os.path.exists(user):
        if os.path.exists(legacy):
            os.replace(legacy, user)
            print('Moved instance/demo.db to instance/user.db')
        elif os.path.exists(EXAMPLE_USER_DB):
            shutil.copyfile(EXAMPLE_USER_DB, user)
            print('Started instance/user.db from data/example_user.db')
    return user


def drop_legacy_tatoeba():
    """A user database from before the split still has its own copy of the Tatoeba table: keep its cached
    diacritics (now in tatoeba_diac) and drop the rest, which data/static.db has."""
    from sqlalchemy import inspect, text
    engine = db.engines[None]
    if 'tatoeba' not in inspect(engine).get_table_names():
        return
    with engine.begin() as conn:
        if 'diac' in {c['name'] for c in inspect(engine).get_columns('tatoeba')}:
            conn.execute(text('INSERT INTO tatoeba_diac (tatoeba_id, diac) SELECT tatoeba_id, diac FROM tatoeba '
                              'WHERE diac IS NOT NULL AND tatoeba_id NOT IN (SELECT tatoeba_id FROM tatoeba_diac)'))
        conn.execute(text('DROP TABLE tatoeba'))
    if engine.dialect.name == 'sqlite':
        with engine.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
            conn.execute(text('VACUUM'))  # give the space back
    print('Dropped the old Tatoeba table from the user database (it lives in data/static.db now)')


def secret_key(instance_path):
    """SECRET_KEY (signs the session cookies), else one made once and kept in instance/secret_key."""
    if os.environ.get('SECRET_KEY'):
        return os.environ['SECRET_KEY']
    path = os.path.join(instance_path, 'secret_key')
    try:
        with open(path, 'x') as f:
            f.write(secrets.token_hex(32))
    except FileExistsError:
        pass
    with open(path) as f:
        return f.read().strip()


def create_app():
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))
    # INSTANCE_PATH: somewhere else for instance/ (tests)
    app = Flask(__name__, instance_path=os.environ.get('INSTANCE_PATH') or None)
    os.makedirs(app.instance_path, exist_ok=True)
    # Behind Caddy: the scheme and host the visitor used (the Twilio signature covers the public URL)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    # Enable CORS (adjust origins if you want stricter rules)
    # CORS(app, resources={r"/*": {"origins": ["http://localhost:3000"]}})
    CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all origins for now (adjust in production)

    # Database Configuration
    # 1) Use DATABASE_URL if provided (Production)
    # 2) Otherwise use local SQLite (Development)
    database_url = os.environ.get("DATABASE_URL")

    if database_url:
        # Fix for some PaaS that use postgres:// instead of postgresql://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)

        app.config["SQLALCHEMY_DATABASE_URI"] = database_url

        # Print masked URL for debugging without leaking password
        masked_url = database_url.split("@")[-1] if "@" in database_url else "PRODUCTION_DB"
        print(f"Using Production Database: ...@{masked_url}")
    else:
        # Local SQLite
        db_path = prepare_user_db(app.instance_path)
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
        print(f"Using Local Database: {db_path}")
    app.config["SQLALCHEMY_BINDS"] = {
        "static": os.environ.get("STATIC_DATABASE_URL") or f"sqlite:///{STATIC_DB}",
        "accounts": f"sqlite:///{os.path.join(app.instance_path, 'accounts.db')}",
    }

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = secret_key(app.instance_path)
    # Signed in for 60 days from the last visit. Lax: other sites can't send requests as you; the extension can
    # (Chrome treats an extension's requests to sites it has permission for as same-site).
    app.config.update(SESSION_COOKIE_SAMESITE='Lax', SESSION_COOKIE_SECURE=True, SESSION_COOKIE_HTTPONLY=True,
                      PERMANENT_SESSION_LIFETIME=timedelta(days=60))

    # Initialize extensions
    db.init_app(app)

    # Import models after db is initialized
    from . import models  # noqa: F401

    # Import and Register Blueprints
    from .routes import main
    from .tutor import tutor
    from .calibrate import calibrate
    from .atlas import atlas
    from .srs import srs
    from .reader import reader
    from .auth import auth
    app.register_blueprint(auth)
    app.register_blueprint(main)
    app.register_blueprint(tutor)
    app.register_blueprint(calibrate)
    app.register_blueprint(atlas)
    app.register_blueprint(srs)
    app.register_blueprint(reader)

    # Initialize Database logic
    with app.app_context():
        try:
            from . import lexicon
            db.create_all(bind_key='static')
            add_missing_columns(db.metadatas['static'], db.engines['static'])
            lexicon.ensure_lexicon(os.path.join(os.path.dirname(DATA_DIR), 'Final_Lexicon.csv'))
            db.create_all(bind_key='accounts')
            # the default database (instance/user.db: the data from before accounts, and what scripts work on)
            lexicon.attach(db.engines[None], db.engines['static'].url.database)
            lexicon.upgrade(db.engines[None])
            drop_legacy_tatoeba()

            # Seed if local OR explicitly requested
            should_seed = (not database_url) or (os.environ.get("SEED_DB") == "true")

            if should_seed:
                from .database import seed_database
                seed_database()

        except Exception as e:
            print(f"Database initialization skipped or failed: {e}")

    return app
