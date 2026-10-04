// Renders the start screen background of Figma frame 16 (240-2022, "image 112") once:
// the 1080×1440 photo object-covered into 1022.722 × 1363.63, rotated 90° clockwise, CSS
// blur(50px) (σ 50), placed at (-221.09, -367.94) and cropped by the 600×600 frame.
// Run: node tools/gen-intro-bg.mjs
import sharp from 'sharp';

const rotated = await sharp('design/intro-bg-source.png')
  .resize(1023, 1364, {fit: 'cover'})
  .rotate(90)
  .toBuffer();
await sharp(rotated)
  .blur(50)
  .extract({left: 221, top: 368, width: 600, height: 600})
  .jpeg({quality: 82, mozjpeg: true})
  .toFile('src/scene/intro-bg.jpg');
console.log('intro bg ok');
