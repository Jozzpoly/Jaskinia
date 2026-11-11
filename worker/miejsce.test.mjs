// Miejsce na prawdziwym SQLite (node:sqlite), tym samym językiem zapytań co Durable Object. Część przypadków to
// wprost falsyfikatory z innych linii: F1/F2/F5 Opusa Code (Jaskinia PR #5), fałszywe ok:true w R2 (Menadżer,
// 10 XI), A -> B -> A (Astra, 5 XI), wielu kart (szkic rdzenia, punkt 2), ponownego spotkania (punkt 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { sqlZNode } from './sql-node.mjs';
import { Rdzen, LIMIT_TRESCI, skrot } from './miejsce.mjs';
import { ktoTo } from './klucze.mjs';
import { Miejsce } from './miejsce-do.mjs';
import worker from './index.mjs';

let zegar = Date.parse('2026-11-11T00:00:00Z');
const nowy = (db) => new Rdzen(sqlZNode(db), { teraz: () => (zegar += 1000) });
let n = 0;
const op = () => 'op-test-' + (++n).toString().padStart(4, '0');

test('dwóch autorów, ta sama treść: jeden zapis i dwa akty, każdy ze swoim autorem (F1, F2, F5)', async () => {
  const r = nowy();
  const a = await r.wykonaj('opus-code', { op: op(), co: 'zapisz', rodzaj: 'werdykt', tresc: 'PASS v6.4.2' });
  const b = await r.wykonaj('astra', { op: op(), co: 'zapisz', rodzaj: 'werdykt', tresc: 'PASS v6.4.2' });
  assert.equal(a.zapis, b.zapis);
  assert.equal(a.nowy, true);
  assert.equal(b.nowy, false);
  const d = r.dziennik();
  assert.deepEqual(d.akty.map((x) => x.kto), ['opus-code', 'astra']);
  const c = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'werdykt', tresc: 'PASS v6.4.2' });
  assert.equal(r.dziennik().akty.at(-1).kto, 'jozz', 'treść zapisana później przez Jozza ma jego akt, a nie pierwszego piszącego');
  assert.equal(c.zapis, a.zapis);
});

test('ponowione dostarczenie tej samej czynności: ten sam akt, powiedziane wprost; inny cel pod tym samym op: 409, nie cichy sukces', async () => {
  const r = nowy();
  const o = op();
  const z1 = await r.wykonaj('jozz', { op: o, co: 'zapisz', rodzaj: 'uwaga', tresc: 'a' });
  const z2 = await r.wykonaj('jozz', { op: o, co: 'zapisz', rodzaj: 'uwaga', tresc: 'a' });
  assert.equal(z2.ok, true);
  assert.equal(z2.powtorzone, true);
  assert.equal(z2.akt.nr, z1.akt.nr);
  assert.equal(r.dziennik().akty.length, 1);
  const inna = await r.wykonaj('jozz', { op: o, co: 'zapisz', rodzaj: 'uwaga', tresc: 'b' });
  assert.equal(inna.ok, false);
  assert.equal(inna.status, 409);
  const cudzy = await r.wykonaj('astra', { op: o, co: 'zapisz', rodzaj: 'uwaga', tresc: 'a' });
  assert.equal(cudzy.status, 409, 'cudzy op nie staje się moim aktem');
  // to samo dla głowy: ponowienie przesunięcia nie udaje, że przesunęło drugi raz
  const z = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'uklad', tresc: '{}' });
  const p = op();
  const g1 = await r.wykonaj('jozz', { op: p, co: 'przesun', glowa: 'jozz:uklad', wersja: null, na: z.zapis });
  const g2 = await r.wykonaj('jozz', { op: p, co: 'przesun', glowa: 'jozz:uklad', wersja: null, na: z.zapis });
  assert.equal(g2.powtorzone, true);
  assert.equal(g2.akt.nr, g1.akt.nr);
  const g3 = await r.wykonaj('jozz', { op: p, co: 'przesun', glowa: 'jozz:uklad', wersja: g1.wersja, na: z.zapis });
  assert.equal(g3.status, 409, 'ten sam op z inną podstawą to inna czynność (przypadek Menadżera z R2)');
});

test('dwie karty z tego samego odczytu: pierwsza przesuwa, druga dostaje 409 z aktualnym stanem i nie wskrzesza starego', async () => {
  const r = nowy();
  const z0 = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'uklad', tresc: 'stary' });
  const g = await r.wykonaj('jozz', { op: op(), co: 'przesun', glowa: 'jozz:uklad', wersja: null, na: z0.zapis });
  const odczyt = r.glowa('jozz:uklad');
  const zA = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'uklad', tresc: 'karta A' });
  const zB = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'uklad', tresc: 'karta B' });
  const pa = await r.wykonaj('jozz', { op: op(), co: 'przesun', glowa: 'jozz:uklad', wersja: odczyt.wersja, na: zA.zapis });
  const pb = await r.wykonaj('jozz', { op: op(), co: 'przesun', glowa: 'jozz:uklad', wersja: odczyt.wersja, na: zB.zapis });
  assert.equal(pa.ok, true);
  assert.equal(pb.status, 409);
  assert.equal(pb.zapis, zA.zapis, 'odmowa mówi, co jest teraz');
  assert.equal(r.glowa('jozz:uklad').tresc, 'karta A');
  assert.equal(g.ok, true);
});

test('A -> B -> A: klient pamiętający pierwsze A nie przechodzi (Astra, 5 XI)', async () => {
  const r = nowy();
  const A = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'uklad', tresc: 'A' });
  const B = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'uklad', tresc: 'B' });
  const C = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'uklad', tresc: 'C' });
  const g1 = await r.wykonaj('jozz', { op: op(), co: 'przesun', glowa: 'jozz:x', wersja: null, na: A.zapis });
  const pamieta = g1.wersja;
  const g2 = await r.wykonaj('jozz', { op: op(), co: 'przesun', glowa: 'jozz:x', wersja: g1.wersja, na: B.zapis });
  await r.wykonaj('jozz', { op: op(), co: 'przesun', glowa: 'jozz:x', wersja: g2.wersja, na: A.zapis });
  const stary = await r.wykonaj('jozz', { op: op(), co: 'przesun', glowa: 'jozz:x', wersja: pamieta, na: C.zapis });
  assert.equal(stary.status, 409);
  assert.equal(r.glowa('jozz:x').tresc, 'A');
});

test('prawa do głów: agent nie przesuwa głów Jozza ani cudzych, swoje i wspólne tak; Jozz wszystkie', async () => {
  const r = nowy();
  const z = await r.wykonaj('opus', { op: op(), co: 'zapisz', rodzaj: 'proba', tresc: 'x' });
  assert.equal((await r.wykonaj('opus', { op: op(), co: 'przesun', glowa: 'jozz:uklad', wersja: null, na: z.zapis })).status, 403);
  assert.equal((await r.wykonaj('opus', { op: op(), co: 'przesun', glowa: 'agent:astra:proba', wersja: null, na: z.zapis })).status, 403);
  assert.equal((await r.wykonaj('opus', { op: op(), co: 'przesun', glowa: 'agent:opus:proba', wersja: null, na: z.zapis })).ok, true);
  assert.equal((await r.wykonaj('opus', { op: op(), co: 'przesun', glowa: 'wspolne:tablica', wersja: null, na: z.zapis })).ok, true);
  assert.equal((await r.wykonaj('jozz', { op: op(), co: 'przesun', glowa: 'agent:astra:proba', wersja: null, na: z.zapis })).ok, true);
  assert.equal((await r.wykonaj('opus', { op: op(), co: 'przesun', glowa: 'zle', wersja: null, na: z.zapis })).status, 400);
});

test('ponowne spotkanie: 20 aktów pod nieobecność, jedno pytanie mówi, co przybyło; widziane nie cofa się z drugiego urządzenia', async () => {
  const r = nowy();
  await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'wiadomosc', tresc: 'idę spać' });
  const pierwsze = r.nowe('jozz');
  r.widzialem('jozz', pierwsze.ostatni);
  for (let i = 0; i < 20; i++) await r.wykonaj(i % 2 ? 'opus' : 'astra', { op: op(), co: 'zapisz', rodzaj: 'wiadomosc', tresc: 'nocą ' + i });
  const rano = r.nowe('jozz');
  assert.equal(rano.akty.length, 20);
  assert.equal(rano.cudze, 20);
  assert.equal(r.widzialem('jozz', rano.ostatni).widziane_do, rano.ostatni);
  assert.equal(r.widzialem('jozz', 3).widziane_do, rano.ostatni, 'stary telefon nie cofa przeczytanego');
  assert.equal(r.nowe('jozz').akty.length, 0);
  assert.equal(r.nowe('opus').akty.length, 21, 'każdy czytelnik ma własne miejsce w dzienniku');
});

test('dziennik idzie stronami z kursorem; eksport ma wszystko; za duża treść dostaje 413 z liczbami', async () => {
  const r = nowy();
  for (let i = 0; i < 5; i++) await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'wiadomosc', tresc: 'w' + i });
  const s1 = r.dziennik(0, 2);
  assert.equal(s1.akty.length, 2);
  assert.equal(s1.wiecej, true);
  const s3 = r.dziennik(r.dziennik(s1.dalej, 2).dalej, 2);
  assert.deepEqual(s3.akty.map((a) => a.tresc), ['w4']);
  assert.equal(s3.wiecej, false);
  const e = r.eksport();
  assert.equal(e.akty.length, 5);
  assert.equal(e.zapisy.length, 5);
  const duza = await r.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'wiadomosc', tresc: 'x'.repeat(LIMIT_TRESCI + 1) });
  assert.equal(duza.status, 413);
});

test('stan przetrwa nowy obiekt nad tą samą bazą (restart Durable Object)', async () => {
  const db = new DatabaseSync(':memory:');
  const r1 = nowy(db);
  await r1.wykonaj('jozz', { op: op(), co: 'zapisz', rodzaj: 'wiadomosc', tresc: 'przed restartem' });
  const r2 = nowy(db);
  assert.equal(r2.dziennik().akty[0].tresc, 'przed restartem');
});

// ---- klucze i Worker ----

const KLUCZ_JOZZA = 'test-jozz-klucz-0123456789';
const KLUCZ_AGENTA = 'test-agent-klucz-0123456789';
async function envZMiejscem() {
  const db = new DatabaseSync(':memory:');
  const obiekt = new Miejsce({ storage: { sql: sqlZNode(db) } });
  return {
    KLUCZE: JSON.stringify({ jozz: await skrot(KLUCZ_JOZZA), 'agent-probny': await skrot(KLUCZ_AGENTA) }),
    MIEJSCE: { idFromName: (n) => n, get: () => obiekt },
  };
}
const zap = (env, sciezka, { klucz, metoda = 'GET', cialo, naglowki = {} } = {}) => worker.fetch(new Request('https://j.dev/api/miejsce' + sciezka, {
  method: metoda, body: cialo ? JSON.stringify(cialo) : undefined,
  headers: { ...(klucz ? { authorization: 'Bearer ' + klucz } : {}), ...(cialo ? { 'content-type': 'application/json' } : {}), ...naglowki },
}), env);

test('bez ustawienia KLUCZE Miejsce jest zamknięte i mówi dlaczego; zły klucz to 401', async () => {
  assert.equal((await ktoTo(new Request('https://x'), {})).status, 503);
  const env = await envZMiejscem();
  assert.equal((await zap(env, '', {})).status, 401);
  assert.equal((await zap(env, '', { klucz: 'zly-klucz-0123456789' })).status, 401);
  assert.equal((await zap({ ...env, KLUCZE: undefined }, '', { klucz: KLUCZ_JOZZA })).status, 503);
  assert.equal((await zap({ ...env, MIEJSCE: undefined }, '', { klucz: KLUCZ_JOZZA })).status, 503);
});

test('przez Workera: nagłówek x-kto od klienta nie podszyje się pod Jozza; eksport tylko dla właściciela', async () => {
  const env = await envZMiejscem();
  const r = await zap(env, '/akt', { klucz: KLUCZ_AGENTA, metoda: 'POST', cialo: { op: op(), co: 'zapisz', rodzaj: 'wiadomosc', tresc: 'hej' }, naglowki: { 'x-kto': 'jozz' } });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).akt.kto, 'agent-probny');
  assert.equal((await zap(env, '/eksport', { klucz: KLUCZ_AGENTA })).status, 403);
  const e = await (await zap(env, '/eksport', { klucz: KLUCZ_JOZZA })).json();
  assert.equal(e.akty.length, 1);
  const ja = await (await zap(env, '', { klucz: KLUCZ_JOZZA })).json();
  assert.equal(ja.ja, 'jozz');
  assert.equal(ja.wlasciciel, true);
  const nowe = await (await zap(env, '/nowe', { klucz: KLUCZ_JOZZA })).json();
  assert.equal(nowe.cudze, 1);
  const tekst = JSON.stringify(e) + JSON.stringify(nowe);
  assert.ok(!tekst.includes(KLUCZ_JOZZA) && !tekst.includes(KLUCZ_AGENTA), 'klucz nie wraca w żadnej odpowiedzi');
});
