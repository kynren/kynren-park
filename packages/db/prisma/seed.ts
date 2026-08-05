/**
 * Seeds the real Kynren – The Storied Lands opening season (2026).
 * Run with: npm run db:seed
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient, AttractionCategory, PoiType, StaffRole, TicketCategory, PriceRange, SessionStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Password hashing (scrypt) — must match packages/shared/src/crypto.ts.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

// The Storied Lands season: Tue–Sun, 18 Jul – 12 Sep 2026 (closed Mondays).
const SEASON_START = new Date('2026-07-18T00:00:00.000Z');
const SEASON_END = new Date('2026-09-12T00:00:00.000Z');

function openDates(): Date[] {
  const dates: Date[] = [];
  for (let d = new Date(SEASON_START); d <= SEASON_END; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 1) dates.push(new Date(d)); // skip Monday (1)
  }
  return dates;
}

function at(date: Date, hh: number, mm: number): Date {
  const t = new Date(date);
  t.setUTCHours(hh, mm, 0, 0);
  return t;
}

async function main() {
  console.log('🌱 Seeding Kynren – The Storied Lands…');

  // --- Clean (idempotent dev seed) ------------------------------------------
  await prisma.$transaction([
    prisma.itineraryItem.deleteMany(),
    prisma.itinerary.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.showSession.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.restaurant.deleteMany(),
    prisma.attraction.deleteMany(),
    prisma.pointOfInterest.deleteMany(),
    prisma.ticketType.deleteMany(),
    prisma.announcement.deleteMany(),
    prisma.contentPage.deleteMany(),
    prisma.staffUser.deleteMany(),
  ]);

  // --- Staff logins ---------------------------------------------------------
  await prisma.staffUser.createMany({
    data: [
      { email: 'admin@kynren.com', name: 'Park Admin', role: StaffRole.ADMIN, passwordHash: hashPassword('kynren-admin') },
      { email: 'ops@kynren.com', name: 'Ops Duty Manager', role: StaffRole.OPS, passwordHash: hashPassword('kynren-ops') },
    ],
  });

  // --- Points of interest (park map) ----------------------------------------
  // Coordinates approximate the Flatts Farm / Eleven Arches site, Bishop Auckland.
  const poi = async (type: PoiType, name: string, lat: number, lng: number, mapZone?: string) =>
    prisma.pointOfInterest.create({ data: { type, name, lat, lng, mapZone } });

  const entrance = await poi(PoiType.ENTRANCE, 'Main Entrance', 54.6720, -1.6795, 'Gateway');
  const parking = await poi(PoiType.PARKING, 'Visitor Car Park', 54.6735, -1.6820, 'Gateway');
  const birdsPoi = await poi(PoiType.ATTRACTION, 'The Lost Feather Arena', 54.6712, -1.6778, 'Skies');
  const horsePoi = await poi(PoiType.ATTRACTION, 'Medieval Tiltyard', 54.6708, -1.6760, 'Storied Fields');
  const lakePoi = await poi(PoiType.ATTRACTION, 'Legend of the Wear Lakeside', 54.6702, -1.6748, 'The Great Lake');
  const vikingPoi = await poi(PoiType.ATTRACTION, 'Land of the Vikings', 54.6698, -1.6772, 'Northlands');
  const mazePoi = await poi(PoiType.ATTRACTION, 'Victorian Imaginariums', 54.6715, -1.6752, 'The Labyrinth');
  const eveningPoi = await poi(PoiType.ATTRACTION, 'Kynren Show Ground', 54.6690, -1.6740, 'The Tellings');
  const tavernPoi = await poi(PoiType.RESTAURANT, 'The Storyteller’s Tavern', 54.6714, -1.6768, 'Storied Fields');
  const kitchenPoi = await poi(PoiType.RESTAURANT, 'Lakeside Kitchen', 54.6704, -1.6752, 'The Great Lake');
  await poi(PoiType.RESTROOM, 'Central Toilets', 54.6710, -1.6765, 'Storied Fields');
  await poi(PoiType.RESTROOM, 'Northlands Toilets', 54.6699, -1.6768, 'Northlands');
  await poi(PoiType.FIRST_AID, 'First Aid Point', 54.6711, -1.6770, 'Storied Fields');
  await poi(PoiType.SHOP, 'The Kynren Store', 54.6718, -1.6790, 'Gateway');
  await poi(PoiType.BABY_CHANGING, 'Baby Changing', 54.6710, -1.6766, 'Storied Fields');
  await poi(PoiType.ACCESSIBILITY, 'Accessible Viewing – Lakeside', 54.6703, -1.6750, 'The Great Lake');
  await poi(PoiType.PICNIC, 'Picnic Meadow', 54.6716, -1.6758, 'Storied Fields');
  await poi(PoiType.INFO, 'Guest Services', 54.6719, -1.6792, 'Gateway');

  // --- Attractions ----------------------------------------------------------
  const attractionsData = [
    {
      slug: 'the-lost-feather',
      name: 'The Lost Feather',
      category: AttractionCategory.BIRDS,
      tagline: 'Magnificent birds soar overhead',
      synopsis:
        'Watch magnificent birds of prey soar just above the crowd in a breathtaking free-flight display, as a heartfelt tale of a lost feather unfolds beneath open skies.',
      durationMins: 25,
      capacity: 1200,
      poiId: birdsPoi.id,
      hasAudioDescription: true,
      sensoryNotes: 'Sudden bird movements and occasional loud calls.',
      sortOrder: 1,
    },
    {
      slug: 'the-storied-ride',
      name: 'The Storied Ride',
      category: AttractionCategory.HORSE,
      tagline: 'Daring horsemanship and unforgettable characters',
      synopsis:
        'Follow the journey of a young girl and her trusty steed in a spectacular medieval tale filled with daring horsemanship, stunts and unforgettable characters.',
      durationMins: 30,
      capacity: 1500,
      poiId: horsePoi.id,
      hasCaptioning: true,
      sensoryNotes: 'Live horses, galloping, theatrical fire effects.',
      sortOrder: 2,
    },
    {
      slug: 'legend-of-the-wear',
      name: 'Legend of the Wear',
      category: AttractionCategory.LAKE,
      tagline: 'The Lambton Worm rises',
      synopsis:
        'The legendary tale of the Lambton Worm is brought to life on a vast lake with water effects, pyrotechnics and larger-than-life creatures.',
      durationMins: 30,
      capacity: 2000,
      poiId: lakePoi.id,
      hasAudioDescription: true,
      hasCaptioning: true,
      sensoryNotes: 'Pyrotechnics, loud bangs, water spray near the front rows.',
      sortOrder: 3,
    },
    {
      slug: 'land-of-the-vikings',
      name: 'Land of the Vikings',
      category: AttractionCategory.VIKINGS,
      tagline: 'Warriors clash amid fire and action',
      synopsis:
        'Witness Viking warriors clash amid fire, steel and thundering action in an immersive Norse settlement alive with longships and legend.',
      durationMins: 25,
      capacity: 1400,
      poiId: vikingPoi.id,
      sensoryNotes: 'Combat sequences, fire effects, loud crowd and drums.',
      minAge: undefined,
      sortOrder: 4,
    },
    {
      slug: 'victorian-imaginariums',
      name: 'Victorian Imaginariums',
      category: AttractionCategory.MAZE,
      tagline: 'An outdoor maze packed with surprises',
      synopsis:
        'Lose yourself in the mysteries of the Victorian Imaginariums, an outdoor maze of curiosities, illusions and delightful surprises around every corner.',
      durationMins: 40,
      capacity: undefined,
      poiId: mazePoi.id,
      wheelchairAccessible: true,
      sortOrder: 5,
    },
    {
      slug: 'an-epic-tale-of-england',
      name: 'Kynren – An Epic Tale of England',
      category: AttractionCategory.EVENING_SHOW,
      tagline: '2,000 years of history, 1,000 performers',
      synopsis:
        'On selected evenings, a cast and crew of 1,000 volunteers take audiences on an epic journey through 2,000 years of English history across a vast outdoor stage.',
      durationMins: 90,
      capacity: 8000,
      poiId: eveningPoi.id,
      hasAudioDescription: true,
      sensoryNotes: 'Large-scale pyrotechnics, horses, fireworks and loud music.',
      sortOrder: 6,
    },
  ];

  const attractions = [];
  for (const a of attractionsData) {
    attractions.push(await prisma.attraction.create({ data: a }));
  }

  // --- Show sessions for the season -----------------------------------------
  // Daytime attractions run on a rotating timetable; the evening show plays
  // Saturdays plus two Fridays (21 Aug, 4 Sep 2026).
  const daytime = attractions.filter((a) => a.category !== AttractionCategory.EVENING_SHOW);
  const evening = attractions.find((a) => a.category === AttractionCategory.EVENING_SHOW)!;
  const eveningExtraFridays = new Set(['2026-08-21', '2026-09-04']);

  // Two performances of each daytime attraction, staggered so a guest can see all five.
  const slotPlan: Record<string, [number, number][]> = {
    'the-lost-feather': [[11, 0], [15, 0]],
    'the-storied-ride': [[11, 45], [15, 45]],
    'legend-of-the-wear': [[12, 30], [16, 30]],
    'land-of-the-vikings': [[13, 30], [17, 15]],
    'victorian-imaginariums': [[10, 30], [14, 30]], // maze = entry windows
  };

  const sessions: {
    attractionId: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    status: SessionStatus;
    capacity?: number | null;
  }[] = [];

  for (const date of openDates()) {
    for (const a of daytime) {
      for (const [hh, mm] of slotPlan[a.slug] ?? []) {
        const start = at(date, hh, mm);
        const end = new Date(start.getTime() + a.durationMins * 60_000);
        sessions.push({ attractionId: a.id, date, startTime: start, endTime: end, status: SessionStatus.SCHEDULED, capacity: a.capacity });
      }
    }
    const iso = date.toISOString().slice(0, 10);
    if (date.getUTCDay() === 6 || eveningExtraFridays.has(iso)) {
      const start = at(date, 21, 30);
      const end = new Date(start.getTime() + evening.durationMins * 60_000);
      sessions.push({ attractionId: evening.id, date, startTime: start, endTime: end, status: SessionStatus.SCHEDULED, capacity: evening.capacity });
    }
  }
  await prisma.showSession.createMany({ data: sessions });
  console.log(`  • ${sessions.length} show sessions across ${openDates().length} open days`);

  // --- Ticket types ---------------------------------------------------------
  await prisma.ticketType.createMany({
    data: [
      { name: 'Advance Saver – Adult', category: TicketCategory.ADULT, priceCents: 3000, description: 'Daytime entry to all five Storied Lands attractions.' },
      { name: 'Advance Saver – Child', category: TicketCategory.CHILD, priceCents: 2000, description: 'Ages 5–16. Daytime entry to all five attractions.' },
      { name: 'Concession', category: TicketCategory.CONCESSION, priceCents: 2700, description: 'Students, over-65s and disabled guests.' },
      { name: 'Infant', category: TicketCategory.INFANT, priceCents: 0, description: 'Under 5s go free.' },
      { name: 'Family (2 Adults + 2 Children)', category: TicketCategory.FAMILY, priceCents: 9000, description: 'Best value day out for a family of four.' },
    ],
  });

  // --- Restaurants & menus --------------------------------------------------
  const tavern = await prisma.restaurant.create({
    data: {
      slug: 'storytellers-tavern',
      name: 'The Storyteller’s Tavern',
      cuisine: 'British pub classics',
      description: 'Hearty plates and local ales in a rustic timber tavern.',
      priceRange: PriceRange.MODERATE,
      openingHours: '10:30–18:00',
      poiId: tavernPoi.id,
    },
  });
  const kitchen = await prisma.restaurant.create({
    data: {
      slug: 'lakeside-kitchen',
      name: 'Lakeside Kitchen',
      cuisine: 'Wood-fired & street food',
      description: 'Wood-fired pizzas, loaded fries and sweet treats by the water.',
      priceRange: PriceRange.BUDGET,
      openingHours: '11:00–17:30',
      poiId: kitchenPoi.id,
    },
  });

  await prisma.menuItem.createMany({
    data: [
      { restaurantId: tavern.id, name: 'Durham Beef & Ale Pie', description: 'Shortcrust pie, mash and gravy.', priceCents: 1450, dietaryTags: [] },
      { restaurantId: tavern.id, name: 'Fish & Chips', description: 'Beer-battered haddock, chunky chips, mushy peas.', priceCents: 1550, dietaryTags: [] },
      { restaurantId: tavern.id, name: 'Garden Veg Wellington', description: 'Roasted vegetable wellington with gravy.', priceCents: 1350, dietaryTags: ['vegan'] },
      { restaurantId: tavern.id, name: 'Kids’ Sausage & Mash', priceCents: 750, dietaryTags: [] },
      { restaurantId: kitchen.id, name: 'Margherita Pizza', description: 'Wood-fired, San Marzano tomato, mozzarella.', priceCents: 1100, dietaryTags: ['veg'] },
      { restaurantId: kitchen.id, name: 'Pepperoni Pizza', priceCents: 1250, dietaryTags: [] },
      { restaurantId: kitchen.id, name: 'Loaded Fries', description: 'Cheese, crispy onions, smoky sauce.', priceCents: 650, dietaryTags: ['veg', 'gf'] },
      { restaurantId: kitchen.id, name: 'Warm Cookie & Ice Cream', priceCents: 550, dietaryTags: ['veg'] },
    ],
  });

  // --- Content pages (CMS-lite) ---------------------------------------------
  await prisma.contentPage.createMany({
    data: [
      { slug: 'opening-times', title: 'Opening Times', category: 'info', sortOrder: 1, body: 'Kynren – The Storied Lands is open Tuesday to Sunday, 18 July – 12 September 2026. Gates open at 10:00. Last entry 15:00.' },
      { slug: 'getting-here', title: 'Getting Here', category: 'info', sortOrder: 2, body: 'Flatts Farm, Bishop Auckland, County Durham. Free on-site parking. Sat nav: DL14 7SF.' },
      { slug: 'accessibility', title: 'Accessibility', category: 'accessibility', sortOrder: 3, body: 'Step-free routes across the park, accessible viewing areas, accessible toilets and a sensory guide. Assistance dogs welcome. Free carer tickets available.' },
      { slug: 'safety', title: 'Safety & Effects', category: 'safety', sortOrder: 4, body: 'Some shows feature pyrotechnics, fire, loud noises and live animals. Ear defenders are available to borrow from Guest Services.' },
      { slug: 'faq-tickets', title: 'Do I need to book?', category: 'faq', sortOrder: 5, body: 'Yes — advance booking is strongly recommended as capacity is limited. Advance Saver tickets start from £30 adult / £20 child.' },
    ],
  });

  // --- A welcome announcement -----------------------------------------------
  await prisma.announcement.create({
    data: {
      title: 'Welcome to The Storied Lands',
      body: 'Plan your day, add shows to your itinerary and we’ll remind you before each one begins. Enjoy the magic!',
      audience: 'ALL',
    },
  });

  console.log('✅ Seed complete.');
  console.log('   Staff login: admin@kynren.com / kynren-admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
