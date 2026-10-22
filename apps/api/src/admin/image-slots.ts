// The canonical set of admin-managed image "slots" in the mobile app. Each maps
// to a <ManagedImage slot="key"> on the device. Add entries here as more
// hardcoded images are made manageable.
export interface ImageSlot {
  key: string;
  label: string;
  location: string;
  aspect: number;
  /** Which section of the admin page the slot is listed under. */
  group: string;
}

// The pages that can have their own header picture and background picture. `key` is the suffix of the slot keys
// (`header.<key>` and `screen.<key>`) that the app reads for that page.
const PAGES: { key: string; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'programme', label: 'Programme' },
  { key: 'search', label: 'Search' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'tickets', label: 'My tickets' },
  { key: 'plan', label: 'My day' },
  { key: 'orders', label: 'My orders' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'favorites', label: 'Favourites' },
  { key: 'seen', label: 'I did it' },
  { key: 'bookings', label: 'Find my bookings' },
  { key: 'profile', label: 'Profile' },
  { key: 'settings', label: 'Account settings' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'shuttle', label: 'Shuttle' },
  { key: 'language', label: 'Language' },
  { key: 'auth', label: 'Sign in / create account' },
  { key: 'menu', label: 'Side menu' },
];

const HEADER_IMAGES: ImageSlot[] = PAGES.map((p) => ({
  key: `header.${p.key}`,
  label: `${p.label} — header`,
  location:
    p.key === 'home'
      ? 'The bar that stays at the top of Home as it scrolls (the big picture on Home is set in Home Screen)'
      : p.key === 'menu'
        ? 'Top of the side menu, behind "Welcome"'
        : `Top band of the ${p.label} page, behind its title`,
  aspect: 2.4,
  group: 'Header images',
}));

const SCREEN_IMAGES: ImageSlot[] = PAGES.map((p) => ({
  key: `screen.${p.key}`,
  label: `${p.label} — page background`,
  location: `Behind the whole ${p.label} page. It is softened in the app so the text stays easy to read.`,
  aspect: 0.56,
  group: 'Page backgrounds',
}));

export const IMAGE_SLOTS: ImageSlot[] = [
  ...HEADER_IMAGES,
  ...SCREEN_IMAGES,
  { key: 'profile.header', label: 'Profile picture banner', location: 'Top of the profile screen (tap the avatar)', aspect: 1.6, group: 'Illustrations' },
  { key: 'profile.avatar', label: 'Default avatar', location: 'The avatar/profile button when no photo is set', aspect: 1, group: 'Illustrations' },
  { key: 'favorites.empty', label: 'Favourites — empty state', location: 'Favourites list when nothing is saved yet', aspect: 1, group: 'Illustrations' },
  { key: 'seen.empty', label: 'Seen — empty state', location: 'The "seen it" list when empty', aspect: 1, group: 'Illustrations' },
  { key: 'onboarding.location', label: 'Onboarding — location', location: 'Enable-location prompt illustration', aspect: 1, group: 'Illustrations' },
  { key: 'onboarding.notifications', label: 'Onboarding — notifications', location: 'Enable-notifications prompt illustration', aspect: 1, group: 'Illustrations' },
  { key: 'auth.header', label: 'Sign-in banner picture', location: 'The picture under the title on the sign in / create account screen', aspect: 1.4, group: 'Illustrations' },
];

export const DEFAULT_IMAGE = {
  imageUrl: null as string | null,
  imageUrlDark: null as string | null,
  fit: 'cover',
  position: 'center',
  fade: 'none',
  animation: 'fade',
};
