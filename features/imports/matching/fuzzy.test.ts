import { describe, expect, it } from 'vitest';
import { fuzzyMatchNameTokens, levenshtein } from './fuzzy';

describe('levenshtein', () => {
  const cases: Array<[string, string, number]> = [
    ['', '', 0],
    ['', 'abc', 3],
    ['abc', '', 3],
    ['abc', 'abc', 0],
    ['abc', 'abd', 1],
    ['kitten', 'sitting', 3],
    ['amartuvshin', 'amartubshin', 1],
    ['baatar', 'baatap', 1],
  ];
  for (const [a, b, d] of cases) {
    it(`distance(${JSON.stringify(a)}, ${JSON.stringify(b)}) = ${d}`, () => {
      expect(levenshtein(a, b)).toBe(d);
    });
  }
});

describe('fuzzyMatchNameTokens', () => {
  it('tokens under 8 chars use threshold 1', () => {
    const hits = fuzzyMatchNameTokens('baatar', ['baatap', 'beetle', 'foo']);
    expect(hits.map((h) => h.token)).toEqual(['baatap']);
  });

  it('refuses to fuzzy-match a short token at all', () => {
    expect(fuzzyMatchNameTokens('shin', ['shine', 'chin', 'shim'])).toEqual([]);
  });

  it('never proposes a short directory name as a fuzzy hit', () => {
    expect(fuzzyMatchNameTokens('shine', ['shin', 'kang'])).toEqual([]);
  });

  it('long tokens (≥8 chars) use threshold 2', () => {
    const hits = fuzzyMatchNameTokens('amartuvshin', ['amartubshin', 'amartuvshim', 'totally-different']);
    expect(hits.map((h) => h.token).sort()).toEqual(['amartubshin', 'amartuvshim']);
  });

  it('returns sorted by ascending distance', () => {
    const hits = fuzzyMatchNameTokens('amartuvshin', ['amartuvshim', 'amartuvshin', 'amartuvshjm']);
    expect(hits[0]!.token).toBe('amartuvshin');
    expect(hits[0]!.distance).toBe(0);
  });

  it('returns empty when nothing is close enough', () => {
    expect(fuzzyMatchNameTokens('baatar', ['xyz'])).toEqual([]);
  });
});
