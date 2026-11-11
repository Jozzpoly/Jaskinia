// Testy umowy rdzenia. Pilnują trzech rzeczy, w kolejności ważności:
//  (a) że każde wymaganie POTRAFI ZAPŁONĄĆ na zepsutym rdzeniu — bez tego umowa jest
//      ozdobą i powtarza dokładnie ten błąd, z którego powstała;
//  (b) że żadne wymaganie nie stoi bez pytania, powodu i sabotażu;
//  (c) że werdykt inny niż „spełnione" zawsze niesie wyjaśnienie, a „nieobsługiwane"
//      nigdzie nie jest liczone jak „spełnione".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WYMAGANIA, sprawdzDawce, sprawdzCzyWymaganiaZyja, dawcy, Nieobslugiwane } from './umowa-rdzenia.mjs';

const R2 = async () => (await dawcy()).find(d => d.nazwa === 'R2');

test('każde wymaganie zapłania się na rdzeniu zepsutym dokładnie w tym jednym miejscu', async () => {
  const zycie = sprawdzCzyWymaganiaZyja(await R2());
  const martwe = zycie.filter(z => z.ok === false);
  assert.deepEqual(martwe.map(z => z.id), [],
    'martwe wymagania nic nie mierzą: ' + martwe.map(z => z.id + ' (' + z.uwaga + ')').join('; '));
  assert.equal(zycie.filter(z => z.ok === true).length, WYMAGANIA.length,
    'na dawcy spełniającym wszystko każde wymaganie ma być sprawdzalne sabotażem');
});

test('żadne wymaganie nie stoi bez pytania, powodu, zakresu i sabotażu', () => {
  const widziane = new Set();
  for (const w of WYMAGANIA) {
    assert.ok(/^U\d+[a-z]?\//.test(w.id), 'identyfikator ma mieć numer i nazwę: ' + w.id);
    assert.equal(widziane.has(w.id), false, 'powtórzony identyfikator: ' + w.id);
    widziane.add(w.id);
    assert.ok(w.pytanie?.endsWith('?'), w.id + ': wymaganie bez pytania nie da się obalić');
    assert.ok(w.dlaczego?.length > 60, w.id + ': powód ma mówić, skąd się wzięło, a nie powtarzać pytanie');
    assert.ok(Array.isArray(w.potrzebuje) && w.potrzebuje.length, w.id + ': brak deklaracji potrzebnej powierzchni');
    assert.equal(typeof w.zepsuj, 'function', w.id + ': wymaganie bez sabotażu jest nieweryfikowalne');
  }
});

test('werdykt inny niż spełnione zawsze niesie wyjaśnienie', async () => {
  for (const d of await dawcy())
    for (const x of sprawdzDawce(d))
      if (x.werdykt !== 'spelnione')
        assert.ok(x.uwaga?.length > 5, `${d.nazwa} ${x.id}: ${x.werdykt} bez wyjaśnienia`);
});

test('nieobsługiwane nie jest tym samym co spełnione', async () => {
  // Rdzeń bez tożsamości operacji nie SPEŁNIA U4 — on go nie dotyczy. Zlanie tych dwóch
  // rzeczy pochwaliłoby dawcę za brak funkcji. R1 jest tu żywym przykładem, nie teorią.
  const r1 = (await dawcy()).find(d => d.nazwa === 'R1');
  const w = sprawdzDawce(r1);
  const trzy = ['spelnione', 'niespelnione', 'nieobslugiwane'];
  for (const x of w) assert.ok(trzy.includes(x.werdykt), 'nieznany werdykt: ' + x.werdykt);
  assert.ok(w.some(x => x.werdykt === 'nieobslugiwane'),
    'gdyby R1 nie dawał ani jednego „nieobsługiwane", trzeci werdykt byłby martwym pojęciem');
});

test('R2 spełnia dziś całą umowę — a to jest obserwacja, nie awans', async () => {
  // Zielona kolumna nie czyni z R2 fundamentu (zasada 7). Mówi tylko, że dziś nie wiem
  // o skutku, którego R2 nie daje. Umowa jest do podważania jak wszystko tutaj.
  const nie = sprawdzDawce(await R2()).filter(x => x.werdykt !== 'spelnione');
  assert.deepEqual(nie.map(x => x.id + ': ' + x.uwaga), []);
});

test('sabotaż, który zdejmuje funkcję, nie liczy się jako dowód życia wymagania', () => {
  // To nie jest hipotetyczne: moja pierwsza wersja sabotażu U4 zdejmowała `op`, a wtedy
  // próba powierzchni mówiła „nieobsługiwane" i wyglądałoby to na zapłonięcie.
  // Rdzeń zupełnie bez powierzchni: żadne wymaganie nie może zaliczyć na nim sabotażu.
  const zycie = sprawdzCzyWymaganiaZyja({ nazwa: 'pusty', Rdzen: class {} });
  assert.deepEqual(zycie.filter(z => z.ok === true), [],
    'na rdzeniu bez powierzchni nic nie zapłania — „nie dotyczy" to nie dowód życia');
  assert.equal(zycie.filter(z => z.ok === null).length, WYMAGANIA.length);
  assert.ok(Nieobslugiwane.prototype instanceof Error, 'sentynel jest błędem, nie wartością');
});
