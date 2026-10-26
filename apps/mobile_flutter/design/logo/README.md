# Kynren app logo

**In use (since build 43):** `brand/brand_black.png` - the swash K and red cross from the real Kynren wordmark, silver on charcoal.

| Folder | What |
| --- | --- |
| `brand/` | `play-store-512.png` is the 512 px icon the Play Console store listing asks for (upload it by hand; it is separate from the app icon). The mark built from the real wordmark (`apps/mobile/assets/kynren-wordmark.webp`): `brand_black` (**in use**), `brand_green` (the Storied Lands daytime park), `brand_night` (the evening show), `adaptive_foreground.png` (Android adaptive icon, transparent, sized to clear the circular crop), `K-cut.png` / `cross-cut.png` (the two pieces lifted from the wordmark), `sheet-brand-round.png` (comparison). |
| `concepts/` | The first round of drawn ideas (shield, seal, castle shield) - not used, kept for reference. |
| `source/` | The scripts that made them (need `sharp`; paths inside point at this repo's wordmark). |

## Where it is wired in
- `assets/icon/icon.png` = `brand_black.png`; `assets/icon/adaptive-icon.png` = `adaptive_foreground.png`.
- `pubspec.yaml` -> `flutter_launcher_icons` (`adaptive_icon_background: "#15171B"`). Regenerate the Android and iOS icons with
  `dart run flutter_launcher_icons` (it rewrites `android/app/src/main/res/values/colors.xml`, so check the background colour after).
- Push notifications: Android flattens the launcher icon into a solid block, so the small icon is a separate white silhouette:
  `assets/icon/notification-icon.png` (made by `source/make-notification-icon.mjs`) -> `android/app/src/main/res/drawable-*/ic_stat_kynren.png`,
  set as the Firebase default in `AndroidManifest.xml`; its colour (`notification_accent`, the brand red) lives in `res/values/notification.xml`
  so the icon generator cannot overwrite it.
