import sharp from 'sharp';
const mono = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="72" fill="none" stroke="#fff" stroke-width="20"/><circle cx="128" cy="128" r="22" fill="#fff"/></svg>`;
await sharp(Buffer.from(mono)).resize(256, 256).png().toFile('public/icons/momo-monochrome.png');
const fav = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="#0b2b28"/><circle cx="48" cy="48" r="26" fill="none" stroke="#7FD1C7" stroke-width="8"/><circle cx="48" cy="48" r="8" fill="#7FD1C7"/></svg>`;
await sharp(Buffer.from(fav)).png().toFile('public/icon-96.png');
console.log('icons ok');