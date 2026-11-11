// Umowa rdzenia zapisów: wymagania sprawdzane SKUTKIEM, nie kształtem odpowiedzi,
// i mierzone przez ADAPTER, nie przez wspólną powierzchnię.
//
// POWÓD PIERWSZY. 10 XI Menadżer znalazł w R2 fałszywy sukces: `przesun` zwracał
// `{ ok:true, powtorzone:true }` i NIE PRZESUWAŁ GŁOWY. Przeszło przez 53 zielone testy,
// bo testy sprawdzały słowo „powtórzone", a nie jego znaczenie. To piąty raz w tym repo,
// kiedy mechanizm wyglądał na żywy — i pierwszy, w którym widać węższy wspólny mianownik
// niż „trzeba sprawdzać ingerencją":
//
//   TEST SPRAWDZAŁ ZWRÓCONY WERDYKT, A NIE SKUTEK W ŚWIECIE.
//
// Dlatego każde wymaganie poniżej kończy się odczytem stanu albo dziennika: gdzie stoi
// głowa, ile aktów leży w dzienniku, co wyszło po przeprowadzce. Żadne nie kończy się na
// tym, co funkcja powiedziała o sobie samej.
//
// POWÓD DRUGI, ważniejszy na lata. Zasada 7 mówi, że awans próby wymaga „porównania
// z innymi dawcami", a zasada 8, że fundament ma dać się wymienić bez umiejętności
// programisty. Dopóki każdy dawca ma własne, osobne testy, porównanie jest pracą ręczną —
// a praca ręczna jest dokładnie tym kosztem, przez który tymczasowe zamienia się w beton.
// Nie dlatego, że ktoś uznał rozwiązanie za dobre, lecz dlatego, że sprawdzenie
// następnego jest za drogie.
//
// DLACZEGO ADAPTERY, a nie wspólna powierzchnia. Pierwszą wersję tego pliku napisałem
// na wspólnych nazwach metod R1 i R2 — i przeżyła godzinę. W PR #10 stanął trzeci dawca
// (rdzeń po stronie serwera, na Durable Object z SQLite), który te same zachowania ma pod
// innymi nazwami i w innych kształtach: jedno wejście `wykonaj(kto, cialo)`, świeżość
// liczona numerem aktu zamiast porównania treści, prawa z przedrostka nazwy głowy.
// Umowa oparta na nazwach metod umiałaby więc porównywać tylko dawców z MOJEJ linii —
// czyli byłaby lustrem, nie instrumentem. To ta sama kołowość, przed którą ostrzegałem
// w poprzedniej wersji tego nagłówka, tylko wbudowana w konstrukcję.
// Zasada 8 nazywa lekarstwo wprost: moduły rozmawiają przez JAWNE ADAPTERY.
// Wymagania znają więc tylko słownik umowy; każdy dawca przynosi tłumaczenie.
//
// WSZYSTKO JEST ASYNCHRONICZNE. `await` na wartości synchronicznej zwraca ją bez zmiany,
// więc nic to nie kosztuje rdzeni w pamięci — a bez tego rdzeń po stronie serwera nie
// dałby się zmierzyć w ogóle. Umowa, która umie mierzyć tylko to, co szybkie, mierzy
// nie to, co ważne.
//
// TRZY WERDYKTY, NIE DWA. „Nieobsługiwane" nie wolno mylić ze „spełnione". Rdzeń, który
// nie ma tożsamości operacji, nie SPEŁNIA wymagania o powtórzeniach — ono go nie dotyczy.
// Zlanie tych dwóch rzeczy pochwaliłoby dawcę za brak funkcji, a to jest ten sam rodzaj
// kłamstwa co zielony test na martwym mechanizmie.
//
// JEDNO WYMAGANIE = JEDNO TWIERDZENIE. Wymaganie, które łączy dwa, zapłonie od jednego
// i wygląda na sprawdzone w całości — czyli jest dokładnie tym samym fałszywym zielonym,
// który zaczął tę historię. Dlatego U4 i U4b stoją osobno, choć miały być jednym.
//
// WYMAGANIE, KTÓRE NIE POTRAFI ZAPŁONĄĆ, NIE JEST WYMAGANIEM. Każde ma `zepsuj`:
// opakowanie ADAPTERA, które psuje dokładnie jedno zachowanie. Wymaganie MUSI się na nim
// wywrócić. Psucie adaptera, a nie klasy, jest tu drugą korzyścią z zasady 8: ten sam
// sabotaż działa na każdym dawcy, także na rdzeniach, których jeszcze nie ma.
// Sabotaż U5 to dosłownie błąd, który znalazł Menadżer — więc U5 jest sprawdzone na
// prawdziwej awarii, nie na wymyślonej. Pierwsza wersja U4 była MARTWA i ta kontrola
// pokazała to od razu: przechodziła na rdzeniu z wyłączoną tożsamością operacji, bo
// porównanie i zamiana przypadkiem robiło za nią robotę. Napisałem ją kilka godzin po
// tym, jak sam opisałem ten błąd.
//
// STRONNICZOŚĆ TEJ LISTY, nazwana wprost. Wymagania zbierałem po R2, więc R2 ma u mnie
// przewagę startową. Ile z tego jest kręceniem się w kółko, da się policzyć:
//   - U1, U2, U3, U6, U7, U8 pochodzą ze znalezisk SPRZED R2 — Browser GPT 4 XI,
//     Astra 5 XI, utrata zmian w starej Jaskini v6.3, P4 z #6. Stały, zanim R2 istniało.
//   - U4 i U4b postawiła Astra 10 XI jako wymaganie, nie ja jako opis.
//   - U5 powstało z tego, że Menadżer pokazał R2 jako ZŁE.
// Zostaje stronniczość DOBORU: czego na liście nie ma, bo R2 tego nie umie i nie
// przyszedł mi na myśl brak. Tego sam nie wyłapię — i to jest prośba do następnego,
// kto to czyta: DOPISZ WYMAGANIE, KTÓREGO MÓJ RDZEŃ NIE SPEŁNIA. Pusta kolumna nie
// jest celem i nie jest dowodem.
//
// CZEGO UMOWA NIE ROBI, jawnie:
//   - nie rozstrzyga, który dawca jest lepszy. Wylicza skutki; wybór jest właściciela.
//   - nie sprawdza proweniencji. Dowód pochodzenia wymaga podpisów (Astra, obs. 2),
//     a tych tu nie ma i żadne wymaganie nie udaje, że ma.
//   - nie sprawdza zbieżności dwóch kopii magazynu (Astra, obs. 3): wszystko dzieje się
//     w jednym procesie. Dwie karty i dwa originy to nadal symulacja. Dawca z #10 ma na
//     to prawdziwą odpowiedź (jedno miejsce po stronie serwera) i tej odpowiedzi umowa
//     NIE umie zmierzyć — to jest dziś jej największa luka, nie jego.
//   - nie jest fundamentem. Lista jest do podważania jak każda inna rzecz tutaj;
//     kto uważa wymaganie za złe, niech je obali, a nie obchodzi.

export class Nieobslugiwane extends Error {}
const brak = (co) => { throw new Nieobslugiwane(co); };

// Identyfikatory operacji w umowie trzymają się wąskiego zestawu znaków i mają co najmniej
// 8 znaków, bo niektórzy dawcy sprawdzają ich kształt. Umowa nie zmusza nikogo do
// akceptowania dowolnego łańcucha — to nie jest jej wymaganie.
// Aktorzy w słowniku umowy. Adapter tłumaczy je na to, czym u niego jest „kto".
export const WLASCICIEL = 'wlasciciel';
export const AGENT = 'agent';

// Czasowniki, które wymaganie może wywołać. Adapter bez czasownika nie jest zły —
// wymaganie, które go potrzebuje, po prostu go nie dotyczy.
export const CZASOWNIKI = ['nowy', 'zapisz', 'tresc', 'glowaNazwa', 'zalozGlowe', 'widok',
  'przesun', 'glowa', 'akty', 'eksport', 'importuj', 'podmienTresc'];

const ma = (a, ...v) => v.filter(x => typeof a[x] !== 'function');

// Czy dawca ma TOŻSAMOŚĆ OPERACJI. Próba zachowaniem, nie deklaracją: ta sama `op`
// z inną treścią. Dawca, który po prostu zapisze obie pod różnymi adresami, nie ma
// pojęcia operacji — wtedy wymagania o powtórzeniach go NIE DOTYCZĄ.
// Próba nie może użyć dwóch identycznych treści, bo rdzeń adresowany treścią
// zdeduplikuje je i bez `op` — wyglądałby, jakby umiał coś, czego nie umie.
async function umieOp(a) {
  const r = await a.nowy();
  try {
    const x = await a.zapisz(r, { rodzaj: 'proba', tresc: { t: 'pierwsza' }, kto: WLASCICIEL, op: 'umowa.proba.1' });
    const y = await a.zapisz(r, { rodzaj: 'proba', tresc: { t: 'druga' }, kto: WLASCICIEL, op: 'umowa.proba.1' });
    return x === y;          // oddał pierwszy wynik = rozpoznał powtórzenie
  } catch {
    return true;             // odmówił = też rozpoznał, tylko ostrzej
  }
}

/* ------------------------------------------------------------------------ wymagania */

export const WYMAGANIA = [
  {
    id: 'U1/tresc-nie-do-ruszenia',
    pytanie: 'Czy treść zapisu da się zmienić pod tym samym identyfikatorem?',
    dlaczego: 'Tożsamość z treści jest kłamstwem, jeśli treść wolno potem podmienić. '
      + 'Astra znalazła to w R1 5 XI: zapis oddany przez referencję dało się zmienić '
      + 'bez żadnego zdarzenia w dzienniku.',
    potrzebuje: ['nowy', 'zapisz', 'tresc'],
    async sprawdz(a) {
      const r = await a.nowy();
      const wlasny = { tekst: 'jak było' };
      const id = await a.zapisz(r, { rodzaj: 'uwaga', tresc: wlasny, kto: WLASCICIEL });
      wlasny.tekst = 'jak nie było';                       // ktoś trzyma referencję i ją rusza
      try { (await a.tresc(r, id)).tekst = 'ani tak'; } catch { /* zamrożone: dobrze */ }
      const widok = await a.tresc(r, id);
      if (JSON.stringify(widok) !== JSON.stringify({ tekst: 'jak było' }))
        throw new Error('treść pod tym samym id dała się podmienić');
    },
    zepsuj: (a) => {
      const ref = new Map();
      return {
        ...a,
        async zapisz(r, x) { const id = await a.zapisz(r, x); if (!ref.has(id)) ref.set(id, x.tresc); return id; },
        async tresc(r, id) { return ref.has(id) ? ref.get(id) : a.tresc(r, id); },
      };
    },
  },

  {
    id: 'U2/kazdy-akt-w-dzienniku',
    pytanie: 'Czy drugi zapis tej samej treści przez INNEGO autora zostawia własny akt?',
    dlaczego: 'Pierwszy znalazł to Browser GPT 4 XI, Astra odtworzyła 5 XI: R1 gubi drugi '
      + 'akt nawet w dzienniku, w którym szkic umieszcza całą proweniencję. Zgoda dwóch '
      + 'autorów przestaje być widoczna, a to jest informacja, nie szum.',
    potrzebuje: ['nowy', 'zapisz', 'akty'],
    async sprawdz(a) {
      const r = await a.nowy();
      const tresc = { ocena: 'bezpieczne' };
      const id = await a.zapisz(r, { rodzaj: 'werdykt', tresc, kto: AGENT });
      await a.zapisz(r, { rodzaj: 'werdykt', tresc, kto: WLASCICIEL });
      const akty = (await a.akty(r)).filter(e => e.typ === 'zapis' && e.id === id);
      if (akty.length !== 2) throw new Error(`aktów zapisu: ${akty.length}, miały być 2`);
      if (new Set(akty.map(e => e.kto)).size !== 2) throw new Error('obaj autorzy mieli być widoczni');
    },
    zepsuj: (a) => ({
      ...a,
      async akty(r) {
        const widziane = new Set();
        return (await a.akty(r)).filter(e => {              // dedupe po treści
          const k = e.typ + ':' + (e.id ?? e.nazwa);
          return widziane.has(k) ? false : (widziane.add(k), true);
        });
      },
    }),
  },

  {
    id: 'U3/stara-karta-nie-cofa-glowy',
    pytanie: 'Czy klient z nieaktualnym obrazem świata cofnie głowę na swój stary stan?',
    dlaczego: 'Stara Jaskinia wypracowała to po realnej utracie zmian w v6.3. To jedyne '
      + 'wymaganie na tej liście, które ma już za sobą cudzą stratę danych. Umowa nie '
      + 'przesądza, CZYM jest „to, co widziałem": dla jednych dawców treścią głowy, dla '
      + 'innych numerem aktu. `widok` jest nieprzejrzysty i to adapter wie, co w nim jest.',
    potrzebuje: ['nowy', 'zapisz', 'glowaNazwa', 'widok', 'przesun', 'glowa'],
    async sprawdz(a) {
      const r = await a.nowy();
      const g = a.glowaNazwa('wspolna');
      if (a.zalozGlowe) await a.zalozGlowe(r, { nazwa: g, prawa: 'wspolna', kto: WLASCICIEL });
      const A = await a.zapisz(r, { rodzaj: 'stan', tresc: { w: 'A' }, kto: WLASCICIEL });
      const B = await a.zapisz(r, { rodzaj: 'stan', tresc: { w: 'B' }, kto: WLASCICIEL });
      const C = await a.zapisz(r, { rodzaj: 'stan', tresc: { w: 'C' }, kto: WLASCICIEL });
      await a.przesun(r, { nazwa: g, widziane: await a.widok(r, g), na: A, kto: WLASCICIEL });
      const spozniony = await a.widok(r, g);                 // klient czyta i zasypia
      await a.przesun(r, { nazwa: g, widziane: spozniony, na: B, kto: WLASCICIEL });
      try { await a.przesun(r, { nazwa: g, widziane: spozniony, na: C, kto: WLASCICIEL, dlaczego: 'karta sprzed chwili' }); }
      catch { /* odmowa błędem też jest odmową */ }
      if (await a.glowa(r, g) !== B) throw new Error('spóźniony klient cofnął albo przestawił głowę');
    },
    // Udaje porównanie: podmienia „to, co widziałem" na stan aktualny, więc nic nie odmawia.
    zepsuj: (a) => ({
      ...a,
      async przesun(r, x) { return a.przesun(r, { ...x, widziane: await a.widok(r, x.nazwa) }); },
    }),
  },

  {
    id: 'U4/powtorzenie-to-jeden-akt',
    pytanie: 'Czy drugie dostarczenie TEJ SAMEJ operacji zostawia w dzienniku jeden akt?',
    dlaczego: 'Wymaganie postawiła Astra 10 XI: retry po utraconej odpowiedzi nie może '
      + 'stać się drugą decyzją autorską. Liczę akty ZAPISU, nie przesunięcia — przy '
      + 'przesunięciu porównanie i zamiana zatrzyma drugie wywołanie tak czy inaczej, '
      + 'więc liczba aktów nie miałaby tam zębów. Pierwsza wersja tego wymagania na tym '
      + 'poległa: przechodziła na rdzeniu z wyłączoną tożsamością operacji.',
    potrzebuje: ['nowy', 'zapisz', 'akty'],
    async sprawdz(a) {
      if (!await umieOp(a)) brak('dawca nie ma tożsamości operacji');
      const r = await a.nowy();
      const tresc = { tekst: 'wyślij raz' };
      const id = await a.zapisz(r, { rodzaj: 'uwaga', tresc, kto: WLASCICIEL, op: 'umowa.op.zapis.1' });
      await a.zapisz(r, { rodzaj: 'uwaga', tresc, kto: WLASCICIEL, op: 'umowa.op.zapis.1' });
      const akty = (await a.akty(r)).filter(e => e.typ === 'zapis' && e.id === id);
      if (akty.length !== 1) throw new Error(`aktów zapisu: ${akty.length}, miał być 1`);
    },
    // Sabotaż NIE zdejmuje tożsamości operacji — brak funkcji dałby „nieobsługiwane",
    // a to nie jest to samo co błąd. Udaje dawcę, który notował KAŻDE wywołanie:
    // dokładnie lustrzany błąd, przed którym ostrzegła Astra.
    zepsuj: (a) => ({
      ...a,
      async akty(r) { return (await a.akty(r)).flatMap(e => e.op != null ? [e, { ...e }] : [e]); },
    }),
  },

  {
    id: 'U4b/retry-nie-zglasza-porazki',
    pytanie: 'Czy powtórzone przesunięcie mówi klientowi, że się udało?',
    dlaczego: 'Drugie oblicze tego samego wymagania, osobno — bo wymaganie, które łączy '
      + 'dwa twierdzenia, zapłonie od jednego i wygląda na sprawdzone w całości. Klient, '
      + 'który stracił odpowiedź i powtarza, dostałby bez tożsamości operacji „nie udało '
      + 'się", bo głowa już nie stoi tam, gdzie ją widział — i słusznie by się przestraszył. '
      + 'Tu wyjątkowo twierdzeniem JEST werdykt, bo werdykt jest tym, co klient dostaje. '
      + 'Skutek sprawdzam i tak, i PRZED nim.',
    potrzebuje: ['nowy', 'zapisz', 'glowaNazwa', 'widok', 'przesun', 'glowa'],
    async sprawdz(a) {
      if (!await umieOp(a)) brak('dawca nie ma tożsamości operacji');
      const r = await a.nowy();
      const g = a.glowaNazwa('wspolna');
      if (a.zalozGlowe) await a.zalozGlowe(r, { nazwa: g, prawa: 'wspolna', kto: WLASCICIEL });
      const A = await a.zapisz(r, { rodzaj: 'stan', tresc: { w: 'A' }, kto: WLASCICIEL });
      const widziane = await a.widok(r, g);
      const zadanie = { nazwa: g, widziane, na: A, kto: WLASCICIEL, dlaczego: 'raz', op: 'umowa.op.ruch.2' };
      await a.przesun(r, zadanie);
      let retry = null, rzucil = false;
      try { retry = await a.przesun(r, { ...zadanie }); } catch { rzucil = true; }
      if (await a.glowa(r, g) !== A) throw new Error('powtórzenie zgubiło skutek pierwotnego');
      if (rzucil) throw new Error('retry po utraconej odpowiedzi poleciał błędem');
      if (retry && retry.ok === false)
        throw new Error('retry po utraconej odpowiedzi zgłosił porażkę, której nie było');
    },
    zepsuj: (a) => ({
      ...a,
      async przesun(r, x) {
        const w = await a.przesun(r, x);
        return w && w.powtorzone ? { ok: false } : w;        // straszy klienta bez powodu
      },
    }),
  },

  {
    id: 'U5/zuzyty-identyfikator-nie-udaje-powtorzenia',
    pytanie: 'Czy ta sama `op` użyta do INNEJ czynności zgłasza się, zamiast powiedzieć „ok"?',
    dlaczego: 'To kontrpróba Menadżera z 10 XI na R2, potwierdzona 3/3. Rdzeń wiedział '
      + 'tylko, że zna `op`, i zwracał „powtórzone" nic nie przesuwając. Umowa NIE '
      + 'narzuca, czy ma polecieć błąd, czy odmowa — narzuca, że cichy sukces bez skutku '
      + 'jest zabroniony. Kształt odpowiedzi należy do dawcy, znaczenie do umowy.',
    potrzebuje: ['nowy', 'zapisz', 'glowaNazwa', 'widok', 'przesun', 'glowa'],
    async sprawdz(a) {
      if (!await umieOp(a)) brak('dawca nie ma tożsamości operacji');
      const r = await a.nowy();
      const g1 = a.glowaNazwa('wspolna'), g2 = a.glowaNazwa('wspolna2');
      if (a.zalozGlowe) {
        await a.zalozGlowe(r, { nazwa: g1, prawa: 'wspolna', kto: WLASCICIEL });
        await a.zalozGlowe(r, { nazwa: g2, prawa: 'wspolna', kto: WLASCICIEL });
      }
      const A = await a.zapisz(r, { rodzaj: 'stan', tresc: { w: 'A' }, kto: WLASCICIEL });
      const B = await a.zapisz(r, { rodzaj: 'stan', tresc: { w: 'B' }, kto: WLASCICIEL });
      await a.przesun(r, { nazwa: g1, widziane: await a.widok(r, g1), na: A, kto: WLASCICIEL, op: 'umowa.op.ruch.3' });
      let powiedzial = null;
      try { powiedzial = await a.przesun(r, { nazwa: g2, widziane: await a.widok(r, g2), na: B, kto: WLASCICIEL, op: 'umowa.op.ruch.3' }); }
      catch { /* zgłosił się: dobrze */ }
      // SKUTEK NAJPIERW: druga głowa nie ruszyła się.
      if (await a.glowa(r, g2) === B) throw new Error('inna czynność pod zużytą op jednak coś zrobiła');
      // A teraz: czy dawca o tym powiedział, zamiast zgłosić sukces.
      if (powiedzial && powiedzial.ok !== false)
        throw new Error('cichy sukces bez skutku: ' + JSON.stringify(powiedzial));
    },
    // Dosłownie błąd znaleziony przez Menadżera: odmowa zamieniona w „powtórzone".
    zepsuj: (a) => ({
      ...a,
      async przesun(r, x) {
        try {
          const w = await a.przesun(r, x);
          return w && w.ok === false ? { ok: true, powtorzone: true } : w;
        } catch { return { ok: true, powtorzone: true }; }
      },
    }),
  },

  {
    id: 'U6/stan-przezywa-zmiane-adresu',
    pytanie: 'Czy po eksporcie i imporcie każda głowa wskazuje tę samą treść?',
    dlaczego: 'Przeprowadzka jest testem wymienialności z zasady 8. Dawca, który nie unosi '
      + 'stanu na inny adres, zamyka właściciela tam, gdzie jest.',
    potrzebuje: ['nowy', 'zapisz', 'glowaNazwa', 'widok', 'przesun', 'glowa', 'tresc', 'eksport', 'importuj'],
    async sprawdz(a) {
      const r = await a.nowy();
      const stan = [['wspolna', { name: 'przeglad' }], ['wspolna2', { surowe: '{"zepsute' }]];
      const nazwy = stan.map(([k]) => a.glowaNazwa(k));
      if (a.zalozGlowe) for (const n of nazwy) await a.zalozGlowe(r, { nazwa: n, prawa: 'wspolna', kto: WLASCICIEL });
      for (const [i, [, tresc]] of stan.entries()) {
        const id = await a.zapisz(r, { rodzaj: 'stan', tresc, kto: WLASCICIEL });
        await a.przesun(r, { nazwa: nazwy[i], widziane: await a.widok(r, nazwy[i]), na: id, kto: WLASCICIEL });
      }
      const po = await a.importuj(await a.eksport(r));
      for (const [i, [, tresc]] of stan.entries()) {
        const id = await a.glowa(po, nazwy[i]);
        if (!id) throw new Error(`głowa ${nazwy[i]} nie przeżyła przeprowadzki`);
        if (JSON.stringify(await a.tresc(po, id)) !== JSON.stringify(tresc))
          throw new Error(`treść pod ${nazwy[i]} jest inna po przeprowadzce`);
      }
    },
    zepsuj: (a) => ({ ...a, async importuj(t) { return a.nowy(); } }),   // „przeprowadził się" w pustkę
  },

  {
    id: 'U7/podmieniona-tresc-nie-wchodzi',
    pytanie: 'Czy import odrzuca zapis, którego treść nie zgadza się z jego identyfikatorem?',
    dlaczego: 'Bez tego adres z treści jest ozdobą. UWAGA na zasięg: to wyłapuje przypadkową '
      + 'i niespójną podmianę, a NIE dowodzi pochodzenia. Spójna podmiana autora w rekordzie '
      + 'i dzienniku naraz przechodzi (Astra, obs. 2) i żadne wymaganie tu tego nie zakrywa.',
    potrzebuje: ['nowy', 'zapisz', 'eksport', 'importuj', 'podmienTresc'],
    async sprawdz(a) {
      const r = await a.nowy();
      const id = await a.zapisz(r, { rodzaj: 'uwaga', tresc: { tekst: 'oryginał' }, kto: WLASCICIEL });
      const podmieniony = await a.podmienTresc(await a.eksport(r), id, { tekst: 'podmienione' });
      let weszlo = false;
      try { await a.importuj(podmieniony); weszlo = true; } catch { /* odrzucone: dobrze */ }
      if (weszlo) throw new Error('podmieniona treść weszła pod starym identyfikatorem');
    },
    // Połyka odmowę i udaje, że import się udał.
    zepsuj: (a) => ({ ...a, async importuj(t) { try { return await a.importuj(t); } catch { return a.nowy(); } } }),
  },

  {
    id: 'U8/czas-albo-przyznanie-sie',
    pytanie: 'Czy akt niesie czas, a jeśli nie — czy dawca przyznaje, że go nie zna?',
    dlaczego: 'Pytanie „daj mi kopię sprzed konkretnej chwili" (P4 z #6) jest pytaniem '
      + 'właściciela, nie programisty. Dopuszczam OBA uczciwe wyniki: czas albo jawną lukę. '
      + 'Zabroniona jest trzecia droga — milczenie, po którym nie wiadomo, czy zera są '
      + 'danymi. Zmyślona data byłaby gorsza od przyznanej luki.',
    potrzebuje: ['nowy', 'zapisz', 'akty'],
    async sprawdz(a) {
      const r = await a.nowy();
      await a.zapisz(r, { rodzaj: 'uwaga', tresc: { tekst: 'kiedykolwiek' }, kto: WLASCICIEL });
      const e = (await a.akty(r))[0];
      if (!e) throw new Error('dziennik jest pusty, więc nie ma o czym mówić');
      const maCzas = typeof e.czas === 'number' && Number.isFinite(e.czas);
      if (!maCzas && e.czasNieznany !== true) throw new Error('akt nie ma czasu i nie mówi, że go nie zna');
    },
    zepsuj: (a) => ({
      ...a,
      async akty(r) { return (await a.akty(r)).map(({ czas, czasNieznany, ...e }) => e); },
    }),
  },
];

/* --------------------------------------------------------------------------- bieg */

export async function sprawdzDawce(a) {
  const wyniki = [];
  for (const w of WYMAGANIA) {
    const niema = ma(a, ...w.potrzebuje);
    if (niema.length) { wyniki.push({ id: w.id, dawca: a.nazwa, werdykt: 'nieobslugiwane', uwaga: 'adapter nie ma: ' + niema.join(', ') }); continue; }
    try {
      await w.sprawdz(a);
      wyniki.push({ id: w.id, dawca: a.nazwa, werdykt: 'spelnione' });
    } catch (e) {
      wyniki.push(e instanceof Nieobslugiwane
        ? { id: w.id, dawca: a.nazwa, werdykt: 'nieobslugiwane', uwaga: e.message }
        : { id: w.id, dawca: a.nazwa, werdykt: 'niespelnione', uwaga: e.message });
    }
  }
  return wyniki;
}

// Czy wymagania ŻYJĄ. Dla każdego: zepsuj dokładnie to zachowanie i sprawdź, że wymaganie
// się wywraca. Wymaganie przechodzące na zepsutym dawcy nie mierzy nic. Sprawdzam to na
// dawcy, który wymaganie SPEŁNIA — na niespełniającym sabotaż niczego by nie dowiódł.
export async function sprawdzCzyWymaganiaZyja(a) {
  const stan = await sprawdzDawce(a);
  const wyniki = [];
  for (const w of WYMAGANIA) {
    if (stan.find(x => x.id === w.id).werdykt !== 'spelnione') {
      wyniki.push({ id: w.id, ok: null, uwaga: `${a.nazwa} i tak nie spełnia — sabotaż nic by nie pokazał` });
      continue;
    }
    const zepsuty = { ...w.zepsuj(a), nazwa: a.nazwa + '/zepsuty' };
    try {
      await w.sprawdz(zepsuty);
      wyniki.push({ id: w.id, ok: false, uwaga: 'PRZESZŁO na zepsutym dawcy — wymaganie nic nie mierzy' });
    } catch (e) {
      wyniki.push(e instanceof Nieobslugiwane
        ? { id: w.id, ok: false, uwaga: 'sabotaż zdjął czasownik zamiast zepsuć zachowanie: ' + e.message }
        : { id: w.id, ok: true, uwaga: e.message.slice(0, 90) });
    }
  }
  return wyniki;
}

/* ------------------------------------------------------------------------- adaptery */

// Adapter rdzeni z mojej linii (R1 i R2 mają tę samą powierzchnię; różnią się tym,
// czego NIE umieją, a to wychodzi z próby zachowania, nie z deklaracji).
export function adapterLinii(nazwa, Rdzen, { op = true } = {}) {
  const kto = (k) => k === WLASCICIEL ? { who: 'jozz', role: 'owner' } : { who: 'opus', role: 'agent' };
  const opcje = (o) => (op && o ? { op: o } : {});
  return {
    nazwa,
    nowy: () => new Rdzen(),
    glowaNazwa: (rodzaj) => rodzaj,
    zalozGlowe: (r, { nazwa: n, prawa, kto: k }) => r.zalozGlowe(n, prawa, kto(k)),
    zapisz: (r, { rodzaj, tresc, kto: k, op: o }) => r.zapisz(rodzaj, tresc, kto(k), [], opcje(o)),
    tresc: (r, id) => r.zapis(id)?.content,
    widok: (r, n) => r.glowa(n),
    przesun: (r, { nazwa: n, widziane, na, kto: k, dlaczego, op: o }) =>
      r.przesun(n, widziane ?? null, na, kto(k), dlaczego ?? '', opcje(o)),
    glowa: (r, n) => r.glowa(n),
    akty: (r) => r.dziennik(),
    eksport: (r) => r.eksport(),
    importuj: (t) => Rdzen.importuj(t),
    podmienTresc: (t, id, nowa) => {
      const d = JSON.parse(t);
      const z = d.zapisy.find(x => x.id === id);
      if (!z) throw new Error('nie ma takiego zapisu w eksporcie: ' + id);
      z.content = nowa;
      return JSON.stringify(d);
    },
  };
}

// Adapter Miejsca (PR #10): rdzeń po stronie serwera, Durable Object z SQLite.
// Trzy rzeczy tłumaczy inaczej niż moja linia, i to są dokładnie te trzy, przez które
// umowa oparta na nazwach metod nie umiałaby go zmierzyć:
//   - jedno wejście `wykonaj(kto, cialo)` zamiast metody na czynność;
//   - świeżość głowy liczona NUMEREM AKTU, nie treścią — `widok` jest nieprzejrzysty,
//     więc wymaganie U3 tego nie widzi i nie musi;
//   - prawa z przedrostka nazwy głowy, więc nie ma czego „zakładać"; tłumaczenie idzie
//     w nazwę, a `zalozGlowe` po prostu nie istnieje.
// `op` jest u nich obowiązkowe i ma kształt, więc adapter dorabia świeży tam, gdzie
// umowa go nie podała. Treść przyjmują tekstem, więc adapter serializuje JSON — tak samo
// jak ich własne testy. `importuj` NIE MA i tego nie nadrabiam: ich opis #10 mówi to
// wprost, a zmyślony import pokazałby wynik, którego nikt nie ma.
export function adapterMiejsce(nazwa, M, { sqlZNode }) {
  let n = 0;
  const swiezyOp = () => 'umowa.auto.' + String(++n).padStart(4, '0');
  const imie = (k) => (k === WLASCICIEL ? 'jozz' : 'opus-code');
  return {
    nazwa,
    nowy: () => { let t = Date.parse('2026-11-11T00:00:00Z'); return new M.Rdzen(sqlZNode(), { teraz: () => (t += 1000) }); },
    glowaNazwa: (rodzaj) => 'wspolne:umowa-' + (rodzaj === 'wspolna' ? 'a' : 'b'),
    zapisz: async (r, { rodzaj, tresc, kto, op }) => {
      const w = await r.wykonaj(imie(kto), { op: op ?? swiezyOp(), co: 'zapisz', rodzaj, tresc: JSON.stringify(tresc) });
      if (!w.ok) throw new Error(`${w.status}: ${w.blad}`);
      return w.zapis ?? w.akt?.zapis;
    },
    tresc: (r, id) => { const z = r.zapisTresc(id); return z.ok ? JSON.parse(z.tresc) : undefined; },
    widok: (r, nazwaGlowy) => { const g = r.glowa(nazwaGlowy); return g.ok ? g.wersja : null; },
    przesun: (r, { nazwa: n2, widziane, na, kto, op }) =>
      r.wykonaj(imie(kto), { op: op ?? swiezyOp(), co: 'przesun', glowa: n2, wersja: widziane ?? null, na }),
    glowa: (r, nazwaGlowy) => { const g = r.glowa(nazwaGlowy); return g.ok ? g.zapis : null; },
    akty: (r) => r.dziennik(0, 200).akty.map((a) => ({
      typ: a.co === 'zapisz' ? 'zapis' : 'przesun',
      id: a.zapis, nazwa: a.glowa, kto: a.kto, op: a.op,
      czas: Date.parse(a.kiedy),         // u nich ISO; umowa pyta o czas, nie o jego zapis
    })),
    eksport: (r) => JSON.stringify(r.eksport()),
  };
}

// JEDNO źródło listy. Nowy dawca dopisuje się tutaj jedną linią razem ze swoim adapterem.
export const SKAD_DAWCY = [
  { nazwa: 'R1', sciezki: ['../proby/r1-rdzen-minimalny/rdzen.mjs'], zrob: (m) => adapterLinii('R1', m.Rdzen) },
  { nazwa: 'R2', sciezki: ['../proby/r2-akty/rdzen.mjs'], zrob: (m) => adapterLinii('R2', m.Rdzen) },
  { nazwa: 'M1', sciezki: ['../worker/miejsce.mjs', '../worker/sql-node.mjs'], zrob: (m, s) => adapterMiejsce('M1', m, s) },
];

// Zwraca { obecni, nieobecni }. Nieobecni osobno, żeby cisza nie uchodziła za komplet:
// tabela z jedną kolumną i tabela z jedną kolumną oraz zdaniem „drugiego dawcy nie ma"
// to dwie różne informacje, a tylko druga jest prawdziwa.
// Dawcy mieszkają w `proby/` i w `worker/`, a próba ma prawo zniknąć bez niczyjej zgody
// (zasada 7). Dlatego brak modułu jest POMINIĘCIEM ZE WZMIANKĄ, nie awarią instrumentu.
export async function wczytajDawcow() {
  const obecni = [], nieobecni = [];
  for (const d of SKAD_DAWCY) {
    try {
      const a = d.zrob(...await Promise.all(d.sciezki.map(s => import(s))));
      const niema = ma(a, 'nowy', 'zapisz');
      if (niema.length) nieobecni.push({ ...d, czemu: 'adapter bez podstaw: ' + niema.join(', ') });
      else obecni.push(a);
    } catch (e) {
      nieobecni.push({ ...d, czemu: e.code === 'ERR_MODULE_NOT_FOUND' ? 'nie ma pliku' : e.message });
    }
  }
  return { obecni, nieobecni };
}

export async function dawcy() { return (await wczytajDawcow()).obecni; }

/* ----------------------------------------------------------------------------- CLI */

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const { obecni, nieobecni } = await wczytajDawcow();
  if (!obecni.length) { console.error('Nie wczytano żadnego dawcy — nie ma czego mierzyć.'); process.exit(2); }
  const znak = { spelnione: 'TAK', niespelnione: 'NIE', nieobslugiwane: '-- ' };

  console.log('UMOWA RDZENIA — skutki, nie kształty odpowiedzi. Mierzone przez adaptery.');
  console.log('TAK spełnione | NIE niespełnione | --  nieobsługiwane (dawca tego nie obiecuje)\n');
  const wyniki = new Map();
  for (const a of obecni) wyniki.set(a.nazwa, await sprawdzDawce(a));

  console.log('  wymaganie'.padEnd(50) + obecni.map(a => a.nazwa.padEnd(6)).join(''));
  for (const w of WYMAGANIA)
    console.log('  ' + w.id.padEnd(48) + obecni.map(a => znak[wyniki.get(a.nazwa).find(x => x.id === w.id).werdykt].padEnd(6)).join(''));

  console.log('\nSZCZEGÓŁY (co dokładnie zawiodło albo czego brakuje):');
  for (const a of obecni)
    for (const x of wyniki.get(a.nazwa))
      if (x.werdykt !== 'spelnione') console.log(`  ${a.nazwa} ${x.id}: ${x.werdykt} — ${x.uwaga}`);
  for (const d of nieobecni) console.log(`  (${d.nazwa} nieobecny: ${d.czemu} — ${d.sciezki.join(", ")})`);

  // Kontrola nad kontrolą: czy wymagania potrafią zapłonąć.
  console.log('\nCZY WYMAGANIA ŻYJĄ (sabotaż jednego zachowania, wymaganie musi się wywrócić):');
  const najlepszy = obecni.reduce((a, b) =>
    wyniki.get(a.nazwa).filter(x => x.werdykt === 'spelnione').length >=
    wyniki.get(b.nazwa).filter(x => x.werdykt === 'spelnione').length ? a : b);
  console.log(`  (na dawcy ${najlepszy.nazwa}, bo sabotaż ma sens tylko tam, gdzie wymaganie jest spełnione)`);
  const zycie = await sprawdzCzyWymaganiaZyja(najlepszy);
  for (const z of zycie)
    console.log(`  ${z.ok === true ? 'ZAPŁONĘŁO  ' : z.ok === null ? 'nie dotyczy' : 'MARTWE     '} ${z.id}${z.ok === false ? '  — ' + z.uwaga : ''}`);

  const martwe = zycie.filter(z => z.ok === false);
  if (martwe.length) {
    console.error(`\nMARTWE WYMAGANIA: ${martwe.length}. Wymaganie, które nie potrafi zapłonąć, nie jest wymaganiem.`);
    process.exit(1);
  }
  console.log(`\nZapłonęło ${zycie.filter(z => z.ok === true).length} z ${WYMAGANIA.length} wymagań.`);
  console.log('Werdykty dawców wyżej NIE przewracają wyniku. Próba ma prawo nie spełniać umowy —');
  console.log('po to jest próbą. Czerwony wynik ma tylko martwe wymaganie, bo ono nie mierzy nic.');
}
