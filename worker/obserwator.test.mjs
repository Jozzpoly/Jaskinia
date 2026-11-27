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
import { obejdz, zBiblioteki } from './obserwator.mjs';

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

// po numerze z GitHuba (cecha, już nie klucz); gdy są dwie rzeczy z tym numerem (po zmianie nazwy), pierwsza jest żywa
const repo = (s, id) => s.spis({ rodzaj: 'repo/1', gdzie: { github_id: id }, odlozone: 'razem' }).sort((a, b) => Number(!!a.odlozone) - Number(!!b.odlozone))[0] || null;
const repoN = (s, pelna) => s.spis({ rodzaj: 'repo/1', gdzie: { pelna_nazwa: pelna }, odlozone: 'razem', limit: 1 })[0] || null;
const galezieRepo = (s, rzecz, odlozone = 'nie') => s.wszystkie({ rodzaj: 'galaz/1', gdzie: { repo: rzecz }, odlozone });
const miara = (s) => s.spis({ rodzaj: 'miara/1', gdzie: { nazwa: 'obserwator-faktow' }, odlozone: 'razem', limit: 1 })[0] || null;
const obejscie = (s, g, extra = {}) => obejdz(s, { fetchFn: g.fetchFn, owner: WLAS, teraz: T0, ...extra });

test('zasiew: kształty repo/1 i galaz/1 z kluczem, obszar Fakty z prawem prowadzenia i uczestnik obserwator jako automat', async () => {
  const { s, fakty } = await swiat();
  const kr = s.ksztaltDla('repo/1'), kg = s.ksztaltDla('galaz/1');
  assert.deepEqual(kr.klucz, ['pelna_nazwa']);
  assert.equal(kr.cechy.github_id.wymagana, undefined, 'numer z GitHuba nie jest już kluczem ani wymagany');
  assert.deepEqual(s.ksztaltDla('rodzina/1').klucz, ['znak']);
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
  // ZNANE OGRANICZENIE: tożsamość to pełna nazwa (bo drugie źródło nie zna numeru), więc zmiana nazwy u źródła to dziś
  // NOWA rzecz, a stara jest odłożona z powodem (nie ginie). Gdyby klucz był numerem, to byłaby ta sama rzecz.
  g.repos[0] = repoGH(11, 'r1-nowa', { has_pages: false });
  await obejscie(s, g, { teraz: T0 + 15 * MINUTA });
  assert.notEqual(repo(s, 11).id, id, 'nowa nazwa to nowa rzecz');
  assert.equal(repo(s, 11).cechy.nazwa, 'r1-nowa');
  assert.equal(repoN(s, 'jozzpoly/r1').odlozone, true, 'stara nazwa jest odłożona, nie skasowana');
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
  // kursor to pełna nazwa ostatniego sprawdzonego repozytorium (małymi literami); '0' = zacznij od początku
  assert.deepEqual(kolejne[0], [['r1', 'r2', 'r3'], 'jozzpoly/r3']);
  assert.deepEqual(kolejne[1], [['r4', 'r5', 'r6'], 'jozzpoly/r6']);
  assert.deepEqual(kolejne[2], [['r7'], '0'], 'koniec koła: kursor wraca na początek');
  assert.deepEqual(kolejne[3], [['r1', 'r2', 'r3'], 'jozzpoly/r3']);
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
  assert.match(await brak.text(), /obserwator nie chodzi w tym Miejscu/);
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

// =====================================================================================================================
// Drugie źródło: plik faktów starej Jaskini (17 XI 2026). Sieć nadal podstawiona: adres pliku obsługuje ta sama funkcja.
// Próbka jest wycięta z prawdziwego pliku (3 repozytoria z 2 rodzin, po 3 gałęzie; tematy i opisy bez zmian).
// =====================================================================================================================
const ADRES_PLIKU = 'https://raw.githubusercontent.com/Jozzpoly/Jozz-Cave-Workbench/main/data/library.json';
const WIEK_PLIKU = '2026-10-19T01:26:00.000Z'; // estate.generated "2026-10-19T01:26+00:00"
const PROBKA = {
 "estate": {
  "generated": "2026-10-19T01:26+00:00",
  "coverage": { "expected": 3, "collected": 3, "public": 3, "private": 0, "empty": [], "missing": [], "unlisted": [] }
 },
 "families": [
  {
   "id": "medium",
   "name": "Medium",
   "question": "Jak Ty i agenci dzielicie rzeczywistość projektów, żebyś nie był kurierem między nimi?",
   "repos": [
    "Shared-Work-Medium-Lab",
    "Jozz-Cave-Workbench"
   ]
  },
  {
   "id": "zywe",
   "name": "Żywe istoty",
   "question": "Czy postać w grze może naprawdę żyć: czuć, pamiętać, działać sama i być partnerem?",
   "repos": [
    "ReflexBrain-Lab",
    "Companion-Brain-Lab",
    "Llm-Live-NPC",
    "Gloopipelago",
    "Cognitive-Ecology-Lab"
   ]
  }
 ],
 "repos": [
  {
   "name": "Jozz-Cave-Workbench",
   "short": "Cave Workbench",
   "family": "medium",
   "private": false,
   "identity": "Dom Jaskini, Twojego okna na wszystkie projekty: kod, testy, kompas i publiczny podgląd. Twoja prywatna Jaskinia żyje jako artefakt.",
   "desc": "Jaskinia Joza - a może kiedyś więcej ;>",
   "url": "https://github.com/Jozzpoly/Jozz-Cave-Workbench",
   "pages": null,
   "created": "2026-10-13T22:45:31Z",
   "pushed": "2026-10-19T01:11:40Z",
   "default": "main",
   "life": "żywe",
   "commits": 133,
   "stack": [],
   "branches": [
    {
     "n": "v6-materialy",
     "sha": "32c25d451b",
     "ts": 1792372297,
     "s": "Jaskinia v6.3: a release older tabs cannot undo; the GPT lines' findings answered",
     "a": 13,
     "b": 0,
     "fork": 1792119232
    },
    {
     "n": "gh-pages",
     "sha": "099788b314",
     "ts": 1792369979,
     "s": "data(jaskinia): expose verified VAW Pages play entry in published snapshot",
     "a": 9,
     "b": 0,
     "fork": 1792119232
    },
    {
     "n": "experiment/gpt-v61-oldtab-2026-10-18",
     "sha": "7c683e4de2",
     "ts": 1792361741,
     "s": "test(gpt): gate v6 material interleaving on committed IndexedDB records, not UI cache",
     "a": 15,
     "b": 0,
     "fork": 1792119232
    }
   ]
  },
  {
   "name": "Llm-Live-NPC",
   "short": "LLM Live NPC",
   "family": "zywe",
   "private": false,
   "identity": "NPC napędzany małym LLM, który mieszka w świecie: widzi tylko swoje, pamięta i działa wyłącznie przez sprawdzone możliwości świata.",
   "desc": null,
   "url": "https://github.com/Jozzpoly/Llm-Live-NPC",
   "pages": null,
   "created": "2026-09-05T10:01:22Z",
   "pushed": "2026-10-12T16:14:34Z",
   "default": "main",
   "life": "żywe",
   "commits": 2622,
   "stack": [
    "Cloudflare",
    "TypeScript",
    "Vite",
    "Vitest"
   ],
   "branches": [
    {
     "n": "research/spc-r6-five-resident-relational-episode-20261011",
     "sha": "555e64cf5e",
     "ts": 1791821668,
     "s": "fix(spc-world-ui): keep object labels off actor bodies and report verified workshop completion",
     "a": 1884,
     "b": 0,
     "fork": 1788613952
    },
    {
     "n": "evidence/spc-browser-latest",
     "sha": "5465d00f60",
     "ts": 1791821521,
     "s": "SPC browser evidence for e1da810da098cb3a64e3a4d9030cc745ca6a2c2c",
     "a": 1,
     "b": 7,
     "fork": null
    },
    {
     "n": "staging/spc-research-first-luna-20261011",
     "sha": "fcbc7b7de0",
     "ts": 1791695094,
     "s": "test(spc-staging): fail fast on reachable Worker with absent runtime secret bindings",
     "a": 1829,
     "b": 0,
     "fork": 1788613952
    }
   ]
  },
  {
   "name": "ReflexBrain-Lab",
   "short": "ReflexBrain",
   "family": "zywe",
   "private": false,
   "identity": "Czy tani, lokalny mechanizm uczący się wyciągnie znaczenie z prywatnego doświadczenia żyjącego, ucieleśnionego aktora.",
   "desc": null,
   "url": "https://github.com/Jozzpoly/ReflexBrain-Lab",
   "pages": "https://jozzpoly.github.io/ReflexBrain-Lab/",
   "created": "2026-09-19T21:42:27Z",
   "pushed": "2026-10-11T19:22:17Z",
   "default": "main",
   "life": "stygnące",
   "commits": 1263,
   "stack": [
    "Rapier",
    "TypeScript",
    "Vite",
    "Vitest"
   ],
   "branches": [
    {
     "n": "research/living-organism-runtime-a-2026-10-08",
     "sha": "cb03fcd1ca",
     "ts": 1791746527,
     "s": "docs: park Living A campaign and clarify cross-project orientation",
     "a": 861,
     "b": 1,
     "fork": 1789854954
    },
    {
     "n": "research/pre-o0-foundations-campaign",
     "sha": "5c213e5eac",
     "ts": 1791697399,
     "s": "docs(reflexbrain): qualify live D1 Chrome without promoting machine to organism",
     "a": 901,
     "b": 1,
     "fork": 1789854954
    },
    {
     "n": "docs/world-d1-public-qualified-handoff-2026-10-11",
     "sha": "699a9e0a48",
     "ts": 1791697287,
     "s": "docs(reflexbrain): record verified live D1 Chrome + preserve Owner S0 FAIL and next local-learning question",
     "a": 901,
     "b": 1,
     "fork": 1789854954
    }
   ]
  }
 ]
};

const kopia = (x) => JSON.parse(JSON.stringify(x));
// Sieć z dwoma adresami: GitHub (podstawiony `g`) i plik. `plik.tryb`: 'ok' | 'siec' | 'tekst' (tresc jest napisem) | status liczbowy.
function siec(g, plik = {}) {
  const w = { g, plik: { tryb: 'ok', tresc: PROBKA, ...plik }, plikZapytan: 0 };
  w.fetchFn = async (url, opcje = {}) => {
    if (String(url) === ADRES_PLIKU) {
      w.plikZapytan++;
      const p = w.plik;
      if (p.tryb === 'siec') throw new Error('gniazdo zerwane');
      if (typeof p.tryb === 'number') return new Response('nie ma', { status: p.tryb });
      return new Response(p.tryb === 'tekst' ? p.tresc : JSON.stringify(p.tresc), { status: 200 });
    }
    return g.fetchFn(url, opcje);
  };
  return w;
}
const zBiblioteka = (s, w, extra = {}) => obejdz(s, { fetchFn: w.fetchFn, owner: WLAS, teraz: T0, biblioteka: ADRES_PLIKU, ...extra });
const wszystkieFakty = (s) => ['rodzina/1', 'repo/1', 'galaz/1'].flatMap((rodzaj) => s.wszystkie({ rodzaj, odlozone: 'razem' }));
const stanFaktow = (s) => wszystkieFakty(s).map((x) => [x.id, x.numer, x.wersja, !!x.odlozone].join(':')).sort();
const ZREFLEX = 'jozzpoly/reflexbrain-lab';

test('F1. API odmawia (403), jest biblioteka: przychodzą rodziny, repozytoria (z rodziną, tożsamością, stroną) i gałęzie (z kiedy i temat), każda ze stan_na z wieku pliku', async () => {
  const { s } = await swiat();
  const w = await zBiblioteka(s, siec(github({ lista: 403 })));
  assert.equal(w.ok, true, JSON.stringify(w));
  assert.equal(w.zrodlo, 'plik');
  assert.equal(w.zebrane, WIEK_PLIKU);
  assert.equal(w.stan, 'czesciowe', 'odmowa API zostaje w lukach, więc obejście nie jest ok');
  assert.ok(w.luki.some((l) => l.gdzie === 'lista' && l.status === 403), 'odmowa API jest widoczna');
  assert.equal(s.ile({ rodzaj: 'rodzina/1' }), 2);
  assert.equal(s.ile({ rodzaj: 'repo/1' }), 3);
  assert.equal(s.ile({ rodzaj: 'galaz/1' }), 9);
  for (const x of wszystkieFakty(s)) {
    assert.equal(x.cechy.stan_na, WIEK_PLIKU, `${x.rodzaj}: stan_na to wiek faktów z pliku, nie chwila obejścia`);
    assert.equal(x.utworzyl, 'obserwator');
  }
  const zywe = s.spis({ rodzaj: 'rodzina/1', gdzie: { znak: 'zywe' } })[0];
  assert.equal(zywe.cechy.nazwa, 'Żywe istoty');
  assert.match(zywe.cechy.pytanie, /naprawdę żyć/);
  const r = repoN(s, ZREFLEX);
  assert.equal(r.cechy.nazwa, 'ReflexBrain-Lab');
  assert.equal(r.cechy.ladna_nazwa, 'ReflexBrain');
  assert.match(r.cechy.tozsamosc, /^Czy tani, lokalny/);
  assert.equal(r.cechy.rodzina, zywe.id, 'rodzina wskazuje rzecz rodziny');
  assert.equal(r.cechy.strona, 'https://jozzpoly.github.io/ReflexBrain-Lab/');
  assert.equal(r.cechy.adres, 'https://github.com/Jozzpoly/ReflexBrain-Lab');
  assert.equal(r.cechy.ostatni_push, PROBKA.repos[2].pushed);
  assert.equal(r.cechy.utworzone, PROBKA.repos[2].created);
  assert.equal(r.cechy.zycie, 'stygnące');
  assert.equal(r.cechy.commity, PROBKA.repos[2].commits);
  assert.deepEqual(r.cechy.stos, ['Rapier', 'TypeScript', 'Vite', 'Vitest']);
  assert.equal(r.cechy.github_id, undefined, 'plik nie zna numeru z GitHuba, więc cechy nie ma');
  assert.equal(r.cechy.galezie, 3);
  assert.match(r.cechy.zrodlo_faktow, /plik faktów starej Jaskini/);
  assert.equal(repoN(s, 'jozzpoly/jozz-cave-workbench').cechy.strona, undefined, 'pages: null to brak strony');
  const g1 = galezieRepo(s, r.id).find((x) => x.cechy.nazwa === 'research/pre-o0-foundations-campaign');
  assert.equal(g1.cechy.commit, '5c213e5', 'skrót z pliku (10 znaków) ma 7 jak z API');
  assert.equal(g1.cechy.kiedy, new Date(PROBKA.repos[2].branches[1].ts * 1000).toISOString().replace('.000Z', 'Z'));
  assert.equal(g1.cechy.temat, PROBKA.repos[2].branches[1].s);
  assert.match(miara(s).cechy.zrodlo, /^Plik faktów starej Jaskini/);
  assert.equal(miara(s).cechy.stan_na, WIEK_PLIKU, 'miara mówi wiek faktów, nie chwilę obejścia');
  assert.equal(miara(s).cechy.wartosc, 3);
});

test('F1b. temat ostatniego commita jest obcięty do 200 znaków', async () => {
  const p = kopia(PROBKA);
  p.repos[0].branches[0].s = 'x'.repeat(500);
  const { s } = await swiat();
  await zBiblioteka(s, siec(github({ lista: 403 }), { tresc: p }));
  const g1 = s.wszystkie({ rodzaj: 'galaz/1' }).find((x) => x.cechy.nazwa === 'v6-materialy');
  assert.equal(g1.cechy.temat.length, 200);
});

test('F2. drugie takie samo obejście z pliku nie zapisuje żadnej rzeczy rodziny, repozytorium ani gałęzi', async () => {
  const { s } = await swiat();
  const sieciowy = siec(github({ lista: 403 }));
  await zBiblioteka(s, sieciowy);
  const przed = stanFaktow(s), aktPrzed = s.ostatniNr();
  const w = await zBiblioteka(s, sieciowy, { teraz: T0 + 30 * MINUTA });
  assert.deepEqual(stanFaktow(s), przed);
  assert.equal(w.zmienione, 0);
  assert.equal(w.odlozone, 0);
  assert.equal(w.bez_zmian, 2 + 3 + 9);
  assert.equal(s.ostatniNr(), aktPrzed, 'nie zmieniła się nawet miara: jej treść nie zależy od chwili obejścia');
});

test('F3. API działa i jest biblioteka: fakty z API zostają, z pliku dochodzą tylko rodzina, tożsamość, ładna nazwa, życie, stos i commity', async () => {
  const { s } = await swiat();
  const g = github({
    repos: [repoGH(11, 'ReflexBrain-Lab', { description: 'opis z API', pushed_at: '2026-11-10T10:00:00Z', language: 'TypeScript' }), repoGH(12, 'Nowe-Tylko-W-API')],
    galezie: { 'ReflexBrain-Lab': [galGH('main')], 'Nowe-Tylko-W-API': [galGH('main')] },
  });
  const w = await zBiblioteka(s, siec(g));
  assert.equal(w.zrodlo, 'api');
  assert.equal(w.stan, 'ok', JSON.stringify(w.luki));
  const r = repoN(s, ZREFLEX);
  assert.equal(r.cechy.github_id, 11);
  assert.equal(r.cechy.ostatni_push, '2026-11-10T10:00:00Z', 'ostatni push z API, nie z pliku');
  assert.equal(r.cechy.opis, 'opis z API');
  assert.equal(r.cechy.jezyk, 'TypeScript');
  assert.equal(r.cechy.strona, undefined, 'strona jest faktem API: plik jej nie dokłada');
  assert.equal(r.cechy.stan_na, new Date(T0).toISOString(), 'fakty z API mają wiek obejścia');
  assert.equal(r.cechy.ladna_nazwa, 'ReflexBrain');
  assert.match(r.cechy.tozsamosc, /^Czy tani/);
  assert.equal(r.cechy.zycie, 'stygnące');
  assert.equal(r.cechy.commity, PROBKA.repos[2].commits);
  assert.deepEqual(r.cechy.stos, ['Rapier', 'TypeScript', 'Vite', 'Vitest']);
  assert.equal(s.spis({ rodzaj: 'rodzina/1', gdzie: { znak: 'zywe' } })[0].id, r.cechy.rodzina);
  assert.match(r.cechy.zrodlo_faktow, /GitHub API/);
  assert.match(r.cechy.zrodlo_faktow, /pliku faktów starej Jaskini/);
  // repozytoria, których API nie zna, z pliku nie wchodzą (plik tylko dokłada)
  assert.equal(s.ile({ rodzaj: 'repo/1' }), 2);
  assert.equal(repoN(s, 'jozzpoly/llm-live-npc'), null);
  assert.equal(repoN(s, 'jozzpoly/nowe-tylko-w-api').cechy.ladna_nazwa, undefined);
  assert.equal(s.ile({ rodzaj: 'rodzina/1' }), 2);
  assert.match(miara(s).cechy.zrodlo, /GitHub API/);
  assert.match(miara(s).cechy.zrodlo, /plik faktów starej Jaskini/);
  assert.equal(miara(s).cechy.stan_na, new Date(T0).toISOString());
  // gałąź z tym samym commitem co w pliku dostaje kiedy i temat; z innym commitem nie (temat byłby nieprawdziwy)
  const g2 = github({ repos: [repoGH(13, 'Llm-Live-NPC')], galezie: { 'Llm-Live-NPC': [galGH('evidence/spc-browser-latest', '5465d00f60aaaaaa'), galGH('staging/spc-research-first-luna-20261011', 'ffffffffffff')] } });
  const { s: s2 } = await swiat();
  await zBiblioteka(s2, siec(g2));
  const gal = (n) => s2.wszystkie({ rodzaj: 'galaz/1' }).find((x) => x.cechy.nazwa === n);
  assert.equal(gal('evidence/spc-browser-latest').cechy.temat, PROBKA.repos[1].branches[1].s);
  assert.ok(gal('evidence/spc-browser-latest').cechy.kiedy);
  assert.equal(gal('staging/spc-research-first-luna-20261011').cechy.temat, undefined);
  assert.equal(gal('staging/spc-research-first-luna-20261011').cechy.kiedy, undefined);
  // drugie obejście z pliku niczego nie zmienia
  const przed = stanFaktow(s2);
  await zBiblioteka(s2, siec(g2), { teraz: T0 + MINUTA });
  assert.deepEqual(stanFaktow(s2), przed);
});

test('F4. rzecz z nowszym stan_na (z obejścia API) nie jest cofana przez obejście z pliku, gdy API znów odmawia; plik tylko dokłada brakujące cechy', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'ReflexBrain-Lab', { description: 'opis z API', pushed_at: '2026-11-10T10:00:00Z', has_pages: true })], galezie: { 'ReflexBrain-Lab': [galGH('research/pre-o0-foundations-campaign', '5c213e5aaaaaa'), galGH('main', 'abc1234def')] } });
  await obejscie(s, g); // API bez biblioteki: nic z pliku jeszcze nie wiadomo
  const r0 = repoN(s, ZREFLEX);
  assert.equal(r0.cechy.ladna_nazwa, undefined);
  const numerR = r0.numer;
  const miaraPrzed = miara(s).cechy;
  g.lista = 403;
  const w = await zBiblioteka(s, siec(g), { teraz: T0 + 30 * MINUTA });
  assert.equal(w.zrodlo, 'plik');
  const r = repoN(s, ZREFLEX);
  assert.equal(r.cechy.ostatni_push, '2026-11-10T10:00:00Z', 'nowszy push z API zostaje, choć plik ma inny');
  assert.equal(r.cechy.opis, 'opis z API');
  assert.equal(r.cechy.github_id, 11);
  assert.equal(r.cechy.strona, 'https://jozzpoly.github.io/ReflexBrain-Lab/');
  assert.equal(r.cechy.stan_na, new Date(T0).toISOString(), 'stan_na nie cofa się do wieku pliku');
  assert.equal(r.numer, numerR + 1, 'jedna wersja: dołożenie brakujących cech');
  assert.equal(r.cechy.ladna_nazwa, 'ReflexBrain', 'brakujące cechy plik dokłada');
  assert.match(r.cechy.tozsamosc, /^Czy tani/);
  assert.match(r.cechy.zrodlo_faktow, /GitHub API/);
  assert.match(r.cechy.zrodlo_faktow, /plik/);
  // gałąź z API (ten sam commit co w pliku) dostaje temat; gałąź main z API, której plik nie zna, zostaje
  const gal = (n) => galezieRepo(s, r.id).find((x) => x.cechy.nazwa === n);
  assert.equal(gal('research/pre-o0-foundations-campaign').cechy.stan_na, new Date(T0).toISOString());
  assert.equal(gal('research/pre-o0-foundations-campaign').cechy.temat, PROBKA.repos[2].branches[1].s);
  assert.equal(gal('main').cechy.commit, 'abc1234');
  // gałęzie, które API nie widziało, plik dokłada ze swoim (starszym) wiekiem
  assert.equal(gal('docs/world-d1-public-qualified-handoff-2026-10-11').cechy.stan_na, WIEK_PLIKU);
  // miara z API (nowsza) nie jest nadpisana miarą z pliku; dopisane jest tylko zdanie o próbie
  const m = miara(s).cechy;
  assert.equal(m.stan_na, miaraPrzed.stan_na);
  assert.equal(m.wartosc, miaraPrzed.wartosc);
  assert.match(m.zrodlo, /GitHub API/);
  assert.match(m.zrodlo, /plik/);
});

test('F4b. gałąź z API, której commit różni się od pliku, nie dostaje tematu ani kiedy z pliku', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'ReflexBrain-Lab')], galezie: { 'ReflexBrain-Lab': [galGH('research/pre-o0-foundations-campaign', '1111111aaaa')] } });
  await obejscie(s, g);
  g.lista = 403;
  await zBiblioteka(s, siec(g), { teraz: T0 + 30 * MINUTA });
  const x = s.wszystkie({ rodzaj: 'galaz/1' }).find((q) => q.cechy.nazwa === 'research/pre-o0-foundations-campaign');
  assert.equal(x.cechy.commit, '1111111');
  assert.equal(x.cechy.temat, undefined, 'temat z pliku dotyczy innego commita');
});

test('F5. plik NIEnowszy niż fakty niczego nie odkłada, nawet gdy brakuje w nim repozytorium albo gałęzi, które są w Miejscu', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'ReflexBrain-Lab'), repoGH(12, 'Tylko-W-Miejscu')], galezie: { 'ReflexBrain-Lab': [galGH('galaz-ktorej-plik-nie-zna')], 'Tylko-W-Miejscu': [galGH('main')] } });
  await obejscie(s, g);
  g.lista = 403;
  const w = await zBiblioteka(s, siec(g), { teraz: T0 + MINUTA });
  assert.equal(w.odlozone, 0);
  assert.equal(w.zrodlo, 'plik');
  assert.ok(wszystkieFakty(s).every((x) => !x.odlozone), 'nic nie jest odłożone');
  assert.ok(repoN(s, 'jozzpoly/tylko-w-miejscu'));
  assert.ok(galezieRepo(s, repoN(s, ZREFLEX).id).some((x) => x.cechy.nazwa === 'galaz-ktorej-plik-nie-zna'));
  // odłożone przez API zostaje odłożone: plik jest starszy i nie wskrzesza
  g.lista = null;
  g.repos = g.repos.filter((x) => x.id !== 12);
  await obejscie(s, g, { teraz: T0 + 2 * MINUTA });
  assert.equal(repoN(s, 'jozzpoly/tylko-w-miejscu').odlozone, true);
  g.lista = 403;
  const p = kopia(PROBKA);
  p.repos[2].name = 'Tylko-W-Miejscu';
  await zBiblioteka(s, siec(g, { tresc: p }), { teraz: T0 + 3 * MINUTA });
  assert.equal(repoN(s, 'jozzpoly/tylko-w-miejscu').odlozone, true, 'stary plik nie przywraca tego, co nowsze API odłożyło');
});

test('F6. zepsuty plik (nie-JSON, brak repos, status 404, błąd sieci, zły adres, brak daty) daje lukę i stan brak, bez wyjątku i bez zapisu', async () => {
  const przypadki = [
    ['nie-JSON', { tryb: 'tekst', tresc: '<html>nie json' }],
    ['brak repos', { tresc: { estate: { generated: '2026-10-19T01:26+00:00' }, families: [] } }],
    ['repos nie jest listą', { tresc: { estate: { generated: '2026-10-19T01:26+00:00' }, repos: { a: 1 } } }],
    ['pusta lista repos', { tresc: { estate: { generated: '2026-10-19T01:26+00:00' }, repos: [] } }],
    ['brak estate.generated', { tresc: { repos: PROBKA.repos } }],
    ['zła data estate.generated', { tresc: { estate: { generated: 'wczoraj' }, repos: PROBKA.repos } }],
    ['status 404', { tryb: 404 }],
    ['błąd sieci', { tryb: 'siec' }],
    ['JSON null', { tryb: 'tekst', tresc: 'null' }],
  ];
  for (const [nazwa, plik] of przypadki) {
    const { s } = await swiat();
    const w = siec(github({ lista: 403 }), plik);
    const bezposrednio = await zBiblioteki({ fetchFn: w.fetchFn, adres: ADRES_PLIKU, teraz: T0 });
    assert.equal(bezposrednio.stan, 'brak', nazwa);
    assert.ok(bezposrednio.luki.length >= 1, nazwa);
    const wynik = await zBiblioteka(s, w);
    assert.equal(wynik.stan, 'brak', nazwa);
    assert.equal(wynik.ok, false, nazwa);
    assert.ok(wynik.luki.some((l) => l.gdzie === 'plik'), nazwa + ': luka o pliku');
    assert.ok(wynik.luki.some((l) => l.gdzie === 'lista'), nazwa + ': luka o odmowie API też zostaje');
    assert.equal(s.ile({ rodzaj: 'repo/1' }) + s.ile({ rodzaj: 'galaz/1' }) + s.ile({ rodzaj: 'rodzina/1' }), 0, nazwa + ': niczego nie zapisano');
    assert.equal(miara(s), null, nazwa + ': bez udanego obejścia nie ma miary');
  }
  // adres, który nie jest adresem http(s): plik w ogóle nie jest pytany
  const { s } = await swiat();
  const w = siec(github({ lista: 403 }));
  const wynik = await obejdz(s, { fetchFn: w.fetchFn, owner: WLAS, teraz: T0, biblioteka: 'file:///etc/passwd' });
  assert.equal(wynik.stan, 'brak');
  assert.equal(w.plikZapytan, 0);
  assert.ok(wynik.luki.some((l) => l.gdzie === 'plik' && /adres/.test(l.blad)));
  // plik zepsuty, ale API działa: obejście z API idzie normalnie, a luka o pliku jest widoczna
  const { s: s3 } = await swiat();
  const g3 = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main')] } });
  const w3 = await zBiblioteka(s3, siec(g3, { tryb: 404 }));
  assert.equal(w3.zrodlo, 'api');
  assert.equal(w3.stan, 'czesciowe');
  assert.ok(w3.luki.some((l) => l.gdzie === 'plik'));
  assert.equal(repoN(s3, 'jozzpoly/r1').cechy.nazwa, 'r1');
});

test('F7. repozytorium z private: true w pliku nie wchodzi (ani jego gałęzie)', async () => {
  const p = kopia(PROBKA);
  p.repos.push({ ...kopia(p.repos[0]), name: 'Prywatne-Cos', short: 'Prywatne', private: true, identity: 'tajne' });
  const { s } = await swiat();
  const w = await zBiblioteka(s, siec(github({ lista: 403 }), { tresc: p }));
  assert.equal(w.zrodlo, 'plik');
  assert.equal(repoN(s, 'jozzpoly/prywatne-cos'), null);
  assert.equal(s.ile({ rodzaj: 'repo/1' }), 3);
  assert.equal(s.ile({ rodzaj: 'galaz/1' }), 9);
  assert.ok(!JSON.stringify(wszystkieFakty(s)).includes('tajne'));
  const b = await zBiblioteki({ fetchFn: siec(github(), { tresc: p }).fetchFn, adres: ADRES_PLIKU, teraz: T0 });
  assert.equal(b.repos.length, 3);
});

test('F8. klucz pelna_nazwa: to samo repozytorium z API (z numerem) i z pliku (bez numeru) to TA SAMA rzecz, w obu kolejnościach', async () => {
  const gApi = () => github({ repos: [repoGH(11, 'ReflexBrain-Lab')], galezie: { 'ReflexBrain-Lab': [galGH('main')] } });
  // najpierw plik, potem API
  {
    const { s } = await swiat();
    await zBiblioteka(s, siec(github({ lista: 403 })));
    const id = repoN(s, ZREFLEX).id;
    assert.equal(repoN(s, ZREFLEX).cechy.github_id, undefined);
    await zBiblioteka(s, siec(gApi()), { teraz: T0 + MINUTA });
    const po = repoN(s, ZREFLEX);
    assert.equal(po.id, id, 'ta sama rzecz');
    assert.equal(po.cechy.github_id, 11, 'numer dopisany, gdy tylko API go poda');
    assert.equal(po.cechy.stan_na, new Date(T0 + MINUTA).toISOString());
    assert.equal(s.spis({ rodzaj: 'repo/1', gdzie: { nazwa: 'ReflexBrain-Lab' } }).length, 1, 'bez drugiego egzemplarza');
    assert.equal(s.ile({ rodzaj: 'repo/1' }), 1, 'repozytoria znane tylko z pliku odkłada pełna lista z API (świeższe źródło)');
  }
  // najpierw API, potem plik
  {
    const { s } = await swiat();
    await obejscie(s, gApi());
    const id = repoN(s, ZREFLEX).id;
    const g = gApi(); g.lista = 403;
    await zBiblioteka(s, siec(g), { teraz: T0 + MINUTA });
    assert.equal(repoN(s, ZREFLEX).id, id);
    assert.equal(repoN(s, ZREFLEX).cechy.github_id, 11, 'numer z API zostaje');
    assert.equal(s.spis({ rodzaj: 'repo/1', gdzie: { nazwa: 'ReflexBrain-Lab' } }).length, 1);
  }
  // wielkość liter nie robi nowej rzeczy
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'reflexbrain-LAB')] });
  await obejscie(s, g);
  const p = kopia(PROBKA);
  g.lista = 403;
  await zBiblioteka(s, siec(g, { tresc: p }), { teraz: T0 + MINUTA });
  assert.equal(s.spis({ rodzaj: 'repo/1', gdzie: { pelna_nazwa: ZREFLEX } }).length, 1);
});

test('F9. /co-tu-jest mówi, z którego źródła są fakty i ile mają lat', async () => {
  const { s } = await swiat();
  await zBiblioteka(s, siec(github({ lista: 403 })));
  const t = coTuJest(s, { origin: 'https://x.test' });
  assert.match(t, /Obserwator faktów[^\n]*fakty z pliku starej Jaskini, stan na 2026-10-19 01:26 UTC/);
  assert.match(t, /tak świeże, jak ostatnie odświeżenie starej Jaskini/);
  assert.match(t, /3 repozytoria i 9 gałęzi/);
  // po obejściu z API: źródło to GitHub, a plik, jeśli dołożył, jest wymieniony
  const { s: s2 } = await swiat();
  await zBiblioteka(s2, siec(github({ repos: [repoGH(11, 'ReflexBrain-Lab')], galezie: { 'ReflexBrain-Lab': [galGH('main')] } })));
  const t2 = coTuJest(s2, { origin: 'https://x.test' });
  assert.doesNotMatch(t2, /fakty z pliku starej Jaskini, stan na/);
  assert.match(t2, /Obserwator faktów[^\n]*GitHub API[^\n]*plik faktów starej Jaskini/);
});

test('F10. koło gałęzi z pliku rozkłada się na obejścia po ileRepoNaRaz, a spokojne koło (bez zmian) jest oznaczone', async () => {
  const { s, r } = await swiat();
  const w = siec(github({ lista: 403 }));
  const krok = (i) => zBiblioteka(s, w, { ileRepoNaRaz: 1, teraz: T0 + i * MINUTA });
  const a = await krok(0);
  assert.equal(s.ile({ rodzaj: 'repo/1' }), 3, 'repozytoria wchodzą od razu, bo jest ich niewiele i to jeden wiersz na sztukę');
  assert.equal(s.ile({ rodzaj: 'galaz/1' }), 3, 'gałęzie tylko pierwszego repozytorium');
  assert.equal(r.meta('obserwator:kursor'), 'jozzpoly/jozz-cave-workbench');
  assert.equal(a.kolo_spokojne, undefined, 'koło jeszcze nie domknięte');
  await krok(1);
  assert.equal(s.ile({ rodzaj: 'galaz/1' }), 6);
  const c = await krok(2);
  assert.equal(s.ile({ rodzaj: 'galaz/1' }), 9);
  assert.equal(r.meta('obserwator:kursor'), '0', 'koło domknięte');
  assert.equal(c.kolo_spokojne, false, 'w tym kole coś się zmieniło (pierwsze zapisy)');
  await krok(3); await krok(4);
  const f = await krok(5);
  assert.equal(f.kolo_spokojne, true, 'drugie koło bez żadnej zmiany');
  assert.equal(f.zrodlo, 'plik');
});

test('F11. alarm: przy pliku, gdy koło jest spokojne, następny alarm jest nie wcześniej niż za godzinę; w trakcie pierwszego koła co OBSERWATOR_CO_MIN', async () => {
  const w = siec(github({ lista: 403 }));
  const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', OBSERWATOR_CO_MIN: '5', OBSERWATOR_BIBLIOTEKA: ADRES_PLIKU, OBSERWATOR_WLASCICIEL: WLAS } });
  const odstep = (i) => (st.ustawienia[i] - Date.now()) / MINUTA;
  await zPodstawionymGithubem(w, () => obiekt.alarm());
  assert.equal(obiekt.srod.ile({ rodzaj: 'repo/1' }), 3, 'alarm przekazał adres pliku do obejścia');
  assert.equal(st.ustawienia.length, 1);
  // pierwsze koło: wszystkie 3 repozytoria w jednym obejściu (domyślnie po 5), ale zapisano zmiany, więc jeszcze nie spokojne
  assert.ok(odstep(0) <= 5.1 && odstep(0) > 4, 'po pierwszym kole: ' + odstep(0));
  await zPodstawionymGithubem(w, () => obiekt.alarm());
  assert.ok(odstep(1) >= 59 && odstep(1) <= 61, 'spokojne koło: za godzinę, jest ' + odstep(1));
  // z OBSERWATOR_CO_MIN dłuższym niż godzina zostaje to dłuższe
  const { obiekt: o2, st: st2 } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', OBSERWATOR_CO_MIN: '720', OBSERWATOR_BIBLIOTEKA: ADRES_PLIKU, OBSERWATOR_WLASCICIEL: WLAS } });
  await zPodstawionymGithubem(w, () => o2.alarm());
  await zPodstawionymGithubem(w, () => o2.alarm());
  assert.ok((st2.ustawienia[1] - Date.now()) / MINUTA > 700);
  // bez OBSERWATOR_BIBLIOTEKA obejście z API nie zna pliku i nie zmienia swojego rytmu
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main')] } });
  const { obiekt: o3, st: st3 } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', OBSERWATOR_CO_MIN: '5' } });
  await zPodstawionymGithubem(g, () => o3.alarm());
  await zPodstawionymGithubem(g, () => o3.alarm());
  assert.ok((st3.ustawienia[1] - Date.now()) / MINUTA <= 5.1);
});

test('F12. drzwi ręczne przyjmują ?ile=<1..50> i przekazują je obejściu; wartość spoza zakresu jest pomijana', async () => {
  const { s } = await swiat();
  const dostane = [];
  const zwiazane = async (opcje) => { dostane.push(opcje); return { ok: true, stan: 'ok', luki: [] }; };
  const zap = (zapytanie) => obsluzSrodowisko(s, new Request('https://przyklad.test/api/srodowisko/obejdz' + zapytanie, { method: 'POST', headers: { 'x-kto': 'jozz' } }), { podglad: true, obejdz: zwiazane });
  for (const z of ['', '?ile=7', '?ile=50', '?ile=0', '?ile=51', '?ile=abc', '?ile=2.5']) assert.equal((await zap(z)).status, 200);
  assert.deepEqual(dostane.map((o) => (o && o.ileRepoNaRaz) ?? null), [null, 7, 50, null, null, null, null]);
});

// =====================================================================================================================
// Druga runda (17 XI 2026): plik starej Jaskini jest świeży (odświeża go jej automat), więc z pełnego i nowszego pliku
// wolno odkładać i przywracać, zawsze odwracalnie i według wieku.
// =====================================================================================================================
const NOWSZY = '2026-11-18T00:00+00:00'; // nowszy niż stan_na rzeczy z obejść API (T0) i niż zegar podstawiony w swiat()
const swieza = (zmien = () => {}, generated = NOWSZY) => {
  const p = kopia(PROBKA);
  p.estate.generated = generated;
  zmien(p);
  return p;
};
const galNazwy = (s, rzecz, odlozone = 'nie') => galezieRepo(s, rzecz, odlozone).map((x) => x.cechy.nazwa).sort();
// pierwsze obejście z plikiem starym (tworzy rzeczy), potem z plikiem `tresc`
async function zDwochPlikow(tresc) {
  const { s } = await swiat();
  const g = github({ lista: 403 });
  await zBiblioteka(s, siec(g), { teraz: T0 });
  const w = await zBiblioteka(s, siec(g, { tresc }), { teraz: T0 + 5 * MINUTA });
  return { s, w, g };
}
const odlozReka = (s, rz, kto = 'jozz') => s.ruch(kto, { op: 'reka-odloz-' + rz.id.slice(0, 12), co: 'odloz', rzecz: rz.id, wersja: rz.wersja, powod: 'bo tak chcę' });

test('G1. gałąź nieobecna w pełnym, nowszym pliku jest odkładana (odwracalnie, z powodem); reszta zostaje', async () => {
  const wycieta = PROBKA.repos[2].branches[1].n;
  const { s, w } = await zDwochPlikow(swieza((p) => { p.repos[2].branches.splice(1, 1); }));
  assert.equal(w.zrodlo, 'plik');
  assert.equal(w.odlozone, 1);
  const rid = repoN(s, ZREFLEX).id;
  assert.ok(!galNazwy(s, rid).includes(wycieta));
  const o = galezieRepo(s, rid, 'razem').find((x) => x.cechy.nazwa === wycieta);
  assert.equal(o.odlozone, true);
  assert.equal(o.zmienil, 'obserwator');
  assert.match(o.powod, /zniknęła u źródła/);
  assert.match(o.powod, /pełne klony/);
  assert.equal(galNazwy(s, rid).length, 2);
  assert.equal(s.ile({ rodzaj: 'galaz/1' }), 8);
});

test('G2. gdy plik nie jest pełny (coverage), nic się nie odkłada: ani gałęzi, ani repozytoriów', async () => {
  const warianty = [
    ['missing niepuste', (p) => { p.estate.coverage.missing = ['X']; }],
    ['unlisted niepuste', (p) => { p.estate.coverage.unlisted = ['X']; }],
    ['expected != collected', (p) => { p.estate.coverage.expected = 4; }],
    ['public != liczba przeczytanych', (p) => { p.estate.coverage.public = 4; }],
    ['brak coverage', (p) => { delete p.estate.coverage; }],
    ['coverage nie jest obiektem', (p) => { p.estate.coverage = 'tak'; }],
  ];
  for (const [nazwa, mod] of warianty) {
    const p = swieza((x) => { x.repos[2].branches.splice(1, 1); x.repos.splice(0, 1); mod(x); });
    const { s, w } = await zDwochPlikow(p);
    assert.equal(w.zrodlo, 'plik', nazwa);
    assert.equal(w.odlozone, 0, nazwa);
    assert.ok(wszystkieFakty(s).every((x) => !x.odlozone), nazwa);
  }
});

test('G3. plik, który nie jest nowszy niż stan_na rzeczy, jej nie odkłada; nowszy odkłada', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'ReflexBrain-Lab')], galezie: { 'ReflexBrain-Lab': [galGH('main'), galGH('research/pre-o0-foundations-campaign', '5c213e5aaaa')] } });
  await obejscie(s, g); // stan_na rzeczy: T0 (17 XI 12:00)
  g.lista = 403;
  const tylkoJedna = (p) => { p.repos[2].branches = p.repos[2].branches.filter((b) => b.n === 'research/pre-o0-foundations-campaign'); };
  const w1 = await zBiblioteka(s, siec(g, { tresc: swieza(tylkoJedna, '2026-11-17T08:00+00:00') }), { teraz: T0 + MINUTA });
  assert.equal(w1.odlozone, 0, 'plik z 08:00 jest starszy niż fakty z 12:00');
  assert.ok(galNazwy(s, repoN(s, ZREFLEX).id).includes('main'));
  const w2 = await zBiblioteka(s, siec(g, { tresc: swieza(tylkoJedna) }), { teraz: T0 + 2 * MINUTA });
  assert.equal(w2.odlozone, 1);
  assert.ok(!galNazwy(s, repoN(s, ZREFLEX).id).includes('main'), 'nowszy pełny plik odłożył main');
});

test('G4. bezpiecznik: gdyby znikła ponad połowa żywych repozytoriów (i co najmniej 3), nie odkładamy żadnego i jest luka; mniej to zwykłe odłożenie', async () => {
  const { s } = await swiat();
  const g = github({ repos: [repoGH(11, 'a1'), repoGH(12, 'a2'), repoGH(13, 'a3'), repoGH(14, 'a4')], galezie: {} });
  await obejscie(s, g);
  g.lista = 403;
  const w = await zBiblioteka(s, siec(g, { tresc: swieza() }), { teraz: T0 + MINUTA });
  assert.equal(w.odlozone, 0);
  assert.ok(w.luki.some((l) => l.gdzie === 'plik' && /błąd źródła/.test(l.blad)), JSON.stringify(w.luki));
  assert.equal(['a1', 'a2', 'a3', 'a4'].filter((n) => repoN(s, 'jozzpoly/' + n).odlozone).length, 0);
  // kontrola: dwa z czterech znikają (mniej niż 3), więc to zwykłe odłożenie, razem z gałęziami
  const { s: s2 } = await swiat();
  const g2 = github({ repos: [repoGH(11, 'ReflexBrain-Lab'), repoGH(12, 'Llm-Live-NPC'), repoGH(13, 'x1'), repoGH(14, 'x2')], galezie: { x1: [galGH('main')] } });
  await obejscie(s2, g2);
  g2.lista = 403;
  const w2 = await zBiblioteka(s2, siec(g2, { tresc: swieza() }), { teraz: T0 + MINUTA });
  assert.equal(w2.odlozone, 3, 'x1 z gałęzią main i x2');
  assert.equal(repoN(s2, 'jozzpoly/x1').odlozone, true);
  assert.equal(repoN(s2, 'jozzpoly/x2').odlozone, true);
  assert.match(repoN(s2, 'jozzpoly/x1').powod, /zniknęło u źródła/);
  assert.equal(galezieRepo(s2, repoN(s2, 'jozzpoly/x1').id).length, 0);
  assert.ok(!repoN(s2, ZREFLEX).odlozone);
});

test('G5. zero gałęzi u niepustego repozytorium to luka i brak odkładania; u pustego (empty) to zwykły fakt', async () => {
  const bez = (empty) => swieza((p) => { p.repos[2].branches = []; if (empty) p.repos[2].empty = true; });
  const { s, w } = await zDwochPlikow(bez(false));
  assert.equal(w.odlozone, 0);
  assert.ok(w.luki.some((l) => l.gdzie === 'plik' && /zero gałęzi/.test(l.blad)));
  assert.equal(galezieRepo(s, repoN(s, ZREFLEX).id).length, 3);
  const { s: s2, w: w2 } = await zDwochPlikow(bez(true));
  assert.equal(w2.odlozone, 3);
  assert.equal(galezieRepo(s2, repoN(s2, ZREFLEX).id).length, 0);
});

test('G6. własne odłożenie przywraca nowszy plik; plik nie nowszy niż odłożenie go nie przywraca', async () => {
  const wycieta = PROBKA.repos[2].branches[1].n;
  const { s, g } = await zDwochPlikow(swieza((p) => { p.repos[2].branches.splice(1, 1); }));
  const rid = repoN(s, ZREFLEX).id;
  assert.ok(!galNazwy(s, rid).includes(wycieta));
  // plik starszy niż odłożenie (zegar świata 17 XI 02:00) nie wskrzesza
  await zBiblioteka(s, siec(g, { tresc: kopia(PROBKA) }), { teraz: T0 + 10 * MINUTA });
  assert.ok(!galNazwy(s, rid).includes(wycieta), 'stary plik nie przywraca');
  // nowszy plik z tą gałęzią: przywrócona ta sama rzecz
  const id = galezieRepo(s, rid, 'razem').find((x) => x.cechy.nazwa === wycieta).id;
  const w = await zBiblioteka(s, siec(g, { tresc: swieza(() => {}, '2026-11-19T00:00+00:00') }), { teraz: T0 + 20 * MINUTA });
  const po = galezieRepo(s, rid).find((x) => x.cechy.nazwa === wycieta);
  assert.equal(po.id, id);
  assert.ok(w.zmienione >= 1);
  // własne odłożenie repozytorium też wraca
  const { s: s2, g: g2 } = await zDwochPlikow(swieza((p) => { p.repos.splice(2, 1); p.estate.coverage = { expected: 2, collected: 2, public: 2, missing: [], unlisted: [] }; }));
  assert.equal(repoN(s2, ZREFLEX).odlozone, true);
  await zBiblioteka(s2, siec(g2, { tresc: swieza(() => {}, '2026-11-19T00:00+00:00') }), { teraz: T0 + 20 * MINUTA });
  assert.equal(repoN(s2, ZREFLEX).odlozone, undefined);
});

test('G7. rzecz odłożona cudzą ręką zostaje odłożona: przez plik i przez API; gałęzi takiego repozytorium nie sprawdzamy', async () => {
  // ścieżka pliku
  const { s, g } = await zDwochPlikow(kopia(PROBKA));
  const r = repoN(s, ZREFLEX);
  const gal = galezieRepo(s, r.id)[0];
  assert.equal((await odlozReka(s, gal)).ok, true);
  assert.equal((await odlozReka(s, repoN(s, 'jozzpoly/llm-live-npc'))).ok, true);
  const w = await zBiblioteka(s, siec(g, { tresc: swieza(() => {}, '2026-11-19T00:00+00:00') }), { teraz: T0 + 20 * MINUTA });
  assert.equal(s.rzecz(gal.id).odlozone, true, 'gałąź odłożona ręką zostaje odłożona');
  assert.equal(repoN(s, 'jozzpoly/llm-live-npc').odlozone, true);
  assert.equal(w.luki.filter((l) => l.gdzie !== 'lista').length, 0, 'to decyzja, nie awaria: bez luki');
  // ścieżka API
  const { s: s2 } = await swiat();
  const g2 = github({ repos: [repoGH(11, 'r1'), repoGH(12, 'r2')], galezie: { r1: [galGH('main'), galGH('dev')], r2: [galGH('main')] } });
  await obejscie(s2, g2);
  const dev = galezieRepo(s2, repoN(s2, 'jozzpoly/r1').id).find((x) => x.cechy.nazwa === 'dev');
  assert.equal((await odlozReka(s2, dev)).ok, true);
  assert.equal((await odlozReka(s2, repoN(s2, 'jozzpoly/r2'))).ok, true);
  g2.zapytania.length = 0;
  const w2 = await obejscie(s2, g2, { teraz: T0 + MINUTA });
  assert.equal(s2.rzecz(dev.id).odlozone, true, 'API też nie wskrzesza gałęzi odłożonej ręką');
  assert.equal(repoN(s2, 'jozzpoly/r2').odlozone, true);
  assert.ok(!g2.zapytania.some((z) => /repos\/[^/]+\/r2\/branches/.test(z.url)), 'gałęzi odłożonego ręką repozytorium nie pytamy');
  assert.equal(w2.luki.length, 0);
});

test('G8. karta i wejscie z pliku: karta tylko gdy tab jest prawdą, wejscie z wejscie.dlaczego (do 600 znaków); zmiana pliku je zdejmuje', async () => {
  const z = (tab, dlaczego) => swieza((p) => { p.repos[2].tab = tab; p.repos[2].wejscie = dlaczego === null ? null : { dlaczego, sprawdzil: 'ktos', kiedy: '2026-10-20' }; });
  const { s } = await swiat();
  const g = github({ lista: 403 });
  await zBiblioteka(s, siec(g, { tresc: z(true, 'x'.repeat(900)) }));
  const r = repoN(s, ZREFLEX);
  assert.equal(r.cechy.karta, true);
  assert.equal(r.cechy.wejscie.length, 600);
  assert.equal(repoN(s, 'jozzpoly/llm-live-npc').cechy.karta, undefined, 'brak pola tab to brak cechy');
  assert.equal(repoN(s, 'jozzpoly/llm-live-npc').cechy.wejscie, undefined);
  await zBiblioteka(s, siec(g, { tresc: z(false, null) }), { teraz: T0 + MINUTA });
  assert.equal(repoN(s, ZREFLEX).cechy.karta, undefined);
  assert.equal(repoN(s, ZREFLEX).cechy.wejscie, undefined);
  // tab o wartości innej niż prawda logiczna nie daje karty
  await zBiblioteka(s, siec(g, { tresc: z('tak', 'zdanie') }), { teraz: T0 + 2 * MINUTA });
  assert.equal(repoN(s, ZREFLEX).cechy.karta, undefined);
  assert.equal(repoN(s, ZREFLEX).cechy.wejscie, 'zdanie');
});

test('G9. pelny: prawda tylko dla spójnego estate.coverage, równej liczby przeczytanych repozytoriów i braku pominiętych wpisów', async () => {
  const czytaj = (p) => zBiblioteki({ fetchFn: siec(github(), { tresc: p }).fetchFn, adres: ADRES_PLIKU, teraz: T0 });
  assert.equal((await czytaj(kopia(PROBKA))).pelny, true);
  const w = await czytaj(kopia(PROBKA));
  assert.deepEqual(w.repos.map((x) => x.puste), [false, false, false]);
  const pusty = kopia(PROBKA); pusty.repos[0].empty = true; pusty.repos[0].branches = [];
  assert.equal((await czytaj(pusty)).repos[0].puste, true);
  const zly = (mod) => { const p = kopia(PROBKA); mod(p); return czytaj(p); };
  assert.equal((await zly((p) => { p.estate.coverage.collected = 2; })).pelny, false);
  assert.equal((await zly((p) => { p.estate.coverage.expected = 3.5; p.estate.coverage.collected = 3.5; })).pelny, false, 'liczby całkowite');
  assert.equal((await zly((p) => { p.estate.coverage.missing = ['a']; })).pelny, false);
  assert.equal((await zly((p) => { p.estate.coverage.unlisted = ['a']; })).pelny, false);
  assert.equal((await zly((p) => { delete p.estate.coverage.missing; })).pelny, false);
  assert.equal((await zly((p) => { p.estate.coverage.public = 2; })).pelny, false);
  assert.equal((await zly((p) => { delete p.estate.coverage; })).pelny, false);
  assert.equal((await zly((p) => { p.repos[1].name = 'zła nazwa!'; p.estate.coverage.public = 2; p.estate.coverage.expected = 3; p.estate.coverage.collected = 3; })).pelny, false, 'pominięty wpis z luką');
  // prywatne repozytorium pominięte bez luki nie psuje pełności, jeśli coverage.public się zgadza
  const z2 = kopia(PROBKA); z2.repos.push({ ...kopia(z2.repos[0]), name: 'Pryw', private: true });
  assert.equal((await czytaj(z2)).pelny, true);
});

test('10c. alarm zasypia po 24h bez żadnego żądania i otwartego gniazda (potrzeba 201), a kolejne wejście budzi go na nowo', async () => {
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main')] } });
  const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' } });
  const wejdz = (sciezka = '/co-tu-jest') => obiekt.fetch(new Request('https://x.test' + sciezka));
  assert.equal((await wejdz()).status, 200);
  assert.equal(st.ustawienia.length, 1, 'pierwsze wejście ustawiło alarm');
  // Symulujemy upływ ponad 24h od ostatniej obecności
  const dobaMs = 24 * 60 * MINUTA;
  const dawno = Date.now() - dobaMs - 5 * MINUTA;
  obiekt.ostatniaObecnosc = dawno;
  obiekt.rdzen.ustawMeta('miejsce:ostatnia_obecnosc', String(dawno));
  st.ustawienia.length = 0;
  st.alarm = null;
  await zPodstawionymGithubem(g, () => obiekt.alarm());
  assert.equal(st.ustawienia.length, 0, 'po 24h ciszy alarm nie planuje kolejnego wybudzenia');
  assert.equal(obiekt.alarmSprawdzony, false, 'flaga alarmu zresetowana pod kolejne wejście');
  // Kolejne wejście człowieka lub agenta budzi obserwatora na nowo
  assert.equal((await wejdz()).status, 200);
  assert.equal(st.ustawienia.length, 1, 'nowe wejście ponownie uruchamia budzik');
});

// Dwa sprawdziany drugiej linii łatki Toru 3 (Opus Code, 27 XI 2026). 10d: dziura znaleziona przez Fable (Miejsce bez
// zapisu obecności nie zasypiało nigdy). 10e: warunek „nikt nie patrzy na żywo”, którego nie łapał żaden sprawdzian
// (mutacja, która go zdejmowała, przechodziła cały plik).
test('10d. Miejsce, do którego od wdrożenia nikt nie wszedł: pierwszy alarm zaczyna liczyć dobę, a po dobie ciszy budzik zasypia także po uśpieniu obiektu', async () => {
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main')] } });
  const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' } });
  let t = Date.now();
  obiekt.rdzen.teraz = () => t;
  for (let i = 0; i < 3; i++) { await zPodstawionymGithubem(g, () => obiekt.alarm()); t += 30 * MINUTA; }
  assert.equal(st.ustawienia.length, 3, 'w pierwszej dobie budzik chodzi, choć nikt nie wszedł');
  // Obiekt mógł zasnąć między alarmami: nowy obiekt nad tą samą bazą wie tylko to, co zapisane
  const drugi = new Miejsce(obiekt.ctx, obiekt.env);
  assert.ok(Number(drugi.rdzen.meta('miejsce:ostatnia_obecnosc')) > 0, 'pierwszy alarm zapisał, od kiedy liczyć dobę');
  drugi.rdzen.teraz = () => t + 24 * 60 * MINUTA;
  st.ustawienia.length = 0;
  await zPodstawionymGithubem(g, () => drugi.alarm());
  assert.equal(st.ustawienia.length, 0, 'po dobie bez nikogo budzik nieodwiedzanego Miejsca zasypia');
  assert.equal(drugi.alarmSprawdzony, false, 'następne wejście ustawi go od nowa');
});

test('10e. otwarta strona z kanałem na żywo trzyma budzik na chodzie także po dobie bez żądań; po jej zamknięciu budzik zasypia', async () => {
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main')] } });
  const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' } });
  let t = Date.now();
  obiekt.rdzen.teraz = () => t;
  await zPodstawionymGithubem(g, () => obiekt.alarm());
  obiekt.ctx.getWebSockets = () => [{ send() {}, deserializeAttachment() { return null; } }];
  t += 25 * 60 * MINUTA;
  st.ustawienia.length = 0;
  await zPodstawionymGithubem(g, () => obiekt.alarm());
  assert.equal(st.ustawienia.length, 1, 'ktoś patrzy na żywo: budzik dalej chodzi');
  obiekt.ctx.getWebSockets = () => [];
  t += 30 * MINUTA;
  st.ustawienia.length = 0;
  await zPodstawionymGithubem(g, () => obiekt.alarm());
  assert.equal(st.ustawienia.length, 0, 'strona zamknięta, a doba ciszy minęła: budzik zasypia');
});

// Uwaga Fable z drugiej linii (27 XI 2026): gałąź błędu nie miała sprawdzianu, a mutacja `catch { spi = true; }`
// przechodziła cały plik. Wyjątek przy odczycie obecności ma zostawić budzik na chodzie, bo następny alarm ustawia się zawsze.
test('10f. wyjątek przy odczycie obecności zostawia budzik na chodzie także po dobie: następny alarm ustawia się zawsze', async () => {
  const g = github({ repos: [repoGH(11, 'r1')], galezie: { r1: [galGH('main')] } });
  const { obiekt, st } = obiektZAlarmem({ env: { OBSERWATOR: 'tak' } });
  let t = Date.now();
  obiekt.rdzen.teraz = () => t;
  await zPodstawionymGithubem(g, () => obiekt.alarm());
  const zwykle = obiekt.rdzen.meta.bind(obiekt.rdzen);
  obiekt.rdzen.meta = (k) => { if (k === 'miejsce:ostatnia_obecnosc') throw new Error('odczyt obecności nie wyszedł'); return zwykle(k); };
  obiekt.ostatniaObecnosc = 0;
  t += 25 * 60 * MINUTA;
  st.ustawienia.length = 0;
  await zPodstawionymGithubem(g, () => obiekt.alarm());
  assert.equal(st.ustawienia.length, 1, 'bez wiedzy o obecności budzik nie zasypia');
});

// Druga linia Neona (27 XI 2026): zapis obecności nie może pisać do bazy tam, gdzie obserwator jest wyłączony, po
// przekroczeniu budżetu zapisów ani dla odrzuconego 401 z martwej sesji poza podglądem.
test('10g. obecność zapisuje się tylko dla ważnego wejścia przy włączonym obserwatorze i wolnym budżecie zapisów', async () => {
  // 1. Gdy obserwator wyłączony albo host spoza OBSERWATOR_ADRESY: wejście nie pisze miejsce:ostatnia_obecnosc
  const { obiekt: bezObs } = obiektZAlarmem({ env: {} });
  assert.equal((await bezObs.fetch(new Request('https://x.test/co-tu-jest'))).status, 200);
  assert.equal(bezObs.rdzen.meta('miejsce:ostatnia_obecnosc'), null, 'bez obserwatora obecność nie zaśmieca meta');
  const { obiekt: innyHost } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', OBSERWATOR_ADRESY: 'fable-srodowisko-' } });
  assert.equal((await innyHost.fetch(new Request('https://x.test/co-tu-jest'))).status, 200);
  assert.equal(innyHost.rdzen.meta('miejsce:ostatnia_obecnosc'), null, 'podgląd spoza OBSERWATOR_ADRESY nie pisze obecności');

  // 2. Gdy obserwator włączony, ale żądanie ma martwą sesję poza podglądem (401): nie odświeża obecności
  const { obiekt: zObs } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', PODGLAD: 'nie' } });
  const dawno = Date.now() - 25 * 60 * MINUTA;
  zObs.ostatniaObecnosc = dawno;
  zObs.rdzen.ustawMeta('miejsce:ostatnia_obecnosc', String(dawno));
  const odp401 = await zObs.fetch(new Request('https://x.test/co-tu-jest', { headers: { 'x-sesja-pos': 'martwe-poswiadczenie' } }));
  assert.equal(odp401.status, 401);
  assert.equal(zObs.ostatniaObecnosc, dawno, 'odrzucone 401 nie przedłuża czuwania budzika');
  assert.equal(Number(zObs.rdzen.meta('miejsce:ostatnia_obecnosc')), dawno);

  // 3. Gdy budżet zapisów przekroczony: ważne wejście przed limitem zapisuje obecność, a po przekroczeniu GET nie pisze do SQLite
  const { obiekt: bezBudzetu } = obiektZAlarmem({ env: { OBSERWATOR: 'tak', BUDZET_ZAPISOW_NA_DOBE: '5' } });
  assert.equal((await bezBudzetu.fetch(new Request('https://x.test/co-tu-jest'))).status, 200);
  const zapisanePoZasiewie = Number(bezBudzetu.rdzen.meta('miejsce:ostatnia_obecnosc')) || 0;
  assert.ok(zapisanePoZasiewie > 0, 'ważne wejście przed przekroczeniem budżetu zapisało obecność');
  bezBudzetu.sql.licznik.zapisane = 10;
  assert.equal(bezBudzetu.budzet.przekroczony(), true);
  bezBudzetu.ostatniaObecnosc = 0;
  bezBudzetu.rdzen.teraz = () => Date.now() + 20 * MINUTA;
  const odpGet = await bezBudzetu.fetch(new Request('https://x.test/co-tu-jest'));
  assert.equal(odpGet.status, 200);
  assert.equal(Number(bezBudzetu.rdzen.meta('miejsce:ostatnia_obecnosc')) || 0, zapisanePoZasiewie, 'po przekroczeniu budżetu GET nie pisze obecności do meta');
});
