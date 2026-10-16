/// AppLocalizations - hand-maintained trilingual strings (English / Sinhala / Tamil).
//
// Why not `flutter gen-l10n`?  This project is required to build with zero code
// generation steps, so the strings live in one plain Dart file.  The structure
// mirrors a generated `AppLocalizations`, so migrating to ARB files later only
// means replacing this file.
//
// RULE: every user-visible string in the app MUST come from here. Add a row to
// `_table` and a getter below - never hardcode UI text in a widget.

import 'package:flutter/material.dart';

/// Languages the UI ships with. `code` is what gets persisted in preferences
/// and passed to `MaterialApp.locale`.
enum AppLanguage {
  sinhala('si', 'සිංහල'),
  english('en', 'English'),
  tamil('ta', 'தமிழ்');

  const AppLanguage(this.code, this.nativeLabel);

  /// ISO 639-1 code: `si`, `en`, `ta`.
  final String code;

  /// Label shown in the language picker (always in the language itself).
  final String nativeLabel;

  Locale get locale => Locale(code);

  static AppLanguage fromCode(String? code) {
    switch (code) {
      case 'si':
        return AppLanguage.sinhala;
      case 'ta':
        return AppLanguage.tamil;
      case 'en':
        return AppLanguage.english;
      default:
        return AppLanguage.english;
    }
  }

  /// Locale of the device, mapped to a supported language (English fallback).
  static AppLanguage fromLocale(Locale? locale) => fromCode(locale?.languageCode);

  /// English is listed first on purpose: Flutter falls back to the *first*
  /// supported locale when the device language is none of si/en/ta, and an
  /// English fallback is friendlier than Sinhala for a foreign user.
  static List<Locale> get supportedLocales => <Locale>[
        AppLanguage.english.locale,
        AppLanguage.sinhala.locale,
        AppLanguage.tamil.locale,
      ];

  static List<String> get codes =>
      AppLanguage.values.map((AppLanguage l) => l.code).toList(growable: false);
}

/// Typed access to every UI string: `context.l10n.booksTitle`.
class AppLocalizations {
  const AppLocalizations(this.language);

  final AppLanguage language;

  static const AppLocalizationsDelegate delegate = AppLocalizationsDelegate();

  static AppLocalizations of(BuildContext context) {
    final AppLocalizations? instance =
        Localizations.of<AppLocalizations>(context, AppLocalizations);
    // Fallback keeps tests and edge cases (widget built before localisations are
    // ready) alive instead of throwing a null error.
    return instance ?? const AppLocalizations(AppLanguage.english);
  }

  /// Column order inside [_table]: 0 = English, 1 = Sinhala, 2 = Tamil.
  static int _column(AppLanguage language) {
    switch (language) {
      case AppLanguage.english:
        return 0;
      case AppLanguage.sinhala:
        return 1;
      case AppLanguage.tamil:
        return 2;
    }
  }

  String _v(String key) {
    final List<String>? row = _table[key];
    if (row == null) return key;
    final int index = _column(language);
    final String value = index < row.length ? row[index] : '';
    // Missing translation -> fall back to English so we never show a raw key.
    return value.isEmpty ? row.first : value;
  }

  /// key -> [English, Sinhala, Tamil]
  static const Map<String, List<String>> _table = <String, List<String>>{
    'splash_loading': <String>['Preparing your library…', 'ඔබේ පුස්තකාලය සූදානම් වෙමින්…', 'உங்கள் நூலகம் தயாராகிறது…'],
    'nav_home': <String>['Home', 'මුල් පිටුව', 'முகப்பு'],
    'nav_books': <String>['Books', 'පොත්', 'பாடநூல்கள்'],
    'nav_papers': <String>['Papers', 'ප්‍රශ්න පත්‍ර', 'வினாத்தாள்கள்'],
    'nav_settings': <String>['Settings', 'සැකසුම්', 'அமைப்புகள்'],
    'home_search_hint': <String>['Search books, papers, subjects…', 'පොත්, ප්‍රශ්න පත්‍ර, විෂයයන් සොයන්න…', 'நூல்கள், வினாத்தாள்கள், பாடங்களைத் தேடுங்கள்…'],
    'home_subtitle': <String>['Free books & past papers for every grade', 'සෑම ශ්‍රේණියකටම නොමිලේ පොත් සහ ප්‍රශ්න පත්‍ර', 'எல்லா தரங்களுக்கும் இலவச நூல்கள் & வினாத்தாள்கள்'],
    'home_section_school_books': <String>['School Books', 'පාසල් පොත්', 'பாடசாலை நூல்கள்'],
    'home_section_past_papers': <String>['Past Papers', 'පසුගිය ප්‍රශ්න පත්‍ර', 'கடந்தகால வினாத்தாள்கள்'],
    'home_section_favorites': <String>['Favorites', 'ප්‍රියතම', 'பிடித்தவை'],
    'home_section_downloads': <String>['Downloads', 'බාගැනීම්', 'பதிவிறக்கங்கள்'],
    'home_card_books_sub': <String>['Grade 1 – 13 textbooks', '1 – 13 ශ්‍රේණි පෙළපොත්', 'தரம் 1 – 13 பாடநூல்கள்'],
    'home_card_papers_sub': <String>['O/L, A/L, Grade 5 & term tests', 'සා.පෙළ, උ.පෙළ, සිසුත්ව සහ වාර පරීක්ෂණ', 'சாதாரண தரம், உயர்தரம், தரம் 5 & தவணைப் பரீட்சை'],
    'home_card_favorites_sub': <String>['Your bookmarked items', 'ඔබ සුරැකි අයිතම', 'நீங்கள் சேமித்த உருப்படிகள்'],
    'home_card_downloads_sub': <String>['Read offline, no internet', 'අන්තර්ජාලය නොමැතිව කියවන්න', 'இணையமின்றி படியுங்கள்'],
    'home_recently_added': <String>['Recently added', 'නවතම එකතු කිරීම්', 'சமீபத்தில் சேர்க்கப்பட்டவை'],
    'home_browse_by_grade': <String>['Browse by grade', 'ශ්‍රේණිය අනුව බලන්න', 'தரம் அடிப்படையில் பார்க்க'],
    'home_browse_by_exam': <String>['Browse by exam', 'විභාගය අනුව බලන්න', 'பரீட்சை அடிப்படையில் பார்க்க'],
    'home_stat_books': <String>['Books', 'පොත්', 'நூல்கள்'],
    'home_stat_papers': <String>['Papers', 'පත්‍ර', 'தாள்கள்'],
    'home_stat_offline': <String>['Offline', 'නොබැඳි', 'இணையமற்ற'],
    'home_offline_tip': <String>['Tip: tap the download icon to save a PDF for offline reading.', 'ඉඟිය: නොබැඳිව කියවීමට බාගැනීම් අයිකනය ඔබන්න.', 'குறிப்பு: இணையமின்றி படிக்க பதிவிறக்க ஐகானை தட்டவும்.'],
    'books_title': <String>['School Books', 'පාසල් පොත්', 'பாடசாலை நூல்கள்'],
    'books_filter_grade': <String>['Grade', 'ශ්‍රේණිය', 'தரம்'],
    'books_filter_medium': <String>['Medium', 'මාධ්‍යය', 'மொழி'],
    'books_filter_subject': <String>['Subject', 'විෂය', 'பாடம்'],
    'books_filter_category': <String>['Type', 'වර්ගය', 'வகை'],
    'books_empty': <String>['No books found', 'පොත් හමු නොවිණි', 'நூல்கள் எதுவும் கிடைக்கவில்லை'],
    'books_empty_hint': <String>['Try another grade, medium or subject.', 'වෙනත් ශ්‍රේණියක්, මාධ්‍යයක් හෝ විෂයක් උත්සාහ කරන්න.', 'வேறு தரம், மொழி அல்லது பாடத்தை முயற்சிக்கவும்.'],
    'books_total': <String>['Total books', 'මුළු පොත්', 'மொத்த நூல்கள்'],
    'papers_title': <String>['Past Papers', 'පසුගිය ප්‍රශ්න පත්‍ර', 'கடந்தகால வினாத்தாள்கள்'],
    'papers_tab_ol': <String>['O/L', 'සා.පෙළ', 'சாதாரண தரம்'],
    'papers_tab_al': <String>['A/L', 'උසස් පෙළ', 'உயர்தரம்'],
    'papers_tab_scholarship': <String>['Grade 5 Scholarship', '5 ශ්‍රේණි සිසුත්ව', 'தரம் 5 புலமைப்பரிசில்'],
    'papers_tab_termtest': <String>['Term Tests', 'වාර පරීක්ෂණ', 'தவணைப் பரீட்சை'],
    'papers_filter_year': <String>['Year', 'වර්ෂය', 'ஆண்டு'],
    'papers_filter_paper_type': <String>['Paper type', 'පත්‍ර වර්ගය', 'தாள் வகை'],
    'papers_marking_available': <String>['Marking scheme available', 'පිළිතුරු පත්‍රිකාව ඇත', 'விடைகள் தாள் உள்ளது'],
    'papers_marking_missing': <String>['No marking scheme', 'පිළිතුරු පත්‍රිකාව නැත', 'விடைகள் தாள் இல்லை'],
    'papers_empty': <String>['No past papers found', 'ප්‍රශ්න පත්‍ර හමු නොවිණි', 'வினாத்தாள்கள் எதுவும் கிடைக்கவில்லை'],
    'papers_empty_hint': <String>['Try another year, subject or medium.', 'වෙනත් වර්ෂයක්, විෂයක් හෝ මාධ්‍යයක් උත්සාහ කරන්න.', 'வேறு ஆண்டு, பாடம் அல்லது மொழியை முயற்சிக்கவும்.'],
    'viewer_page_of': <String>['Page {page} of {total}', 'පිටුව {page} / {total}', 'பக்கம் {page} / {total}'],
    'viewer_night_mode': <String>['Night mode', 'රාත්‍රී මාදිලිය', 'இரவு முறை'],
    'viewer_bookmark': <String>['Bookmark page', 'පිටුව සුරකින්න', 'பக்கத்தைச் சேமி'],
    'viewer_bookmarked': <String>['Page bookmarked', 'පිටුව සුරකින ලදි', 'பக்கம் சேமிக்கப்பட்டது'],
    'viewer_bookmark_removed': <String>['Bookmark removed', 'සුරැකීම ඉවත් කළා', 'சேமிப்பு நீக்கப்பட்டது'],
    'viewer_share': <String>['Share link', 'සබැඳිය බෙදාගන්න', 'இணைப்பைப் பங்கிடு'],
    'viewer_download': <String>['Save for offline', 'නොබැඳි සුරකින්න', 'இணையமின்றி சேமி'],
    'viewer_saved_offline': <String>['Saved for offline', 'නොබැඳිව සුරකින ලදි', 'இணையமின்றி சேமிக்கப்பட்டது'],
    'viewer_open_external': <String>['Open in another app', 'වෙනත් යෙදුමකින් විවෘත කරන්න', 'வேறு செயலியில் திற'],
    'viewer_cannot_open': <String>['Unable to open this PDF', 'මෙම PDF විවෘත කළ නොහැක', 'இந்த PDF-ஐ திறக்க முடியவில்லை'],
    'viewer_cannot_open_hint': <String>['The file may be damaged or downloaded incompletely. Delete the download and try again.', 'ගොනුව හානි වී හෝ අසම්පූර්ණ ලෙස බාගෙන තිබිය හැක. බාගැනීම මකා නැවත උත්සාහ කරන්න.', 'கோப்பு சேதமடைந்திருக்கலாம். பதிவிறக்கத்தை நீக்கி மீண்டும் முயற்சிக்கவும்.'],
    'viewer_zoom_in': <String>['Zoom in', 'විශාල කරන්න', 'பெரிதாக்கு'],
    'viewer_zoom_out': <String>['Zoom out', 'කුඩා කරන්න', 'சிறிதாக்கு'],
    'viewer_fit_width': <String>['Fit width', 'පළලට ගැළපෙන්න', 'அகலத்திற்கு பொருத்து'],
    'viewer_share_subject': <String>['EduLanka – {title}', 'EduLanka – {title}', 'EduLanka – {title}'],
    'favorites_title': <String>['Favorites', 'ප්‍රියතම', 'பிடித்தவை'],
    'favorites_empty': <String>['No favorites yet', 'තවම ප්‍රියතම නැත', 'இன்னும் பிடித்தவை இல்லை'],
    'favorites_empty_hint': <String>['Tap the heart icon on any book or paper to save it here.', 'පොතක හෝ පත්‍රයක හදවත් අයිකනය ඔබා මෙහි සුරකින්න.', 'எந்த நூல் அல்லது தாளின் இதய ஐகானையும் தட்டி இங்கே சேமிக்கவும்.'],
    'favorites_removed': <String>['Removed from favorites', 'ප්‍රියතම වලින් ඉවත් කළා', 'பிடித்தவையிலிருந்து நீக்கப்பட்டது'],
    'favorites_added': <String>['Added to favorites', 'ප්‍රියතම වලට එකතු කළා', 'பிடித்தவையில் சேர்க்கப்பட்டது'],
    'favorites_undo': <String>['Undo', 'අහෝසි කරන්න', 'செயலிழக்கச் செய்'],
    'downloads_title': <String>['Downloads', 'බාගැනීම්', 'பதிவிறக்கங்கள்'],
    'downloads_empty': <String>['No downloads yet', 'තවම බාගැනීම් නැත', 'இன்னும் பதிவிறக்கங்கள் இல்லை'],
    'downloads_empty_hint': <String>['Downloaded PDFs appear here and open without internet.', 'බාගත කළ PDF මෙහි දිස්වන අතර අන්තර්ජාලය නොමැතිව විවෘත වේ.', 'பதிவிறக்கிய PDF இங்கே தோன்றும், இணையமின்றி திறக்கும்.'],
    'downloads_storage_used': <String>['Storage used', 'භාවිත සංචිතය', 'பயன்படுத்திய சேமிப்பு'],
    'downloads_delete_title': <String>['Delete download?', 'බාගැනීම මකන්නද?', 'பதிவிறக்கத்தை நீக்கவா?'],
    'downloads_delete_body': <String>['{title} will be removed from this device. You can download it again later.', '{title} මෙම උපාංගයෙන් ඉවත් වේ. පසුව නැවත බාගත හැක.', '{title} இந்த சாதனத்திலிருந்து நீக்கப்படும். பின்னர் மீண்டும் பதிவிறக்கலாம்.'],
    'downloads_deleted': <String>['Download deleted', 'බාගැනීම මකන ලදි', 'பதிவிறக்கம் நீக்கப்பட்டது'],
    'downloads_clear_all': <String>['Delete all downloads', 'සියලු බාගැනීම් මකන්න', 'எல்லா பதிவிறக்கங்களையும் நீக்கு'],
    'downloads_file_missing': <String>['File missing – download again', 'ගොනුව නැත – නැවත බාගන්න', 'கோப்பு இல்லை – மீண்டும் பதிவிறக்கு'],
    'downloads_play_offline': <String>['Plays offline', 'නොබැඳිව කියවිය හැක', 'இணையமின்றி படிக்கலாம்'],
    'settings_title': <String>['Settings', 'සැකසුම්', 'அமைப்புகள்'],
    'settings_appearance': <String>['Appearance', 'පෙනුම', 'தோற்றம்'],
    'settings_theme': <String>['Theme', 'තේමාව', 'தீம்'],
    'settings_theme_system': <String>['System default', 'පද්ධති පෙරනිමිය', 'கணினி இயல்பு'],
    'settings_theme_light': <String>['Light', 'ආලෝකය', 'வெளிர்'],
    'settings_theme_dark': <String>['Dark', 'අඳුරු', 'இருள்'],
    'settings_language': <String>['Language', 'භාෂාව', 'மொழி'],
    'settings_language_sub': <String>['App interface language', 'යෙදුම් අතුරුමුහුණත් භාෂාව', 'செயலி இடைமுக மொழி'],
    'settings_data': <String>['Data & storage', 'දත්ත සහ සංචිතය', 'தரவு & சேமிப்பு'],
    'settings_data_source': <String>['Data source', 'දත්ත මූලාශ්‍රය', 'தரவு மூலம்'],
    'settings_demo_mode': <String>['Offline demo catalogue', 'නොබැඳි නිරූපණ දත්ත', 'இணையமற்ற மாதிரி தரவு'],
    'settings_demo_mode_sub': <String>['Firebase is not configured on this build. Bundled sample data is used, and PDFs open in your browser.', 'මෙම ගොනුවේ Firebase වින්‍යාස කර නැත. ඇතුළත් නියැදි දත්ත භාවිත වන අතර PDF බ්‍රවුසරයේ විවෘත වේ.', 'இந்தக் கட்டமைப்பில் Firebase அமைக்கப்படவில்லை. மாதிரித் தரவு பயன்படுத்தப்படும்.'],
    'settings_firebase_connected': <String>['Firebase connected', 'Firebase සම්බන්ධයි', 'Firebase இணைக்கப்பட்டது'],
    'settings_clear_cache': <String>['Clear image cache', 'රූප හැඹිලිය මකන්න', 'பட தற்காலிக சேமிப்பை அழி'],
    'settings_clear_cache_sub': <String>['Cached book covers and thumbnails', 'හැඹිලිගත පොත් කවර සහ සිඟිති රූ', 'சேமிக்கப்பட்ட நூல் முகப்புகள்'],
    'settings_cache_cleared': <String>['Cache cleared', 'හැඹිලිය මකන ලදි', 'தற்காலிக சேமிப்பு அழிக்கப்பட்டது'],
    'settings_clear_search_history': <String>['Clear search history', 'සෙවුම් ඉතිහාසය මකන්න', 'தேடல் வரலாற்றை அழி'],
    'settings_clear_data': <String>['Reset app data', 'යෙදුම් දත්ත යළි පිහිටුවන්න', 'செயலி தரவை மீட்டமை'],
    'settings_clear_data_body': <String>['Favorites, bookmarks and search history on this device will be erased. Downloads are kept.', 'ප්‍රියතම, සුරැකි සහ සෙවුම් ඉතිහාසය මැකේ. බාගැනීම් රැඳේ.', 'பிடித்தவை, சேமிப்புகள், தேடல் வரலாறு அழிக்கப்படும். பதிவிறக்கங்கள் இருக்கும்.'],
    'settings_data_reset': <String>['App data reset', 'යෙදුම් දත්ත යළි පිහිටුවන ලදි', 'செயலி தரவு மீட்டமைக்கப்பட்டது'],
    'settings_about': <String>['About', 'පිළිබඳව', 'பற்றி'],
    'settings_about_sub': <String>['Free, ad-free and open source – built for Sri Lankan students.', 'නොමිලේ, දැන්වීම් රහිත, විවෘත මූලාශ්‍ර – ශ්‍රී ලාංකික සිසුන් සඳහා.', 'இலவசம், விளம்பரமற்றது, திறந்த மூலம் – இலங்கை மாணவர்களுக்காக.'],
    'settings_version': <String>['Version', 'අනුවාදය', 'பதிப்பு'],
    'settings_privacy_policy': <String>['Privacy policy', 'රහස්‍යතා ප්‍රතිපත්තිය', 'தனியுரிமைக் கொள்கை'],
    'settings_licenses': <String>['Open source licenses', 'විවෘත මූලාශ්‍ර බලපත්‍ර', 'திறந்த மூல உரிமங்கள்'],
    'settings_source_code': <String>['Source code', 'මූල කේතය', 'மூல குறியீடு'],
    'settings_report_problem': <String>['Report a problem', 'ගැටලුවක් දන්වන්න', 'சிக்கலைப் புகாரளி'],
    'settings_rate_app': <String>['Rate this app', 'යෙදුම ඇගයන්න', 'செயலியை மதிப்பிடு'],
    'settings_refresh_data': <String>['Refresh catalogue', 'නාමාවලිය යාවත්කාලීන කරන්න', 'பட்டியலைப் புதுப்பி'],
    'settings_refreshed': <String>['Catalogue refreshed', 'නාමාවලිය යාවත්කාලීන විය', 'பட்டியல் புதுப்பிக்கப்பட்டது'],
    'search_title': <String>['Search', 'සොයන්න', 'தேடு'],
    'search_hint': <String>['Book name, subject, grade…', 'පොතේ නම, විෂය, ශ්‍රේණිය…', 'நூல் பெயர், பாடம், தரம்…'],
    'search_recent': <String>['Recent searches', 'මෑත සෙවුම්', 'சமீபத்திய தேடல்கள்'],
    'search_clear_recent': <String>['Clear', 'මකන්න', 'அழி'],
    'search_start_typing': <String>['Type to search the whole catalogue', 'සම්පූර්ණ නාමාවලිය සොයන්න ලියන්න', 'முழு பட்டியலையும் தேட தட்டச்சு செய்யுங்கள்'],
    'search_filter_all': <String>['All', 'සියල්ල', 'அனைத்தும்'],
    'search_filter_books': <String>['Books', 'පොත්', 'நூல்கள்'],
    'search_filter_papers': <String>['Papers', 'පත්‍ර', 'தாள்கள்'],
    'search_no_results': <String>['Nothing found for “{query}”', '“{query}” සඳහා කිසිවක් නොමැත', '“{query}” க்கு எதுவும் கிடைக்கவில்லை'],
    'search_no_results_hint': <String>['Check the spelling or search in another language.', 'අක්ෂර වින්‍යාසය පරීක්ෂා කරන්න හෝ වෙනත් භාෂාවකින් සොයන්න.', 'எழுத்துப்பிழையை சரிபார்க்கவும் அல்லது வேறு மொழியில் தேடவும்.'],
    'search_suggestions': <String>['Popular searches', 'ජනප්‍රිය සෙවුම්', 'பிரபல தேடல்கள்'],
    'error_network': <String>['No internet connection', 'අන්තර්ජාල සම්බන්ධතාවක් නැත', 'இணைய இணைப்பு இல்லை'],
    'error_network_hint': <String>['Check your data or Wi-Fi and try again. Items you downloaded earlier still work offline.', 'දත්ත හෝ Wi-Fi පරීක්ෂා කර නැවත උත්සාහ කරන්න. කලින් බාගත කළ අයිතම නොබැඳිව ක්‍රියා කරයි.', 'தரவு அல்லது Wi-Fi சரிபார்த்து மீண்டும் முயற்சிக்கவும். முன்பு பதிவிறக்கியவை இணையமின்றி வேலை செய்யும்.'],
    'error_not_found': <String>['Not found', 'හමු නොවිණි', 'கிடைக்கவில்லை'],
    'error_not_found_hint': <String>['This item may have been removed from the catalogue.', 'මෙම අයිතමය නාමාවලියෙන් ඉවත් කර තිබිය හැක.', 'இந்த உருப்படி பட்டியலிலிருந்து நீக்கப்பட்டிருக்கலாம்.'],
    'error_permission': <String>['Access denied', 'ප්‍රවේශය ප්‍රතික්ෂේප විය', 'அணுகல் மறுக்கப்பட்டது'],
    'error_permission_hint': <String>['Firestore security rules blocked this request. Check the rules in the admin setup guide.', 'Firestore ආරක්ෂණ නීති මෙම ඉල්ලීම වැළැක්වීය. ඇඩ්මින් මාර්ගෝපදේශය බලන්න.', 'Firestore விதிகள் இந்தக் கோரிக்கையைத் தடுத்தது.'],
    'error_storage': <String>['Not enough storage', 'සංචිතය ප්‍රමාණවත් නැත', 'சேமிப்பு போதவில்லை'],
    'error_storage_hint': <String>['Free up space on your device and download again.', 'උපාංගයේ ඉඩ නිදහස් කර නැවත බාගන්න.', 'சாதனத்தில் இடம் காலி செய்து மீண்டும் பதிவிறக்கவும்.'],
    'error_corrupt': <String>['File could not be read', 'ගොනුව කියවිය නොහැක', 'கோப்பை படிக்க முடியவில்லை'],
    'error_corrupt_hint': <String>['Delete the download and fetch the file again.', 'බාගැනීම මකා ගොනුව නැවත ලබාගන්න.', 'பதிவிறக்கத்தை நீக்கி மீண்டும் பெறவும்.'],
    'error_unknown': <String>['Something went wrong', 'යම් දෝෂයක් සිදු විය', 'ஏதோ தவறு நடந்தது'],
    'error_unknown_hint': <String>['Please try again. If it keeps failing, report the problem from Settings.', 'නැවත උත්සාහ කරන්න. නැවත නැවතත් අසාර්ථක නම් සැකසුම් වලින් දන්වන්න.', 'மீண்டும் முயற்சிக்கவும். தொடர்ந்து தோல்வியடைந்தால் புகாரளிக்கவும்.'],
    'error_missing_index': <String>['Catalogue index missing', 'නාමාවලි සූචිය අස්ථානගතයි', 'பட்டியல் குறியீடு இல்லை'],
    'error_missing_index_hint': <String>['The admin needs to create a Firestore index for this filter combination. See docs/FIREBASE_SETUP.md.', 'මෙම පෙරහන් සංයෝගය සඳහා Firestore සූචියක් සෑදිය යුතුය. docs/FIREBASE_SETUP.md බලන්න.', 'இந்த வடிகட்டிக்கு Firestore குறியீடு தேவை.'],
    'error_technical': <String>['Technical details', 'තාක්ෂණික විස්තර', 'தொழில்நுட்ப விவரங்கள்'],
    'error_retry': <String>['Try again', 'නැවත උත්සාහ කරන්න', 'மீண்டும் முயற்சி'],
    'common_all': <String>['All', 'සියල්ල', 'அனைத்தும்'],
    'common_filters': <String>['Filters', 'පෙරහන්', 'வடிகட்டிகள்'],
    'common_none': <String>['None', 'කිසිවක් නැත', 'எதுவுமில்லை'],
    'common_clear': <String>['Clear', 'මකන්න', 'அழி'],
    'common_apply': <String>['Apply', 'යොදන්න', 'பயன்படுத்து'],
    'common_reset': <String>['Reset', 'යළි පිහිටුවන්න', 'மீட்டமை'],
    'common_close': <String>['Close', 'වසන්න', 'மூடு'],
    'common_cancel': <String>['Cancel', 'අවලංගු කරන්න', 'ரத்து'],
    'common_delete': <String>['Delete', 'මකන්න', 'நீக்கு'],
    'common_share': <String>['Share', 'බෙදාගන්න', 'பங்கிடு'],
    'common_download': <String>['Download', 'බාගන්න', 'பதிவிறக்கு'],
    'common_downloading': <String>['Downloading…', 'බාගනිමින්…', 'பதிவிறக்குகிறது…'],
    'common_open': <String>['Open', 'විවෘත කරන්න', 'திற'],
    'common_retry': <String>['Retry', 'නැවත', 'மீண்டும்'],
    'common_loading': <String>['Loading…', 'පූරණය වෙමින්…', 'ஏற்றுகிறது…'],
    'common_load_more': <String>['Load more', 'තවත් පූරණය', 'மேலும் ஏற்று'],
    'common_see_all': <String>['See all', 'සියල්ල බලන්න', 'அனைத்தையும் பார்'],
    'common_yes': <String>['Yes', 'ඔව්', 'ஆம்'],
    'common_no': <String>['No', 'නැත', 'இல்லை'],
    'common_ok': <String>['OK', 'හරි', 'சரி'],
    'common_offline': <String>['You are offline', 'ඔබ නොබැඳිව සිටී', 'நீங்கள் இணையமின்றி உள்ளீர்கள்'],
    'common_offline_hint': <String>['Showing saved and downloaded items.', 'සුරැකි සහ බාගත කළ අයිතම පෙන්වයි.', 'சேமித்த மற்றும் பதிவிறக்கியவை காட்டப்படுகின்றன.'],
    'common_online': <String>['Back online', 'නැවත සබැඳි විය', 'மீண்டும் இணைக்கப்பட்டது'],
    'common_new': <String>['New', 'නව', 'புதிய'],
    'common_grade': <String>['Grade', 'ශ්‍රේණිය', 'தரம்'],
    'common_medium': <String>['Medium', 'මාධ්‍යය', 'மொழி'],
    'common_subject': <String>['Subject', 'විෂය', 'பாடம்'],
    'common_year': <String>['Year', 'වර්ෂය', 'ஆண்டு'],
    'common_file_size': <String>['File size', 'ගොනු ප්‍රමාණය', 'கோப்பு அளவு'],
    'common_downloads': <String>['downloads', 'බාගැනීම්', 'பதிவிறக்கங்கள்'],
    'common_book': <String>['Book', 'පොත', 'நூல்'],
    'common_paper': <String>['Paper', 'පත්‍රය', 'தாள்'],
    'common_updated': <String>['Updated', 'යාවත්කාලීන', 'புதுப்பிக்கப்பட்டது'],
    'common_show_more': <String>['Show more', 'තවත් පෙන්වන්න', 'மேலும் காட்டு'],
    'sort_by': <String>['Sort by', 'පෙළගස්වන්න', 'வரிசைப்படுத்து'],
    'sort_newest': <String>['Newest first', 'නවතම මුලින්', 'புதியது முதலில்'],
    'sort_oldest': <String>['Oldest first', 'පැරණිතම මුලින්', 'பழையது முதலில்'],
    'sort_title': <String>['Title (A–Z)', 'නම අනුව (A–Z)', 'தலைப்பு (A–Z)'],
    'sort_downloads': <String>['Most downloaded', 'වැඩිපුරම බාගත', 'அதிகம் பதிவிறக்கியவை'],
    'about_tagline': <String>['Free school books and past papers for every Sri Lankan student.', 'සෑම ශ්‍රී ලාංකික සිසුවෙකුටම නොමිලේ පාසල් පොත් සහ පසුගිය ප්‍රශ්න පත්‍ර.', 'ஒவ்வொரு இலங்கை மாணவருக்கும் இலவச பாடநூல்கள் மற்றும் வினாத்தாள்கள்.'],
    'about_features': <String>['What is inside', 'යෙදුමේ ඇති දේ', 'செயலியில் உள்ளவை'],
    'about_feature_books': <String>['Grade 1–13 textbooks in all three mediums', 'සියලු මාධ්‍යවල 1–13 ශ්‍රේණි පෙළපොත්', 'மூன்று மொழிகளிலும் தரம் 1–13 பாடநூல்கள்'],
    'about_feature_papers': <String>['O/L, A/L, Grade 5 and term test papers with marking schemes', 'පිළිතුරු පත්‍රිකා සමඟ සා.පෙළ, උ.පෙළ, 5 ශ්‍රේණිය සහ වාර පරීක්ෂණ', 'விடைகள் தாள்களுடன் சாதாரண தரம், உயர்தரம், தரம் 5, தவணைப் பரீட்சை'],
    'about_feature_offline': <String>['Download any PDF and read it without internet', 'ඕනෑම PDF බාගෙන අන්තර්ජාලය නොමැතිව කියවන්න', 'எந்த PDF-ஐயும் பதிவிறக்கி இணையமின்றி படியுங்கள்'],
    'about_feature_free': <String>['No ads, no in-app purchases, no sign-up', 'දැන්වීම් නැත, ගෙවීම් නැත, ලියාපදිංචිය නැත', 'விளம்பரம் இல்லை, கட்டணம் இல்லை, பதிவு இல்லை'],
    'about_feature_open': <String>['Open source – anyone can help improve it', 'විවෘත මූලාශ්‍ර – ඕනෑම කෙනෙකුට දායක විය හැක', 'திறந்த மூலம் – யார் வேண்டுமானாலும் உதவலாம்'],
    'about_contribute': <String>['Contribute on GitHub', 'GitHub හි දායක වන්න', 'GitHub இல் பங்களிக்கவும்'],
    'privacy_intro': <String>['EduLanka is built so that no personal information is needed to use it. There are no accounts, no ads and no trackers.', 'EduLanka භාවිතයට කිසිදු පෞද්ගලික තොරතුරක් අවශ්‍ය නොවේ. ගිණුම්, දැන්වීම් හෝ නිරීක්ෂක නොමැත.', 'EduLanka-ஐ பயன்படுத்த தனிப்பட்ட தகவல் எதுவும் தேவையில்லை. கணக்குகள், விளம்பரங்கள், கண்காணிப்புகள் இல்லை.'],
    'privacy_local_title': <String>['What stays on your phone', 'ඔබේ දුරකථනයේ රැඳෙන දේ', 'உங்கள் மொபைலில் இருக்கும் தரவு'],
    'privacy_local_body': <String>['Favorites, bookmarked pages, download records, search history and your theme/language choice are stored only on this device. Clearing app data or uninstalling removes them permanently.', 'ප්‍රියතම, සුරැකි පිටු, බාගැනීම්, සෙවුම් ඉතිහාසය සහ තේමා/භාෂා තේරීම රැඳෙන්නේ මෙම උපාංගයේ පමණි. දත්ත මකා දැමීමෙන් හෝ යෙදුම ඉවත් කිරීමෙන් ඒවා ස්ථිරවම ඉවත් වේ.', 'பிடித்தவை, சேமித்த பக்கங்கள், பதிவிறக்கங்கள், தேடல் வரலாறு, தீம்/மொழி தேர்வு இந்த சாதனத்தில் மட்டுமே சேமிக்கப்படும். தரவை அழிக்கும்போது நிரந்தரமாக நீங்கும்.'],
    'privacy_network_title': <String>['What leaves your phone', 'ඔබේ දුරකථනයෙන් යන දේ', 'உங்கள் மொபைலில் இருந்து செல்வது'],
    'privacy_network_body': <String>['Only the PDF and cover downloads you start, and anonymous catalogue reads from Firebase (Firestore/Storage). No identifier, email or phone number is sent, and nothing is used for advertising.', 'ඔබ ආරම්භ කරන PDF සහ කවර බාගැනීම් පමණක්, සහ Firebase වෙතින් නිර්නාමික නාමාවලි කියවීම්. හැඳුනුම්, ඊමේල් හෝ දුරකථන අංක යවන්නේ නැත.', 'நீங்கள் தொடங்கும் PDF மற்றும் முகப்பு பதிவிறக்கங்கள், Firebase-இல் இருந்து அநாமதேய பட்டியல் வாசிப்புகள் மட்டுமே. எந்த அடையாளமும் அனுப்பப்படுவதில்லை.'],
    'privacy_files_title': <String>['Files on your device', 'ඔබේ උපාංගයේ ගොනු', 'உங்கள் சாதனத்தில் உள்ள கோப்புகள்'],
    'privacy_files_body': <String>['Downloaded PDFs are kept in the app\'s private folder and are deleted with the app, or any time from the Downloads screen.', 'බාගත කළ PDF යෙදුමේ පෞද්ගලික ෆෝල්ඩරයේ රැඳෙන අතර යෙදුම ඉවත් කිරීමෙන් හෝ බාගැනීම් තිරයෙන් ඕනෑම විටක මකා දැමිය හැක.', 'பதிவிறக்கிய PDF செயலியின் தனிப்பட்ட கோப்புறையில் இருக்கும்; செயலியை நீக்கும்போது அல்லது பதிவிறக்கங்கள் திரையில் எப்போது வேண்டுமானாலும் நீக்கலாம்.'],
    'privacy_contact_title': <String>['Questions', 'ප්‍රශ්න', 'கேள்விகள்'],
    'privacy_contact_body': <String>['Report anything unclear or broken from Settings → Report a problem. This policy is short because the app genuinely collects nothing.', 'පැහැදිලි නොවන හෝ දෝෂ සහිත දේ සැකසුම් → ගැටලුවක් දන්වන්න මගින් දන්වන්න. යෙදුම කිසිවක් එක් නොකරන නිසා මෙම ප්‍රතිපත්තිය කෙටිය.', 'தெளிவற்ற அல்லது பிழையானவற்றை அமைப்புகள் → சிக்கலைப் புகாரளி வழியாக தெரிவிக்கவும்.'],
    'privacy_updated': <String>['Last updated', 'අවසන් යාවත්කාලීන', 'கடைசி புதுப்பிப்பு'],
  };

  // ------------------------------------------------------------------ splash
  String get splashLoading => _v('splash_loading');
  String get navHome => _v('nav_home');
  String get navBooks => _v('nav_books');
  String get navPapers => _v('nav_papers');
  String get navSettings => _v('nav_settings');
  String get homeSearchHint => _v('home_search_hint');
  String get homeSubtitle => _v('home_subtitle');
  String get homeSectionSchoolBooks => _v('home_section_school_books');
  String get homeSectionPastPapers => _v('home_section_past_papers');
  String get homeSectionFavorites => _v('home_section_favorites');
  String get homeSectionDownloads => _v('home_section_downloads');
  String get homeCardBooksSub => _v('home_card_books_sub');
  String get homeCardPapersSub => _v('home_card_papers_sub');
  String get homeCardFavoritesSub => _v('home_card_favorites_sub');
  String get homeCardDownloadsSub => _v('home_card_downloads_sub');
  String get homeRecentlyAdded => _v('home_recently_added');
  String get homeBrowseByGrade => _v('home_browse_by_grade');
  String get homeBrowseByExam => _v('home_browse_by_exam');
  String get homeStatBooks => _v('home_stat_books');
  String get homeStatPapers => _v('home_stat_papers');
  String get homeStatOffline => _v('home_stat_offline');
  String get homeOfflineTip => _v('home_offline_tip');
  String get booksTitle => _v('books_title');
  String get booksFilterGrade => _v('books_filter_grade');
  String get booksFilterMedium => _v('books_filter_medium');
  String get booksFilterSubject => _v('books_filter_subject');
  String get booksFilterCategory => _v('books_filter_category');
  String get booksEmpty => _v('books_empty');
  String get booksEmptyHint => _v('books_empty_hint');
  String get booksTotal => _v('books_total');
  String get papersTitle => _v('papers_title');
  String get papersTabOl => _v('papers_tab_ol');
  String get papersTabAl => _v('papers_tab_al');
  String get papersTabScholarship => _v('papers_tab_scholarship');
  String get papersTabTermtest => _v('papers_tab_termtest');
  String get papersFilterYear => _v('papers_filter_year');
  String get papersFilterPaperType => _v('papers_filter_paper_type');
  String get papersMarkingAvailable => _v('papers_marking_available');
  String get papersMarkingMissing => _v('papers_marking_missing');
  String get papersEmpty => _v('papers_empty');
  String get papersEmptyHint => _v('papers_empty_hint');
  String get viewerNightMode => _v('viewer_night_mode');
  String get viewerBookmark => _v('viewer_bookmark');
  String get viewerBookmarked => _v('viewer_bookmarked');
  String get viewerBookmarkRemoved => _v('viewer_bookmark_removed');
  String get viewerShare => _v('viewer_share');
  String get viewerDownload => _v('viewer_download');
  String get viewerSavedOffline => _v('viewer_saved_offline');
  String get viewerOpenExternal => _v('viewer_open_external');
  String get viewerCannotOpen => _v('viewer_cannot_open');
  String get viewerCannotOpenHint => _v('viewer_cannot_open_hint');
  String get viewerZoomIn => _v('viewer_zoom_in');
  String get viewerZoomOut => _v('viewer_zoom_out');
  String get viewerFitWidth => _v('viewer_fit_width');
  String get favoritesTitle => _v('favorites_title');
  String get favoritesEmpty => _v('favorites_empty');
  String get favoritesEmptyHint => _v('favorites_empty_hint');
  String get favoritesRemoved => _v('favorites_removed');
  String get favoritesAdded => _v('favorites_added');
  String get favoritesUndo => _v('favorites_undo');
  String get downloadsTitle => _v('downloads_title');
  String get downloadsEmpty => _v('downloads_empty');
  String get downloadsEmptyHint => _v('downloads_empty_hint');
  String get downloadsStorageUsed => _v('downloads_storage_used');
  String get downloadsDeleteTitle => _v('downloads_delete_title');
  String get downloadsDeleted => _v('downloads_deleted');
  String get downloadsClearAll => _v('downloads_clear_all');
  String get downloadsFileMissing => _v('downloads_file_missing');
  String get downloadsPlayOffline => _v('downloads_play_offline');
  String get settingsTitle => _v('settings_title');
  String get settingsAppearance => _v('settings_appearance');
  String get settingsTheme => _v('settings_theme');
  String get settingsThemeSystem => _v('settings_theme_system');
  String get settingsThemeLight => _v('settings_theme_light');
  String get settingsThemeDark => _v('settings_theme_dark');
  String get settingsLanguage => _v('settings_language');
  String get settingsLanguageSub => _v('settings_language_sub');
  String get settingsData => _v('settings_data');
  String get settingsDataSource => _v('settings_data_source');
  String get settingsDemoMode => _v('settings_demo_mode');
  String get settingsDemoModeSub => _v('settings_demo_mode_sub');
  String get settingsFirebaseConnected => _v('settings_firebase_connected');
  String get settingsClearCache => _v('settings_clear_cache');
  String get settingsClearCacheSub => _v('settings_clear_cache_sub');
  String get settingsCacheCleared => _v('settings_cache_cleared');
  String get settingsClearSearchHistory => _v('settings_clear_search_history');
  String get settingsClearData => _v('settings_clear_data');
  String get settingsClearDataBody => _v('settings_clear_data_body');
  String get settingsDataReset => _v('settings_data_reset');
  String get settingsAbout => _v('settings_about');
  String get settingsAboutSub => _v('settings_about_sub');
  String get settingsVersion => _v('settings_version');
  String get settingsPrivacyPolicy => _v('settings_privacy_policy');
  String get settingsLicenses => _v('settings_licenses');
  String get settingsSourceCode => _v('settings_source_code');
  String get settingsReportProblem => _v('settings_report_problem');
  String get settingsRateApp => _v('settings_rate_app');
  String get settingsRefreshData => _v('settings_refresh_data');
  String get settingsRefreshed => _v('settings_refreshed');
  String get searchTitle => _v('search_title');
  String get searchHint => _v('search_hint');
  String get searchRecent => _v('search_recent');
  String get searchClearRecent => _v('search_clear_recent');
  String get searchStartTyping => _v('search_start_typing');
  String get searchFilterAll => _v('search_filter_all');
  String get searchFilterBooks => _v('search_filter_books');
  String get searchFilterPapers => _v('search_filter_papers');
  String get searchNoResultsHint => _v('search_no_results_hint');
  String get searchSuggestions => _v('search_suggestions');
  String get errorNetwork => _v('error_network');
  String get errorNetworkHint => _v('error_network_hint');
  String get errorNotFound => _v('error_not_found');
  String get errorNotFoundHint => _v('error_not_found_hint');
  String get errorPermission => _v('error_permission');
  String get errorPermissionHint => _v('error_permission_hint');
  String get errorStorage => _v('error_storage');
  String get errorStorageHint => _v('error_storage_hint');
  String get errorCorrupt => _v('error_corrupt');
  String get errorCorruptHint => _v('error_corrupt_hint');
  String get errorUnknown => _v('error_unknown');
  String get errorUnknownHint => _v('error_unknown_hint');
  String get errorMissingIndex => _v('error_missing_index');
  String get errorMissingIndexHint => _v('error_missing_index_hint');
  String get errorTechnical => _v('error_technical');
  String get errorRetry => _v('error_retry');
  String get commonAll => _v('common_all');
  String get commonFilters => _v('common_filters');
  String get commonNone => _v('common_none');
  String get commonClear => _v('common_clear');
  String get commonApply => _v('common_apply');
  String get commonReset => _v('common_reset');
  String get commonClose => _v('common_close');
  String get commonCancel => _v('common_cancel');
  String get commonDelete => _v('common_delete');
  String get commonShare => _v('common_share');
  String get commonDownload => _v('common_download');
  String get commonDownloading => _v('common_downloading');
  String get commonOpen => _v('common_open');
  String get commonRetry => _v('common_retry');
  String get commonLoading => _v('common_loading');
  String get commonLoadMore => _v('common_load_more');
  String get commonSeeAll => _v('common_see_all');
  String get commonYes => _v('common_yes');
  String get commonNo => _v('common_no');
  String get commonOk => _v('common_ok');
  String get commonOffline => _v('common_offline');
  String get commonOfflineHint => _v('common_offline_hint');
  String get commonOnline => _v('common_online');
  String get commonNew => _v('common_new');
  String get commonGrade => _v('common_grade');
  String get commonMedium => _v('common_medium');
  String get commonSubject => _v('common_subject');
  String get commonYear => _v('common_year');
  String get commonFileSize => _v('common_file_size');
  String get commonDownloads => _v('common_downloads');
  String get commonBook => _v('common_book');
  String get commonPaper => _v('common_paper');
  String get commonUpdated => _v('common_updated');
  String get commonShowMore => _v('common_show_more');

  String get sortBy => _v('sort_by');
  String get sortNewest => _v('sort_newest');
  String get sortOldest => _v('sort_oldest');
  String get sortTitle => _v('sort_title');
  String get sortDownloads => _v('sort_downloads');

  String get aboutTagline => _v('about_tagline');
  String get aboutFeatures => _v('about_features');
  String get aboutFeatureBooks => _v('about_feature_books');
  String get aboutFeaturePapers => _v('about_feature_papers');
  String get aboutFeatureOffline => _v('about_feature_offline');
  String get aboutFeatureFree => _v('about_feature_free');
  String get aboutFeatureOpen => _v('about_feature_open');
  String get aboutContribute => _v('about_contribute');
  String get privacyIntro => _v('privacy_intro');
  String get privacyLocalTitle => _v('privacy_local_title');
  String get privacyLocalBody => _v('privacy_local_body');
  String get privacyNetworkTitle => _v('privacy_network_title');
  String get privacyNetworkBody => _v('privacy_network_body');
  String get privacyFilesTitle => _v('privacy_files_title');
  String get privacyFilesBody => _v('privacy_files_body');
  String get privacyContactTitle => _v('privacy_contact_title');
  String get privacyContactBody => _v('privacy_contact_body');
  String get privacyUpdated => _v('privacy_updated');

  // -------------------------------------------------------- parameterised text
  /// "Page 3 of 20" / "පිටුව 3 / 20" / "பக்கம் 3 / 20"
  String viewerPageOf(int page, int total) => _v('viewer_page_of')
      .replaceAll('{page}', '$page')
      .replaceAll('{total}', '$total');

  /// Share sheet subject: "EduLanka - 2023 O/L Mathematics Paper 1".
  String shareSubject(String title) =>
      _v('viewer_share_subject').replaceAll('{title}', title);

  /// Delete-download confirmation body.
  String downloadsDeleteBody(String title) =>
      _v('downloads_delete_body').replaceAll('{title}', title);

  /// Empty search result title.
  String searchNoResults(String query) =>
      _v('search_no_results').replaceAll('{query}', query);

  /// "Grade 12" / "12 ශ්රේණිය" / "தரம் 12".
  String gradeLabel(int grade) {
    switch (language) {
      case AppLanguage.sinhala:
        return '$grade ශ්රේණිය';
      case AppLanguage.tamil:
        return 'தரம் $grade';
      case AppLanguage.english:
        return 'Grade $grade';
    }
  }

  /// "Grade 1 - 5" range label used by chip groups.
  String gradeRangeLabel(int first, int last) =>
      '${gradeLabel(first)} – ${gradeLabel(last)}';

  /// "24 books" / "පොත් 24" / "24 நூல்கள்".
  String itemsCount(int count) {
    switch (language) {
      case AppLanguage.sinhala:
        return 'අයිතම $count';
      case AppLanguage.tamil:
        return '$count உருப்படிகள்';
      case AppLanguage.english:
        return count == 1 ? '1 item' : '$count items';
    }
  }

  /// "1,500 downloads".
  String downloadsCount(String formattedCount) {
    switch (language) {
      case AppLanguage.sinhala:
        return 'බාගැනීම් $formattedCount';
      case AppLanguage.tamil:
        return '$formattedCount பதிவிறக்கங்கள்';
      case AppLanguage.english:
        return '$formattedCount downloads';
    }
  }

  /// Greeting used by the home header, based on the device clock.
  String greetingForHour(int hour) {
    final bool morning = hour >= 5 && hour < 12;
    final bool afternoon = hour >= 12 && hour < 17;
    switch (language) {
      case AppLanguage.sinhala:
        if (morning) return 'සුබ උදෑසනක්';
        if (afternoon) return 'සුබ දහවලක්';
        return 'සුබ සැන්දෑවක්';
      case AppLanguage.tamil:
        if (morning) return 'காலை வணக்கம்';
        if (afternoon) return 'மதிய வணக்கம்';
        return 'மாலை வணக்கம்';
      case AppLanguage.english:
        if (morning) return 'Good morning';
        if (afternoon) return 'Good afternoon';
        return 'Good evening';
    }
  }
}

/// Wires [AppLocalizations] into `MaterialApp.localizationsDelegates`.
class AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => AppLanguage.codes.contains(locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) =>
      Future<AppLocalizations>.value(AppLocalizations(AppLanguage.fromLocale(locale)));

  @override
  bool shouldReload(AppLocalizationsDelegate old) => false;
}

/// Shorthand used everywhere in the UI: `context.l10n.booksTitle`.
extension AppLocalizationsX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}

