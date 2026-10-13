"""Run from the project root: python seed_arabic.py"""

import json
import unicodedata

from app_package import create_app
from app_package.extensions import db
from app_package.models import Word, Root, Sentence


class ArabicFoundation(db.Model):
    __tablename__ = 'arabic_foundation'

    key = db.Column(db.String(120), primary_key=True)
    kind = db.Column(db.String(30), nullable=False)
    arabic = db.Column(db.Text, nullable=False)
    english = db.Column(db.Text, nullable=False)
    details = db.Column(db.Text, nullable=False)


def unvocalized(value):
    value = unicodedata.normalize('NFC', value)

    return ''.join(
        character
        for character in value
        if character != 'ـ'
        and unicodedata.category(character) != 'Mn'
    )


# Each entry describes a teaching sense.
# The correct interpretation still depends on context.
GROUPS = {
    'pronoun': [
        ('أنا', 'I'),
        ('نحن', 'we'),
        ('أَنْتَ', 'you (masculine singular)'),
        ('أَنْتِ', 'you (feminine singular)'),
        ('أنتما', 'you two'),
        ('أنتم', 'you (masculine plural)'),
        ('أنتن', 'you (feminine plural)'),
        ('هو', 'he'),
        ('هي', 'she'),
        ('هما', 'they two'),
        ('هم', 'they (masculine plural)'),
        ('هن', 'they (feminine plural)')
    ],

    'preposition': [
        ('مِنْ', 'from'),
        ('إلى', 'to'),
        ('عن', 'about / away from'),
        ('على', 'on / upon'),
        ('في', 'in / at')
    ],

    'connector': [
        ('و', 'and'),
        ('أو', 'or'),
        ('ثم', 'then'),
        ('لكن', 'but'),
        ('لأن', 'because'),
        ('لذلك', 'therefore')
    ],

    'question_word': [
        ('مَنْ', 'who'),
        ('ما', 'what'),
        ('ماذا', 'what'),
        ('أين', 'where'),
        ('متى', 'when'),
        ('كيف', 'how'),
        ('لماذا', 'why'),
        ('كم', 'how many / how much'),
        ('هل', 'yes/no question particle')
    ],

    'negation': [
        ('لا', 'not / no; use depends on construction'),
        ('لم', 'did not; followed by a jussive present-tense verb'),
        ('لن', 'will not; followed by a subjunctive present-tense verb'),
        ('ما', 'not; one common use is with a past-tense verb'),
        ('ليس', 'is not; a defective verb')
    ],

    'demonstrative': [
        ('هذا', 'this (masculine)'),
        ('هذه', 'this (feminine)'),
        ('هذان', 'these two (masculine nominative)'),
        ('هاتان', 'these two (feminine nominative)'),
        ('هؤلاء', 'these; commonly people'),
        ('ذلك', 'that (masculine)'),
        ('تلك', 'that (feminine)'),
        ('أولئك', 'those; commonly people')
    ],

    'relative_word': [
        ('الذي', 'who / which / that (masculine singular)'),
        ('التي', 'who / which / that (feminine singular)'),
        ('اللذان', 'who / which (masculine dual nominative)'),
        ('اللتان', 'who / which (feminine dual nominative)'),
        ('الذين', 'who / which (masculine plural)'),
        ('اللواتي', 'who / which (feminine plural)')
    ]
}


# Arabic, meaning, root, gender, plural.
# A blank root means no root is supplied in this starter collection.
NOUNS = [
    ('كتاب', 'book', 'ك ت ب', 'masculine', 'كُتُب'),
    ('مكتبة', 'library', 'ك ت ب', 'feminine', 'مكتبات'),
    ('مكتب', 'desk / office', 'ك ت ب', 'masculine', 'مكاتب'),
    ('كاتب', 'writer', 'ك ت ب', 'masculine', 'كُتّاب'),
    ('مدرسة', 'school', 'د ر س', 'feminine', 'مدارس'),
    ('طالب', 'male student', 'ط ل ب', 'masculine', 'طلاب'),
    ('طالبة', 'female student', 'ط ل ب', 'feminine', 'طالبات'),
    ('بيت', 'house', 'ب ي ت', 'masculine', 'بيوت'),
    ('بنت', 'girl / daughter', '', 'feminine', 'بنات'),
    ('ولد', 'boy / child', 'و ل د', 'masculine', 'أولاد'),
    ('ماء', 'water', '', 'masculine', 'مياه'),
    ('جامعة', 'university', 'ج م ع', 'feminine', 'جامعات')
]


ROOTS = {
    'ك ت ب': 'writing',
    'د ر س': 'studying',
    'ط ل ب': 'requesting / seeking',
    'ب ي ت': 'dwelling / spending the night',
    'و ل د': 'birth',
    'ج م ع': 'gathering'
}


LETTERS = list('ابتثجحخدذرزسشصضطظعغفقكلمنهوي')


MARKS = [
    ('fatha', '\u064e', 'Fatha', 'Short a vowel.'),
    ('damma', '\u064f', 'Damma', 'Short u vowel.'),
    ('kasra', '\u0650', 'Kasra', 'Short i vowel.'),
    ('sukun', '\u0652', 'Sukun', 'Absence of a short vowel.'),
    (
        'shadda',
        '\u0651',
        'Shadda',
        'Consonant doubling; may combine with a vowel.'
    ),
    (
        'tanwin_fath',
        '\u064b',
        'Fathatan',
        'Tanwin with an ending an sound.'
    ),
    (
        'tanwin_damm',
        '\u064c',
        'Dammatan',
        'Tanwin with an ending un sound.'
    ),
    (
        'tanwin_kasr',
        '\u064d',
        'Kasratan',
        'Tanwin with an ending in sound.'
    )
]


LESSONS = [
    (
        'letters',
        'الحروف والحركات',
        'Letters and written marks',
        'Arabic is written from right to left. '
        'Letter shapes depend on position and joining. '
        'ا د ذ ر ز و do not join to the following letter. '
        'ء is hamza; أ إ ؤ ئ are hamza forms. '
        'ة, ت and ى are distinct. '
        'Written marks are not separate alphabet letters.'
    ),
    (
        'sun_moon',
        'الحروف الشمسية والقمرية',
        'Sun and moon letters',
        'Sun letters: ت ث د ذ ر ز س ش ص ض ط ظ ل ن. '
        'Moon letters: ا ب ج ح خ ع غ ف ق ك م ه و ي. '
        'The lam in ال assimilates before a sun letter in '
        'pronunciation; it remains written. '
        'Examples: الشَّمْس and الْقَمَر.'
    ),
    (
        'prepositions',
        'حروف الجر',
        'Prepositions',
        'Common prepositions include من، إلى، عن، على، في. '
        'بـ، كـ، لـ attach to the following word. '
        'A following declinable noun is genitive. '
        'Its sign is not always kasra. '
        'Meanings depend on context.'
    ),
    (
        'pronouns',
        'الضمائر',
        'Independent and attached pronouns',
        'Independent pronouns include '
        'أنا، نحن، أنتَ، أنتِ، أنتما، أنتم، أنتن، '
        'هو، هي، هما، هم، هن. '
        'Attached pronouns change their role with the host word. '
        'كتابي means my book; كتابه means his book. '
        'Not every pronoun or particle needs a lexical root.'
    ),
    (
        'noun_forms',
        'الأسماء',
        'Nouns and agreement',
        'Nouns can be singular, dual or plural, masculine '
        'or feminine, definite or indefinite. '
        'Examples: طالب، طالبان، طلاب؛ طالبة، طالبتان، طالبات. '
        'An adjective normally agrees with its noun; '
        'non-human plurals have special agreement patterns.'
    ),
    (
        'verbs',
        'الأفعال',
        'Verb forms',
        'كَتَبَ: he wrote. يَكْتُبُ: he writes. '
        'اُكْتُبْ: write! to one male. '
        'سَيَكْتُبُ: he will write. '
        'The subject changes the verb form: أنا أكتب، نحن نكتب. '
        'A root does not determine one meaning or one correct '
        'conjugation by itself.'
    ),
    (
        'sentences',
        'الجمل',
        'Nominal and verbal sentences',
        'البيت كبير is a nominal sentence: the house is big. '
        'قرأ الطالب الكتاب is a verb-first sentence: '
        'the student read the book. '
        'Grammatical roles and endings require sentence context; '
        'a word lookup alone cannot supply them.'
    ),
    (
        'ambiguity',
        'السياق والمعنى',
        'Context and ambiguity',
        'عين may mean an eye, a spring or a spy. '
        'من can represent مِنْ (from) or مَنْ (who). '
        'ما can be interrogative or negative, among other uses. '
        'Preserve vowel marks and show alternatives when the '
        'context is insufficient.'
    )
]


EXAMPLES = [
    ('أنا بنت', 'I am a girl.'),
    ('هذا كتاب', 'This is a book.'),
    ('هذه مكتبة', 'This is a library.'),
    ('هذه مدرسة', 'This is a school.'),
    ('هو طالب', 'He is a student.'),
    ('هي طالبة', 'She is a female student.')
]


def records():
    result = []

    for category, pairs in GROUPS.items():
        for index, (arabic, english) in enumerate(pairs):
            result.append((
                f'word.{category}.{index}',
                'word',
                arabic,
                english,
                {
                    'category': category,
                    'root': None,
                    'note': (
                        'A teaching sense; interpretation '
                        'depends on context.'
                    )
                }
            ))

    for index, item in enumerate(NOUNS):
        arabic, english, root, gender, plural = item

        result.append((
            f'word.noun.{index}',
            'word',
            arabic,
            english,
            {
                'category': 'noun',
                'root': root or None,
                'gender': gender,
                'plural': plural,
                'number': 'singular'
            }
        ))

    for index, letter in enumerate(LETTERS):
        result.append((
            f'letter.{index}',
            'letter',
            letter,
            'Arabic letter',
            {}
        ))

    for key, mark, name, meaning in MARKS:
        result.append((
            f'mark.{key}',
            'mark',
            mark,
            name,
            {'explanation': meaning}
        ))

    for key, arabic, english, explanation in LESSONS:
        result.append((
            f'lesson.{key}',
            'lesson',
            arabic,
            english,
            {
                'explanation': explanation,
                'level': 'foundation'
            }
        ))

    return result


def seed_foundations():
    from app_package.routes import calculate_completeness

    counts = {
        'knowledge_records': 0,
        'words': 0,
        'roots': 0,
        'sentences': 0
    }

    # Create only the additional table if it does not exist.
    ArabicFoundation.__table__.create(
        bind=db.engine,
        checkfirst=True
    )

    try:
        for key, kind, arabic, english, details in records():
            if db.session.get(ArabicFoundation, key) is None:
                db.session.add(ArabicFoundation(
                    key=key,
                    kind=kind,
                    arabic=arabic,
                    english=english,
                    details=json.dumps(
                        details,
                        ensure_ascii=False
                    )
                ))

                counts['knowledge_records'] += 1

            if kind != 'word':
                continue

            # Preserve existing text, meaning and learning status.
            # Additional senses stay in ArabicFoundation.
            existing_word = Word.query.filter_by(
                plaintext=arabic
            ).first()

            if existing_word is not None:
                continue

            root_id = None
            root_text = details.get('root')

            if root_text:
                root = next(
                    (
                        existing_root
                        for existing_root in Root.query.all()
                        if ''.join(existing_root.plaintext.split())
                        == ''.join(root_text.split())
                    ),
                    None
                )

                if root is None:
                    root = Root(
                        plaintext=root_text,
                        translation=ROOTS[root_text]
                    )

                    db.session.add(root)
                    db.session.flush()

                    counts['roots'] += 1

                root_id = root.root_id

            db.session.add(Word(
                plaintext=arabic,
                translation=english,
                root_id=root_id,
                known=False,
                frequency=0,
                prune=unvocalized(arabic)
            ))

            db.session.flush()
            counts['words'] += 1

        for arabic, english in EXAMPLES:
            existing_sentence = Sentence.query.filter_by(
                plaintext=arabic
            ).first()

            if existing_sentence is None:
                db.session.add(Sentence(
                    plaintext=arabic,
                    translation=english,
                    length=len(arabic.split()),
                    complete=False
                ))

                counts['sentences'] += 1

        db.session.flush()

        for sentence in Sentence.query.all():
            sentence.complete = calculate_completeness(sentence)

        db.session.commit()
        return counts

    except Exception:
        db.session.rollback()
        raise


if __name__ == '__main__':
    app = create_app()

    with app.app_context():
        result = seed_foundations()

        print('\nArabic foundations imported successfully:')

        for name, count in result.items():
            print(f'  New {name}: {count}')

        print(
            'Existing text, translations and learning status '
            'were preserved.'
        )
        print(
            'Refresh Database to see words, roots and '
            'example sentences.'
        )
        print(
            'Letters, marks and lessons are stored '
            'in arabic_foundation.'
        )
        print(
            'Displaying those lessons in Library '
            'is a separate next step.'
        )