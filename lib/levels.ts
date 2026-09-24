/**
 * Fixed level catalogue. The app owns progression (BR-03) and sends the
 * levelIds for each session; this module maps an id to a reproducible board.
 */
export const GAME_ID = 'shapes';
export const LEVEL_COUNT = 252;
/** Rounds used when the game runs standalone, with no app bridge (BR-09). */
export const STANDALONE_ROUNDS = 6;

const ID_PATTERN = /^shapes-(\d{3})$/;

export function levelIdFromNumber(n: number): string {
  return `shapes-${String(n).padStart(3, '0')}`;
}

/** Returns the catalogue number (1..LEVEL_COUNT) or null for an unknown id. */
export function parseLevelId(id: string): number | null {
  const m = ID_PATTERN.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= LEVEL_COUNT ? n : null;
}

/** Deterministic, well-spread seed in the generator's valid range (1..2^31-2). */
export function seedForLevel(n: number): number {
  let h = Math.imul(n, 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822507) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 2147483646) + 1;
}

/** Starting rotation of the goal tile, also fixed per level. */
export function startRotationForLevel(n: number): number {
  return [0, 90, 180, 270][seedForLevel(n + 100000) % 4];
}

export function standaloneLevelIds(): string[] {
  return Array.from({ length: STANDALONE_ROUNDS }, (_, i) => levelIdFromNumber(i + 1));
}
