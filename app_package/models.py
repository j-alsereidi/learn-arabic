from .extensions import db

class Root(db.Model):
    __tablename__ = 'root'
    root_id = db.Column(db.Integer, primary_key=True)
    plaintext = db.Column(db.String, nullable=False)
    translation = db.Column(db.String)
    words = db.relationship('Word', backref='root', lazy=True)

class Word(db.Model):
    __tablename__ = 'word'
    word_id = db.Column(db.Integer, primary_key=True)
    root_id = db.Column(db.Integer, db.ForeignKey('root.root_id'))
    plaintext = db.Column(db.String, nullable=False)
    translation = db.Column(db.String)
    frequency = db.Column(db.Integer, default=0)
    known = db.Column(db.Boolean, default=False)
    prune = db.Column(db.String)

class Sentence(db.Model):
    __tablename__ = 'sentence'
    sentence_id = db.Column(db.Integer, primary_key=True)
    plaintext = db.Column(db.String, nullable=False)
    translation = db.Column(db.String)
    complete = db.Column(db.Boolean, default=False)
    length = db.Column(db.Integer)

class WordInstance(db.Model):
    __tablename__ = 'word_instance'
    sentence_id = db.Column(db.Integer, db.ForeignKey('sentence.sentence_id'), primary_key=True)
    word_id = db.Column(db.Integer, db.ForeignKey('word.word_id'))
    index = db.Column(db.Integer, primary_key=True) 

class Flashcard(db.Model):
    __tablename__ = 'flashcard'
    card_id = db.Column(db.Integer, primary_key=True)
    sentence_id = db.Column(db.Integer, db.ForeignKey('sentence.sentence_id'))
    plaintext = db.Column(db.String)
    translation = db.Column(db.String)