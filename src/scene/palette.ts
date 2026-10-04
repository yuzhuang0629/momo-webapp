// Palette, colour helpers and glow conversions (GS:44-50, GS:1534-1552, GS:1649-1654).

export type Rgb = readonly [number, number, number];

export const ACCENT: Rgb = [201, 228, 166];
export const WARM: Rgb = [243, 223, 168];
export const CREAM: Rgb = [244, 241, 230];
export const MINT: Rgb = [205, 232, 226];
export const WHITE: Rgb = [255, 255, 255];
export const BLACK: Rgb = [0, 0, 0];
/** Lens background behind every screen: Figma frame 17 (252-2194) fill, a solid deep olive. */
export const LENS_BG = '#3F4A14';

export function mix(p: Rgb, q: Rgb, t: number): Rgb {
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
}

function ch(v: number): number {
  const r = Math.round(v);
  return r < 0 ? 0 : r > 255 ? 255 : r;
}

/** CSS colour with Android's 8-bit alpha rounding (argb, GS:1549-1552). */
export function rgba(rgb: Rgb, a: number): string {
  const al = Math.round((a < 0 ? 0 : a > 1 ? 1 : a) * 255) / 255;
  return `rgba(${ch(rgb[0])},${ch(rgb[1])},${ch(rgb[2])},${al})`;
}

export function hexRgb(h: string, fallback: Rgb = ACCENT): Rgb {
  const s = h.startsWith('#') ? h.slice(1) : h;
  const n = Number.parseInt(s, 16);
  if (!Number.isFinite(n) || s.length === 0) return fallback;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Canvas/CSS blur for an Android `setShadowLayer(r)`: Skia blurs with σ = 0.57735·r + 0.5 and a
 * canvas `shadowBlur` B means σ = B/2, so B = 1.1547·r + 1 (GS:1649-1650).
 */
export function shadowBlurFor(androidRadius: number): number {
  return 2 * (0.57735 * androidRadius + 0.5);
}

/** σ of an Android shadow radius (for padding sprite canvases to 3σ). */
export function sigmaFor(androidRadius: number): number {
  return 0.57735 * androidRadius + 0.5;
}

// Android shadow radii used by the scene (GS:1651-1654, GS:1573).
export const LOGO_GLOW = 9.2;
export const LOGO_DOT_GLOW = 9.65;
export const TEXT_GLOW_6_4 = 4.7;
export const TEXT_GLOW_9_3 = 7.2;
/** Breathing ring: Figma drop-shadow blur 21.8 (σ 10.9), 3.2 / 3.3. */
export const RING_GLOW = 18.0;
/** Drop-shadow blur 17.41 (σ 8.71) of the enlarged frames' dots (sense, listen, expand view). */
export const DOT_GLOW_17 = 14.21;
