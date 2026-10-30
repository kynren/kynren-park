// Bundle shape: mirrors GET /api/sync/bundle (see apps/mobile/lib/sync.tsx).
import 'walk_grid.dart';

typedef Json = Map<String, dynamic>;

/// A text field, with an empty string treated as missing (the admin saves a cleared field as '').
String? _s(Object? v) {
  final s = v as String?;
  return (s == null || s.isEmpty) ? null : s;
}
List<String> _strs(Object? v) => (v as List?)?.map((e) => e as String).where((e) => e.isNotEmpty).toList() ?? const [];
List<T> _list<T>(Object? v, T Function(Json) f) => (v as List?)?.map((e) => f(e as Json)).toList() ?? <T>[];
double? _d(Object? v) => (v as num?)?.toDouble();

class Poi {
  final String id, type, name;
  final String? description, mapZone, color, icon, image, heroImage, openingHours;
  final double lat, lng;
  final List<String> images;
  Poi.fromJson(Json j)
      : id = j['id'] as String,
        type = j['type'] as String,
        name = j['name'] as String,
        description = _s(j['description']),
        mapZone = _s(j['mapZone']),
        color = _s(j['color']),
        icon = _s(j['icon']),
        image = _s(j['image']),
        heroImage = _s(j['heroImage']),
        openingHours = _s(j['openingHours']),
        lat = _d(j['lat']) ?? 0,
        lng = _d(j['lng']) ?? 0,
        images = _strs(j['images']);
}

class MapConfig {
  final String markerColor, markerStyle;
  final String? mapImageUrl, popupAnimation;
  final double? initialZoom, maxZoom, centerLat, centerLng;
  MapConfig.fromJson(Json j)
      : markerColor = _s(j['markerColor']) ?? '#8a1f31',
        markerStyle = _s(j['markerStyle']) ?? 'pin',
        mapImageUrl = _s(j['mapImageUrl']),
        popupAnimation = _s(j['popupAnimation']),
        initialZoom = _d(j['initialZoom']),
        maxZoom = _d(j['maxZoom']),
        centerLat = _d(j['centerLat']),
        centerLng = _d(j['centerLng']);
}

class ParkMap {
  final String id, name;
  final String? imageUrl, bgColor;
  final bool isDefault;

  /// The footpaths and roads the admin's map editor found on the picture; directions follow them. Null when none were found.
  final WalkGrid? walkGrid;
  ParkMap.fromJson(Json j)
      : id = j['id'] as String,
        name = j['name'] as String,
        imageUrl = _s(j['imageUrl']),
        bgColor = _s(j['bgColor']),
        isDefault = j['isDefault'] == true,
        walkGrid = WalkGrid.fromJson(j['walkGrid']);
}

class Branding {
  final String appName, tagline, primary, accent;
  final String font;
  final String? logoUrl, iconUrl, splashType, splashMediaUrl, seasonOpens;
  Branding.fromJson(Json j)
      : appName = _s(j['appName']) ?? 'Kynren',
        tagline = _s(j['tagline']) ?? '',
        primary = _s(j['primary']) ?? '',
        accent = _s(j['accent']) ?? '',
        font = _s(j['font']) ?? 'system',
        logoUrl = _s(j['logoUrl']),
        iconUrl = _s(j['iconUrl']),
        splashType = _s(j['splashType']),
        splashMediaUrl = _s(j['splashMediaUrl']),
        seasonOpens = _s(j['seasonOpens']);
}

class Attraction {
  final String id, slug, name, category, synopsis;
  final String? tagline, heroImage, poiId, sensoryNotes;
  final int durationMins, sortOrder;
  final List<String> images;
  final bool wheelchairAccessible, hasAudioDescription, hasCaptioning, hasBSL;
  Attraction.fromJson(Json j)
      : id = j['id'] as String,
        slug = j['slug'] as String,
        name = j['name'] as String,
        category = _s(j['category']) ?? 'OTHER',
        synopsis = _s(j['synopsis']) ?? '',
        tagline = _s(j['tagline']),
        heroImage = _s(j['heroImage']),
        poiId = _s(j['poiId']),
        sensoryNotes = _s(j['sensoryNotes']),
        durationMins = (j['durationMins'] as num?)?.toInt() ?? 0,
        sortOrder = (j['sortOrder'] as num?)?.toInt() ?? 0,
        images = _strs(j['images']),
        wheelchairAccessible = j['wheelchairAccessible'] == true,
        hasAudioDescription = j['hasAudioDescription'] == true,
        hasCaptioning = j['hasCaptioning'] == true,
        hasBSL = j['hasBSL'] == true;
}

class Session {
  final String id, attractionId, startTime, endTime, status;
  final String? revisedStart, note;
  final String attractionName, attractionSlug, attractionCategory;
  Session({
    required this.id,
    required this.attractionId,
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.revisedStart,
    required this.note,
    required this.attractionName,
    required this.attractionSlug,
    required this.attractionCategory,
  });
  factory Session.fromJson(Json j) {
    final a = (j['attraction'] as Json?) ?? const {};
    return Session(
      id: j['id'] as String,
      attractionId: j['attractionId'] as String,
      startTime: j['startTime'] as String,
      endTime: j['endTime'] as String,
      status: _s(j['status']) ?? 'SCHEDULED',
      revisedStart: _s(j['revisedStart']),
      note: _s(j['note']),
      attractionName: _s(a['name']) ?? '',
      attractionSlug: _s(a['slug']) ?? '',
      attractionCategory: _s(a['category']) ?? 'OTHER',
    );
  }
  Session patched({required String status, String? revisedStart, String? note}) => Session(
        id: id,
        attractionId: attractionId,
        startTime: startTime,
        endTime: endTime,
        status: status,
        revisedStart: revisedStart,
        note: note,
        attractionName: attractionName,
        attractionSlug: attractionSlug,
        attractionCategory: attractionCategory,
      );
  Json toJson() => {
        'id': id,
        'attractionId': attractionId,
        'startTime': startTime,
        'endTime': endTime,
        'status': status,
        'revisedStart': revisedStart,
        'note': note,
        'attraction': {'id': attractionId, 'slug': attractionSlug, 'name': attractionName, 'category': attractionCategory},
      };
}

class MenuItem {
  final String id, name;
  final String? description;
  final int priceCents;
  final List<String> dietaryTags;
  MenuItem.fromJson(Json j)
      : id = j['id'] as String,
        name = j['name'] as String,
        description = _s(j['description']),
        priceCents = (j['priceCents'] as num?)?.toInt() ?? 0,
        dietaryTags = _strs(j['dietaryTags']);
}

class Restaurant {
  final String id, slug, name;
  final String? cuisine, description, openingHours, heroImage, poiId;
  final bool? clickCollect;
  final List<String> images;
  final List<MenuItem> menuItems;
  Restaurant.fromJson(Json j)
      : id = j['id'] as String,
        slug = j['slug'] as String,
        name = j['name'] as String,
        cuisine = _s(j['cuisine']),
        description = _s(j['description']),
        openingHours = _s(j['openingHours']),
        heroImage = _s(j['heroImage']),
        poiId = _s(j['poiId']),
        clickCollect = j['clickCollect'] as bool?,
        images = _strs(j['images']),
        menuItems = _list(j['menuItems'], MenuItem.fromJson);
}

class ShopItem {
  final String id, name;
  final String? description, image;
  final int priceCents;

  /// False when the shop has marked it out of stock.
  final bool available;

  /// What tells this price from the product's others ("Adult", "Child"), when the shop lists one product at several prices.
  final String? variant;
  ShopItem.fromJson(Json j)
      : id = j['id'] as String,
        name = j['name'] as String,
        description = _s(j['description']),
        image = _s(j['image']),
        priceCents = (j['priceCents'] as num?)?.toInt() ?? 0,
        available = j['available'] as bool? ?? true,
        variant = _variantName(j['variants']);
}

/// The first variant's name, from a list like [{"name": "Adult"}]. Anything else (the data also holds an empty {}) is none.
String? _variantName(Object? v) {
  if (v is! List || v.isEmpty || v.first is! Map) return null;
  return _s((v.first as Map)['name']);
}

class Shop {
  final String id, slug, name;
  final String? category, description, openingHours, heroImage, poiId;
  final List<String> images;
  final List<ShopItem> items;
  Shop.fromJson(Json j)
      : id = j['id'] as String,
        slug = j['slug'] as String,
        name = j['name'] as String,
        category = _s(j['category']),
        description = _s(j['description']),
        openingHours = _s(j['openingHours']),
        heroImage = _s(j['heroImage']),
        poiId = _s(j['poiId']),
        images = _strs(j['images']),
        items = _list(j['items'], ShopItem.fromJson);
}

class ContentPage {
  final String id, slug, title, body;
  final String? category;
  ContentPage.fromJson(Json j)
      : id = j['id'] as String,
        slug = j['slug'] as String,
        title = j['title'] as String,
        body = _s(j['body']) ?? '',
        category = _s(j['category']);
}

class Announcement {
  final String id, title, body, createdAt;
  final String? sentAt, startAt, endAt;
  Announcement.fromJson(Json j)
      : id = j['id'] as String,
        title = j['title'] as String,
        body = _s(j['body']) ?? '',
        createdAt = _s(j['createdAt']) ?? '',
        sentAt = _s(j['sentAt']),
        startAt = _s(j['startAt']),
        endAt = _s(j['endAt']);

  /// Is it live right now (sent and inside its active window)?
  bool isDue(DateTime now) {
    if (sentAt == null) return false;
    if (startAt != null && DateTime.parse(startAt!).isAfter(now)) return false;
    if (endAt != null && DateTime.parse(endAt!).isBefore(now)) return false;
    return true;
  }

  DateTime get when => DateTime.parse(sentAt ?? createdAt);
}

class WalkthroughStep {
  final String id, screen, position, title, body;
  final int order;
  WalkthroughStep.fromJson(Json j)
      : id = j['id'] as String,
        screen = _s(j['screen']) ?? 'index',
        position = _s(j['position']) ?? 'center',
        title = _s(j['title']) ?? '',
        body = _s(j['body']) ?? '',
        order = (j['order'] as num?)?.toInt() ?? 0;
}

class ManagedImageConfig {
  final String? imageUrl, imageUrlDark;
  final String fit, position, fade, animation;
  ManagedImageConfig.fromJson(Json j)
      : imageUrl = _s(j['imageUrl']),
        imageUrlDark = _s(j['imageUrlDark']),
        fit = _s(j['fit']) ?? 'cover',
        position = _s(j['position']) ?? 'center',
        fade = _s(j['fade']) ?? 'none',
        animation = _s(j['animation']) ?? 'none';
}

class HomeSection {
  final String key;
  final bool visible;
  HomeSection.fromJson(Json j)
      : key = j['key'] as String,
        visible = j['visible'] != false;
}

class HomeConfig {
  final String heroType;
  final String? heroMediaUrl, tagline, greeting, greetingSub, primaryColor, accentColor;
  final List<HomeSection> sections;
  HomeConfig.fromJson(Json j)
      : heroType = _s(j['heroType']) ?? 'none',
        heroMediaUrl = _s(j['heroMediaUrl']),
        tagline = _s(j['tagline']),
        greeting = _s(j['greeting']),
        greetingSub = _s(j['greetingSub']),
        primaryColor = _s(j['primaryColor']),
        accentColor = _s(j['accentColor']),
        sections = _list(j['sections'], HomeSection.fromJson);
}

class TicketType {
  final String id, name, category;
  final int priceCents;
  final String? description;
  TicketType.fromJson(Json j)
      : id = j['id'] as String,
        name = j['name'] as String,
        category = _s(j['category']) ?? '',
        priceCents = (j['priceCents'] as num?)?.toInt() ?? 0,
        description = _s(j['description']);
}

class Bundle {
  final String date;
  final List<Attraction> attractions;
  final List<Poi> pois;
  final List<Restaurant> restaurants;
  final List<Shop> shops;
  final List<TicketType> ticketTypes;
  final List<ContentPage> content;
  final List<Announcement> announcements;
  final List<Session> sessions;
  final String? nextProgramDate;
  final List<WalkthroughStep> walkthrough;
  final MapConfig? mapConfig;
  final ParkMap? defaultMap;
  final Branding? branding;
  final HomeConfig? home;
  final Map<String, ManagedImageConfig> images;

  Bundle({
    required this.date,
    required this.attractions,
    required this.pois,
    required this.restaurants,
    required this.shops,
    required this.ticketTypes,
    required this.content,
    required this.announcements,
    required this.sessions,
    required this.nextProgramDate,
    required this.walkthrough,
    required this.mapConfig,
    required this.defaultMap,
    required this.branding,
    required this.home,
    required this.images,
  });

  factory Bundle.fromJson(Json j) => Bundle(
        date: _s(j['date']) ?? '',
        attractions: _list(j['attractions'], Attraction.fromJson),
        pois: _list(j['pois'], Poi.fromJson),
        restaurants: _list(j['restaurants'], Restaurant.fromJson),
        shops: _list(j['shops'], Shop.fromJson),
        ticketTypes: _list(j['ticketTypes'], TicketType.fromJson),
        content: _list(j['content'], ContentPage.fromJson),
        announcements: _list(j['announcements'], Announcement.fromJson),
        sessions: _list(j['sessions'], Session.fromJson),
        nextProgramDate: _s(j['nextProgramDate']),
        walkthrough: _list(j['walkthrough'], WalkthroughStep.fromJson),
        mapConfig: j['mapConfig'] == null ? null : MapConfig.fromJson(j['mapConfig'] as Json),
        defaultMap: j['defaultMap'] == null ? null : ParkMap.fromJson(j['defaultMap'] as Json),
        branding: j['branding'] == null ? null : Branding.fromJson(j['branding'] as Json),
        home: j['home'] == null ? null : HomeConfig.fromJson(j['home'] as Json),
        images: ((j['images'] as Json?) ?? const {}).map((k, v) => MapEntry(k, ManagedImageConfig.fromJson(v as Json))),
      );

  Bundle withSessions(List<Session> next) => Bundle(
        date: date,
        attractions: attractions,
        pois: pois,
        restaurants: restaurants,
        shops: shops,
        ticketTypes: ticketTypes,
        content: content,
        announcements: announcements,
        sessions: next,
        nextProgramDate: nextProgramDate,
        walkthrough: walkthrough,
        mapConfig: mapConfig,
        defaultMap: defaultMap,
        branding: branding,
        home: home,
        images: images,
      );
}
