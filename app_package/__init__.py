from flask import Flask
from flask_cors import CORS
import os

# Import db from extensions
from .extensions import db


def create_app():
    app = Flask(__name__)

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
        os.makedirs(app.instance_path, exist_ok=True)
        db_path = os.path.join(app.instance_path, "demo.db")
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
        print(f"Using Local Database: {db_path}")

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev_key_for_now")

    # Initialize extensions
    db.init_app(app)

    # Import models after db is initialized
    from . import models  # noqa: F401

    # Import and Register Blueprints
    from .routes import main
    app.register_blueprint(main)

    # Initialize Database logic
    with app.app_context():
        try:
            db.create_all()

            # Seed if local OR explicitly requested
            should_seed = (not database_url) or (os.environ.get("SEED_DB") == "true")

            if should_seed:
                from .database import seed_database
                seed_database()

        except Exception as e:
            print(f"Database initialization skipped or failed: {e}")

    return app
