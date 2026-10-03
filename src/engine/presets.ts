// Faked "find three things" results. The four built-ins port ai/PresetVisionService.kt exactly
// (same order, labels and colours); A/B/C are the demo sets from spec 01 §6.4. The real app
// picks a built-in at random; the web app always picks by id so a take is repeatable.
//
// Ids: '1'…'4' = built-ins P0…P3, 'a' = classic (= P0), 'b' = warm desk (= P2),
// 'c' = coffee (scent branch, not in the Kotlin code). Default: 'a'.

/** Port of ai/VisionService.kt VisionResult (without the internal `objects`). */
export interface FindSet {
  readonly id: PresetId;
  readonly name: string;
  /** Spoken as "Find {feature}." — never the object's name. */
  readonly features: readonly [string, string, string];
  /** Picks #8: true = "Notice Its Scent.", false = "Feel Its Temperature.". */
  readonly touchTargetHasSmell: boolean;
  /** Lens words for "Notice the ___ Nearby.". */
  readonly labels: readonly [string, string, string];
  /** #RRGGBB tint of the 6.2 dotted circle. */
  readonly colors: readonly [string, string, string];
}

export type PresetId = '1' | '2' | '3' | '4' | 'a' | 'b' | 'c';

export const DEFAULT_PRESET_ID: PresetId = 'a';

type SetData = Omit<FindSet, 'id' | 'name'>;

// PresetVisionService.kt:11-20. Presets never use the smell branch.
const P0: SetData = {
  features: ['Something round', 'Something blue', 'Something soft you can touch'],
  touchTargetHasSmell: false,
  labels: ['Round Item', 'Blue Item', 'Soft Item'],
  colors: ['#FFFFFF', '#6FA8FF', '#FFFFFF'],
};
const P1: SetData = {
  features: ['Something rectangular', 'Something white', 'The fabric of your sleeve'],
  touchTargetHasSmell: false,
  labels: ['Rectangular Item', 'White Item', 'Fabric Item'],
  colors: ['#FFFFFF', '#FFFFFF', '#FFFFFF'],
};
const P2: SetData = {
  features: ['Something made of wood', 'Something green', 'Something smooth you can touch'],
  touchTargetHasSmell: false,
  labels: ['Wooden Item', 'Green Item', 'Smooth Item'],
  colors: ['#C9905F', '#8FD18B', '#FFFFFF'],
};
const P3: SetData = {
  features: ['Something with straight edges', 'Something dark', 'The fabric of your clothes'],
  touchTargetHasSmell: false,
  labels: ['Straight Item', 'Dark Item', 'Fabric Item'],
  colors: ['#FFFFFF', '#8C8C8C', '#FFFFFF'],
};
// Spec 01 §6.4 set C: the "AI success with smell" case (USER_FLOW:252), e.g. a coffee cup in hand.
const COFFEE: SetData = {
  features: ['Something round', 'Something orange', 'Something made of paper'],
  touchTargetHasSmell: true,
  labels: ['Round Item', 'Orange Item', 'Paper Item'],
  colors: ['#FFFFFF', '#FFA552', '#FFFFFF'],
};

export const FIND_SETS: Readonly<Record<PresetId, FindSet>> = {
  '1': {id: '1', name: 'preset 0: round / blue / soft', ...P0},
  '2': {id: '2', name: 'preset 1: rectangular / white / sleeve', ...P1},
  '3': {id: '3', name: 'preset 2: wood / green / smooth', ...P2},
  '4': {id: '4', name: 'preset 3: straight / dark / clothes', ...P3},
  a: {id: 'a', name: 'classic (preset 0, temperature)', ...P0},
  b: {id: 'b', name: 'warm desk (preset 2, temperature)', ...P2},
  c: {id: 'c', name: 'coffee (scent)', ...COFFEE},
};

export function isPresetId(id: string): id is PresetId {
  return Object.hasOwn(FIND_SETS, id);
}

/** Case-insensitive lookup; unknown ids fall back to the default set. */
export function presetById(id: string): FindSet {
  const key = id.trim().toLowerCase();
  return FIND_SETS[isPresetId(key) ? key : DEFAULT_PRESET_ID];
}

// ---- VisionResult.label / color fallbacks (VisionService.kt:24-55), for sets missing a field.

/** Colour words → circle colours that read on the additive lens (black emits no light). */
export const COLOR_HEX: ReadonlyArray<readonly [string, string]> = [
  ['white', '#FFFFFF'], ['gray', '#B4B4B4'], ['grey', '#B4B4B4'], ['silver', '#C8CCD2'],
  ['black', '#8C8C8C'], ['dark', '#8C8C8C'], ['red', '#FF6B6B'], ['orange', '#FFA552'],
  ['yellow', '#FFE066'], ['gold', '#E8C35A'], ['green', '#8FD18B'], ['blue', '#6FA8FF'],
  ['purple', '#B79CFF'], ['pink', '#FF9EC8'], ['brown', '#C9905F'], ['beige', '#E6D3B3'],
];

const MATERIAL_ADJ: ReadonlyArray<readonly [string, string]> = [
  ['wood', 'Wooden'], ['metal', 'Metal'], ['glass', 'Glass'], ['fabric', 'Fabric'],
  ['plastic', 'Plastic'], ['paper', 'Paper'], ['leather', 'Leather'],
];
const SKIP = new Set(['something', 'the', 'a', 'an', 'of', 'your', 'made', 'with', 'that', 'is', 'you', 'can']);
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** "Something orange" → "Orange Item", "Something made of wood" → "Wooden Item". */
export function labelFrom(feature: string): string {
  const words = feature.toLowerCase().replace(/[^a-z ]/g, ' ').split(' ').filter(w => w.trim() !== '');
  const material = MATERIAL_ADJ.find(([k]) => words.includes(k));
  if (material) return `${material[1]} Item`;
  const adj = words.find(w => !SKIP.has(w));
  return adj ? `${adj.charAt(0).toUpperCase()}${adj.slice(1)} Item` : 'Nearby Item';
}

export function colorFrom(feature: string): string {
  const words = feature.toLowerCase().split(/[^a-z]+/);
  return COLOR_HEX.find(([k]) => words.includes(k))?.[1] ?? '#FFFFFF';
}

export function labelAt(set: FindSet, i: number): string {
  const label = set.labels[i]?.trim();
  return label ? label : labelFrom(set.features[i] ?? '');
}

export function colorAt(set: FindSet, i: number): string {
  const color = set.colors[i];
  return color !== undefined && HEX.test(color) ? color : colorFrom(set.features[i] ?? '');
}
