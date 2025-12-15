from flask import Flask
import os

# Import db from extensions (not defined here)
from .extensions import db

def create_app():
    # Configure build folders so Flask serves the React build correctly
    BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'build'))
    STATIC_DIR = os.path.join(BUILD_DIR, 'static')
    app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='/static', template_folder=BUILD_DIR)

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass # The folder already exists
    db_path = os.path.join(app.instance_path, 'demo.db')
    print(f"Database path: {db_path}")

    # Configuration
    app.config['SECRET_KEY'] = 'dev_key_for_now'
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize extensions
    db.init_app(app)
    
    # Import models after db is initialized
    from . import models
    
    # Import and Register Blueprints
    from .routes import main
    app.register_blueprint(main)

    # Initialize Database
    with app.app_context():
        db.create_all()
        
        from .database import seed_database
        from . import sets
        seed_database([sets.demo])

    return app