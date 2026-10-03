// Renders the app icons from the Figma logo (Hackathon2026, frame 60-673, node 156:1554),
// exported unchanged to design/momo-logo.svg. Run: node tools/gen-icons.mjs
import sharp from 'sharp';
import {readFileSync} from 'node:fs';

const logo = readFileSync(new URL('../design/momo-logo.svg', import.meta.url));

/** The wide logo, scaled to `width` px, centred on a square transparent (or solid) canvas. */
async function icon(size, width, background) {
  const art = await sharp(logo, {density: 600}).resize({width}).png().toBuffer();
  return sharp({create: {width: size, height: size, channels: 4, background}})
    .composite([{input: art, gravity: 'center'}])
    .png();
}

const clear = {r: 0, g: 0, b: 0, alpha: 0};

// Meta Wearables manifest icon: transparent monochrome artwork (the system tints it and draws
// the theme colour behind it in a 64×64 slot).
await (await icon(256, 236, clear)).toFile('public/icons/momo-monochrome.png');
// Legacy favicon (> 52×52 PNG): the logo on black, like on the lens.
await (await icon(96, 88, {r: 0, g: 0, b: 0, alpha: 1})).toFile('public/icon-96.png');
console.log('icons ok');
