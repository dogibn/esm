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

/**
 * Below this length an edit of 1 is most of the word, and the directory holds
 * plenty of genuinely short names (the school's Korean and Chinese students —
 * "Shin", "Kang", "Ma") for a short token to land on by accident. Measured: on
 * the sample file, dropping this floor is what made bank noise like
 * "ШИНЭ ҮЕ СУРГУУЛЬ" propose a real student.
 */
const MIN_FUZZY_LENGTH = 5;

export function fuzzyMatchNameTokens(
  memoToken: string,
  nameTokenList: string[],
): Array<{ token: string; distance: number }> {
  if (memoToken.length < MIN_FUZZY_LENGTH) return [];
  // Proportional, not absolute: two edits are a typo in an 11-letter Mongolian
  // name and a different word entirely in a 6-letter one.
  const threshold = memoToken.length >= 8 ? 2 : 1;
  // Quick reject: discard tokens with absolute length difference > threshold.
  const hits: Array<{ token: string; distance: number }> = [];
  for (const t of nameTokenList) {
    if (t.length < MIN_FUZZY_LENGTH) continue;
    if (Math.abs(t.length - memoToken.length) > threshold) continue;
    const d = levenshtein(memoToken, t);
    if (d <= threshold) hits.push({ token: t, distance: d });
  }
  hits.sort((a, b) => a.distance - b.distance);
  return hits;
}
