"""
Accounts. The website signs in with Firebase Authentication (email and password, or Google in a popup) and trades
the Firebase ID token for a session cookie here; the website and the browser extension both use that cookie.
Without an account you're a guest: a fresh database for this browser session, instance/guests/<id>.db, deleted
once it's gone unused for GUEST_IDLE (or to stay under MAX_GUESTS).

Data: data/static.db (Tatoeba) is shared, instance/accounts.db lists the accounts, and each account has its own
database, instance/users/<uid>.db: the lexicon with its known words and review state, flashcards, reviews,
calibration and settings. A new account's database starts from data/example_user.db with the progress cleared.
The account whose email is OWNER_EMAIL (in .env) starts from instance/user.db instead: the data from before accounts.
"""
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import threading
from base64 import b64encode
from datetime import datetime, timedelta

from flask import Blueprint, current_app, g, jsonify, request, session
from sqlalchemy import create_engine

from . import lexicon
from .extensions import db
from .models import Account

auth = Blueprint('auth', __name__)

FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', 'flashcard-studio-f54c5')
PUBLIC = {'auth.session_login', 'auth.logout', 'auth.me', 'auth.guest', 'main.twilio_webhook', 'main.home', 'static'}
LINK_MINUTES = 15
GUEST_IDLE = timedelta(days=1)
MAX_GUESTS = 1000  # ~140 KB each
# A new account's data: the example database without its progress
RESET = """
DELETE FROM word_instance; DELETE FROM sentence; DELETE FROM calibration_step; DELETE FROM review; DELETE FROM setting;
DELETE FROM lemma_state; DELETE FROM my_lemma; DELETE FROM word;
"""

_engines, _lock = {}, threading.Lock()


def user_db_path(uid):
    return os.path.join(current_app.instance_path, 'users', f'{uid}.db')


def create_user_db(path, source):
    """A copy of `source` at `path` (written aside, then moved in, so a half-made file never shows); a new
    account's (no source) is the example database without its progress."""
    from . import EXAMPLE_USER_DB
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f'{path}.{os.getpid()}.tmp'
    src, dst = sqlite3.connect(source or EXAMPLE_USER_DB), sqlite3.connect(tmp)
    src.backup(dst)  # safe while the source is open elsewhere
    src.close()
    dst.close()
    engine = open_user_db(tmp)
    if not source:
        with engine.begin() as conn:
            for statement in filter(str.strip, RESET.split(';')):
                conn.exec_driver_sql(statement)
    engine.dispose()
    os.replace(tmp, path)


def open_user_db(path):
    """An engine for an account database: the shared lexicon attached, and up to date (lexicon.py)."""
    engine = create_engine(f'sqlite:///{path}')
    lexicon.attach(engine, db.engines['static'].url.database)
    lexicon.upgrade(engine)
    return engine


def engine_for(path):
    """The engine for an account's or guest's database, made (a fresh one if the file is missing) on first use."""
    with _lock:
        if path not in _engines:
            if not os.path.exists(path):
                create_user_db(path, None)
            _engines[path] = open_user_db(path)
        return _engines[path]


def user_engine(uid):
    return engine_for(user_db_path(uid))


def guest_db_path(guest):
    return os.path.join(current_app.instance_path, 'guests', f'{guest}.db')


def prune_guests():
    """Deletes guest databases unused for GUEST_IDLE, and the oldest beyond MAX_GUESTS."""
    folder = os.path.join(current_app.instance_path, 'guests')
    if not os.path.isdir(folder):
        return
    files = sorted((os.path.getmtime(p), p) for p in (os.path.join(folder, f) for f in os.listdir(folder)) if p.endswith('.db'))
    cutoff = (datetime.now() - GUEST_IDLE).timestamp()
    for k, (mtime, path) in enumerate(files):
        if mtime < cutoff or len(files) - k > MAX_GUESTS:
            with _lock:
                engine = _engines.pop(path, None)
            if engine:
                engine.dispose()
            try:
                os.remove(path)
            except OSError:
                pass  # in use on Windows, or already gone: next time


@auth.before_app_request
def require_account():
    """Every route but sign-in and the Twilio webhook needs an account or a guest session, and works on its database."""
    if request.endpoint in PUBLIC or request.method == 'OPTIONS':
        return None
    uid, guest = session.get('uid'), session.get('guest')
    if uid and db.session.get(Account, uid):
        g.uid, g.user_engine = uid, user_engine(uid)
    elif guest and os.path.exists(guest_db_path(guest)):
        os.utime(guest_db_path(guest))  # still in use
        g.uid, g.user_engine = None, engine_for(guest_db_path(guest))
    else:
        return jsonify({'error': 'Not signed in'}), 401
    return None


@auth.route('/api/auth/guest', methods=['POST'])
def guest():
    """A guest session (for this browser session only) with a fresh database, unless there's a session already."""
    if not (session.get('uid') or (session.get('guest') and os.path.exists(guest_db_path(session['guest'])))):
        prune_guests()
        session.clear()
        session['guest'] = secrets.token_hex(12)
        session.permanent = False  # the cookie ends with the browser session
        engine_for(guest_db_path(session['guest']))
    return me()


def account_json(account):
    return {'uid': account.uid, 'email': account.email, 'name': account.name, 'photo': account.photo,
            'phone': account.phone, 'twilio_number': os.environ.get('TWILIO_NUMBER')}


@auth.route('/api/auth/session', methods=['POST'])
def session_login():
    """{idToken} from Firebase on the website -> the session cookie, and the account."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
    try:
        claims = id_token.verify_firebase_token(request.get_json()['idToken'], google_requests.Request(), audience=FIREBASE_PROJECT_ID)
        assert claims['iss'] == f'https://securetoken.google.com/{FIREBASE_PROJECT_ID}'
        uid = claims['sub']
        assert re.fullmatch(r'[A-Za-z0-9_-]{1,128}', uid)  # it names a file
    except Exception as e:
        current_app.logger.warning('Sign-in refused: %s', e)
        return jsonify({'error': 'Sign-in failed'}), 401

    account = db.session.get(Account, uid)
    if not account:
        account = Account(uid=uid, created=datetime.utcnow())
        db.session.add(account)
        owner = os.environ.get('OWNER_EMAIL', '').strip().lower()
        legacy = os.path.join(current_app.instance_path, 'user.db')
        if owner and claims.get('email_verified') and (claims.get('email') or '').lower() == owner \
                and os.path.exists(legacy) and not os.path.exists(user_db_path(uid)):
            create_user_db(user_db_path(uid), legacy)
    account.email, account.name, account.photo = claims.get('email'), claims.get('name'), claims.get('picture')
    db.session.commit()

    session.clear()
    session['uid'] = uid
    session.permanent = True
    return jsonify({'user': account_json(account)})


@auth.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})


@auth.route('/api/auth/me')
def me():
    """{user: the account or null, guest: whether this is a guest session}."""
    account = db.session.get(Account, session['uid']) if session.get('uid') else None
    guest = bool(session.get('guest')) and os.path.exists(guest_db_path(session['guest']))
    return jsonify({'user': account_json(account) if account else None, 'guest': guest and not account})


# ---- texting sentences to the Library (Twilio) ----

@auth.route('/api/auth/phone', methods=['POST'])
def phone_code():
    """A code to text to the Twilio number from the phone to link it to this account."""
    if not g.uid:
        return jsonify({'error': 'Sign in to link a phone'}), 403
    account = db.session.get(Account, g.uid)
    account.link_code = f'{secrets.randbelow(10 ** 6):06d}'
    account.link_expires = datetime.utcnow() + timedelta(minutes=LINK_MINUTES)
    db.session.commit()
    return jsonify({'code': account.link_code, 'number': os.environ.get('TWILIO_NUMBER'), 'minutes': LINK_MINUTES})


@auth.route('/api/auth/phone', methods=['DELETE'])
def phone_unlink():
    if not g.uid:
        return jsonify({'error': 'Sign in to link a phone'}), 403
    account = db.session.get(Account, g.uid)
    account.phone = account.link_code = account.link_expires = None
    db.session.commit()
    return jsonify({'user': account_json(account)})


def link_phone(number, code):
    """The account waiting for this code, now linked to the phone that texted it (taken from any other account)."""
    account = Account.query.filter(Account.link_code == code, Account.link_expires > datetime.utcnow()).first()
    if not account:
        return None
    Account.query.filter(Account.phone == number, Account.uid != account.uid).update({'phone': None})
    account.phone, account.link_code, account.link_expires = number, None, None
    db.session.commit()
    return account


def twilio_signature_ok():
    """The request really comes from Twilio: X-Twilio-Signature is the HMAC-SHA1, keyed with the auth token, of
    the URL followed by each form parameter's name and value, sorted by name."""
    token = os.environ.get('TWILIO_AUTH_TOKEN')
    if not token:
        current_app.logger.warning('TWILIO_AUTH_TOKEN is not set: refusing texts')
        return False
    signed = request.url + ''.join(k + v for k, v in sorted(request.form.items(multi=True)))
    expected = b64encode(hmac.new(token.encode(), signed.encode(), hashlib.sha1).digest()).decode()
    return hmac.compare_digest(expected, request.headers.get('X-Twilio-Signature', ''))
