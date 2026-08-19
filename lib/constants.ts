/**
 * Rows per page for `/latest`. The client mirrors this in
 * `matApp/src/pagination.ts` — the two must agree or the pager miscounts, so
 * change both together.
 */
export const PAGE_SIZE = 20;

/** Ceiling on a single `/codes` upload batch; the client posts chunks of 50. */
export const MAX_CODES_PER_REQUEST = 500;

/** Ceiling on a single `/vo` request, so one paste cannot fan out unbounded. */
export const MAX_VO_LINES = 500;
