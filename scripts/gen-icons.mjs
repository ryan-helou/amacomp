import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");
await mkdir(OUT, { recursive: true });

const DECK = "#e6eef1";
const INK = "#0d2231";
const SPORTS = ["#0d93bd", "#d98217", "#d93b30"]; // swim, bike, run

const R = 205;
const CIRC = 2 * Math.PI * R;
const SEG = CIRC / 3 - 26; // three arcs with a gap between disciplines

/**
 * The mark: a pace-clock ring cut into three discipline-coloured arcs, with a
 * stamped A in the middle. The A is drawn as strokes rather than text so the
 * render never depends on which fonts happen to be installed.
 */
function svg({ padded = false, rounded = true } = {}) {
  const inset = padded ? 0.14 : 0; // maskable safe zone
  const s = 512;
  const scale = (s - 2 * inset * s) / s;
  const off = inset * s;

  const arcs = SPORTS.map(
    (color, i) => `<circle cx="256" cy="256" r="${R}" fill="none" stroke="${color}"
       stroke-width="30" stroke-linecap="butt"
       stroke-dasharray="${SEG.toFixed(2)} ${(CIRC - SEG).toFixed(2)}"
       transform="rotate(${-90 + i * 120} 256 256)"/>`,
  ).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded && !padded ? 104 : 0}" fill="${DECK}"/>
  <g transform="translate(${off},${off}) scale(${scale})">
    ${arcs}
    <g stroke="${INK}" stroke-width="46" stroke-linecap="square" stroke-linejoin="miter" fill="none">
      <path d="M156 368 L256 152 L356 368"/>
      <path d="M196 296 L316 296"/>
    </g>
  </g>
</svg>`;
}

const plain = Buffer.from(svg());
const maskable = Buffer.from(svg({ padded: true }));

await Promise.all([
  sharp(plain).resize(192, 192).png().toFile(path.join(OUT, "icon-192.png")),
  sharp(plain).resize(512, 512).png().toFile(path.join(OUT, "icon-512.png")),
  sharp(maskable).resize(512, 512).png().toFile(path.join(OUT, "maskable-512.png")),
  // Apple squares off and rounds the corners itself, so ship it edge-to-edge.
  sharp(Buffer.from(svg({ rounded: false })))
    .resize(180, 180)
    .flatten({ background: DECK })
    .png()
    .toFile(path.join(OUT, "apple-icon.png")),
  sharp(plain).resize(32, 32).png().toFile(path.join(OUT, "favicon-32.png")),
  writeFile(path.join(OUT, "mark.svg"), svg()),
]);

// Next serves app/favicon.ico automatically when present.
await sharp(plain)
  .resize(48, 48)
  .toFormat("png")
  .toFile(path.join(process.cwd(), "app", "icon.png"));

console.log("icons written to public/icons + app/icon.png");
