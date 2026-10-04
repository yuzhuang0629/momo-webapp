// What the lens shows. TypeScript port of momo-android glasses/GlassCard.kt (snapshot 18:25,
// 2026-10-03). The engine emits cards; the scene morphs toward the latest one.

export type Pose = 'Seed' | 'Orb' | 'Small' | 'Ring' | 'Cool' | 'Steady' | 'Line' | 'Dim' | 'Exhale';

export type ObjectKind =
  | 'Hand' | 'Feet' | 'Flower' | 'Plant' | 'Cup' | 'Scent' | 'Fabric' | 'Stem'
  | 'Stones' | 'Bubble' | 'Bowl' | 'Firefly' | 'Seat' | 'Fingers' | 'Look';

export type GazeTarget = 'CENTER' | 'RIGHT' | 'LEFT' | 'UP' | 'DOWN' | 'GONE';

export type BreathPhase = 'INHALE' | 'TOP_UP' | 'HOLD' | 'EXHALE';

export type SenseKind = 'SCENT' | 'TEMPERATURE';

export type FindStage = 'LOOK' | 'NOTICE' | 'ITEM';

export type GlassCard =
  | {
      kind: 'Text';
      title: string;
      subtitle?: string | null;
      pose?: Pose;
      obj?: ObjectKind | null;
      over?: string | null;
      fromSeed?: boolean;
      /** For Plant: growth stage to animate to (0 seed … 3 bloom). */
      grow?: number | null;
    }
  | {kind: 'PhaseIntro'; word: string; index: number}
  /** "Sit down and feel support"; durationMs is already scaled. */
  | {kind: 'Support'; sitFirst: boolean; durationMs: number}
  /** Find three things, one item at a time; index 0…2. */
  | {kind: 'Find'; stage: FindStage; label: string; colorHex: string; index: number; total: number}
  | {kind: 'Sense'; sense: SenseKind}
  /** Breathing intro: ring opens from inner to outer circle over durationMs (already scaled). */
  | {kind: 'Breath'; breaths: number; durationMs: number}
  /** One breathing phase; topUp = cyclic sigh. durationMs already scaled. */
  | {
      kind: 'BreathStep';
      phase: BreathPhase;
      durationMs: number;
      index: number;
      total: number;
      countHold: boolean;
      topUp?: boolean;
    }
  /**
   * Rub your fingers (USER_FLOW #6, Figma 5.0 → 5.3 → 5.1): a hand rubs its thumb over the
   * bracelet, one bead per rub; after two rubs the bracelet fades and the two-dots page with its
   * caption fades in. durationMs (already scaled) is how long the step lasts.
   */
  | {kind: 'Fingers'; durationMs: number}
  | {kind: 'Swatch'; colorHex: string; label: string; sub: string; found: number}
  | {kind: 'SoundRings'; prompt: string | null; title?: string; meta?: string | null}
  | {kind: 'Fireflies'; target: number; caught: number; reached?: boolean}
  /** Prayer-bead bracelet; dir -1 up, +1 down; guide = turns by itself to show the gesture. */
  | {kind: 'Beads'; turned: number; total: number; dir?: number; guide?: boolean; meta?: string | null}
  /** Start screen; merging = un-draw back to the centre dot on exit. Durations already scaled. */
  | {kind: 'Intro'; merging: boolean; durationMs: number; fadeOutMs?: number}
  | {kind: 'Gaze'; target: GazeTarget; instruction: string; meta?: string | null}
  | {kind: 'Steps'; nodes: string[]; active: number}
  | {kind: 'Phrase'; cue: string; phrase: string}
  | {kind: 'Choice'; options: string[]; selected: number; dir?: number; confirmed?: boolean}
  /** Contract to a seed and fade out ("lights out"). */
  | {kind: 'Off'}
  | {kind: 'Blank'};

export type CardKind = GlassCard['kind'];
