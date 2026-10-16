/// Static reference data shared by the app AND the admin panel.
///
/// After changing anything here, update `admin_web/app.js` (same lists) so the
/// admin dropdowns stay identical to the app filters.
class CatalogConstants {
  CatalogConstants._();

  /// Firestore `medium` values (stored in English, displayed via AppLocalizations).
  static const String mediumSinhala = 'Sinhala';
  static const String mediumEnglish = 'English';
  static const String mediumTamil = 'Tamil';

  static const List<String> mediums = <String>[
    mediumSinhala,
    mediumEnglish,
    mediumTamil,
  ];

  /// Firestore `category` values for the "books" collection.
  static const String categoryTextbook = 'textbook';
  static const String categoryWorkbook = 'workbook';
  static const String categorySyllabus = 'syllabus';
  static const String categoryTeachersGuide = 'teachers-guide';

  static const List<String> bookCategories = <String>[
    categoryTextbook,
    categoryWorkbook,
    categorySyllabus,
    categoryTeachersGuide,
  ];

  /// Firestore `examType` values for the "papers" collection.
  static const String examOL = 'OL';
  static const String examAL = 'AL';
  static const String examScholarship = 'Scholarship';
  static const String examTermTest = 'TermTest';

  static const List<String> examTypes = <String>[
    examOL,
    examAL,
    examScholarship,
    examTermTest,
  ];

  /// Firestore `paperType` values.
  static const String paperTypeOne = 'Paper 1';
  static const String paperTypeTwo = 'Paper 2';
  static const String paperTypeMCQ = 'MCQ';
  static const String paperTypeEssay = 'Essay';
  static const String paperTypeMarkingScheme = 'Marking Scheme';
  static const String paperTypeTermTest = 'Term Test';

  static const List<String> paperTypes = <String>[
    paperTypeOne,
    paperTypeTwo,
    paperTypeMCQ,
    paperTypeEssay,
    paperTypeTermTest,
    paperTypeMarkingScheme,
  ];

  /// Grades 1..13 (Grade 1-5 primary, 6-9 junior secondary, 10-11 O/L, 12-13 A/L).
  static const int minGrade = 1;
  static const int maxGrade = 13;
  static List<int> get grades =>
      List<int>.generate(maxGrade - minGrade + 1, (int i) => minGrade + i);

  /// First/last year offered in filters and the admin year picker.
  static const int minYear = 2015;
  static const int maxYear = 2024;

  /// Subjects used by the A/L stream tabs (grade 12-13) - kept short because
  /// A/L subjects change every few years; admins can add free-text subjects.
  static const List<String> subjects = <String>[
    'Mathematics',
    'Science',
    'Sinhala Language',
    'Tamil Language',
    'English Language',
    'History',
    'Geography',
    'Citizenship Education',
    'Health & Physical Education',
    'ICT',
    'Agriculture',
    'Home Economics',
    'Buddhism',
    'Hinduism',
    'Islam',
    'Christianity',
    'Aesthetics',
    'Business & Accounting Studies',
    'Entrepreneurship Studies',
    'Design & Technology',
    'Biology',
    'Chemistry',
    'Physics',
    'Combined Mathematics',
    'Business Studies',
    'Accounting',
    'Economics',
    'Political Science',
    'Logic & Scientific Method',
    'Agricultural Science',
    'Sinhala Literature',
    'Tamil Literature',
    'English Literature',
    'General Knowledge',
    'Common General Test',
  ];

  /// Degrees of a school class - used by the admin panel wording.
  static String gradeLabel(int grade) => 'Grade $grade';

  /// Maps a grade to the exam that a student of that grade prepares for.
  static String examTypeForGrade(int grade) {
    if (grade <= 5) return examScholarship;
    if (grade <= 11) return examOL;
    return examAL;
  }
}
