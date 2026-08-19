import type { PrismaService } from '../prisma/prisma.service.js';

// The mobile home sections, in their default order. `key` must match the mobile
// renderer; `visible` toggles the block.
export const DEFAULT_HOME_SECTIONS = [
  { key: 'actions', visible: true },
  { key: 'welcome', visible: true },
  { key: 'visit', visible: true },
  { key: 'announcement', visible: true },
  { key: 'alerts', visible: true },
  { key: 'comingUp', visible: true },
  { key: 'favourites', visible: true },
];

export interface HomeConfig {
  heroType: string;
  heroMediaUrl: string | null;
  tagline: string | null;
  greeting: string | null;
  greetingSub: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  sections: { key: string; visible: boolean }[];
}

/**
 * Promote any scheduled home screens whose time has arrived to the live default,
 * then return the live default's config for the mobile bundle (or null → the
 * app's built-in default look).
 */
export async function resolveHomeScreen(prisma: PrismaService): Promise<HomeConfig | null> {
  const due = await prisma.homeScreen.findMany({
    where: { status: 'scheduled', publishAt: { lte: new Date() } },
    orderBy: { publishAt: 'asc' },
  });
  if (due.length) {
    // The latest due screen wins the default slot.
    await prisma.homeScreen.updateMany({ data: { isDefault: false } });
    for (const s of due) {
      await prisma.homeScreen.update({
        where: { id: s.id },
        data: { status: 'published', publishedAt: new Date(), publishAt: null, isDefault: s.id === due[due.length - 1].id },
      });
    }
  }

  const def = await prisma.homeScreen.findFirst({ where: { isDefault: true } });
  if (!def || def.status !== 'published') return null;
  return {
    heroType: def.heroType,
    heroMediaUrl: def.heroMediaUrl,
    tagline: def.tagline,
    greeting: def.greeting,
    greetingSub: def.greetingSub,
    primaryColor: def.primaryColor,
    accentColor: def.accentColor,
    sections: (def.sections as { key: string; visible: boolean }[] | null) ?? DEFAULT_HOME_SECTIONS,
  };
}
