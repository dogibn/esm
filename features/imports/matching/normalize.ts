// Cyrillic → Latin transliteration. Phonetic where memo-style writing
// (Latin transliteration of Mongolian) and pure-Cyrillic memos need to land
// on the same normalized form. The table is intentionally lossy on rare
// distinctions (ү vs у both → u) because real-world memo writers don't
// distinguish them either.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ү: 'u',
  ө: 'o',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterateChar(ch: string): string {
  return CYRILLIC_TO_LATIN[ch] ?? ch;
}

export function normalize(input: string): string {
  if (!input) return '';

  const lower = input.toLowerCase();

  let translit = '';
  for (const ch of lower) {
    translit += transliterateChar(ch);
  }

  // Replace ? with wildcard marker ~ before punctuation handling.
  translit = translit.replace(/\?/g, '~');

  // Punctuation handling.
  // Preserve `.` when it sits between two letters (initial form like b.baatar).
  // Strategy: walk char-by-char, emit space for punctuation runs, but keep
  // a single `.` if surrounded by letters (the previous output char is a letter
  // and the next input char is a letter).
  //
  // We also collapse a sequence like `b. baatar` to `b.baatar` by treating a
  // `.` immediately followed by optional spaces and a letter, after a single
  // letter, as the initial form.
  const out: string[] = [];
  for (let i = 0; i < translit.length; i++) {
    const ch = translit[i]!;
    if (isWordChar(ch)) {
      out.push(ch);
      continue;
    }
    if (ch === '.') {
      // Look back for a single letter preceded by start/space, and look ahead
      // (skipping spaces) for a letter.
      const prev = out.length > 0 ? out[out.length - 1]! : '';
      const prevPrev = out.length > 1 ? out[out.length - 2]! : '';
      const prevIsSingleLetter =
        isLetter(prev) && (prevPrev === '' || prevPrev === ' ');
      let j = i + 1;
      while (j < translit.length && translit[j] === ' ') j++;
      const nextCh = j < translit.length ? translit[j]! : '';
      if (prevIsSingleLetter && isLetter(nextCh)) {
        out.push('.');
        // Skip the spaces we peeked past.
        i = j - 1;
        continue;
      }
      out.push(' ');
      continue;
    }
    // Any other punctuation/whitespace → space.
    out.push(' ');
  }

  // Collapse multiple spaces, trim.
  return out.join('').replace(/\s+/g, ' ').trim();
}

function isWordChar(ch: string): boolean {
  return /[a-z0-9~+\-]/.test(ch);
}

function isLetter(ch: string): boolean {
  return /[a-z]/.test(ch);
}
