import { describe, expect, it } from 'vitest';
import { normalize } from './normalize';

type Case = { input: string; expected: string; description: string };

const cases: Case[] = [
  { input: '4БА', expected: '4ba', description: 'Cyrillic 4БА lowercases and transliterates' },
  { input: '4BA', expected: '4ba', description: 'Latin 4BA lowercases' },
  { input: '4ба', expected: '4ba', description: 'Lowercase Cyrillic 4ба transliterates' },
  { input: 'Б.Баатар', expected: 'b.baatar', description: 'Initial form Б.Баатар → b.baatar' },
  { input: 'Б. Баатар', expected: 'b.baatar', description: 'Initial form with space after dot collapses' },
  { input: '3?', expected: '3~', description: '? → ~ wildcard' },
  { input: '5?c', expected: '5~c', description: '? → ~ wildcard inside token' },
  {
    input: 'EB -Munkhbadrakh Khongor-Uchral, preschool 5',
    expected: 'eb -munhbadrah hungur-uchral preschuul 5',
    description: 'Hyphens preserved, comma → space, collapsed spaces, o→u and kh→h folded',
  },
  { input: '', expected: '', description: 'Empty string' },
  { input: '   ', expected: '', description: 'Only whitespace → empty' },
  { input: ',,,...!!!', expected: '', description: 'Pure punctuation → empty' },
  { input: '8Д', expected: '8d', description: '8Д → 8d' },
  { input: 'Э,Амартүвшин', expected: 'e amartuvshin', description: 'Cyrillic name with comma → phonetic transliteration' },
  { input: 'сургалт', expected: 'surgalt', description: 'Cyrillic сургалт → surgalt' },
  { input: 'tulbur', expected: 'tulbur', description: 'Latin tulbur unchanged' },
];

describe('normalize', () => {
  for (const c of cases) {
    it(c.description, () => {
      expect(normalize(c.input)).toBe(c.expected);
    });
  }

  it('preserves + in grade-level codes like 5+', () => {
    expect(normalize('5+A')).toBe('5+a');
  });

  it('folds the o/u romanization split so variant spellings converge', () => {
    // Cyrillic ө→o then folded, Latin o→u: both land on the same form, so a
    // memo and a directory entry that disagree only on these vowels still meet.
    expect(normalize('ДӨЛГӨӨН')).toBe(normalize('Dulguun'));
    expect(normalize('БӨМБӨГ')).toBe('bumbug');
    expect(normalize('Bolor')).toBe(normalize('Bulur'));
  });

  it('folds kh→h so Cyrillic х matches the directory Latin kh spelling', () => {
    // Cyrillic х transliterates to a bare "h"; the directory romanizes it "kh".
    // The fold lands both on "h" so the names meet.
    expect(normalize('ХОНГОР')).toBe(normalize('Khongor'));
    expect(normalize('Мөнхбадрах')).toBe(normalize('Munkhbadrakh'));
    expect(normalize('ХУЛАН')).toBe(normalize('Khulan'));
    expect(normalize('Энхжаргал')).toBe(normalize('Enkhjargal'));
  });

  it('handles a typical memo end-to-end', () => {
    const memo = 'Б.БААТАР 8Д САГСАН БӨМБӨГ';
    const out = normalize(memo);
    expect(out).toMatch(/^b\.baatar 8d /);
  });
});
