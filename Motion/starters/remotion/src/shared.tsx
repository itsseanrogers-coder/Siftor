// Shared pieces for every Bahlman motion template: the brand kit, fonts, safe areas, easing helpers.
import React from 'react';
import { continueRender, delayRender, Easing, interpolate, staticFile } from 'remotion';

export type Brand = {
  id: string; name: string;
  primary: string;   // the accent (rules, highlights)
  ink: string;       // main text colour
  dark: string;      // panels / backgrounds
  display: string;   // display face (titles, names)
  body: string;      // body face (roles, captions)
  wordmark: string;  // text logo when there is no logo file
  logo?: string;     // optional logo image (absolute URL or path under public/)
  handle?: string;   // @handle / website for end cards
};

export const HOUSE: Brand = {
  id: 'bahlman', name: 'Bahlman House', primary: '#d79f46', ink: '#ffffff', dark: '#0b0b0d',
  display: 'Cinzel', body: 'Inter', wordmark: 'BAHLMAN MEDIA', handle: 'bahlmanmedia.com',
};

export type Format = '16:9' | '9:16';
export const SIZE: Record<Format, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

// Every template gets these on top of its own params.
export type Base = { brand?: Partial<Brand>; format?: Format; seconds?: number };
export const brandOf = (b?: Partial<Brand>): Brand => ({ ...HOUSE, ...(b || {}) });

/* ── fonts: bundled OFL faces. In the browser preview the page sets window.BM_MOTION_FONTS to the fonts folder. ── */
const FACES: Record<string, { file: string; weight: string; style?: string }[]> = {
  Cinzel: [{ file: 'Cinzel-400.woff', weight: '400' }, { file: 'Cinzel-700.woff', weight: '700' }],
  'Cormorant Garamond': [{ file: 'CormorantGaramond-500.woff', weight: '500' }, { file: 'CormorantGaramond-700.woff', weight: '700' }],
  Inter: [{ file: 'Inter-var.woff', weight: '100 900' }],
  Anton: [{ file: 'Anton-400.woff', weight: '400' }],
  'Playfair Display': [{ file: 'PlayfairDisplay-700.woff', weight: '700' }, { file: 'PlayfairDisplay-700i.woff', weight: '700', style: 'italic' }],
  Poppins: [{ file: 'Poppins-700.woff', weight: '700' }, { file: 'Poppins-800.woff', weight: '800' }],
};
export const FONT_LIST = Object.keys(FACES);
const fontUrl = (file: string) => {
  const base = typeof window !== 'undefined' && (window as any).BM_MOTION_FONTS;
  return base ? base.replace(/\/?$/, '/') + file : staticFile('fonts/' + file);
};
const loaded = new Set<string>();
export const useFonts = (families: string[]) => {
  const todo = families.filter((f) => FACES[f] && !loaded.has(f));
  const [handle] = React.useState(() => (todo.length ? delayRender('fonts ' + todo.join(',')) : null));
  React.useEffect(() => {
    if (!todo.length) return;
    Promise.all(todo.flatMap((f) => FACES[f].map((x) => {
      const ff = new FontFace(f, `url("${fontUrl(x.file)}")`, { weight: x.weight, style: x.style || 'normal' });
      return ff.load().then((l) => { (document.fonts as any).add(l); }).catch(() => {});
    }))).then(() => { todo.forEach((f) => loaded.add(f)); if (handle !== null) continueRender(handle); });
  }, []);
};

/* ── motion helpers ── */
export const ease = Easing.bezier(0.16, 1, 0.3, 1);            // expo-ish out
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
export const ramp = (f: number, a: number, b: number, from = 0, to = 1, e = ease) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });
// in → hold → out: 0..1 entrance progress and 0..1 exit progress
export const inOut = (f: number, total: number, fps: number, inS = 0.7, outS = 0.45) => ({
  enter: ramp(f, 0, inS * fps),
  exit: ramp(f, total - outS * fps, total, 0, 1, easeIn),
});
export const safe = (fmt: Format) => (fmt === '9:16' ? { x: 90, top: 260, bottom: 420 } : { x: 120, top: 90, bottom: 110 });
