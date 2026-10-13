const sentence = (arabic, translation) => ({
  arabic,
  translation
});

const lesson = (
  id,
  title,
  arabic,
  note,
  vocabulary,
  rows
) => ({
  id,
  title,
  arabic,
  note,
  vocabulary: vocabulary.map(([word, meaning]) => ({
    word,
    meaning
  })),
  sentences: rows.map(([ar, en]) => sentence(ar, en))
});

export const LIBRARY_TOPICS = [
  {
    id: 'greetings',
    title: 'Arabic Greetings',
    arabic: 'التحيات العربية',
    category: 'Dialogues',
    tags: ['Culture', 'Daily Life'],
    level: 'Beginner',
    image:
      'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1000&q=80',
    accent: 'from-indigo-900 to-violet-600',
    description:
      'Build everyday conversations step by step: greet someone, introduce yourself, and use polite expressions.',
    goals: [
      'Common greetings and responses',
      'Introducing yourself',
      'Polite requests and thanks',
      'Short everyday conversations'
    ],
    lessons: [
      lesson(
        'greetings-1',
        'Greetings & Responses',
        'التحيات والردود',
        'السلام عليكم is a common greeting; وعليكم السلام is its customary reply. These examples use standard Arabic.',
        [
          ['مرحبا', 'hello'],
          ['صباح', 'morning'],
          ['مساء', 'evening'],
          ['بخير', 'well']
        ],
        [
          ['السلام عليكم', 'Peace be upon you.'],
          ['وعليكم السلام', 'And peace be upon you.'],
          ['مرحبا، كيف حالك؟', 'Hello, how are you?'],
          ['أنا بخير، شكرا', 'I am well, thank you.'],
          ['صباح الخير', 'Good morning.'],
          ['صباح النور', 'Good morning. (A reply.)'],
          ['مساء الخير', 'Good evening.'],
          ['أهلا وسهلا بك', 'Welcome.']
        ]
      ),
      lesson(
        'greetings-2',
        'Introduce Yourself',
        'التعريف بالنفس',
        'Arabic often omits a present-tense equivalent of “am” or “is”: أنا طالب means “I am a student.”',
        [
          ['اسم', 'name'],
          ['طالب', 'male student'],
          ['طالبة', 'female student'],
          ['جامعة', 'university']
        ],
        [
          ['ما اسمك؟', 'What is your name?'],
          ['اسمي مريم', 'My name is Maryam.'],
          [
            'أنا طالب في الجامعة',
            'I am a student at the university.'
          ],
          [
            'أنا طالبة في الجامعة',
            'I am a female student at the university.'
          ],
          ['من أين أنت؟', 'Where are you from?'],
          ['أنا من الإمارات', 'I am from the UAE.'],
          [
            'أدرس اللغة العربية',
            'I study the Arabic language.'
          ],
          [
            'سعيد بلقائك',
            'Pleased to meet you. (Said by a male speaker.)'
          ]
        ]
      ),
      lesson(
        'greetings-3',
        'Polite Expressions',
        'عبارات مهذبة',
        'من فضلك means “please.” شكرا means “thank you,” and عفوا can mean “you are welcome” or “excuse me,” depending on context.',
        [
          ['شكرا', 'thank you'],
          ['عفوا', 'you are welcome / excuse me'],
          ['آسف', 'sorry (male speaker)'],
          ['مساعدة', 'help']
        ],
        [
          [
            'من فضلك، أريد مساعدة',
            'Please, I would like some help.'
          ],
          ['شكرا جزيلا لك', 'Thank you very much.'],
          ['عفوا، لا مشكلة', 'You are welcome, no problem.'],
          [
            'آسف على التأخير',
            'Sorry for being late. (Said by a male speaker.)'
          ],
          [
            'هل يمكنك تكرار الجملة؟',
            'Can you repeat the sentence?'
          ],
          [
            'لا أفهم هذه الكلمة',
            'I do not understand this word.'
          ],
          ['إلى اللقاء غدا', 'See you tomorrow.'],
          [
            'أتمنى لك يوما سعيدا',
            'I wish you a happy day.'
          ]
        ]
      )
    ]
  },
  {
    id: 'home',
    title: 'At Home',
    arabic: 'في المنزل',
    category: 'Daily Life',
    tags: ['Vocabulary'],
    level: 'Beginner',
    image:
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=80',
    accent: 'from-amber-900 to-orange-600',
    description:
      'Learn the names of rooms and household objects, then describe where things are and what you do at home.',
    goals: [
      'Rooms and household objects',
      'Describing locations',
      'Simple daily routines',
      'Useful requests at home'
    ],
    lessons: [
      lesson(
        'home-1',
        'Rooms & Objects',
        'الغرف والأشياء',
        'هذا is used with masculine nouns and هذه with feminine nouns. Compare هذا بيتي and هذه غرفتي.',
        [
          ['بيت', 'house'],
          ['غرفة', 'room'],
          ['باب', 'door'],
          ['نافذة', 'window']
        ],
        [
          ['هذا بيتي', 'This is my house.'],
          ['هذه غرفتي', 'This is my room.'],
          ['غرفة النوم كبيرة', 'The bedroom is big.'],
          ['المطبخ نظيف', 'The kitchen is clean.'],
          ['الباب مفتوح', 'The door is open.'],
          ['النافذة مغلقة', 'The window is closed.'],
          ['هذا كرسي جديد', 'This is a new chair.'],
          ['هذه طاولة صغيرة', 'This is a small table.']
        ]
      ),
      lesson(
        'home-2',
        'Where Is It?',
        'أين هو؟',
        'Use أين to ask “where.” على means “on,” تحت means “under,” and بجانب means “beside.”',
        [
          ['على', 'on'],
          ['تحت', 'under'],
          ['بجانب', 'beside'],
          ['مفتاح', 'key']
        ],
        [
          ['أين الكتاب؟', 'Where is the book?'],
          [
            'الكتاب على الطاولة',
            'The book is on the table.'
          ],
          [
            'الحقيبة تحت الكرسي',
            'The bag is under the chair.'
          ],
          [
            'المفتاح بجانب الباب',
            'The key is beside the door.'
          ],
          ['الهاتف في الغرفة', 'The phone is in the room.'],
          [
            'المطبخ بجانب غرفة الجلوس',
            'The kitchen is beside the living room.'
          ],
          ['الكوب على الرف', 'The cup is on the shelf.'],
          [
            'الحديقة خلف البيت',
            'The garden is behind the house.'
          ]
        ]
      ),
      lesson(
        'home-3',
        'Daily Routines',
        'الروتين اليومي',
        'These examples describe habits. Notice the first-person verbs beginning with أ, such as أقرأ and أرتب.',
        [
          ['أقرأ', 'I read'],
          ['أرتب', 'I tidy'],
          ['أطبخ', 'I cook'],
          ['أستيقظ', 'I wake up']
        ],
        [
          [
            'أستيقظ مبكرا كل يوم',
            'I wake up early every day.'
          ],
          [
            'أرتب غرفتي في الصباح',
            'I tidy my room in the morning.'
          ],
          [
            'أطبخ الطعام في المطبخ',
            'I cook food in the kitchen.'
          ],
          [
            'أقرأ كتابا في المساء',
            'I read a book in the evening.'
          ],
          [
            'أشرب الشاي مع عائلتي',
            'I drink tea with my family.'
          ],
          [
            'أغسل الأطباق بعد العشاء',
            'I wash the dishes after dinner.'
          ],
          [
            'أدرس في غرفة هادئة',
            'I study in a quiet room.'
          ],
          [
            'أنام في الساعة العاشرة',
            'I go to sleep at ten o’clock.'
          ]
        ]
      )
    ]
  },
  {
    id: 'food',
    title: 'Food & Drinks',
    arabic: 'الطعام والشراب',
    category: 'Food',
    tags: ['Vocabulary', 'Daily Life', 'Dialogues'],
    level: 'Beginner',
    image:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=80',
    accent: 'from-rose-950 to-amber-600',
    description:
      'Learn food and drink vocabulary, practise ordering politely, and describe your preferences.',
    goals: [
      'Food and drink vocabulary',
      'Ordering in a café',
      'Describing preferences',
      'Asking for the bill'
    ],
    lessons: [
      lesson(
        'food-1',
        'Food & Drink Vocabulary',
        'مفردات الطعام والشراب',
        'أحب means “I like.” You can use it before a food or drink to describe your preferences.',
        [
          ['ماء', 'water'],
          ['خبز', 'bread'],
          ['قهوة', 'coffee'],
          ['شاي', 'tea']
        ],
        [
          ['أشرب الماء كل يوم', 'I drink water every day.'],
          ['أحب القهوة العربية', 'I like Arabic coffee.'],
          ['هذا كوب شاي', 'This is a cup of tea.'],
          ['الخبز طازج', 'The bread is fresh.'],
          ['أريد عصير برتقال', 'I would like orange juice.'],
          ['التفاح لذيذ', 'The apples are delicious.'],
          [
            'أتناول الأرز مع الدجاج',
            'I eat rice with chicken.'
          ],
          ['هذه سلطة خضراء', 'This is a green salad.']
        ]
      ),
      lesson(
        'food-2',
        'Order in a Café',
        'الطلب في المقهى',
        'أريد means “I want” or “I would like.” Adding من فضلك makes a request more polite.',
        [
          ['أريد', 'I would like'],
          ['قائمة', 'menu'],
          ['سكر', 'sugar'],
          ['حليب', 'milk']
        ],
        [
          ['أريد كوب ماء', 'I would like a glass of water.'],
          ['القائمة من فضلك', 'The menu, please.'],
          [
            'أريد قهوة بدون سكر',
            'I would like coffee without sugar.'
          ],
          [
            'هل لديكم شاي بالحليب؟',
            'Do you have tea with milk?'
          ],
          [
            'أريد ساندويتش جبن',
            'I would like a cheese sandwich.'
          ],
          ['هل يمكنني الجلوس هنا؟', 'May I sit here?'],
          ['الطلب جاهز الآن', 'The order is ready now.'],
          [
            'شكرا، القهوة لذيذة',
            'Thank you, the coffee is delicious.'
          ]
        ]
      ),
      lesson(
        'food-3',
        'At the Restaurant',
        'في المطعم',
        'Use هل to form a yes/no question. بدون means “without,” as in بدون ملح.',
        [
          ['مطعم', 'restaurant'],
          ['حساب', 'bill'],
          ['ملح', 'salt'],
          ['طاولة', 'table']
        ],
        [
          ['نريد طاولة لشخصين', 'We would like a table for two.'],
          ['هل هذا الطعام حار؟', 'Is this food spicy?'],
          [
            'أريد حساء بدون ملح',
            'I would like soup without salt.'
          ],
          [
            'ما الطبق المفضل لديك؟',
            'What is your favourite dish?'
          ],
          ['أحب السمك المشوي', 'I like grilled fish.'],
          ['هل يمكنني طلب الحلوى؟', 'May I order dessert?'],
          ['الحساب من فضلك', 'The bill, please.'],
          ['هل يمكنني الدفع بالبطاقة؟', 'May I pay by card?']
        ]
      )
    ]
  },
  {
    id: 'airport',
    title: 'At the Airport',
    arabic: 'في المطار',
    category: 'Travel',
    tags: ['Dialogues', 'Vocabulary'],
    level: 'Intermediate',
    image:
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=80',
    accent: 'from-sky-950 to-cyan-600',
    description:
      'Follow a journey through check-in, the departure gate, and arrival using practical travel sentences.',
    goals: [
      'Check-in vocabulary',
      'Finding your departure gate',
      'Asking about flight times',
      'Collecting luggage'
    ],
    lessons: [
      lesson(
        'airport-1',
        'Check-in',
        'تسجيل الوصول',
        'A reservation is حجز. جواز سفر means “passport,” and بطاقة الصعود means “boarding pass.”',
        [
          ['حجز', 'reservation'],
          ['جواز سفر', 'passport'],
          ['حقيبة', 'bag'],
          ['رحلة', 'flight']
        ],
        [
          [
            'لدي حجز إلى أبوظبي',
            'I have a reservation to Abu Dhabi.'
          ],
          ['هذا جواز سفري', 'This is my passport.'],
          [
            'أين مكتب تسجيل الوصول؟',
            'Where is the check-in desk?'
          ],
          ['لدي حقيبة واحدة', 'I have one bag.'],
          [
            'هل يمكنني اختيار مقعد قرب النافذة؟',
            'May I choose a seat by the window?'
          ],
          [
            'أحتاج إلى بطاقة الصعود',
            'I need a boarding pass.'
          ],
          [
            'كم وزن الحقيبة المسموح به؟',
            'What is the permitted luggage weight?'
          ],
          [
            'رقم رحلتي مكتوب على التذكرة',
            'My flight number is written on the ticket.'
          ]
        ]
      ),
      lesson(
        'airport-2',
        'At the Departure Gate',
        'عند بوابة المغادرة',
        'متى asks “when,” and أين asks “where.” Use these to ask about flight times and gate locations.',
        [
          ['بوابة', 'gate'],
          ['مغادرة', 'departure'],
          ['تأخير', 'delay'],
          ['طائرة', 'plane']
        ],
        [
          [
            'أين بوابة المغادرة؟',
            'Where is the departure gate?'
          ],
          [
            'متى تقلع الطائرة؟',
            'When does the plane take off?'
          ],
          ['هل الرحلة متأخرة؟', 'Is the flight delayed?'],
          ['تغير رقم البوابة', 'The gate number has changed.'],
          [
            'يبدأ الصعود بعد نصف ساعة',
            'Boarding starts in half an hour.'
          ],
          [
            'أين يمكنني شراء الماء؟',
            'Where can I buy water?'
          ],
          [
            'أنتظر الإعلان عن الرحلة',
            'I am waiting for the flight announcement.'
          ],
          [
            'هذه بطاقة الصعود الخاصة بي',
            'This is my boarding pass.'
          ]
        ]
      ),
      lesson(
        'airport-3',
        'Arrival & Luggage',
        'الوصول والأمتعة',
        'أمتعة means “luggage.” Notice the useful pattern أحتاج إلى, meaning “I need.”',
        [
          ['وصول', 'arrival'],
          ['أمتعة', 'luggage'],
          ['مخرج', 'exit'],
          ['جمارك', 'customs']
        ],
        [
          [
            'وصلنا إلى المطار',
            'We have arrived at the airport.'
          ],
          [
            'أين منطقة استلام الأمتعة؟',
            'Where is the baggage claim area?'
          ],
          ['لم أجد حقيبتي', 'I have not found my bag.'],
          [
            'حقيبتي سوداء وصغيرة',
            'My bag is black and small.'
          ],
          [
            'أحتاج إلى مساعدة من فضلك',
            'I need help, please.'
          ],
          [
            'أين مكتب الأمتعة المفقودة؟',
            'Where is the lost luggage office?'
          ],
          [
            'هل يجب أن أمر بالجمارك؟',
            'Do I need to go through customs?'
          ],
          [
            'أين المخرج إلى سيارات الأجرة؟',
            'Where is the exit to the taxis?'
          ]
        ]
      )
    ]
  },
  {
    id: 'city',
    title: 'In the City',
    arabic: 'في المدينة',
    category: 'Travel',
    tags: ['Daily Life', 'Vocabulary'],
    level: 'Beginner',
    image:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1000&q=80',
    accent: 'from-indigo-950 to-sky-600',
    description:
      'Find familiar places, ask for directions, and describe short journeys around the city.',
    goals: [
      'Places in the city',
      'Asking for directions',
      'Near and far',
      'Simple transport sentences'
    ],
    lessons: [
      lesson(
        'city-1',
        'Places Around You',
        'أماكن من حولك',
        'The prefix الـ often corresponds to “the.” Compare مكتبة, “a library,” with المكتبة, “the library.”',
        [
          ['مكتبة', 'library'],
          ['مسجد', 'mosque'],
          ['مستشفى', 'hospital'],
          ['حديقة', 'park / garden']
        ],
        [
          ['أين المكتبة؟', 'Where is the library?'],
          ['المسجد قريب', 'The mosque is nearby.'],
          ['المدينة جميلة', 'The city is beautiful.'],
          [
            'المستشفى في هذا الشارع',
            'The hospital is on this street.'
          ],
          ['هذه حديقة كبيرة', 'This is a large park.'],
          [
            'المدرسة بجانب المكتبة',
            'The school is beside the library.'
          ],
          ['أذهب إلى السوق', 'I go to the market.'],
          ['المتحف مفتوح اليوم', 'The museum is open today.']
        ]
      ),
      lesson(
        'city-2',
        'Ask for Directions',
        'السؤال عن الطريق',
        'يمين means “right” and يسار means “left.” إلى اليمين means “to the right.”',
        [
          ['شارع', 'street'],
          ['يمين', 'right'],
          ['يسار', 'left'],
          ['قريب', 'near']
        ],
        [
          [
            'كيف أصل إلى المكتبة؟',
            'How do I get to the library?'
          ],
          ['هل المحطة قريبة؟', 'Is the station nearby?'],
          [
            'اذهب إلى نهاية الشارع',
            'Go to the end of the street.'
          ],
          ['انعطف إلى اليمين', 'Turn right.'],
          ['انعطف إلى اليسار', 'Turn left.'],
          [
            'المطعم أمام الفندق',
            'The restaurant is in front of the hotel.'
          ],
          [
            'البنك بجانب المتجر',
            'The bank is beside the shop.'
          ],
          ['شكرا على المساعدة', 'Thank you for the help.']
        ]
      ),
      lesson(
        'city-3',
        'Getting Around',
        'التنقل في المدينة',
        'بالحافلة means “by bus,” and بالقطار means “by train.” The attached ب can express a means of transport.',
        [
          ['حافلة', 'bus'],
          ['قطار', 'train'],
          ['تذكرة', 'ticket'],
          ['محطة', 'station']
        ],
        [
          [
            'أذهب إلى الجامعة بالحافلة',
            'I go to university by bus.'
          ],
          ['أين محطة القطار؟', 'Where is the train station?'],
          ['أريد تذكرة واحدة', 'I would like one ticket.'],
          ['متى تصل الحافلة؟', 'When does the bus arrive?'],
          ['أحتاج إلى سيارة أجرة', 'I need a taxi.'],
          ['أمشي إلى الحديقة', 'I walk to the park.'],
          ['الطريق مزدحم اليوم', 'The road is busy today.'],
          [
            'سأصل بعد عشر دقائق',
            'I will arrive in ten minutes.'
          ]
        ]
      )
    ]
  },
  {
    id: 'shopping',
    title: 'Shopping',
    arabic: 'التسوق',
    category: 'Dialogues',
    tags: ['Daily Life', 'Vocabulary'],
    level: 'Intermediate',
    image:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80',
    accent: 'from-emerald-950 to-teal-600',
    description:
      'Find an item, compare sizes and prices, and complete a purchase with practical shopping language.',
    goals: [
      'Asking about products',
      'Colours and sizes',
      'Comparing prices',
      'Paying and requesting a receipt'
    ],
    lessons: [
      lesson(
        'shopping-1',
        'Find What You Need',
        'البحث عما تحتاجه',
        'أبحث عن means “I am looking for.” هل لديكم means “Do you have?” when addressing a shop or staff.',
        [
          ['متجر', 'shop'],
          ['حقيبة', 'bag'],
          ['قميص', 'shirt'],
          ['أبحث عن', 'I am looking for']
        ],
        [
          [
            'أبحث عن حقيبة جديدة',
            'I am looking for a new bag.'
          ],
          ['هل لديكم هذا الكتاب؟', 'Do you have this book?'],
          [
            'أريد شراء هذه الحقيبة',
            'I would like to buy this bag.'
          ],
          [
            'أين قسم الملابس؟',
            'Where is the clothing department?'
          ],
          [
            'هل يمكنني رؤية هذا القميص؟',
            'May I see this shirt?'
          ],
          ['أحتاج إلى حذاء مريح', 'I need comfortable shoes.'],
          [
            'هل المتجر مفتوح غدا؟',
            'Is the shop open tomorrow?'
          ],
          [
            'أنا أنظر فقط، شكرا',
            'I am just looking, thank you.'
          ]
        ]
      ),
      lesson(
        'shopping-2',
        'Sizes & Colours',
        'المقاسات والألوان',
        'Adjectives usually follow the noun. Compare القميص الأزرق, “the blue shirt,” and الحقيبة الزرقاء, “the blue bag.”',
        [
          ['مقاس', 'size'],
          ['أكبر', 'larger'],
          ['أصغر', 'smaller'],
          ['لون', 'colour']
        ],
        [
          ['هل لديكم مقاس أكبر؟', 'Do you have a larger size?'],
          ['هذا المقاس صغير جدا', 'This size is very small.'],
          ['أريد القميص الأزرق', 'I would like the blue shirt.'],
          ['هل توجد حقيبة سوداء؟', 'Is there a black bag?'],
          ['أفضل اللون الأخضر', 'I prefer the green colour.'],
          [
            'هل يمكنني تجربة الحذاء؟',
            'May I try on the shoes?'
          ],
          ['هذا القميص مناسب لي', 'This shirt suits me.'],
          ['أحتاج إلى مقاس أصغر', 'I need a smaller size.']
        ]
      ),
      lesson(
        'shopping-3',
        'Prices & Payment',
        'الأسعار والدفع',
        'كم asks “how much” or “how many.” إيصال means “receipt,” and نقدا means “in cash.”',
        [
          ['سعر', 'price'],
          ['خصم', 'discount'],
          ['إيصال', 'receipt'],
          ['نقدا', 'in cash']
        ],
        [
          ['كم سعر هذا الكتاب؟', 'How much is this book?'],
          [
            'هل يوجد خصم اليوم؟',
            'Is there a discount today?'
          ],
          ['هذا السعر مرتفع', 'This price is high.'],
          ['هل يمكنني الدفع بالبطاقة؟', 'May I pay by card?'],
          ['سأدفع نقدا', 'I will pay in cash.'],
          [
            'أحتاج إلى إيصال من فضلك',
            'I need a receipt, please.'
          ],
          [
            'هل يمكنني إرجاع هذا المنتج؟',
            'May I return this product?'
          ],
          ['شكرا، سأشتري هذا', 'Thank you, I will buy this.']
        ]
      )
    ]
  },
  {
    id: 'culture',
    title: 'Emirati Culture',
    arabic: 'الثقافة الإماراتية',
    category: 'Culture',
    tags: ['Vocabulary'],
    level: 'Advanced',
    image:
      'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?auto=format&fit=crop&w=1000&q=80',
    accent: 'from-slate-950 to-amber-700',
    description:
      'Read longer sentences about hospitality, heritage, and cultural experiences, and practise discussing traditions.',
    goals: [
      'Hospitality vocabulary',
      'Describing cultural heritage',
      'Reading longer sentences',
      'Discussing cultural experiences'
    ],
    lessons: [
      lesson(
        'culture-1',
        'Hospitality',
        'الضيافة',
        'These reading examples introduce cultural vocabulary. Customs vary between families and situations.',
        [
          ['ضيافة', 'hospitality'],
          ['ضيف', 'guest'],
          ['مجلس', 'majlis / gathering place'],
          ['تمر', 'dates (fruit)']
        ],
        [
          [
            'تشتهر الإمارات بكرم الضيافة',
            'The UAE is known for its hospitality.'
          ],
          [
            'تقدم القهوة العربية للضيوف',
            'Arabic coffee is served to guests.'
          ],
          [
            'يستقبل المضيف ضيوفه بابتسامة',
            'The host welcomes guests with a smile.'
          ],
          ['يجلس الضيوف في المجلس', 'The guests sit in the majlis.'],
          [
            'تقدم بعض العائلات التمر مع القهوة',
            'Some families serve dates with coffee.'
          ],
          [
            'يعبر الترحيب بالضيوف عن الاحترام',
            'Welcoming guests expresses respect.'
          ],
          [
            'يسأل المضيف ضيفه عن أحواله',
            'The host asks the guest how they are.'
          ],
          [
            'أشكركم على حسن الضيافة',
            'I thank you for your warm hospitality.'
          ]
        ]
      ),
      lesson(
        'culture-2',
        'Heritage & Traditions',
        'التراث والتقاليد',
        'Notice how noun phrases express connections: تراث المنطقة means “the heritage of the region.”',
        [
          ['تراث', 'heritage'],
          ['تقاليد', 'traditions'],
          ['حرفة', 'craft'],
          ['تاريخ', 'history']
        ],
        [
          [
            'يحافظ الناس على تراثهم الثقافي',
            'People preserve their cultural heritage.'
          ],
          [
            'تعرض المتاحف تاريخ المنطقة',
            'Museums present the history of the region.'
          ],
          [
            'تروي الحرف التقليدية قصص الماضي',
            'Traditional crafts tell stories of the past.'
          ],
          [
            'كان البحر مصدر رزق لكثير من الناس',
            'The sea was a source of livelihood for many people.'
          ],
          [
            'ارتبط الغوص على اللؤلؤ بتاريخ المنطقة',
            'Pearl diving was connected to the history of the region.'
          ],
          [
            'تشارك العائلات في الاحتفالات الوطنية',
            'Families take part in national celebrations.'
          ],
          [
            'تنتقل بعض التقاليد من جيل إلى آخر',
            'Some traditions pass from one generation to another.'
          ],
          [
            'من المهم احترام التنوع الثقافي',
            'It is important to respect cultural diversity.'
          ]
        ]
      ),
      lesson(
        'culture-3',
        'Cultural Experiences',
        'تجارب ثقافية',
        'Use these sentences as reading practice and as models for describing a visit or asking about a cultural experience.',
        [
          ['تجربة', 'experience'],
          ['معرض', 'exhibition'],
          ['دليل', 'guide'],
          ['زائر', 'visitor']
        ],
        [
          [
            'زرت متحفا للتعرف على تاريخ الإمارات',
            'I visited a museum to learn about the history of the UAE.'
          ],
          [
            'شرح الدليل أهمية الحرف التقليدية',
            'The guide explained the importance of traditional crafts.'
          ],
          [
            'أرغب في زيارة معرض ثقافي',
            'I would like to visit a cultural exhibition.'
          ],
          [
            'ما العادات التي تميز هذه المنطقة؟',
            'Which customs distinguish this region?'
          ],
          [
            'تعرفت على كلمات عربية جديدة خلال الزيارة',
            'I learned new Arabic words during the visit.'
          ],
          [
            'ساعدتني التجربة على فهم الثقافة المحلية',
            'The experience helped me understand the local culture.'
          ],
          [
            'ينبغي للزائر احترام قواعد المكان',
            'A visitor should respect the rules of the place.'
          ],
          [
            'أود مشاركة ما تعلمته مع زملائي',
            'I would like to share what I learned with my classmates.'
          ]
        ]
      )
    ]
  },
  {
    id: 'grammar',
    title: 'Nominal Sentences',
    arabic: 'الجملة الاسمية',
    category: 'Grammar',
    tags: ['Vocabulary'],
    level: 'Beginner',
    image:
      'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1000&q=80',
    accent: 'from-blue-950 to-indigo-600',
    description:
      'Understand basic Arabic sentence patterns, describe people and objects, and practise masculine and feminine forms.',
    goals: [
      'Simple nominal sentences',
      'Describing people and things',
      'Masculine and feminine forms',
      'Recognising adjective agreement'
    ],
    lessons: [
      lesson(
        'grammar-1',
        'People & Pronouns',
        'الأشخاص والضمائر',
        'A simple present-tense nominal sentence does not need a word for “am” or “is.” أنا طالب means “I am a student.”',
        [
          ['أنا', 'I'],
          ['هو', 'he'],
          ['هي', 'she'],
          ['نحن', 'we']
        ],
        [
          ['أنا طالب', 'I am a student.'],
          ['أنا طالبة', 'I am a female student.'],
          ['هو معلم', 'He is a teacher.'],
          ['هي معلمة', 'She is a teacher.'],
          ['نحن طلاب', 'We are students.'],
          [
            'أنت صديقي',
            'You are my friend. (Addressing a male.)'
          ],
          [
            'أنت صديقتي',
            'You are my friend. (Addressing a female.)'
          ],
          ['هم زملائي', 'They are my classmates.']
        ]
      ),
      lesson(
        'grammar-2',
        'Describe Things',
        'وصف الأشياء',
        'Compare البيت الكبير, “the big house,” with البيت كبير, “the house is big.” The second is a complete sentence.',
        [
          ['كبير', 'big (masculine)'],
          ['صغير', 'small (masculine)'],
          ['جديد', 'new (masculine)'],
          ['جميل', 'beautiful (masculine)']
        ],
        [
          ['البيت كبير', 'The house is big.'],
          ['الكتاب جديد', 'The book is new.'],
          ['الباب مفتوح', 'The door is open.'],
          ['القلم صغير', 'The pen is small.'],
          ['الطعام لذيذ', 'The food is delicious.'],
          ['الماء بارد', 'The water is cold.'],
          ['الشارع طويل', 'The street is long.'],
          ['المتحف جميل', 'The museum is beautiful.']
        ]
      ),
      lesson(
        'grammar-3',
        'Masculine & Feminine',
        'المذكر والمؤنث',
        'In these examples, feminine singular nouns take feminine adjective forms, often ending in ة: الغرفة كبيرة.',
        [
          ['غرفة', 'room'],
          ['كبيرة', 'big (feminine)'],
          ['جميلة', 'beautiful (feminine)'],
          ['مغلقة', 'closed (feminine)']
        ],
        [
          ['الغرفة كبيرة', 'The room is big.'],
          [
            'اللغة العربية جميلة',
            'The Arabic language is beautiful.'
          ],
          ['السيارة جديدة', 'The car is new.'],
          ['الحقيبة صغيرة', 'The bag is small.'],
          ['النافذة مغلقة', 'The window is closed.'],
          ['الحديقة واسعة', 'The garden is spacious.'],
          ['القهوة ساخنة', 'The coffee is hot.'],
          ['المدينة هادئة', 'The city is quiet.']
        ]
      )
    ]
  }
];

export const allTopicSentences = topic =>
  topic.lessons.flatMap(lessonItem => lessonItem.sentences);

export const findSentenceTopic = text => {
  const normalize = value =>
    value
      .normalize('NFD')
      .replace(
        /[\u064B-\u065F\u0640\u0670،؛؟!.,;:]/g,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim();

  return LIBRARY_TOPICS.find(topic =>
    allTopicSentences(topic).some(
      item =>
        normalize(item.arabic) === normalize(text || '')
    )
  );
};