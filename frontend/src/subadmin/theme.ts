// Granvia Sub Admin — brand palette
// Navy    → headers & navigation
// Burgundy→ primary actions (Add / Delete) and Rejected/Alert states
// Brown   → body text & borders
// Rule: an *approved* status renders Navy; a *rejected/alert* status renders Burgundy.

export const NAVY = '#1A2B56';
export const NAVY_DEEP = '#0f1b38';
export const BURGUNDY = '#7A2621';
export const BURGUNDY_DEEP = '#5e1c18';
export const BROWN = '#4B2E2A';

export const PAGE_BG = '#f4f1ee';
export const CARD_BG = '#ffffff';

/** Navy gradient used by the sidebar + login. */
export const NAVY_GRADIENT = 'linear-gradient(180deg, #1A2B56 0%, #12203f 55%, #0d1830 100%)';
/** Burgundy gradient used by primary CTAs. */
export const BURGUNDY_GRADIENT = 'linear-gradient(135deg, #7A2621, #99332b)';

/** Soft tinted pill tones. */
export const tone = {
  navy: { color: NAVY, bg: 'rgba(26,43,86,0.10)' },
  burgundy: { color: BURGUNDY, bg: 'rgba(122,38,33,0.10)' },
  amber: { color: '#854d0e', bg: '#fef3c7' },
  green: { color: '#166534', bg: '#dcfce7' },
  gray: { color: '#64748b', bg: '#f1f5f9' },
} as const;

/** Status → pill tone (Approved = Navy, Rejected/Alert = Burgundy). */
export function statusTone(status: string) {
  const s = status.toLowerCase();
  if (/approv|verified|active|complete|fluent/.test(s)) return tone.navy;
  if (/reject|blocked|alert|expired/.test(s)) return tone.burgundy;
  if (/pending|leave|onboard|review|basic/.test(s)) return tone.amber;
  return tone.gray;
}
