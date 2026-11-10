import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.mjs';
import { zdrowie, dom, DOM_ZRODLO } from './trasy.mjs';

const SEKRET = 'wartosc-sekretu-testowa-7f3a';

test('zdrowie mówi tylko tak albo nie i nigdy nie pokazuje wartości sekretu', async () => {
  const env = { GITHUB_DANE_TOKEN: SEKRET, POLICY_AUD: 'aud', TEAM_DOMAIN: 'zespol.cloudflareaccess.com' };
  const req = new Request('https://jaskinia.example.workers.dev/api/zdrowie', {
    headers: { 'cf-access-jwt-assertion': 'x.y.z' },
  });
  const res = await worker.fetch(req, env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const tekst = await res.text();
  assert.ok(!tekst.includes(SEKRET), 'wartość sekretu wyciekła');
  assert.ok(!tekst.includes('zespol.cloudflareaccess.com'), 'wartość zmiennej wyciekła');
  assert.deepEqual(JSON.parse(tekst), {
    jaskinia: 'pusty podgląd', wersja: 'szkielet-1', access: true, zmienneAccess: true, sekretDanych: true, pamiecFaktow: false,
  });
});

test('bez konfiguracji zdrowie mówi wprost, czego brakuje', () => {
  const wynik = zdrowie(new Request('https://x.dev/api/zdrowie'), {});
  assert.equal(wynik.access, false);
  assert.equal(wynik.zmienneAccess, false);
  assert.equal(wynik.sekretDanych, false);
});

test('inne ścieżki API dają 404, a reszta idzie do plików statycznych', async () => {
  const brak = await worker.fetch(new Request('https://x.dev/api/cos'), {});
  assert.equal(brak.status, 404);
  const zly = await worker.fetch(new Request('https://x.dev/api/zdrowie', { method: 'POST' }), {});
  assert.equal(zly.status, 405);
  let doPlikow = null;
  const env = { ASSETS: { fetch: (r) => { doPlikow = new URL(r.url).pathname; return new Response('plik'); } } };
  const res = await worker.fetch(new Request('https://x.dev/nie-ma-takiego.html'), env);
  assert.equal(await res.text(), 'plik');
  assert.equal(doPlikow, '/nie-ma-takiego.html');
});

test('/dom/ podaje dzisiejszy Dom z GitHub Pages pod adresem Workera, i tylko jego pliki', async () => {
  const pytane = [];
  const fakeFetch = async (u) => { pytane.push(u); return new Response('<title>Jaskinia</title>', { headers: { 'content-type': 'text/html; charset=utf-8' } }); };
  const res = await dom(new URL('https://jaskinia.example.workers.dev/dom/'), {}, fakeFetch);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '<title>Jaskinia</title>');
  assert.equal(pytane[0], DOM_ZRODLO);
  assert.equal(res.headers.get('x-jaskinia-zrodlo'), DOM_ZRODLO);
  await dom(new URL('https://x.dev/dom/status.json'), {}, fakeFetch);
  assert.equal(pytane[1], DOM_ZRODLO + 'status.json');
  const obcy = await dom(new URL('https://x.dev/dom/../../innej-strony'), {}, fakeFetch);
  assert.equal(obcy.status, 404);
  const inny = await dom(new URL('https://x.dev/dom/dane/library.json'), {}, fakeFetch);
  assert.equal(inny.status, 404, 'tylko strona i status.json, żadnego otwartego pośrednika');
  assert.equal(pytane.length, 2);
});

test('/dom bez ukośnika przekierowuje, a gdy Pages nie odpowiada, Worker mówi to wprost', async () => {
  const r = await worker.fetch(new Request('https://x.dev/dom'), {});
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), 'https://x.dev/dom/');
  const pada = await dom(new URL('https://x.dev/dom/'), {}, async () => new Response('', { status: 404 }));
  assert.equal(pada.status, 502);
  assert.equal((await pada.json()).status, 404);
  const siec = await dom(new URL('https://x.dev/dom/'), {}, async () => { throw new Error('brak sieci'); });
  assert.equal(siec.status, 502);
});
