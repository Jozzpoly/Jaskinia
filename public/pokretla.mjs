// Pokrętła: JEDNA tablica deklaracji wyglądu i odczucia (17 XI 2026; nazwy i typy po ataku linii wyglądu, 18 XI).
// Status: próba (TYMCZASOWE.md).
// Zasada (gotowość na wykończenie, G1): żadna twarz nie trzyma stałej wyglądu ani odczucia poza tą tablicą.
// Z tej samej tablicy biorą się trzy rzeczy: wartości domyślne w twarzy (działa bez Miejsca i w trybie bezpiecznym),
// ziarna rodzaju pokretlo/1 w Miejscu (worker/ziarna.mjs) i opis dla ręki oraz agenta (zdanie przy każdym pokrętle).
// Wartość bierze się z Miejsca: drzwi GET /api/srodowisko/ustawienia liczą ją z zasięgów (rzecz, widok, obszar w górę,
// Miejsce) i z włączonych zestawów (motyw, preset).
// NAZWY SĄ UMOWĄ. Pierwszy człon mówi, czym to jest dla człowieka (wyglad, odczucie, srodowisko albo nazwa narzędzia),
// a nie która twarz to rysuje; jednostka stoi w deklaracji, nie w nazwie. Zmiana nazwy to nowe pokrętło.
// Wartość domyślna może iść za innym pokrętłem: {z: "<nazwa>"} (wartość pochodna; worker/ustawienia.mjs).
// Ten plik nie zna ani przeglądarki, ani Workera: ładuje go twarz, strona gospodarza, zasiew i sprawdziany.

const kolor = (nazwa, domyslna, opis, grupa) => ({ nazwa, typ: 'kolor', domyslna, opis, grupa });
const JASNE = { tlo: '#f4f1ea', plyta: '#fbf9f4', tekst: '#24211c', ciche: '#6b645a', akcent: '#9a5b1e', linia: '#d8d1c4', zywe: '#2f8a4a', stare: '#a39a8b', znak: '#b3441e' };
const CIEMNE = { tlo: '#15130e', plyta: '#1e1b14', tekst: '#ece6da', ciche: '#a69d8f', akcent: '#e0a35e', linia: '#37322a', zywe: '#58c47a', stare: '#5d564b', znak: '#f08a5d' };
const CO_KOLOR = { tlo: 'tło strony i płótna', plyta: 'tło kart, paneli i okien', tekst: 'tekst główny', ciche: 'tekst drugiego planu i podpisy', akcent: 'to, co wybrane i klikalne', linia: 'obrysy i linie podziału', zywe: 'barwa życia: im żywszy projekt, tym jej więcej', stare: 'barwa tego, co dawno nieruszane', znak: 'znak uwagi: to, co czeka albo ostrzega' };
// Role palety, którymi rysują twarze z tego repozytorium. Miejsce może zadeklarować dalsze (wyglad.paleta.<tryb>.<rola>).
export const KOLORY = Object.keys(JASNE);
export const PALETA = { jasna: 'wyglad.paleta.jasna.', ciemna: 'wyglad.paleta.ciemna.' };
const KROJ_DOMYSLNY = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ROLA = /^[a-z][a-z0-9_]{0,39}$/;

export const POKRETLA = [
  { nazwa: 'wyglad.jasnosc', typ: 'wybor', wartosci: ['auto', 'jasna', 'ciemna'], domyslna: 'auto', grupa: 'Wygląd', opis: 'Która paleta obowiązuje: jasna, ciemna albo ta, którą wybiera urządzenie (auto).' },
  ...KOLORY.map((n) => kolor(PALETA.jasna + n, JASNE[n], `Paleta jasna: ${CO_KOLOR[n]}.`, 'Wygląd / Paleta jasna')),
  ...KOLORY.map((n) => kolor(PALETA.ciemna + n, CIEMNE[n], `Paleta ciemna: ${CO_KOLOR[n]}.`, 'Wygląd / Paleta ciemna')),
  { nazwa: 'wyglad.kroj.tekst', typ: 'kroj', domyslna: { rodzina: KROJ_DOMYSLNY }, grupa: 'Wygląd / Pismo', opis: 'Krój tekstu, liczb i podpisów w twarzach i oknach narzędzi: rodzina jak w CSS, do tego grubość i osie kroju zmiennego (na razie tylko kroje, które urządzenie już ma).' },
  { nazwa: 'wyglad.kroj.imiona', typ: 'kroj', domyslna: { z: 'wyglad.kroj.tekst' }, grupa: 'Wygląd / Pismo', dotyczy: ['karta'], opis: 'Krój imion, czyli nazw rzeczy na kartach i w nagłówkach. Dopóki nikt go nie ustawi, idzie za krojem tekstu.' },
  { nazwa: 'wyglad.karta.rog', typ: 'liczba', domyslna: 12, zakres: { od: 0, do: 40, krok: 1 }, twarde: { od: 0, do: 400 }, jednostka: 'px', grupa: 'Wygląd / Karta', dotyczy: ['karta'], opis: 'Największy promień zaokrąglenia rogu karty.' },
  { nazwa: 'odczucie.ruch.natezenie', typ: 'liczba', domyslna: 1, zakres: { od: 0, do: 2, krok: 0.05 }, twarde: { od: 0, do: 20 }, jednostka: '×', grupa: 'Odczucie / Ruch', opis: 'Mnożnik czasu wszystkich ruchów: 0 wyłącza ruch (wszystko przeskakuje), 1 to tempo domyślne, więcej zwalnia.' },
  { nazwa: 'odczucie.ruch.przelacznik', typ: 'czas', domyslna: 700, zakres: { od: 0, do: 2000, krok: 10 }, twarde: { od: 0, do: 60000 }, grupa: 'Odczucie / Ruch', dotyczy: ['uklad'], opis: 'Ile trwa przejście między układem z ręki a układem ciekłym.' },
  { nazwa: 'odczucie.ruch.kamera_do_calosci', typ: 'czas', domyslna: 450, zakres: { od: 0, do: 2000, krok: 10 }, twarde: { od: 0, do: 60000 }, grupa: 'Odczucie / Ruch', dotyczy: ['kamera'], opis: 'Ile trwa odjazd kamery do całego widoku.' },
  { nazwa: 'odczucie.ruch.kamera_do_karty', typ: 'czas', domyslna: 350, zakres: { od: 0, do: 2000, krok: 10 }, twarde: { od: 0, do: 60000 }, grupa: 'Odczucie / Ruch', dotyczy: ['kamera', 'karta'], opis: 'Ile trwa dojazd kamery do wybranej karty.' },
  { nazwa: 'odczucie.ruch.doganianie', typ: 'czas', domyslna: 80, zakres: { od: 0, do: 600, krok: 5 }, twarde: { od: 0, do: 10000 }, grupa: 'Odczucie / Ruch', dotyczy: ['karta'], opis: 'Jak miękko karty doganiają nowe miejsce po skoku układu (puszczenie, zamiana, cudza zmiana): stała czasowa wygładzania.' },
  { nazwa: 'odczucie.reka.prog_przeciagania', typ: 'liczba', domyslna: 6, zakres: { od: 0, do: 40, krok: 1 }, twarde: { od: 0, do: 400 }, jednostka: 'px', grupa: 'Odczucie / Ręka', dotyczy: ['ciagniecie'], opis: 'O ile trzeba ruszyć palcem albo wskaźnikiem, żeby dotknięcie stało się przeciąganiem.' },
  { nazwa: 'odczucie.reka.cien_niesionej', typ: 'cien', domyslna: { x: 0, y: 8, rozmycie: 24, kolor: '#00000073' }, grupa: 'Odczucie / Ręka', dotyczy: ['karta', 'ciagniecie'], opis: 'Cień pod kartą niesioną w ręce: przesunięcie, rozmycie i kolor; krycie to dwie ostatnie cyfry koloru (00 wyłącza cień).' },
];

// Nazwy pokręteł tej tablicy do pytania drzwi (?nazwy=): twarz pyta tylko o swoje, więc koszt odpowiedzi nie rośnie
// z tym, co ktoś inny zadeklarował w Miejscu.
export const NAZWY_POKRETEL = POKRETLA.map((p) => p.nazwa).join(',');

const KOLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const liczba = (x) => typeof x === 'number' && Number.isFinite(x);
const obiekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const idzieZa = (w) => (obiekt(w) && Object.keys(w).length === 1 && typeof w.z === 'string' ? w.z : null);

// Czy wartość pasuje do deklaracji (typy, które twarz umie narysować; każdy inny odpada i zostaje wartość domyślna).
export const pasuje = (d, w) => {
  const wKlamrze = () => !d.twarde || ((d.twarde.od === undefined || w >= d.twarde.od) && (d.twarde.do === undefined || w <= d.twarde.do));
  switch (d.typ) {
    case 'kolor': return typeof w === 'string' && KOLOR.test(w);
    case 'liczba': return liczba(w) && wKlamrze();
    case 'czas': return liczba(w) && w >= 0 && wKlamrze();
    case 'wybor': return Array.isArray(d.wartosci) && d.wartosci.includes(w);
    case 'tak-nie': return typeof w === 'boolean';
    case 'tekst': return typeof w === 'string' && w.length <= 2000;
    case 'kroj': return obiekt(w) && typeof w.rodzina === 'string' && !!w.rodzina.trim() && w.rodzina.length <= 300
      && (w.grubosc === undefined || (liczba(w.grubosc) && w.grubosc >= 1 && w.grubosc <= 1000))
      && (w.osie === undefined || (obiekt(w.osie) && Object.keys(w.osie).length <= 8 && Object.entries(w.osie).every(([n, x]) => /^[A-Za-z]{4}$/.test(n) && liczba(x))));
    case 'cien': return obiekt(w) && liczba(w.x) && liczba(w.y) && liczba(w.rozmycie) && w.rozmycie >= 0 && typeof w.kolor === 'string' && KOLOR.test(w.kolor);
    case 'sprezyna': return obiekt(w) && liczba(w.czas) && w.czas >= 0 && liczba(w.odbicie) && w.odbicie >= 0 && w.odbicie <= 1;
    default: return false;
  }
};

// Krój jako trzy własności stylu: rodzina, grubość i osie (font-variation-settings). Przypisuje się je własnościami,
// nigdy tekstem stylu.
export const krojNaCss = (k) => ({
  rodzina: k.rodzina,
  grubosc: k.grubosc === undefined ? '' : String(Math.round(k.grubosc)),
  osie: obiekt(k.osie) && Object.keys(k.osie).length ? Object.entries(k.osie).map(([n, x]) => `"${n}" ${x}`).join(', ') : '',
});

// Sprężyna zapisana tak, jak czuje ją ręka ({czas, odbicie}), przeliczona na fizykę przy masie 1: czas to okres drgań
// bez tłumienia w milisekundach, odbicie 0 to tłumienie krytyczne (dochodzi i staje), odbicie 1 to brak tłumienia.
export const sprezynaNaFizyke = ({ czas, odbicie }) => {
  const omega = 2 * Math.PI / (Math.max(1, Number(czas) || 0) / 1000);
  return { sztywnosc: omega * omega, tlumienie: 2 * (1 - Math.max(0, Math.min(1, Number(odbicie) || 0))) * omega, masa: 1 };
};

// Pokrętła w ręku twarzy: wartości domyślne z tablicy, nad nimi to, co przyszło z Miejsca, a nad wszystkim podgląd
// (wartość tymczasowa w trakcie kręcenia, bez zapisu). Twarz pyta `w(nazwa)` i nie wie, skąd wartość. W trybie
// bezpiecznym zostają same wartości domyślne (wyjście z każdego zepsutego wyglądu).
export class Pokretla {
  constructor({ bezpiecznie = false, naZmiane = () => {} } = {}) {
    this.typy = new Map(POKRETLA.map((p) => [p.nazwa, p]));
    this.zMiejsca = new Map();
    this.podglad = new Map();
    this._zegary = new Map();
    this.bezpiecznie = bezpiecznie;
    this.naZmiane = naZmiane;
    this.akt = null;
  }

  // Twarz uczy się pokrętła spoza tablicy z deklaracji w Miejscu (np. nowej roli palety): od tej chwili przyjmuje jego
  // wartości, sprawdzając typ tak samo jak dla własnych. Zwraca, czy to nowość.
  znaj(d) {
    if (!obiekt(d) || typeof d.nazwa !== 'string' || typeof d.typ !== 'string' || this.typy.has(d.nazwa) || this.typy.size >= 400) return false;
    this.typy.set(d.nazwa, d);
    return true;
  }
  nazwy() { return [...this.typy.keys()].slice(0, 200).join(','); }

  // Wartość domyślna; gdy idzie za innym pokrętłem, bierze to, co tamto ma teraz.
  domyslna(nazwa, glebia = 0) {
    const d = this.typy.get(nazwa);
    if (!d) return undefined;
    const cel = idzieZa(d.domyslna);
    return cel !== null ? (glebia < 8 ? this.w(cel, glebia + 1) : undefined) : d.domyslna;
  }

  w(nazwa, glebia = 0) {
    if (!this.bezpiecznie && this.podglad.has(nazwa)) return this.podglad.get(nazwa);
    if (!this.bezpiecznie && this.zMiejsca.has(nazwa)) return this.zMiejsca.get(nazwa);
    return this.domyslna(nazwa, glebia);
  }

  // Czas ruchu z natężeniem: 0 znaczy "bez ruchu".
  czas(nazwa) { return Math.max(0, Number(this.w(nazwa)) || 0) * Math.max(0, Number(this.w('odczucie.ruch.natezenie')) || 0); }

  // Czy teraz obowiązuje paleta ciemna (`systemCiemny`: co mówi urządzenie).
  ciemna(systemCiemny) { const j = this.w('wyglad.jasnosc'); return j === 'ciemna' || (j !== 'jasna' && !!systemCiemny); }
  kolor(rola, systemCiemny) { return this.w((this.ciemna(systemCiemny) ? PALETA.ciemna : PALETA.jasna) + rola); }
  // Role palety, które ta twarz zna: z tablicy i nauczone z deklaracji Miejsca.
  role() {
    const r = new Set();
    for (const n of this.typy.keys()) for (const p of [PALETA.jasna, PALETA.ciemna]) if (n.startsWith(p) && ROLA.test(n.slice(p.length))) r.add(n.slice(p.length));
    return [...r];
  }
  // Krój roli (tekst, imiona): zawsze obiekt z rodziną, także gdy wartość z Miejsca jest zepsuta.
  kroj(rola = 'tekst') { const k = this.w('wyglad.kroj.' + rola); return obiekt(k) && typeof k.rodzina === 'string' && k.rodzina.trim() ? k : { rodzina: KROJ_DOMYSLNY }; }

  // Podgląd: wartość tymczasowa nad wszystkim, bez zapisu (ręka kręci, twarz odpowiada od razu). Gaśnie sama po kilku
  // sekundach bez odświeżenia, żeby karta, której nadawca zniknął, nie została przy cudzej próbie.
  podejrzyj(nazwa, wartosc) {
    const d = this.typy.get(nazwa);
    if (!d || !pasuje(d, wartosc)) return false;
    this.podglad.set(nazwa, wartosc);
    clearTimeout(this._zegary.get(nazwa));
    const zegar = setTimeout(() => this.koniecPodgladu(nazwa), 8000);
    if (zegar && typeof zegar.unref === 'function') zegar.unref();
    this._zegary.set(nazwa, zegar);
    this.naZmiane();
    return true;
  }
  koniecPodgladu(nazwa = null) {
    const nazwy = nazwa === null ? [...this.podglad.keys()] : [nazwa];
    let bylo = false;
    for (const n of nazwy) { clearTimeout(this._zegary.get(n)); this._zegary.delete(n); if (this.podglad.delete(n)) bylo = true; }
    if (bylo) this.naZmiane();
    return bylo;
  }

  // Odpowiedź drzwi /api/srodowisko/ustawienia: { wartosci: { nazwa: { wartosc, … } }, akt }. Zwraca, czy coś się zmieniło.
  przyjmij(odp) {
    if (!odp || typeof odp.wartosci !== 'object' || !odp.wartosci) return false;
    // Twarz bierze z Miejsca tylko to, co zna, i tylko w typie ze swojej tablicy: wartość, która do niego nie
    // pasuje (np. po podmianie deklaracji w Miejscu), nie dochodzi do rysowania; zostaje wartość domyślna.
    const nowe = new Map();
    for (const [n, x] of Object.entries(odp.wartosci)) if (x && 'wartosc' in x && this.typy.has(n) && pasuje(this.typy.get(n), x.wartosc)) nowe.set(n, x.wartosc);
    let zmiana = nowe.size !== this.zMiejsca.size;
    if (!zmiana) for (const [n, w] of nowe) if (JSON.stringify(this.zMiejsca.get(n)) !== JSON.stringify(w)) { zmiana = true; break; }
    this.zMiejsca = nowe;
    this.akt = Number.isInteger(odp.akt) ? odp.akt : this.akt;
    if (zmiana) this.naZmiane();
    return zmiana;
  }
}

// Podgląd między kartami tego samego adresu (strona gospodarza i Start): ten, kto kręci, nadaje wartość w trakcie,
// pozostałe karty pokazują ją od razu. Bez zapisu, bez serwera, zero wierszy bazy; zapis idzie dopiero przy puszczeniu.
// Tam, gdzie przeglądarka nie ma BroadcastChannel, nadawanie po prostu nic nie robi.
export function polaczPodglad(P, nazwaKanalu = 'jaskinia:podglad') {
  const BC = globalThis.BroadcastChannel;
  if (typeof BC !== 'function') return { nadaj() {}, koniec() {}, zamknij() {} };
  const kanal = new BC(nazwaKanalu);
  if (typeof kanal.unref === 'function') kanal.unref();
  kanal.onmessage = (e) => {
    const m = e && e.data;
    if (!obiekt(m) || typeof m.nazwa !== 'string') return;
    if (m.koniec === true) P.koniecPodgladu(m.nazwa); else P.podejrzyj(m.nazwa, m.wartosc);
  };
  const wyslij = (m) => { try { kanal.postMessage(m); } catch { /* wartość, której nie da się przesłać, zostaje tylko w tej karcie */ } };
  return { nadaj: (nazwa, wartosc) => wyslij({ nazwa, wartosc }), koniec: (nazwa) => wyslij({ nazwa, koniec: true }), zamknij: () => kanal.close() };
}

// Rodzaje rzeczy, których zmiana znaczy "policz ustawienia od nowa" (twarz widzi je w doganianiu spisu).
export const RODZAJE_USTAWIEN = ['pokretlo/1', 'wartosc/1', 'zestaw/1'];
