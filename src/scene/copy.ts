// What each lens screen says: port of LensContent.copyFor (LC:32-71).
import type {GlassCard} from '../cards';

export interface Copy {
  title: string | null;
  sub: string | null;
  meta: string | null;
  footer: boolean;
  underline: string | null;
}

export const PINCH_HINT = 'Pinch to move on';
export const SIT_LINE = 'Slowly Sit Down';
/** Figma Component 8 sets it on two lines ("\n"), the key word capitalised. */
export const SUPPORT_LINE = 'Feel the Support\nbeneath you.';
export const FINGERS_LINE = 'Focus on the feeling of two\nfingers rubbing together.';

function copy(title: string | null, sub: string | null, meta: string | null = null, footer = true, underline: string | null = null): Copy {
  return {title, sub, meta, footer, underline};
}

export function copyFor(card: GlassCard): Copy | null {
  switch (card.kind) {
    case 'Text':
      return copy(card.title, card.subtitle ?? null, card.over ?? null, card.over != null);
    case 'PhaseIntro':
      return copy(card.word, null, `Part ${card.index + 1} of 3`);
    case 'Support':
      // Figma Component 8 (2.1–2.5): drawSupport cross-fades its two captions on the timeline;
      // this is the line the screen settles on.
      return copy(SUPPORT_LINE, null, null, false, 'Support');
    case 'Fingers':
      // Figma 5.1: drawFingers fades this in once the bracelet has gone.
      return copy(FINGERS_LINE, null, null, false, 'rubbing');
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
    case 'BreathStep':
      switch (card.phase) {
        case 'INHALE':
          return copy('Breathe In', null, null, false, 'In');
        case 'TOP_UP':
          return copy('A Little More', null, null, false, 'More');
        case 'HOLD':
          return copy('Hold', null, null, false, 'Hold');
        case 'EXHALE':
          return copy('Breathe Out', null, null, false, 'Out');
      }
      break;
    // Figma 4.0 (113-1157) has no words: the bracelet and its dashed arrow; the voice explains.
    case 'Beads':
      return copy(null, null, null, false);
    case 'Gaze':
      // Figma 9.1: one line for the whole route; the light shows the way, the voice names it.
      return copy('Slowly Look Around.', null, null, false, 'Look Around');
    case 'Intro':
      return copy('Take a moment for yourself.', card.merging ? null : 'Pinch to start', null, false);
    case 'SoundRings':
      // Figma 8.1: the ear in its dotted circle; one line.
      return copy('Notice Sound Around You.', null, null, false, 'Sound');
    case 'Swatch':
      return copy(card.label, null, card.sub);
    case 'Fireflies':
      return copy('Catch 3 fireflies', null, null);
    case 'Steps':
      return copy(card.nodes[card.active] ?? '', null, null);
    case 'Phrase':
      return copy(card.phrase, null, card.cue);
    case 'Choice':
      return copy('Choose one', null, null);
    case 'Off':
    case 'Blank':
      return null;
  }
  return null;
}
