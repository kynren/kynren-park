import { useSync } from './sync';
import { theme } from './theme';

// The colours admin Branding held before the redesign: the original defaults and the navy and red it was later set to. A
// workspace still on one of them has not chosen a colour for the new design, so the app's own palette applies; any other
// colour an admin picks overrides it, as before.
const PREVIOUS_PRIMARIES = ['#8f1d21', '#1d2c49', '#2f80ed', '#1d5bd8'];
const PREVIOUS_ACCENTS = ['#22b365', '#de022d', '#7b4fe0', '#ef476f'];

/**
 * The live brand colours from admin branding (System → Branding), falling back
 * to the built-in defaults. Use this for brand-coloured surfaces so a colour
 * change in the admin re-themes the app.
 */
export function useBrand() {
  const { bundle } = useSync();
  const primary = bundle?.branding?.primary?.toLowerCase();
  const accent = bundle?.branding?.accent?.toLowerCase();
  return {
    primary: primary && !PREVIOUS_PRIMARIES.includes(primary) ? primary : theme.brand,
    accent: accent && !PREVIOUS_ACCENTS.includes(accent) ? accent : theme.accent,
  };
}
