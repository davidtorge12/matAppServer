/**
 * Picks the SOR code for a pasted VO line from Mongo text-search candidates.
 *
 * Catalogue wording (`info`) and the latest job-sheet wording (`description`)
 * both count. A code with a materials list always beats one without, even when
 * the empty one is a closer string match.
 */

export type VoCandidate = {
  code?: string | null;
  info?: string | null;
  description?: string | null;
  materials?: string | null;
  updatedAt?: Date | string | null;
  score?: number | null;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function normalise(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalise(value)
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word));
}

function jaccard(left: string[], right: string[]): number {
  if (!left.length || !right.length) {
    return 0;
  }

  const other = new Set(right);
  const intersection = left.filter((word) => other.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

/** Higher is closer. Exact / contained wording outranks token overlap. */
function wordingScore(term: string, text: unknown): number {
  const needle = normalise(term);
  const haystack = normalise(text);
  if (!needle || !haystack) {
    return 0;
  }
  if (needle === haystack) {
    return 3;
  }
  if (haystack.includes(needle) || needle.includes(haystack)) {
    return 2;
  }
  return jaccard(tokens(needle), tokens(haystack));
}

function closeness(term: string, candidate: VoCandidate): number {
  return Math.max(
    wordingScore(term, candidate.info),
    wordingScore(term, candidate.description),
  );
}

function hasMaterials(candidate: VoCandidate): boolean {
  return Boolean(candidate.materials && String(candidate.materials).trim());
}

function updatedAtMs(candidate: VoCandidate): number {
  const value = candidate.updatedAt;
  if (!value) {
    return 0;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function compareCandidates(term: string, a: VoCandidate, b: VoCandidate): number {
  const materials = Number(hasMaterials(b)) - Number(hasMaterials(a));
  if (materials) {
    return materials;
  }

  const wording = closeness(term, b) - closeness(term, a);
  if (wording) {
    return wording;
  }

  const recency = updatedAtMs(b) - updatedAtMs(a);
  if (recency) {
    return recency;
  }

  return (b.score ?? 0) - (a.score ?? 0);
}

export function pickBestCode(
  term: string,
  candidates: VoCandidate[] | null | undefined,
): string | null {
  if (!term || !String(term).trim() || !candidates?.length) {
    return null;
  }

  const ranked = [...candidates].sort((a, b) => compareCandidates(term, a, b));
  return ranked[0]?.code ?? null;
}
