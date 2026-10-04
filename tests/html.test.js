import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../src/lib/html.js';

describe('escapeHtml utility', () => {
  it('escapes special HTML characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });

  it('handles null and undefined safely by returning empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts numbers to strings safely', () => {
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(42.5)).toBe('42.5');
  });

  it('handles empty strings and plain strings without characters to escape', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });
});
