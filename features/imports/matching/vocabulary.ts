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
