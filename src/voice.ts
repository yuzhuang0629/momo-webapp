// Voice lines: the team's recordings (public/voice/, mapped by exact line text in narration.ts,
// like AudioPlayer.say + Narration.kt), with speechSynthesis as the fallback.
//
// speechSynthesis is the only audio API Meta documents for Ray-Ban Display (one en-US voice,
// routed to the glasses speaker); <audio> through the glasses speaker is undocumented. So:
//  · Nothing is fetched or spoken before the wearer's first pinch (Meta: don't speak on load), and
//    the clips are not part of the first load. After that pinch they are fetched one at a time, in
//    the order the session will need them, a few lines ahead of the engine, and kept in memory
//    (as blob: URLs) so a line never waits on the network.
//  · One HTMLAudioElement plays every clip. It is "blessed" inside that first pinch (a 10 ms silent
//    WAV, inline) because stricter autoplay policies only let an element play later, outside a
//    gesture, if it already played inside one.
//  · say(line) plays the clip if it is loaded, interrupting any clip or utterance; if the clip is
//    missing, not loaded yet, or play() rejects / errors / never starts, it speaks the same text
//    (rate 0.86). A playback failure is remembered: later lines go straight to speech.
//  · No console errors: every rejection is caught; console.warn at most, once per kind.

import {clipFor, FLOW_ORDER, flowIndexOfStep} from './narration';
import {SCRIPT} from './engine/script';

/** Android AudioPlayer speech rate (AudioPlayer.kt:38). */
const RATE = 0.86;
/** How many lines ahead of the one being said to keep fetched. */
const AHEAD = 3;
/** A clip that has not started this long after play() counts as a playback failure. */
const START_TIMEOUT_MS = 2000;
/** 10 ms of 8 kHz 8-bit silence: plays the element once inside the wearer's gesture, no request. */
const SILENCE =
  'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

export interface Voice {
  /**
   * The wearer's first action allows speech (Meta asks apps not to speak on load) and starts
   * fetching the clips from the first line of USER_FLOW step `step`. Later calls do nothing.
   */
  unlock(step: number): void;
  /** Speak one line (interrupts the previous one). Empty string = stop speaking. */
  say(text: string): void;
  stop(): void;
}

export function createVoice(enabled: boolean): Voice {
  const synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
  let unlocked = false;

  // ---- clip cache: one fetch at a time, nearest-needed first
  /** False once clip playback has failed (or cannot work here): from then on, speech only. */
  let clipsWork = typeof Audio !== 'undefined' && typeof fetch === 'function' && typeof URL.createObjectURL === 'function';
  /** Clip URL → blob: URL of its fetched bytes. */
  const ready = new Map<string, string>();
  const failed = new Set<string>();
  let queue: string[] = [];
  let inFlight: string | null = null;
  let warnedFetch = false;

  function pump(): void {
    if (inFlight !== null || !clipsWork) return;
    const url = queue.shift();
    if (url === undefined) return;
    inFlight = url;
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        ready.set(url, URL.createObjectURL(blob));
      })
      .catch((e: unknown) => {
        failed.add(url);
        if (!warnedFetch) {
          warnedFetch = true;
          console.warn('[momo] voice clip unavailable; that line uses speech', url, e);
        }
      })
      .finally(() => {
        inFlight = null;
        pump();
      });
  }

  /** Puts these clips at the front of the queue, in this order (skipping loaded / failed / in flight). */
  function want(urls: ReadonlyArray<string | null>, atEnd = false): void {
    const fresh = urls.filter((u): u is string => u !== null && u !== inFlight && !ready.has(u) && !failed.has(u));
    const rest = queue.filter(u => !fresh.includes(u));
    queue = atEnd ? [...rest, ...fresh] : [...fresh, ...rest];
    pump();
  }

  function prefetchFrom(index: number): void {
    want(FLOW_ORDER.slice(index, index + AHEAD).map(clipFor));
  }

  // ---- playback
  /** The one element every clip plays through (created and blessed in unlock()). */
  let player: HTMLAudioElement | null = null;
  let current: HTMLAudioElement | null = null;
  /** Bumped by every say()/stop(); late callbacks from an older line are ignored. */
  let token = 0;
  let watchdog = 0;

  function stop(): void {
    token++;
    clearTimeout(watchdog);
    if (current) {
      try {
        current.pause();
      } catch {
        // ignore
      }
      current = null;
    }
    try {
      synth?.cancel();
    } catch {
      // Speech is optional; never let it break the lens.
    }
  }

  function speak(text: string): void {
    if (!synth) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = RATE;
      utterance.lang = 'en-US';
      synth.speak(utterance);
    } catch {
      // Ignore: e.g. audio-busy on the device is routine.
    }
  }

  function playClip(audio: HTMLAudioElement, src: string, text: string): void {
    const mine = token;
    let started = false;
    const fail = (why: unknown): void => {
      if (mine !== token || !clipsWork) return;
      clipsWork = false;
      queue = [];
      console.warn('[momo] voice clips cannot play here; using speech from now on', why);
      clearTimeout(watchdog);
      try {
        audio.pause();
      } catch {
        // ignore
      }
      current = null;
      speak(text);
    };
    current = audio;
    audio.onerror = () => fail(audio.error ?? 'media error');
    audio.onplaying = () => {
      started = true;
    };
    try {
      audio.src = src;
      const p = audio.play() as Promise<void> | undefined;
      p?.then(
        () => {
          started = true;
        },
        (e: unknown) => {
          // A pause() from the next line (or stop) aborts this play(): not a failure.
          if (mine !== token || (e instanceof DOMException && e.name === 'AbortError')) return;
          fail(e);
        },
      );
    } catch (e) {
      fail(e);
      return;
    }
    watchdog = window.setTimeout(() => {
      if (!started) fail('clip did not start');
    }, START_TIMEOUT_MS);
  }

  return {
    unlock(step) {
      if (unlocked) return;
      unlocked = true;
      if (!enabled || !clipsWork) return;
      try {
        player = new Audio(SILENCE);
        // Rejection here only means the bless did not take; the first real clip will tell.
        (player.play() as Promise<void> | undefined)?.catch(() => undefined);
      } catch {
        clipsWork = false;
        return;
      }
      prefetchFrom(flowIndexOfStep(step));
      // Back (QuickExit) can come at any moment; its short clip follows the first few.
      want([clipFor(SCRIPT.QUICK)], true);
    },
    say(text) {
      if (!enabled || !unlocked) return;
      stop();
      if (!text || text.startsWith('(')) return; // stage directions like "(your recording)"
      const url = clipFor(text);
      const src = url !== null && clipsWork && player ? ready.get(url) : undefined;
      if (src && player) playClip(player, src, text);
      else speak(text);
      const at = FLOW_ORDER.indexOf(text as (typeof FLOW_ORDER)[number]);
      if (at >= 0 && clipsWork) prefetchFrom(at + 1);
    },
    stop,
  };
}
