const lesson = (
  id,
  title,
  arabic,
  unit,
  goal,
  rules,
  examples,
  question,
  options,
  answer,
  why
) => ({
  id,
  title,
  arabic,
  unit,
  goal,
  rules,
  examples,
  question,
  options,
  answer,
  why
});

const LESSONS = [
  lesson(
    1,
    'Letters & written marks',
    'الحروف والحركات',
    'Reading',
    'Recognize the alphabet, connected shapes and vowel marks.',
    [
      'Arabic runs from right to left. A letter may change shape depending on its position. ا د ذ ر ز و do not connect to the following letter on their left.',
      'Fatḥa ـَ = a, ḍamma ـُ = u, kasra ـِ = i. Sukūn ـْ means no short vowel; shadda ـّ doubles a consonant. Tanwīn ـٌ ـً ـٍ adds an n sound in connected reading, commonly on indefinite nouns.',
      'ا و ي can represent long vowels. و and ي can also be consonants. Hamza appears as ء أ إ ؤ ئ; its spelling needs its own rules.',
      'ة is tāʾ marbūṭa; ت is open tāʾ; ى is alif maqṣūra, a final long ā, not dotted ي.',
      'Sun letters: ت ث د ذ ر ز س ش ص ض ط ظ ل ن. The article’s l sound assimilates before them. Moon letters: ا ب ج ح خ ع غ ف ق ك م ه و ي; the l is retained.'
    ],
    [
      ['بَ / بُ / بِ', 'ba / bu / bi'],
      ['بَا / بُو / بِي', 'bā / bū / bī: long vowels'],
      ['الشَّمْس / الْقَمَر', 'the sun / the moon'],
      ['مَدْرَسَة / بَيْت / فَتَى', 'school / house / boy']
    ],
    'Which mark indicates a doubled consonant?',
    ['Shadda ـّ', 'Sukūn ـْ', 'Kasra ـِ'],
    0,
    'Shadda marks a doubled consonant. Sukūn marks the absence of a short vowel.'
  ),

  lesson(
    2,
    'Reading a word entry',
    'معلومات الكلمة',
    'Words',
    'Read meaning, word type, gender and related forms.',
    [
      'The three main word types are noun اسم, verb فعل and particle حرف.',
      'A useful word entry gives a contextual meaning and an example. Nouns may have gender and plural forms; verbs have conjugated forms.',
      'Roots, synonyms and antonyms apply where meaningful. A word does not always have a useful opposite or a lexical root.'
    ],
    [
      [
        'مَكْتَبَة',
        'library · noun · feminine · root ك ت ب · plural مَكْتَبَات'
      ],
      ['ذَهَبْتُ إِلَى الْمَكْتَبَةِ.', 'I went to the library.'],
      ['كَبِير / صَغِير', 'big / small: opposites'],
      [
        'سَعِيد / مَسْرُور',
        'happy / pleased: related meanings, chosen by context'
      ]
    ],
    'What type of word is مكتبة?',
    ['Verb', 'Noun', 'Particle'],
    1,
    'مكتبة names a place, so it is a noun.'
  ),

  lesson(
    3,
    'Roots & word families',
    'الجذور',
    'Words',
    'Connect related words without assuming they have the same meaning.',
    [
      'Many Arabic words share a root, often three consonants.',
      'A root suggests a family of meanings; the full word and context determine the actual meaning.',
      'Do not guess a root by simply deleting the first and last letters. Some words have no productive Arabic root.'
    ],
    [
      ['كَتَبَ / كِتَاب / كَاتِب', 'wrote / book / writer · root ك ت ب'],
      ['مَكْتُوب / كِتَابَة', 'written / writing'],
      ['مَكْتَب / مَكْتَبَة', 'desk or office / library']
    ],
    'Which root connects كتاب and كاتب?',
    ['ع ل م', 'ذ ه ب', 'ك ت ب'],
    2,
    'Both belong to the ك ت ب word family associated with writing.'
  ),

  lesson(
    4,
    'Prefixes & attached endings',
    'السوابق واللواحق',
    'Words',
    'Notice how small additions change a word.',
    [
      'الـ makes a noun definite: كتاب → الكتاب.',
      'A pronoun attached to a noun can show ownership. كتابي means my book.',
      'وَ can attach as and; بِـ as with/by; لِـ as for/to. Meaning depends on the sentence.'
    ],
    [
      ['كِتَاب / الْكِتَاب', 'a book / the book'],
      ['كِتَابِي / كِتَابُهَا', 'my book / her book'],
      ['بِالْقَلَمِ / لِلْمُعَلِّمِ', 'with the pen / for the teacher']
    ],
    'What does كتابنا mean?',
    ['Their book', 'Our book', 'A book'],
    1,
    'The attached pronoun نا means our when attached to this noun.'
  ),

  lesson(
    5,
    'Nouns: number & gender',
    'الأسماء',
    'Words',
    'Distinguish singular, dual and different plural patterns.',
    [
      'Singular means one, dual means two, and plural means more than two. The dual commonly ends in ـان in the nominative and ـين in the accusative/genitive.',
      'Sound masculine plurals use ـون or ـين; sound feminine plurals use ـات. Broken plurals change the internal pattern.',
      'Many feminine nouns end in ة, but not all. Learn each noun’s gender and plural.'
    ],
    [
      [
        'طَالِب / طَالِبَان / طُلَّاب',
        'a male student / two male students (nominative) / students'
      ],
      [
        'طَالِبَة / طَالِبَتَان / طَالِبَات',
        'a female student / two female students (nominative) / female students'
      ],
      [
        'مُعَلِّمُون / كُتُب',
        'male teachers (sound plural, nominative) / books (broken plural)'
      ]
    ],
    'Which is a broken plural?',
    ['كُتُب', 'مُعَلِّمُون', 'طَالِبَات'],
    0,
    'كتاب becomes كتب through an internal pattern change.'
  ),

  lesson(
    6,
    'Past, present & commands',
    'الأفعال',
    'Verbs',
    'Identify basic verb forms and the future.',
    [
      'Past forms describe completed actions; present forms can describe current or habitual actions.',
      'An imperative gives a command. Its form changes with the addressee.',
      'سـ or سوف before a present form can express the future. These examples use the same verb root.'
    ],
    [
      ['كَتَبَ / يَكْتُبُ', 'he wrote / he writes'],
      ['اُكْتُبْ', 'Write! · to one male person'],
      ['سَيَكْتُبُ / سَوْفَ يَكْتُبُ', 'he will write']
    ],
    'Which form means “he will write”?',
    ['كَتَبَ', 'اُكْتُبْ', 'سَيَكْتُبُ'],
    2,
    'The prefix سـ gives the present form a future meaning here.'
  ),

  lesson(
    7,
    'Conjugating with pronouns',
    'تصريف الأفعال',
    'Verbs',
    'Match a verb to the person doing the action.',
    [
      'Present forms change their prefixes and sometimes their endings with the subject.',
      'Past forms change their endings. أنا كتبتُ means I wrote.',
      'Use the reference table below for singular, dual and plural forms, including feminine forms. These are affirmative indicative present forms and past forms of كتب.'
    ],
    [
      ['أَنَا أَكْتُبُ / أَنَا كَتَبْتُ', 'I write / I wrote'],
      [
        'أَنْتِ تَكْتُبِينَ / أَنْتِ كَتَبْتِ',
        'you write / you wrote · feminine singular'
      ],
      ['نَحْنُ نَكْتُبُ / نَحْنُ كَتَبْنَا', 'we write / we wrote']
    ],
    'Complete: نحن ___',
    ['يَكْتُبُ', 'نَكْتُبُ', 'تَكْتُبِينَ'],
    1,
    'نحن takes نكتب in the present tense.'
  ),

  lesson(
    8,
    'Independent pronouns',
    'الضمائر',
    'Words',
    'Choose pronouns for person, gender and number.',
    [
      'أنا = I; نحن = we. أنتَ and أنتِ both mean you, with masculine and feminine singular forms.',
      'أنتما = you two; أنتم = masculine or mixed plural you; أنتنّ = feminine plural you.',
      'هو = he; هي = she; هما = they two; هم = masculine or mixed plural they; هنّ = feminine plural they.',
      'Attached pronouns change function with their host: كتابي = my book; رأيتُه = I saw him; معه = with him.'
    ],
    [
      ['أَنَا طَالِبٌ.', 'I am a male student.'],
      ['هِيَ طَالِبَةٌ.', 'She is a student.'],
      ['هُمَا طَالِبَانِ.', 'They are two male students.']
    ],
    'Which pronoun means “you two”?',
    ['أَنْتُمَا', 'نَحْنُ', 'هُمْ'],
    0,
    'أنتما addresses two people, whether masculine or feminine.'
  ),

  lesson(
    9,
    'Adjective agreement',
    'الصفات',
    'Grammar',
    'Make an adjective agree with its noun.',
    [
      'An attributive adjective normally follows its noun and agrees in gender, number, definiteness and case.',
      'Non-human plurals generally take feminine singular agreement: كتب جديدة = new books.',
      'Compare a noun phrase with a sentence: البيت الكبير = the big house; البيت كبير = the house is big.'
    ],
    [
      ['وَلَدٌ جَمِيلٌ / بِنْتٌ جَمِيلَةٌ', 'a beautiful boy / a beautiful girl'],
      [
        'وَلَدَانِ جَمِيلَانِ / بَنَاتٌ جَمِيلَاتٌ',
        'two beautiful boys / beautiful girls'
      ],
      ['كُتُبٌ جَدِيدَةٌ', 'new books · non-human plural agreement']
    ],
    'Choose “the big house” as a noun phrase.',
    ['الْبَيْتُ كَبِيرٌ', 'الْبَيْتُ الْكَبِيرُ', 'الْبَيْتُ كَبِيرَةٌ'],
    1,
    'The adjective الكبير is definite, matching البيت.'
  ),

  lesson(
    10,
    'Nominal sentences',
    'الجملة الاسمية',
    'Grammar',
    'Identify the topic and predicate.',
    [
      'A nominal sentence typically begins with a noun or pronoun.',
      'The مبتدأ is the topic. The خبر tells us something about it.',
      'A simple present description does not need a separate word for is or are. The topic and a simple noun/adjective predicate are normally nominative.'
    ],
    [
      ['الْبَيْتُ كَبِيرٌ.', 'The house is big. · البيت: topic; كبير: predicate'],
      ['الطَّالِبَةُ مُجْتَهِدَةٌ.', 'The student is hardworking.'],
      [
        'أَنَا فِي الْبَيْتِ.',
        'I am at home. · a prepositional phrase gives the location'
      ]
    ],
    'In البيت كبير, which word is the predicate?',
    ['البيت', 'Both words', 'كبير'],
    2,
    'كبير gives information about the house.'
  ),

  lesson(
    11,
    'Verbal sentences',
    'الجملة الفعلية',
    'Grammar',
    'Find a verb, its subject and its object.',
    [
      'A verbal sentence begins with a verb.',
      'The فاعل performs the action. A مفعول به receives the action when the verb has a direct object.',
      'Not every verb needs an object. ذهب الطالب means the student went.'
    ],
    [
      ['قَرَأَ الطَّالِبُ الْكِتَابَ.', 'The student read the book.'],
      [
        'قَرَأَ = فعل؛ الطَّالِبُ = فاعل؛ الْكِتَابَ = مفعول به',
        'read = verb; student = subject; book = direct object'
      ],
      ['ذَهَبَ الطَّالِبُ.', 'The student went. · no direct object']
    ],
    'What is the object in قرأ الطالبُ الكتابَ?',
    ['الْكِتَابَ', 'الطَّالِبُ', 'قَرَأَ'],
    0,
    'The book receives the action of reading.'
  ),

  lesson(
    12,
    'Case & basic iʿrāb',
    'الإعراب الأساسي',
    'Grammar',
    'Connect grammatical roles to endings.',
    [
      'Nouns can be nominative رفع, accusative نصب or genitive جر. Present verbs can be indicative رفع, subjunctive نصب or jussive جزم.',
      'Basic signs include ـُ, ـَ, ـِ and ـْ. These are introductory signs: duals, some plurals and other forms have different signs.',
      'A verbal subject is normally nominative; a direct object accusative; a noun after a preposition genitive. Some words have fixed forms.'
    ],
    [
      [
        'قَرَأَ الطَّالِبُ الْكِتَابَ.',
        'الطالبُ: nominative subject; الكتابَ: accusative object'
      ],
      ['فِي الْبَيْتِ', 'in the house · البيتِ is genitive'],
      ['لَمْ يَكْتُبْ', 'he did not write · present verb in the jussive']
    ],
    'Which case follows a preposition?',
    ['Accusative', 'Genitive', 'Jussive'],
    1,
    'A noun governed by a preposition is genitive. Jussive is a verb category.'
  ),

  lesson(
    13,
    'Prepositions',
    'حروف الجر',
    'Grammar',
    'Use location, direction and other relationships.',
    [
      'من = from; إلى = to; عن = about; على = on; في = in.',
      'بـ = with/by; كـ = like; لـ = for/to. These attach directly to the next word.',
      'A following noun is genitive. Choose translations from context rather than assigning one fixed English meaning.'
    ],
    [
      ['ذَهَبْتُ إِلَى الْمَدْرَسَةِ.', 'I went to the school.'],
      ['الْكِتَابُ عَلَى الطَّاوِلَةِ.', 'The book is on the table.'],
      ['كَتَبْتُ بِالْقَلَمِ.', 'I wrote with the pen.']
    ],
    'Choose “in the house”.',
    ['إِلَى الْبَيْتِ', 'مِنَ الْبَيْتِ', 'فِي الْبَيْتِ'],
    2,
    'في expresses location inside a place here.'
  ),

  lesson(
    14,
    'Connecting ideas',
    'الربط والعطف',
    'Grammar',
    'Link additions, alternatives, sequences and reasons.',
    [
      'و = and; أو = or. و does not itself specify the order of events.',
      'ثم = then, generally with a gap; فـ can show close sequence or a result.',
      'لكن = but; لأن = because; لذلك = therefore. Their full grammar differs, even though all can connect ideas.'
    ],
    [
      ['شَايٌ أَوْ قَهْوَةٌ؟', 'Tea or coffee?'],
      ['قَرَأْتُ ثُمَّ كَتَبْتُ.', 'I read, then I wrote.'],
      ['بَقِيتُ فِي الْبَيْتِ لِأَنَّنِي مَرِيضٌ.', 'I stayed at home because I am ill.']
    ],
    'Which word introduces a reason?',
    ['لِأَنَّ', 'أَوْ', 'ثُمَّ'],
    0,
    'لأن introduces a reason: because.'
  ),

  lesson(
    15,
    'Asking questions',
    'أدوات الاستفهام',
    'Grammar',
    'Choose a question word for the information you need.',
    [
      'من = who; ما / ماذا = what; أين = where; متى = when.',
      'كيف = how; لماذا = why; كم = how many / how much.',
      'هل introduces a yes/no question. Do not confuse مَنْ (who) with مِنْ (from).'
    ],
    [
      ['أَيْنَ الْمَكْتَبَةُ؟', 'Where is the library?'],
      ['مَتَى يَبْدَأُ الدَّرْسُ؟', 'When does the lesson start?'],
      ['هَلْ أَنْتَ طَالِبٌ؟', 'Are you a student? · addressing one male person']
    ],
    'Which word asks about time?',
    ['أَيْنَ', 'مَتَى', 'مَنْ'],
    1,
    'متى means when.'
  ),

  lesson(
    16,
    'Making negatives',
    'النفي',
    'Grammar',
    'Distinguish present, past and future negation.',
    [
      'لا أكتبُ = I do not write. This is ordinary present negation, not the prohibitive use of لا.',
      'لم precedes a present form in the jussive but gives a past negative meaning. لن precedes a present form in the subjunctive and negates the future.',
      'ما can negate a past verb. ليس negates a nominal description; its subject is nominative and its predicate accusative.'
    ],
    [
      ['لَا أَكْتُبُ / لَمْ أَكْتُبْ', 'I do not write / I did not write'],
      ['لَنْ أَكْتُبَ / مَا كَتَبْتُ', 'I will not write / I did not write'],
      ['الْبَيْتُ لَيْسَ كَبِيرًا.', 'The house is not big.']
    ],
    'Choose “I will not write”.',
    ['لَا أَكْتُبُ', 'لَمْ أَكْتُبْ', 'لَنْ أَكْتُبَ'],
    2,
    'لن gives future negation and requires the subjunctive form here.'
  ),

  lesson(
    17,
    'This, that & these',
    'أسماء الإشارة',
    'Grammar',
    'Point to people and things.',
    [
      'هذا = this masculine; هذه = this feminine; ذلك = that masculine; تلك = that feminine.',
      'هذان / هاتان are nominative dual forms; هذين / هاتين are accusative/genitive dual forms.',
      'هؤلاء = these and أولئك = those, commonly for people. Non-human plurals generally use feminine singular agreement.'
    ],
    [
      ['هَذَا كِتَابٌ / هَذِهِ مَدْرَسَةٌ', 'This is a book / This is a school'],
      ['هَؤُلَاءِ طُلَّابٌ.', 'These are students.'],
      ['هَذِهِ كُتُبٌ.', 'These are books.']
    ],
    'Complete: ___ مدرسةٌ',
    ['هَذِهِ', 'هَذَا', 'هَذَانِ'],
    0,
    'مدرسة is feminine singular, so use هذه.'
  ),

  lesson(
    18,
    'Relative words',
    'الأسماء الموصولة',
    'Grammar',
    'Add a clause describing a person or thing.',
    [
      'الذي is masculine singular; التي feminine singular; الذين masculine plural; اللواتي or اللاتي feminine plural.',
      'Dual forms: اللذان / اللتان in the nominative; اللذين / اللتين in accusative/genitive contexts.',
      'The following relative clause gives more information. After an indefinite noun, Arabic commonly uses a descriptive clause without الذي.'
    ],
    [
      ['هَذَا الطَّالِبُ الَّذِي قَرَأَ الْكِتَابَ.', 'This is the student who read the book.'],
      ['هَذِهِ الطَّالِبَةُ الَّتِي كَتَبَتْ.', 'This is the student who wrote.'],
      ['رَأَيْتُ طَالِبًا يَقْرَأُ.', 'I saw a student reading. · indefinite noun']
    ],
    'Choose the relative word for a feminine singular noun.',
    ['الَّذِينَ', 'الَّتِي', 'الَّذِي'],
    1,
    'التي refers to a feminine singular noun.'
  ),

  lesson(
    19,
    'Expressing possession',
    'الملكية',
    'Words',
    'Show whose book, house or other object it is.',
    [
      'Attach a pronoun to a noun to show possession. A noun with this possessive suffix is definite and does not also take ال.',
      'كتابكَ and كتابكِ both appear as كتابك without vowel marks; the marks identify the addressee’s gender.',
      'A two-noun إضافة can also show possession: كتاب الطالب = the student’s book. The second noun is genitive.'
    ],
    [
      ['كِتَابِي / كِتَابُكَ / كِتَابُكِ', 'my book / your book (male) / your book (female)'],
      ['كِتَابُهُ / كِتَابُهَا / كِتَابُنَا', 'his book / her book / our book'],
      [
        'كِتَابُكُمَا / كِتَابُكُمْ / كِتَابُكُنَّ',
        'your book: dual / masculine or mixed plural / feminine plural'
      ],
      [
        'كِتَابُهُمَا / كِتَابُهُمْ / كِتَابُهُنَّ',
        'their book: dual / masculine or mixed plural / feminine plural'
      ],
      ['كِتَابُ الطَّالِبِ', 'the student’s book']
    ],
    'What does كتابها mean?',
    ['His book', 'Our book', 'Her book'],
    2,
    'The suffix ها indicates her with this noun.'
  ),

  lesson(
    20,
    'Meaning from context',
    'المعنى من السياق',
    'Words',
    'Use surrounding words to choose the right meaning.',
    [
      'One Arabic word can have several meanings.',
      'عين can mean eye, a water spring or a spy. The surrounding sentence helps select the intended sense.',
      'A dictionary lists possibilities; an example shows one contextual use.'
    ],
    [
      ['عَيْنِي تُؤْلِمُنِي.', 'My eye hurts.'],
      ['شَرِبْنَا مِنْ عَيْنِ مَاءٍ.', 'We drank from a water spring.'],
      ['كَانَ عَيْنًا عَلَى الْعَدُوِّ.', 'He was a spy watching the enemy.']
    ],
    'What does عين mean in عين ماء?',
    ['A water spring', 'An eye', 'A book'],
    0,
    'ماء (water) identifies the water-spring meaning.'
  ),

  lesson(
    21,
    'Building longer sentences',
    'بناء الجمل',
    'Practice',
    'Expand a familiar sentence one piece at a time.',
    [
      'Start with a short complete idea, then add a location, person or time.',
      'Learn a word in several sentences instead of only memorizing a translation.',
      'Longer does not automatically mean better. Keep each example meaningful and grammatically connected.'
    ],
    [
      ['هَذِهِ مَدْرَسَةٌ.', 'This is a school.'],
      ['أَنَا فِي الْمَدْرَسَةِ.', 'I am at school.'],
      [
        'يَذْهَبُ أَحْمَدُ إِلَى الْمَدْرَسَةِ كُلَّ صَبَاحٍ.',
        'Ahmed goes to school every morning.'
      ]
    ],
    'Which phrase adds “every morning”?',
    ['إِلَى الْمَدْرَسَةِ', 'كُلَّ صَبَاحٍ', 'هَذِهِ مَدْرَسَةٌ'],
    1,
    'كل صباح adds how often and when the action happens.'
  ),

  lesson(
    22,
    'Correcting sentences',
    'تصحيح الجمل',
    'Practice',
    'Find a mismatch and explain the correction.',
    [
      'Check the subject and verb first. أنا needs a first-person verb.',
      'Then check noun/adjective agreement, prepositions and the intended meaning.',
      'A correction should explain the changed part, not just replace the sentence.'
    ],
    [
      ['أنا يذهب إلى المدرسة. ← غير صحيح', 'Incorrect: أنا does not match يذهب.'],
      ['أَنَا أَذْهَبُ إِلَى الْمَدْرَسَةِ.', 'Correct: I go to school.'],
      ['هَذِهِ بِنْتٌ جَمِيلَةٌ.', 'The feminine adjective جميلة agrees with بنت.']
    ],
    'Correct: أنا يذهب إلى المدرسة.',
    [
      'أنا تذهب إلى المدرسة.',
      'أنا يذهبون إلى المدرسة.',
      'أنا أذهب إلى المدرسة.'
    ],
    2,
    'أذهب is the first-person singular present form.'
  ),

  lesson(
    23,
    'Analysing a full sentence',
    'تحليل الجمل',
    'Practice',
    'Distinguish a noun-first sentence from a verb-first sentence.',
    [
      'الطالب يقرأ الكتاب begins with a noun: الطالب is the topic of a nominal sentence.',
      'In its predicate clause, يقرأ has an implied subject هو referring to the student. الكتاب is the direct object.',
      'In يقرأ الطالب الكتاب, the sentence begins with the verb and الطالب is directly its grammatical subject.'
    ],
    [
      ['الطَّالِبُ يَقْرَأُ الْكِتَابَ.', 'The student reads the book. · noun-first structure'],
      ['الطَّالِبُ: مبتدأ مرفوع', 'الطالبُ: nominative topic'],
      [
        'يَقْرَأُ الْكِتَابَ: جملة فعلية في محل رفع خبر',
        'The verbal clause functions as the predicate.'
      ],
      ['يَقْرَأُ الطَّالِبُ الْكِتَابَ.', 'The student reads the book. · verb-first structure']
    ],
    'In الطالب يقرأ الكتاب, what is the whole predicate?',
    ['يقرأ الكتاب', 'الطالب', 'الكتاب only'],
    0,
    'The verbal clause يقرأ الكتاب tells us what the topic الطالب does.'
  ),

  lesson(
    24,
    'Vocabulary by topic',
    'المفردات حسب الموضوع',
    'Practice',
    'Organize vocabulary into useful everyday groups.',
    [
      'Choose a topic and learn a small group of words together.',
      'Use each new word in a meaningful sentence. Revisit familiar topics before adding more.',
      'The reference below includes all topic groups named in the guide, with starter words for each.'
    ],
    [
      ['أُمّ / أَب / أُخْت', 'family: mother / father / sister'],
      ['مَاء / خُبْز / قَهْوَة', 'food and drink: water / bread / coffee'],
      ['أُرِيدُ مَاءً مِنْ فَضْلِكَ.', 'I would like water, please.']
    ],
    'Which word belongs to transportation?',
    ['مَكْتَبَة', 'حَافِلَة', 'سَعِيد'],
    1,
    'حافلة means bus, a means of transportation.'
  ),

  lesson(
    25,
    'Learning in stages',
    'مستويات المفردات',
    'Practice',
    'Introduce words gradually and review them in context.',
    [
      'Begin with frequent, concrete words, then add words needed for your interests and studies.',
      'These levels are approximate teaching groups, not formal proficiency certifications.',
      'The unvocalized form أكل is ambiguous: أَكَلَ = he ate; أَكْل = eating. Marks and context distinguish them.'
    ],
    [
      ['بَيْت / أُمّ / أَب / مَاء', 'Beginner: house / mother / father / water'],
      [
        'جَامِعَة / مَكْتَبَة / اِجْتِمَاع / رِحْلَة',
        'Intermediate: university / library / meeting / trip'
      ],
      [
        'اِسْتِنْتَاج / مَسْؤُولِيَّة / اِسْتِدَامَة / اِحْتِمَالِيَّة',
        'Advanced: inference / responsibility / sustainability / probability'
      ]
    ],
    'Which is a suitable concrete starter word?',
    ['اِسْتِدَامَة', 'اِحْتِمَالِيَّة', 'مَاء'],
    2,
    'ماء (water) is a concrete everyday word. The other examples express more abstract ideas.'
  )
];

const LETTERS = [
  ['ا', 'alif', 'ا', 'ـا', 'ـا'],
  ['ب', 'bāʾ', 'بـ', 'ـبـ', 'ـب'],
  ['ت', 'tāʾ', 'تـ', 'ـتـ', 'ـت'],
  ['ث', 'thāʾ', 'ثـ', 'ـثـ', 'ـث'],
  ['ج', 'jīm', 'جـ', 'ـجـ', 'ـج'],
  ['ح', 'ḥāʾ', 'حـ', 'ـحـ', 'ـح'],
  ['خ', 'khāʾ', 'خـ', 'ـخـ', 'ـخ'],
  ['د', 'dāl', 'د', 'ـد', 'ـد'],
  ['ذ', 'dhāl', 'ذ', 'ـذ', 'ـذ'],
  ['ر', 'rāʾ', 'ر', 'ـر', 'ـر'],
  ['ز', 'zāy', 'ز', 'ـز', 'ـز'],
  ['س', 'sīn', 'سـ', 'ـسـ', 'ـس'],
  ['ش', 'shīn', 'شـ', 'ـشـ', 'ـش'],
  ['ص', 'ṣād', 'صـ', 'ـصـ', 'ـص'],
  ['ض', 'ḍād', 'ضـ', 'ـضـ', 'ـض'],
  ['ط', 'ṭāʾ', 'طـ', 'ـطـ', 'ـط'],
  ['ظ', 'ẓāʾ', 'ظـ', 'ـظـ', 'ـظ'],
  ['ع', 'ʿayn', 'عـ', 'ـعـ', 'ـع'],
  ['غ', 'ghayn', 'غـ', 'ـغـ', 'ـغ'],
  ['ف', 'fāʾ', 'فـ', 'ـفـ', 'ـف'],
  ['ق', 'qāf', 'قـ', 'ـقـ', 'ـق'],
  ['ك', 'kāf', 'كـ', 'ـكـ', 'ـك'],
  ['ل', 'lām', 'لـ', 'ـلـ', 'ـل'],
  ['م', 'mīm', 'مـ', 'ـمـ', 'ـم'],
  ['ن', 'nūn', 'نـ', 'ـنـ', 'ـن'],
  ['ه', 'hāʾ', 'هـ', 'ـهـ', 'ـه'],
  ['و', 'wāw', 'و', 'ـو', 'ـو'],
  ['ي', 'yāʾ', 'يـ', 'ـيـ', 'ـي']
];

const CONJUGATIONS = [
  ['أنا', 'I', 'أَكْتُبُ', 'كَتَبْتُ'],
  ['نحن', 'we', 'نَكْتُبُ', 'كَتَبْنَا'],
  ['أنتَ', 'you · masculine singular', 'تَكْتُبُ', 'كَتَبْتَ'],
  ['أنتِ', 'you · feminine singular', 'تَكْتُبِينَ', 'كَتَبْتِ'],
  ['أنتما', 'you two', 'تَكْتُبَانِ', 'كَتَبْتُمَا'],
  ['أنتم', 'you · masculine/mixed plural', 'تَكْتُبُونَ', 'كَتَبْتُمْ'],
  ['أنتنّ', 'you · feminine plural', 'تَكْتُبْنَ', 'كَتَبْتُنَّ'],
  ['هو', 'he', 'يَكْتُبُ', 'كَتَبَ'],
  ['هي', 'she', 'تَكْتُبُ', 'كَتَبَتْ'],
  ['هما', 'they two · masculine', 'يَكْتُبَانِ', 'كَتَبَا'],
  ['هما', 'they two · feminine', 'تَكْتُبَانِ', 'كَتَبَتَا'],
  ['هم', 'they · masculine/mixed plural', 'يَكْتُبُونَ', 'كَتَبُوا'],
  ['هنّ', 'they · feminine plural', 'يَكْتُبْنَ', 'كَتَبْنَ']
];

const TOPICS = [
  ['Family', 'أمّ · أب'],
  ['Home', 'بيت · باب'],
  ['School', 'مدرسة · درس'],
  ['University', 'جامعة · محاضرة'],
  ['Food', 'خبز · أرزّ'],
  ['Clothes', 'قميص · ثوب'],
  ['Colors', 'أحمر · أزرق'],
  ['Numbers', 'واحد · اثنان'],
  ['Days', 'الأحد · الاثنين'],
  ['Months', 'يناير · فبراير'],
  ['Time', 'ساعة · دقيقة'],
  ['Animals', 'قطّ · حصان'],
  ['Jobs', 'طبيب · معلّم'],
  ['The body', 'يد · عين'],
  ['Transportation', 'حافلة · سيارة'],
  ['Travel', 'سفر · مطار'],
  ['Shopping', 'سعر · متجر'],
  ['Places', 'حديقة · مكتبة'],
  ['Feelings', 'سعيد · حزين'],
  ['Weather', 'مطر · شمس'],
  ['Everyday actions', 'يقرأ · يكتب']
];

const VIDEO = {
  1: ['d03q5Hlq6cE', 'Arabic alphabet with Harakat'],
  2: ['KAyDRxp7asM', 'Arabic Parts of Speech'],
  3: ['BwSsgtccysU', 'Learn Arabic Roots'],
  4: ['e93dQfncP0s', 'Arabic Prefixes and Suffixes'],
  5: ['yPz3QT1LjRI', 'Arabic Nouns: Number and Gender'],
  6: ['vK8xjBLh2-w', 'Past and Present Verb Conjugation'],
  7: ['vK8xjBLh2-w', 'Past and Present Verb Conjugation'],
  8: ['0WQwioqWlkA', 'Pronouns in Arabic'],
  9: ['_CsL8qpUedM', 'Arabic Adjectives'],
  10: ['TpVr8xvaZAM', 'Building Nominal Sentences'],
  11: ['n8NGs6GCJGw', 'Nominal and Verbal Sentences'],
  12: ['3Fyf38aYYCg', 'How Arabic Case Endings Work'],
  13: ['OmnBncn4hXU', 'Arabic Prepositions with Examples'],
  14: ['BOu0K5IZ8iM', 'Conjunctions: Practical Examples'],
  15: ['AhyLcZZXizA', 'Arabic Question Words Explained in English'],
  16: ['fMEWP0jB3oM', 'Negation: Past, Present and Future'],
  17: ['xqkKVIyhyHU', 'Demonstratives in Arabic'],
  18: ['xF4-chK4ttQ', 'Relative Pronouns'],
  19: ['OUmvgVR1Ucs', 'Idafa: Arabic Basics'],
  20: ['VDoQS9ImG_0', 'Arabic Words with Multiple Meanings'],
  21: ['Xn1gHPb5pJg', 'Standard Arabic through Stories: My Daily Routine'],
  22: ['vK8xjBLh2-w', 'Review: Match Pronouns and Verbs'],
  23: ['n8NGs6GCJGw', 'Review: Nominal and Verbal Sentences'],
  24: ['AZQ0i4hioAg', 'Daily Routine in Standard Arabic'],
  25: ['E5hLNqMFDW8', '50 Common Arabic Words for Beginners']
};

const STAGES = [
  {
    title: 'Start with the basics',
    level: 'Beginner',
    ids: [1, 2, 5, 8, 17],
    minutes: [20, 12, 18, 15, 12]
  },
  {
    title: 'Build simple descriptions',
    level: 'Beginner plus',
    ids: [4, 13, 19, 9, 10],
    minutes: [15, 15, 18, 20, 15]
  },
  {
    title: 'Use verbs and questions',
    level: 'Developing',
    ids: [6, 7, 11, 15, 16],
    minutes: [18, 25, 20, 15, 20]
  },
  {
    title: 'Understand the grammar',
    level: 'Intermediate',
    ids: [3, 12, 14, 18, 23],
    minutes: [20, 25, 18, 20, 25]
  },
  {
    title: 'Apply what you learned',
    level: 'Guided practice',
    ids: [20, 21, 22, 24, 25],
    minutes: [15, 20, 20, 20, 15]
  }
];

const COURSE = STAGES.flatMap((stage, stageIndex) =>
  stage.ids.map((id, i) => ({
    ...LESSONS.find(item => item.id === id),
    stage: stageIndex,
    level: stage.level,
    number: stageIndex * 5 + i + 1,
    minutes: stage.minutes[i],
    video: VIDEO[id]
  }))
);

export { COURSE, STAGES, LETTERS, CONJUGATIONS, TOPICS };