-- Shop price list (Prices for Seth.docx, October 2026) against what the app already holds.
--
-- Every item in the Kynren Shop, Viking Shop and Bird Emporium sections already exists in the app at the same price, so
-- nothing is added or repeated there. What differs:
--   * the Bird Emporium is called "The Bird Shop" in the app: renamed (the shop and its pin on the map; the web address,
--     slug the-bird-shop, stays so existing links keep working);
--   * "Birch, Birch & Co" is not in the app: created with its four products. It has no map position yet; drag it onto the
--     map from the admin's "Place on map" palette.
--
-- Safe to run more than once: each step only acts when it still needs to.
--   docker exec -i kynren-park-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < scripts/shops-price-list-2026-10.sql

BEGIN;

UPDATE "Shop" SET name = 'The Lost Feather Bird Emporium', "updatedAt" = now()
 WHERE slug = 'the-bird-shop' AND name = 'The Bird Shop';

UPDATE "PointOfInterest" p SET name = 'The Lost Feather Bird Emporium', "updatedAt" = now()
  FROM "Shop" s
 WHERE s."poiId" = p.id AND s.slug = 'the-bird-shop' AND p.name = 'The Bird Shop';

INSERT INTO "Shop" (id, slug, name, images, active, "updatedAt")
SELECT gen_random_uuid()::text, 'birch-birch-co', 'Birch, Birch & Co', ARRAY[]::text[], true, now()
 WHERE NOT EXISTS (SELECT 1 FROM "Shop" WHERE slug = 'birch-birch-co');

INSERT INTO "ShopItem" (id, "shopId", name, "priceCents", variants, available, "sortOrder", "updatedAt")
SELECT gen_random_uuid()::text, s.id, v.name, v.cents, '[]'::jsonb, true, v.ord, now()
  FROM "Shop" s,
       (VALUES ('Enamel Mug', 1000, 0), ('Lemon Sherbet Candle', 800, 1), ('Broken Biscuits', 150, 2), ('Traditional Sweets', 300, 3)) AS v(name, cents, ord)
 WHERE s.slug = 'birch-birch-co'
   AND NOT EXISTS (SELECT 1 FROM "ShopItem" i WHERE i."shopId" = s.id AND lower(i.name) = lower(v.name));

COMMIT;
