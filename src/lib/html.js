/**
 * Safely escapes a value for insertion into HTML text or attribute contexts to prevent XSS.
 * Replaces &, <, >, ", ' with their corresponding HTML entity equivalents.
 * Safely converts numbers to strings, and returns an empty string for null or undefined.
 *
 * @param {any} val
 * @returns {string}
 */
export function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
