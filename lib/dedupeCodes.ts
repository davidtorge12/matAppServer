/**
 * Pure merge plan for duplicate `Codes` documents that share the same `code`.
 * The script applies this against Atlas; keeping it here means the "which copy
 * survives" rules are unit-tested rather than only visible in a dry-run log.
 */

const MERGE_FIELDS = [
  "description",
  "info",
  "unit",
  "price",
  "materials",
] as const;

type MergeField = (typeof MERGE_FIELDS)[number];

export type CodeCopy = {
  _id: string;
  code: string;
  description?: string;
  info?: string;
  unit?: string;
  price?: string;
  materials?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type DedupePlan = {
  code: string;
  keepId: string;
  dropIds: string[];
  /** Fields the keeper is missing that a discarded copy still holds. */
  set: Partial<Record<MergeField, string>>;
};

function blank(value: string | undefined): boolean {
  return !value || !value.trim();
}

function filled(value: string | undefined): value is string {
  return !blank(value);
}

function recency(doc: CodeCopy): number {
  const updated = doc.updatedAt?.getTime() ?? 0;
  const created = doc.createdAt?.getTime() ?? 0;
  return updated || created;
}

/** Newest `updatedAt`, then newest `createdAt`, then smallest `_id`. */
function compareCopies(a: CodeCopy, b: CodeCopy): number {
  const byRecency = recency(b) - recency(a);
  if (byRecency !== 0) {
    return byRecency;
  }
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
}

function salvage(keeper: CodeCopy, rest: CodeCopy[]): DedupePlan["set"] {
  const set: DedupePlan["set"] = {};
  const newestFirst = [...rest].sort(compareCopies);

  for (const field of MERGE_FIELDS) {
    if (filled(keeper[field])) {
      continue;
    }
    const donor = newestFirst.find((copy) => filled(copy[field]));
    if (donor) {
      set[field] = donor[field];
    }
  }

  return set;
}

/**
 * One plan per code that appears more than once. Unique codes are ignored.
 * Grouping trims `code` so a padded leftover from before schema `trim` still
 * collapses with the canonical value.
 */
export function planDedupe(docs: readonly CodeCopy[]): DedupePlan[] {
  const groups = new Map<string, CodeCopy[]>();

  for (const doc of docs) {
    const code = doc.code.trim();
    if (!code) {
      continue;
    }
    const group = groups.get(code);
    if (group) {
      group.push(doc);
    } else {
      groups.set(code, [doc]);
    }
  }

  const plans: DedupePlan[] = [];

  for (const [code, copies] of groups) {
    if (copies.length < 2) {
      continue;
    }

    const ranked = [...copies].sort(compareCopies);
    const keeper = ranked[0];
    const rest = ranked.slice(1);
    if (!keeper) {
      continue;
    }

    plans.push({
      code,
      keepId: keeper._id,
      dropIds: rest.map((copy) => copy._id),
      set: salvage(keeper, rest),
    });
  }

  return plans;
}

export type IndexInfo = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
};

export type CodeIndexAction =
  | { action: "ok" }
  | { action: "create" }
  | { action: "replace"; name: string };

function isCodeOnlyIndex(index: IndexInfo): boolean {
  const keys = Object.keys(index.key);
  return keys.length === 1 && keys[0] === "code";
}

/**
 * What to do with the `{ code: 1 }` index so it can become unique without
 * touching the text index or any compound key that happens to include `code`.
 */
export function codeIndexAction(indexes: readonly IndexInfo[]): CodeIndexAction {
  const existing = indexes.find(isCodeOnlyIndex);
  if (!existing) {
    return { action: "create" };
  }
  if (existing.unique) {
    return { action: "ok" };
  }
  return { action: "replace", name: existing.name ?? "code_1" };
}
