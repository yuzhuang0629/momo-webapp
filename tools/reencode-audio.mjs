// Re-encodes the team's recordings for the glasses' slow link: voice 64 kbps mono, music 96 kbps.
// Needs (not app deps): npm i --no-save mpg123-decoder @breezystack/lamejs
// node tools/reencode-audio.mjs <in.mp3> <out.mp3> <kbps> [mono]
// Decode an mp3 with mpg123 (wasm) and re-encode it with lamejs at a lower bitrate.
// node reencode.mjs in.mp3 out.mp3 kbps [mono]
import {readFileSync, writeFileSync} from 'node:fs';
import {MPEGDecoder} from 'mpg123-decoder';
import * as lame from '@breezystack/lamejs';

const [, , inp, out, kbpsArg, monoArg] = process.argv;
const kbps = Number(kbpsArg ?? 96);
const mono = monoArg === 'mono';
const dec = new MPEGDecoder();
await dec.ready;
const {channelData, sampleRate, samplesDecoded} = dec.decode(new Uint8Array(readFileSync(inp)));
dec.free();
console.log('decoded', samplesDecoded, 'samples @', sampleRate, 'channels', channelData.length, 'dur', (samplesDecoded / sampleRate).toFixed(2));
const toI16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const v = Math.max(-1, Math.min(1, f[i])); o[i] = v < 0 ? v * 32768 : v * 32767; } return o; };
let L = toI16(channelData[0]), R = toI16(channelData[1] ?? channelData[0]);
if (mono) { const m = new Int16Array(L.length); for (let i = 0; i < m.length; i++) m[i] = (L[i] + R[i]) >> 1; L = m; }
const enc = new lame.Mp3Encoder(mono ? 1 : 2, sampleRate, kbps);
const chunks = [];
const N = 1152;
for (let i = 0; i < L.length; i += N) {
  const buf = mono ? enc.encodeBuffer(L.subarray(i, i + N)) : enc.encodeBuffer(L.subarray(i, i + N), R.subarray(i, i + N));
  if (buf.length) chunks.push(Buffer.from(buf));
}
const end = enc.flush();
if (end.length) chunks.push(Buffer.from(end));
const all = Buffer.concat(chunks);
writeFileSync(out, all);
console.log('wrote', out, all.length, 'bytes');
