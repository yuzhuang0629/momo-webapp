// Every word Momo says or shows. Voice lines port session/Script.kt; lens copy ports
// glasses/LensContent.kt plus the strings SessionEngine.kt puts on cards (snapshot 18:25).
// Voice keeps the gentle Figma copy; never "calm down", "relax", "don't worry", "how do you feel".
import type {BreathPhase, GlassCard} from '../cards';

/** Voice lines (Script.kt). */
export const SCRIPT = {
  BEGIN: 'Take a moment for yourself. Pinch when you are ready to start. You can pinch anytime to move on.',
  SIT_DOWN: 'If you can, sit down for a moment.',
  SUPPORT: 'Notice the support of your seat or the ground.',
  BREATH_INTRO: 'Breathe gently, at your own pace.',
  BREATHE_IN: 'Breathe in…',
  TOP_UP: 'A little more.',
  HOLD: 'Hold. One, two, three.',
  BREATHE_OUT: '…and out.',
  BEADS: 'Turn the beads, one at a time. Swipe your thumb up or down.',
  FINGERS: 'Slowly rub your thumb against your fingertips. Notice how it feels.',
  LOOK_AROUND: "Now, notice what's around you.",
  SMELL: 'If you like, bring it close and notice its smell.',
  TEMPERATURE: 'Gently touch it, and notice if it feels warm or cool.',
  LISTEN: 'Notice one sound around you.',
  GAZE: 'Follow the light with a slow turn of your head.',
  GAZE_DOWN: 'Now look down at your hands.',
  COMFORTABLE: 'Take a moment to get comfortable. You can fix your hair, your clothes, or how you sit.',
  END: "Whenever you're ready, take your next step. Move forward at your own pace.",
  QUICK: "They're calling you. You're ready.",
} as const;

/** Script.feature: "Something blue" → "Find something blue." */
export function featureLine(feature: string): string {
  return `Find ${feature.charAt(0).toLowerCase()}${feature.slice(1)}.`;
}

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
  SUPPORT_LINE: 'Feel the support beneath you.',
  SUPPORT_UNDERLINE: 'support',
  // #6
  FINGERS_TITLE: 'Rub your fingers',
  FINGERS_SUB: 'Thumb against fingertips',
  // #9
  LISTEN_TITLE: 'Listen',
  LISTEN_PROMPT: 'One sound around you',
  // #5
  BEADS_TITLE: 'Turn the beads',
  BEADS_HINT: 'Swipe your thumb up or down',
  // #10
  GAZE_RIGHT: 'Look right',
  GAZE_LEFT: 'Look left',
  GAZE_UP: 'Look up',
  GAZE_DOWN: 'Look at your hands',
  GAZE_GONE: 'Look around slowly',
  // #11
  COMFORTABLE_TITLE: 'Get comfortable',
  COMFORTABLE_SUB: 'Hair, clothes, posture',
  REENTER_META: 'Re-enter',
  // #12 (straight ASCII apostrophe, as in SessionEngine.kt:356)
  END_TITLE: "Whenever you're ready",
  END_SUB: 'Take your next step',
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
      return copy(card.instruction, null, card.meta ?? null, card.target !== 'GONE');
    case 'Intro':
      return copy(LENS.INTRO_TITLE, card.merging ? null : LENS.INTRO_PINCH, null, false);
    case 'SoundRings':
      return copy(card.title ?? LENS.LISTEN_TITLE, card.prompt, card.meta ?? 'Reconnect');
    case 'Swatch':
      return copy(card.label, null, card.sub);
    case 'Fireflies':
      return copy('Catch 3 fireflies', null, null);
    case 'Steps':
      return copy(card.nodes[card.active] ?? null, null, null);
    case 'Phrase':
      return copy(card.phrase, null, card.cue);
    case 'Choice':
      return copy('Choose one', null, null);
    case 'Off':
    case 'Blank':
      return null;
  }
}
