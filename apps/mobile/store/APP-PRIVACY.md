# App Privacy answers (App Store Connect "App Privacy" + Play Data Safety)

How to answer the store privacy questionnaires for **Kynren – The Storied Lands**, based on what the
app actually collects (see `PRIVACY-POLICY.md`). Confirm against your final backend before you submit.

## Apple — App Store Connect → App Privacy

**"Do you or your third-party partners collect data from this app?"** → **Yes.**

For every item below, answer **"Used to Track You": NO** (the app does no cross-app/cross-site
tracking and uses no advertising identifiers).

| Data type (Apple category) | Collected? | Linked to the user's identity? | Purpose |
|---|---|---|---|
| **Contact Info → Email Address** | Yes (account holders) | **Linked** | App Functionality |
| **Contact Info → Name** | Yes (if provided) | **Linked** | App Functionality |
| **Location → Precise Location** | Yes (with permission) | **Linked** | App Functionality |
| **Identifiers → Device ID** (push token) | Yes (if notifications allowed) | **Linked** | App Functionality |
| **Purchases → Purchase History** (tickets / Click & Collect orders) | Yes | **Linked** | App Functionality |
| **Usage Data → Product Interaction** (aggregated popularity/analytics) | Yes | **Not Linked** | Analytics |

Everything else (financial info, contacts, browsing history, health, messages, photos, audio,
advertising data, etc.) → **Not Collected**.

Notes when filling it in:
- **Precise Location** — purpose is **App Functionality** (map position, walking distances, live
  presence for operations). Do **not** tick "Third-Party Advertising" or "Developer's Advertising".
- Payment card data is **Not Collected** (no in-app card entry).
- Set the **Privacy Policy URL** to `https://kynren.com/privacy`.

## Google Play — Data Safety form (for the Android build)

- **Does your app collect or share user data?** → Yes, collects.
- **Is all data encrypted in transit?** → Yes (HTTPS/TLS).
- **Do you provide a way to request data deletion?** → Yes — via the contact email in the policy.
- Data types to declare (all **collected**, **not shared** with third parties for their own use, and
  **none for advertising/tracking**):
  - **Personal info:** Email address, Name — *App functionality; Account management.*
  - **Location:** Approximate & precise location — *App functionality.* (Optional, permission-gated.)
  - **App activity:** Product interaction — *Analytics.*
  - **Financial info → Purchase history** (tickets/orders) — *App functionality.*
  - **Device or other IDs** (push token) — *App functionality; sending notifications.*
- Mark location and notifications as **optional** (the app works without granting them).

## Data-collection map (source of truth)

| What | Where in the app | Sent to server? |
|---|---|---|
| Email, name | Register / sign in | Yes (account) |
| Precise location | Map screen only, permission-gated | Presence ping only when signed in (`POST /me/presence`) |
| Push token | On launch if notifications allowed (`/push/register`) | Yes |
| Tickets / bookings | Booking flow | Yes |
| Click & Collect orders | Food ordering | Yes |
| Favourites, "seen", cached bundle | Device storage | **No — stays on device** |
| Locale, accessibility prefs | Settings | Yes (with account) |
