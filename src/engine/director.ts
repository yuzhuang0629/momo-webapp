// Recording controls read once from the URL. Nothing here is ever drawn on the lens.
import type {DirectorOptions} from '../contracts';
import {DEFAULT_PRESET_ID, isPresetId} from './presets';

const MIN_SPEED = 0.1;
const MAX_SPEED = 4;
/** ?seed default: the route the team reviews. */
export const DEFAULT_SEED = 1;
const FIRST_STEP = 2;
const LAST_STEP = 12;

const TRUE_WORDS = new Set(['1', 'true', 'yes', 'on']);
const FALSE_WORDS = new Set(['0', 'false', 'no', 'off']);

function flag(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  const v = value.trim().toLowerCase();
  if (v === '') return true; // bare "?autostart" means on
  if (TRUE_WORDS.has(v)) return true;
  if (FALSE_WORDS.has(v)) return false;
  return fallback;
}

/**
 * ?speed=0.1…4 (default 1) · ?step=2…12 · ?autostart=1 · ?preset=1|2|3|4|a|b|c|d (default d)
 * · ?sense=scent|temperature (default: the preset's own branch) · ?voice=0 (default on) · ?music=0
 * · ?seed=<int> (default 1; the gaze route).
 */
export function readDirectorOptions(search: string): DirectorOptions {
  const q = new URLSearchParams(search);

  const speedRaw = Number.parseFloat(q.get('speed') ?? '');
  const speed = Number.isFinite(speedRaw) ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, speedRaw)) : 1;

  const stepRaw = Number.parseInt(q.get('step') ?? '', 10);
  const step = Number.isInteger(stepRaw) && stepRaw >= FIRST_STEP && stepRaw <= LAST_STEP ? stepRaw : null;

  const presetRaw = (q.get('preset') ?? '').trim().toLowerCase();
  const preset = isPresetId(presetRaw) ? presetRaw : DEFAULT_PRESET_ID;

  const senseRaw = (q.get('sense') ?? '').trim().toLowerCase();
  const sense = senseRaw === 'scent' || senseRaw === 'smell'
    ? 'SCENT'
    : senseRaw === 'temperature' || senseRaw === 'temp'
      ? 'TEMPERATURE'
      : null;

  const seedRaw = Number.parseInt(q.get('seed') ?? '', 10);
  const seed = Number.isInteger(seedRaw) ? seedRaw >>> 0 : DEFAULT_SEED;

  return {
    speed,
    step,
    autostart: flag(q.get('autostart'), false),
    preset,
    sense,
    voice: flag(q.get('voice'), true),
    music: flag(q.get('music'), true),
    seed,
  };
}
