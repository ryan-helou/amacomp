import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "icons");
await mkdir(OUT, { recursive: true });

const DECK = "#e6eef1";
const ACCENT = "#3d5aff";
const ACCENT2 = "#8b3df5";

// Bold "A" monogram — apex, two open legs, crossbar, triangular counter — filled
// with the blue→violet accent. fill-rule evenodd punches out the counter.
const A_PATH =
  "M256 96 L398 416 L326 416 L296 344 L216 344 L186 416 L114 416 Z " +
  "M256 214 L292 300 L220 300 Z";

function svg({ padded = false, rounded = true } = {}) {
  // Maskable icons need the mark pulled into the safe zone; scale it about centre.
  const mark = `<path fill="url(#g)" fill-rule="evenodd" d="${A_PATH}"/>`;
  const inner = padded
    ? `<g transform="translate(256 256) scale(0.76) translate(-256 -256)">${mark}</g>`
    : mark;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="${ACCENT2}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded && !padded ? 96 : 0}" fill="${DECK}"/>
  ${inner}
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

// Next serves app/icon.png automatically as the favicon.
await sharp(plain)
  .resize(48, 48)
  .toFormat("png")
  .toFile(path.join(process.cwd(), "app", "icon.png"));

console.log("icons written to public/icons + app/icon.png");
