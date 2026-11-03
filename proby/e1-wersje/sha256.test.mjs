import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256hex } from './sha256.mjs';

test('SHA-256 w JS daje to samo co node:crypto (wzorce, polskie znaki, emoji, granice bloków)', () => {
  const cases = ['', 'abc', 'zażółć gęślą jaźń', '🙂🚗', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'x'.repeat(1000)];
  for (let i = 0; i < 300; i++) {
    let s = ''; const n = Math.floor(Math.random() * 200);
    for (let j = 0; j < n; j++) s += String.fromCodePoint(Math.random() < 0.8 ? 32 + Math.floor(Math.random() * 95) : 0x100 + Math.floor(Math.random() * 0x2000));
    cases.push(s);
  }
  for (const s of cases) assert.equal(sha256hex(s), createHash('sha256').update(s, 'utf8').digest('hex'));
});
