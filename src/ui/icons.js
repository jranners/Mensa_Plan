import { SVG_ICONS } from '../../data/icons.js';
import { escapeHtml } from '../lib/html.js';

/**
 * Renders an inline SVG icon wrapped in a span with optional classes.
 * All SVGs in SVG_ICONS carry aria-hidden="true" focusable="false".
 *
 * @param {string} name
 * @param {string} [classes='']
 * @returns {string}
 */
export function getIconHTML(name, classes = '') {
  const svg = SVG_ICONS[name] || SVG_ICONS['restaurant'];
  return `<span class="inline-flex items-center justify-center ${escapeHtml(classes)}" aria-hidden="true" style="width: 1em; height: 1em;">${svg}</span>`;
}
