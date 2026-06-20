import type { FeeTag } from './types';

// Tier 1: specific fee tokens. Each maps to a canonical FeeTag.
// Tokens are stored raw — normalize() is applied at index-build time so that
// the file reads naturally and there is one canonical normalization path.
export const SPECIFIC_FEE_TOKENS: Array<{ token: string; tag: FeeTag }> = [
  // Tuition
  { token: 'сургалт', tag: 'tuition' },
  { token: 'сургалтын', tag: 'tuition' },
  { token: 'surgalt', tag: 'tuition' },
  { token: 'surgaltiin', tag: 'tuition' },
  { token: 'сур төл', tag: 'tuition' },
  { token: 'sur tol', tag: 'tuition' },
  { token: 'tuition', tag: 'tuition' },
  // Bus
  { token: 'bus', tag: 'bus' },
  { token: 'автобус', tag: 'bus' },
  { token: 'автус', tag: 'bus' },
  { token: 'avtobus', tag: 'bus' },
  // Registration
  { token: 'бүртгэл', tag: 'registration' },
  { token: 'burtgel', tag: 'registration' },
  { token: 'хураамж', tag: 'registration' },
  { token: 'hyraamj', tag: 'registration' },
  { token: 'huraamj', tag: 'registration' },
  { token: 'registration', tag: 'registration' },
];

// Tier 2: generic payment tokens. Never fire as a signal alone.
// Stored so they can be stripped from name_tokens (otherwise they leak into
// the name index lookup as if they were name fragments).
export const GENERIC_PAYMENT_TOKENS: string[] = [
  'tulbur',
  'tulber',
  'төлбөр',
  'tolbor',
  'tolber',
  'payment',
  'pay',
];

// Kindergarten keyword — when present without a class match, expands the
// grade-level signal to the kindergarten levels.
export const KINDERGARTEN_TOKENS: string[] = [
  'бэлтгэл',
  'beltgel',
  'kindergarten',
  'preschool',
];

// Kindergarten grade levels (the "+" levels). Used when a kindergarten token
// fires and there's no specific class signal.
export const KINDERGARTEN_LEVEL_CODES: string[] = ['1+', '2+', '3+', '4+', '5+'];

// Club categories. Club *fee structures* are frequently absent from the current
// term (only the per-student club *charges* get loaded), so club fee names can't
// be turned into vocabulary the way SPECIFIC_FEE_TOKENS are. Instead we classify
// each open club charge by its fee name (`nameMatch`, tested against the raw fee
// name) and recognize the club in a memo via `aliases` (Cyrillic + Latin terms a
// parent might write). A memo alias produces a { kind: 'club_category' } hint
// that allocation matches against any open charge of the same category — so a
// "сагсан бөмбөг" memo lands on whichever basketball charge the student holds,
// regardless of which specific basketball club it is.
//
// `aliases` are raw — normalize() is applied at index-build time (so they fold
// the same way memos do). `nameMatch` runs on the raw, lowercased fee name.
export type ClubCategory = {
  category: string;
  nameMatch: RegExp;
  aliases: string[];
};

export const CLUB_CATEGORIES: ClubCategory[] = [
  {
    category: 'basketball',
    nameMatch: /basket/i,
    aliases: ['сагсан бөмбөг', 'сагсанбөмбөг', 'сагс', 'basketball', 'basket'],
  },
  {
    category: 'volleyball',
    // "гар бөмбөг" (lit. hand-ball) is the school's term for the volleyball club.
    nameMatch: /volley/i,
    aliases: ['волейбол', 'гар бөмбөг', 'гарбөмбөг', 'volleyball', 'voleyball'],
  },
  {
    category: 'football',
    nameMatch: /football/i,
    aliases: ['хөлбөмбөг', 'хөл бөмбөг', 'футбол', 'football'],
  },
  {
    category: 'cheerleading',
    nameMatch: /chear|cheer/i,
    aliases: ['cheerleading', 'chearleading', 'чирлидинг', 'cheer'],
  },
  {
    category: 'taekwondo',
    nameMatch: /taekwondo|takewondo/i,
    aliases: ['taekwondo', 'таеквондо', 'таэквондо', 'тейквондо'],
  },
  {
    category: 'homework',
    nameMatch: /\bhw\b|home\s*work/i,
    aliases: [
      'homework',
      'home work',
      'homework club',
      'hw',
      'гэрийн даалгавар',
      'гэрийн даалгаварын анги',
      'даалгавар',
    ],
  },
  {
    category: 'art',
    nameMatch: /\bart\b/i,
    aliases: ['art', 'art club', 'уран зураг', 'зураг'],
  },
  {
    category: 'math',
    nameMatch: /math/i,
    aliases: ['math', 'maths', 'math club', 'математик', 'матем'],
  },
  {
    category: 'ballet',
    nameMatch: /ballet/i,
    aliases: ['ballet', 'балет', 'балетын'],
  },
  {
    category: 'tennis',
    nameMatch: /tennis/i,
    aliases: ['tennis', 'теннис'],
  },
];

// Classify a club fee name into a category key, or null if none match.
export function categoryOfFeeName(feeName: string): string | null {
  for (const c of CLUB_CATEGORIES) {
    if (c.nameMatch.test(feeName)) return c.category;
  }
  return null;
}
