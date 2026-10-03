// Voice lines through speechSynthesis (the only documented audio API on Meta Ray-Ban Display;
// one en-US voice, routed to the glasses speaker). Display Recording captures system audio.

/** Android AudioPlayer speech rate (AudioPlayer.kt:38). */
const RATE = 0.86;

export interface Voice {
  /** Allowed only after a wearer action: Meta asks apps not to speak on load. */
  unlock(): void;
  say(text: string): void;
  stop(): void;
}

export function createVoice(enabled: boolean): Voice {
  const synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
  let unlocked = false;

  const stop = () => {
    try {
      synth?.cancel();
    } catch {
      // Speech is optional; never let it break the lens.
    }
  };

  return {
    unlock() {
      unlocked = true;
    },
    say(text) {
      if (!synth || !enabled || !unlocked) return;
      stop();
      if (!text) return;
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = RATE;
        utterance.lang = 'en-US';
        synth.speak(utterance);
      } catch {
        // Ignore: e.g. audio-busy on the device is routine.
      }
    },
    stop,
  };
}
