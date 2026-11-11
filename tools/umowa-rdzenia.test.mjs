// Testy umowy rdzenia. Pilnują czterech rzeczy, w kolejności ważności:
//  (a) że każde wymaganie POTRAFI ZAPŁONĄĆ na zepsutym dawcy — bez tego umowa jest
//      ozdobą i powtarza dokładnie ten błąd, z którego powstała;
//  (b) że żadne wymaganie nie stoi bez pytania, powodu, zakresu i sabotażu;
//  (c) że werdykt inny niż „spełnione" zawsze niesie wyjaśnienie, a „nieobsługiwane"
//      nigdzie nie jest liczone jak „spełnione";
//  (d) że instrument mierzy przez ADAPTER, a nie przez wspólną powierzchnię — czyli że
//      dawca z inną nazwą metody albo z inną definicją świeżości daje się zmierzyć.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WYMAGANIA, CZASOWNIKI, WLASCICIEL, Nieobslugiwane,
  sprawdzDawce, sprawdzCzyWymaganiaZyja, wczytajDawcow, dawcy, adapterLinii,
} from './umowa-rdzenia.mjs';

const najlepszy = async () => {
  const lista = await dawcy();
  const oceny = await Promise.all(lista.map(async a => [a, (await sprawdzDawce(a)).filter(x => x.werdykt === 'spelnione').length]));
  return oceny.sort((x, y) => y[1] - x[1])[0][0];
};

test('każde wymaganie zapłania się na dawcy zepsutym dokładnie w tym jednym miejscu', async () => {
  const zycie = await sprawdzCzyWymaganiaZyja(await najlepszy());
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
    assert.ok(Array.isArray(w.potrzebuje) && w.potrzebuje.length, w.id + ': brak deklaracji potrzebnych czasowników');
    for (const c of w.potrzebuje)
      assert.ok(CZASOWNIKI.includes(c), `${w.id}: czasownik „${c}" nie jest w słowniku umowy`);
    assert.equal(typeof w.zepsuj, 'function', w.id + ': wymaganie bez sabotażu jest nieweryfikowalne');
  }
});

test('werdykt inny niż spełnione zawsze niesie wyjaśnienie', async () => {
  for (const a of await dawcy())
    for (const x of await sprawdzDawce(a))
      if (x.werdykt !== 'spelnione')
        assert.ok(x.uwaga?.length > 5, `${a.nazwa} ${x.id}: ${x.werdykt} bez wyjaśnienia`);
});

test('nieobsługiwane nie jest tym samym co spełnione', async () => {
  // Dawca bez tożsamości operacji nie SPEŁNIA U4 — ono go nie dotyczy. Zlanie tych dwóch
  // rzeczy pochwaliłoby go za brak funkcji. R1 jest tu żywym przykładem, nie teorią.
  const r1 = (await dawcy()).find(a => a.nazwa === 'R1');
  assert.ok(r1, 'R1 ma być obecny jako dawca odniesienia');
  const w = await sprawdzDawce(r1);
  for (const x of w)
    assert.ok(['spelnione', 'niespelnione', 'nieobslugiwane'].includes(x.werdykt), 'nieznany werdykt: ' + x.werdykt);
  assert.ok(w.some(x => x.werdykt === 'nieobslugiwane'),
    'gdyby żaden dawca nie dawał „nieobsługiwane", trzeci werdykt byłby martwym pojęciem');
});

test('sabotaż, który zdejmuje czasownik, nie liczy się jako dowód życia wymagania', async () => {
  // To nie jest hipotetyczne: moja pierwsza wersja sabotażu U4 zdejmowała `op`, a wtedy
  // próba zachowania mówiła „nieobsługiwane" i wyglądałoby to na zapłonięcie.
  const zycie = await sprawdzCzyWymaganiaZyja({ nazwa: 'pusty' });
  assert.deepEqual(zycie.filter(z => z.ok === true), [],
    'na dawcy bez czasowników nic nie zapłania — „nie dotyczy" to nie dowód życia');
  assert.equal(zycie.filter(z => z.ok === null).length, WYMAGANIA.length);
  assert.ok(Nieobslugiwane.prototype instanceof Error, 'sentynel jest błędem, nie wartością');
});

test('umowa mierzy przez adapter: inna nazwa metody i inna definicja świeżości przechodzą', async () => {
  // Sedno przebudowy. Dawca udający obce konwencje: metody pod innymi nazwami, świeżość
  // liczona LICZNIKIEM, nie treścią głowy, i wszystko asynchroniczne. Umowa nie może tego
  // odróżnić od R2, bo wymagania znają tylko słownik umowy.
  const R2 = (await dawcy()).find(a => a.nazwa === 'R2');
  assert.ok(R2, 'R2 ma być obecny');
  // Świeżość u obcego to NUMER PRZESUNIĘCIA, jak w dawcy z #10 — nie treść głowy jak w R2.
  // Dzieje za każdą głową trzyma adapter i to on tłumaczy numer na to, czym operuje R2.
  // Pisanie tego udawanego dawcy samo pokazało, czego wymagania naprawdę pilnują: dwie
  // kolejne wersje tego obiektu przechodziły mniej, bo myliłem numer z indeksem i sprawdzałem
  // świeżość po wykonaniu. U3 i U4b złapały jedno i drugie, zanim zdążyłem to przegapić.
  // Dzieje KAŻDEJ GŁOWY należą do EGZEMPLARZA, nie do adaptera: pierwsza wersja trzymała je
  // w domknięciu testu, więc stan jednego wymagania przeciekał do następnego. Złapały to
  // U4b, U5 i U6 naraz — co jest drobnym, ale uczciwym dowodem, że wymagania reagują na
  // prawdziwy stan świata, a nie na to, co funkcje mówią o sobie.
  const za = (r, n) => r.dzieje.get(n) ?? (r.dzieje.set(n, [null]), r.dzieje.get(n));
  const obcy = {
    ...R2,
    nazwa: 'obcy',
    nowy: async () => ({ rdzen: await R2.nowy(), dzieje: new Map() }),
    zapisz: async (r, x) => R2.zapisz(r.rdzen, x),
    tresc: async (r, id) => R2.tresc(r.rdzen, id),
    zalozGlowe: async (r, x) => { za(r, x.nazwa); return R2.zalozGlowe(r.rdzen, x); },
    widok: async (r, n) => za(r, n).length - 1,
    przesun: async (r, x) => {
      const h = za(r, x.nazwa);
      const w = await R2.przesun(r.rdzen, { ...x, widziane: h[x.widziane] ?? null });
      if (w.ok && !w.powtorzone) h.push(x.na);
      return w;
    },
    glowa: async (r, n) => R2.glowa(r.rdzen, n),
    akty: async (r) => R2.akty(r.rdzen),
    eksport: async (r) => R2.eksport(r.rdzen),
    importuj: async (t) => ({ rdzen: await R2.importuj(t), dzieje: new Map() }),
  };
  const wynik = await sprawdzDawce(obcy);
  const zle = wynik.filter(x => x.werdykt === 'niespelnione');
  assert.deepEqual(zle.map(x => x.id + ': ' + x.uwaga), [],
    'dawca o obcej powierzchni ma przechodzić tam, gdzie zachowanie jest to samo');
});

test('brak modułu dawcy jest pominięciem ze wzmianką, nie awarią instrumentu', async () => {
  const { obecni, nieobecni } = await wczytajDawcow();
  assert.ok(obecni.length >= 1, 'przynajmniej jeden dawca musi się wczytać');
  for (const d of nieobecni) assert.ok(d.czemu?.length > 3, d.nazwa + ': nieobecność bez powodu');
  // Dawca z gałęzi, która nie jest scalona, ma być wymieniony jako nieobecny, a nie zniknąć.
  assert.equal(obecni.length + nieobecni.length >= 3, true, 'lista dawców ma mieć co najmniej trzy pozycje');
});

test('adapterLinii nie udaje tożsamości operacji, gdy rdzeń jej nie ma', async () => {
  // Gdyby adapter sam deduplikował `op`, R1 wyszłoby na lepsze, niż jest — a umowa
  // mierzyłaby wtedy adapter, nie dawcę. To najgroźniejszy możliwy błąd tego pliku.
  const R1mod = await import('../proby/r1-rdzen-minimalny/rdzen.mjs');
  const a = adapterLinii('R1-kontrola', R1mod.Rdzen);
  const r = await a.nowy();
  const x = await a.zapisz(r, { rodzaj: 'u', tresc: { t: 1 }, kto: WLASCICIEL, op: 'umowa.proba.9' });
  const y = await a.zapisz(r, { rodzaj: 'u', tresc: { t: 2 }, kto: WLASCICIEL, op: 'umowa.proba.9' });
  assert.notEqual(x, y, 'adapter nie może dorabiać dawcy zachowania, którego ten nie ma');
});
