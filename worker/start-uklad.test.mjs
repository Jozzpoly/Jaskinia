// Testy czystych funkcji układu Startu (public/start/uklad.mjs). Napisał je Opus czatu w kampanii Skala (17 XI 2026);
// wzięte razem z funkcjami.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { squarify, sot, nadmuchaj, zamianyPorzadku, skrzyzowania, drobnica } from '../public/start/uklad.mjs';

const pole = r => r.w * r.h;
const blisko = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

test('squarify: pola proporcjonalne do wag i całość wypełniona', () => {
  const el = [5, 3, 2, 1, 1].map((v, i) => ({ i, v }));
  const out = squarify(el, 0, 0, 300, 200);
  const suma = out.reduce((a, [, r]) => a + pole(r), 0);
  assert.ok(blisko(suma, 300 * 200));
  for (const [i, r] of out) assert.ok(blisko(pole(r), 60000 * el[i].v / 12));
});

test('sot: co leżało na lewo, zostaje na lewo; pola proporcjonalne', () => {
  const el = [{ cx: 10 }, { cx: 50 }, { cx: 90 }, { cx: 130 }].map((e, i) => ({ i, v: i + 1, cy: 0, klucz: i, ...e }));
  const out = new Map(sot(el, 0, 0, 400, 100));
  const xs = [0, 1, 2, 3].map(i => out.get(i).x + out.get(i).w / 2);
  assert.deepEqual(xs.slice().sort((a, b) => a - b), xs);
  for (const e of el) assert.ok(blisko(pole(out.get(e.i)), 40000 * e.v / 10));
});

test('sot z podziałem po liczbie: zamiana wag nie zmienia, kto jest w której połowie', () => {
  const pol = [[0, 0], [100, 0], [0, 100], [100, 100], [50, 50], [150, 50]];
  const el = w => pol.map(([cx, cy], i) => ({ i, v: w[i], cx, cy, klucz: i }));
  const a = new Map(sot(el([1, 9, 1, 1, 1, 1]), 0, 0, 600, 300, { podzial: 'liczba' }));
  const b = new Map(sot(el([9, 1, 1, 1, 1, 1]), 0, 0, 600, 300, { podzial: 'liczba' }));
  // pierwsze cięcie dzieli po liczbie: trzy rzeczy o najmniejszym cx (0, 2, 4) zawsze leżą na lewo od trzech pozostałych
  for (const m of [a, b]) {
    const prawaKrawedzLewych = Math.max(...[0, 2, 4].map(i => m.get(i).x + m.get(i).w));
    const lewaKrawedzPrawych = Math.min(...[1, 3, 5].map(i => m.get(i).x));
    assert.ok(prawaKrawedzLewych <= lewaKrawedzPrawych + 1e-9);
  }
});

test('nadmuchaj: Map po id, pola sumują się do prostokąta', () => {
  const rz = ['a', 'b', 'c'].map(id => ({ id }));
  const pol = { a: { cx: 0, cy: 0 }, b: { cx: 10, cy: 0 }, c: { cx: 20, cy: 0 } }, wag = { a: 1, b: 2, c: 3 };
  const m = nadmuchaj(rz, { w: 60, h: 10 }, { polozenie: id => pol[id], waga: id => wag[id] });
  assert.equal(m.size, 3);
  assert.ok(blisko([...m.values()].reduce((s, r) => s + pole(r), 0), 600));
  assert.ok(m.get('a').x < m.get('b').x && m.get('b').x < m.get('c').x);
});

test('zamianyPorzadku: zero dla tego samego układu, dwie przy zamianie po przekątnej', () => {
  const A = new Map([['a', { x: 0, y: 0, w: 10, h: 10 }], ['b', { x: 100, y: 100, w: 10, h: 10 }]]);
  const B = new Map([['a', { x: 100, y: 100, w: 10, h: 10 }], ['b', { x: 0, y: 0, w: 10, h: 10 }]]);
  assert.equal(zamianyPorzadku(A, A, ['a', 'b']), 0);
  assert.equal(zamianyPorzadku(A, B, ['a', 'b']), 2);
});

test('skrzyzowania: krzyż liczy się raz, równoległe wcale', () => {
  assert.equal(skrzyzowania([[[0, 0], [10, 10]], [[0, 10], [10, 0]]]), 1);
  assert.equal(skrzyzowania([[[0, 0], [10, 0]], [[0, 5], [10, 5]]]), 0);
});

test('drobnica: nic nie ginie, grupa od dwóch rzeczy, osobne mają minimalne pole', () => {
  const rz = [50, 20, 10, 2, 1, 1, 1].map((v, i) => ({ id: 'r' + i, v }));
  const waga = id => rz.find(r => r.id === id).v;
  const { osobno, wGrupie } = drobnica(rz, 10000, { waga, minPole: 900 });
  assert.deepEqual([...osobno, ...wGrupie].sort(), rz.map(r => r.id).sort());
  assert.equal(new Set([...osobno, ...wGrupie]).size, rz.length);
  assert.ok(wGrupie.length === 0 || wGrupie.length >= 2);
  const sw = osobno.reduce((a, id) => a + waga(id), 0), wg = wGrupie.length ? sw * 0.25 : 0;
  for (const id of osobno) assert.ok(10000 * waga(id) / (sw + wg) >= 900 || osobno.length === 1);
  const zadna = drobnica(rz, 1e9, { waga, minPole: 1 });
  assert.equal(zadna.wGrupie.length, 0);
});
