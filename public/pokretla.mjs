// Pokrętła: JEDNA tablica deklaracji wyglądu i odczucia (17 XI 2026). Status: próba (TYMCZASOWE.md).
// Zasada (gotowość na wykończenie, G1): żadna twarz nie trzyma stałej wyglądu ani odczucia poza tą tablicą.
// Z tej samej tablicy biorą się trzy rzeczy: wartości domyślne w twarzy (działa bez Miejsca i w trybie bezpiecznym),
// ziarna rodzaju pokretlo/1 w Miejscu (worker/ziarna.mjs) i opis dla ręki oraz agenta (zdanie przy każdym pokrętle).
// Wartość bierze się z Miejsca: drzwi GET /api/srodowisko/ustawienia liczą ją z zasięgów (rzecz, widok, obszar w górę,
// Miejsce) i z włączonych zestawów (motyw, preset). Nazwy są umową: zmiana nazwy to nowe pokrętło.
// Ten plik nie zna ani przeglądarki, ani Workera: ładuje go twarz, strona gospodarza, zasiew i sprawdziany.

const kolor = (nazwa, domyslna, opis, grupa) => ({ nazwa, typ: 'kolor', domyslna, opis, grupa });
const JASNE = { tlo: '#f4f1ea', plyta: '#fbf9f4', tekst: '#24211c', ciche: '#6b645a', akcent: '#9a5b1e', linia: '#d8d1c4', zywe: '#2f8a4a', stare: '#a39a8b', znak: '#b3441e' };
const CIEMNE = { tlo: '#15130e', plyta: '#1e1b14', tekst: '#ece6da', ciche: '#a69d8f', akcent: '#e0a35e', linia: '#37322a', zywe: '#58c47a', stare: '#5d564b', znak: '#f08a5d' };
const CO_KOLOR = { tlo: 'tło strony i płótna', plyta: 'tło kart, paneli i okien', tekst: 'tekst główny', ciche: 'tekst drugiego planu i podpisy', akcent: 'to, co wybrane i klikalne', linia: 'obrysy i linie podziału', zywe: 'barwa życia: im żywszy projekt, tym jej więcej', stare: 'barwa tego, co dawno nieruszane', znak: 'znak uwagi: to, co czeka albo ostrzega' };
export const KOLORY = Object.keys(JASNE);

export const POKRETLA = [
  { nazwa: 'wyglad.jasnosc', typ: 'wybor', wartosci: ['auto', 'jasna', 'ciemna'], domyslna: 'auto', grupa: 'Wygląd', opis: 'Która paleta obowiązuje: jasna, ciemna albo ta, którą wybiera urządzenie (auto).' },
  ...KOLORY.map((n) => kolor('wyglad.kolor.' + n, JASNE[n], `Paleta jasna: ${CO_KOLOR[n]}.`, 'Wygląd / Paleta jasna')),
  ...KOLORY.map((n) => kolor('wyglad.kolor_ciemny.' + n, CIEMNE[n], `Paleta ciemna: ${CO_KOLOR[n]}.`, 'Wygląd / Paleta ciemna')),
  { nazwa: 'wyglad.kroj.rodzina', typ: 'tekst', domyslna: 'system-ui, -apple-system, "Segoe UI", sans-serif', grupa: 'Wygląd / Pismo', opis: 'Rodzina kroju pisma w twarzach i oknach narzędzi (lista jak w CSS; na razie tylko kroje, które urządzenie już ma).' },
  { nazwa: 'wyglad.ruch.natezenie', typ: 'liczba', domyslna: 1, zakres: { od: 0, do: 2, krok: 0.05 }, twarde: { od: 0, do: 20 }, jednostka: '×', grupa: 'Odczucie / Ruch', opis: 'Mnożnik czasu wszystkich ruchów: 0 wyłącza ruch (wszystko przeskakuje), 1 to tempo domyślne, więcej zwalnia.' },
  { nazwa: 'start.ruch.przelacznik_ms', typ: 'czas', domyslna: 700, zakres: { od: 0, do: 2000, krok: 10 }, twarde: { od: 0, do: 60000 }, grupa: 'Odczucie / Ruch', opis: 'Ile trwa przejście między układem z ręki a układem ciekłym na Starcie.' },
  { nazwa: 'start.ruch.calosc_ms', typ: 'czas', domyslna: 450, zakres: { od: 0, do: 2000, krok: 10 }, twarde: { od: 0, do: 60000 }, grupa: 'Odczucie / Ruch', opis: 'Ile trwa odjazd kamery do całego widoku.' },
  { nazwa: 'start.ruch.do_karty_ms', typ: 'czas', domyslna: 350, zakres: { od: 0, do: 2000, krok: 10 }, twarde: { od: 0, do: 60000 }, grupa: 'Odczucie / Ruch', opis: 'Ile trwa dojazd kamery do wybranej karty.' },
  { nazwa: 'start.ruch.doganianie_ms', typ: 'czas', domyslna: 80, zakres: { od: 0, do: 600, krok: 5 }, twarde: { od: 0, do: 10000 }, grupa: 'Odczucie / Ruch', opis: 'Jak miękko karty doganiają nowe miejsce po skoku układu (puszczenie, zamiana, cudza zmiana): stała czasowa wygładzania.' },
  { nazwa: 'reka.prog_przeciagania_px', typ: 'liczba', domyslna: 6, zakres: { od: 0, do: 40, krok: 1 }, twarde: { od: 0, do: 400 }, jednostka: 'px', grupa: 'Odczucie / Ręka', opis: 'O ile trzeba ruszyć palcem albo wskaźnikiem, żeby dotknięcie stało się przeciąganiem.' },
  { nazwa: 'start.karta.rog_px', typ: 'liczba', domyslna: 12, zakres: { od: 0, do: 40, krok: 1 }, twarde: { od: 0, do: 400 }, jednostka: 'px', grupa: 'Wygląd / Karta', opis: 'Największy promień zaokrąglenia rogu karty na Starcie.' },
  { nazwa: 'start.cien.krycie', typ: 'liczba', domyslna: 0.45, zakres: { od: 0, do: 1, krok: 0.05 }, twarde: { od: 0, do: 1 }, grupa: 'Odczucie / Ciągnięta karta', opis: 'Jak ciemny jest cień pod kartą niesioną w ręce (0 wyłącza cień).' },
  { nazwa: 'start.cien.rozmycie_px', typ: 'liczba', domyslna: 24, zakres: { od: 0, do: 80, krok: 1 }, twarde: { od: 0, do: 400 }, jednostka: 'px', grupa: 'Odczucie / Ciągnięta karta', opis: 'Jak rozmyty jest cień pod kartą niesioną w ręce.' },
  { nazwa: 'start.cien.przesuniecie_px', typ: 'liczba', domyslna: 8, zakres: { od: 0, do: 40, krok: 1 }, twarde: { od: -400, do: 400 }, jednostka: 'px', grupa: 'Odczucie / Ciągnięta karta', opis: 'O ile cień jest przesunięty w dół spod karty niesionej w ręce.' },
];

// Pokrętła w ręku twarzy: wartości domyślne z tablicy, nad nimi to, co przyszło z Miejsca. Twarz pyta `w(nazwa)` i nie
// wie, skąd wartość. W trybie bezpiecznym zostają same wartości domyślne (wyjście z każdego zepsutego wyglądu).
export class Pokretla {
  constructor({ bezpiecznie = false, naZmiane = () => {} } = {}) {
    this.domyslne = new Map(POKRETLA.map((p) => [p.nazwa, p.domyslna]));
    this.zMiejsca = new Map();
    this.bezpiecznie = bezpiecznie;
    this.naZmiane = naZmiane;
    this.akt = null;
  }

  w(nazwa) {
    if (!this.bezpiecznie && this.zMiejsca.has(nazwa)) return this.zMiejsca.get(nazwa);
    return this.domyslne.get(nazwa);
  }

  // Czas ruchu z natężeniem: 0 znaczy "bez ruchu".
  czas(nazwa) { return Math.max(0, Number(this.w(nazwa)) || 0) * Math.max(0, Number(this.w('wyglad.ruch.natezenie')) || 0); }

  // Czy teraz obowiązuje paleta ciemna (`systemCiemny`: co mówi urządzenie).
  ciemna(systemCiemny) { const j = this.w('wyglad.jasnosc'); return j === 'ciemna' || (j !== 'jasna' && !!systemCiemny); }
  kolor(nazwa, systemCiemny) { return this.w((this.ciemna(systemCiemny) ? 'wyglad.kolor_ciemny.' : 'wyglad.kolor.') + nazwa); }

  // Odpowiedź drzwi /api/srodowisko/ustawienia: { wartosci: { nazwa: { wartosc, … } }, akt }. Zwraca, czy coś się zmieniło.
  przyjmij(odp) {
    if (!odp || typeof odp.wartosci !== 'object' || !odp.wartosci) return false;
    const nowe = new Map();
    for (const [n, x] of Object.entries(odp.wartosci)) if (x && 'wartosc' in x) nowe.set(n, x.wartosc);
    let zmiana = nowe.size !== this.zMiejsca.size;
    if (!zmiana) for (const [n, w] of nowe) if (JSON.stringify(this.zMiejsca.get(n)) !== JSON.stringify(w)) { zmiana = true; break; }
    this.zMiejsca = nowe;
    this.akt = Number.isInteger(odp.akt) ? odp.akt : this.akt;
    if (zmiana) this.naZmiane();
    return zmiana;
  }
}

// Rodzaje rzeczy, których zmiana znaczy "policz ustawienia od nowa" (twarz widzi je w doganianiu spisu).
export const RODZAJE_USTAWIEN = ['pokretlo/1', 'wartosc/1', 'zestaw/1'];
