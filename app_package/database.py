from .extensions import db
from .models import *

def seed_database(seed_sets):
    """Checks if the DB is empty and adds the Hello World sentence."""
    # Check if the Sentence table is empty
    if is_database_empty():
        for seed_set in seed_sets:
            print(f"Seeding database with set: {seed_set.name} ({len(seed_set.objects)} objects)...")
            for obj in seed_set.objects:
                db.session.add(obj)
        db.session.commit()
    else:
        print("Database already contains data.")

def is_database_empty():
    """
    Checks if the entire database is empty by checking all registered models.
    Returns True if all tables are empty, False otherwise.
    """
    for table in db.metadata.tables.values():
        if db.session.query(table).first() is not None:
            return False
    return True


