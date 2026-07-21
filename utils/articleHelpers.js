/**
 * articleHelpers.js
 *
 * Shared utilities for determining article display labels,
 * TTS pronunciation strings, gender names, and icon/color lookups.
 *
 * Rules:
 *   - is_plural === true   → article is "die", displayed as "die (Plural)"
 *   - article === 'plural' → legacy data treated as plural die
 *   - grammatical_gender === 'plural' → same
 *   - Otherwise: display article as-is
 */

// ─── Plural detection ────────────────────────────────────────────────────────

/**
 * Returns true when a vocabulary word represents a plural noun.
 * Checks three possible fields so that legacy data never breaks.
 */
export function isPlural(item) {
  if (!item) return false;
  return (
    item.is_plural === true ||
    item.article === 'plural' ||
    item.grammatical_gender === 'plural'
  );
}

// ─── Display label ───────────────────────────────────────────────────────────

/**
 * Returns the visible article label for a word card / pill.
 * Plural nouns: "die (Plural)"
 * Feminine nouns: "die"
 * Other: "der" | "das"
 */
export function getArticleLabel(item) {
  if (!item) return '';
  const art = isPlural(item) ? 'die' : (item.article || '');
  if (isPlural(item)) return 'die (Plural)';
  return art;
}

// ─── TTS string ──────────────────────────────────────────────────────────────

/**
 * Returns the string to pass to TTS.
 * The word "Plural" must NEVER be pronounced.
 * e.g.  "die Bücher"  — NOT  "die Plural Bücher"
 */
export function getTTSString(item) {
  if (!item) return '';
  const art = isPlural(item) ? 'die' : (item.article || '');
  const word = item.word || item.german || '';
  return art ? `${art} ${word}` : word;
}

// ─── Gender name ─────────────────────────────────────────────────────────────

/**
 * Returns a human-readable gender description.
 */
export function getGenderName(item) {
  if (!item) return '';
  if (isPlural(item)) return 'Plural noun';
  const map = {
    der: 'Masculine',
    die: 'Feminine',
    das: 'Neuter',
  };
  return map[item.article] || '';
}

// ─── Canonical article ───────────────────────────────────────────────────────

/**
 * Always returns the grammatical article string ("der" | "die" | "das").
 * For plurals, this is "die" (that is the correct German grammar).
 */
export function getCanonicalArticle(item) {
  if (!item) return '';
  if (isPlural(item)) return 'die';
  return item.article || '';
}

// ─── Color / icon maps ───────────────────────────────────────────────────────

export const ARTICLE_ICONS = {
  der: 'cube-outline',
  die: 'flower-outline',
  das: 'shapes-outline',
};

export function getWordIcon(item) {
  if (!item) return 'book-outline';
  if (isPlural(item)) return 'layers-outline';
  return ARTICLE_ICONS[item.article] || 'book-outline';
}

export function getArticleStyle(item, isDark) {
  const lightColors = {
    der: { bg: '#DBEAFE', text: '#2563EB' },
    die: { bg: '#FCE7F3', text: '#DB2777' },
    das: { bg: '#D1FAE5', text: '#059669' },
    plural: { bg: '#EDE9FE', text: '#7C3AED' },  // purple for plural
  };
  const darkColors = {
    der: { bg: 'rgba(37, 99, 235, 0.2)', text: '#93C5FD' },
    die: { bg: 'rgba(219, 39, 119, 0.2)', text: '#F9A8D4' },
    das: { bg: 'rgba(5, 150, 105, 0.2)', text: '#6EE7B7' },
    plural: { bg: 'rgba(124, 58, 237, 0.2)', text: '#C4B5FD' },
  };
  const palette = isDark ? darkColors : lightColors;
  if (isPlural(item)) return palette.plural;
  const key = typeof item === 'string' ? item : (item?.article || '');
  return palette[key] || (isDark
    ? { bg: 'rgba(100, 116, 139, 0.2)', text: '#94A3B8' }
    : { bg: '#F1F5F9', text: '#64748B' });
}
