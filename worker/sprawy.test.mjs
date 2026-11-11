// Sprawy: rozłożenie PR-ów na decyzje, próby i otwarte; zatwierdzenie tylko dokładnej wersji, tylko z listy repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zbierzSprawy, streszczenie, rodzaj, podgladGalezi, zatwierdz, sprawyDlaStrony, _wyczyscPamiec } from './sprawy.mjs';
import worker from './index.mjs';

const pr = (repo, number, title, extra = {}) => ({ repository_url: 'https://api.github.com/repos/Jozzpoly/' + repo, number, title, html_url: `https://github.com/Jozzpoly/${repo}/pull/${number}`,
  draft: false, body: '', created_at: '2026-11-10T10:00:00Z', updated_at: `2026-11-1${number % 10}T10:00:00Z`, ...extra });
const ok = (j, h = {}) => new Response(JSON.stringify(j), { headers: { 'content-type': 'application/json', ...h } });

test('rodzaje: decyzja z linii w opisie, próba ze szkicu albo tytułu, reszta otwarta', () => {
  assert.deepEqual(rodzaj({ title: 'Miejsce', body: 'Coś.\n\n**Decyzja dla Jozza:** czy otwieramy skrzynkę?\n' }), { rodzaj: 'decyzja', pytanie: 'czy otwieramy skrzynkę?' });
  assert.equal(rodzaj({ title: '[R&D / DO NOT MERGE] Studio', body: '' }).rodzaj, 'proba');
  assert.equal(rodzaj({ title: 'Coopege B5', draft: true, body: '' }).rodzaj, 'proba');
  assert.equal(rodzaj({ title: 'Poprawka', body: '' }).rodzaj, 'otwarte');
});

test('streszczenie: pierwszy prawdziwy akapit, bez nagłówków, linków i podpisów narzędzi; długie ucięte', () => {
  assert.equal(streszczenie('## Po co\n\n**Próba.** Wspólny [stan](https://x) po stronie serwera.\n\nDalej.'), 'Próba. Wspólny stan po stronie serwera.');
  assert.equal(streszczenie('🤖 Generated with [Claude Code](https://claude.com)'), null);
  assert.equal(streszczenie('a'.repeat(500)).length, 318);
});

test('podgląd gałęzi: ta sama zasada co adresy Cloudflare z prawdziwego PR #7', () => {
  assert.equal(podgladGalezi('claude/cloudflare-podglady-i-dom-2026-11-10'), 'https://claude-cloudflare-podglady-i-dom-2026-11-10-jaskinia.jozzpoly.workers.dev');
});

test('zbieranie: decyzje na górze, podgląd i wersja dla repo z podglądami; odmowa API to luka, nie pusta lista', async () => {
  const items = [pr('Coopege', 13, '[A0 R&D / DO NOT MERGE] x', { draft: true }), pr('Jaskinia', 10, 'Miejsce', { body: 'Decyzja dla Jozza: otwieramy?' }), pr('Jaskinia', 9, 'Sprawdzian')];
  const f = await zbierzSprawy({ fetchFn: async (u) => u.includes('/search/') ? ok({ total_count: 3, items })
    : ok([{ number: 10, head: { ref: 'claude/miejsce-wspolne-2026-11-11', sha: 'a'.repeat(40) } }, { number: 9, head: { ref: 'opus-code/zyje', sha: 'b'.repeat(40) } }]) });
  assert.equal(f.stan, 'ok');
  assert.deepEqual(f.sprawy.map((s) => s.repo + '#' + s.nr), ['Jaskinia#10', 'Jaskinia#9', 'Coopege#13']);
  assert.equal(f.sprawy[0].pytanie, 'otwieramy?');
  assert.equal(f.sprawy[0].podglad, 'https://claude-miejsce-wspolne-2026-11-11-jaskinia.jozzpoly.workers.dev');
  assert.equal(f.sprawy[0].wersja, 'a'.repeat(40));
  const brak = await zbierzSprawy({ fetchFn: async () => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }) });
  assert.equal(brak.stan, 'brak');
  assert.equal(brak.sprawy, null);
  assert.equal(brak.luki[0].zostalo_zapytan, '0');
});

test('pamięć: drugie pytanie w 5 minut nie idzie do GitHuba; nieudana próba nie kasuje poprzedniej listy', async () => {
  _wyczyscPamiec();
  let zapytan = 0, odmawiaj = false;
  const fetchFn = async (u) => { zapytan++; if (odmawiaj) return new Response('', { status: 403 }); return u.includes('/search/') ? ok({ total_count: 1, items: [pr('Splot', 1, 'x')] }) : ok([]); };
  const t = Date.parse('2026-11-11T01:00:00Z');
  await sprawyDlaStrony({}, { fetchFn, teraz: t });
  const n = zapytan;
  const b = await sprawyDlaStrony({}, { fetchFn, teraz: t + 60_000 });
  assert.equal(zapytan, n);
  assert.equal(b.skad, 'z pamięci');
  odmawiaj = true;
  const c = await sprawyDlaStrony({}, { fetchFn, teraz: t + 10 * 60_000 });
  assert.equal(c.sprawy.length, 1);
  assert.ok(c.ostatnia_proba);
  _wyczyscPamiec();
});

test('zatwierdzenie: bez tokenu zamknięte; repo spoza listy 403; GitHub 409 przy zmienionej wersji mówi to po ludzku; sha idzie do GitHuba', async () => {
  const W = 'c'.repeat(40);
  assert.equal((await zatwierdz({}, { repo: 'Jaskinia', nr: 10, wersja: W })).status, 503);
  const env = { GITHUB_ZAPIS_TOKEN: 'x', ZATWIERDZ_REPO: '["Jaskinia"]' };
  assert.equal((await zatwierdz(env, { repo: 'Coopege', nr: 1, wersja: W })).status, 403);
  assert.equal((await zatwierdz(env, { repo: 'Jaskinia', nr: 10, wersja: 'abc' })).status, 400);
  let cialo;
  const w = await zatwierdz(env, { repo: 'Jaskinia', nr: 10, wersja: W }, { fetchFn: async (u, o) => { cialo = JSON.parse(o.body); return ok({ sha: 'd'.repeat(40), merged: true }); } });
  assert.equal(w.ok, true);
  assert.equal(cialo.sha, W);
  const z = await zatwierdz(env, { repo: 'Jaskinia', nr: 10, wersja: W }, { fetchFn: async () => new Response(JSON.stringify({ message: 'Head branch was modified' }), { status: 409 }) });
  assert.match(z.blad, /agent zmienił tę sprawę/);
});

test('przez Workera: zatwierdza tylko właściciel z kluczem', async () => {
  const { skrot } = await import('./miejsce.mjs');
  const env = { KLUCZE: JSON.stringify({ jozz: await skrot('klucz-jozza-0123456789'), opus: await skrot('klucz-opusa-0123456789') }) };
  const zap = (klucz) => worker.fetch(new Request('https://j.dev/api/sprawy/zatwierdz', { method: 'POST', headers: { authorization: 'Bearer ' + klucz, 'content-type': 'application/json' }, body: JSON.stringify({ repo: 'Jaskinia', nr: 1, wersja: 'e'.repeat(40) }) }), env);
  assert.equal((await zap('klucz-opusa-0123456789')).status, 403);
  assert.equal((await zap('klucz-jozza-0123456789')).status, 503, 'właściciel, ale bez tokenu: zamknięte, z powodem');
});
