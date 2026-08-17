/**
 * Pure helpers for the VO matcher. Kept out of the route so the exact output
 * format — which the firm pastes straight into their own system — is covered by
 * tests rather than only being verifiable by hand against a live database.
 */

/** Width the matched code occupies, so unmatched lines stay in the same column. */
const CODE_COLUMN_WIDTH = 7;

export function splitVoLines(text) {
  // Normalised first: a paste from Windows or Excel arrives CRLF, and the stray
  // \r used to survive into the answer on any line that was not trimmed.
  return text.replace(/\r\n?/g, "\n").split("\n");
}

/** True for a VO item to look up: the firm marks those with a leading "x ". */
export function isMatchLine(line) {
  return /^[xX] /.test(line);
}

/**
 * The words to search the SOR catalogue for. Drops the "x " marker, and stops at
 * the first dash because what follows is a location or note ("- bathroom") that
 * only dilutes the relevance score.
 */
export function searchTermFor(line) {
  return line
    .replace(/^[xX] /, "")
    .split("-")[0]
    .trim();
}

/** Renders one answer line: a matched code, or blank padding to the same column. */
export function formatVoLine(line, code) {
  if (!line.trim()) {
    return "";
  }

  if (!isMatchLine(line)) {
    return line;
  }

  const prefix = code ? `${code} ` : " ".repeat(CODE_COLUMN_WIDTH);
  return `${prefix}${line.trim()}`;
}

/** Joins the rendered lines back into the single string the client expects. */
export function joinVoLines(lines) {
  return lines.map((line) => `${line}\n`).join("");
}
