/// Localised display names for catalogue values.
///
/// Firestore always stores values in English (`Sinhala`, `Mathematics`, `OL`)
/// so filters, composite indexes and the admin panel stay language independent.
/// These maps translate the stored value for display only.
///
/// Unknown values are returned unchanged, so an admin can add a brand new
/// subject without waiting for an app release - it will simply render in
/// English until a translation row is added below.

import 'app_localizations.dart';

/// Adds `subjectName()`, `mediumName()`, ... to `context.l10n`.
extension CatalogLocalization on AppLocalizations {
  /// Display name of a stored subject (`Mathematics` -> `ගණිතය`).
  String subjectName(String raw) => _lookup(
        _subjects,
        raw,
        // Admins sometimes upload "Mathematics (Grade 6-11)"; matching the part
        // before the parenthesis keeps those translated too.
        alsoTry: raw.split('(').first,
      );

  /// Display name of a stored medium (`Sinhala` -> `සිංහල`).
  String mediumName(String raw) => _lookup(_mediums, raw);

  /// Display name of a stored category (`textbook` -> `පෙළපොත`).
  String categoryName(String raw) => _lookup(_categories, raw);

  /// Display name of a stored paper type (`Marking Scheme` -> ...).
  String paperTypeName(String raw) => _lookup(_paperTypes, raw);

  /// Display name of a stored exam type (`OL` -> `සාමාන්‍ය පෙළ`).
  String examTypeName(String raw) => _lookup(_examTypes, raw);

  /// Short label used by the past-paper tabs, kept in latin script because
  /// students search for "O/L" and "A/L" in every language.
  String examTypeShort(String raw) {
    switch (raw) {
      case 'OL':
        return 'O/L';
      case 'AL':
        return 'A/L';
      case 'Scholarship':
        return papersTabScholarship;
      case 'TermTest':
        return papersTabTermtest;
      default:
        return raw;
    }
  }

  /// Resolves [raw] against a `[sinhala, tamil]` table.
  String _lookup(
    Map<String, List<String>> table,
    String raw, {
    String? alsoTry,
  }) {
    final String key = raw.trim();
    final List<String>? row =
        table[key] ?? (alsoTry == null ? null : table[alsoTry.trim()]);
    if (row == null) return key;
    switch (language) {
      case AppLanguage.sinhala:
        return row[0];
      case AppLanguage.tamil:
        return row[1];
      case AppLanguage.english:
        return key;
    }
  }
}

/// Subject names (`subjects` collection field `subject`).
const Map<String, List<String>> _subjects = <String, List<String>>{
  'Mathematics': <String>['ගණිතය', 'கணிதம்'],
  'Science': <String>['විද්‍යාව', 'அறிவியல்'],
  'Sinhala Language': <String>['සිංහල භාෂාව', 'சிங்கள மொழி'],
  'Tamil Language': <String>['දෙමළ භාෂාව', 'தமிழ் மொழி'],
  'English Language': <String>['ඉංග්‍රීසි භාෂාව', 'ஆங்கில மொழி'],
  'History': <String>['ඉතිහාසය', 'வரலாறு'],
  'Geography': <String>['භූගෝල විද්‍යාව', 'புவியியல்'],
  'Citizenship Education': <String>['පුරවැසි අධ්‍යාපනය', 'குடியுரிமைக் கல்வி'],
  'Health & Physical Education': <String>['සෞඛ්‍ය හා ශාරීරික අධ්‍යාපනය', 'சுகாதாரம் & உடற்கல்வி'],
  'ICT': <String>['තොරතුරු හා සන්නිවේදන තාක්ෂණය', 'தகவல் தொடர்பாடல் தொழில்நுட்பம்'],
  'Agriculture': <String>['කෘෂිකර්මය', 'விவசாயம்'],
  'Home Economics': <String>['ගෘහ ආර්ථික විද්‍යාව', 'வீட்டுப் பொருளியல்'],
  'Buddhism': <String>['බුද්ධ ධර්මය', 'பௌத்தம்'],
  'Hinduism': <String>['හින්දු ධර්මය', 'இந்து சமயம்'],
  'Islam': <String>['ඉස්ලාම් ධර්මය', 'இஸ்லாம்'],
  'Christianity': <String>['ක්‍රිස්තියානි ධර්මය', 'கிறிஸ்தவம்'],
  'Aesthetics': <String>['සෞන්දර්ය', 'அழகியல்'],
  'Business & Accounting Studies': <String>['ව්‍යාපාර හා ගිණුම්කරණ අධ්‍යයනය', 'வணிகம் & கணக்கியல்'],
  'Entrepreneurship Studies': <String>['ව්‍යවසායකත්ව අධ්‍යයනය', 'தொழில்முனைவுக் கல்வி'],
  'Design & Technology': <String>['නිර්මාණ හා තාක්ෂණය', 'வடிவமைப்பு & தொழில்நுட்பம்'],
  'Biology': <String>['ජීව විද්‍යාව', 'உயிரியல்'],
  'Chemistry': <String>['රසායන විද්‍යාව', 'வேதியியல்'],
  'Physics': <String>['භෞතික විද්‍යාව', 'பௌதிகவியல்'],
  'Combined Mathematics': <String>['සංයුක්ත ගණිතය', 'சேர்க்கைக் கணிதம்'],
  'Business Studies': <String>['ව්‍යාපාර අධ්‍යයනය', 'வணிகக் கல்வி'],
  'Accounting': <String>['ගිණුම්කරණය', 'கணக்கியல்'],
  'Economics': <String>['ආර්ථික විද්‍යාව', 'பொருளியல்'],
  'Political Science': <String>['දේශපාලන විද්‍යාව', 'அரசியல் அறிவியல்'],
  'Logic & Scientific Method': <String>['තර්ක ශාස්ත්‍රය', 'தர்க்கவியல்'],
  'Agricultural Science': <String>['කෘෂි විද්‍යාව', 'விவசாய அறிவியல்'],
  'Sinhala Literature': <String>['සිංහල සාහිත්‍යය', 'சிங்கள இலக்கியம்'],
  'Tamil Literature': <String>['දෙමළ සාහිත්‍යය', 'தமிழ் இலக்கியம்'],
  'English Literature': <String>['ඉංග්‍රීසි සාහිත්‍යය', 'ஆங்கில இலக்கியம்'],
  'General Knowledge': <String>['සාමාන්‍ය දැනුම', 'பொது அறிவு'],
  'Common General Test': <String>['පොදු සාමාන්‍ය පරීක්ෂණය', 'பொது அறிவுத் தாள்'],
};
/// Teaching medium (`medium` field).
const Map<String, List<String>> _mediums = <String, List<String>>{
  'Sinhala': <String>['සිංහල', 'சிங்களம்'],
  'English': <String>['ඉංග්‍රීසි', 'ஆங்கிலம்'],
  'Tamil': <String>['දෙමළ', 'தமிழ்'],
};
/// Book categories (`category` field).
const Map<String, List<String>> _categories = <String, List<String>>{
  'textbook': <String>['පෙළපොත', 'பாடநூல்'],
  'workbook': <String>['අභ්‍යාස පොත', 'பயிற்சி நூல்'],
  'syllabus': <String>['විෂය නිර්දේශය', 'பாடத்திட்டம்'],
  'teachers-guide': <String>['ගුරු මාර්ගෝපදේශය', 'ஆசிரியர் கையேடு'],
};
/// Past paper types (`paperType` field).
const Map<String, List<String>> _paperTypes = <String, List<String>>{
  'Paper 1': <String>['ප්‍රශ්න පත්‍රය 1', 'தாள் 1'],
  'Paper 2': <String>['ප්‍රශ්න පත්‍රය 2', 'தாள் 2'],
  'MCQ': <String>['බහුවරණ', 'பல்தேர்வு'],
  'Essay': <String>['රචනා', 'கட்டுரை'],
  'Term Test': <String>['වාර පරීක්ෂණය', 'தவணைப் பரீட்சை'],
  'Marking Scheme': <String>['පිළිතුරු පත්‍රිකාව', 'விடைகள் தாள்'],
};
/// Exam types (`examType` field).
const Map<String, List<String>> _examTypes = <String, List<String>>{
  'OL': <String>['සාමාන්‍ය පෙළ', 'சாதாரண தரம்'],
  'AL': <String>['උසස් පෙළ', 'உயர்தரம்'],
  'Scholarship': <String>['ශිෂ්‍යත්ව', 'புலமைப்பரிசில்'],
  'TermTest': <String>['වාර පරීක්ෂණ', 'தவணைப் பரீட்சை'],
};