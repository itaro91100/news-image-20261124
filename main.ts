// news-image-20261124 — "The World Today": Tuesday 24 November 2026 in one image.
//
// A newspaper front page, drawn from scratch in pure Node 22 (standard
// library only) and written out as a 1024x1024 PNG. No network, no clock,
// no randomness: every run produces byte-identical output.
//
// Six stories, chosen from what the wire services reported on 24 November
// 2026: NATO's AWACS deployment to Poland, Ukraine sinking a Russian
// corvette in Libya, a Russian jet triggering a Korean evacuation alert,
// the collapse of the COP31 climate talks, Jensen Huang's return to Nvidia,
// and Carlos Alcaraz winning the ATP Finals. The footer carries four more.
//
// Run:  node main.ts          (writes /output/entry.png, or $MAKEFUN_OUTPUT_DIR)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const PAGE_W = 1024;
const PAGE_H = 1024;

// ---- palette: newsprint paper, ink, and one accent per story ----
const PAPER = [245, 241, 230];
const INK = [20, 20, 20];
const SOFT_INK = [74, 74, 74];
const PANEL_BG = [255, 255, 255];
const PANEL_TINT = [238, 233, 219];
const RULE = [20, 20, 20];
const NAVY = [31, 56, 100];
const STEEL = [46, 90, 136];
const TEAL = [15, 118, 110];
const CRIMSON = [179, 38, 30];
const GOLD = [176, 132, 32];
const LEAF = [74, 124, 44];
const SKY = [210, 226, 240];
const WHITE = [255, 255, 255];

// ---- pixel canvas: a flat RGB buffer, origin top-left ----
const px = new Uint8Array(PAGE_W * PAGE_H * 3);
function setPx(x, y, c) {
  if (x < 0 || y < 0 || x >= PAGE_W || y >= PAGE_H) return;
  const i = (y * PAGE_W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(PAGE_W, x + w), y1 = Math.min(PAGE_H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * PAGE_W + x0) * 3;
    for (let xx = x0; xx < x1; xx++, i += 3) {
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
    }
  }
}
function fillCircle(cx, cy, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - half, cy + dy, half * 2 + 1, 1, c);
  }
}
function ring(cx, cy, r, c) {
  const steps = Math.max(24, r * 6);
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    setPx(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c);
  }
}
function drawLine(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
// Scanline-filled polygon from a list of [x, y] corners.
function fillPoly(corners, c) {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of corners) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const hits = [];
    for (let i = 0; i < corners.length; i++) {
      const [ax, ay] = corners[i];
      const [bx, by] = corners[(i + 1) % corners.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        hits.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    hits.sort((a, b) => a - b);
    for (let k = 0; k + 1 < hits.length; k += 2) {
      fillRect(Math.round(hits[k]), y, Math.round(hits[k + 1]) - Math.round(hits[k]), 1, c);
    }
  }
}

// ---- PNG writer: 8-bit RGB, filter 0, zlib from the standard library ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = (v & 1) ? (0xedb88320 ^ (v >>> 1)) : (v >>> 1);
    t[n] = v >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let v = 0xffffffff;
  for (const b of buf) v = CRC_TABLE[(v ^ b) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}
function pngChunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tagBuf = Buffer.from(tag, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tagBuf, data])), 0);
  return Buffer.concat([len, tagBuf, data, crc]);
}
function encodePng() {
  const raw = Buffer.alloc(PAGE_H * (1 + PAGE_W * 3));
  for (let y = 0; y < PAGE_H; y++) {
    raw[y * (1 + PAGE_W * 3)] = 0;
    Buffer.from(px.buffer, y * PAGE_W * 3, PAGE_W * 3)
      .copy(raw, y * (1 + PAGE_W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(PAGE_W, 0);
  ihdr.writeUInt32BE(PAGE_H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 5x7 dot-matrix font: each glyph is 7 rows of 5 cells, '#' = ink ----
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  "'": ['..#..', '..#..', '..#..', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
};
const GLYPH_W = 5;
const GLYPH_H = 7;
function glyphWidth(scale) { return (GLYPH_W + 1) * scale; }
function textWidth(str, scale) {
  let w = 0;
  for (const ch of str) w += glyphWidth(scale);
  return w - scale; // no trailing gap after the last glyph
}
function drawGlyph(ch, x, y, scale, c) {
  const rows = GLYPHS[ch] ?? GLYPHS['?'];
  for (let r = 0; r < GLYPH_H; r++) {
    for (let col = 0; col < GLYPH_W; col++) {
      if (rows[r][col] === '#') fillRect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}
function drawText(str, x, y, scale, c) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    drawGlyph(ch, cx, y, scale, c);
    cx += glyphWidth(scale);
  }
  return cx;
}
function drawTextCentred(str, cx, y, scale, c) {
  drawText(str, cx - Math.floor(textWidth(str, scale) / 2), y, scale, c);
}
// Greedy word wrap: returns lines that fit inside maxW pixels.
function wrapText(str, scale, maxW) {
  const words = str.toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(str, x, y, scale, maxW, c, lineGap = 3) {
  const lines = wrapText(str, scale, maxW);
  lines.forEach((ln, i) => drawText(ln, x, y + i * (GLYPH_H * scale + lineGap), scale, c));
  return lines.length;
}

// ---- story panels ----
function frame(x, y, w, h) {
  fillRect(x, y, w, 2, RULE);
  fillRect(x, y + h - 2, w, 2, RULE);
  fillRect(x, y, 2, h, RULE);
  fillRect(x + w - 2, y, 2, h, RULE);
}
function storyPanel(x, y, w, h, accent, kicker, headline, body, icon, iconH) {
  fillRect(x, y, w, h, PANEL_BG);
  frame(x, y, w, h);
  fillRect(x + 2, y + 2, w - 4, 30, accent);
  drawText(kicker, x + 12, y + 10, 2, WHITE);
  fillRect(x + 2, y + 32, w - 4, iconH, PANEL_TINT);
  icon(x + 2, y + 32, w - 4, iconH);
  const tx = x + 12, tw = w - 24;
  const headY = y + 32 + iconH + 10;
  const n = drawWrapped(headline, tx, headY, 3, tw, INK, 4);
  drawWrapped(body, tx, headY + n * 25 + 6, 2, tw, SOFT_INK, 3);
}

// ---- small scene icons, drawn from rectangles, circles and triangles ----
function iconRadar(x, y, w, h) {
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2), r = Math.min(w, h) / 2 - 6;
  fillCircle(cx, cy, r, NAVY);
  ring(cx, cy, r, WHITE);
  ring(cx, cy, Math.floor(r * 0.62), [120, 150, 190]);
  ring(cx, cy, Math.floor(r * 0.3), [120, 150, 190]);
  drawLine(cx - r, cy, cx + r, cy, [120, 150, 190]);
  drawLine(cx, cy - r, cx, cy + r, [120, 150, 190]);
  drawLine(cx, cy, cx + Math.floor(r * 0.7), cy - Math.floor(r * 0.7), [255, 210, 63]);
  fillCircle(cx + Math.floor(r * 0.45), cy - Math.floor(r * 0.2), 4, CRIMSON);
  fillCircle(cx - Math.floor(r * 0.35), cy + Math.floor(r * 0.4), 4, WHITE);
  fillCircle(cx, cy, 4, [255, 210, 63]);
}
function iconShip(x, y, w, h) {
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2);
  fillRect(x + 10, cy + 26, w - 20, 3, STEEL);
  fillRect(x + 30, cy + 34, w - 60, 3, STEEL);
  fillPoly([[cx - 70, cy + 8], [cx + 70, cy + 8], [cx + 52, cy + 26], [cx - 52, cy + 26]], [90, 90, 90]);
  fillRect(cx - 34, cy - 14, 46, 22, CRIMSON);
  fillRect(cx - 8, cy - 30, 4, 18, INK);
  fillPoly([[cx - 4, cy - 30], [cx + 22, cy - 23], [cx - 4, cy - 16]], CRIMSON);
  fillCircle(cx - 52, cy - 6, 3, WHITE);
  fillCircle(cx + 52, cy - 6, 3, WHITE);
}
function iconJet(x, y, w, h) {
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2);
  drawLine(x + 8, cy + 14, cx - 60, cy + 14, SOFT_INK);
  drawLine(x + 8, cy + 20, cx - 60, cy + 20, SOFT_INK);
  fillPoly([[cx - 78, cy], [cx + 62, cy - 8], [cx + 82, cy], [cx + 62, cy + 8]], STEEL);
  fillPoly([[cx - 10, cy - 6], [cx + 18, cy - 34], [cx + 30, cy - 6]], STEEL);
  fillPoly([[cx - 10, cy + 6], [cx + 14, cy + 28], [cx + 26, cy + 6]], STEEL);
  fillPoly([[cx - 78, cy - 4], [cx - 58, cy - 22], [cx - 52, cy - 4]], STEEL);
  fillCircle(cx + 52, cy, 5, WHITE);
}
function iconGlobe(x, y, w, h) {
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2), r = Math.min(w, h) / 2 - 8;
  fillCircle(cx, cy, r, SKY);
  fillCircle(cx - 12, cy - 10, 12, LEAF);
  fillCircle(cx + 14, cy + 8, 10, LEAF);
  fillCircle(cx + 16, cy - 16, 7, LEAF);
  ring(cx, cy, r, INK);
  const crack = [[cx - 20, cy - r + 2], [cx - 8, cy - 14], [cx - 16, cy + 2], [cx + 2, cy + 12], [cx - 6, cy + 26], [cx + 10, cy + r - 2]];
  for (let i = 0; i + 1 < crack.length; i++) {
    drawLine(crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], INK);
    drawLine(crack[i][0] + 1, crack[i][1], crack[i + 1][0] + 1, crack[i + 1][1], INK);
  }
}
function iconChip(x, y, w, h) {
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2), s = 52;
  for (let i = 0; i < 4; i++) {
    fillRect(cx - s / 2 + 8 + i * 12, cy - s / 2 - 10, 5, 10, GOLD);
    fillRect(cx - s / 2 + 8 + i * 12, cy + s / 2, 5, 10, GOLD);
    fillRect(cx - s / 2 - 10, cy - s / 2 + 8 + i * 12, 10, 5, GOLD);
    fillRect(cx + s / 2, cy - s / 2 + 8 + i * 12, 10, 5, GOLD);
  }
  fillRect(cx - s / 2, cy - s / 2, s, s, INK);
  fillRect(cx - s / 2 + 8, cy - s / 2 + 8, s - 16, s - 16, [42, 42, 42]);
  drawText('AI', cx - 12, cy - 7, 2, [255, 210, 63]);
}
function iconBall(x, y, w, h) {
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2), r = Math.min(w, h) / 2 - 8;
  fillCircle(cx, cy, r, [188, 205, 74]);
  ring(cx, cy, r, INK);
  const steps = 60;
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * Math.PI * 0.9 - Math.PI * 0.45;
    const rr = r * 0.86;
    setPx(Math.round(cx + Math.cos(a) * rr - r * 0.42), Math.round(cy + Math.sin(a) * rr), WHITE);
    setPx(Math.round(cx + Math.cos(a) * rr - r * 0.42) + 1, Math.round(cy + Math.sin(a) * rr), WHITE);
    setPx(Math.round(cx - Math.cos(a) * rr + r * 0.42), Math.round(cy - Math.sin(a) * rr), WHITE);
    setPx(Math.round(cx - Math.cos(a) * rr + r * 0.42) + 1, Math.round(cy - Math.sin(a) * rr), WHITE);
  }
}

// ---- the page ----
function compose() {
  fillRect(0, 0, PAGE_W, PAGE_H, PAPER);

  // Masthead: title, dateline, standfirst.
  drawTextCentred('THE WORLD TODAY', PAGE_W / 2, 28, 7, INK);
  fillRect(28, 88, PAGE_W - 56, 3, RULE);
  fillRect(28, 94, PAGE_W - 56, 1, RULE);
  drawTextCentred('TUESDAY, 24 NOVEMBER 2026', PAGE_W / 2, 104, 3, CRIMSON);
  drawTextCentred('SIX STORIES FROM AROUND THE WORLD - IN ONE PICTURE', PAGE_W / 2, 132, 2, SOFT_INK);
  fillRect(28, 154, PAGE_W - 56, 3, RULE);

  // Lead story: NATO / Poland, radar on the left, words on the right.
  const lx = 28, ly = 168, lw = PAGE_W - 56, lh = 296;
  fillRect(lx, ly, lw, lh, PANEL_BG);
  frame(lx, ly, lw, lh);
  fillRect(lx + 2, ly + 2, lw - 4, 34, NAVY);
  drawText('POLAND - NATO', lx + 14, ly + 12, 2, WHITE);
  drawText('LEAD STORY', lx + lw - 14 - textWidth('LEAD STORY', 2), ly + 12, 2, [255, 210, 63]);
  const gx = lx + 2, gy = ly + 36, gw = 330, gh = lh - 38;
  fillRect(gx, gy, gw, gh, [16, 28, 52]);
  iconRadar(gx, gy, gw, gh);
  const tx = gx + gw + 18, tw = lx + lw - 14 - tx;
  const n = drawWrapped('NATO SENDS EARLY-WARNING JETS TO POLAND', tx, ly + 52, 3, tw, INK, 4);
  drawWrapped(
    'THREE RUSSIAN MISSILES LANDED IN POLAND ON FRIDAY. NATO IS NOW DEPLOYING AWACS EARLY-WARNING AIRCRAFT TO ITS EASTERN FLANK AS ALLIES WARN THE WAR IN UKRAINE COULD SPILL OVER INTO NATO TERRITORY.',
    tx, ly + 52 + n * 25 + 10, 2, tw, SOFT_INK, 3,
  );

  // Second row: Libya and Korea.
  const r2y = 480, r2h = 224, r2w = Math.floor((PAGE_W - 56 - 16) / 2);
  storyPanel(28, r2y, r2w, r2h, STEEL, 'LIBYA - UKRAINE',
    'UKRAINE SINKS RUSSIAN WARSHIP IN LIBYA',
    'MARITIME DRONES SANK THE CORVETTE MERKURY IN BENGHAZI PORT, KYIV SAYS.',
    iconShip, 64);
  storyPanel(28 + r2w + 16, r2y, r2w, r2h, CRIMSON, 'KOREA - RUSSIA',
    'RUSSIAN JET SPARKS KOREA EVACUATION ALERT',
    'SEOUL BRIEFLY WARNED ULLEUNG ISLANDERS TO EVACUATE AFTER A RUSSIAN JET ENTERED ITS AIRSPACE.',
    iconJet, 64);

  // Third row: climate, tech, sport.
  const r3y = 720, r3h = 228, r3w = Math.floor((PAGE_W - 56 - 32) / 3);
  storyPanel(28, r3y, r3w, r3h, TEAL, 'CLIMATE',
    'COP31 CLIMATE TALKS COLLAPSE',
    'UN TALKS IN TURKEY END WITH NO DEAL ON FOSSIL FUELS. PACIFIC NATIONS DESPAIR.',
    iconGlobe, 56);
  storyPanel(28 + r3w + 16, r3y, r3w, r3h, GOLD, 'TECH - USA',
    'HUANG IS BACK AT NVIDIA',
    'JENSEN HUANG RETURNS AS CHIEF EXECUTIVE AFTER A BOARD INQUIRY CLEARS HIM. SHARES JUMP 30%.',
    iconChip, 56);
  storyPanel(28 + 2 * (r3w + 16), r3y, r3w, r3h, LEAF, 'SPORT',
    'ALCARAZ WINS ATP FINALS',
    'CARLOS ALCARAZ BEATS ALEXANDER ZVEREV IN TURIN FOR HIS FIRST ATP FINALS CROWN.',
    iconBall, 56);

  // Footer: four more stories in one line.
  fillRect(28, 962, PAGE_W - 56, 2, RULE);
  drawWrapped(
    'ALSO TODAY: ISRAELI STRIKES KILL THREE IN GAZA, INCLUDING A UN AID WORKER - INDONESIA FACTORY FIRE TOLL RISES TO 24 - TRUMP HALTS IOWA EXPLOSIVES BLAST - CHESS WORLDS OPEN IN GENEVA.',
    28, 974, 2, PAGE_W - 56, SOFT_INK, 3,
  );
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
compose();
writeFileSync(join(outDir, 'entry.png'), encodePng());
