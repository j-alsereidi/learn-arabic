from flask import Flask
from flask_cors import CORS # You will likely need CORS if frontend/backend are on different domains
import os

# Import db from extensions (not defined here)
from .extensions import db

def create_app():
    app = Flask(__name__)

    # Enable CORS for development and production
    CORS(app) 

    # Database Configuration
    # 1. Check for DATABASE_URL environment variable (Production - Supabase/Render)
    # 2. Fallback to local SQLite (Development)
    database_url = os.environ.get('DATABASE_URL')
    
    if database_url:
        # Fix for some PaaS that use postgres:// instead of postgresql://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
        # Print masked URL for debugging connection issues without leaking password
        masked_url = database_url.split('@')[-1] if '@' in database_url else 'PRODUCTION_DB'
        print(f"Using Production Database: ...@{masked_url}") 
    else:
        # Local SQLite
        try:
            os.makedirs(app.instance_path)
        except OSError:
            pass 
        db_path = os.path.join(app.instance_path, 'demo.db')
        app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
        print(f"Using Local Database: {db_path}")

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_for_now')

    # Initialize extensions
    db.init_app(app)
    
    # Import models after db is initialized
    from . import models
    
    # Import and Register Blueprints
    from .routes import main
    app.register_blueprint(main)

    # Initialize Database logic
    # In production, we usually use Flask-Migrate, but for now we'll stick to create_all
    # We wrap it in a try-except to avoid issues if DB isn't ready or during build steps
    with app.app_context():
        try:
            db.create_all()
            
            # Optional: Seed data if empty (and if we are local or explicitly told to)
            # You might not want to auto-seed production every time automatically, 
            # unless SEED_DB env var is set or we are in dev (no database_url).
            should_seed = (not database_url) or (os.environ.get('SEED_DB') == 'true')
            
            if should_seed:
                from .database import seed_database
                from . import sets
                seed_database([sets.demo])
        except Exception as e:
            print(f"Database initialization skipped or failed: {e}")

    return app