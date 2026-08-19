/**
 * Unique material names as stored, first spelling kept, ordered for a typeahead.
 */
export function listMaterialNames(rows: Array<{ material?: unknown }>): string[] {
  const displayByCanonical = new Map<string, string>();

  for (const row of rows) {
    const name = typeof row.material === "string" ? row.material.trim() : "";
    if (!name) {
      continue;
    }

    const canonical = name.toLowerCase();
    if (!displayByCanonical.has(canonical)) {
      displayByCanonical.set(canonical, name);
    }
  }

  return [...displayByCanonical.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}
