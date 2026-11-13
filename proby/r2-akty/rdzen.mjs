// Próba R2: rdzeń zapisów, w którym AKT jest osobny od ZAPISU.
//
// Stoi OBOK R1 (`proby/r1-rdzen-minimalny`), nie zamiast niego. R1 jest szkicem z 4 XI
// i zostaje nietknięty: nadpisanie go zniszczyłoby porównanie dawców (zasada 7) oraz
// unieważniłoby falsyfikatory z PR #5 i #6, które opisują właśnie jego stan.
//
// DLACZEGO: R1 bierze tożsamość z treści i na tym kończy. Skutkiem jest, że drugi
// identyczny zapis nie zostawia śladu nigdzie — także w dzienniku, w którym szkic
// umieszcza całą proweniencję. Dowody: F1-F6 w r1-rdzen-minimalny/proweniencja.test.mjs,
// P4 w przeprowadzka.test.mjs, oraz trzy obserwacje Astry z 10 XI, które odtworzyłem
// uruchomieniem na f33a851.
//
// TRZY RÓŻNE TOŻSAMOŚCI, nie jedna. To jest cała zmiana:
//
//   1. TOŻSAMOŚĆ TREŚCI (`recordId`) — skrót rodzaju, treści i odnośników. Odpowiada
//      na pytanie "czy to ta sama rzecz". Służy do deduplikacji magazynu. Jak w R1.
//   2. TOŻSAMOŚĆ OPERACJI (`op`, podaje wywołujący) — odpowiada na pytanie "czy to ta
//      sama czynność". Dwa dostarczenia tej samej operacji dają JEDEN akt.
//      To wymaganie postawiła Astra: "Zapis każdego wywołania nie powinien automatycznie
//      zmieniać retry po utraconej odpowiedzi w drugą autorską decyzję."
//   3. AKT (zdarzenie dziennika) — odpowiada na pytanie "kto i kiedy to zrobił".
//      Jeden na każdą ODRĘBNĄ operację, nigdy deduplikowany po treści.
//
// Z tego wynika poprawka, która USUWA pole, a nie dodaje: `kto` schodzi z rekordu.
// Rekord adresowany treścią nie ma jednego autora — dwie osoby mogą dojść do tej samej
// treści niezależnie. Autor należy do aktu. W R1 `kto` siedziało w rekordzie i było
// zamrażane z PIERWSZYM piszącym (F2), więc treść zapisana później przez właściciela
// zostawała przypisana agentowi.
//
// POPRAWKA PO KONTRPRÓBIE MENADŻERA (10 XI, na 8573772): tożsamość operacji była
// pozorna. Wystarczyło, że rdzeń ZNAŁ `op`, żeby `przesun` zwrócił "powtórzone" nic nie
// przesuwając — nawet gdy ta `op` należała do zapisu, do innej głowy albo do innego celu.
// Teraz `op` wiąże się z ODCISKIEM CAŁEGO ŻĄDANIA, a powtórzenie zwraca pierwotny skutek;
// żądanie materialnie inne pod tą samą `op` jest błędem. Szczegóły przy `czesci` niżej.
//
// CZEGO TO NIE ROZWIĄZUJE, jawnie:
//   - Astra, obserwacja 2: spójna podmiana autora w rekordzie i dzienniku naraz
//     przechodzi import. Kontrola krzyżowa tych pól NIE jest dowodem pochodzenia;
//     potrzebna jest zewnętrzna, uwierzytelniona podstawa (podpisy). Nie ma jej tutaj.
//   - Astra: "Czas ścienny pomaga odnaleźć kopię; sam nie zastępuje tożsamości operacji
//     ani kolejności zatwierdzenia." Kolejność zatwierdzenia daje `n`, nie czas.
//   - Astra, obserwacja 3: dwie niezależne kopie magazynu przyjmują własne zmiany od tej
//     samej bazy. Rdzeń nie ma wspólnej trwałości ani rozstrzygania między originami.
//   - Menadżer, 10 XI: `autorzy(id)` liczy autorów AKTÓW, nie niezależne podstawy osądu.
//     Dwóch autorów mogło czytać siebie albo ten sam stary zapis właściciela. Rdzeń nie ma
//     modelu poznawczego i nie udaje go nazwą metody (komentarz przy `autorzy`).
//   - POWTÓRZENIE NIE SPRAWDZA PRAW PONOWNIE. Prawa bada pierwsze wywołanie; retry pod tą
//     samą `op` i tym samym `kto.who` zwraca zapamiętany wynik. Podstawienie innego `kto`
//     zmienia odcisk i leci błędem, ale podszycie się pod `who` to obserwacja 2 Astry:
//     bez podpisów rdzeń nie ma czym odróżnić autora od kogoś, kto go udaje.
//
// Status: próba. Nie jest fundamentem i nie staje się nim przez to, że działa (zasada 7).
import { sha256hex } from '../e1-wersje/sha256.mjs';
import { canonical } from '../e1-wersje/versions.mjs';

export const recordId = (kind, content) => 'z_' + sha256hex(canonical({ kind, content })).slice(0, 16);

// Treść zapisu zamrożona w głąb (błąd znaleziony przez Astrę w R1, 5 XI: zapis oddany
// przez referencję dało się zmienić pod tym samym id, bez zdarzenia w dzienniku).
const zamroz = o => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) zamroz(v); }
  return o;
};

// ODCISK ŻĄDANIA: co dokładnie znaczy "ta sama czynność" pod tą samą `op`.
//
// Menadżer, 10 XI, kontrpróba na 8573772 — potwierdzona przeze mnie 3/3, plus czwarty
// przypadek, którego nie wymienił (ta sama `op` z innym `dlaczego`). `#operacje` była
// wspólna dla zapisów i przesunięć, a sam fakt znajomości `op` wystarczał, by `przesun`
// zwrócił { ok:true, powtorzone:true } NIC NIE PRZESUWAJĄC. Zielony test na słowie
// "powtórzone" ukrywał błędne znaczenie tego słowa — i to jest tu lekcja ważniejsza
// od samej łatki.
//
// Odcisk bierze DOKŁADNIE te pola, które niesie akt w dzienniku, i ani jednego więcej.
// To nie oszczędność, to warunek sprawdzalności: odcisk, którego nie da się odtworzyć
// z dziennika po imporcie, byłby mechanizmem bez możliwości kontroli — czyli dokładnie
// tym, czego ten projekt uczy się nie ufać (sprawdzian życia mechanizmów, PR #9).
// Dlatego POZA odciskiem,
// świadomie, zostają dwie rzeczy:
//   - `kto.role` — akt zapisuje `who`, nie rolę. Patrz granica o prawach wyżej.
//   - zażądane `opcje.pokolenie` — to WARUNEK WSTĘPNY, nie część czynności. Zamiast
//     wciągać go w tożsamość, powtórzenie zwraca RZECZYWISTY skutek (`na`, `pokolenie`),
//     więc wywołujący sam widzi, czy świat stoi tam, gdzie go zakładał. Gdyby warunek
//     wstępny należał do tożsamości, ten sam akt miałby dwie tożsamości zależnie od tego,
//     jak ostrożny był klient — a ostrożność nie jest czynnością.
const czesci = e => e.typ === 'zapis'
  ? { typ: 'zapis', kind: e.kind, id: e.id, kto: e.kto }
  : { typ: 'przesun', nazwa: e.nazwa, z: e.z ?? null, na: e.na, kto: e.kto, dlaczego: e.dlaczego ?? '' };
const odcisk = c => sha256hex(canonical(c)).slice(0, 16);

export const FORMAT = 'rdzen-r2';
export const WERSJA = 2;

export class Rdzen {
  #zapisy = new Map();      // recordId -> rekord (BEZ `kto`: autor należy do aktu)
  #glowy = new Map();
  #dziennik = [];
  #operacje = new Map();    // op -> { n, wynik }  — tożsamość CZYNNOŚCI, sprawdzana odciskiem
  #zegar;

  // Zegar jest wstrzykiwany, żeby testy były deterministyczne, a nie żeby go udawać.
  constructor({ zegar = () => Date.now() } = {}) { this.#zegar = zegar; }

  /* ---------------------------------------------------------------- zapisy i akty */

  // Zwraca identyfikator treści, jak w R1 (ta sama powierzchnia, żeby dało się
  // uruchomić na obu rdzeniach te same testy akceptacyjne).
  // `opcje.op` to tożsamość operacji: podany dwa razy oznacza jedno dostarczenie tej
  // samej czynności, nie dwie czynności.
  zapisz(kind, content, kto, links = [], opcje = {}) {
    const id = recordId(kind, { content, links });
    const op = opcje.op ?? null;

    // Ponowne dostarczenie TEJ SAMEJ czynności: jeden akt i odzysk pierwotnego wyniku.
    // Ta sama `op` przy choć jednym materialnie innym szczególe: jawny błąd.
    if (op !== null) {
      const znana = this.#operacje.get(op);
      if (znana) return this.#powtorzenie(op, znana, { typ: 'zapis', kind, id, kto: kto.who });
    }

    if (!this.#zapisy.has(id)) {
      this.#zapisy.set(id, Object.freeze({
        id, kind,
        content: zamroz(JSON.parse(canonical(content))),
        links: Object.freeze([...links]),
      }));
    }
    const n = this.#log({ typ: 'zapis', id, kind, kto: kto.who, op });
    if (op !== null) this.#operacje.set(op, { n, wynik: id });
    return id;
  }

  zapis(id) { return this.#zapisy.get(id) ?? null; }

  // Wszystkie akty zapisu tej treści: kto i kiedy. To jest odpowiedź na F1, F4 i F5.
  akty(id) { return this.#dziennik.filter(e => e.typ === 'zapis' && e.id === id).map(e => ({ ...e })); }

  // Którzy RÓŻNI autorzy mają akt zapisu tej treści. Tyle — i ani słowa więcej.
  //
  // Menadżer, 10 XI: stał tu kiedyś komentarz o "niezależnych głosach", a rdzeń
  // niezależności nie rejestruje. Dwóch autorów tej samej treści to dwa AKTY, nie dwa
  // niezależne DOWODY: drugi mógł przeczytać pierwszego, obaj mogli cytować ten sam stary
  // zapis właściciela. Liczba aktów != liczba podstaw, a w archiwach z powtarzanymi
  // cytatami właściciela ta różnica jest dokładnie tym, co wprowadza agenty w błąd.
  // Kto potrzebuje niezależnych podstaw, zapisuje ŹRÓDŁO osądu jako treść i wiąże je
  // odnośnikiem (`links`) — rdzeń tego nie zgaduje.
  autorzy(id) { return [...new Set(this.akty(id).map(e => e.kto))]; }

  /* ------------------------------------------------------------------------ głowy */

  zalozGlowe(nazwa, prawa, kto) {
    if (this.#glowy.has(nazwa)) throw new Error('Głowa już istnieje: ' + nazwa);
    this.#glowy.set(nazwa, { na: null, prawa, pokolenie: 0 });
    this.#log({ typ: 'glowa', nazwa, prawa, kto: kto.who });
  }
  glowa(nazwa) { return this.#glowy.get(nazwa)?.na ?? null; }
  prawaGlowy(nazwa) { return this.#glowy.get(nazwa)?.prawa ?? null; }

  // Druga granica R1, którą wskazała Astra 5 XI: głowa A → B → A przepuszcza klienta,
  // który pamięta PIERWSZE A, bo porównanie treści go nie odróżnia. Pokolenie rośnie
  // przy każdym przesunięciu i nigdy nie wraca, więc tam, gdzie liczy się świeżość,
  // klient podaje je razem z `z`.
  stanGlowy(nazwa) {
    const g = this.#glowy.get(nazwa);
    return g ? { na: g.na, prawa: g.prawa, pokolenie: g.pokolenie } : null;
  }

  // Porównaj i zamień: przesuwa tylko wtedy, gdy głowa nadal wskazuje `z`.
  // Stara karta nie nadpisze nowszego stanu (stara Jaskinia wypracowała to po realnej
  // utracie zmian w v6.3). `opcje.op` działa tu tak samo jak przy zapisie.
  przesun(nazwa, z, na, kto, dlaczego = '', opcje = {}) {
    const g = this.#glowy.get(nazwa);
    if (!g) throw new Error('Nie ma głowy: ' + nazwa);
    if (!this.#moze(g.prawa, kto)) throw new Error(`${kto.who} nie może przesunąć głowy ${nazwa}`);
    if (!this.#zapisy.has(na)) throw new Error('Nie ma zapisu: ' + na);
    const op = opcje.op ?? null;
    if (op !== null) {
      const znana = this.#operacje.get(op);
      if (znana) return this.#powtorzenie(op, znana,
        { typ: 'przesun', nazwa, z: z ?? null, na, kto: kto.who, dlaczego });
    }
    if (g.na !== z) return { ok: false, teraz: g.na, pokolenie: g.pokolenie };
    // Świeżość jest opcjonalna, żeby powierzchnia została wspólna z R1. Podana — obowiązuje.
    if (opcje.pokolenie !== undefined && opcje.pokolenie !== g.pokolenie)
      return { ok: false, teraz: g.na, pokolenie: g.pokolenie, nieswieze: true };
    g.na = na;
    g.pokolenie++;
    const n = this.#log({ typ: 'przesun', nazwa, z, na, kto: kto.who, dlaczego, op, pokolenie: g.pokolenie });
    // Udany wynik opisuje RZECZYWISTY skutek, nie samo "tak": wywołujący dowiaduje się,
    // które pokolenie wyprodukował jego akt. Bez tego powtórzenie nie miałoby czego zwrócić
    // poza obietnicą — a obietnica była właśnie tym, co padło w kontrpróbie.
    const wynik = Object.freeze({ ok: true, na, pokolenie: g.pokolenie });
    if (op !== null) this.#operacje.set(op, { n, wynik: Object.freeze({ ...wynik, powtorzone: true }) });
    return wynik;
  }

  // Powtórzenie operacji. Zwraca PIERWOTNY wynik, jeśli żądanie jest to samo co wtedy.
  // Różnica choćby w jednym polu znaczy, że to nie retry, a nowe żądanie pod zużytym
  // identyfikatorem — i wtedy błąd, bo ciche "ok" bez skutku jest gorsze od awarii.
  // Pierwotne żądanie odtwarzam z AKTU, nie z osobnej kopii: osobna kopia mogłaby rozęjść
  // się z aktem, który opisuje, a wtedy "powtórzone" znowu znaczyłoby coś innego niż to,
  // co się stało. Wymieniam NAZWY pól, nigdy wartości (zasada 2 i 12).
  #powtorzenie(op, znana, teraz) {
    const przed = czesci(this.#dziennik[znana.n - 1]);
    if (odcisk(przed) === odcisk(teraz)) return znana.wynik;
    // Gdy różni się sam rodzaj czynności, wyliczanie pól jest szumem: różnią się wszystkie.
    // Rodzaj wolno nazwać, bo `zapis`/`przesun` to nazwy z rdzenia, nie dane wywołującego.
    const czym = przed.typ !== teraz.typ
      ? `to był ${przed.typ}, a to jest ${teraz.typ}`
      : 'różnią się pola: ' + [...new Set([...Object.keys(przed), ...Object.keys(teraz)])]
        .filter(k => przed[k] !== teraz[k]).join(', ');
    throw new Error(`Operacja ${op} wykonała już inną czynność (akt ${znana.n}); ${czym}. `
      + `To nie jest powtórzenie, a nowe żądanie pod zużytym identyfikatorem.`);
  }
  #moze(prawa, kto) {
    if (prawa === 'wspolna') return true;
    if (prawa === 'wlasciciel') return kto.role === 'owner';
    if (prawa.startsWith('agent:')) return kto.who === prawa.slice(6);
    return false;
  }

  /* --------------------------------------------------------------------- dziennik */

  dziennik(od = 0) { return this.#dziennik.filter(e => e.n > od).map(e => ({ ...e })); }

  // Kolejność zatwierdzenia daje `n`, nie czas: zegary się cofają, a akty nie.
  // `czas` istnieje, żeby odpowiedzieć na pytanie "sprzed kiedy" (P4), nie żeby sortować.
  #log(e) {
    const wpis = { n: this.#dziennik.length + 1, czas: this.#zegar(), ...e };
    this.#dziennik.push(wpis);
    return wpis.n;
  }

  /* ------------------------------------------------------- trwałość i droga migracji */

  eksport() {
    return JSON.stringify({
      format: FORMAT, wersja: WERSJA,
      zapisy: [...this.#zapisy.values()],
      glowy: Object.fromEntries(this.#glowy),
      dziennik: this.#dziennik,
    });
  }

  static importuj(tekst, opcje = {}) {
    const d = JSON.parse(tekst);
    if (d.format === 'rdzen-r1' && d.wersja === 1) return Rdzen.#zR1(d, opcje);
    if (d.format !== FORMAT || d.wersja !== WERSJA) throw new Error(`Nieznany format: ${d.format} v${d.wersja}`);
    const r = new Rdzen(opcje);
    for (const z of d.zapisy) {
      if (recordId(z.kind, { content: z.content, links: z.links }) !== z.id) throw new Error('Zła tożsamość zapisu: ' + z.id);
      r.#zapisy.set(z.id, Object.freeze({ id: z.id, kind: z.kind, content: zamroz(z.content), links: Object.freeze([...z.links]) }));
    }
    for (const [n, g] of Object.entries(d.glowy)) r.#glowy.set(n, { na: g.na, prawa: g.prawa, pokolenie: g.pokolenie ?? 0 });
    r.#dziennik = d.dziennik.map(e => ({ ...e }));
    for (const e of r.#dziennik) if (e.op != null) r.#operacje.set(e.op, { n: e.n, wynik: Rdzen.#wynikZAktu(e) });
    return r;
  }

  // Wynik operacji odtworzony z AKTU — to jest powód, dla którego odcisk bierze tylko pola
  // dziennika. Retry po eksporcie i imporcie dostaje ten sam skutek, bo pochodzi z tego
  // samego źródła co pierwotny: z aktu.
  static #wynikZAktu(e) {
    return e.typ === 'zapis'
      ? e.id
      : Object.freeze({ ok: true, na: e.na, pokolenie: e.pokolenie, powtorzone: true });
  }

  // Droga migracji z R1 (zasada 8: formaty mają wersję i drogę migracji).
  // Dwie rzeczy robione jawnie:
  //  - `kto` schodzi z rekordu; w dzienniku R1 i tak już jest, więc autor nie przepada;
  //  - czasu w R1 NIE BYŁO, więc nie wymyślam go. `czas: null` i `czasNieznany: true`.
  //    Zmyślona data byłaby gorsza od przyznanej luki (nieznane != zero).
  static #zR1(d, opcje) {
    const r = new Rdzen(opcje);
    for (const z of d.zapisy) {
      const id = recordId(z.kind, { content: z.content, links: z.links });
      if (id !== z.id) throw new Error('Zła tożsamość zapisu R1: ' + z.id);
      r.#zapisy.set(id, Object.freeze({ id, kind: z.kind, content: zamroz(z.content), links: Object.freeze([...z.links]) }));
    }
    // R1 nie miał pokolenia, ale jego dziennik ma przesunięcia, więc liczba jest
    // odtwarzalna z historii, a nie zmyślona.
    const przesuniec = nazwa => (d.dziennik ?? []).filter(e => e.typ === 'przesun' && e.nazwa === nazwa).length;
    for (const [n, g] of Object.entries(d.glowy ?? {})) r.#glowy.set(n, { na: g.na, prawa: g.prawa, pokolenie: przesuniec(n) });
    r.#dziennik = (d.dziennik ?? []).map(e => ({ ...e, czas: null, czasNieznany: true, zR1: true }));
    return r;
  }
}
