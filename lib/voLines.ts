/**
 * Pure helpers for the VO matcher. Kept out of the route so the exact output
 * format — which the firm pastes straight into their own system — is covered by
 * tests rather than only being verifiable by hand against a live database.
 */

/** Width the matched code occupies, so unmatched lines stay in the same column. */
const CODE_COLUMN_WIDTH = 7;

export function splitVoLines(text: string): string[] {
  // Normalised first: a paste from Windows or Excel arrives CRLF, and the stray
  // \r used to survive into the answer on any line that was not trimmed.
  return text.replace(/\r\n?/g, "\n").split("\n");
}

/** True for a VO item to look up: the firm marks those with a leading "x ". */
export function isMatchLine(line: string): boolean {
  return /^[xX] /.test(line);
}

/**
 * The words to search the SOR catalogue for. Drops the "x " marker, and stops at
 * the first dash because what follows is a location or note ("- bathroom") that
 * only dilutes the relevance score.
 */
export function searchTermFor(line: string): string {
  return line
    .replace(/^[xX] /, "")
    .split("-")[0]
    .trim();
}

/** Renders one answer line: a matched code, or blank padding to the same column. */
export function formatVoLine(
  line: string,
  code: string | null | undefined,
): string {
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
export function joinVoLines(lines: readonly string[]): string {
  return lines.map((line) => `${line}\n`).join("");
}

/**
 * Normalises pasted VO lines to the form the matcher expects: `x ` then the
 * work name. Each row is trimmed; an existing marker is kept but collapsed to a
 * single space so "x  name" and "X name" both become "x name".
 */
export function serializeVo(text: string): string {
  return splitVoLines(text).map(serializeVoLine).join("\n");
}

function serializeVoLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }

  // Match codes prefixes the SOR code: "P1234 x name". Don't wrap that again.
  const matched = trimmed.match(/^(\S+)\s+[xX]\s+(.*)$/);
  if (matched && !/^[xX]$/.test(matched[1])) {
    return `${matched[1]} x ${matched[2].trim()}`;
  }

  const name = trimmed.replace(/^[xX]\s+/, "").trim();
  return `x ${name}`;
}
