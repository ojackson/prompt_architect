/**
 * Mulberry32 PRNG implementation for consistent random number generation
 */
export function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a random element from an array using the provided RNG function
 */
export function pickOne<T>(arr: T[], rng: () => number): T {
  if (!arr || arr.length === 0) return "" as T;
  const i = Math.floor(rng() * arr.length);
  return arr[i];
}

/**
 * Convert text to a list of unique, trimmed strings
 */
export function toList(text: string): string[] {
  if (!text) return [];
  const raw = text
    .split(/[\n,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  return raw.filter((t) =>
    seen.has(t.toLowerCase()) ? false : (seen.add(t.toLowerCase()), true)
  );
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
