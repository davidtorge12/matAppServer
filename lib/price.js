/**
 * Prices were stored as strings, so every read had to be coerced on the client and
 * every write stringified on the server. One bad row — `""`, `"n/a"`, a stray
 * currency symbol — turned into `NaN` and propagated silently into a quote total.
 *
 * These helpers are the one place a price is interpreted, and they are shared by
 * the API routes and the migration script so both agree on what a stored value
 * means.
 */

/** Largest price accepted. Guards a fat-fingered paste, not a real material. */
export const MAX_PRICE = 1_000_000;

/**
 * Reads anything stored or posted as a price and answers with a usable number.
 * Unparseable input, negatives and non-finite values all become 0 rather than
 * poisoning a total.
 */
export function parsePrice(value) {
  if (typeof value === "number") {
    return clamp(value);
  }

  if (typeof value !== "string") {
    return 0;
  }

  // Tolerates what a person actually types: "£1.50", "1,50" is *not* coerced (a
  // comma is ambiguous), but surrounding spaces and a currency symbol are.
  const cleaned = value.trim().replace(/^[£$€]\s*/, "");
  if (!cleaned) {
    return 0;
  }

  return clamp(Number.parseFloat(cleaned));
}

/** True when a stored value is already a clean number needing no migration. */
export function isMigratedPrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function clamp(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  // Rounded to pennies so a stored price cannot carry float noise into a total.
  return Math.min(Math.round(value * 100) / 100, MAX_PRICE);
}
