// The canonical set of admin-managed image "slots" in the mobile app. Each maps
// to a <ManagedImage slot="key"> on the device. Add entries here as more
// hardcoded images are made manageable.
export const IMAGE_SLOTS: { key: string; label: string; location: string; aspect: number }[] = [
  { key: 'profile.header', label: 'Profile header', location: 'Top of the profile screen (tap the avatar)', aspect: 1.6 },
  { key: 'profile.avatar', label: 'Default avatar', location: 'The avatar/profile button when no photo is set', aspect: 1 },
  { key: 'favorites.empty', label: 'Favourites — empty state', location: 'Favourites list when nothing is saved yet', aspect: 1 },
  { key: 'seen.empty', label: 'Seen — empty state', location: 'The "seen it" list when empty', aspect: 1 },
  { key: 'onboarding.location', label: 'Onboarding — location', location: 'Enable-location prompt illustration', aspect: 1 },
  { key: 'onboarding.notifications', label: 'Onboarding — notifications', location: 'Enable-notifications prompt illustration', aspect: 1 },
  { key: 'auth.header', label: 'Sign-in header', location: 'Top of the sign in / create account screen', aspect: 1.4 },
];

export const DEFAULT_IMAGE = {
  imageUrl: null as string | null,
  imageUrlDark: null as string | null,
  fit: 'cover',
  position: 'center',
  fade: 'none',
  animation: 'fade',
};
