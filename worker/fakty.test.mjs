import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zbierz, scal, dlaStrony, odpowiedz, wCronie, KLUCZ, SWIEZE_S } from './fakty.mjs';
import worker from './index.mjs';

const repo = (n, extra = {}) => ({ name: 'r' + n, private: false, pushed_at: '2026-11-10T10:00:00Z', created_at: '2026-01-01T00:00:00Z',
  open_issues_count: 1, has_pages: n % 2 === 0, archived: false, language: 'JavaScript', html_url: 'https://github.com/x/r' + n, description: null, ...extra });
const ok = (lista) => new Response(JSON.stringify(lista), { headers: { 'content-type': 'application/json' } });
const T = Date.parse('2026-11-10T22:00:00Z');

test('pełna lista z dwóch stron: stan ok, prywatne pominięte', async () => {
  const strony = { 1: Array.from({ length: 100 }, (_, i) => repo(i)), 2: [repo(100), repo(101, { private: true })] };
  const f = await zbierz({ fetchFn: async (u) => ok(strony[new URL(u).searchParams.get('page')]), teraz: T });
  assert.equal(f.stan, 'ok');
  assert.equal(f.repos.length, 101);
  assert.ok(!f.repos.some((r) => r.nazwa === 'r101'));
  assert.equal(f.zebrane, '2026-11-10T22:00:00.000Z');
});

test('druga strona odmawia: lista jest częściowa i mówi o tym, zamiast udawać pełną', async () => {
  const f = await zbierz({ fetchFn: async (u) => (new URL(u).searchParams.get('page') === '1' ? ok(Array.from({ length: 100 }, (_, i) => repo(i))) : new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })), teraz: T });
  assert.equal(f.stan, 'czesciowe');
  assert.equal(f.luki[0].status, 403);
  assert.equal(f.luki[0].zostalo_zapytan, '0');
});

test('API nie odpowiada wcale: repos to null (nie wiadomo), nie pusta lista (zero)', async () => {
  const f = await zbierz({ fetchFn: async () => { throw new Error('brak sieci'); }, teraz: T });
  assert.equal(f.stan, 'brak');
  assert.equal(f.repos, null);
});

test('gorszy wynik nie nadpisuje lepszego, ale nieudana próba zostaje zapisana obok', () => {
  const dobre = { stan: 'ok', zebrane: '2026-11-10T21:00:00Z', repos: [{ nazwa: 'a' }], luki: [] };
  const zle = { stan: 'brak', zebrane: '2026-11-10T22:00:00Z', repos: null, luki: [{ status: 403 }] };
  const w = scal(dobre, zle);
  assert.deepEqual(w.repos, [{ nazwa: 'a' }]);
  assert.equal(w.zebrane, dobre.zebrane);
  assert.equal(w.ostatnia_proba.stan, 'brak');
  assert.equal(scal(dobre, { ...dobre, zebrane: '2026-11-10T22:00:00Z' }).zebrane, '2026-11-10T22:00:00Z');
});

test('częściowa lista nie przepada, gdy następna próba nie da nic (uwaga Menadżera, 10 XI)', () => {
  const czesc = { stan: 'czesciowe', zebrane: '2026-11-10T21:00:00Z', repos: [{ nazwa: 'a' }, { nazwa: 'b' }], luki: [{ strona: 2, status: 403 }] };
  const nic = { stan: 'brak', zebrane: '2026-11-10T22:00:00Z', repos: null, luki: [{ strona: 1, status: 403 }] };
  const w = scal(czesc, nic);
  assert.equal(w.repos.length, 2);
  assert.equal(w.zebrane, czesc.zebrane);
  assert.equal(w.ostatnia_proba.stan, 'brak');
  assert.equal(w.ostatnia_proba.liczba_repo, null);
});

test('krótsza częściowa lista nie nadpisuje dłuższej; równa albo dłuższa, bo nowsza, tak', () => {
  const dluga = { stan: 'czesciowe', zebrane: '2026-11-10T21:00:00Z', repos: [{ nazwa: 'a' }, { nazwa: 'b' }, { nazwa: 'c' }], luki: [{ strona: 2 }] };
  const krotka = { stan: 'czesciowe', zebrane: '2026-11-10T22:00:00Z', repos: [{ nazwa: 'a' }], luki: [{ strona: 1 }] };
  const w = scal(dluga, krotka);
  assert.equal(w.repos.length, 3);
  assert.equal(w.ostatnia_proba.liczba_repo, 1);
  const rowna = { ...dluga, zebrane: '2026-11-10T22:00:00Z' };
  assert.equal(scal(dluga, rowna).zebrane, rowna.zebrane);
  assert.equal(scal(dluga, rowna).ostatnia_proba, null);
});

test('pełna lista zawsze wygrywa; brak po braku zostaje brakiem, ale nowszym', () => {
  const czesc = { stan: 'czesciowe', zebrane: '2026-11-10T21:00:00Z', repos: [{ nazwa: 'a' }, { nazwa: 'b' }], luki: [{}] };
  const pelna = { stan: 'ok', zebrane: '2026-11-10T22:00:00Z', repos: [{ nazwa: 'a' }], luki: [] };
  assert.equal(scal(czesc, pelna).stan, 'ok');
  const b1 = { stan: 'brak', zebrane: '2026-11-10T21:00:00Z', repos: null, luki: [{}] };
  const b2 = { ...b1, zebrane: '2026-11-10T22:00:00Z' };
  assert.equal(scal(b1, b2).zebrane, b2.zebrane);
  assert.equal(scal(null, b1).stan, 'brak');
  assert.equal(scal(b1, czesc).stan, 'czesciowe');
});

test('fakty mówią, ile mają lat; po zamilknięciu obserwatora są stare, nie świeże', () => {
  const f = { stan: 'ok', zebrane: new Date(T - 10 * 60e3).toISOString(), repos: [] };
  assert.equal(dlaStrony(f, T).swiezosc, 'swieze');
  assert.equal(dlaStrony(f, T).wiek_s, 600);
  assert.equal(dlaStrony(f, T + SWIEZE_S * 1000).swiezosc, 'stare');
  assert.equal(dlaStrony(null, T).swiezosc, 'nie wiadomo');
});

test('z KV: świeże zapamiętane fakty idą prosto do strony, stare są zbierane na nowo', async () => {
  const kv = new Map();
  const env = { FAKTY: { get: async (k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null), put: async (k, v) => { kv.set(k, v); } } };
  let pytania = 0;
  const fetchFn = async () => { pytania++; return ok([repo(1)]); };
  const r1 = await odpowiedz(env, { fetchFn, teraz: T });
  assert.equal(r1.skad, 'na żywo');
  const r2 = await odpowiedz(env, { fetchFn, teraz: T + 60e3 });
  assert.equal(r2.skad, 'z pamięci (cron)');
  assert.equal(pytania, 1);
  await odpowiedz(env, { fetchFn, teraz: T + (SWIEZE_S + 60) * 1000 });
  assert.equal(pytania, 2);
});

test('cron zapisuje do KV, a bez wiązania mówi, czego brakuje', async () => {
  assert.equal((await wCronie({})).zapisane, false);
  const kv = new Map();
  const env = { FAKTY: { get: async (k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null), put: async (k, v) => { kv.set(k, v); } } };
  const w = await wCronie(env, { fetchFn: async () => ok([repo(1), repo(2)]), teraz: T });
  assert.equal(w.zapisane, true);
  assert.equal(JSON.parse(kv.get(KLUCZ)).repos.length, 2);
});

test('/api/fakty odpowiada przez Workera i nie pokazuje tokenu', async () => {
  const stary = globalThis.fetch;
  const SEKRET = 'token-testowy-9c2e';
  let naglowek = null;
  globalThis.fetch = async (u, o) => { naglowek = o.headers.authorization; return ok([repo(1)]); };
  try {
    const res = await worker.fetch(new Request('https://x.dev/api/fakty'), { GITHUB_DANE_TOKEN: SEKRET });
    assert.equal(res.status, 200);
    const tekst = await res.text();
    assert.ok(!tekst.includes(SEKRET));
    assert.equal(naglowek, 'Bearer ' + SEKRET);
    assert.equal(JSON.parse(tekst).z_tokenem, true);
  } finally { globalThis.fetch = stary; }
});
