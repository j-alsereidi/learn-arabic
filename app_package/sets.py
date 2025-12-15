from .models import *

class Set:
    def __init__(self, name, objects):
        self.name = name
        self.objects = objects

demo = Set(
    "Demo Set",
    [
        # --- Original Sentence 1 ---
        Sentence(
            sentence_id=1,
            plaintext="مرحبا بالعالم",
            translation="Hello, world",
            source_id=1,
            complete=False,
            length=2
        ),
        Word(
            word_id=1,
            root_id=1,
            plaintext="مرحبا",
            translation="Hello",
            known=False,
        ),
        Word(
            word_id=2,
            root_id=2,
            plaintext="بالعالم",
            translation="to the world",
            known=False,
        ),
        Root(
            root_id=1,
            plaintext="رحب",
            translation="to welcome",
        ),
        Root(
            root_id=2,
            plaintext="علم",
            translation="world, knowledge",
        ),

        # --- Add Sentence 2 ---
        Sentence(
            sentence_id=2,
            plaintext="أدرس اللغة العربية",
            translation="I am studying the Arabic language",
            source_id=1,
            complete=False,
            length=3
        ),
        Word(
            word_id=3,
            root_id=3,
            plaintext="أدرس",
            translation="I study",
            known=False,
        ),
        Word(
            word_id=4,
            root_id=4,
            plaintext="اللغة",
            translation="the language",
            known=False,
        ),
        Word(
            word_id=5,
            root_id=5,
            plaintext="العربية",
            translation="the Arabic",
            known=False,
        ),
        Root(
            root_id=3,
            plaintext="درس",
            translation="to study",
        ),
        Root(
            root_id=4,
            plaintext="لغو",
            translation="speech, language",
        ),
        Root(
            root_id=5,
            plaintext="عرب",
            translation="Arab",
        ),

        # --- Added Sentence 3 ---
        Sentence(
            sentence_id=3,
            plaintext="الباب مفتوح",
            translation="The door is open",
            source_id=1,
            complete=False,
            length=2
        ),
        Word(
            word_id=6,
            root_id=6,
            plaintext="الباب",
            translation="the door",
            known=False,
        ),
        Root(
            root_id=6,
            plaintext="بوب",
            translation="gate, door",
        )
    ]
)