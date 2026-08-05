# Stock Registry: Types, SKU/QR generation, Scan-to-Issue, Media, Reports tab, Scoped UI conversions

## Legacy note

This file previously held the Database Manager + Media Center plan — shipped and merged (PR #59).
Replaced below with this new plan.

## Context

Stock Register & Analytics today is a thin CRUD module: `StockItem` has a free-text `category`
string (no real type model), no images/video, no QR scanning (only static QR *display* via the
shared `QrCodeModal`), and issuing stock out is just an ad-hoc `StockTransaction` with
`type: OUT` and a free-text reason — no concept of "who received it" or proof of receipt. The
user wants a much more complete goods-issue workflow: typed stock items with auto-generated
SKU/QR on creation, image/video attachments, a QR-scan-driven issuance flow that validates
quantity and captures a drawn signature (plus a printable PDF receipt), email + in-app
notifications to the recipient, a module-scoped Reports tab reusing the existing GLPI-style report
builder, and a small, explicitly-scoped set of UI conversions (chip-row filters → real `<select>`s,
new pickers built as proper dropdowns/multi-selects) — deliberately **not** an app-wide dropdown
audit, per the user's own choice when asked to scope it.

Confirmed decisions (via AskUserQuestion):
- **SKU prefix** is per-tenant configurable (System Settings), defaulting to `"KYN"` — not a
  hardcoded literal. (Note: this app's `Organization` Prisma model is a Person/access-control
  org-tree, not the SaaS tenant — multi-tenancy here is per-schema, so a `SystemSetting` key is
  the correct place for this, matching every other tenant-wide toggle.)
- **UI conversion scope**: apply dropdown/multi-select conventions to everything *new* built for
  this feature, plus convert 5 already-identified existing chip-row filters elsewhere in the app.
  Do **not** touch page-level tab bars. Do **not** do an exhaustive app-wide audit.
- **Signature capture**: a drawn signature on a canvas (not typed-name/password reconfirmation).
- **Signature receipt**: in addition to storing the signature as an audit record, generate a
  printable PDF issuance receipt (item, quantity, recipient, date, embedded signature image) —
  mirrors the existing asset/harness PDF report pattern already in the codebase.

Key existing infrastructure confirmed via research (reuse, don't rebuild):
- `client/src/components/QrCodeModal.tsx` — generic QR display + `window.print()`, already used
  for Stock Items keyed on `sku`. Reusable as-is; only needs a `footer` prop so SKU is guaranteed
  to render at the bottom (today it's `label`/`subLabel`, SKU currently renders *above* name).
- `client/src/pages/assets/QrScannerModal.tsx` — camera QR scanner (`jsqr` + `getUserMedia`), but
  hardcoded to Assets (`/assets/by-tag/:tag`, `navigate("/assets/...")`). Extract the camera/decode
  mechanics into a generic core, add a thin Stock-specific wrapper.
- `client/src/components/QuickAddSelect.tsx` (wraps `client/src/components/ChipSelect.tsx`) — the
  exact "dropdown with inline + to create" pattern already used for Location pickers; reuse for the
  new Stock Type picker. Note its `+` affordance is gated by a hardcoded
  `usePermission("admin", "create")` — needs a `permissionModule` prop to gate on `"stock"` instead.
- `client/src/components/FilePreview.tsx` + `client/src/lib/filePreview.ts` (built this session for
  Media Center) — generic, zero Media-Center-specific coupling, directly reusable for rendering
  stock image/video attachments.
- `server/src/lib/notify.ts` (`notifyUsers`) + `server/src/lib/emailNotify.ts`
  (`sendEventEmail`) + `EmailTemplate`/`EmailEventType` system — the single choke-point pattern
  already used by `ASSET_ASSIGNED` (`server/src/modules/assets/assets.controller.ts:285-299`) is
  the template to copy for the new stock-issuance notification.
- `server/src/modules/dashboard/dataExplorer.ts` — already has a working `"stock"` source in its
  `SOURCES` registry; the Report Builder can already query Stock data, it's just never been
  surfaced inside `StockPage.tsx`.
- `pdfkit` + `drawPdfCopyrightFooter`/`buildCopyrightFooter` (`server/src/lib/docExport.ts`) — the
  exact pattern used for asset/harness PDF reports
  (`server/src/modules/assets/assets.controller.ts:396-403, 471-478`): `new PDFDocument({margin:40})`
  piped directly to `res`, footer drawn on every page. Reuse verbatim for the issuance receipt,
  embedding the signature PNG via `doc.image(buffer, x, y, {width, height})`.

## Schema changes (server/prisma/schema.prisma)

**`StockItemType`** (new model, mirrors `AssetCategory` pattern at ~line 364):
```prisma
model StockItemType {
  id          Int         @id @default(autoincrement())
  name        String
  code        String      @unique // uppercase/alnum SKU fragment, auto-slugified from name
  description String?
  stockItems  StockItem[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```
`StockItem` gets `stockItemTypeId Int?` + relation. **Keep the existing `category String?` column**
during a transition window — `dataExplorer.ts` groups reports by `category`
(`groupableFields: ["category"]`, ~line 124) and dropping it would break saved
reports/dashboards. One-time backfill script: for each distinct non-null `category` value, create
a `StockItemType` and set `stockItemTypeId` on matching rows (leave `category` populated too, in
sync, so old reports keep working).

**`StockItemAttachment`** (new, mirrors `AssetPhoto` at ~line 608 but adds `mimeType` for reliable
video vs. image rendering via `getPreviewKind`):
```prisma
model StockItemAttachment {
  id           Int       @id @default(autoincrement())
  stockItemId  Int
  stockItem    StockItem @relation(fields: [stockItemId], references: [id], onDelete: Cascade)
  url          String
  mimeType     String?
  originalName String?
  uploadedById Int?
  uploadedBy   User?     @relation(fields: [uploadedById], references: [id], onDelete: SetNull)
  createdAt    DateTime  @default(now())
}
```

**`StockIssuance`** (new model — deliberately *not* extra columns on `StockTransaction`, since that
table also serves `IN`/`TRANSFER`/ad-hoc `OUT` and would be ~95% null; matches this schema's own
`Asset`+`AssetCheckout` split):
```prisma
model StockIssuance {
  id                Int              @id @default(autoincrement())
  transactionId     Int              @unique
  transaction       StockTransaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  receivedById      Int
  receivedBy        User             @relation(fields: [receivedById], references: [id])
  signatureImageUrl String
  scannedSku        String?
  createdAt         DateTime         @default(now())
}
```
Add `StockTransaction.issuance StockIssuance?` on the other side. Quantity/item/issuer/location
stay on the linked `StockTransaction`, read via the relation — no duplication.

**SKU prefix**: new `SystemSetting` key `stockSkuPrefix` (default `"KYN"` in code when absent, no
migration needed — same pattern as every other tenant-wide setting in
`server/src/modules/settings/settings.service.ts`'s `applySystemSettings()`), surfaced in
`client/src/pages/appSettings/SystemSettingsTab.tsx`.

Run one migration covering `StockItemType`, `StockItem.stockItemTypeId`, `StockItemAttachment`,
`StockIssuance`, `StockTransaction.issuance` — propagate via the existing
`scripts/migrateAllSchemas.ts` to both org schemas, same convention as every prior schema change
this session.

## Backend

- **`server/src/modules/stockItemTypes/`** (new module): `GET/POST /stock-item-types`. `POST`
  accepts `{name}`, derives `code` (uppercase, strip non-alnum, dedupe-suffix on collision), returns
  `{id, name}` to satisfy `QuickAddSelect`'s contract exactly.
- **`server/src/lib/stockSku.ts`** (new): `generateSku(typeCode)` → reads `stockSkuPrefix` from
  `SystemSetting`, builds `${prefix}-${typeCode}-${random 6-digit}`, retries on unique-constraint
  collision against `StockItem.sku`. Called from `server/src/modules/stock/stock.controller.ts`'s
  create handler when `sku` isn't explicitly supplied.
- **Attachments**: `POST /stock/:id/attachments` (multer, disk storage under
  `server/uploads/stock-attachments/`, mirroring `mediaCenter.routes.ts`'s multer setup but with a
  larger size cap — 150MB — since video is explicitly required) and `DELETE
  /stock/:id/attachments/:attachmentId`. Register the new upload directory in
  `mediaCenter.service.ts`'s known-sources list so stock attachments also show up in the existing
  Media Center "Attached Uploads" aggregator (consistent with how every other upload flow in the
  app is aggregated there).
- **QR lookup**: `GET /stock/by-sku/:sku` (new) — mirrors `GET /assets/by-tag/:tag` exactly, used
  by both "scan to view" and "scan to issue."
- **Issuance**: `POST /stock/:id/issue`, `multipart/form-data` (signature PNG blob +
  `scannedSku`/`quantity`/`receivedById`/`locationId` fields). Validation order, inside one
  `$transaction`:
  1. Look up `StockLevel` at `locationId`; if `quantity` > available, respond 400 with
     `{error, available, requested}` and create nothing — mirrors the existing check pattern in
     `createStockTransaction` (`server/src/modules/stock/stock.controller.ts:104`).
  2. Verify `scannedSku` still matches the item's current `sku` (guards against a stale scan on an
     item whose SKU somehow changed).
  3. Save the signature PNG to disk, create the `StockTransaction` (`type: OUT`), decrement
     `StockItem.quantityOnHand`/`StockLevel.quantityOnHand`, create the linked `StockIssuance`.
  4. After commit: call `notifyUsers({ userIds: [receivedById], type: "stock_issued", kind:
     "STOCK_ISSUED", email: { eventType: "STOCK_ISSUED", ... } })` — same call shape as
     `checkoutAsset()`'s `ASSET_ASSIGNED` notification.
  5. Generate the PDF receipt (see below) and return its download URL / stream it directly.
- **PDF receipt**: `GET /stock/issuances/:id/receipt.pdf` — `PDFDocument` from `pdfkit`, piped to
  `res`, `drawPdfCopyrightFooter` on every page (verbatim pattern from
  `assets.controller.ts:396-403`), body = item name/SKU, quantity, recipient, date, embedded
  signature image via `doc.image(signatureBuffer, x, y, {width, height})`.
- **New `EmailEventType`/`NotificationEventKind` value** (`STOCK_ISSUED`) — full existing
  6-touch-point pattern, using `LOW_STOCK` as the model instance to copy in each place:
  1. Prisma `EmailEventType` enum (~line 2225) + migration.
  2. `server/src/modules/emailTemplates/emailTemplates.schema.ts:14` zod enum (currently out of
     sync with the Prisma enum for several existing values — add `STOCK_ISSUED` explicitly, don't
     assume the file is otherwise correct).
  3. `SAMPLE_VARIABLES` map, `server/src/modules/emailTemplates/emailTemplates.controller.ts:104`.
  4. Client constants, all in `client/src/pages/admin/emailTemplateConstants.ts`: `EmailEventType`
     type, `EVENT_TYPES`, `EVENT_LABELS`, `EVENT_DESCRIPTIONS`, `EVENT_VARIABLES`,
     `SAMPLE_VARIABLES`.
  5. `NotificationEventKind` enum (~line 2201) + label in
     `client/src/pages/profile/NotificationsTab.tsx` so the recipient can opt in/out.
- **Reports**: no backend change strictly required (the `"stock"` `dataExplorer` source already
  works) — optionally add a `?source=` query param to `GET /reports`
  (`server/src/modules/reports/reports.routes.ts:11`) so the new Stock Reports tab can pre-filter
  server-side.

## Frontend

1. **Stock Type picker** — `QuickAddSelect` pointed at `/stock-item-types`, in
   `client/src/pages/stock/StockItemFormModal.tsx`. Add a `permissionModule` prop to
   `QuickAddSelect.tsx` (default `"admin"`, pass `"stock"` here) so the inline "+" isn't gated
   behind a permission stock users may not have.
2. **Attachments field** — new `client/src/pages/stock/StockAttachmentsField.tsx`, multi-file
   `<input accept="image/*,video/*" multiple>`, previews rendered via the existing
   `FilePreview`/`getPreviewKind`. Wired into `StockItemFormModal.tsx`.
3. **QR scanner** — extract the camera/jsQR mechanics from `QrScannerModal.tsx` into a generic
   `client/src/components/QrScannerCore.tsx` (`onDecode`, `simulateOptions`, `title` props,
   preserving the existing lifecycle/permission handling untouched); rewrite the Assets modal as a
   thin wrapper over it; add `client/src/pages/stock/StockQrScannerModal.tsx` calling
   `GET /stock/by-sku/:sku`, opened from a new "Scan" button on `StockPage.tsx`'s Register tab.
4. **Signature pad** — add `react-signature-canvas` as a dependency (thin, well-maintained wrapper
   over `signature_pad`; no existing signature library in this codebase). New
   `client/src/components/SignaturePad.tsx`, exports via `canvas.toBlob()` for multipart upload
   (avoids bloating JSON bodies with base64).
5. **Stock Item Detail / scan-result view** — new `client/src/pages/stock/StockItemDetailModal.tsx`.
   Extend `GET /stock/:id`'s existing `transactions`+`stockLevels` include to also bring in linked
   `issuance` records. Shows qty-by-location, full transaction/issuance history, an "Issue Stock"
   action (opens the scan → quantity → signature flow), inline edit of qty/info.
6. **Issue flow + over-quantity warning** — a small wizard (scan → enter quantity → sign): the
   scan result opens `StockItemDetailModal` pre-populated; entering a quantity greater than
   available shows an inline `alert-danger` block (matching the existing `isError` pattern already
   used in `StockLevelsModal`) and disables submit until corrected — a blocking on-screen banner,
   not a toast, per the user's "screen warning" wording. On success, offer the PDF receipt as an
   immediate download link.
7. **`QrCodeModal` print fix** — add an explicit `footer?: string` prop so "SKU always at the
   bottom" is enforced by contract rather than label/subLabel ordering; update the Stock call site
   to pass `footer={qrItem.sku}` and double-check the Assets/Users/Tickets call sites aren't
   accidentally reordered.
8. **Reports tab in Stock Registry** — add a 5th tab button to `StockPage.tsx`'s existing tab row
   (alongside `dashboard/register/analytics/procurement`). Give `ReportBuilderModal.tsx` an
   optional `defaultSource="stock"` prop and `ReportsListPage.tsx` an optional `sourceFilter` prop,
   rather than duplicating list/CRUD logic in a Stock-specific copy — reports created here are
   still plain global `Report` rows, same as ones made via `/reports`.
9. **Multi-select for new Stock UI** — generalize `ChipSelect.tsx` with a `multiple` mode
   (checkbox popover, comma-joined trigger label) rather than a new component; used where the new
   Stock Reports tab needs multi-value type/item filters. Scoped only to new Stock UI per the
   user's explicit answer — not a retrofit of existing single-select fields elsewhere.
10. **5 chip→dropdown conversions** (existing code, convert to real `<select>` or `ChipSelect`):
    - `client/src/pages/appSettings/MediaCenterTab.tsx:96-100` (media type filter)
    - `client/src/pages/appSettings/MediaCenterTab.tsx:345-348` (attached-source filter)
    - `client/src/pages/assets/AssetListPage.tsx:232-241` (category filter — preserve the
      per-option count badge in the option label, e.g. `"Laptops (12)"`)
    - `client/src/components/AccessControl.tsx:71-76` (Person/Team kind selector)
    - `client/src/pages/helpdesk/TicketDetailPage.tsx:251-259` (ticket status setter)
    - Explicitly leave page-level tab bars alone (`StockPage.tsx`, `ReportsPage.tsx`, `AdminPage.tsx`,
      `ProfilePage.tsx` — same CSS class, different pattern, out of scope).

## Phasing (sequential, each independently verifiable)

1. **Schema foundation + Stock Type + SKU generation on create.** Migration, `stockSkuPrefix`
   setting, `stockItemTypes` module, `stockSku.ts`, `StockItemFormModal.tsx` type picker,
   `category`→`StockItemType` backfill script. *Verify:* create an item with a brand-new type via
   "+", confirm SKU format/uniqueness, confirm existing QR/print still works against the new SKU.
2. **Image/video attachments** (independent, can run in parallel with 1). `StockItemAttachment`
   migration, upload routes, `StockAttachmentsField.tsx`, Media Center directory registration.
   *Verify:* attach an image + short video, confirm correct native preview per type.
3. **QR scan-to-issue: quantity validation + signature + PDF receipt** (depends on Phase 1 for
   scannable SKUs). `StockIssuance` migration, `by-sku`/`issue`/`receipt.pdf` endpoints, generic
   `QrScannerCore.tsx` extraction, `StockQrScannerModal.tsx`, `StockItemDetailModal.tsx`,
   `SignaturePad.tsx`, over-quantity warning UI. *Verify:* an over-issue attempt is rejected with
   nothing persisted; a valid issuance atomically updates the ledger + stock levels + issuance
   history and produces a downloadable PDF receipt with the signature embedded.
4. **Email/notification firing** (depends on Phase 3). `STOCK_ISSUED` `EmailEventType`/
   `NotificationEventKind` + full 6-touch-point wiring + `notifyUsers()` call in the issue handler.
   *Verify:* in-app toast/notification and email both fire on issuance, preference opt-out is
   honored, email still sends when the recipient is logged out.
5. **Reports tab in Stock Registry** (no dependency on 1-4). `defaultSource`/`sourceFilter` props,
   new Stock tab, `ChipSelect` `multiple` mode. *Verify:* a report saved from the Stock tab appears
   correctly in the top-level `/reports` list; share/export/email-report still work.
6. **Scoped UI conversions** (fully independent). Convert the 5 named chip rows one at a time, each
   independently shippable.

## Verification

- `cd server && npx tsc --noEmit` and `cd client && npx tsc --noEmit` clean after each phase.
- `npx prisma generate` (stop dev server first — Windows DLL lock, established convention) +
  `scripts/migrateAllSchemas.ts` against both org schemas after each schema-touching phase.
- Browser, end-to-end per phase as described above; for Phase 3 specifically, test both the
  happy path (valid quantity, signature captured, receipt generated) and the rejection path
  (over-quantity blocked before any DB write) using the browser's camera-simulate fallback already
  present in the `QrScannerModal` pattern (no real camera needed in this environment).
- Confirm the 5 chip→dropdown conversions and the new Stock Type/attachments UI render correctly
  in both light and dark theme.
