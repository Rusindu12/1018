import 'package:edulanka/l10n/app_localizations.dart';
import 'package:edulanka/l10n/catalog_names.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const AppLocalizations en = AppLocalizations(AppLanguage.english);
  const AppLocalizations si = AppLocalizations(AppLanguage.sinhala);
  const AppLocalizations ta = AppLocalizations(AppLanguage.tamil);

  test('every language returns a real string, never a raw key', () {
    for (final AppLocalizations l10n in <AppLocalizations>[en, si, ta]) {
      expect(l10n.booksTitle.isNotEmpty, isTrue);
      expect(l10n.booksTitle.startsWith('books_'), isFalse,
          reason: 'a missing translation leaked the lookup key');
      expect(l10n.settingsTitle.startsWith('settings_'), isFalse);
      expect(l10n.errorNetwork.startsWith('error_'), isFalse);
    }
  });

  test('Sinhala and Tamil use their own scripts', () {
    expect(si.navHome, 'මුල් පිටුව');
    expect(ta.navHome, 'முகப்பு');
    expect(si.booksTitle.codeUnits.any((int c) => c > 0x0D00), isTrue);
    expect(ta.booksTitle.codeUnits.any((int c) => c > 0x0B80), isTrue);
  });

  test('parameterised strings interpolate', () {
    expect(en.viewerPageOf(3, 24), 'Page 3 of 24');
    expect(si.viewerPageOf(3, 24), contains('3'));
    expect(en.shareSubject('2023 O/L Maths'), 'EduLanka – 2023 O/L Maths');
    expect(en.searchNoResults('abc'), contains('abc'));
    expect(en.downloadsDeleteBody('My book'), contains('My book'));
  });

  test('grade labels follow the language', () {
    expect(en.gradeLabel(10), 'Grade 10');
    expect(si.gradeLabel(10), '10 ශ්‍රේණිය');
    expect(ta.gradeLabel(10), 'தரம் 10');
    expect(en.gradeRangeLabel(1, 5), 'Grade 1 – Grade 5');
  });

  test('item counts and download counts are pluralised/localised', () {
    expect(en.itemsCount(1), '1 item');
    expect(en.itemsCount(5), '5 items');
    expect(en.downloadsCount('1.5K'), '1.5K downloads');
  });

  test('greeting follows the clock', () {
    expect(en.greetingForHour(8), 'Good morning');
    expect(en.greetingForHour(14), 'Good afternoon');
    expect(en.greetingForHour(21), 'Good evening');
    expect(si.greetingForHour(8), 'සුබ උදෑසනක්');
  });

  group('catalog names', () {
    test('translates stored English values', () {
      expect(en.subjectName('Mathematics'), 'Mathematics');
      expect(si.subjectName('Mathematics'), 'ගණිතය');
      expect(ta.subjectName('Mathematics'), 'கணிதம்');
      expect(si.mediumName('Tamil'), 'දෙමළ');
      expect(si.categoryName('textbook'), 'පෙළපොත');
      expect(si.paperTypeName('Marking Scheme'), 'පිළිතුරු පත්‍රිකාව');
      expect(si.examTypeName('OL'), 'සාමාන්‍ය පෙළ');
    });

    test('unknown values pass through so admins are not blocked', () {
      expect(en.subjectName('Astronomy 2025'), 'Astronomy 2025');
      expect(si.subjectName('Astronomy 2025'), 'Astronomy 2025');
    });

    test('matches a subject with a grade suffix', () {
      expect(si.subjectName('Mathematics (Grade 6-11)'), 'ගණිතය');
    });

    test('exam tabs keep the latin short forms', () {
      expect(en.examTypeShort('OL'), 'O/L');
      expect(ta.examTypeShort('AL'), 'A/L');
      expect(en.examTypeShort('Scholarship'), 'Grade 5 Scholarship');
    });
  });

  test('AppLanguage maps codes and locales', () {
    expect(AppLanguage.fromCode('si'), AppLanguage.sinhala);
    expect(AppLanguage.fromCode('ta'), AppLanguage.tamil);
    expect(AppLanguage.fromCode('fr'), AppLanguage.english);
    expect(AppLanguage.fromLocale(const Locale('ta')), AppLanguage.tamil);
    expect(AppLanguage.supportedLocales.first, const Locale('en'));
    expect(AppLanguage.codes, <String>['si', 'en', 'ta']);
  });

  testWidgets('the delegate loads every supported locale', (WidgetTester tester) async {
    const AppLocalizationsDelegate delegate = AppLocalizationsDelegate();
    expect(delegate.isSupported(const Locale('si')), isTrue);
    expect(delegate.isSupported(const Locale('ta')), isTrue);
    expect(delegate.isSupported(const Locale('fr')), isFalse);

    final AppLocalizations loaded = await delegate.load(const Locale('ta'));
    expect(loaded.language, AppLanguage.tamil);
  });
}
