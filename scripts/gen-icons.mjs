// Rasterizes the MoneyFlow logo into the PNGs the app needs.
// Run from the repo root:  node scripts/gen-icons.mjs
//
// Outputs:
//   src/app/icon.png            512  browser favicon raster fallback (rounded)
//   src/app/apple-icon.png      180  iOS home screen (full-bleed, no transparent corners)
//   public/icon-192.png         192  PWA manifest (purpose: any)
//   public/icon-512.png         512  PWA manifest (purpose: any)
//   public/icon-maskable-512.png 512 PWA manifest (purpose: maskable, safe padding)
//
// src/app/icon.svg (the vector favicon) is hand-maintained — keep the art in
// sync if you change the mark here.

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const GRAD = `
  <defs>
    <linearGradient id="mf" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#16895C"/>
      <stop offset="1" stop-color="#3DDC97"/>
    </linearGradient>
  </defs>`;

const M = (transform = "") =>
  `<path transform="${transform}" d="M132 360 L132 168 L256 300 L380 168 L380 360"
     stroke="#FFFFFF" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

// Rounded badge — transparent corners, for browser favicons.
const rounded = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${GRAD}
  <rect width="512" height="512" rx="128" fill="url(#mf)"/>
  ${M()}
</svg>`;

// Maskable / Apple — full square (no transparent corners so iOS / Android
// masks never reveal the background) with the monogram scaled to ~72% inside
// the safe zone.
const maskable = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${GRAD}
  <rect width="512" height="512" fill="url(#mf)"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">${M()}</g>
</svg>`;

await mkdir("public", { recursive: true });

const png = (svg) => sharp(Buffer.from(svg)).png();

await png(rounded).resize(512, 512).toFile("src/app/icon.png");
await png(maskable).resize(180, 180).toFile("src/app/apple-icon.png");
await png(rounded).resize(192, 192).toFile("public/icon-192.png");
await png(rounded).resize(512, 512).toFile("public/icon-512.png");
await png(maskable).resize(512, 512).toFile("public/icon-maskable-512.png");

console.log("✓ icons generated");
