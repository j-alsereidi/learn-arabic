import { LIBRARY_TOPICS as ORIGINAL_TOPICS } from './libraryData';

const topic = (
  id,
  title,
  arabic,
  category,
  imageSubject,
  vocabulary,
  sentences
) => ({
  id,
  title,
  arabic,
  category,
  imageSubject,
  level: 'Beginner',
  tags: ['Vocabulary'],

  description:
    `Learn useful Arabic for ${title.toLowerCase()} through pictures and complete sentences.`,

  goals: [
    'Recognize eight useful words',
    'Read examples in context',
    'Review and save useful sentences'
  ],

  lessons: [0, 1].map(part => ({
    id: `${id}-${part + 1}`,

    title:
      part === 0
        ? 'Everyday vocabulary'
        : 'Useful situations',

    arabic:
      part === 0
        ? 'مفردات أساسية'
        : 'مواقف مفيدة',

    note:
      'Read the Arabic, reveal its meaning, then use the vocabulary in a sentence of your own.',

    vocabulary: vocabulary
      .slice(part * 4, part * 4 + 4)
      .map(([word, meaning, pictureSubject]) => ({
        word,
        meaning,
        pictureSubject
      })),

    sentences: sentences
      .slice(part * 4, part * 4 + 4)
      .map(([arabic, translation]) => ({
        arabic,
        translation
      }))
  }))
});

const EXTRA_TOPICS = [
  topic(
    'family',
    'Family & Friends',
    'العائلة والأصدقاء',
    'Daily Life',
    'Family',
    [
      ['أم', 'mother', 'Mother'],
      ['أب', 'father', 'Father'],
      ['أخت', 'sister', 'Sister'],
      ['أخ', 'brother', 'Brother'],
      ['جدة', 'grandmother', 'Grandparent'],
      ['جد', 'grandfather', 'Grandparent'],
      ['صديق', 'male friend', 'Friendship'],
      ['عائلة', 'family', 'Family']
    ],
    [
      ['أمي تقرأ كتابا.', 'My mother is reading a book.'],
      ['أبي في البيت.', 'My father is at home.'],
      ['أختي تدرس العربية.', 'My sister studies Arabic.'],
      ['أخي يحب الرياضة.', 'My brother likes sport.'],
      ['أزور جدتي يوم الجمعة.', 'I visit my grandmother on Friday.'],
      ['جدي يشرب الشاي.', 'My grandfather drinks tea.'],
      ['هذا صديقي أحمد.', 'This is my friend Ahmed.'],
      ['أحب عائلتي كثيرا.', 'I love my family very much.']
    ]
  ),

  topic(
    'school',
    'School & University',
    'المدرسة والجامعة',
    'Education',
    'Classroom',
    [
      ['كتاب', 'book', 'Book'],
      ['قلم', 'pen', 'Pen'],
      ['دفتر', 'notebook', 'Notebook'],
      ['مدرسة', 'school', 'School'],
      ['معلم', 'male teacher', 'Teacher'],
      ['درس', 'lesson', 'Classroom'],
      ['سبورة', 'blackboard', 'Blackboard'],
      ['امتحان', 'exam', 'Exam']
    ],
    [
      ['هذا كتاب اللغة العربية.', 'This is the Arabic language book.'],
      ['أكتب بقلم أزرق.', 'I write with a blue pen.'],
      ['دفتري على الطاولة.', 'My notebook is on the table.'],
      ['أذهب إلى المدرسة صباحا.', 'I go to school in the morning.'],
      ['المعلم يشرح الجملة.', 'The teacher explains the sentence.'],
      ['يبدأ الدرس الساعة الثامنة.', 'The lesson starts at eight o’clock.'],
      ['الكلمة مكتوبة على السبورة.', 'The word is written on the blackboard.'],
      ['عندي امتحان غدا.', 'I have an exam tomorrow.']
    ]
  ),

  topic(
    'work',
    'Work & Careers',
    'العمل والمهن',
    'Daily Life',
    'Office',
    [
      ['مكتب', 'desk / office', 'Desk'],
      ['شركة', 'company', 'Office'],
      ['طبيب', 'male doctor', 'Physician'],
      ['مهندس', 'male engineer', 'Engineer'],
      ['اجتماع', 'meeting', 'Meeting'],
      ['زميل', 'male colleague', 'Teamwork'],
      ['مدير', 'male manager', 'Management'],
      ['عمل', 'work', 'Office']
    ],
    [
      ['مكتبي بجانب النافذة.', 'My desk is beside the window.'],
      ['أعمل في شركة صغيرة.', 'I work at a small company.'],
      ['الطبيب يعمل في المستشفى.', 'The doctor works at the hospital.'],
      ['أخي مهندس.', 'My brother is an engineer.'],
      ['عندنا اجتماع اليوم.', 'We have a meeting today.'],
      ['زميلي يساعدني في العمل.', 'My colleague helps me at work.'],
      ['المدير في المكتب.', 'The manager is in the office.'],
      ['أبدأ العمل الساعة التاسعة.', 'I start work at nine o’clock.']
    ]
  ),

  topic(
    'health',
    'Body & Health',
    'الجسم والصحة',
    'Health',
    'Stethoscope',
    [
      ['يد', 'hand', 'Hand'],
      ['عين', 'eye', 'Human eye'],
      ['رأس', 'head', 'Human head'],
      ['قدم', 'foot', 'Foot'],
      ['دواء', 'medicine', 'Medication'],
      ['صيدلية', 'pharmacy', 'Pharmacy'],
      ['ممرضة', 'female nurse', 'Nurse'],
      ['مستشفى', 'hospital', 'Hospital']
    ],
    [
      ['أغسل يدي قبل الطعام.', 'I wash my hands before eating.'],
      ['عيني تؤلمني.', 'My eye hurts.'],
      ['أشعر بألم في رأسي.', 'I have a pain in my head.'],
      ['قدمي تؤلمني بعد المشي.', 'My foot hurts after walking.'],
      ['هذا الدواء في الحقيبة.', 'This medicine is in the bag.'],
      ['أين أقرب صيدلية؟', 'Where is the nearest pharmacy?'],
      ['الممرضة تساعد المريض.', 'The nurse helps the patient.'],
      ['المستشفى قريب من بيتي.', 'The hospital is near my house.']
    ]
  ),

  topic(
    'animals',
    'Animals & Pets',
    'الحيوانات',
    'Nature',
    'Cat',
    [
      ['قطة', 'cat', 'Cat'],
      ['كلب', 'dog', 'Dog'],
      ['طائر', 'bird', 'Bird'],
      ['سمكة', 'fish', 'Fish'],
      ['حصان', 'horse', 'Horse'],
      ['جمل', 'camel', 'Camel'],
      ['أرنب', 'rabbit', 'Rabbit'],
      ['أسد', 'lion', 'Lion']
    ],
    [
      ['القطة تحت الكرسي.', 'The cat is under the chair.'],
      ['الكلب يلعب في الحديقة.', 'The dog is playing in the garden.'],
      ['الطائر فوق الشجرة.', 'The bird is above the tree.'],
      ['هذه سمكة صغيرة.', 'This is a small fish.'],
      ['الحصان يجري بسرعة.', 'The horse runs quickly.'],
      ['الجمل يعيش في الصحراء.', 'The camel lives in the desert.'],
      ['الأرنب يأكل الجزر.', 'The rabbit eats carrots.'],
      ['رأيت أسدا في حديقة الحيوانات.', 'I saw a lion at the zoo.']
    ]
  ),

  topic(
    'nature',
    'Nature & Weather',
    'الطبيعة والطقس',
    'Nature',
    'Landscape',
    [
      ['شمس', 'sun', 'Sun'],
      ['مطر', 'rain', 'Rain'],
      ['سحابة', 'cloud', 'Cloud'],
      ['ريح', 'wind', 'Wind'],
      ['شجرة', 'tree', 'Tree'],
      ['زهرة', 'flower', 'Flower'],
      ['بحر', 'sea', 'Sea'],
      ['جبل', 'mountain', 'Mountain']
    ],
    [
      ['الشمس مشرقة اليوم.', 'The sun is shining today.'],
      ['المطر غزير هذا الصباح.', 'The rain is heavy this morning.'],
      ['أرى سحابة بيضاء.', 'I see a white cloud.'],
      ['الريح قوية اليوم.', 'The wind is strong today.'],
      ['هذه شجرة كبيرة.', 'This is a big tree.'],
      ['الزهرة جميلة.', 'The flower is beautiful.'],
      ['أحب المشي بجانب البحر.', 'I like walking beside the sea.'],
      ['الجبل بعيد عن المدينة.', 'The mountain is far from the city.']
    ]
  ),

  topic(
    'clothes',
    'Clothes & Accessories',
    'الملابس والإكسسوارات',
    'Daily Life',
    'Clothing',
    [
      ['قميص', 'shirt', 'Shirt'],
      ['بنطال', 'trousers', 'Trousers'],
      ['فستان', 'dress', 'Dress'],
      ['حذاء', 'shoe', 'Shoe'],
      ['قبعة', 'hat', 'Hat'],
      ['معطف', 'coat', 'Coat'],
      ['جوارب', 'socks', 'Sock'],
      ['وشاح', 'scarf', 'Scarf']
    ],
    [
      ['هذا قميص أبيض.', 'This is a white shirt.'],
      ['أريد بنطالا أسود.', 'I would like black trousers.'],
      ['الفستان في الخزانة.', 'The dress is in the wardrobe.'],
      ['هذا الحذاء مريح.', 'This shoe is comfortable.'],
      ['أرتدي قبعة في الشمس.', 'I wear a hat in the sun.'],
      ['أحتاج إلى معطف في الشتاء.', 'I need a coat in winter.'],
      ['هذه جوارب جديدة.', 'These are new socks.'],
      ['الوشاح أزرق.', 'The scarf is blue.']
    ]
  ),

  topic(
    'transport',
    'Transport & Journeys',
    'المواصلات والرحلات',
    'Travel',
    'Train',
    [
      ['سيارة', 'car', 'Car'],
      ['دراجة', 'bicycle', 'Bicycle'],
      ['حافلة', 'bus', 'Bus'],
      ['قطار', 'train', 'Train'],
      ['سفينة', 'ship', 'Ship'],
      ['طريق', 'road', 'Road'],
      ['محطة', 'station', 'Train station'],
      ['تذكرة', 'ticket', 'Ticket (admission)']
    ],
    [
      ['السيارة أمام البيت.', 'The car is in front of the house.'],
      ['أركب دراجتي في الحديقة.', 'I ride my bicycle in the park.'],
      ['أنتظر الحافلة هنا.', 'I am waiting for the bus here.'],
      ['القطار يصل بعد ساعة.', 'The train arrives in an hour.'],
      ['السفينة في الميناء.', 'The ship is in the port.'],
      ['هذا الطريق طويل.', 'This road is long.'],
      ['أين محطة القطار؟', 'Where is the train station?'],
      ['أريد تذكرة إلى المدينة.', 'I would like a ticket to the city.']
    ]
  ),

  topic(
    'sports',
    'Sports & Fitness',
    'الرياضة واللياقة',
    'Leisure',
    'Association football',
    [
      ['كرة', 'ball', 'Ball'],
      ['ملعب', 'sports field', 'Football pitch'],
      ['سباحة', 'swimming', 'Swimming'],
      ['جري', 'running', 'Running'],
      ['فريق', 'team', 'Sports team'],
      ['لاعب', 'player', 'Association football'],
      ['مباراة', 'match', 'Association football'],
      ['تمرين', 'exercise', 'Physical exercise']
    ],
    [
      ['ألعب بالكرة مع أصدقائي.', 'I play with a ball with my friends.'],
      ['الملعب قريب من المدرسة.', 'The sports field is near the school.'],
      ['أحب السباحة في الصيف.', 'I like swimming in summer.'],
      ['الجري مفيد للصحة.', 'Running is good for health.'],
      ['فريقنا يتدرب كل يوم.', 'Our team trains every day.'],
      ['هذا لاعب سريع.', 'This is a fast player.'],
      ['أشاهد المباراة مع عائلتي.', 'I watch the match with my family.'],
      ['هذا تمرين سهل.', 'This is an easy exercise.']
    ]
  ),

  topic(
    'technology',
    'Technology & Devices',
    'التقنية والأجهزة',
    'Technology',
    'Laptop',
    [
      ['هاتف', 'phone', 'Smartphone'],
      ['حاسوب', 'computer', 'Laptop'],
      ['شاشة', 'screen', 'Computer monitor'],
      ['لوحة مفاتيح', 'keyboard', 'Computer keyboard'],
      ['شاحن', 'charger', 'Battery charger'],
      ['كاميرا', 'camera', 'Camera'],
      ['سماعات', 'headphones', 'Headphones'],
      ['رسالة', 'message', 'Text messaging']
    ],
    [
      ['هاتفي على الطاولة.', 'My phone is on the table.'],
      ['أستخدم الحاسوب للدراسة.', 'I use the computer for studying.'],
      ['الشاشة كبيرة وواضحة.', 'The screen is large and clear.'],
      ['أكتب باستخدام لوحة المفاتيح.', 'I type using the keyboard.'],
      ['أين شاحن الهاتف؟', 'Where is the phone charger?'],
      ['ألتقط صورة بالكاميرا.', 'I take a picture with the camera.'],
      ['أستمع إلى الدرس بالسماعات.', 'I listen to the lesson with headphones.'],
      ['أرسل رسالة إلى صديقي.', 'I send a message to my friend.']
    ]
  ),

  topic(
    'time',
    'Time & Daily Plans',
    'الوقت والخطط اليومية',
    'Daily Life',
    'Clock',
    [
      ['ساعة', 'clock / hour', 'Clock'],
      ['صباح', 'morning', 'Sunrise'],
      ['مساء', 'evening', 'Sunset'],
      ['ليل', 'night', 'Night'],
      ['يوم', 'day', 'Daytime'],
      ['أسبوع', 'week', 'Calendar'],
      ['شهر', 'month', 'Calendar'],
      ['تقويم', 'calendar', 'Calendar']
    ],
    [
      ['الساعة على الحائط.', 'The clock is on the wall.'],
      ['أدرس في الصباح.', 'I study in the morning.'],
      ['أزور صديقي في المساء.', 'I visit my friend in the evening.'],
      ['أنام في الليل.', 'I sleep at night.'],
      ['في اليوم أربع وعشرون ساعة.', 'There are twenty-four hours in a day.'],
      ['في الأسبوع سبعة أيام.', 'There are seven days in a week.'],
      ['أسافر الشهر القادم.', 'I am travelling next month.'],
      ['أنظر إلى التقويم.', 'I look at the calendar.']
    ]
  ),

  topic(
    'hobbies',
    'Hobbies & Creativity',
    'الهوايات والإبداع',
    'Leisure',
    'Painting',
    [
      ['قراءة', 'reading', 'Reading'],
      ['رسم', 'drawing', 'Drawing'],
      ['تصوير', 'photography', 'Photography'],
      ['طبخ', 'cooking', 'Cooking'],
      ['موسيقى', 'music', 'Musical instrument'],
      ['حديقة', 'garden', 'Garden'],
      ['شطرنج', 'chess', 'Chess'],
      ['رحلة', 'trip', 'Hiking']
    ],
    [
      ['القراءة هوايتي المفضلة.', 'Reading is my favourite hobby.'],
      ['أحب الرسم بالألوان.', 'I like drawing in colour.'],
      ['أتعلم التصوير في وقت فراغي.', 'I learn photography in my free time.'],
      ['أستمتع بالطبخ مع عائلتي.', 'I enjoy cooking with my family.'],
      ['أستمع إلى الموسيقى في البيت.', 'I listen to music at home.'],
      ['أزرع الزهور في الحديقة.', 'I grow flowers in the garden.'],
      ['ألعب الشطرنج مع أخي.', 'I play chess with my brother.'],
      ['نذهب في رحلة يوم السبت.', 'We go on a trip on Saturday.']
    ]
  )
];

const OLD_SUBJECTS = {
  greetings: 'Handshake',
  home: 'House',
  food: 'Arabic cuisine',
  airport: 'Airport',
  city: 'City',
  shopping: 'Shopping',
  culture: 'Culture of the United Arab Emirates',
  grammar: 'Arabic alphabet'
};

const WORD_SUBJECTS = {
  'مرحبا': 'Handshake',
  'صباح': 'Sunrise',
  'مساء': 'Sunset',
  'بخير': 'Smile',
  'اسم': 'Name tag',
  'طالب': 'Student',
  'طالبة': 'Student',
  'جامعة': 'University',
  'شكرا': 'Handshake',
  'عفوا': 'Handshake',
  'آسف': 'Handshake',
  'مساعدة': 'Teamwork',

  'بيت': 'House',
  'غرفة': 'Room',
  'باب': 'Door',
  'نافذة': 'Window',
  'مفتاح': 'Key (lock)',
  'أقرأ': 'Reading',
  'أرتب': 'Housekeeping',
  'أطبخ': 'Cooking',
  'أستيقظ': 'Alarm clock',

  'ماء': 'Drinking water',
  'خبز': 'Bread',
  'قهوة': 'Arabic coffee',
  'شاي': 'Tea',
  'قائمة': 'Menu',
  'سكر': 'Sugar',
  'حليب': 'Milk',
  'مطعم': 'Restaurant',
  'حساب': 'Receipt',
  'ملح': 'Salt',
  'طاولة': 'Table (furniture)',

  'حجز': 'Airport',
  'جواز سفر': 'Passport',
  'حقيبة': 'Bag',
  'رحلة': 'Airplane',
  'بوابة': 'Gate (airport)',
  'مغادرة': 'Airport',
  'تأخير': 'Airport',
  'طائرة': 'Airplane',
  'وصول': 'Airport',
  'أمتعة': 'Baggage',
  'مخرج': 'Exit sign',
  'جمارك': 'Customs',

  'مكتبة': 'Library',
  'مسجد': 'Mosque',
  'مستشفى': 'Hospital',
  'حديقة': 'Garden',
  'شارع': 'Street',
  'حافلة': 'Bus',
  'قطار': 'Train',
  'تذكرة': 'Ticket (admission)',
  'محطة': 'Train station',

  'متجر': 'Shop',
  'قميص': 'Shirt',
  'مقاس': 'Tape measure',
  'لون': 'Color',
  'سعر': 'Price tag',
  'خصم': 'Shopping',
  'إيصال': 'Receipt',
  'نقدا': 'Banknote',

  'ضيافة': 'Arabic coffee',
  'ضيف': 'Handshake',
  'مجلس': 'Majlis',
  'تمر': 'Date palm',
  'تراث': 'Culture of the United Arab Emirates',
  'تقاليد': 'Culture of the United Arab Emirates',
  'حرفة': 'Handicraft',
  'تاريخ': 'Museum',
  'تجربة': 'Museum',
  'معرض': 'Art exhibition',
  'دليل': 'Tour guide',
  'زائر': 'Tourism',

  'أنا': 'Person',
  'هو': 'Man',
  'هي': 'Woman',
  'نحن': 'Teamwork',
  'كبير': 'Elephant',
  'صغير': 'Mouse',
  'جديد': 'Book',
  'جميل': 'Flower',
  'كبيرة': 'House',
  'جميلة': 'Flower',
  'مغلقة': 'Door'
};

export const LIBRARY_TOPICS = [
  ...ORIGINAL_TOPICS,
  ...EXTRA_TOPICS
].map(item => ({
  ...item,

  imageSubject:
    item.imageSubject ||
    OLD_SUBJECTS[item.id] ||
    item.title,

  lessons: item.lessons.map(section => ({
    ...section,

    vocabulary: section.vocabulary.map((word, index) => ({
      ...word,

      id: `${section.id}:word:${index}`,

      pictureSubject:
        word.pictureSubject ||
        WORD_SUBJECTS[word.word] ||
        OLD_SUBJECTS[item.id] ||
        item.title
    }))
  }))
}));

export const allTopicSentences = item =>
  item.lessons.flatMap(section => section.sentences);

export const normalize = text =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .toLowerCase()
    .trim();

export const ALL_WORDS = LIBRARY_TOPICS.flatMap(item =>
  item.lessons.flatMap(section =>
    section.vocabulary.map(word => ({
      ...word,
      topicId: item.id,
      topicTitle: item.title,
      lessonId: section.id,
      level: item.level
    }))
  )
);