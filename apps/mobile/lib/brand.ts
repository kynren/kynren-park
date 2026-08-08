import { useSync } from './sync';
import { theme } from './theme';

/**
 * The live brand colours from admin branding (System → Branding), falling back
 * to the built-in defaults. Use this for brand-coloured surfaces so a colour
 * change in the admin re-themes the app.
 */
export function useBrand() {
  const { bundle } = useSync();
  return {
    primary: bundle?.branding?.primary || theme.brand,
    accent: bundle?.branding?.accent || theme.brand,
  };
}
