import hashlib
import os
import re
import secrets
import smtplib
import ssl
import time

from datetime import timedelta
from email.message import EmailMessage
from threading import Lock
from urllib.parse import quote

from flask import (
    Blueprint,
    current_app,
    jsonify,
    request,
    session,
)

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from werkzeug.security import (
    generate_password_hash,
    check_password_hash,
)

from .extensions import db


auth = Blueprint("auth", __name__, url_prefix="/api/auth")


class Account(db.Model):
    __tablename__ = "learning_account"

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(
        db.String(30),
        unique=True,
        nullable=False,
    )

    email = db.Column(
        db.String(254),
        unique=True,
        nullable=False,
    )

    password_hash = db.Column(db.Text, nullable=False)

    session_version = db.Column(
        db.Integer,
        default=1,
        nullable=False,
    )


class PasswordReset(db.Model):
    __tablename__ = "learning_password_reset"

    token_hash = db.Column(
        db.String(64),
        primary_key=True,
    )

    account_id = db.Column(
        db.Integer,
        db.ForeignKey("learning_account.id"),
        nullable=False,
    )

    expires_at = db.Column(db.Float, nullable=False)

    used = db.Column(
        db.Boolean,
        default=False,
        nullable=False,
    )


_attempts = {}
_attempt_lock = Lock()


def limited(action, maximum=15):
    """Local, single-process request limit."""
    now = time.time()
    key = (request.remote_addr, action)

    with _attempt_lock:
        for old_key in list(_attempts):
            if now - _attempts[old_key][0] >= 900:
                del _attempts[old_key]

        started, count = _attempts.get(key, (now, 0))
        _attempts[key] = (started, count + 1)

        return count >= maximum


def request_data():
    value = request.get_json(silent=True)
    return value if isinstance(value, dict) else {}


def public_user(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
    }


def current_user():
    account_id = session.get("account_id")

    if not isinstance(account_id, int):
        return None

    user = db.session.get(Account, account_id)

    if (
        user is None
        or user.session_version != session.get("account_version")
    ):
        session.clear()
        return None

    return user


def valid_password(password):
    return (
        isinstance(password, str)
        and 12 <= len(password) <= 128
    )


def password_hash(password):
    return generate_password_hash(
        password,
        method="pbkdf2:sha256:1000000",
    )


def start_session(user, remember=False):
    session.clear()

    session["account_id"] = user.id
    session["account_version"] = user.session_version

    duration = 30 * 86400 if remember else 12 * 3600
    session["expires_at"] = time.time() + duration

    session.permanent = remember


@auth.get("/session")
def get_session():
    user = current_user()

    return jsonify(
        user=public_user(user) if user else None,
        password_reset_available=bool(
            os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM")
        ),
    )


@auth.post("/register")
def register():
    if limited("register", 8):
        return jsonify(
            error="Too many attempts. Try again in 15 minutes."
        ), 429

    data = request_data()

    username = str(data.get("username", "")).strip().lower()
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password")

    if not re.fullmatch(r"[a-z0-9_]{3,30}", username):
        return jsonify(
            error="Use 3–30 English letters, numbers or underscores."
        ), 400

    if (
        len(email) > 254
        or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email)
    ):
        return jsonify(error="Enter a valid email address."), 400

    if not valid_password(password):
        return jsonify(
            error="Use a password between 12 and 128 characters."
        ), 400

    existing = Account.query.filter(
        or_(
            Account.username == username,
            Account.email == email,
        )
    ).first()

    if existing:
        return jsonify(
            error="That username or email is already registered."
        ), 409

    user = Account(
        username=username,
        email=email,
        password_hash=password_hash(password),
        session_version=1,
    )

    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()

        return jsonify(
            error="That username or email is already registered."
        ), 409

    start_session(user)

    return jsonify(user=public_user(user)), 201


@auth.post("/login")
def login():
    if limited("login"):
        return jsonify(
            error="Too many attempts. Try again in 15 minutes."
        ), 429

    data = request_data()

    identity = str(data.get("identity", "")).strip().lower()
    password = data.get("password", "")

    if (
        len(identity) > 254
        or not isinstance(password, str)
        or not 1 <= len(password) <= 128
    ):
        return jsonify(
            error="Username/email or password is incorrect."
        ), 401

    user = Account.query.filter(
        or_(
            Account.username == identity,
            Account.email == identity,
        )
    ).first()

    stored_hash = (
        user.password_hash
        if user
        else current_app.config["AUTH_DUMMY_HASH"]
    )

    correct = check_password_hash(stored_hash, password)

    if not correct or user is None:
        return jsonify(
            error="Username/email or password is incorrect."
        ), 401

    start_session(user, data.get("remember") is True)

    return jsonify(user=public_user(user))


@auth.post("/logout")
def logout():
    session.clear()
    return jsonify(success=True)


def send_reset_email(email, token):
    origin = current_app.config["FRONTEND_ORIGIN"]

    link = origin + "/#reset=" + quote(token, safe="")

    message = EmailMessage()
    message["Subject"] = "Reset your Flashcard Studio password"
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = email

    message.set_content(
        "A password reset was requested for your account.\n\n"
        + link
        + "\n\nThis link expires in 30 minutes and works once.\n"
        "If you did not request this, ignore this email."
    )

    security = os.getenv("SMTP_SECURITY", "starttls")

    if security not in ("starttls", "ssl"):
        raise RuntimeError("Use SMTP_SECURITY=starttls or ssl")

    smtp_class = (
        smtplib.SMTP_SSL
        if security == "ssl"
        else smtplib.SMTP
    )

    port = int(
        os.getenv(
            "SMTP_PORT",
            "465" if security == "ssl" else "587",
        )
    )

    options = (
        {"context": ssl.create_default_context()}
        if security == "ssl"
        else {}
    )

    with smtp_class(
        os.environ["SMTP_HOST"],
        port,
        timeout=12,
        **options,
    ) as server:
        if security == "starttls":
            server.starttls(context=ssl.create_default_context())

        if os.getenv("SMTP_USERNAME"):
            server.login(
                os.environ["SMTP_USERNAME"],
                os.environ.get("SMTP_PASSWORD", ""),
            )

        server.send_message(message)


@auth.post("/forgot-password")
def forgot_password():
    if limited("forgot", 5):
        return jsonify(
            error="Too many requests. Try again in 15 minutes."
        ), 429

    if not (os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM")):
        return jsonify(
            error="Password reset email is not configured yet."
        ), 503

    email = str(
        request_data().get("email", "")
    ).strip().lower()

    if (
        len(email) > 254
        or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email)
    ):
        return jsonify(error="Enter a valid email address."), 400

    user = Account.query.filter_by(email=email).first()

    if user:
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        PasswordReset.query.filter(
            PasswordReset.expires_at < time.time()
        ).delete(synchronize_session=False)

        db.session.add(
            PasswordReset(
                token_hash=token_hash,
                account_id=user.id,
                expires_at=time.time() + 1800,
                used=False,
            )
        )

        db.session.commit()

        try:
            send_reset_email(user.email, token)
        except Exception:
            current_app.logger.error(
                "Password reset delivery failed. Check SMTP settings."
            )

            PasswordReset.query.filter_by(
                token_hash=token_hash
            ).delete(synchronize_session=False)

            db.session.commit()

    # Same response whether or not the email exists.
    return jsonify(
        message=(
            "Request received. If this email is registered, check "
            "your inbox and spam folder for a reset link. "
            "If no email arrives, contact the project administrator."
        )
    )


@auth.post("/reset-password")
def reset_password():
    if limited("reset"):
        return jsonify(
            error="Too many attempts. Try again in 15 minutes."
        ), 429

    data = request_data()
    token = data.get("token")
    password = data.get("password")

    if (
        not isinstance(token, str)
        or not 20 <= len(token) <= 200
        or not valid_password(password)
    ):
        return jsonify(
            error="Use the reset link and a password of 12–128 characters."
        ), 400

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    record = PasswordReset.query.filter_by(
        token_hash=token_hash
    ).with_for_update().first()

    if (
        record is None
        or record.used
        or record.expires_at <= time.time()
    ):
        db.session.rollback()

        return jsonify(
            error="This link is expired or already used. Request a new one."
        ), 400

    claimed = PasswordReset.query.filter_by(
        token_hash=token_hash,
        used=False,
    ).filter(
        PasswordReset.expires_at > time.time()
    ).update(
        {"used": True},
        synchronize_session=False,
    )

    if claimed != 1:
        db.session.rollback()

        return jsonify(
            error="This reset link is no longer valid."
        ), 400

    user = db.session.get(Account, record.account_id)

    if user is None:
        db.session.rollback()
        return jsonify(error="This reset link is no longer valid."), 400

    user.password_hash = password_hash(password)
    user.session_version += 1

    PasswordReset.query.filter_by(
        account_id=user.id
    ).update(
        {"used": True},
        synchronize_session=False,
    )

    db.session.commit()
    session.clear()

    return jsonify(
        message="Password updated. Sign in with your new password."
    )


def install_auth(app):
    app.config.update(
        SESSION_COOKIE_NAME="arabic_learning_session",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=(
            os.getenv("COOKIE_SECURE", "false").lower() == "true"
        ),
        PERMANENT_SESSION_LIFETIME=timedelta(days=30),
        SESSION_REFRESH_EACH_REQUEST=False,
        AUTH_DUMMY_HASH=password_hash(secrets.token_urlsafe(32)),
    )

    app.register_blueprint(auth)

    @app.before_request
    def protect_application():
        # Never expose server configuration.
        if request.path == "/env-vars":
            return jsonify(error="Not found."), 404

        if request.method == "OPTIONS":
            return None

        is_api = (
            request.path.startswith("/api/")
            or request.path in (
                "/translate",
                "/add-words",
                "/suggest-words",
                "/suggest-words-isri",
                "/get-data",
            )
        )

        if not is_api:
            return None

        if session.get("expires_at", 0) < time.time():
            session.clear()

        if request.method not in ("GET", "HEAD"):
            origin = request.headers.get("Origin")

            allowed_origins = {
                app.config["FRONTEND_ORIGIN"],
                request.host_url.rstrip("/"),
            }

            if origin and origin not in allowed_origins:
                return jsonify(
                    error="This request origin is not allowed."
                ), 403

            if request.headers.get("Sec-Fetch-Site") == "cross-site":
                return jsonify(
                    error="Cross-site requests are not allowed."
                ), 403

            if request.method != "DELETE" and not request.is_json:
                return jsonify(error="Send JSON content."), 415

        if (
            not request.path.startswith("/api/auth/")
            and current_user() is None
        ):
            return jsonify(error="Please sign in to continue."), 401

        return None

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"

        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"

        return response