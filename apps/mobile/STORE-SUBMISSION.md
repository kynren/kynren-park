# App Store & Play Store Submission

Everything needed to ship the **Kynren – The Storied Lands** app to the App Store and Google Play,
built on Expo Application Services (EAS).

## 1. Prerequisites

- An [Expo](https://expo.dev) account (free) and the CLI: `npm i -g eas-cli`, then `eas login`
- **Apple**: an Apple Developer Program membership ($99/yr) + an App Store Connect app record
- **Google**: a Google Play Console account ($25 one-off) + a Play service-account JSON key

## 2. Fill in the placeholders

Replace every `REPLACE_WITH_*` value:

| File | Field | Value |
|------|-------|-------|
| `app.json` | `expo.owner` | your Expo account/organisation slug |
| `app.json` | `expo.extra.eas.projectId` | from `eas init` (auto-filled) |
| `eas.json` | `submit.production.ios.*` | Apple ID, App Store Connect app id, Team id |
| `eas.json` | `submit.production.android.serviceAccountKeyPath` | path to your Play service-account JSON |

Also point the production/preview API URLs in `eas.json` at your real hosts.

## 3. One-time setup

```bash
cd apps/mobile
eas init            # creates the EAS project, fills extra.eas.projectId
eas credentials     # generate/manage iOS & Android signing credentials
```

## 4. Assets (done ✓)

Brand icons and splash are generated (`assets/generate-assets.mjs` — re-run `node assets/generate-assets.mjs`):

- `icon.png` 1024² · `adaptive-icon.png` 1024² · `splash.png` 1242² · `favicon.png` · `notification-icon.png`

**Still to produce (design task):** store **screenshots** — capture from a device/simulator:
- iPhone 6.7" (1290×2796) and 6.5" — 3–6 shots
- Android phone (1080×1920+) — 2–8 shots
- Suggested screens: Today, Itinerary planner (optimised route), Offline map, Digital ticket QR, Click & Collect

## 5. Build

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
# quick internal test build:
eas build --platform android --profile preview
```

## 6. Submit

```bash
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```

## 7. Store listing metadata

**App name:** Kynren – The Storied Lands
**Subtitle (iOS, ≤30):** Your day, planned & offline
**Short description (Android, ≤80):** Live show times, a smart planner, offline map and tickets.

**Promotional text:**
> Plan your perfect day at the UK's first live-action show park — and never lose it to patchy Wi-Fi.

**Full description:**
> Kynren – The Storied Lands puts the whole park in your pocket, and it keeps working when the signal
> doesn't. Build a clash-free plan across The Lost Feather, Legend of the Wear, Land of the Vikings and
> more, and we'll remind you before each show. Follow the offline park map, carry your tickets as
> scannable QR codes, and order ahead with Click & Collect. Live show updates reach you the moment
> anything changes. Available in English, French, Spanish, German and Dutch.
>
> • Smart itinerary planner — a walkable, timed route through the shows you choose
> • Offline-first — map, schedule and tickets all work with no signal
> • Live show times with instant delay/cancellation alerts
> • Digital tickets with offline QR
> • Click & Collect food ordering
> • Full accessibility info on every attraction

**Keywords (iOS):** kynren,storied lands,bishop auckland,theme park,day out,show times,tickets,map
**Category:** Travel (primary) · Entertainment (secondary)
**Content rating:** PEGI 3 / Everyone
**Support URL:** https://kynren.com/app-support
**Privacy policy URL:** https://kynren.com/privacy  *(required — must exist before review)*

## 8. Pre-submission checklist

- [ ] Placeholders replaced; `eas init` run
- [ ] Production `EXPO_PUBLIC_API_URL` points at the live, HTTPS API
- [ ] Push notifications: iOS APNs key + Android FCM configured in `eas credentials`
- [ ] Privacy policy live; App Privacy "data collected" answered (email, usage, location)
- [ ] Screenshots uploaded for all required device sizes
- [ ] Test the production build on a real device (booking → offline QR → airplane mode)
- [ ] Bump `version` (and iOS `buildNumber` / Android `versionCode` — `autoIncrement` handles this)
