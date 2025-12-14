from .extensions import db
from .models import Sentence

def seed_database():
    """Checks if the DB is empty and adds the Hello World sentence."""
    # Check if the Sentence table is empty
    if not Sentence.query.first():
        print("Seeding database with initial sentence...")
        demo_sentence = Sentence(
            plaintext="Hello World",
            translation="Hola Mundo",
            source_id=1,
            complete=False,
            length=2
        )
        db.session.add(demo_sentence)
        db.session.commit()
    else:
        print("Database already contains data.")