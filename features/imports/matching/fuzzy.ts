export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n] ?? 0;
}

export function fuzzyMatchNameTokens(
  memoToken: string,
  nameTokenList: string[],
): Array<{ token: string; distance: number }> {
  const threshold = memoToken.length <= 6 ? 1 : 2;
  // Quick reject: discard tokens with absolute length difference > threshold.
  const hits: Array<{ token: string; distance: number }> = [];
  for (const t of nameTokenList) {
    if (Math.abs(t.length - memoToken.length) > threshold) continue;
    const d = levenshtein(memoToken, t);
    if (d <= threshold) hits.push({ token: t, distance: d });
  }
  hits.sort((a, b) => a.distance - b.distance);
  return hits;
}
