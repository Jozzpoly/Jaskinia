// Okno na płótnie, pokolenie 2 (Opus Code, 27 XI 2026; tor 1). Kształt po ataku Fable (jego § 14 we wspólnej pamięci
// linii): okno/2 obok nietkniętego okno/1, klucz czyje, gosc, widok, rola; leży tam, gdzie widok; jest układem; zapisany
// układ przywraca okna tego, kto przywraca, i nigdy ich nie zamyka.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rdzen } from './miejsce.mjs';
import { sqlZNode } from './sql-node.mjs';
import { Srodowisko } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';

async function swiat() {
  let t = Date.UTC(2026, 10, 27, 3, 0, 0);
  const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (t += 1000) });
  const s = new Srodowisko(r);
  await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a', 'agent-b'] }));
  const ok = (w) => { assert.equal(w.ok, true, JSON.stringify(w)); return w; };
  // płótno w obszarze, w którym agenci porządkują, z jedną kartą i dwoma narzędziami z zasiewu
  const pole = ok(await s.ruch('jozz', { op: 'o2-pole-0001', co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Pulpit', ile_wolno: 'porzadkowac' } })).rzecz;
  const widok = ok(await s.ruch('jozz', { op: 'o2-widok-0001', co: 'poloz', rodzaj: 'widok/1', obszar: pole, cechy: { nazwa: 'Pulpit Twórcy' } })).rzecz;
  const projekt = ok(await s.ruch('jozz', { op: 'o2-projekt-001', co: 'poloz', rodzaj: 'projekt/1', obszar: pole, cechy: { nazwa: 'Wieża' } })).rzecz;
  const karta = ok(await s.ruch('jozz', { op: 'o2-karta-0001', co: 'poloz', rodzaj: 'miejsce/1', cechy: { widok, rzecz: projekt, x: 0, y: 0 } })).rzecz;
  const goscie = s.spis({ rodzaj: 'gosc/1', limit: 10 }).map((g) => g.id);
  assert.ok(goscie.length >= 2, 'zasiew ma co najmniej dwa narzędzia');
  let n = 0;
  const okno = (kto, gosc, cechy = {}) => s.ruch(kto, { op: `o2-okno-${String(++n).padStart(4, '0')}`, co: 'poloz', rodzaj: 'okno/2', wersja: 'dowolna',
    cechy: { nazwa: 'okno', czyje: kto, gosc, widok, rola: 'A', otwarte: true, x: 0.1, y: 0.1, szer: 0.5, wys: 0.5, ...cechy } });
  return { s, ok, pole, widok, projekt, karta, goscie, okno };
}

test('OP1. zasiew ma kształt okno/2 (klucz czyje, gosc, widok, rola; układ; leży z widokiem), a okno/1 strony gospodarza zostaje bez zmian', async () => {
  const { s } = await swiat();
  const k2 = s.ksztaltDla('okno/2');
  assert.deepEqual(k2.klucz, ['czyje', 'gosc', 'widok', 'rola']);
  assert.equal(k2.uklad, true);
  assert.equal(k2.lezy_z, 'widok');
  assert.deepEqual(k2.cechy.rola.wartosci, ['A', 'B', '2', '3', '4', '5', '6', '7', '8', '9']);
  const k1 = s.ksztaltDla('okno/1');
  assert.deepEqual(k1.klucz, ['czyje', 'gosc']);
  assert.notEqual(k1.uklad, true);
  assert.equal(k1.lezy_z, undefined);
});

test('OP2. tożsamość: okno/1 i okno/2 tego samego narzędzia to dwie rzeczy, para A i B to dwa okna, a ponowny zapis tej samej roli to nowa wersja tego samego okna', async () => {
  const { s, ok, goscie, okno } = await swiat();
  const g = goscie[0];
  const o1 = ok(await s.ruch('jozz', { op: 'o2-stare-0001', co: 'poloz', rodzaj: 'okno/1', wersja: 'dowolna', cechy: { nazwa: 'okno', czyje: 'jozz', gosc: g, otwarte: true } })).rzecz;
  const a = ok(await okno('jozz', g)).rzecz;
  const b = ok(await okno('jozz', g, { rola: 'B', x: 0.5 })).rzecz;
  assert.equal(new Set([o1, a, b]).size, 3, 'trzy różne rzeczy');
  const a2 = ok(await okno('jozz', g, { x: 0.3 })).rzecz;
  assert.equal(a2, a, 'ta sama rola to to samo okno');
  assert.equal(s.rzecz(a).cechy.x, 0.3);
  // rola spoza listy nie przechodzi sprawdzenia kształtu
  const zla = await okno('jozz', g, { rola: 'Z' });
  assert.equal(zla.ok, false, JSON.stringify(zla));
  // okno/2 bez widoku też nie
  const bezWidoku = await s.ruch('jozz', { op: 'o2-bez-widoku', co: 'poloz', rodzaj: 'okno/2', cechy: { nazwa: 'okno', czyje: 'jozz', gosc: g, rola: 'A', otwarte: true } });
  assert.equal(bezWidoku.ok, false, JSON.stringify(bezWidoku));
});

test('OP3. okno/2 jest osobiste i leży tam, gdzie jego widok: cudzego okna nie kładzie nikt poza właścicielem okna, a własne kładzie uczestnik z prawem porządkowania', async () => {
  const { s, ok, pole, goscie, okno } = await swiat();
  const g = goscie[0];
  const cudze = await okno('agent-a', g, { czyje: 'jozz' });
  assert.equal(cudze.status, 403, JSON.stringify(cudze));
  const wlasne = ok(await okno('agent-a', g));
  assert.equal(wlasne.skutek === undefined || wlasne.skutek !== 'propozycja', true, 'okno jest układem: z prawem porządkowania zapis ma skutek, a nie jest propozycją: ' + JSON.stringify(wlasne));
  assert.ok(s.rzecz(wlasne.rzecz), 'okno agenta leży');
  assert.equal(s.rzecz(wlasne.rzecz).obszar, pole, 'okno leży tam, gdzie widok');
  const moje = ok(await okno('jozz', g));
  assert.equal(s.rzecz(moje.rzecz).obszar, pole);
});

test('OP4. scena Fable: zapisany układ z dawnym aktem nie zamyka świata otwartego później; karty wracają, okno zostaje otwarte', async () => {
  const { s, ok, widok, karta, goscie, okno } = await swiat();
  const [g1, g2] = goscie;
  // „Wczorajszy stół”: agent zapisuje układ z bieżącym aktem (wolno mu, bo obszar pozwala porządkować)
  const stol = ok(await s.ruch('agent-a', { op: 'o2-stol-0001', co: 'poloz', rodzaj: 'chwila/1', cechy: { nazwa: 'Wczorajszy stół', widok, akt: s.ostatniNr() } })).rzecz;
  // potem właściciel przesuwa kartę i otwiera świat, w którym buduje wieżę
  ok(await s.ruch('jozz', { op: 'o2-karta-ruch', co: 'poloz', rodzaj: 'miejsce/1', wersja: 'dowolna', cechy: { widok, rzecz: s.rzecz(karta).cechy.rzecz, x: 500, y: 500 } }));
  const wieza = ok(await okno('jozz', g1, { wersja_goscia: 7 })).rzecz;
  const powrot = ok(await s.ruch('jozz', { op: 'o2-powrot-001', gest: 'o2-gest-powrot', co: 'przywroc-uklad', chwila: stol }));
  assert.equal(powrot.skutek, 'przywrocony-uklad');
  assert.deepEqual([s.rzecz(karta).cechy.x, s.rzecz(karta).cechy.y], [0, 0], 'karta wróciła');
  const w = s.rzecz(wieza);
  assert.ok(!w.odlozone, 'okna, którego wtedy nie było, nie odłożono');
  assert.equal(w.cechy.otwarte, true, 'świat otwarty później zostaje otwarty');
  assert.equal(w.cechy.wersja_goscia, 7);
  // to samo, gdy zapisany układ wskazuje akt sprzed wszystkiego (akt 0): okno dalej otwarte
  const zero = ok(await s.ruch('agent-a', { op: 'o2-stol-zero', co: 'poloz', rodzaj: 'chwila/1', cechy: { nazwa: 'Pusty stół', widok, akt: 0 } })).rzecz;
  ok(await s.ruch('jozz', { op: 'o2-powrot-zero', co: 'przywroc-uklad', chwila: zero }));
  assert.ok(!s.rzecz(wieza).odlozone);
  assert.equal(s.rzecz(wieza).cechy.otwarte, true);
  void g2;
});

test('OP5. okno, które było w zapisanym układzie, dostaje tamto położenie; zamknięte od tamtej pory wraca otwarte z tamtą wersją narzędzia, otwarte teraz zostaje otwarte i przy dzisiejszej wersji', async () => {
  const { s, ok, widok, goscie, okno } = await swiat();
  const [g1, g2] = goscie;
  const pierwsze = ok(await okno('jozz', g1, { x: 0.1, y: 0.2, szer: 0.4, wys: 0.5, wersja_goscia: 3 })).rzecz;
  const drugie = ok(await okno('jozz', g2, { x: 0.6, y: 0.2, szer: 0.4, wys: 0.5, wersja_goscia: 5 })).rzecz;
  // trzecie: okno B pierwszego narzędzia, w zapisanym układzie zamknięte
  const trzecie = ok(await okno('jozz', g1, { rola: 'B', otwarte: false, x: 0.3, y: 0.3, szer: 0.3, wys: 0.3, wersja_goscia: 3 })).rzecz;
  const uklad = ok(await s.ruch('jozz', { op: 'o2-uklad-0001', co: 'poloz', rodzaj: 'chwila/1', cechy: { nazwa: 'Dwa obok siebie', widok, akt: s.ostatniNr() } })).rzecz;
  // pierwsze przesunięte i zamknięte, drugie przesunięte, zwinięte i otwarte znów w nowszej wersji narzędzia
  ok(await okno('jozz', g1, { x: 0.7, y: 0.7, szer: 0.2, wys: 0.2, otwarte: false, wersja_goscia: 3 }));
  ok(await okno('jozz', g2, { x: 0, y: 0, szer: 1, wys: 1, zwiniete: true, wersja_goscia: 6 }));
  ok(await okno('jozz', g1, { rola: 'B', otwarte: true, x: 0.5, y: 0.5, szer: 0.3, wys: 0.3, wersja_goscia: 3 }));
  ok(await s.ruch('jozz', { op: 'o2-powrot-002', co: 'przywroc-uklad', chwila: uklad }));
  const p = s.rzecz(pierwsze).cechy, d = s.rzecz(drugie).cechy;
  assert.deepEqual([p.x, p.y, p.szer, p.wys], [0.1, 0.2, 0.4, 0.5], 'pierwsze wróciło na swoje miejsce');
  assert.equal(p.otwarte, true, 'zamknięte od tamtej pory wraca otwarte (stronę otworzy tylko reguła oknoWracaSamo)');
  assert.equal(p.wersja_goscia, 3, 'zamknięte dostaje tamtą wersję narzędzia');
  assert.deepEqual([d.x, d.y, d.szer, d.wys], [0.6, 0.2, 0.4, 0.5], 'drugie wróciło na swoje miejsce');
  assert.equal(d.zwiniete, undefined, 'zwinięcie wraca do tamtego stanu (wtedy nie było zwinięte)');
  const t3 = s.rzecz(trzecie).cechy;
  assert.equal(t3.otwarte, true, 'okno zamknięte w zapisanym układzie, a otwarte teraz, zostaje otwarte: powrót nie zamyka');
  assert.deepEqual([t3.x, t3.y], [0.3, 0.3], 'i wraca na tamto miejsce');
  assert.equal(d.wersja_goscia, 6, 'otwarte teraz zostaje przy dzisiejszej wersji narzędzia: zgoda ręki dotyczy tego, co otworzyła ostatnio');
});

test('OP6. powrót do układu rusza tylko okna tego, kto przywraca: okno agenta w tym samym widoku zostaje, a gest nie pada przez nie', async () => {
  const { s, ok, widok, goscie, okno } = await swiat();
  const g = goscie[0];
  const agenta = ok(await okno('agent-a', g, { x: 0.2 })).rzecz;
  const moje = ok(await okno('jozz', g, { x: 0.2 })).rzecz;
  const uklad = ok(await s.ruch('jozz', { op: 'o2-uklad-0002', co: 'poloz', rodzaj: 'chwila/1', cechy: { nazwa: 'Wspólny', widok, akt: s.ostatniNr() } })).rzecz;
  ok(await okno('agent-a', g, { x: 0.8 }));
  ok(await okno('jozz', g, { x: 0.8 }));
  const powrot = ok(await s.ruch('jozz', { op: 'o2-powrot-003', co: 'przywroc-uklad', chwila: uklad }));
  assert.equal(powrot.rzeczy, 1, 'zapisana jest tylko zmiana mojego okna');
  assert.equal(s.rzecz(moje).cechy.x, 0.2);
  assert.equal(s.rzecz(agenta).cechy.x, 0.8, 'okno agenta zostało, gdzie je zostawił');
});

test('OP7. reguła powrotu okna po przeładowaniu przyjmuje oba pokolenia i żadnego innego rodzaju', async () => {
  const { oknoWracaSamo, POKOLENIA_OKNA } = await import('../public/okna.mjs');
  assert.deepEqual(POKOLENIA_OKNA, ['okno/1', 'okno/2']);
  const gosc = { id: 'g'.repeat(26), rodzaj: 'gosc/1', wersja: 3, tytul: 'Wieża' };
  const okno = (rodzaj) => ({ rodzaj, odlozone: false, utworzyl: 'jozz', zmienil: 'jozz', cechy: { czyje: 'jozz', otwarte: true, gosc: gosc.id, wersja_goscia: 3 } });
  assert.equal(oknoWracaSamo(okno('okno/1'), gosc, 'jozz').wraca, true);
  assert.equal(oknoWracaSamo(okno('okno/2'), gosc, 'jozz').wraca, true);
  assert.equal(oknoWracaSamo(okno('okno/3'), gosc, 'jozz').wraca, false);
  assert.equal(oknoWracaSamo(okno('miejsce/1'), gosc, 'jozz').wraca, false);
  // ta sama reguła dla okno/2: cudza ręka przy moim oknie niczego u mnie nie otwiera, zmienione narzędzie też nie
  assert.equal(oknoWracaSamo({ ...okno('okno/2'), zmienil: 'agent-a' }, gosc, 'jozz').wraca, false);
  assert.equal(oknoWracaSamo(okno('okno/2'), { ...gosc, wersja: 4 }, 'jozz').wraca, false);
});
