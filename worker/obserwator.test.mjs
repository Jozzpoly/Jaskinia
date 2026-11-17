// Sprawdziany obserwatora faktów (17 XI 2026). Cała sieć to podstawiona funkcja: żadne żądanie nie wychodzi do GitHuba.
// To podłoga budowniczego, nie miara: miarę ma dać drugi człowiek (agent), który powtórzy polecenia u źródła.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { coTuJest } from './opis.mjs';
import { wczytajKlucze, IMIONA_ZASTRZEZONE } from './klucze.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';
import { Miejsce } from './miejsce-do.mjs';
import { obejdz } from './obserwator.mjs';

const WLAS = 'Jozzpoly';
const T0 = Date.UTC(2026, 10, 17, 12, 0, 0);
const MINUTA = 60 * 1000;

async function swiat() {
  let t = Date.UTC(2026, 10, 17, 2, 0, 0);
  const r = new Rdzen(sqlZNode(), { teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz' }));
  return { r, s, fakty: r.meta('obszar_fakty') };
}

const repoGH = (id, nazwa, extra = {}) => ({
  id, name: nazwa, description: 'opis ' + nazwa, html_url: `https://github.com/${WLAS}/${nazwa}`, homepage: null, has_pages: false, archived: false,
  language: 'JavaScript', pushed_at: '2026-11-10T10:00:00Z', created_at: '2026-01-01T00:00:00Z', private: false, open_issues_count: 0, ...extra,
});
const galGH = (nazwa, sha = 'a1b2c3d4e5f6a7b8') => ({ name: nazwa, commit: { sha } });
const odp = (cialo, status = 200, naglowki = {}) => new Response(JSON.stringify(cialo), { status, headers: { 'content-type': 'application/json', ...naglowki } });

// Podstawiony GitHub: stan da się zmieniać między obejściami. `lista` i `galezieTryb` wymuszają awarie.
function github(stan = {}) {
  const g = { repos: [], galezie: {}, lista: null, listaStrona2: null, galezieTryb: {}, zapytania: [], ...stan };
  g.fetchFn = async (url, opcje = {}) => {
    const u = new URL(url);
    g.zapytania.push({ url: String(url), headers: opcje.headers || {} });
    if (u.hostname !== 'api.github.com') throw new Error('sprawdzian: żądanie poza api.github.com: ' + url);
    const m = /^\/repos\/[^/]+\/([^/]+)\/branches$/.exec(u.pathname);
    if (m) {
      const nazwa = decodeURIComponent(m[1]);
      const tryb = g.galezieTryb[nazwa] ?? g.galezieTryb['*'];
      if (tryb === 'siec') throw new Error('gniazdo zerwane');
      if (tryb === 'obiekt') return odp({ message: 'nie lista' });
      if (typeof tryb === 'number') return odp({ message: 'odmowa' }, tryb, { 'x-ratelimit-remaining': '0' });
      const wszystkie = g.galezie[nazwa] || [];
      const strona = Number(u.searchParams.get('page') || 1);
      return odp(wszystkie.slice((strona - 1) * 100, strona * 100));
    }
    if (u.pathname.startsWith('/users/')) {
      const strona = Number(u.searchParams.get('page') || 1);
      if (g.lista === 'siec') throw new Error('gniazdo zerwane');
      if (g.lista === 'obiekt') return odp({ message: 'nie lista' });
      if (typeof g.lista === 'number') return odp({ message: 'odmowa' }, g.lista, { 'x-ratelimit-remaining': '0' });
      if (strona === 2 && typeof g.listaStrona2 === 'number') return odp({ message: 'odmowa' }, g.listaStrona2, { 'x-ratelimit-remaining': '0' });
      return odp(g.repos.slice((strona - 1) * 100, strona * 100));
    }
    throw new Error('sprawdzian: nieznany adres ' + url);
  };
  return g;
}

const repo = (s, id) => s.spis({ rodzaj: 'repo/1', gdzie: { github_id: id }, odlozone: 'razem', limit: 1 })[0] || null;
const galezieRepo = (s, rzecz, odlozone = 'nie') => s.wszystkie({ rodzaj: 'galaz/1', gdzie: { repo: rzecz }, odlozone });
const miara = (s) => s.spis({ rodzaj: 'miara/1', gdzie: { nazwa: 'obserwator-faktow' }, odlozone: 'razem', limit: 1 })[0] || null;
const obejscie = (s, g, extra = {}) => obejdz(s, { fetchFn: g.fetchFn, owner: WLAS, teraz: T0, ...extra });

test('zasiew: kształty repo/1 i galaz/1 z kluczem, obszar Fakty z prawem prowadzenia i uczestnik obserwator jako automat', async () => {
  const { s, fakty } = await swiat();
  const kr = s.ksztaltDla('repo/1'), kg = s.ksztaltDla('galaz/1');
  assert.deepEqual(kr.klucz, ['github_id']);
  assert.deepEqual(kg.klucz, ['repo', 'nazwa']);
  assert.equal(kr.tytul, 'nazwa');
  assert.equal(kg.cechy.repo.typ, 'rzecz');
  assert.ok(fakty, 'obszar Fakty ma znacznik obszar_fakty');
  const o = s.rzecz(fakty);
  assert.equal(o.cechy.ile_wolno, 'prowadzic');
  assert.equal(o.cechy.uwaga, 'cisza');
  assert.match(o.cechy.opis, /obserwator/);
  assert.equal(s.rola('obserwator'), 'automat');
  assert.equal(s.spis({ rodzaj: 'zdolnosc/1', gdzie: { nazwa: 'Fakty automatem' } })[0].cechy.stan, 'cienko');
});

test('1. pierwsze obejście kładzie repozytoria w obszarze Fakty jako obserwator, z poprawną stroną; prywatne nie wchodzą', async () => {
  const { s, fakty } = await swiat();
  const g = github({
    repos: [repoGH(11, 'r1', { homepage: 'https://r1.przyklad.org/' }), repoGH(12, 'r2', { has_pages: true }), repoGH(13, 'r3'), repoGH(14, 'tajne', { private: true }),
      repoGH(15, 'Jozzpoly.github.io', { has_pages: true }), repoGH(16, 'r5', { homepage: 'nie adres', has_pages: true })],
    galezie: { r1: [galGH('main'), galGH('dev')], r2: [galGH('main')] },
  });
  const w = await obejscie(s, g);
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.stan, 'ok');
  assert.equal(w.repozytoria, 5);
  const wszystkie = s.wszystkie({ rodzaj: 'repo/1' });
  assert.equal(wszystkie.length, 5, 'prywatne nie weszło');
  assert.ok(!wszystkie.some((x) => x.cechy.nazwa === 'tajne'));
  for (const x of wszystkie) { assert.equal(x.obszar, fakty); assert.equal(x.utworzyl, 'obserwator'); assert.equal(x.numer, 1); }
  assert.equal(repo(s, 11).cechy.strona, 'https://r1.przyklad.org/', 'homepage z poprawnym adresem wygrywa');
  assert.equal(repo(s, 12).cechy.strona, 'https://jozzpoly.github.io/r2/', 'strony GitHuba: właściciel małymi literami');
  assert.equal(repo(s, 13).cechy.strona, undefined, 'bez strony nie ma cechy');
  assert.equal(repo(s, 15).cechy.strona, 'https://jozzpoly.github.io/', 'repozytorium strony właściciela ma adres bez nazwy');
  assert.equal(repo(s, 16).cechy.strona, 'https://jozzpoly.github.io/r5/', 'zły homepage odpada na rzecz stron GitHuba');
  const r1 = repo(s, 11);
  assert.equal(r1.cechy.github_id, 11);
  assert.equal(r1.cechy.opis, 'opis r1');
  assert.equal(r1.cechy.jezyk, 'JavaScript');
  assert.equal(r1.cechy.archiwum, false);
  assert.equal(r1.cechy.ostatni_push, '2026-11-10T10:00:00Z');
  assert.equal(r1.cechy.adres, 'https://github.com/Jozzpoly/r1');
  assert.equal(r1.cechy.galezie, 2);
  assert.equal(r1.cechy.stan_na, new Date(T0).toISOString());
  assert.deepEqual(galezieRepo(s, r1.id).map((x) => x.cechy.nazwa).sort(), ['dev', 'main']);
  assert.equal(galezieRepo(s, r1.id)[0].cechy.commit, 'a1b2c3d', 'skrót commita ma 7 znaków');
  assert.equal(galezieRepo(s, r1.id)[0].utworzyl, 'obserwator');
  assert.equal(w.galezie_sprawdzone, 3);
  const m = miara(s);
  assert.equal(m.cechy.wartosc, 5);
  assert.equal(m.cechy.stan_na, new Date(T0).toISOString());
  assert.match(m.cechy.zrodlo, /z tokenem: nie/);
  assert.match(m.cechy.zrodlo, /luki: brak/);
  assert.ok(g.zapytania.every((z) => z.headers['user-agent'] && z.headers.accept && !z.headers.authorization), 'bez tokenu nie ma nagłówka authorization');
});

test('2. drugie identyczne obejście nie zapisuje żadnej rzeczy repozytorium ani gałęzi, a numer aktu rośnie najwyżej o zapis miary', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'r1'), repoGH(12, 'r2')], galezie: { r1: [galGH('main'), galGH('dev')], r2: [galGH('main')] } });
  await obejscie(s, g);
  const numery = () => s.wszystkie({ rodzaj: 'repo/1' }).concat(s.wszystkie({ rodzaj: 'galaz/1' })).map((x) => [x.id, x.numer, x.wersja].join(':')).sort();
  const przed = numery(), aktPrzed = s.ostatniNr(), numerMiary = miara(s).numer;
  const w = await obejscie(s, g, { teraz: T0 + 30 * MINUTA });
  assert.deepEqual(numery(), przed, 'żadna rzecz repo ani galaz się nie zmieniła');
  assert.equal(w.zmienione, 0);
  assert.equal(w.odlozone, 0);
  assert.equal(w.bez_zmian, 5);
  assert.ok(s.ostatniNr() - aktPrzed <= 2, 'tylko zapis miary: ' + (s.ostatniNr() - aktPrzed));
  assert.equal(miara(s).numer, numerMiary + 1);
  assert.equal(miara(s).cechy.stan_na, new Date(T0 + 30 * MINUTA).toISOString());
  // to samo obejście z tą samą chwilą nie zmienia nawet miary
  const akt2 = s.ostatniNr();
  await obejscie(s, g, { teraz: T0 + 30 * MINUTA });
  assert.equal(s.ostatniNr(), akt2, 'identyczne powtórzenie nie zapisuje niczego');
});

test('3. zmiana opisu u źródła daje nową wersję tej samej rzeczy; reszta zostaje', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'r1'), repoGH(12, 'r2')] });
  await obejscie(s, g);
  const id = repo(s, 11).id;
  const innyId = repo(s, 12).id;
  g.repos[0] = repoGH(11, 'r1', { description: 'nowy opis' });
  const w = await obejscie(s, g, { teraz: T0 + 5 * MINUTA });
  const po = repo(s, 11);
  assert.equal(po.id, id, 'ten sam identyfikator');
  assert.equal(po.numer, 2);
  assert.equal(po.cechy.opis, 'nowy opis');
  assert.equal(po.cechy.stan_na, new Date(T0 + 5 * MINUTA).toISOString(), 'stan_na mówi, kiedy fakty zmieniły się u źródła');
  assert.equal(w.zmienione, 1);
  assert.equal(repo(s, 12).id, innyId);
  assert.equal(repo(s, 12).numer, 1);
  assert.equal(repo(s, 12).cechy.stan_na, new Date(T0).toISOString(), 'niezmieniona rzecz nie dostaje nowego stan_na');
  // wróć do poprzedniej treści: to znowu nowa wersja (op nie może pamiętać pierwszej)
  g.repos[0] = repoGH(11, 'r1');
  await obejscie(s, g, { teraz: T0 + 10 * MINUTA });
  assert.equal(repo(s, 11).numer, 3);
  assert.equal(repo(s, 11).cechy.opis, 'opis r1');
  // zmiana nazwy to ta sama rzecz (tożsamość z github_id), strona znika, gdy znikną strony
  g.repos[0] = repoGH(11, 'r1-nowa', { has_pages: false });
  await obejscie(s, g, { teraz: T0 + 15 * MINUTA });
  assert.equal(repo(s, 11).id, id);
  assert.equal(repo(s, 11).cechy.nazwa, 'r1-nowa');
  assert.equal(s.wszystkie({ rodzaj: 'repo/1' }).length, 2);
});

test('4. gałęzie idą po ileRepoNaRaz na obejście, kursor przesuwa się dalej, a po pełnym kole wraca na początek', async () => {
  const { s, r } = await swiat();
  const g = github({ repos: [7, 6, 5, 4, 3, 2, 1].map((i) => repoGH(i, 'r' + i)), galezie: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => ['r' + i, [galGH('main')]])) });
  const ktoreRepo = () => g.zapytania.filter((z) => /\/branches/.test(z.url)).map((z) => /repos\/[^/]+\/([^/]+)\//.exec(z.url)[1]);
  const kolejne = [];
  for (let i = 0; i < 4; i++) {
    g.zapytania.length = 0;
    await obejscie(s, g, { ileRepoNaRaz: 3, teraz: T0 + i * MINUTA });
    kolejne.push([ktoreRepo(), r.meta('obserwator:kursor')]);
  }
  assert.deepEqual(kolejne[0], [['r1', 'r2', 'r3'], '3']);
  assert.deepEqual(kolejne[1], [['r4', 'r5', 'r6'], '6']);
  assert.deepEqual(kolejne[2], [['r7'], '0'], 'koniec koła: kursor wraca na początek');
  assert.deepEqual(kolejne[3], [['r1', 'r2', 'r3'], '3']);
  assert.equal(s.ile({ rodzaj: 'galaz/1' }), 7, 'po jednym kole każde repozytorium ma swoją gałąź');
  assert.ok(g.zapytania.some((z) => /branches\?per_page=100/.test(z.url)));
  assert.equal(repo(s, 7).cechy.galezie, 1);
  assert.equal(repo(s, 7).numer, 2, 'repo dostaje liczbę gałęzi dopiero wtedy, gdy obserwator je zobaczy');
});

test('5. gałąź, która zniknęła z udanej odpowiedzi, jest odłożona; gdy wróci, przywrócona', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main'), galGH('dev', 'ffff0000')] } });
  await obejscie(s, g);
  const rid = repo(s, 11).id;
  const dev = () => galezieRepo(s, rid, 'razem').find((x) => x.cechy.nazwa === 'dev');
  const devId = dev().id;
  g.galezie.r1 = [galGH('main')];
  const w = await obejscie(s, g, { teraz: T0 + MINUTA });
  assert.equal(w.odlozone, 1);
  assert.equal(dev().odlozone, true);
  assert.match(dev().powod, /zniknęła u źródła/);
  assert.equal(galezieRepo(s, rid).length, 1, 'odłożona nie pokazuje się na liście');
  assert.equal(repo(s, 11).cechy.galezie, 1);
  g.galezie.r1 = [galGH('main'), galGH('dev', 'ffff0000')];
  const w2 = await obejscie(s, g, { teraz: T0 + 2 * MINUTA });
  assert.equal(dev().id, devId, 'wraca ta sama rzecz');
  assert.equal(dev().odlozone, undefined);
  assert.equal(dev().numer, 3, 'poloz, odloz, przywroc');
  assert.equal(dev().cechy.commit, 'ffff000');
  assert.ok(w2.zmienione >= 1);
  assert.equal(galezieRepo(s, rid).length, 2);
  // nowy commit w gałęzi to nowa wersja tej samej rzeczy
  g.galezie.r1 = [galGH('main'), galGH('dev', 'eeee1111')];
  await obejscie(s, g, { teraz: T0 + 3 * MINUTA });
  assert.equal(dev().cechy.commit, 'eeee111');
  assert.equal(dev().numer, 4);
});

test('6. odmowa API (403, błąd sieci, odpowiedź niebędąca listą) niczego nie odkłada i zostawia lukę w wyniku i w mierze', async () => {
  const { s, r } = await swiat();
  const g = github({ repos: [repoGH(11, 'r1'), repoGH(12, 'r2')], galezie: { r1: [galGH('main')], r2: [galGH('main')] } });
  await obejscie(s, g);
  const stanPo = () => JSON.stringify(s.wszystkie({ rodzaj: 'repo/1', odlozone: 'razem' }).concat(s.wszystkie({ rodzaj: 'galaz/1', odlozone: 'razem' })).map((x) => [x.id, x.numer, !!x.odlozone]).sort());
  const dobry = stanPo();
  const dobraMiara = miara(s).cechy;
  const liczba = (w) => w.luki.length;

  // lista: 403 z limitem, sieć, nie lista
  for (const tryb of [403, 'siec', 'obiekt']) {
    g.lista = tryb;
    const w = await obejscie(s, g, { teraz: T0 + 10 * MINUTA });
    assert.equal(w.ok, false, tryb);
    assert.equal(w.stan, 'brak');
    assert.ok(liczba(w) >= 1);
    assert.equal(stanPo(), dobry, 'nic nie odłożone, nic nie zmienione przy liście: ' + tryb);
    const m = miara(s).cechy;
    assert.equal(m.wartosc, dobraMiara.wartosc, 'miara zostaje przy ostatnim dobrym');
    assert.equal(m.stan_na, dobraMiara.stan_na, 'stan_na to ostatnie UDANE obejście');
    assert.match(m.zrodlo, /nie powiodła się/);
  }
  g.lista = 403;
  const w403 = await obejscie(s, g, { teraz: T0 + 10 * MINUTA });
  assert.equal(w403.luki[0].status, 403);
  assert.match(miara(s).cechy.zrodlo, /403/);

  // gałęzie: odmowa zatrzymuje dalsze pytania (limit), sieć też, a odpowiedź niebędąca listą idzie dalej
  g.lista = null;
  g.galezie.r1 = []; g.galezie.r2 = [];
  for (const tryb of [403, 'siec']) {
    g.galezieTryb = { '*': tryb };
    g.zapytania.length = 0;
    r.ustawMeta('obserwator:kursor', '0');
    const w = await obejscie(s, g, { teraz: T0 + 20 * MINUTA });
    assert.equal(w.ok, true, 'lista się udała, więc coś obserwator przyniósł');
    assert.equal(w.stan, 'czesciowe');
    assert.equal(g.zapytania.filter((z) => /\/branches/.test(z.url)).length, 1, 'po odmowie nie męczymy API dalej: ' + tryb);
    assert.equal(r.meta('obserwator:kursor'), '0', 'kursor nie przeskakuje repozytorium, którego nie sprawdzono');
    assert.equal(stanPo(), dobry, 'gałęzie, których nie udało się odczytać, nie są odkładane: ' + tryb);
    assert.ok(w.luki.some((l) => l.repo === 'r1'));
    assert.match(miara(s).cechy.zrodlo, /luki: [1-9]/);
  }
  g.galezieTryb = { '*': 'obiekt' };
  r.ustawMeta('obserwator:kursor', '0');
  const wo = await obejscie(s, g, { teraz: T0 + 21 * MINUTA });
  assert.equal(wo.stan, 'czesciowe');
  assert.equal(wo.luki.filter((l) => l.repo).length, 2, 'odpowiedź niebędąca listą nie zatrzymuje reszty');
  assert.equal(stanPo(), dobry);
  assert.equal(repo(s, 11).cechy.galezie, 1, 'liczba gałęzi zostaje ostatnią znaną');

  // po awarii wszystko wraca do zdrowia
  g.galezieTryb = {};
  g.galezie.r1 = [galGH('main'), galGH('x')];
  r.ustawMeta('obserwator:kursor', '0');
  const wz = await obejscie(s, g, { teraz: T0 + 22 * MINUTA });
  assert.equal(wz.stan, 'ok');
  assert.match(miara(s).cechy.zrodlo, /luki: brak/);
  assert.equal(repo(s, 11).cechy.galezie, 2);
});

test('7. repozytorium, które zniknęło z pełnej listy, jest odłożone (z gałęziami); przy liście częściowej nie', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'r1'), repoGH(12, 'r2'), repoGH(13, 'r3')], galezie: { r3: [galGH('main')] } });
  await obejscie(s, g);
  const r3 = repo(s, 13);
  assert.equal(galezieRepo(s, r3.id).length, 1);
  g.repos = g.repos.filter((x) => x.id !== 13);
  const w = await obejscie(s, g, { teraz: T0 + MINUTA });
  assert.equal(w.stan, 'ok');
  assert.ok(w.odlozone >= 1);
  assert.equal(repo(s, 13).odlozone, true);
  assert.match(repo(s, 13).powod, /zniknęło/);
  assert.equal(s.wszystkie({ rodzaj: 'repo/1' }).length, 2);
  assert.equal(galezieRepo(s, r3.id).length, 0, 'gałęzie zniknionego repozytorium też są odłożone');
  // wraca: ta sama rzecz, przywrócona
  g.repos.push(repoGH(13, 'r3'));
  await obejscie(s, g, { teraz: T0 + 2 * MINUTA });
  assert.equal(repo(s, 13).id, r3.id);
  assert.equal(repo(s, 13).odlozone, undefined);
  assert.equal(s.wszystkie({ rodzaj: 'repo/1' }).length, 3);
});

test('7b. lista częściowa (druga strona odmawia) niczego nie odkłada, a repozytoria ze strony pierwszej są dalej obserwowane', { timeout: 60000 }, async () => {
  const { s } = await swiat();
  const ids = Array.from({ length: 102 }, (_, i) => i + 1);
  const g = github({ repos: ids.map((i) => repoGH(i, 'r' + i)) });
  const w1 = await obejscie(s, g, { ileRepoNaRaz: 1 });
  assert.equal(w1.stan, 'ok');
  assert.equal(s.ile({ rodzaj: 'repo/1' }), 102);
  g.listaStrona2 = 403;
  g.repos[0] = repoGH(1, 'r1', { description: 'zmiana na pierwszej stronie' });
  const w2 = await obejscie(s, g, { ileRepoNaRaz: 1, teraz: T0 + MINUTA });
  assert.equal(w2.ok, true);
  assert.equal(w2.stan, 'czesciowe');
  assert.equal(w2.luki[0].status, 403);
  assert.equal(w2.odlozone, 0);
  assert.equal(s.ile({ rodzaj: 'repo/1' }), 102, 'reszta listy nieznana to nie zero repozytoriów');
  assert.equal(repo(s, 1).cechy.opis, 'zmiana na pierwszej stronie');
  assert.match(miara(s).cechy.zrodlo, /403/);
});

test('8. token nie pojawia się w żadnej rzeczy, w mierze, w mecie, w zapisach, w wyniku ani w tekście /co-tu-jest', async () => {
  const TOKEN = 'ghp_TAJNY_TOKEN_1234567890';
  const { s, r } = await swiat();
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main')] } });
  const wyniki = [await obejscie(s, g, { token: TOKEN })];
  assert.ok(g.zapytania.every((z) => z.headers.authorization === 'Bearer ' + TOKEN), 'token idzie tylko w nagłówku do GitHuba');
  assert.match(miara(s).cechy.zrodlo, /z tokenem: tak/);
  // błędy, które niosą token w treści, też go nie wyniosą
  const zly = { fetchFn: async () => { throw new Error('zerwane połączenie z nagłówkiem Bearer ' + TOKEN); } };
  wyniki.push(await obejdz(s, { ...zly, token: TOKEN, owner: WLAS, teraz: T0 + MINUTA }));
  g.galezieTryb = { '*': 'siec' };
  wyniki.push(await obejscie(s, g, { token: TOKEN, teraz: T0 + 2 * MINUTA }));
  g.lista = 403;
  wyniki.push(await obejscie(s, g, { token: TOKEN, teraz: T0 + 3 * MINUTA }));
  const nic = (nazwa, tekst) => assert.ok(!String(tekst).includes(TOKEN), 'token wyciekł: ' + nazwa);
  wyniki.forEach((w, i) => nic('wynik ' + i, JSON.stringify(w)));
  nic('rzeczy', JSON.stringify(s.wszystkie({ odlozone: 'razem' })));
  nic('zapisy', JSON.stringify(s.q('SELECT tresc FROM zapisy')));
  nic('akty', JSON.stringify(s.q('SELECT * FROM akty')));
  nic('meta', JSON.stringify(s.q('SELECT * FROM meta')));
  nic('/co-tu-jest', coTuJest(s, { origin: 'https://x.test' }));
  assert.match(coTuJest(s, { origin: 'https://x.test' }), /Obserwator faktów/);
  assert.ok(r);
});

test('9. imię obserwator nie przejdzie jako klucz; POST /api/srodowisko/obejdz: 403 dla nie-właściciela, 503 bez włączonego obserwatora', async () => {
  assert.ok(IMIONA_ZASTRZEZONE.includes('obserwator'));
  const k = wczytajKlucze({ KLUCZE: JSON.stringify({ obserwator: 'a'.repeat(64), 'agent-probny': 'b'.repeat(64) }) });
  assert.deepEqual(k.wpisy.map(([i]) => i), ['agent-probny'], 'klucz o imieniu obserwator jest pomijany');
  assert.equal(wczytajKlucze({ KLUCZE: JSON.stringify({ obserwator: 'a'.repeat(64) }) }).ok, false);

  const { s } = await swiat();
  const zap = (kto, opcje = {}) => obsluzSrodowisko(s, new Request('https://przyklad.test/api/srodowisko/obejdz', { method: 'POST', headers: { 'x-kto': kto } }), { podglad: true, ...opcje });
  let wolana = 0;
  const obejdzZwiazane = async () => { wolana++; return { ok: true, stan: 'ok', repozytoria: 0, galezie_sprawdzone: 0, zmienione: 0, bez_zmian: 0, odlozone: 0, luki: [], zadan: 1 }; };
  assert.equal((await zap('agent-probny', { obejdz: obejdzZwiazane })).status, 403);
  assert.equal((await zap('agent-probny')).status, 403, 'nie-właściciel dostaje 403 także wtedy, gdy obserwator jest wyłączony');
  assert.equal((await zap('')).status, 401);
  assert.equal(wolana, 0, 'cudzy ruch nie uruchamia obejścia');
  const brak = await zap('jozz');
  assert.equal(brak.status, 503);
  assert.match(await brak.text(), /obserwator nie jest włączony/);
  const dobre = await zap('jozz', { obejdz: obejdzZwiazane });
  assert.equal(dobre.status, 200);
  assert.equal((await dobre.json()).stan, 'ok');
  assert.equal(wolana, 1);
  // GET na tych drzwiach nie robi nic
  assert.equal((await obsluzSrodowisko(s, new Request('https://przyklad.test/api/srodowisko/obejdz', { headers: { 'x-kto': 'jozz' } }), { obejdz: obejdzZwiazane })).status, 404);
});

function obiektZAlarmem({ env = {}, alarm = null } = {}) {
  const st = { alarm, ustawienia: [] };
  const ctx = { storage: { sql: sqlZNode(), getAlarm: async () => st.alarm, setAlarm: async (t) => { st.alarm = t; st.ustawienia.push(t); } } };
  return { obiekt: new Miejsce(ctx, { WLASCICIEL: 'jozz', ...env }), st };
}
async function zPodstawionymGithubem(g, fn) {
  const oryginal = globalThis.fetch;
  globalThis.fetch = g.fetchFn;
  try { return await fn(); } finally { globalThis.fetch = oryginal; }
}

test('10. alarm() woła obejście i ustawia następny alarm także wtedy, gdy obejście rzuci błąd', async () => {
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main')] } });
  // zwykły przebieg: zasiew, obejście, następny alarm za OBSERWATOR_CO_MIN minut
  {
    const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', OBSERWATOR_CO_MIN: '10', GITHUB_DANE_TOKEN: 'ghp_x_1234567890', OBSERWATOR_WLASCICIEL: WLAS } });
    const przed = Date.now();
    await zPodstawionymGithubem(g, () => obiekt.alarm());
    assert.equal(obiekt.srod.ile({ rodzaj: 'repo/1' }), 1, 'alarm zasiał Miejsce i przyniósł fakty');
    assert.equal(st.ustawienia.length, 1);
    assert.ok(st.ustawienia[0] >= przed + 10 * MINUTA && st.ustawienia[0] <= Date.now() + 10 * MINUTA);
    assert.ok(g.zapytania.some((z) => z.headers.authorization === 'Bearer ghp_x_1234567890'));
    assert.ok(g.zapytania.some((z) => z.url.includes('/users/' + WLAS + '/')), 'właściciel z OBSERWATOR_WLASCICIEL');
  }
  // domyślnie 30 minut, nie rzadziej niż co 5
  for (const [co, oczekiwane] of [[undefined, 30], ['1', 5], ['nie liczba', 30], ['45', 45]]) {
    const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', ...(co !== undefined ? { OBSERWATOR_CO_MIN: co } : {}) } });
    const przed = Date.now();
    await zPodstawionymGithubem(g, () => obiekt.alarm());
    assert.ok(Math.abs(st.ustawienia[0] - przed - oczekiwane * MINUTA) < 5000, `co=${co}: ${(st.ustawienia[0] - przed) / MINUTA} min`);
  }
  // sieć pada: obejście nie rzuca, ale alarm i tak wraca
  {
    const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' } });
    const zepsuty = github({ lista: 'siec' });
    await zPodstawionymGithubem(zepsuty, () => obiekt.alarm());
    assert.equal(st.ustawienia.length, 1);
  }
  // coś w środku rzuca naprawdę (zasiew, a potem samo obejście): następny alarm i tak jest ustawiony
  {
    const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' } });
    obiekt.srod.zasiej = async () => { throw new Error('zasiew padł'); };
    await zPodstawionymGithubem(g, () => obiekt.alarm());
    assert.equal(st.ustawienia.length, 1, 'błąd zasiewu nie zatrzymuje budzenia');
  }
  {
    const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' } });
    await obiekt.srod.zasiej(ziarna({ wlasciciel: 'jozz' }));
    obiekt.srod.wszystkie = () => { throw new Error('baza padła'); };
    obiekt.srod.spis = () => { throw new Error('baza padła'); };
    await zPodstawionymGithubem(g, () => obiekt.alarm());
    assert.equal(st.ustawienia.length, 1, 'błąd obejścia nie zatrzymuje budzenia');
  }
  // wyłączony obserwator: nic nie robi i nie budzi się dalej
  {
    const { obiekt, st } = obiektZAlarmem({ env: {} });
    const zapytan = g.zapytania.length;
    await zPodstawionymGithubem(g, () => obiekt.alarm());
    assert.equal(g.zapytania.length, zapytan);
    assert.equal(st.ustawienia.length, 0);
  }
});

test('10b. pierwszy alarm po zasiewie: za minutę, tylko gdy obserwator jest włączony i nie ma jeszcze alarmu; bez getAlarm nic się nie psuje', async () => {
  const g = github({ repos: [repoGH(11, 'r1')] });
  const wejdz = (obiekt, sciezka = '/co-tu-jest', metoda = 'GET', kto = '') => obiekt.fetch(new Request('https://x.test' + sciezka, { method: metoda, headers: { 'x-kto': kto } }));
  {
    const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' } });
    const przed = Date.now();
    assert.equal((await wejdz(obiekt)).status, 200);
    assert.equal(st.ustawienia.length, 1);
    assert.ok(Math.abs(st.ustawienia[0] - przed - MINUTA) < 5000);
    await wejdz(obiekt);
    assert.equal(st.ustawienia.length, 1, 'drugie wejście nie ustawia alarmu drugi raz');
  }
  {
    const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' }, alarm: Date.now() + 5 * MINUTA });
    await wejdz(obiekt);
    assert.equal(st.ustawienia.length, 0, 'istniejącego alarmu nie ruszamy');
  }
  {
    const { obiekt, st } = obiektZAlarmem({ env: {} });
    await wejdz(obiekt);
    assert.equal(st.ustawienia.length, 0, 'wyłączony obserwator nie ustawia alarmu');
  }
  {
    // prawdziwy ctx sprawdzianów ma tylko sql
    const obiekt = new Miejsce({ storage: { sql: sqlZNode() } }, { OBSERWATOR: 'tak', WLASCICIEL: 'jozz' });
    assert.equal((await wejdz(obiekt)).status, 200);
    await zPodstawionymGithubem(g, () => obiekt.alarm());
  }
  // ręczne obejście przez Miejsce: właściciel tak, ustawienia z env, inni nie; wyłączony obserwator: 503
  {
    const { obiekt } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', OBSERWATOR_WLASCICIEL: WLAS } });
    assert.equal((await wejdz(obiekt, '/api/srodowisko/obejdz', 'POST', 'agent-probny')).status, 403);
    const odpowiedz = await zPodstawionymGithubem(g, () => wejdz(obiekt, '/api/srodowisko/obejdz', 'POST', 'jozz'));
    assert.equal(odpowiedz.status, 200);
    const w = await odpowiedz.json();
    assert.equal(w.stan, 'ok');
    assert.equal(w.repozytoria, 1);
    assert.equal(obiekt.srod.ile({ rodzaj: 'repo/1' }), 1);
  }
  {
    const { obiekt } = obiektZAlarmem({ env: {} });
    assert.equal((await wejdz(obiekt, '/api/srodowisko/obejdz', 'POST', 'jozz')).status, 503);
  }
});

test('/co-tu-jest: obserwator mówi wprost, że jeszcze nie chodził, a po obejściu podaje liczby, chwilę i luki', async () => {
  const { s } = await swiat();
  const przed = coTuJest(s, { origin: 'https://x.test' });
  assert.match(przed, /Obserwator faktów[^\n]*jeszcze nie chodził/);
  assert.match(przed, /obejdz:/, 'czasownik obejdz jest w spisie');
  const g = github({ repos: [repoGH(11, 'r1'), repoGH(12, 'r2')], galezie: { r1: [galGH('main'), galGH('dev')] } });
  await obejscie(s, g);
  let po = coTuJest(s, { origin: 'https://x.test' });
  assert.match(po, /Obserwator faktów[^\n]*2 repozytoria i 2 gałęzie/);
  assert.match(po, /2026-11-17 12:00 UTC/);
  assert.match(po, /luki: brak/);
  g.lista = 403;
  await obejscie(s, g, { teraz: T0 + MINUTA });
  po = coTuJest(s, { origin: 'https://x.test' });
  assert.match(po, /Obserwator faktów[^\n]*nie powiodła się[^\n]*403/);
  assert.match(po, /2026-11-17 12:00 UTC/, 'chwila ostatniego UDANEGO obejścia zostaje');
  // pierwsza próba, która się nie udała, też jest widoczna
  const { s: s2 } = await swiat();
  await obejscie(s2, github({ lista: 403 }));
  assert.match(coTuJest(s2, { origin: 'https://x.test' }), /Obserwator faktów[^\n]*jeszcze nie przyniósł[^\n]*403/);
  assert.equal(miara(s2), null, 'bez udanego obejścia nie ma miary: nieznane to nie zero');
});

test('6b. odpowiedź o gałęziach urwana na trzech stronach jest niepełna: nic z niej nie odkłada, a luka jest widoczna', { timeout: 60000 }, async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main'), galGH('stara')] } });
  await obejscie(s, g);
  g.galezie.r1 = Array.from({ length: 300 }, (_, i) => galGH('g' + i));
  const w = await obejscie(s, g, { teraz: T0 + MINUTA });
  assert.equal(w.stan, 'czesciowe');
  assert.ok(w.luki.some((l) => /więcej niż 300/.test(l.blad)));
  assert.equal(w.odlozone, 0);
  const rid = repo(s, 11).id;
  assert.ok(galezieRepo(s, rid).some((x) => x.cechy.nazwa === 'stara'), 'gałąź spoza niepełnej odpowiedzi zostaje');
  assert.equal(repo(s, 11).cechy.galezie, 2, 'liczba gałęzi zostaje ostatnią pewną, a nie 300 z niepełnej odpowiedzi');
});
