import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Index of the currently selected bottom-navigation tab.
class SelectedTabController extends Notifier<int> {
  @override
  int build() => 0;

  void select(int index) => state = index;
}

final NotifierProvider<SelectedTabController, int> selectedTabProvider =
    NotifierProvider<SelectedTabController, int>(SelectedTabController.new);

/// Tab indices, referenced by name so navigation helpers stay readable.
class AppTab {
  AppTab._();

  static const int home = 0;
  static const int books = 1;
  static const int papers = 2;
  static const int settings = 3;
}

/// True while the PDF viewer asks for a night-mode overlay (kept separate from
/// the app-wide theme so a user can read a PDF dark without changing the app).
class ViewerNightModeController extends Notifier<bool> {
  @override
  bool build() => false;

  void toggle() => state = !state;

  void set(bool value) => state = value;
}

final NotifierProvider<ViewerNightModeController, bool> viewerNightModeProvider =
    NotifierProvider<ViewerNightModeController, bool>(ViewerNightModeController.new);
