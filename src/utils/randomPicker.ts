// src/utils/randomPicker.ts
import { mulberry32, toList } from "./random";

export type CandidatePool = {
  // human label mainly for debugging
  label: string;
  // raw list text (textarea) OR already-tokenized list
  listText?: string;
  listArray?: string[];
  // user selections (strings coming from BoxEditor UI)
  selections?: string[];
  // whether this section should randomize
  isRandomized: boolean;
};

export function hash32(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeUniqueCaseInsensitive(arr: string[]) {
  const seen = new Set<string>();
  return arr
    .map(s => (s ?? "").trim())
    .filter(Boolean)
    .filter(s => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/**
 * Build the candidate list for a section.
 * Prefers `selections` if present; otherwise falls back to the parsed list.
 */
export function getCandidates(pool: CandidatePool): string[] {
  const base = pool.selections && pool.selections.length > 0
    ? pool.selections
    : (pool.listArray ?? toList(pool.listText || ""));
  return normalizeUniqueCaseInsensitive(base || []);
}

/**
 * Per-section RNG so different sections don't share the same stream.
 * seedBase = -1 => fully random; else deterministic per (seedBase, batchIndex, sectionId).
 */
export function makeSectionRng(seedBase: number, batchIndex: number, sectionId: string) {
  if (Number(seedBase) === -1) {
    return Math.random;
  }
  const s = (Number(seedBase) || 0) + batchIndex + hash32(sectionId);
  return mulberry32(s);
}

/**
 * Single draw: always return exactly one value.
 * For randomized sections: picks randomly from candidates
 * For non-randomized sections: cycles through candidates based on batchIndex
 */
export function pickOneValue(
  pool: CandidatePool,
  seedBase: number,
  batchIndex: number,
  sectionId: string
): string {
  const candidates = getCandidates(pool);
  if (candidates.length === 0) return "";
  
  if (pool.isRandomized) {
    const rng = makeSectionRng(seedBase, batchIndex, sectionId);
    const idx = Math.floor(rng() * candidates.length);
    return candidates[idx];
  }
  
  // Non-randomized: cycle through candidates based on batch index
  const idx = batchIndex % candidates.length;
  return candidates[idx];
}

/**
 * Balanced plan across a batch:
 * - For sections with >1 options: cycles through all options across the batch
 * - For randomized sections: shuffles the order first, then cycles
 * - For non-randomized sections: cycles through in original order
 * - For single options: repeats the same value
 */
export function makeBalancedPlan(
  pool: CandidatePool,
  seedBase: number,
  sectionId: string,
  batchSize: number
): string[] {
  const candidates = getCandidates(pool);
  if (candidates.length === 0) return Array(batchSize).fill("");

  // Single option: just repeat it
  if (candidates.length === 1) {
    return Array(batchSize).fill(candidates[0] ?? "");
  }

  // Multiple options: create a cycle
  let order = [...candidates];
  
  // If randomized, shuffle the order first
  if (pool.isRandomized) {
    const rng = (Number(seedBase) === -1)
      ? Math.random
      : mulberry32((Number(seedBase) || 0) + hash32(sectionId));
    
    // Fisher-Yates shuffle
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  // If not randomized, keep original order

  // Cycle through the order across the batch
  const picks: string[] = [];
  for (let b = 0; b < batchSize; b++) {
    picks.push(order[b % order.length]);
  }
  return picks;
}
