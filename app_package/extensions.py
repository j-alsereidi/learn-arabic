from flask import g, has_request_context
from flask_sqlalchemy import SQLAlchemy
from flask_sqlalchemy.session import Session
from sqlalchemy import inspect, text


class UserSession(Session):
    """Tables without a bind key (the lexicon with your known words, flashcards, reviews, settings...) live in the
    signed-in account's own database (auth.user_engine, set on g for each request); the shared static and
    accounts databases keep their own engines. Outside requests (scripts, startup) it's the default database."""

    def get_bind(self, mapper=None, clause=None, bind=None, **kwargs):
        engine = super().get_bind(mapper=mapper, clause=clause, bind=bind, **kwargs)
        if engine is not self._db.engines.get(None) or not has_request_context():
            return engine
        user = g.get('user_engine')
        if user is None:  # never fall back to someone else's data
            raise RuntimeError('No account for this request')
        return user


db = SQLAlchemy(session_options={'class_': UserSession})


def add_missing_columns(metadata, engine):
    """create_all() only makes missing tables; this adds the columns models gained since to existing ones."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in metadata.sorted_tables:
            have = {c['name'] for c in inspector.get_columns(table.name)}
            for col in table.columns:
                if col.name not in have:
                    conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(engine.dialect)}'))
