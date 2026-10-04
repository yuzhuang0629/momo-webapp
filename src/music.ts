// Background music (USER_FLOW 2.5, Android AudioPlayer.music): the team's track, looping, faded
// between levels — in over 3 s, out to silence over 2.5 s, otherwise 2 s — and ducked to 1/4
// (−12 dB) while a voice line plays.
//
// Like the voice, nothing loads or plays before the wearer's first pinch: the engine asks for
// FULL on the start screen, and the level is applied (faded in) at that pinch. The file is
// streamed by one HTMLAudioElement (re-encoded to 96 kbps for the glasses' link). <audio> on
// Ray-Ban Display is undocumented, so every failure just leaves the session silent.
import type {MusicLevel} from './contracts';

const FULL = 0.35;
const LOW = 0.15;
const DUCK = 0.25;

export interface Music {
  /** The wearer's first pinch: create the element inside the gesture and apply the level. */
  unlock(): void;
  level(level: MusicLevel): void;
  /** Lower while a voice line plays. */
  duck(on: boolean): void;
  /** Page hidden: pause; visible again: resume if a level is on. */
  setHidden(hidden: boolean): void;
}

export function createMusic(enabled: boolean, src: string): Music {
  let el: HTMLAudioElement | null = null;
  let unlocked = false;
  let works = enabled && typeof Audio !== 'undefined';
  let target = 0;
  let ducked = false;
  let volume = 0;
  let raf = 0;

  const levelValue = (l: MusicLevel): number => (l === 'FULL' ? FULL : l === 'LOW' ? LOW : 0);

  function fail(): void {
    works = false;
    cancelAnimationFrame(raf);
    try {
      el?.pause();
    } catch {
      // ignore
    }
  }

  function play(): void {
    if (!el || !works) return;
    const p = el.play() as Promise<void> | undefined;
    p?.catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return; // our own pause()
      console.warn('[momo] background music cannot play here', e);
      fail();
    });
  }

  /** Fades the element from its current volume to `to` over `ms`, replacing any fade in progress. */
  function fadeTo(to: number, ms: number, done?: () => void): void {
    cancelAnimationFrame(raf);
    if (!el) return;
    const from = volume;
    const t0 = performance.now();
    const stepFade = (now: number): void => {
      const k = Math.min(1, (now - t0) / ms);
      volume = from + (to - from) * k;
      try {
        if (el) el.volume = Math.max(0, Math.min(1, volume));
      } catch {
        // ignore
      }
      if (k < 1) raf = requestAnimationFrame(stepFade);
      else done?.();
    };
    raf = requestAnimationFrame(stepFade);
  }

  function apply(): void {
    if (!el || !works) return;
    const goal = ducked ? target * DUCK : target;
    if (target > 0 && el.paused) play();
    const ms = target > volume ? 3000 : target === 0 ? 2500 : 2000;
    fadeTo(goal, ms, () => {
      if (target === 0) el?.pause();
    });
  }

  return {
    unlock() {
      if (unlocked || !works) return;
      unlocked = true;
      try {
        el = new Audio(src);
        el.loop = true;
        el.preload = 'auto';
        el.volume = 0;
        el.addEventListener('error', () => fail());
      } catch {
        fail();
        return;
      }
      play(); // inside the gesture, so later fades and resumes are allowed
      apply();
    },
    level(l) {
      target = levelValue(l);
      if (unlocked) apply();
    },
    duck(on) {
      if (ducked === on) return;
      ducked = on;
      if (!el || !works || target === 0) return; // never interrupt a fade-out
      fadeTo(on ? target * DUCK : target, 400);
    },
    setHidden(hidden) {
      if (!el || !works) return;
      if (hidden) {
        cancelAnimationFrame(raf);
        el.pause();
      } else if (target > 0) {
        play();
        apply();
      }
    },
  };
}
