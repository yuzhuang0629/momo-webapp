// The bead "clack" of the team's 4.1转珠子 (USER_FLOW #5): port of momo-android audio/BeadClick.kt.
// A 12 ms noise tap (deterministic LCG, cubic fade) through a one-pole 1.2 kHz low-pass at .5, plus
// two sine partials (520 Hz .16 → 90 ms, 880 Hz .06 → 50 ms) with a 1.2 ms attack and an
// exponential decay, rendered once into a 44.1 kHz AudioBuffer. Identical every time.
//
// Web Audio through the glasses speaker is undocumented, so this is best-effort: the AudioContext
// is created and resumed only inside the wearer's first click (autoplay rules), ?voice=0 mutes it
// with the voice (as on Android), and if Web Audio is missing or fails it simply stays silent.

const RATE = 44_100;
const f = Math.fround;

export interface Sfx {
  /** The wearer's first action: creates / resumes the AudioContext. Later calls only resume it. */
  unlock(): void;
  /** One bead click (re-triggers: a click still sounding is cut, like AudioTrack.stop + play). */
  click(): void;
}

/** BeadClick.render(): the click as float samples in -1…1, 140 ms at 44.1 kHz. */
export function renderBeadClick(rate = RATE): Float32Array {
  const n = Math.trunc(rate * f(0.14));
  const out = new Float32Array(n);
  // noise tap: 12 ms, cubic fade, deterministic LCG like the prototype, one-pole low-pass at 1.2 kHz
  const len = Math.trunc(rate * f(0.012));
  const a = 1 - Math.exp((-2 * Math.PI * 1200) / rate);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const noise = ((((i * 9301 + 49297) % 233280) / 233280) * 2 - 1) * (1 - i / len) ** 3;
    lp += a * (noise - lp);
    out[i] = out[i]! + 0.5 * lp;
  }
  // partials: attack 1.2 ms, then exponential decay to .0005 over `dec`
  const partials: ReadonlyArray<readonly [number, number, number]> = [[520, 0.16, 0.09], [880, 0.06, 0.05]];
  for (const [freq, v, dec] of partials) {
    const att = Math.trunc(rate * f(0.0012));
    const end = Math.min(n, Math.trunc(rate * f(f(dec) + f(0.01))));
    const k = Math.log(0.0005 / v) / (dec - 0.0012);
    for (let i = 0; i < end; i++) {
      const t = i / rate;
      const env = i < att ? (v * i) / att : v * Math.exp(k * (t - 0.0012));
      out[i] = out[i]! + env * Math.sin(2 * Math.PI * freq * t);
    }
  }
  // Android writes 16-bit PCM: clamp and quantise the same way.
  for (let i = 0; i < n; i++) out[i] = Math.trunc(Math.min(1, Math.max(-1, out[i]!)) * 32767) / 32768;
  return out;
}

export function createSfx(enabled: boolean): Sfx {
  type Ctor = typeof AudioContext;
  const w = window as unknown as {AudioContext?: Ctor; webkitAudioContext?: Ctor};
  const Ctx: Ctor | undefined = w.AudioContext ?? w.webkitAudioContext;
  let ctx: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let last: AudioBufferSourceNode | null = null;
  let broken = !enabled || !Ctx;

  return {
    unlock() {
      if (broken) return;
      try {
        if (!ctx) {
          ctx = new Ctx!();
          const data = renderBeadClick(); // the context resamples a 44.1 kHz buffer if it runs at another rate
          buffer = ctx.createBuffer(1, data.length, RATE);
          buffer.getChannelData(0).set(data);
        }
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      } catch {
        broken = true; // no Web Audio here: stay silent
        ctx = null;
      }
    },
    click() {
      if (broken || !ctx || !buffer || ctx.state !== 'running') return;
      try {
        if (last) {
          try {
            last.stop();
          } catch {
            // already ended
          }
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.onended = () => {
          src.disconnect();
          if (last === src) last = null;
        };
        src.start();
        last = src;
      } catch {
        // best-effort
      }
    },
  };
}
