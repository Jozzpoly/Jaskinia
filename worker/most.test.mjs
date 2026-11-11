// Most: skrzynka <-> repozytorium agentów, na prawdziwym Miejscu (node:sqlite) i udawanym API GitHuba.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { sqlZNode } from './sql-node.mjs';
import { Miejsce } from './miejsce-do.mjs';
import { przebiegMostu, plikDoWiadomosci, wiadomoscDoPliku, doBase64, zBase64 } from './most.mjs';
import { skrot } from './miejsce.mjs';
import worker from './index.mjs';

function udawanyGitHub() {
  const pliki = new Map(); let psuj = false; let n = 0;
  const fetchFn = async (url, o = {}) => {
    const sciezka = decodeURIComponent(new URL(url).pathname.replace(/^\/repos\/[^/]+\/[^/]+\/contents\//, ''));
    if (o.method === 'PUT') {
      if (psuj) return new Response('{}', { status: 500 });
      if (pliki.has(sciezka)) return new Response('{}', { status: 422 });
      pliki.set(sciezka, { content: JSON.parse(o.body).content, sha: (++n).toString(16).padStart(40, '0') });
      return new Response('{}', { status: 201 });
    }
    if (pliki.has(sciezka)) { const p = pliki.get(sciezka); return new Response(JSON.stringify({ content: p.content, sha: p.sha })); }
    const w = [...pliki].filter(([k]) => k.startsWith(sciezka + '/') && !k.slice(sciezka.length + 1).includes('/'))
      .map(([k, p]) => ({ type: 'file', name: k.split('/').pop(), path: k, sha: p.sha }));
    return w.length ? new Response(JSON.stringify(w)) : new Response('{}', { status: 404 });
  };
  return { pliki, fetchFn, psuj: (v) => { psuj = v; } };
}
async function srodowisko() {
  const obiekt = new Miejsce({ storage: { sql: sqlZNode(new DatabaseSync(':memory:')) } });
  return { MIEJSCE: { idFromName: (x) => x, get: () => obiekt }, MOST_REPO: 'wlasciciel/prywatne', GITHUB_ZAPIS_TOKEN: 't',
    KLUCZE: JSON.stringify({ jozz: await skrot('klucz-jozza-0123456789') }) };
}
const napisz = (env, tekst) => worker.fetch(new Request('https://j.dev/api/miejsce/akt', { method: 'POST', headers: { authorization: 'Bearer klucz-jozza-0123456789', 'content-type': 'application/json' },
  body: JSON.stringify({ op: 'test-' + Math.random().toString(36).slice(2, 12), co: 'zapisz', rodzaj: 'wiadomosc', tresc: JSON.stringify({ tekst, waga: 'pilna', do: ['opus-czat'] }) }) }), env);

test('jedna wiadomość Jozza trafia do repo agentów raz; odpowiedź agenta wraca do skrzynki raz; nic nie wraca echem', async () => {
  const env = await srodowisko(); const gh = udawanyGitHub();
  await napisz(env, 'Nie tłumaczę drugi raz: patrzcie na pulpit.');
  await napisz(env, 'Druga.');
  gh.pliki.set('skrzynka/od-agentow/2026-11-11-opus.md', { content: doBase64('---\nkto: opus-czat\nodp: 1\nwaga: wazna\n---\nZrozumiałem, pracuję nad pulpitem.\n'), sha: 'f'.repeat(40) });
  const r1 = await przebiegMostu(env, { fetchFn: gh.fetchFn });
  assert.deepEqual([r1.wyslane, r1.przyjete, r1.bledy.length], [2, 1, 0]);
  const wyslane = [...gh.pliki.keys()].filter((k) => !k.includes('od-agentow'));
  assert.equal(wyslane.length, 2);
  assert.match(zBase64(gh.pliki.get(wyslane[0]).content), /^---\nnr: 1\nkto: jozz\n[\s\S]*waga: pilna\ndo: opus-czat\n---\n\nNie tłumaczę drugi raz/);
  const r2 = await przebiegMostu(env, { fetchFn: gh.fetchFn });
  assert.deepEqual([r2.wyslane, r2.przyjete], [0, 0], 'drugi przebieg nic nie dubluje');
  assert.equal([...gh.pliki.keys()].filter((k) => !k.includes('od-agentow')).length, 2, 'wiadomość agenta nie wraca echem do repo');
  const d = env.MIEJSCE.get().rdzen.dziennik();
  assert.equal(d.akty.at(-1).kto, 'opus-czat');
  assert.deepEqual(JSON.parse(d.akty.at(-1).tresc), { tekst: 'Zrozumiałem, pracuję nad pulpitem.', waga: 'wazna', odp: 1 });
});

test('awaria GitHuba: nic nie jest oznaczone jako wysłane, następny przebieg wysyła to samo', async () => {
  const env = await srodowisko(); const gh = udawanyGitHub();
  await napisz(env, 'A');
  gh.psuj(true);
  const r1 = await przebiegMostu(env, { fetchFn: gh.fetchFn });
  assert.equal(r1.wyslane, 0); assert.equal(r1.bledy[0].status, 500);
  gh.psuj(false);
  assert.equal((await przebiegMostu(env, { fetchFn: gh.fetchFn })).wyslane, 1);
});

test('plik agenta: bez nagłówka, z pustym tekstem albo podpisany jako jozz jest odrzucony z powodem', () => {
  assert.equal(plikDoWiadomosci('sam tekst').ok, false);
  assert.equal(plikDoWiadomosci('---\nkto: opus\n---\n').ok, false);
  assert.match(plikDoWiadomosci('---\nkto: jozz\n---\nudaję właściciela').blad, /nie pisze się jako właściciel/);
  assert.equal(zBase64(doBase64('zażółć gęślą jaźń')), 'zażółć gęślą jaźń');
  assert.equal(wiadomoscDoPliku({ nr: 7, kto: 'jozz', kiedy: '2026-11-11T00:30:05.000Z', tresc: '{"tekst":"x"}' }).sciezka, 'skrzynka/2026/11/11/003005-jozz-7.md');
});

test('z zewnątrz do mostu się nie wejdzie: nagłówek x-wewnetrzne od klienta nie przechodzi przez Workera', async () => {
  const env = await srodowisko();
  const r = await worker.fetch(new Request('https://j.dev/api/miejsce/most/przyjmij', { method: 'POST', headers: { authorization: 'Bearer klucz-jozza-0123456789', 'x-wewnetrzne': 'tak', 'content-type': 'application/json' },
    body: JSON.stringify({ kto: 'opus', op: 'most-' + 'a'.repeat(40), tresc: '{"tekst":"podrobione"}' }) }), env);
  assert.equal(r.status, 404);
  assert.equal(env.MIEJSCE.get().rdzen.dziennik().akty.length, 0);
});

test('bez ustawień most się nie uruchamia i mówi, czego brakuje', async () => {
  assert.match((await przebiegMostu({})).pominiety, /MOST_REPO/);
});

test('alarm Miejsca: nowa wiadomość planuje most za 2 s, przebieg zostawia ślad i następny alarm za 5 minut', async () => {
  const gh = udawanyGitHub();
  let alarm = null;
  const ctx = { storage: { sql: sqlZNode(new DatabaseSync(':memory:')), getAlarm: async () => alarm, setAlarm: async (t) => { alarm = t; } } };
  const env = { MOST_REPO: 'w/p', GITHUB_ZAPIS_TOKEN: 't' };
  const m = new Miejsce(ctx, env);
  const prawdziwy = globalThis.fetch; globalThis.fetch = gh.fetchFn;
  try {
    const t0 = Date.now();
    await m.fetch(new Request('https://x/api/miejsce/akt', { method: 'POST', headers: { 'x-kto': 'jozz', 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'alarm-test-01', co: 'zapisz', rodzaj: 'wiadomosc', tresc: '{"tekst":"hej"}' }) }));
    assert.ok(alarm - t0 <= 2500 && alarm - t0 >= 1500);
    await m.alarm();
    assert.equal([...gh.pliki.keys()].length, 1);
    assert.ok(alarm - Date.now() > 4 * 60_000);
    assert.equal(JSON.parse(m.rdzen.meta('most_ostatni')).wyslane, 1);
    const bez = new Miejsce({ storage: { sql: sqlZNode(new DatabaseSync(':memory:')), getAlarm: async () => null, setAlarm: async () => { throw new Error('bez mostu nie wolno ustawiać alarmu'); } } }, {});
    await bez.fetch(new Request('https://x/api/miejsce', { headers: { 'x-kto': 'jozz' } }));
  } finally { globalThis.fetch = prawdziwy; }
});
