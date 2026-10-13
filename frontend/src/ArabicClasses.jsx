import React, { useState } from 'react';

const makeLesson = (
  id,
  title,
  arabic,
  unit,
  explanation,
  examples,
  question,
  options,
  answer,
  feedback
) => ({
  id,
  title,
  arabic,
  unit,
  explanation,
  examples,
  question,
  options,
  answer,
  feedback,
});

const lessons = [
  makeLesson(
    1,
    'Arabic letters and marks',
    'الحروف والحركات',
    'Reading',
    [
      'Arabic is written from right to left. Its 28 letters can have different shapes at the beginning, middle and end of a word.',
      'The letters ا د ذ ر ز و do not connect to the following letter on their left. Other letters normally connect when their neighbours allow it.',
      'Fatḥa ـَ gives a short a; ḍamma ـُ gives a short u; kasra ـِ gives a short i.',
      'Sukūn ـْ indicates no short vowel. Shadda ـّ indicates a doubled consonant. Tanwīn ـٌ ـً ـٍ adds an n sound in connected reading, commonly with indefinite nouns.',
      'ا و ي can represent long vowels. و and ي can also be consonants. Hamza has several written forms: ء أ إ ؤ ئ.',
      'Distinguish ة (tāʾ marbūṭa), ت (open tāʾ), and ى (alif maqṣūra, a final long ā).',
      'Sun letters are ت ث د ذ ر ز س ش ص ض ط ظ ل ن. The l sound of ال assimilates before them. With moon letters, the l sound is retained.',
    ],
    [
      ['بَ / بُ / بِ', 'ba / bu / bi — short vowels'],
      ['بَا / بُو / بِي', 'bā / bū / bī — long vowels'],
      ['الشَّمْس / الْقَمَر', 'the sun / the moon'],
      ['مَدْرَسَة / بَيْت / فَتَى', 'school / house / boy'],
    ],
    'Which mark indicates a doubled consonant?',
    ['Shadda ـّ', 'Sukūn ـْ', 'Kasra ـِ'],
    0,
    'Shadda indicates a doubled consonant.'
  ),

  makeLesson(
    2,
    'Understanding a word',
    'معلومات الكلمة',
    'Words',
    [
      'The three main word types are noun اسم, verb فعل and particle حرف.',
      'A useful word entry explains meaning in context. For nouns, it may also include gender, singular and plural forms.',
      'Roots, synonyms and antonyms should be included where applicable. Not every word has a useful opposite or a lexical root.',
    ],
    [
      [
        'مَكْتَبَة',
        'library — noun, feminine; root ك ت ب; plural مكتبات',
      ],
      ['ذَهَبْتُ إِلَى الْمَكْتَبَةِ.', 'I went to the library.'],
      ['كَبِير / صَغِير', 'big / small — opposites'],
      ['سَعِيد / مَسْرُور', 'happy / pleased — related meanings'],
    ],
    'What type of word is مكتبة?',
    ['Verb', 'Noun', 'Particle'],
    1,
    'مكتبة names a place, so it is a noun.'
  ),

  makeLesson(
    3,
    'Roots and word families',
    'الجذور',
    'Words',
    [
      'Many Arabic words share a root, often consisting of three consonants.',
      'A root connects related meanings, but the complete word and sentence determine the exact meaning.',
      'Do not guess a root simply by removing the first and last letters of a word.',
    ],
    [
      ['كَتَبَ / كِتَاب / كَاتِب', 'wrote / book / writer'],
      ['مَكْتُوب / كِتَابَة', 'written / writing'],
      ['مَكْتَب / مَكْتَبَة', 'desk or office / library'],
      ['ك ت ب', 'The root shared by this word family'],
    ],
    'Which root connects كتاب and كاتب?',
    ['ع ل م', 'ذ ه ب', 'ك ت ب'],
    2,
    'Both words belong to the ك ت ب family associated with writing.'
  ),

  makeLesson(
    4,
    'Prefixes and endings',
    'السوابق واللواحق',
    'Words',
    [
      'Adding الـ makes a noun definite: كتاب becomes الكتاب.',
      'An attached pronoun can express ownership: كتابي means my book.',
      'وَ can attach as and; بِـ as with/by; لِـ as for/to. Choose the meaning from context.',
    ],
    [
      ['كِتَاب / الْكِتَاب', 'a book / the book'],
      ['كِتَابِي / كِتَابُهَا', 'my book / her book'],
      ['بِالْقَلَمِ', 'with the pen'],
      ['لِلْمُعَلِّمِ', 'for the teacher'],
    ],
    'What does كتابنا mean?',
    ['Their book', 'Our book', 'A book'],
    1,
    'The attached pronoun نا expresses our with this noun.'
  ),

  makeLesson(
    5,
    'Nouns: number and gender',
    'الأسماء',
    'Words',
    [
      'Singular means one, dual means two, and plural means more than two.',
      'Dual nouns commonly end in ـان in the nominative and ـين in the accusative or genitive.',
      'Sound masculine plurals use ـون or ـين. Sound feminine plurals use ـات. Broken plurals change the internal word pattern.',
      'Many feminine nouns end in ة, but this is not a rule for every noun. Learn gender and plural forms with each word.',
    ],
    [
      ['طَالِب / طَالِبَان / طُلَّاب', 'student / two students / students'],
      [
        'طَالِبَة / طَالِبَتَان / طَالِبَات',
        'female student / two female students / female students',
      ],
      ['مُعَلِّمُون', 'male teachers — sound plural, nominative'],
      ['كُتُب', 'books — broken plural'],
    ],
    'Which is a broken plural?',
    ['كُتُب', 'مُعَلِّمُون', 'طَالِبَات'],
    0,
    'كتاب becomes كتب through an internal pattern change.'
  ),

  makeLesson(
    6,
    'Past, present and commands',
    'الأفعال',
    'Verbs',
    [
      'Past forms describe completed actions. Present forms can describe current or habitual actions.',
      'An imperative gives a command. Its form depends on the person being addressed.',
      'سـ or سوف before a present form can express the future.',
    ],
    [
      ['كَتَبَ', 'He wrote.'],
      ['يَكْتُبُ', 'He writes / He is writing.'],
      ['اُكْتُبْ', 'Write! — to one male person'],
      ['سَيَكْتُبُ / سَوْفَ يَكْتُبُ', 'He will write.'],
    ],
    'Which means “he will write”?',
    ['كَتَبَ', 'اُكْتُبْ', 'سَيَكْتُبُ'],
    2,
    'The prefix سـ gives this present form a future meaning.'
  ),

  makeLesson(
    7,
    'Verb conjugation',
    'تصريف الأفعال',
    'Verbs',
    [
      'A verb changes according to the person doing the action.',
      'Present forms change their prefixes and sometimes their endings. Past forms change their endings.',
      'The reference table below shows كتب with all independent pronouns, including dual and feminine plural forms.',
      'The present forms in the table are affirmative indicative forms. Other grammatical contexts can change their endings.',
    ],
    [
      ['أَنَا أَكْتُبُ / أَنَا كَتَبْتُ', 'I write / I wrote'],
      [
        'أَنْتِ تَكْتُبِينَ / أَنْتِ كَتَبْتِ',
        'You write / You wrote — feminine singular',
      ],
      ['نَحْنُ نَكْتُبُ / نَحْنُ كَتَبْنَا', 'We write / We wrote'],
    ],
    'Complete: نحن ___',
    ['يَكْتُبُ', 'نَكْتُبُ', 'تَكْتُبِينَ'],
    1,
    'نحن takes نكتب in this present-tense sentence.'
  ),

  makeLesson(
    8,
    'Pronouns',
    'الضمائر',
    'Words',
    [
      'أنا = I; نحن = we. أنتَ addresses one male person; أنتِ addresses one female person.',
      'أنتما = you two; أنتم = masculine or mixed plural you; أنتنّ = feminine plural you.',
      'هو = he; هي = she; هما = they two; هم = masculine or mixed plural they; هنّ = feminine plural they.',
      'An attached pronoun can express different roles: كتابي = my book; رأيتُه = I saw him; معه = with him.',
    ],
    [
      ['أَنَا طَالِبٌ.', 'I am a male student.'],
      ['هِيَ طَالِبَةٌ.', 'She is a student.'],
      ['هُمَا طَالِبَانِ.', 'They are two male students.'],
    ],
    'Which pronoun means “you two”?',
    ['أَنْتُمَا', 'نَحْنُ', 'هُمْ'],
    0,
    'أنتما addresses two people, whether masculine or feminine.'
  ),

  makeLesson(
    9,
    'Adjective agreement',
    'الصفات',
    'Grammar',
    [
      'An attributive adjective normally follows its noun and agrees in gender, number, definiteness and case.',
      'Non-human plurals generally take feminine singular agreement: كتب جديدة means new books.',
      'Compare البيت الكبير, the big house, with البيت كبير, the house is big.',
    ],
    [
      ['وَلَدٌ جَمِيلٌ / بِنْتٌ جَمِيلَةٌ', 'a beautiful boy / a beautiful girl'],
      ['وَلَدَانِ جَمِيلَانِ', 'two beautiful boys'],
      ['بَنَاتٌ جَمِيلَاتٌ', 'beautiful girls'],
      ['كُتُبٌ جَدِيدَةٌ', 'new books'],
    ],
    'Choose “the big house” as a noun phrase.',
    ['الْبَيْتُ كَبِيرٌ', 'الْبَيْتُ الْكَبِيرُ', 'الْبَيْتُ كَبِيرَةٌ'],
    1,
    'The adjective الكبير is definite, matching البيت.'
  ),

  makeLesson(
    10,
    'Nominal sentences',
    'الجملة الاسمية',
    'Grammar',
    [
      'A nominal sentence typically begins with a noun or pronoun.',
      'The مبتدأ is the topic. The خبر gives information about it.',
      'A simple present description does not need a separate word for is or are.',
      'The topic and a simple noun or adjective predicate are normally nominative.',
    ],
    [
      ['الْبَيْتُ كَبِيرٌ.', 'The house is big.'],
      ['الطَّالِبَةُ مُجْتَهِدَةٌ.', 'The student is hardworking.'],
      ['أَنَا فِي الْبَيْتِ.', 'I am at home.'],
    ],
    'In البيت كبير, which word is the predicate?',
    ['البيت', 'Both words', 'كبير'],
    2,
    'كبير gives information about the house.'
  ),

  makeLesson(
    11,
    'Verbal sentences',
    'الجملة الفعلية',
    'Grammar',
    [
      'A verbal sentence begins with a verb.',
      'The فاعل performs the action. A مفعول به receives the action when the verb has a direct object.',
      'Not every verb needs a direct object.',
    ],
    [
      ['قَرَأَ الطَّالِبُ الْكِتَابَ.', 'The student read the book.'],
      ['قَرَأَ', 'Verb: read'],
      ['الطَّالِبُ / الْكِتَابَ', 'Subject: the student / Object: the book'],
      ['ذَهَبَ الطَّالِبُ.', 'The student went. — no direct object'],
    ],
    'What is the direct object in قرأ الطالبُ الكتابَ?',
    ['الْكِتَابَ', 'الطَّالِبُ', 'قَرَأَ'],
    0,
    'The book receives the action of reading.'
  ),

  makeLesson(
    12,
    'Basic grammatical analysis',
    'الإعراب الأساسي',
    'Grammar',
    [
      'Nouns can be nominative رفع, accusative نصب or genitive جر.',
      'Present verbs can be indicative رفع, subjunctive نصب or jussive جزم.',
      'Basic signs include ـُ, ـَ, ـِ and ـْ. Duals, some plurals and other forms use different signs.',
      'A verbal subject is normally nominative; a direct object is accusative; a noun after a preposition is genitive. Some words have fixed forms.',
    ],
    [
      ['الطَّالِبُ', 'The student — nominative in the example below'],
      ['قَرَأَ الطَّالِبُ الْكِتَابَ.', 'The student read the book.'],
      ['فِي الْبَيْتِ', 'In the house — البيتِ is genitive'],
      ['لَمْ يَكْتُبْ', 'He did not write — the verb is jussive'],
    ],
    'Which case follows a preposition?',
    ['Accusative', 'Genitive', 'Jussive'],
    1,
    'A noun governed by a preposition is genitive. Jussive is a verb category.'
  ),

  makeLesson(
    13,
    'Prepositions',
    'حروف الجر',
    'Grammar',
    [
      'من = from; إلى = to; عن = about; على = on; في = in.',
      'بـ = with/by; كـ = like; لـ = for/to. These attach directly to the next word.',
      'A following noun is genitive. The exact English meaning depends on context.',
    ],
    [
      ['ذَهَبْتُ إِلَى الْمَدْرَسَةِ.', 'I went to the school.'],
      ['الْكِتَابُ عَلَى الطَّاوِلَةِ.', 'The book is on the table.'],
      ['كَتَبْتُ بِالْقَلَمِ.', 'I wrote with the pen.'],
    ],
    'Choose “in the house”.',
    ['إِلَى الْبَيْتِ', 'مِنَ الْبَيْتِ', 'فِي الْبَيْتِ'],
    2,
    'في expresses location inside a place here.'
  ),

  makeLesson(
    14,
    'Connecting ideas',
    'الربط والعطف',
    'Grammar',
    [
      'و = and; أو = or. و does not itself specify the order of events.',
      'ثم = then, generally with a gap. فـ can indicate close sequence or a result.',
      'لكن = but; لأن = because; لذلك = therefore. These words connect ideas, but their grammatical rules differ.',
    ],
    [
      ['شَايٌ أَوْ قَهْوَةٌ؟', 'Tea or coffee?'],
      ['قَرَأْتُ ثُمَّ كَتَبْتُ.', 'I read, then I wrote.'],
      [
        'بَقِيتُ فِي الْبَيْتِ لِأَنَّنِي مَرِيضٌ.',
        'I stayed at home because I am ill.',
      ],
    ],
    'Which introduces a reason?',
    ['لِأَنَّ', 'أَوْ', 'ثُمَّ'],
    0,
    'لأن introduces a reason: because.'
  ),

  makeLesson(
    15,
    'Asking questions',
    'أدوات الاستفهام',
    'Grammar',
    [
      'من = who; ما / ماذا = what; أين = where; متى = when.',
      'كيف = how; لماذا = why; كم = how many or how much.',
      'هل introduces a yes/no question. Distinguish مَنْ (who) from مِنْ (from).',
    ],
    [
      ['أَيْنَ الْمَكْتَبَةُ؟', 'Where is the library?'],
      ['مَتَى يَبْدَأُ الدَّرْسُ؟', 'When does the lesson start?'],
      ['هَلْ أَنْتَ طَالِبٌ؟', 'Are you a student? — addressing one male person'],
    ],
    'Which asks about time?',
    ['أَيْنَ', 'مَتَى', 'مَنْ'],
    1,
    'متى means when.'
  ),

  makeLesson(
    16,
    'Negation',
    'النفي',
    'Grammar',
    [
      'لا أكتبُ means I do not write. This is ordinary present negation, not the prohibitive use of لا.',
      'لم precedes a present form in the jussive but gives a past negative meaning.',
      'لن precedes a present form in the subjunctive and negates the future.',
      'ما can negate a past verb. ليس negates a nominal description; its subject is nominative and its predicate accusative.',
    ],
    [
      ['لَا أَكْتُبُ', 'I do not write.'],
      ['لَمْ أَكْتُبْ / مَا كَتَبْتُ', 'I did not write.'],
      ['لَنْ أَكْتُبَ', 'I will not write.'],
      ['الْبَيْتُ لَيْسَ كَبِيرًا.', 'The house is not big.'],
    ],
    'Choose “I will not write”.',
    ['لَا أَكْتُبُ', 'لَمْ أَكْتُبْ', 'لَنْ أَكْتُبَ'],
    2,
    'لن gives future negation and requires the subjunctive form here.'
  ),

  makeLesson(
    17,
    'This, that and these',
    'أسماء الإشارة',
    'Grammar',
    [
      'هذا = this masculine; هذه = this feminine; ذلك = that masculine; تلك = that feminine.',
      'هذان and هاتان are nominative dual forms. هذين and هاتين are accusative/genitive dual forms.',
      'هؤلاء = these and أولئك = those, commonly for people.',
      'Non-human plurals generally take feminine singular agreement.',
    ],
    [
      ['هَذَا كِتَابٌ.', 'This is a book.'],
      ['هَذِهِ مَدْرَسَةٌ.', 'This is a school.'],
      ['هَؤُلَاءِ طُلَّابٌ.', 'These are students.'],
      ['هَذِهِ كُتُبٌ.', 'These are books.'],
    ],
    'Complete: ___ مدرسةٌ',
    ['هَذِهِ', 'هَذَا', 'هَذَانِ'],
    0,
    'مدرسة is feminine singular, so use هذه.'
  ),

  makeLesson(
    18,
    'Relative words',
    'الأسماء الموصولة',
    'Grammar',
    [
      'الذي is masculine singular; التي is feminine singular; الذين is masculine plural; اللواتي or اللاتي is feminine plural.',
      'Dual forms are اللذان / اللتان in the nominative, and اللذين / اللتين in accusative or genitive contexts.',
      'A relative clause adds information. After an indefinite noun, Arabic commonly uses a descriptive clause without الذي.',
    ],
    [
      [
        'هَذَا الطَّالِبُ الَّذِي قَرَأَ الْكِتَابَ.',
        'This is the student who read the book.',
      ],
      [
        'هَذِهِ الطَّالِبَةُ الَّتِي كَتَبَتْ.',
        'This is the student who wrote.',
      ],
      ['رَأَيْتُ طَالِبًا يَقْرَأُ.', 'I saw a student reading.'],
    ],
    'Which relative word is feminine singular?',
    ['الَّذِينَ', 'الَّتِي', 'الَّذِي'],
    1,
    'التي refers to a feminine singular noun.'
  ),

  makeLesson(
    19,
    'Possession',
    'الملكية',
    'Words',
    [
      'Attach a pronoun to a noun to show ownership.',
      'A noun with a possessive suffix is definite and does not also take ال.',
      'كتابكَ and كتابكِ both appear as كتابك without vowel marks; the marks identify the addressee’s gender.',
      'An إضافة can also express possession: كتاب الطالب means the student’s book. The second noun is genitive.',
    ],
    [
      ['كِتَابِي / كِتَابُكَ / كِتَابُكِ', 'my book / your book (male) / your book (female)'],
      ['كِتَابُهُ / كِتَابُهَا / كِتَابُنَا', 'his book / her book / our book'],
      ['كِتَابُكُمَا / كِتَابُكُمْ / كِتَابُكُنَّ', 'your book: dual / masculine or mixed plural / feminine plural'],
      ['كِتَابُهُمَا / كِتَابُهُمْ / كِتَابُهُنَّ', 'their book: dual / masculine or mixed plural / feminine plural'],
      ['كِتَابُ الطَّالِبِ', 'the student’s book'],
    ],
    'What does كتابها mean?',
    ['His book', 'Our book', 'Her book'],
    2,
    'The suffix ها indicates her with this noun.'
  ),

  makeLesson(
    20,
    'Meaning from context',
    'المعنى من السياق',
    'Words',
    [
      'One Arabic word can have several meanings.',
      'عين can mean an eye, a water spring or a spy.',
      'The surrounding sentence helps select the intended meaning. A dictionary lists possibilities; context helps choose between them.',
    ],
    [
      ['عَيْنِي تُؤْلِمُنِي.', 'My eye hurts.'],
      ['شَرِبْنَا مِنْ عَيْنِ مَاءٍ.', 'We drank from a water spring.'],
      ['كَانَ عَيْنًا عَلَى الْعَدُوِّ.', 'He was a spy watching the enemy.'],
    ],
    'What does عين mean in عين ماء?',
    ['A water spring', 'An eye', 'A book'],
    0,
    'ماء, meaning water, identifies the water-spring meaning.'
  ),

  makeLesson(
    21,
    'Building longer sentences',
    'بناء الجمل',
    'Practice',
    [
      'Begin with a short complete idea, then add a location, person or time.',
      'Learn a word in several sentences rather than only memorizing a translation.',
      'Keep each example meaningful. A longer sentence is not automatically a better sentence.',
    ],
    [
      ['هَذِهِ مَدْرَسَةٌ.', 'This is a school.'],
      ['أَنَا فِي الْمَدْرَسَةِ.', 'I am at school.'],
      [
        'يَذْهَبُ أَحْمَدُ إِلَى الْمَدْرَسَةِ كُلَّ صَبَاحٍ.',
        'Ahmed goes to school every morning.',
      ],
    ],
    'Which phrase adds “every morning”?',
    ['إِلَى الْمَدْرَسَةِ', 'كُلَّ صَبَاحٍ', 'هَذِهِ مَدْرَسَةٌ'],
    1,
    'كل صباح adds when and how often the action happens.'
  ),

  makeLesson(
    22,
    'Correcting sentences',
    'تصحيح الجمل',
    'Practice',
    [
      'Check whether the subject and verb match. أنا needs a first-person verb.',
      'Then check noun/adjective agreement, prepositions and the intended meaning.',
      'A useful correction explains the changed part.',
    ],
    [
      ['أنا يذهب إلى المدرسة.', 'Incorrect: أنا does not match يذهب.'],
      ['أَنَا أَذْهَبُ إِلَى الْمَدْرَسَةِ.', 'Correct: I go to school.'],
      ['هَذِهِ بِنْتٌ جَمِيلَةٌ.', 'جميلة agrees with the feminine noun بنت.'],
    ],
    'Correct: أنا يذهب إلى المدرسة.',
    [
      'أنا تذهب إلى المدرسة.',
      'أنا يذهبون إلى المدرسة.',
      'أنا أذهب إلى المدرسة.',
    ],
    2,
    'أذهب is the first-person singular present form.'
  ),

  makeLesson(
    23,
    'Analysing a sentence',
    'تحليل الجمل',
    'Practice',
    [
      'الطالب يقرأ الكتاب begins with a noun. الطالب is the topic of a nominal sentence.',
      'Inside its predicate clause, يقرأ has an implied subject هو referring to the student. الكتاب is the direct object.',
      'In يقرأ الطالب الكتاب, the sentence begins with the verb and الطالب is directly the subject of that verb.',
    ],
    [
      ['الطَّالِبُ يَقْرَأُ الْكِتَابَ.', 'The student reads the book — noun-first structure.'],
      ['الطَّالِبُ: مبتدأ مرفوع', 'The student: nominative topic.'],
      ['يَقْرَأُ الْكِتَابَ: جملة فعلية في محل رفع خبر', 'The verbal clause functions as the predicate.'],
      ['يَقْرَأُ الطَّالِبُ الْكِتَابَ.', 'The student reads the book — verb-first structure.'],
    ],
    'In الطالب يقرأ الكتاب, what is the whole predicate?',
    ['يقرأ الكتاب', 'الطالب', 'الكتاب only'],
    0,
    'The verbal clause يقرأ الكتاب tells us what the topic الطالب does.'
  ),

  makeLesson(
    24,
    'Vocabulary by topic',
    'المفردات حسب الموضوع',
    'Practice',
    [
      'Choose a topic and learn a small group of words together.',
      'Use each new word in a meaningful sentence.',
      'The reference table below includes all topic groups named in the guide, with starter vocabulary.',
    ],
    [
      ['أُمّ / أَب / أُخْت', 'Family: mother / father / sister'],
      ['مَاء / خُبْز / قَهْوَة', 'Food and drink: water / bread / coffee'],
      ['أُرِيدُ مَاءً مِنْ فَضْلِكَ.', 'I would like water, please.'],
    ],
    'Which word belongs to transportation?',
    ['مَكْتَبَة', 'حَافِلَة', 'سَعِيد'],
    1,
    'حافلة means bus, a means of transportation.'
  ),

  makeLesson(
    25,
    'Learning in stages',
    'مستويات المفردات',
    'Practice',
    [
      'Begin with frequent concrete words, then add words related to your needs and interests.',
      'These are approximate teaching groups, not formal proficiency certifications.',
      'The unvocalized form أكل can represent different forms: أَكَلَ means he ate; أَكْل means eating. Marks and context distinguish them.',
    ],
    [
      ['بَيْت / أُمّ / أَب / مَاء', 'Beginner: house / mother / father / water'],
      ['جَامِعَة / مَكْتَبَة / اِجْتِمَاع / رِحْلَة', 'Intermediate: university / library / meeting / trip'],
      ['اِسْتِنْتَاج / مَسْؤُولِيَّة / اِسْتِدَامَة / اِحْتِمَالِيَّة', 'Advanced: inference / responsibility / sustainability / probability'],
    ],
    'Which is a concrete everyday starter word?',
    ['اِسْتِدَامَة', 'اِحْتِمَالِيَّة', 'مَاء'],
    2,
    'ماء means water. The other examples describe more abstract ideas.'
  ),
];

const letters = [
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
  ['ي', 'yāʾ', 'يـ', 'ـيـ', 'ـي'],
];

const conjugations = [
  ['أنا', 'I', 'أَكْتُبُ', 'كَتَبْتُ'],
  ['نحن', 'we', 'نَكْتُبُ', 'كَتَبْنَا'],
  ['أنتَ', 'you — male singular', 'تَكْتُبُ', 'كَتَبْتَ'],
  ['أنتِ', 'you — female singular', 'تَكْتُبِينَ', 'كَتَبْتِ'],
  ['أنتما', 'you two', 'تَكْتُبَانِ', 'كَتَبْتُمَا'],
  ['أنتم', 'you — masculine/mixed plural', 'تَكْتُبُونَ', 'كَتَبْتُمْ'],
  ['أنتنّ', 'you — feminine plural', 'تَكْتُبْنَ', 'كَتَبْتُنَّ'],
  ['هو', 'he', 'يَكْتُبُ', 'كَتَبَ'],
  ['هي', 'she', 'تَكْتُبُ', 'كَتَبَتْ'],
  ['هما', 'they two — masculine', 'يَكْتُبَانِ', 'كَتَبَا'],
  ['هما', 'they two — feminine', 'تَكْتُبَانِ', 'كَتَبَتَا'],
  ['هم', 'they — masculine/mixed plural', 'يَكْتُبُونَ', 'كَتَبُوا'],
  ['هنّ', 'they — feminine plural', 'يَكْتُبْنَ', 'كَتَبْنَ'],
];

const topics = [
  ['Family', 'أمّ · أب', 'mother · father'],
  ['Home', 'بيت · باب', 'house · door'],
  ['School', 'مدرسة · درس', 'school · lesson'],
  ['University', 'جامعة · محاضرة', 'university · lecture'],
  ['Food', 'خبز · أرزّ', 'bread · rice'],
  ['Clothes', 'قميص · ثوب', 'shirt · garment'],
  ['Colors', 'أحمر · أزرق', 'red · blue'],
  ['Numbers', 'واحد · اثنان', 'one · two'],
  ['Days', 'الأحد · الاثنين', 'Sunday · Monday'],
  ['Months', 'يناير · فبراير', 'January · February'],
  ['Time', 'ساعة · دقيقة', 'hour · minute'],
  ['Animals', 'قطّ · حصان', 'cat · horse'],
  ['Jobs', 'طبيب · معلّم', 'doctor · teacher'],
  ['The body', 'يد · عين', 'hand · eye'],
  ['Transportation', 'حافلة · سيارة', 'bus · car'],
  ['Travel', 'سفر · مطار', 'travel · airport'],
  ['Shopping', 'سعر · متجر', 'price · shop'],
  ['Places', 'حديقة · مكتبة', 'garden · library'],
  ['Feelings', 'سعيد · حزين', 'happy · sad'],
  ['Weather', 'مطر · شمس', 'rain · sun'],
  ['Everyday actions', 'يقرأ · يكتب', 'he reads · he writes'],
];

function normalizeSearch(value) {
  return value
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .toLowerCase();
}

function readProgress(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');

    const validIds = (items) =>
      Array.isArray(items)
        ? [...new Set(items.filter((id) => lessons.some((l) => l.id === id)))]
        : [];

    return {
      done: validIds(value?.done),
      saved: validIds(value?.saved),
      error: '',
    };
  } catch {
    return {
      done: [],
      saved: [],
      error: 'Saved progress could not be loaded in this browser.',
    };
  }
}

function ReferenceTable({ lessonId }) {
  let title;
  let headings;
  let rows;

  if (lessonId === 1) {
    title = 'Open the 28-letter reference';
    headings = ['Letter', 'Name', 'Initial', 'Medial', 'Final'];
    rows = letters;
  } else if (lessonId === 7) {
    title = 'Open the full conjugation reference';
    headings = ['Pronoun', 'Meaning', 'Present', 'Past'];
    rows = conjugations;
  } else if (lessonId === 24) {
    title = 'Open the vocabulary topic reference';
    headings = ['Topic', 'Arabic', 'Meaning'];
    rows = topics;
  } else {
    return null;
  }

  return (
    <details className="ac-reference">
      <summary>{title}</summary>

      {lessonId === 1 && (
        <p>
          Connections depend on neighbouring letters. ا د ذ ر ز و connect
          only to the preceding letter when possible.
        </p>
      )}

      <div className="ac-table-scroll">
        <table>
          <thead>
            <tr>
              {headings.map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} dir="auto">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function ArabicClasses({ userId = 'guest' }) {
  return <ClassesContent key={String(userId)} userId={userId} />;
}

function ClassesContent({ userId }) {
  const storageKey = `learn-arabic.classes.v1.${userId}`;

  const [progress, setProgress] = useState(() => readProgress(storageKey));
  const [storageError, setStorageError] = useState(progress.error);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [unit, setUnit] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [checked, setChecked] = useState(false);

  const current = lessons.find((item) => item.id === selectedId);
  const completion = Math.round((progress.done.length / lessons.length) * 100);
  const nextLesson =
    lessons.find((item) => !progress.done.includes(item.id)) || lessons[0];

  function saveProgress(next) {
    setProgress(next);

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          done: next.done,
          saved: next.saved,
        })
      );
      setStorageError('');
    } catch {
      setStorageError(
        'Progress is available for this visit but could not be saved. Browser storage may be blocked or full.'
      );
    }
  }

  function openLesson(id) {
    setSelectedId(id);
    setAnswer(null);
    setChecked(false);
  }

  function toggleSaved(id) {
    saveProgress({
      ...progress,
      saved: progress.saved.includes(id)
        ? progress.saved.filter((item) => item !== id)
        : [...progress.saved, id],
    });
  }

  function checkAnswer() {
    if (answer === null || !current) return;

    setChecked(true);

    if (
      answer === current.answer &&
      !progress.done.includes(current.id)
    ) {
      saveProgress({
        ...progress,
        done: [...progress.done, current.id],
      });
    }
  }

  const filteredLessons = lessons.filter((item) => {
    const matchesUnit = unit === 'All' || item.unit === unit;
    const matchesSaved = !savedOnly || progress.saved.includes(item.id);

    const searchable = normalizeSearch(
      [item.title, item.arabic, ...item.explanation].join(' ')
    );

    return (
      matchesUnit &&
      matchesSaved &&
      searchable.includes(normalizeSearch(query))
    );
  });

  return (
    <section className="arabic-classes">
      <style>{classesStyles}</style>

      <header className="ac-header">
        <div>
          <p className="ac-kicker">ARABIC FOUNDATIONS</p>
          <h1>Arabic Classes</h1>
          <p>Read. Understand. Practice.</p>
        </div>

        <span className="ac-count">
          {progress.done.length} / {lessons.length} completed
        </span>
      </header>

      <div
        className="ac-progress"
        role="progressbar"
        aria-label="Course completion"
        aria-valuenow={completion}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${completion}%` }} />
      </div>

      {storageError && (
        <p className="ac-warning" role="status">
          {storageError}
        </p>
      )}

      {!current ? (
        <>
          <section className="ac-banner">
            <div>
              <p className="ac-kicker">YOUR LEARNING PATH</p>
              <h2>One new idea at a time.</h2>
              <p>
                25 introductory lessons · English explanations · Arabic
                examples
              </p>
            </div>

            <button
              className="ac-primary"
              onClick={() => openLesson(nextLesson.id)}
            >
              {progress.done.length === 25
                ? 'Review lessons'
                : progress.done.length
                ? 'Continue learning'
                : 'Start class 1'}
              {' →'}
            </button>
          </section>

          <div className="ac-filters">
            <input
              aria-label="Search classes"
              placeholder="Search grammar, roots, الحركات…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <select
              aria-label="Filter classes by unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {['All', 'Reading', 'Words', 'Verbs', 'Grammar', 'Practice'].map(
                (name) => (
                  <option key={name}>{name}</option>
                )
              )}
            </select>

            <button
              className={savedOnly ? 'ac-filter-active' : ''}
              aria-pressed={savedOnly}
              onClick={() => setSavedOnly(!savedOnly)}
            >
              Saved ({progress.saved.length})
            </button>
          </div>

          <div className="ac-grid">
            {filteredLessons.map((item) => (
              <article className="ac-card" key={item.id}>
                <div className="ac-card-top">
                  <span>
                    CLASS {String(item.id).padStart(2, '0')} · {item.unit}
                  </span>

                  <button
                    aria-label={`${
                      progress.saved.includes(item.id) ? 'Unsave' : 'Save'
                    } ${item.title}`}
                    aria-pressed={progress.saved.includes(item.id)}
                    onClick={() => toggleSaved(item.id)}
                  >
                    {progress.saved.includes(item.id) ? '★' : '☆'}
                  </button>
                </div>

                <p className="ac-arabic-title" lang="ar" dir="rtl">
                  {item.arabic}
                </p>

                <h2>{item.title}</h2>

                <p className="ac-card-description">
                  Explanation, Arabic examples and a practice question.
                </p>

                <button
                  className="ac-open"
                  onClick={() => openLesson(item.id)}
                >
                  {progress.done.includes(item.id)
                    ? '✓ Review completed class'
                    : 'Open class →'}
                </button>
              </article>
            ))}
          </div>

          {!filteredLessons.length && (
            <p className="ac-empty">
              No classes match. Try another search or filter.
            </p>
          )}

          <p className="ac-footnote">
            Progress is saved for this account in this browser. This is an
            introductory course, not a complete Arabic grammar reference.
          </p>
        </>
      ) : (
        <article className="ac-lesson">
          <div className="ac-lesson-toolbar">
            <button onClick={() => openLesson(null)}>← All classes</button>

            <button
              aria-pressed={progress.saved.includes(current.id)}
              onClick={() => toggleSaved(current.id)}
            >
              {progress.saved.includes(current.id)
                ? '★ Saved'
                : '☆ Save lesson'}
            </button>
          </div>

          <p className="ac-kicker">
            CLASS {current.id} / 25 · {current.unit}
          </p>

          <h2>{current.title}</h2>

          <p className="ac-lesson-arabic" lang="ar" dir="rtl">
            {current.arabic}
          </p>

          <section className="ac-panel">
            <h3>Understand the rule</h3>

            <ul>
              {current.explanation.map((paragraph) => (
                <li key={paragraph} dir="auto">
                  {paragraph}
                </li>
              ))}
            </ul>
          </section>

          <section className="ac-panel">
            <h3>See it in context</h3>

            <div className="ac-examples">
              {current.examples.map(([arabic, english], index) => (
                <div key={index}>
                  <p lang="ar" dir="rtl">
                    {arabic}
                  </p>
                  <p>{english}</p>
                </div>
              ))}
            </div>

            <ReferenceTable lessonId={current.id} />
          </section>

          <section className="ac-panel ac-practice">
            <h3>Check your understanding</h3>

            <fieldset>
              <legend dir="auto">{current.question}</legend>

              {current.options.map((option, index) => (
                <label
                  key={index}
                  className={
                    answer === index
                      ? 'ac-choice ac-selected'
                      : 'ac-choice'
                  }
                >
                  <input
                    type="radio"
                    name={`lesson-${current.id}`}
                    checked={answer === index}
                    onChange={() => {
                      setAnswer(index);
                      setChecked(false);
                    }}
                  />
                  <span dir="auto">{option}</span>
                </label>
              ))}
            </fieldset>

            <button
              className="ac-primary"
              disabled={answer === null}
              onClick={checkAnswer}
            >
              Check answer
            </button>

            {checked && (
              <div
                role="status"
                className={
                  answer === current.answer
                    ? 'ac-feedback ac-correct'
                    : 'ac-feedback'
                }
              >
                <strong>
                  {answer === current.answer
                    ? 'Correct — class completed.'
                    : 'Not quite. Read the explanation and try again.'}
                </strong>
                <p>{current.feedback}</p>
              </div>
            )}
          </section>

          <nav className="ac-bottom-nav" aria-label="Lesson navigation">
            <button
              disabled={current.id === 1}
              onClick={() => openLesson(current.id - 1)}
            >
              ← Previous
            </button>

            <span>
              {progress.done.includes(current.id)
                ? '✓ Completed'
                : 'Pass the practice to complete this class'}
            </span>

            <button
              className="ac-primary"
              onClick={() =>
                openLesson(current.id === 25 ? null : current.id + 1)
              }
            >
              {current.id === 25 ? 'All classes' : 'Next class →'}
            </button>
          </nav>
        </article>
      )}
    </section>
  );
}

const classesStyles = `
.arabic-classes {
  color: #132c43;
  max-width: 1200px;
  margin: auto;
  text-align: left;
  font-family: 'Segoe UI', Arial, sans-serif;
}
.arabic-classes * { box-sizing: border-box; }
.arabic-classes button,
.arabic-classes input,
.arabic-classes select { font: inherit; }
.arabic-classes button {
  cursor: pointer;
  border: 1px solid #dce8e8;
  background: white;
  color: #132c43;
  padding: 10px 15px;
  border-radius: 10px;
}
.arabic-classes button:disabled { opacity: .45; cursor: not-allowed; }
.arabic-classes button:focus-visible,
.arabic-classes input:focus-visible,
.arabic-classes select:focus-visible,
.arabic-classes summary:focus-visible {
  outline: 3px solid #087f7b;
  outline-offset: 3px;
}
.ac-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.ac-kicker {
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.6px;
  color: #087f7b;
  margin: 0 0 12px;
}
.ac-header h1 {
  font-size: 32px;
  font-weight: 750;
  margin: 0 0 10px;
  letter-spacing: -1px;
}
.ac-header > div > p:last-child { color: #5d7180; margin: 0; }
.ac-count {
  white-space: nowrap;
  font-size: 12px;
  padding: 10px 15px;
  background: #e3f4ee;
  border-radius: 30px;
}
.ac-progress {
  height: 7px;
  background: #e1ece8;
  border-radius: 10px;
  overflow: hidden;
  margin: 25px 0;
}
.ac-progress > span { display: block; height: 100%; background: #087f7b; }
.ac-banner {
  padding: 30px;
  background: #e5f5ef;
  border: 1px solid #d3e8df;
  border-radius: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
.ac-banner h2 { font-size: 27px; font-weight: 700; margin: 10px 0; }
.ac-banner > div > p:last-child { color: #5d7180; font-size: 13px; }
.arabic-classes .ac-primary {
  background: #087f7b;
  border-color: #087f7b;
  color: white;
  padding: 13px 19px;
  font-weight: 650;
}
.arabic-classes .ac-primary:hover { background: #066b68; }
.ac-filters { display: flex; gap: 12px; margin: 25px 0; }
.ac-filters input,
.ac-filters select {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid #dce8e8;
  border-radius: 10px;
  background: white;
  color: #132c43;
}
.ac-filters input { flex: 1; }
.ac-filters .ac-filter-active { background: #fff4cd; border-color: #eed06b; }
.ac-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.ac-card {
  background: white;
  border: 1px solid #dce8e8;
  border-radius: 16px;
  padding: 23px;
  display: flex;
  flex-direction: column;
}
.ac-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ac-card-top > span { font-size: 9px; letter-spacing: 1px; color: #5d7180; font-weight: 700; }
.ac-card-top button { font-size: 23px; border: 0; padding: 0 3px; color: #087f7b; }
.ac-arabic-title { font-family: Tahoma, Arial, sans-serif; color: #087f7b; font-size: 24px; margin: 20px 0 14px; }
.ac-card h2 { font-size: 18px; font-weight: 700; margin: 0 0 11px; }
.ac-card-description { font-size: 13px; line-height: 1.8; color: #5d7180; margin: 0 0 20px; }
.arabic-classes .ac-open {
  margin-top: auto;
  text-align: left;
  border: 0;
  border-top: 1px solid #dce8e8;
  border-radius: 0;
  padding: 16px 0 0;
  color: #087f7b;
  font-size: 12px;
  font-weight: 650;
}
.ac-footnote { font-size: 11px; line-height: 1.8; color: #5d7180; margin-top: 25px; }
.ac-empty { text-align: center; padding: 40px; color: #5d7180; }
.ac-warning { padding: 13px; background: #fff4cd; border-radius: 10px; font-size: 13px; }
.ac-lesson { max-width: 900px; margin: auto; }
.ac-lesson-toolbar { display: flex; justify-content: space-between; margin-bottom: 27px; gap: 12px; }
.ac-lesson > h2 { font-size: 32px; font-weight: 750; margin: 12px 0; }
.ac-lesson-arabic { font-size: 27px; color: #087f7b; margin: 12px 0; text-align: left; }
.ac-panel { padding: 27px; background: white; border: 1px solid #dce8e8; border-radius: 16px; margin-top: 20px; }
.ac-panel h3 { font-size: 18px; font-weight: 700; margin: 0 0 20px; }
.ac-panel ul { padding-left: 22px; margin: 0; list-style: disc; }
.ac-panel li { font-size: 15px; line-height: 1.95; margin: 12px 0; }
.ac-examples { display: grid; gap: 14px; }
.ac-examples > div { border: 1px solid #e0eae6; border-radius: 12px; padding: 18px; background: #f8fcfa; }
.ac-examples p:first-child { font-family: Tahoma, Arial, sans-serif; font-size: 25px; line-height: 1.9; margin: 0 0 10px; }
.ac-examples p:last-child { font-size: 14px; color: #5d7180; line-height: 1.7; margin: 0; }
.ac-reference { border-top: 1px solid #dce8e8; margin-top: 22px; padding-top: 18px; }
.ac-reference summary { cursor: pointer; color: #087f7b; font-weight: 650; font-size: 14px; }
.ac-reference > p { font-size: 12px; line-height: 1.8; color: #5d7180; }
.ac-table-scroll { overflow: auto; margin-top: 15px; }
.ac-reference table { width: 100%; border-collapse: collapse; font-size: 14px; }
.ac-reference th,
.ac-reference td { text-align: start; padding: 12px; border-bottom: 1px solid #dce8e8; white-space: nowrap; }
.ac-reference th { background: #eaf6f0; font-size: 12px; }
.ac-practice fieldset { border: 0; padding: 0; margin: 0 0 20px; min-width: 0; }
.ac-practice legend { font-size: 16px; margin-bottom: 15px; line-height: 1.8; }
.ac-choice { display: flex; align-items: center; gap: 12px; padding: 15px; border: 1px solid #dce8e8; border-radius: 11px; margin: 10px 0; cursor: pointer; }
.ac-choice.ac-selected { background: #e9f7f1; border-color: #087f7b; }
.ac-choice input { accent-color: #087f7b; flex-shrink: 0; }
.ac-choice span { font-size: 16px; line-height: 1.8; }
.ac-feedback { background: #fff5d3; padding: 17px; border-radius: 12px; margin-top: 20px; font-size: 14px; line-height: 1.8; }
.ac-feedback.ac-correct { background: #e3f4ec; }
.ac-feedback p { margin: 7px 0 0; }
.ac-bottom-nav { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 27px 0; }
.ac-bottom-nav > span { font-size: 11px; color: #5d7180; text-align: center; }
@media (max-width: 1050px) {
  .ac-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 650px) {
  .ac-grid { grid-template-columns: 1fr; }
  .ac-header { align-items: flex-start; flex-direction: column; gap: 14px; }
  .ac-header h1 { font-size: 27px; }
  .ac-banner { flex-direction: column; align-items: flex-start; padding: 23px; }
  .ac-banner h2 { font-size: 24px; }
  .ac-filters { flex-wrap: wrap; }
  .ac-filters input { flex-basis: 100%; }
  .ac-filters select { flex: 1; }
  .ac-panel { padding: 20px; }
  .ac-lesson > h2 { font-size: 27px; }
  .ac-examples p:first-child { font-size: 23px; }
  .ac-bottom-nav { flex-wrap: wrap; }
  .ac-bottom-nav > span { order: 3; flex-basis: 100%; }
}
`;
