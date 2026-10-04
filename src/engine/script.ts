// Every word Momo says or shows. Voice lines port session/Script.kt (snapshot 20:54); lens copy
// ports glasses/LensContent.kt plus the strings SessionEngine.kt puts on cards.
// Since 2026-10-03 every voice line is one of the team's recordings (public/voice/, mapped in
// src/narration.ts); the text here is the recording's words, and the speechSynthesis fallback
// says the same. Never "calm down", "relax", "don't worry", "how do you feel".
import type {BreathPhase, GlassCard} from '../cards';

/** Voice lines (Script.kt). */
export const SCRIPT = {
  BEGIN: 'Take a moment.',
  SIT_DOWN: 'Sit down, if you can.',
  SUPPORT: 'Feel the support beneath you.',
  /** One line per breath cycle, spoken as the inhale starts. */
  BREATH_1: 'Take a slow breath in... and breathe out.',
  BREATH_2: 'Again... breathe in... and slowly breathe out.',
  BEADS: 'Now, gently roll your fingers.',
  FINGERS: 'Feel your fingertips.',
  LOOK_AROUND: 'Take a look around.', // re-recorded 2026-10-04
  FIND_OBJECT: 'Find one object nearby.',
  NOTICE_OBJECT: 'Notice its color... its shape... and its texture.', // unused since 2026-10-04
  /** #7 web (2026-10-04): the one object's second page (recording: "Notice the White Item Nearby."). */
  FIND_WHITE: 'Notice the white item nearby.',
  /** #8 temperature branch (recording 2026-10-04); the scent branch keeps TOUCH. */
  TEMPERATURE: 'Feel its temperature.',
  TOUCH: "Notice what you're touching.",
  TAKE_YOUR_TIME: 'Take your time.',
  LISTEN: 'Now, notice one sound around you.',
  JUST_NOTICE: "You don't need to react to it. Just notice it.",
  GAZE: 'Slowly look around.',
  COMFORTABLE: 'Adjust your hair or clothing if you need to.',
  CHECK_CAMERA: "When you're ready, check your camera and framing.",
  END: 'Move forward at your own pace.',
  QUICK: "You're ready.",
} as const;

export type ScriptLine = (typeof SCRIPT)[keyof typeof SCRIPT];

/** Phone caption after every ending (SessionEngine.kt:395); never on the lens. */
export const CAPTION_OFF = 'Glasses are off. Good luck.';

/** Lens strings. */
export const LENS = {
  PINCH_HINT: 'Pinch to move on',
  // #2 start screen, drawn by the scene itself (GlassScene.kt:1337-1359): "moment" is SemiBold.
  INTRO_LINE_1_LEAD: 'Take a ',
  INTRO_LINE_1_BOLD: 'moment',
  INTRO_LINE_2: 'for yourself.',
  INTRO_TITLE: 'Take a moment for yourself.',
  INTRO_PINCH: 'Pinch to start',
  // #3 support captions (SupportFigure timeline).
  SIT_LINE: 'Slowly Sit Down',
  SIT_UNDERLINE: 'Sit',
  // Figma Component 8 sets it on two lines, the key word capitalised (LensContent.kt:29-31).
  SUPPORT_LINE: 'Feel the Support\nbeneath you.',
  SUPPORT_UNDERLINE: 'Support',
  // #6, Figma 5.1
  FINGERS_LINE: 'Focus on the feeling of two\nfingers rubbing together.',
  FINGERS_UNDERLINE: 'rubbing',
  // #9
  LISTEN_TITLE: 'Listen',
  LISTEN_PROMPT: 'One sound around you',
  // #5
  BEADS_TITLE: 'Turn the beads',
  BEADS_HINT: 'Swipe your thumb up or down',
  // #11
  COMFORTABLE_TITLE: 'Get comfortable',
  COMFORTABLE_SUB: 'Hair, clothes, posture',
  REENTER_META: 'Re-enter',
  // #12 (straight ASCII apostrophe, as in SessionEngine.kt:356)
  // #12, Figma Component 10 (LensContent.kt:32-33; curly apostrophe as in Figma)
  ENDING_LINE: 'Your Body Is Settled.\nReturn When You’re Ready.',
  EXIT_HINT: 'Pinch to exit',
  // QuickExit
  QUICK_TITLE: "You're ready.",
} as const;

/** "Reconnect · k of total" (U+00B7 with a space each side; SessionEngine.kt:226). */
export function reconnectMeta(k: number, total: number): string {
  return `Reconnect · ${k} of ${total}`;
}

/** What one lens screen says (LensContent.Copy). underline = the word of title to underline. */
export interface LensCopy {
  title: string | null;
  sub: string | null;
  meta: string | null;
  footer: boolean;
  underline: string | null;
}

function copy(title: string | null, sub: string | null, meta: string | null, footer = true, underline: string | null = null): LensCopy {
  return {title, sub, meta, footer, underline};
}

// HOLD and TOP_UP have no Figma frame of their own and follow the same style.
const BREATH_STEP_COPY: Readonly<Record<BreathPhase, readonly [string, string]>> = {
  INHALE: ['Breathe In', 'In'],
  TOP_UP: ['A Little More', 'More'],
  HOLD: ['Hold', 'Hold'],
  EXHALE: ['Breathe Out', 'Out'],
};

/** Port of LensContent.copyFor: the text of each card. Off / Blank show nothing. */
export function copyFor(card: GlassCard): LensCopy | null {
  switch (card.kind) {
    case 'Text':
      return copy(card.title, card.subtitle ?? null, card.over ?? null, card.over != null);
    case 'PhaseIntro':
      return copy(card.word, null, `Part ${card.index + 1} of 3`);
    case 'Support':
      // The scene cross-fades its two captions on the timeline; this is the line it settles on.
      return copy(LENS.SUPPORT_LINE, null, null, false, LENS.SUPPORT_UNDERLINE);
    case 'Fingers':
      // Figma 5.1: the scene fades this in once the bracelet has gone.
      return copy(LENS.FINGERS_LINE, null, null, false, LENS.FINGERS_UNDERLINE);
    case 'Sense':
      return card.sense === 'SCENT'
        ? copy('Notice Its Scent.', null, null, false, 'Scent')
        : copy('Feel Its Temperature.', null, null, false, 'Temperature');
    case 'Find':
      return card.stage === 'LOOK'
        ? copy('Take a Look Around.', null, null, false, 'Look')
        : copy(`Notice the ${card.label} Nearby.`, null, null, false, card.label);
    case 'Breath':
      return copy('Breathe with the Rhythm.', null, null, false, 'Rhythm');
    case 'BreathStep': {
      const [title, underline] = BREATH_STEP_COPY[card.phase];
      return copy(title, null, null, false, underline);
    }
    case 'Beads':
      return copy(
        LENS.BEADS_TITLE,
        card.guide === true || card.turned === 0 ? LENS.BEADS_HINT : `${card.turned} of ${card.total}`,
        card.meta ?? null,
      );
    case 'Gaze':
      // Figma 9.1: one line for the whole route; the light shows the way, the voice names it.
      return copy('Slowly Look Around.', null, null, false, 'Look Around');
    case 'Intro':
      return copy(LENS.INTRO_TITLE, card.merging ? null : LENS.INTRO_PINCH, null, false);
    case 'SoundRings':
      // Figma 8.1: the ear in its dotted circle; one line.
      return copy('Notice Sound Around You.', null, null, false, 'Sound');
    case 'Swatch':
      return copy(card.label, null, card.sub);
    case 'Fireflies':
      return copy('Catch 3 fireflies', null, null);
    case 'Steps':
      return copy(card.nodes[card.active] ?? null, null, null);
    case 'Phrase':
      return copy(card.phrase, null, card.cue);
    case 'Ending':
      // Figma 10.1: the scene draws the words with the orbit (they fade with it).
      return copy(LENS.ENDING_LINE, null, null, false);
    case 'Choice':
      return copy('Choose one', null, null);
    case 'Off':
    case 'Blank':
      return null;
  }
}
