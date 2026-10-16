import '../models/catalog_item.dart';
import 'local_store.dart';

/// Favorites ("bookmark a book/paper") persisted on the device.
///
/// Local-only by design: the app works without an account, so favourites never
/// leave the phone and never need a Firestore write (which also keeps the app
/// inside the free Spark quota).
class FavoritesStore {
  FavoritesStore(this._local);

  final LocalStore _local;

  /// Newest first.
  List<CatalogItem> load() {
    final List<CatalogItem> items = <CatalogItem>[];
    for (final Map<String, dynamic> json in _local.getMapList(LocalKeys.favorites)) {
      final CatalogItem? item = catalogItemFromJson(json);
      if (item != null) items.add(item);
    }
    return items;
  }

  /// Stable key, see [itemKey].
  static String keyOf(CatalogItem item) => itemKey(item);

  Future<void> save(List<CatalogItem> items) => _local.setMapList(
        LocalKeys.favorites,
        items.map((CatalogItem item) => item.toJson()).toList(growable: false),
      );
}
