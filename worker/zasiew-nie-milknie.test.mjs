// Zasiew nie milknie (18 XI 2026). Do tego dnia rzecz z ziarna zmieniona ręką zamarzała: kod przestawał ją odświeżać,
// a nowa wersja domyślnego nie dochodziła i nikt o tym nie mówił. Jego werdykt na to (rejestr poz. 199): „no to nie
// brzmi jak coś co by spełniało moje wymagania potrzeby i ambicje.” Prawo 2 planu: nic nie odchodzi po cichu.
// Sprawdziany pytają o cztery rzeczy: jego wersja dalej wygrywa; nowa wersja z kodu leży obok jako jedna widoczna
// propozycja; ruch "domyslny" wraca do domyślnego jednym gestem (najnowszego z kodu albo ostatniej wersji automatu);
// rzecz, która wróciła do domyślnego, znowu idzie za kodem sama.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko, AUTOMAT } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';

let n = 0;
const op = () => 'zn-' + String(++n).padStart(6, '0');

async function swiat() {
  let t = Date.UTC(2026, 10, 18, 22, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  const Z = () => ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] });
  await s.zasiej(Z());
  const ksztalt = () => s.spis({ rodzaj: 'ksztalt/1', limit: 300 }).find((x) => x.cechy.dla === 'projekt/1');
  // nowy kod: kształt projektu dostaje cechę, której wcześniej nie miał
  const zKodu = (cecha, opis) => Z().map((z) => (z.rodzaj === 'ksztalt/1' && z.cechy && z.cechy.dla === 'projekt/1'
    ? { ...z, cechy: { ...z.cechy, cechy: { ...z.cechy.cechy, [cecha]: { typ: 'tekst', opis } } } } : z));
  const czekajace = (id) => s.spis({ rodzaj: 'propozycja/1', gdzie: { od: AUTOMAT, rzecz: id, stan: 'czeka' }, odlozone: 'razem', limit: 10 });
  return { r, s, Z, ksztalt, zKodu, czekajace };
}

test('ZN1. jego zmiana wygrywa, a nowa wersja z kodu kładzie się obok jako jedna widoczna propozycja', async () => {
  const { s, ksztalt, zKodu, czekajace } = await swiat();
  const k = ksztalt();
  const reka = await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: k.id, wersja: k.wersja, rodzaj: 'ksztalt/1', obszar: k.obszar, cechy: { ...k.cechy, opis: 'Opis od właściciela.' } });
  assert.equal(reka.ok, true, JSON.stringify(reka));
  const zrobione = await s.zasiej(zKodu('wazne', 'cecha z nowego kodu'));
  assert.ok(zrobione.some((x) => x.includes('propozycja')), JSON.stringify(zrobione));
  const po = ksztalt();
  assert.equal(po.cechy.opis, 'Opis od właściciela.', 'jego wersja zostaje');
  assert.equal(po.cechy.cechy.wazne, undefined, 'nic nie przyszło po cichu');
  const cz = czekajace(k.id);
  assert.equal(cz.length, 1, 'jedna propozycja');
  assert.equal(cz[0].cechy.wymaga, undefined, 'nowa cecha w kształcie projektu nie zmienia praw ani uczestników: o przyjęciu mówi prawo obszaru, nie znak "tylko właściciel"');
  assert.equal(cz[0].cechy.wersja, po.wersja);
  assert.ok(cz[0].cechy.tresc.cechy.cechy.wazne, 'propozycja niesie nową wersję z kodu');
  assert.equal(cz[0].obszar ?? null, po.obszar ?? null, 'propozycja leży tam, gdzie rzecz');
  // ten sam kod drugi raz: bez drugiej propozycji; jeszcze nowszy kod: ta sama propozycja dostaje nowszą treść
  assert.deepEqual(await s.zasiej(zKodu('wazne', 'cecha z nowego kodu')), []);
  assert.equal(czekajace(k.id).length, 1);
  await s.zasiej(zKodu('wazne2', 'jeszcze nowszy kod'));
  const cz2 = czekajace(k.id);
  assert.equal(cz2.length, 1, 'dalej jedna');
  assert.equal(cz2[0].id, cz[0].id, 'ta sama propozycja, nowsza wersja');
  assert.ok(cz2[0].cechy.tresc.cechy.cechy.wazne2);
});

test('ZN2. ruch "domyslny" przyjmuje czekającą wersję z kodu, a potem rzecz znowu idzie za kodem sama', async () => {
  const { s, ksztalt, zKodu, czekajace } = await swiat();
  const k = ksztalt();
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: k.id, wersja: k.wersja, rodzaj: 'ksztalt/1', obszar: k.obszar, cechy: { ...k.cechy, opis: 'Opis od właściciela.' } });
  await s.zasiej(zKodu('wazne', 'cecha z nowego kodu'));
  // on zmienia kształt jeszcze raz już PO propozycji: powrót do domyślnego i tak ma zadziałać jednym ruchem
  const k2 = ksztalt();
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: k2.id, wersja: k2.wersja, rodzaj: 'ksztalt/1', obszar: k2.obszar, cechy: { ...k2.cechy, opis: 'Druga zmiana właściciela.' } });
  const d = await s.ruch('jozz', { op: op(), co: 'domyslny', rzecz: k.id });
  assert.equal(d.ok, true, JSON.stringify(d));
  const po = ksztalt();
  assert.ok(po.cechy.cechy.wazne, 'nowa wersja z kodu doszła');
  assert.notEqual(po.cechy.opis, 'Druga zmiana właściciela.');
  assert.equal(czekajace(k.id).length, 0, 'propozycja rozstrzygnięta');
  assert.ok(s.historia(k.id).some((h) => h.kto === 'jozz'), 'jego wersje zostają w historii');
  // kolejna zmiana kodu: rzecz jest przy domyślnym, więc kod odświeża ją sam, bez propozycji
  const zrobione = await s.zasiej(zKodu('wazne3', 'kolejny kod'));
  assert.ok(zrobione.some((x) => x.includes('odświeżone')), JSON.stringify(zrobione));
  assert.ok(ksztalt().cechy.cechy.wazne3);
  assert.equal(ksztalt().zmienil, AUTOMAT);
  assert.equal(czekajace(k.id).length, 0);
});

test('ZN3. bez zmiany w kodzie "domyslny" cofa do ostatniej wersji automatu; drugi raz mówi, że już jest domyślna', async () => {
  const { s, ksztalt } = await swiat();
  const k = ksztalt();
  const przed = JSON.stringify(k.cechy);
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: k.id, wersja: k.wersja, rodzaj: 'ksztalt/1', obszar: k.obszar, cechy: { ...k.cechy, opis: 'Zepsute ręką.' } });
  const d = await s.ruch('jozz', { op: op(), co: 'domyslny', rzecz: k.id });
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.equal(JSON.stringify(ksztalt().cechy), przed, 'wraca dokładnie to, co położył automat');
  const znow = await s.ruch('jozz', { op: op(), co: 'domyslny', rzecz: k.id });
  assert.equal(znow.status, 409);
  const nic = await s.ruch('jozz', { op: op(), co: 'poloz', rodzaj: 'projekt/1', cechy: { nazwa: 'Rzecz z ręki' } });
  const bez = await s.ruch('jozz', { op: op(), co: 'domyslny', rzecz: nic.rzecz });
  assert.equal(bez.status, 409, 'rzecz, której nie położył automat, nie ma wersji domyślnej');
});

test('ZN4. agent nie przyjmuje propozycji zasiewu ruchem "domyslny"; odłożona ręką rzecz nie dostaje propozycji', async () => {
  const { s, ksztalt, zKodu, czekajace } = await swiat();
  const k = ksztalt();
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: k.id, wersja: k.wersja, rodzaj: 'ksztalt/1', obszar: k.obszar, cechy: { ...k.cechy, opis: 'Opis od właściciela.' } });
  await s.zasiej(zKodu('wazne', 'cecha z nowego kodu'));
  const a = await s.ruch('agent-a', { op: op(), co: 'domyslny', rzecz: k.id });
  assert.notEqual(a.ok, true, JSON.stringify(a));
  assert.equal(ksztalt().cechy.opis, 'Opis od właściciela.');
  assert.equal(czekajace(k.id).length, 1);
  // odłożona ręką: kod o niej nie przypomina
  const { s: s2, ksztalt: k2f, zKodu: z2, czekajace: cz2 } = await swiat();
  const kk = k2f();
  const odl = await s2.ruch('jozz', { op: op(), co: 'odloz', rzecz: kk.id, wersja: kk.wersja, powod: 'nie chcę tego kształtu' });
  assert.equal(odl.ok, true, JSON.stringify(odl));
  await s2.zasiej(z2('wazne', 'cecha z nowego kodu'));
  assert.equal(cz2(kk.id).length, 0);
});

test('ZN7. znak "przyjmuje tylko właściciel" stoi przy propozycji domyślnego, gdy nowa wersja z kodu zmienia prawo obszaru', async () => {
  let t = Date.UTC(2026, 10, 19, 2, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  const Z = (zmien) => ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] }).map((z) => (z.nazwa === 'obszar-nowe' ? { ...z, cechy: { ...z.cechy, ...zmien } } : z));
  await s.zasiej(Z({}));
  const id = r.meta('obszar_nowe');
  const o = () => s.rzecz(id);
  await s.ruch('jozz', { op: op(), co: 'poloz', rzecz: id, wersja: o().wersja, rodzaj: 'obszar/1', cechy: { ...o().cechy, opis: 'Opis od właściciela.' } });
  const cz = () => s.spis({ rodzaj: 'propozycja/1', gdzie: { od: AUTOMAT, rzecz: id, stan: 'czeka' }, odlozone: 'razem', limit: 10 });
  await s.zasiej(Z({ opis: 'Nowy opis z kodu.' }));
  assert.equal(cz().length, 1);
  assert.equal(cz()[0].cechy.wymaga, undefined, 'nowy opis obszaru nie zmienia jego ustawień');
  await s.zasiej(Z({ opis: 'Nowy opis z kodu.', ile_wolno: 'proponowac' }));
  assert.equal(cz().length, 1, 'ta sama propozycja, nowsza treść');
  assert.equal(cz()[0].cechy.wymaga, 'wlasciciel', 'zmiana ile_wolno należy do właściciela');
});
