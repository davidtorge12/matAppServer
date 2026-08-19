/**
 * `Array.map` with a ceiling on how many callbacks are in flight. Results stay in
 * input order. Used instead of `Promise.all` so a long VO paste does not open one
 * database operation per line at once, and instead of a plain `for await` loop so
 * it is not strictly sequential either.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    worker,
  );
  await Promise.all(workers);

  return results;
}
