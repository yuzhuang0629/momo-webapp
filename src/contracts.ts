// Seams between the session engine, the lens scene and the shell (main.ts).
// One virtual clock drives everything: main.ts measures real dt, multiplies it by the director
// speed, and passes the same scaled dt to engine.tick() and scene.step() every frame (30 fps).
import type {GlassCard} from './cards';

/** Lens renderer (port of GlassScene.kt). Draws the whole 600×600 frame on a 2D canvas. */
export interface LensScene {
  /** New target card; the scene morphs/cross-fades toward it like GlassScene.apply(card). */
  apply(card: GlassCard): void;
  /** Advance all springs/timelines by dtMs of virtual time (already speed-scaled, ≤ 50 ms). */
  step(dtMs: number): void;
  /** Paint the current frame. Clears to black first (black = transparent on the lens). */
  draw(ctx: CanvasRenderingContext2D): void;
  /** Pinch feedback ripple (GlassScene.ripple). */
  ripple(): void;
  /** Forget everything and show black (used by the director's restart). */
  reset(): void;
  /** When true (prefers-reduced-motion), jump animations to their end states. */
  reducedMotion: boolean;
}

/** What the engine asks the shell to do. */
export interface EngineHost {
  show(card: GlassCard): void;
  /** Speak one voice line (interrupts the previous one). Empty string = stop speaking. */
  say(text: string): void;
  ripple(): void;
  log(message: string): void;
  /** The bead "clack" when the bracelet moves one bead (#5; SessionOutput.beadClick). Optional. */
  click?(): void;
  /** Background music level (USER_FLOW 2.5); every change fades. */
  music?(level: MusicLevel): void;
}

export type MusicLevel = 'OFF' | 'LOW' | 'FULL';

/** Wearer inputs, already mapped from keys: Enter = Select, ArrowLeft/Up = Previous,
 * ArrowRight/Down = Next, Back (popstate/Escape) = QuickExit. Stop = end at once (director). */
export type EngineInput = 'Select' | 'Next' | 'Previous' | 'QuickExit' | 'Stop';

export interface SessionEngine {
  /** Show the start screen (#2) and wait for Select or its auto-start timeout. */
  start(): void;
  input(input: EngineInput): void;
  /** Advance the virtual clock by dtMs (same scaled dt the scene gets). */
  tick(dtMs: number): void;
  /** Current coarse phase, e.g. 'IDLE' | 'PAUSE' | 'RECONNECT' | 'REENTER' | 'END' | 'SAFE_IDLE'. */
  readonly phase: string;
  /** Current USER_FLOW step number (2…12), 0 before start. */
  readonly step: number;
  /** Director: restart the session and fast-forward to the beginning of USER_FLOW step n. */
  jumpTo(step: number): void;
}

/** Recording controls read once from the URL (never drawn on the lens). */
export interface DirectorOptions {
  /** Virtual-time multiplier (1 = real time). URL ?speed=0.5 */
  speed: number;
  /** Start directly at this USER_FLOW step. URL ?step=7 */
  step: number | null;
  /** Skip the start screen wait and begin immediately. URL ?autostart=1 */
  autostart: boolean;
  /** Find-three preset set id. URL ?preset=b */
  preset: string;
  /** Sense branch after the third item. URL ?sense=scent|temperature */
  sense: 'SCENT' | 'TEMPERATURE' | null;
  /** Background music on/off. URL ?music=0 */
  music: boolean;
  /** Voice lines on/off. URL ?voice=0 */
  voice: boolean;
  /** Seed for the engine's PRNG (the gaze route), so every take of one URL is the same. URL ?seed=7 */
  seed: number;
}
