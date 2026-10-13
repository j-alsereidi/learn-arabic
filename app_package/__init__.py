import os
import secrets

from pathlib import Path

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from .extensions import db


def create_app():
    load_dotenv(
        Path(__file__).with_name(".env"),
        override=False,
    )

    app = Flask(__name__)

    os.makedirs(app.instance_path, exist_ok=True)

    frontend_origin = os.getenv(
        "FRONTEND_ORIGIN",
        "http://localhost:3000",
    ).rstrip("/")

    app.config["FRONTEND_ORIGIN"] = frontend_origin

    CORS(
        app,
        resources={
            r"/*": {
                "origins": [frontend_origin],
            }
        },
        supports_credentials=True,
    )

    database_url = os.getenv("DATABASE_URL")

    if database_url:
        if database_url.startswith("postgres://"):
            database_url = database_url.replace(
                "postgres://",
                "postgresql://",
                1,
            )

        app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    else:
        database_path = os.path.join(
            app.instance_path,
            "demo.db",
        )

        app.config["SQLALCHEMY_DATABASE_URI"] = (
            f"sqlite:///{database_path}"
        )

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    secret = os.getenv("SECRET_KEY")

    if not secret or secret == "dev_key_for_now":
        if database_url:
            raise RuntimeError(
                "Set a strong SECRET_KEY in your server environment."
            )

        secret_file = Path(app.instance_path) / "auth-secret.key"

        try:
            descriptor = os.open(
                secret_file,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                0o600,
            )

            with os.fdopen(descriptor, "w") as file:
                file.write(secrets.token_hex(32))

        except FileExistsError:
            pass

        secret = secret_file.read_text().strip()

    app.config["SECRET_KEY"] = secret

    db.init_app(app)

    from . import models
    from .auth import install_auth
    from .routes import main

    app.register_blueprint(main)
    install_auth(app)

    with app.app_context():
        db.create_all()

        should_seed = (
            not database_url
            or os.getenv("SEED_DB") == "true"
        )

        if should_seed:
            from .database import seed_database
            from . import sets

            seed_database([sets.demo])

    return app