// Cyrillic → Latin transliteration. Phonetic where memo-style writing
// (Latin transliteration of Mongolian) and pure-Cyrillic memos need to land
// on the same normalized form. The table is intentionally lossy on rare
// distinctions (ү vs у both → u, й → i, щ → sh) because real-world memo writers
// don't distinguish them either.
//
// The o/u split is handled separately, after transliteration, by phoneticFold
// (applied at the end of normalize): Mongolian о/ө/у/ү get romanized
// inconsistently across both memos and the (Latin) student directory — the same
// name shows up as "Bolor" and "Bulur", "Dolgoon" and "Dulguun". No single
// per-letter mapping reconciles two *Latin* spellings of one name, so the
// back/rounded vowels are folded to a single bucket as the last step. That makes
// the table's exact ө mapping irrelevant to matching (both ө→o and ө→u land on
// the same folded form), so it stays at the conventional 'o' here.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'ye',
  ё: 'yo',
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
  ц: 'ts',
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

  // Collapse multiple spaces, trim, then fold the o/u vowel ambiguity so memos
  // and the directory land on one spelling regardless of how their writer
  // romanized о/ө/у/ү.
  return phoneticFold(out.join('').replace(/\s+/g, ' ').trim());
}

// Phonetic fold for the romanization ambiguities that survive transliteration
// (see the header note). Applied as the final step of normalize so every index
// and every memo is built in the same folded space — a memo and a directory
// entry that disagree only on these spellings resolve as an ordinary exact
// match rather than being lost.
//
// Two folds, both deliberately lossy:
//
//  - kh → h. Mongolian х is romanized "kh" in the (Latin) student directory
//    ("Munkhbadrakh", "Khongor", "Khulan") but Cyrillic memos transliterate it
//    to a bare "h" (our table maps х→h). Without this fold every Cyrillic-written
//    name containing х misses its Latin directory entry ("hungur" vs "khungur").
//    Folding both sides to "h" makes them meet. х is extremely common in
//    Mongolian names, so this is the single largest source of recovered matches.
//
//  - o → u, for the o/u back-rounded-vowel ambiguity ("Dolgoon"/"Dulguun"):
//    Mongolian о/ө/у/ү get romanized inconsistently on both sides.
//
//  - ye → e. Cyrillic Е carries a glide our table spells out ("ye"), but the
//    (Latin) directory romanizes the same letter both ways — the Kherlen
//    siblings are stored as "Yesui", "Esukhei" and "Esutei", one Cyrillic
//    letter written two ways. Without the fold, a Cyrillic memo can only ever
//    reach the "Ye…" half of the directory, and the "E…" half is left to fuzzy,
//    which drops those students to a tier too low to survive multi-student
//    detection. Folding both sides to "e" makes the whole family reachable.
//
// All three collapse genuinely-distinct spellings too (e.g. "bor"/"bur"), but
// two *different* students almost never differ only by these romanization
// choices, and where a collision does occur both land as candidates and are
// separated downstream by the grade/amount signals.
export function phoneticFold(input: string): string {
  return input.replace(/kh/g, 'h').replace(/o/g, 'u').replace(/ye/g, 'e');
}

// Cyrillic letters that *look* like a Latin letter but transliterate to a
// different one. A parent typing on a Cyrillic keyboard writes the class "8B" as
// "8В" — visually identical, but our (phonetic) table maps В→v, so the memo
// normalizes to "8v" while the class in the DB normalizes to "8b" and they never
// meet. The map is keyed by the *Latin* letter as it appears in a class name and
// yields the phonetic form the lookalike Cyrillic letter produces.
//
// Deliberately limited to class codes (see classVariants in build-index.ts).
// Applying it to names would fold genuinely different names together — "bat" and
// "vat" are not the same name, whereas class "8B" and "8В" are the same class.
const VISUAL_CONFUSABLES: Record<string, string> = {
  b: 'v', // В
  c: 's', // С
  // Е is absent on purpose: phoneticFold now folds its "ye" transliteration
  // back to "e", so a class written with Cyrillic Е already normalizes to the
  // Latin form and an alias for it could never match anything.
  h: 'n', // Н
  n: 'h', // Н read the other way
  p: 'r', // Р
  x: 'h', // Х
  y: 'u', // У
};

/**
 * Every spelling of `token` reachable by reading one or more of its letters as
 * the Cyrillic lookalike instead. Includes the input itself. Combinatorial, so
 * it is capped — class codes are 1–3 letters, and anything longer is not worth
 * the ambiguity it would introduce.
 */
export function visualVariants(token: string): string[] {
  const digits = token.match(/^\d+/)?.[0] ?? '';
  const letters = token.slice(digits.length);
  if (letters.length === 0 || letters.length > 3) return [token];

  let forms = [''];
  for (const ch of letters) {
    const alt = VISUAL_CONFUSABLES[ch];
    const next: string[] = [];
    for (const f of forms) {
      next.push(f + ch);
      if (alt) next.push(f + alt);
    }
    forms = next;
  }
  return [...new Set(forms.map((f) => digits + f))];
}

function isWordChar(ch: string): boolean {
  return /[a-z0-9~+\-]/.test(ch);
}

function isLetter(ch: string): boolean {
  return /[a-z]/.test(ch);
}
