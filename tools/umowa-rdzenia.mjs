// Umowa rdzenia zapisów: wymagania sprawdzane SKUTKIEM, nie kształtem odpowiedzi.
//
// POWÓD. 11 XI Menadżer znalazł w R2 fałszywy sukces: `przesun` zwracał
// `{ ok:true, powtorzone:true }` i NIE PRZESUWAŁ GŁOWY. Przeszło przez 53 zielone testy,
// bo testy sprawdzały słowo „powtórzone", a nie jego znaczenie. To piąty raz w tym repo,
// kiedy mechanizm wyglądał na żywy — i pierwszy, w którym zobaczyłem węższy wspólny
// mianownik niż „trzeba sprawdzać ingerencją":
//
//   TEST SPRAWDZAŁ ZWRÓCONY WERDYKT, A NIE SKUTEK W ŚWIECIE.
//
// Dlatego każde wymaganie poniżej kończy się odczytem stanu albo dziennika: gdzie stoi
// głowa, ile aktów leży w dzienniku, co wyszło po przeprowadzce. Żadne nie kończy się
// na tym, co funkcja powiedziała o sobie samej.
//
// DRUGI POWÓD, ważniejszy na lata. Zasada 7 mówi, że awans próby wymaga „porównania
// z innymi dawcami", a zasada 8, że fundament ma dać się wymienić bez umiejętności
// programisty. Dziś R1 i R2 mają własne, osobne testy — więc porównanie dawców jest
// pracą ręczną, a praca ręczna jest dokładnie tym kosztem, przez który tymczasowe
// zamienia się w beton. Umowa jest tu instrumentem, nie próbą: jedna lista wymagań,
// uruchamialna na dowolnym dawcy — R1, R2, cokolwiek przyjdzie z Fable albo ze Studia.
//
// TRZY WERDYKTY, NIE DWA. „Nieobsługiwane" nie wolno mylić ze „spełnione". Rdzeń, który
// nie ma tożsamości operacji, nie SPEŁNIA wymagania o powtórzeniach — on go nie dotyczy.
// Zlanie tych dwóch rzeczy pochwaliłoby dawcę za brak funkcji, a to jest ten sam rodzaj
// kłamstwa co zielony test na martwym mechanizmie.
//
// JEDNO WYMAGANIE = JEDNO TWIERDZENIE. Wymaganie, które łączy dwa, zapłonie od jednego
// i wygląda na sprawdzone w całości — czyli jest dokładnie tym samym fałszywym zielonym,
// który zaczął tę historię. Dlatego U4 i U4b stoją osobno, choć miały być jednym.
//
// WYMAGANIE, KTÓRE NIE POTRAFI ZAPŁONĄĆ, NIE JEST WYMAGANIEM. Każde ma `zepsuj`:
// opakowanie, które psuje dokładnie jedno zachowanie. Wymaganie MUSI się na nim wywrócić.
// Pierwsza wersja U4 była MARTWA i ta kontrola to pokazała od razu: przechodziła na
// rdzeniu z wyłączoną tożsamością operacji, bo porównanie i zamiana przypadkiem robiło
// za nią robotę. Napisałem ją kilka godzin po tym, jak sam opisałem ten błąd.
//
// Sabotaże są celowo niezależne od dawcy (opakowują powierzchnię, nie wnętrze), więc
// ta kontrola działa też na rdzeniach, których jeszcze nie ma. Sabotaż dla U5 to
// dosłownie błąd, który znalazł Menadżer — więc U5 jest sprawdzone na prawdziwej awarii,
// nie na wymyślonej.
//
// STRONNICZOŚĆ TEJ LISTY, nazwana wprost. Pisałem umowę PO R2, więc R2 ma u mnie
// przewagę startową: łatwo ułożyć wymagania pod to, co moje własne rozwiązanie już robi,
// i nazwać to umową. Ile z tego jest kręceniem się w kółko, da się policzyć:
//   - U1, U2, U3, U6, U7, U8 pochodzą ze znalezisk SPRZED R2 — Browser GPT 4 XI,
//     Astra 5 XI, utrata zmian w starej Jaskini v6.3, P4 z #6. Tych nie układałem
//     pod siebie; stały, zanim R2 istniało.
//   - U4 i U4b postawiła Astra 10 XI jako wymaganie, nie ja jako opis.
//   - U5 powstało z tego, że Menadżer pokazał R2 jako ZŁE. Trudno o mniej łaskawe
//     źródło wymagania.
// Zostaje więc stronniczość DOBORU: czego na tej liście nie ma, bo R2 tego nie umie
// i nie przyszedł mi na myśl brak. Tego sam nie wyłapię — to jest prośba do następnego,
// kto to czyta: dopisz wymaganie, którego R2 nie spełnia. Pusta kolumna NIE jest celem.
//
// CZEGO UMOWA NIE ROBI, jawnie:
//   - nie rozstrzyga, który dawca jest lepszy. Wylicza skutki; wybór jest właściciela.
//   - nie sprawdza proweniencji. Dowód pochodzenia wymaga podpisów (Astra, obs. 2),
//     a tych tu nie ma i żadne wymaganie nie udaje, że ma.
//   - nie sprawdza zbieżności dwóch kopii magazynu (Astra, obs. 3): wszystko dzieje się
//     w jednym procesie. Dwie karty i dwa originy to nadal symulacja.
//   - nie jest fundamentem. Lista wymagań jest do podważania jak każda inna rzecz tutaj;
//     kto uważa wymaganie za złe, niech je obali, a nie obchodzi.

export class Nieobslugiwane extends Error {}
const brak = (co) => { throw new Nieobslugiwane(co); };

// Czy dawca ma TOŻSAMOŚĆ OPERACJI. Próba zachowaniem, nie deklaracją: ta sama `op`
// z inną treścią. Rdzeń, który po prostu zapisze obie, nie ma pojęcia operacji —
// i wtedy wymagania o powtórzeniach go NIE DOTYCZĄ (werdykt „nieobsługiwane").
// Próba nie może użyć dwóch identycznych treści, bo rdzeń adresowany treścią
// zdeduplikuje je i bez `op` — wyglądałby, jakby umiał coś, czego nie umie.
function umieOp(nowy, kto) {
  const r = nowy();
  try {
    const a = r.zapisz('proba', { t: 'pierwsza' }, kto, [], { op: 'proba/umowa' });
    const b = r.zapisz('proba', { t: 'druga' }, kto, [], { op: 'proba/umowa' });
    return a === b;            // oddał pierwszy wynik = rozpoznał powtórzenie
  } catch {
    return true;               // odmówił = też rozpoznał, tylko ostrzej
  }
}

const JOZZ = { who: 'jozz', role: 'owner' };
const OPUS = { who: 'opus', role: 'agent' };

/* ------------------------------------------------------------------------ wymagania */

export const WYMAGANIA = [
  {
    id: 'U1/tresc-nie-do-ruszenia',
    pytanie: 'Czy treść zapisu da się zmienić pod tym samym identyfikatorem?',
    dlaczego: 'Tożsamość z treści jest kłamstwem, jeśli treść wolno potem podmienić. '
      + 'Astra znalazła to w R1 5 XI: zapis oddany przez referencję dało się zmienić '
      + 'bez żadnego zdarzenia w dzienniku.',
    potrzebuje: ['zapisz', 'zapis'],
    sprawdz({ nowy }) {
      const r = nowy();
      const wlasny = { tekst: 'jak było' };
      const id = r.zapisz('uwaga', wlasny, JOZZ);
      wlasny.tekst = 'jak nie było';                 // ktoś trzyma referencję i ją rusza
      try { r.zapis(id).content.tekst = 'ani tak';  } catch { /* zamrożone: dobrze */ }
      // SKUTEK: co rdzeń oddaje po tych próbach.
      if (r.zapis(id).content.tekst !== 'jak było')
        throw new Error('treść pod tym samym id zmieniła się na: (podmieniona)');
    },
    zepsuj: (R) => class extends R {
      #ref = new Map();
      zapisz(k, c, kt, l, o) {
        const id = super.zapisz(k, c, kt, l, o);
        if (!this.#ref.has(id)) this.#ref.set(id, c);   // trzyma referencję wywołującego
        return id;
      }
      zapis(id) {
        const z = super.zapis(id);
        return z && this.#ref.has(id) ? { ...z, content: this.#ref.get(id) } : z;
      }
    },
  },

  {
    id: 'U2/kazdy-akt-w-dzienniku',
    pytanie: 'Czy drugi zapis tej samej treści przez INNEGO autora zostawia własny akt?',
    dlaczego: 'Pierwszy znalazł to Browser GPT 4 XI, Astra odtworzyła 5 XI: R1 gubi drugi '
      + 'akt nawet w dzienniku, w którym szkic umieszcza całą proweniencję. Zgoda dwóch '
      + 'autorów przestaje być widoczna, a to jest informacja, nie szum.',
    potrzebuje: ['zapisz', 'dziennik'],
    sprawdz({ nowy }) {
      const r = nowy();
      const id = r.zapisz('werdykt', { ocena: 'bezpieczne' }, OPUS);
      r.zapisz('werdykt', { ocena: 'bezpieczne' }, JOZZ);
      // SKUTEK: ile aktów o tej treści leży w dzienniku i czyich.
      const akty = r.dziennik().filter(e => e.typ === 'zapis' && e.id === id);
      if (akty.length !== 2) throw new Error(`aktów zapisu: ${akty.length}, miały być 2`);
      const kto = [...new Set(akty.map(e => e.kto))].sort();
      if (kto.length !== 2) throw new Error('obaj autorzy mieli być widoczni, są: ' + kto.length);
    },
    zepsuj: (R) => class extends R {
      dziennik(od = 0) {
        const widziane = new Set();
        return super.dziennik(od).filter(e => {                 // dedupe po treści
          const k = e.typ + ':' + (e.id ?? e.nazwa);
          return widziane.has(k) ? false : (widziane.add(k), true);
        });
      }
    },
  },

  {
    id: 'U3/stara-karta-nie-cofa-glowy',
    pytanie: 'Czy klient z nieaktualnym obrazem świata cofnie głowę na swój stary stan?',
    dlaczego: 'Stara Jaskinia wypracowała to po realnej utracie zmian w v6.3. To jedyne '
      + 'wymaganie na tej liście, które ma już za sobą cudzą stratę danych.',
    potrzebuje: ['zalozGlowe', 'przesun', 'glowa'],
    sprawdz({ nowy }) {
      const r = nowy();
      r.zalozGlowe('uklad', 'wspolna', JOZZ);
      const A = r.zapisz('stan', { w: 'A' }, JOZZ);
      const B = r.zapisz('stan', { w: 'B' }, JOZZ);
      const C = r.zapisz('stan', { w: 'C' }, JOZZ);
      r.przesun('uklad', null, A, JOZZ);
      r.przesun('uklad', A, B, JOZZ);                 // ktoś inny był szybszy
      r.przesun('uklad', A, C, OPUS, 'karta sprzed chwili');   // spóźniony klient
      // SKUTEK: gdzie stoi głowa. NIE to, co przesun o sobie powiedział.
      if (r.glowa('uklad') !== B) throw new Error('spóźniony klient cofnął głowę');
    },
    zepsuj: (R) => class extends R {
      // Udaje porównanie: podstawia aktualną głowę jako oczekiwaną, więc CAS nigdy nie odmawia.
      przesun(nazwa, z, na, ...a) { return super.przesun(nazwa, super.glowa(nazwa), na, ...a); }
    },
  },

  {
    id: 'U4/powtorzenie-to-jeden-akt',
    pytanie: 'Czy drugie dostarczenie TEJ SAMEJ operacji zostawia w dzienniku jeden akt?',
    dlaczego: 'Wymaganie postawiła Astra 10 XI: retry po utraconej odpowiedzi nie może '
      + 'stać się drugą decyzją autorską. Liczę akty ZAPISU, nie przesunięcia — przy '
      + 'przesunięciu porównanie i zamiana zatrzyma drugie wywołanie tak czy inaczej, '
      + 'więc liczba aktów nie miałaby tam zębów (pierwsza wersja tego wymagania na tym '
      + 'poległa: przechodziła na rdzeniu z wyłączoną tożsamością operacji).',
    potrzebuje: ['zapisz', 'dziennik'],
    sprawdz({ nowy }) {
      if (!umieOp(nowy, JOZZ)) brak('rdzeń nie ma tożsamości operacji');
      const r = nowy();
      const id = r.zapisz('uwaga', { tekst: 'wyślij raz' }, JOZZ, [], { op: 'k/1' });
      r.zapisz('uwaga', { tekst: 'wyślij raz' }, JOZZ, [], { op: 'k/1' });
      const akty = r.dziennik().filter(e => e.typ === 'zapis' && e.id === id);
      if (akty.length !== 1) throw new Error(`aktów zapisu: ${akty.length}, miał być 1`);
    },
    // Sabotaż nie ZDEJMUJE tożsamości operacji — brak funkcji dałby „nieobsługiwane",
    // a to nie jest to samo co błąd. Udaje rdzeń, który notował KAŻDE wywołanie:
    // dokładnie lustrzany błąd, przed którym ostrzegła Astra.
    zepsuj: (R) => class extends R {
      dziennik(od = 0) { return super.dziennik(od).flatMap(e => e.op != null ? [e, { ...e }] : [e]); }
    },
  },

  {
    id: 'U4b/retry-nie-zglasza-porazki',
    pytanie: 'Czy powtórzone przesunięcie mówi klientowi, że się udało?',
    dlaczego: 'Drugie oblicze tego samego wymagania, osobno — bo wymaganie, które łączy '
      + 'dwa twierdzenia, zapłonie od jednego i wygląda na sprawdzone w całości. Klient, '
      + 'który stracił odpowiedź i powtarza, dostałby bez tożsamości operacji „nie udało '
      + 'się", bo głowa już nie wskazuje `z` — i słusznie by się przestraszył. Tu wyjątkowo '
      + 'twierdzeniem JEST werdykt, bo werdykt jest tym, co klient dostaje. Skutek '
      + 'sprawdzam i tak, i PRZED nim.',
    potrzebuje: ['zalozGlowe', 'przesun', 'glowa'],
    sprawdz({ nowy }) {
      if (!umieOp(nowy, JOZZ)) brak('rdzeń nie ma tożsamości operacji');
      const r = nowy();
      r.zalozGlowe('uklad', 'wspolna', JOZZ);
      const A = r.zapisz('stan', { w: 'A' }, JOZZ);
      r.przesun('uklad', null, A, JOZZ, 'raz', { op: 'k/2' });
      const retry = r.przesun('uklad', null, A, JOZZ, 'raz', { op: 'k/2' });   // odpowiedź przepadła
      if (r.glowa('uklad') !== A) throw new Error('powtórzenie zgubiło skutek pierwotnego');
      if (retry && retry.ok === false)
        throw new Error('retry po utraconej odpowiedzi zgłosił porażkę, której nie było');
    },
    zepsuj: (R) => class extends R {
      przesun(...a) {
        const w = super.przesun(...a);
        return w && w.powtorzone ? { ok: false, teraz: null } : w;   // straszy klienta bez powodu
      }
    },
  },

  {
    id: 'U5/zuzyty-identyfikator-nie-udaje-powtorzenia',
    pytanie: 'Czy ta sama `op` użyta do INNEJ czynności zgłasza się, zamiast powiedzieć „ok"?',
    dlaczego: 'To kontrpróba Menadżera z 10 XI na R2, potwierdzona 3/3. Rdzeń wiedział '
      + 'tylko, że zna `op`, i zwracał „powtórzone" nic nie przesuwając. Umowa NIE '
      + 'narzuca, czy ma polecieć błąd, czy odmowa — narzuca, że cichy sukces bez skutku '
      + 'jest zabroniony. Kształt odpowiedzi należy do dawcy, znaczenie do umowy.',
    potrzebuje: ['zalozGlowe', 'przesun', 'glowa'],
    sprawdz({ nowy }) {
      if (!umieOp(nowy, JOZZ)) brak('rdzeń nie ma tożsamości operacji');
      const r = nowy();
      r.zalozGlowe('a', 'wspolna', JOZZ);
      r.zalozGlowe('b', 'wspolna', JOZZ);
      const A = r.zapisz('stan', { w: 'A' }, JOZZ);
      const B = r.zapisz('stan', { w: 'B' }, JOZZ);
      r.przesun('a', null, A, JOZZ, '', { op: 'k/2' });
      let powiedzial = null;
      try { powiedzial = r.przesun('b', null, B, JOZZ, '', { op: 'k/2' }); } catch { /* zgłosił się */ }
      // SKUTEK NAJPIERW: druga głowa nie ruszyła się.
      if (r.glowa('b') !== null) throw new Error('inna czynność pod zużytą op jednak coś zrobiła');
      // A teraz: czy rdzeń o tym powiedział, zamiast zgłosić sukces.
      if (powiedzial && powiedzial.ok !== false)
        throw new Error('cichy sukces bez skutku: ' + JSON.stringify(powiedzial));
    },
    zepsuj: (R) => class extends R {
      // Dosłownie błąd znaleziony przez Menadżera: odmowa zamieniona w „powtórzone".
      przesun(...a) { try { return super.przesun(...a); } catch { return { ok: true, powtorzone: true }; } }
    },
  },

  {
    id: 'U6/stan-przezywa-zmiane-adresu',
    pytanie: 'Czy po eksporcie i imporcie każda głowa wskazuje tę samą treść?',
    dlaczego: 'Przeprowadzka jest testem wymienialności z zasady 8. Rdzeń, który nie unosi '
      + 'stanu na inny adres, zamyka właściciela tam, gdzie jest.',
    potrzebuje: ['eksport', 'importuj'],
    sprawdz({ nowy, Rdzen }) {
      const r = nowy();
      const stan = { 'uklady:przeglad': { name: 'przeglad' }, 'kosz': { kind: 'space' }, 'ratunek': { surowe: '{"zepsute' } };
      for (const n of Object.keys(stan)) r.zalozGlowe(n, 'wspolna', JOZZ);
      for (const [n, t] of Object.entries(stan)) r.przesun(n, null, r.zapisz('stan', t, JOZZ), JOZZ);
      const po = Rdzen.importuj(r.eksport());
      // SKUTEK: co po przeprowadzce widać pod każdą głową.
      for (const [n, t] of Object.entries(stan)) {
        const z = po.zapis(po.glowa(n));
        if (!z) throw new Error(`głowa ${n} nie przeżyła przeprowadzki`);
        if (JSON.stringify(z.content) !== JSON.stringify(t)) throw new Error(`treść pod ${n} jest inna`);
      }
    },
    zepsuj: (R) => class extends R {
      eksport() { const d = JSON.parse(super.eksport()); d.glowy = {}; return JSON.stringify(d); }
    },
  },

  {
    id: 'U7/podmieniona-tresc-nie-wchodzi',
    pytanie: 'Czy import odrzuca zapis, którego treść nie zgadza się z jego identyfikatorem?',
    dlaczego: 'Bez tego adres z treści jest ozdobą. UWAGA na zasięg: to wyłapuje przypadkową '
      + 'i niespójną podmianę, a NIE dowodzi pochodzenia. Spójna podmiana autora w rekordzie '
      + 'i dzienniku naraz przechodzi (Astra, obs. 2) i żadne wymaganie tu tego nie zakrywa.',
    potrzebuje: ['eksport', 'importuj'],
    sprawdz({ nowy, Rdzen }) {
      const r = nowy();
      const id = r.zapisz('uwaga', { tekst: 'oryginał' }, JOZZ);
      const d = JSON.parse(r.eksport());
      d.zapisy.find(z => z.id === id).content = { tekst: 'podmienione' };
      let weszlo = false;
      try { Rdzen.importuj(JSON.stringify(d)); weszlo = true; } catch { /* odrzucone: dobrze */ }
      if (weszlo) throw new Error('podmieniona treść weszła pod starym identyfikatorem');
    },
    zepsuj: (R) => class extends R {
      // Połyka odmowę i udaje, że import się udał — pusty magazyn zamiast błędu.
      static importuj(t, o) { try { return R.importuj(t, o); } catch { return new R(o); } }
    },
  },

  {
    id: 'U8/czas-albo-przyznanie-sie',
    pytanie: 'Czy akt niesie czas, a jeśli nie — czy rdzeń przyznaje się, że go nie zna?',
    dlaczego: 'Pytanie „daj mi kopię sprzed konkretnej chwili" (P4 z #6) jest pytaniem '
      + 'właściciela, nie programisty. Dopuszczam OBA uczciwe wyniki: czas albo jawna luka. '
      + 'Zabroniona jest trzecia droga — milczenie, po którym nie wiadomo, czy zera są '
      + 'danymi. Zmyślona data byłaby gorsza od przyznanej luki.',
    potrzebuje: ['zapisz', 'dziennik'],
    sprawdz({ nowy }) {
      const r = nowy();
      r.zapisz('uwaga', { tekst: 'kiedykolwiek' }, JOZZ);
      const e = r.dziennik()[0];
      if (!e) throw new Error('dziennik jest pusty, więc nie ma o czym mówić');
      const maCzas = typeof e.czas === 'number' && Number.isFinite(e.czas);
      if (!maCzas && e.czasNieznany !== true)
        throw new Error('akt nie ma czasu i nie mówi, że go nie zna');
    },
    zepsuj: (R) => class extends R {
      dziennik(od = 0) { return super.dziennik(od).map(({ czas, czasNieznany, ...e }) => e); }
    },
  },
];

/* --------------------------------------------------------------------------- bieg */

export function sprawdzDawce({ nazwa, Rdzen }) {
  const nowy = () => new Rdzen();
  return WYMAGANIA.map(w => {
    const niema = w.potrzebuje.filter(m => typeof (Rdzen.prototype[m] ?? Rdzen[m]) !== 'function');
    if (niema.length) return { id: w.id, dawca: nazwa, werdykt: 'nieobslugiwane', uwaga: 'brak: ' + niema.join(', ') };
    try {
      w.sprawdz({ nowy, Rdzen });
      return { id: w.id, dawca: nazwa, werdykt: 'spelnione' };
    } catch (e) {
      return e instanceof Nieobslugiwane
        ? { id: w.id, dawca: nazwa, werdykt: 'nieobslugiwane', uwaga: e.message }
        : { id: w.id, dawca: nazwa, werdykt: 'niespelnione', uwaga: e.message };
    }
  });
}

// Czy wymagania ŻYJĄ. Dla każdego: zepsuj dokładnie to zachowanie i sprawdź, że
// wymaganie się wywraca. Wymaganie, które przechodzi na zepsutym rdzeniu, nie mierzy nic.
// Sprawdzam to na dawcy, który wymaganie SPEŁNIA — na niespełniającym sabotaż niczego
// by nie dowiódł, bo i tak byłoby czerwone.
export function sprawdzCzyWymaganiaZyja({ nazwa, Rdzen }) {
  return WYMAGANIA.map(w => {
    const stan = sprawdzDawce({ nazwa, Rdzen }).find(x => x.id === w.id);
    if (stan.werdykt !== 'spelnione')
      return { id: w.id, ok: null, uwaga: `${nazwa} i tak nie spełnia (${stan.werdykt}) — sabotaż nic by nie pokazał` };
    const Zepsuty = w.zepsuj(Rdzen);
    try {
      w.sprawdz({ nowy: () => new Zepsuty(), Rdzen: Zepsuty });
      return { id: w.id, ok: false, uwaga: 'PRZESZŁO na zepsutym rdzeniu — wymaganie nic nie mierzy' };
    } catch (e) {
      return e instanceof Nieobslugiwane
        ? { id: w.id, ok: false, uwaga: 'sabotaż zdjął powierzchnię zamiast zepsuć zachowanie: ' + e.message }
        : { id: w.id, ok: true, uwaga: e.message.slice(0, 80) };
    }
  });
}

/* --------------------------------------------------------------------------- dawcy */

// Lista dawców jest tutaj, a nie w konfiguracji, bo ma być widoczna przy wymaganiach.
// Nowy rdzeń dopisuje się jedną linią i od razu stoi w tej samej tabeli.
// Dawcy mieszkają w `proby/`, a próba ma prawo zniknąć bez niczyjej zgody (zasada 7).
// Dlatego brak modułu dawcy jest POMINIĘCIEM ze wzmianką, nie awarią instrumentu:
// umowa, którą da się zabić przez usunięcie jednej próby, przywiązywałaby do tej próby.
// JEDNO źródło listy. Nowy rdzeń dopisuje się tutaj jedną linią i od razu stoi w tabeli.
export const SKAD_DAWCY = [
  ['R1', '../proby/r1-rdzen-minimalny/rdzen.mjs'],
  ['R2', '../proby/r2-akty/rdzen.mjs'],
];

// Zwraca { obecni, nieobecni }. Nieobecni osobno, żeby cisza nie uchodziła za komplet:
// tabela z jedną kolumną i tabela z jedną kolumną oraz zdaniem „drugiego dawcy nie ma"
// to dwie różne informacje, a tylko druga jest prawdziwa.
export async function wczytajDawcow() {
  const obecni = [], nieobecni = [];
  for (const [nazwa, sciezka] of SKAD_DAWCY) {
    try {
      const { Rdzen } = await import(sciezka);
      if (typeof Rdzen === 'function') obecni.push({ nazwa, Rdzen });
      else nieobecni.push({ nazwa, sciezka, czemu: 'moduł nie wystawia klasy Rdzen' });
    } catch (e) {
      nieobecni.push({ nazwa, sciezka, czemu: e.code === 'ERR_MODULE_NOT_FOUND' ? 'nie ma pliku' : e.message });
    }
  }
  return { obecni, nieobecni };
}

export async function dawcy() { return (await wczytajDawcow()).obecni; }

/* ----------------------------------------------------------------------------- CLI */

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const { obecni: lista, nieobecni } = await wczytajDawcow();
  if (!lista.length) { console.error('Nie wczytano żadnego dawcy — nie ma czego mierzyć.'); process.exit(2); }
  const znak = { spelnione: 'TAK ', niespelnione: 'NIE ', nieobslugiwane: '--  ' };

  console.log('UMOWA RDZENIA — skutki, nie kształty odpowiedzi.');
  console.log('TAK spełnione | NIE niespełnione | --  nieobsługiwane (rdzeń tego nie obiecuje)\n');
  const wyniki = new Map(lista.map(d => [d.nazwa, sprawdzDawce(d)]));
  console.log('  wymaganie'.padEnd(46) + lista.map(d => d.nazwa.padEnd(6)).join(''));
  for (const w of WYMAGANIA) {
    const kom = lista.map(d => znak[wyniki.get(d.nazwa).find(x => x.id === w.id).werdykt] + '  ').join('');
    console.log('  ' + w.id.padEnd(44) + kom);
  }
  console.log('\nSZCZEGÓŁY (co dokładnie zawiodło albo czego brakuje):');
  for (const d of lista)
    for (const x of wyniki.get(d.nazwa))
      if (x.werdykt !== 'spelnione') console.log(`  ${d.nazwa} ${x.id}: ${x.werdykt} — ${x.uwaga}`);

  for (const d of nieobecni) console.log(`  (${d.nazwa} nieobecny: ${d.czemu} — ${d.sciezka})`);

  // Kontrola nad kontrolą: czy wymagania potrafią zapłonąć.
  console.log('\nCZY WYMAGANIA ŻYJĄ (sabotaż jednego zachowania, wymaganie musi się wywrócić):');
  const najlepszy = lista[lista.length - 1];
  const zycie = sprawdzCzyWymaganiaZyja(najlepszy);
  for (const z of zycie)
    console.log(`  ${z.ok === true ? 'ZAPŁONĘŁO' : z.ok === null ? 'nie dotyczy' : 'MARTWE   '} ${z.id}${z.ok === false ? '  — ' + z.uwaga : ''}`);

  const martwe = zycie.filter(z => z.ok === false);
  if (martwe.length) {
    console.error(`\nMARTWE WYMAGANIA: ${martwe.length}. Wymaganie, które nie potrafi zapłonąć, nie jest wymaganiem.`);
    process.exit(1);
  }
  console.log(`\nWszystkie ${zycie.filter(z => z.ok === true).length} sprawdzalnych wymagań zapłonęło na zepsutym rdzeniu.`);
  console.log('Werdykty dawców wyżej NIE przewracają wyniku. Próba ma prawo nie spełniać umowy —');
  console.log('po to jest próbą. Czerwony wynik ma tylko martwe wymaganie, bo ono nie mierzy nic.');
}
