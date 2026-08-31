/**
 * Corrupted-arcade palette: an EGA-ish base plus a hot magenta/cyan pair that
 * reads as CRT chromatic aberration during glitches. Sprite data indexes into
 * this by char; '.' is intentionally absent so it maps to `undefined`
 * (transparent).
 */
export const PALETTE: Readonly<Record<string, string | undefined>> = {
  k: '#08060f',
  d: '#1b1830',
  D: '#3b3560',
  W: '#8f88b8',
  w: '#f2eeff',
  // hot pair -- the glitch signature colours
  m: '#ff3ea5',
  M: '#a01060',
  c: '#3ef0ff',
  C: '#1080a0',
  // warm
  r: '#ff4d4d',
  R: '#8c1c1c',
  o: '#ff9a2e',
  y: '#ffe14d',
  // cool
  g: '#4dff9a',
  G: '#1c7a4a',
  b: '#4d7cff',
  B: '#1c2f8c',
  // skin/metal
  f: '#ffc9a0',
  s: '#6e7fa8',
}
