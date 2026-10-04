// The team's recorded voice lines (the 旁白 mp3s, public/voice/), one per Script line. Port of
// momo-android audio/Narration.kt (snapshot 20:54): a line maps to its clip by its exact text, so
// voice.say(line) finds the recording for whatever the engine says. This is the only place the
// mapping lives.
import {SCRIPT, type ScriptLine} from './engine/script';

const clip = (name: string): string => `/voice/voice_${name}.mp3`;

/** Exact line text → clip URL (Narration.clips). */
export const NARRATION: Readonly<Record<ScriptLine, string>> = {
  [SCRIPT.BEGIN]: clip('take_a_moment'),
  [SCRIPT.SIT_DOWN]: clip('sit_down'),
  [SCRIPT.SUPPORT]: clip('feel_the_support'),
  [SCRIPT.BREATH_1]: clip('breath_1'),
  [SCRIPT.BREATH_2]: clip('breath_2'),
  [SCRIPT.BEADS]: clip('roll_fingers'),
  [SCRIPT.FINGERS]: clip('fingertips'),
  [SCRIPT.LOOK_AROUND]: clip('look_around'),
  [SCRIPT.FIND_OBJECT]: clip('find_object'),
  [SCRIPT.NOTICE_OBJECT]: clip('notice_object'),
  [SCRIPT.TOUCH]: clip('touching'),
  [SCRIPT.TAKE_YOUR_TIME]: clip('take_your_time'),
  [SCRIPT.LISTEN]: clip('one_sound'),
  [SCRIPT.JUST_NOTICE]: clip('just_notice'),
  [SCRIPT.GAZE]: clip('slowly_look_around'),
  [SCRIPT.COMFORTABLE]: clip('adjust'),
  [SCRIPT.CHECK_CAMERA]: clip('check_camera'),
  [SCRIPT.END]: clip('move_forward'),
  [SCRIPT.QUICK]: clip('youre_ready'),
};

/** The clip for a line, or null (e.g. a line with no recording, or a stage direction). */
export function clipFor(line: string): string | null {
  return (NARRATION as Readonly<Record<string, string>>)[line] ?? null;
}

/**
 * The order the session speaks its lines in (USER_FLOW #3 → #12), which is the order the clips are
 * fetched in. BEGIN is said while the start screen waits, before the wearer's first pinch has
 * unlocked the voice, so it is only ever needed on a restart; it goes last.
 */
export const FLOW_ORDER: readonly ScriptLine[] = [
  SCRIPT.SIT_DOWN, SCRIPT.SUPPORT, // #3
  SCRIPT.BREATH_1, SCRIPT.BREATH_2, // #4
  SCRIPT.BEADS, // #5
  SCRIPT.FINGERS, // #6
  SCRIPT.LOOK_AROUND, SCRIPT.NOTICE_OBJECT, SCRIPT.FIND_OBJECT, // #7 (items 2 and 3 repeat these)
  SCRIPT.TOUCH, SCRIPT.TAKE_YOUR_TIME, // #8
  SCRIPT.LISTEN, SCRIPT.JUST_NOTICE, // #9
  SCRIPT.GAZE, // #10
  // (#11 "get comfortable" was dropped 2026-10-04; its two recordings stay mapped above, unused.)
  SCRIPT.END, // #12
  SCRIPT.BEGIN,
];

/** The first line of each USER_FLOW step (the start screen's pinch leads into #3). */
const STEP_FIRST_LINE: Readonly<Record<number, ScriptLine>> = {
  2: SCRIPT.SIT_DOWN,
  3: SCRIPT.SIT_DOWN,
  4: SCRIPT.BREATH_1,
  5: SCRIPT.BEADS,
  6: SCRIPT.FINGERS,
  7: SCRIPT.LOOK_AROUND,
  8: SCRIPT.TOUCH,
  9: SCRIPT.LISTEN,
  10: SCRIPT.GAZE,
  11: SCRIPT.END, // #11 was dropped: a jump there lands on the ending
  12: SCRIPT.END,
};

/** Index in FLOW_ORDER of the first line of USER_FLOW step n (0 when unknown). */
export function flowIndexOfStep(step: number): number {
  const line = STEP_FIRST_LINE[step];
  return line ? Math.max(0, FLOW_ORDER.indexOf(line)) : 0;
}
