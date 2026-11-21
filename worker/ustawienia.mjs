// Ustawienia jako dane (17 XI 2026, grunt pod warstwę odczuwalną; umowa po ataku linii wyglądu 18 XI). Status: próba
// (TYMCZASOWE.md).
// Po co: w starej Jaskini motywy były kodem (zamknięta lista czterech), a ustawienia leżały w pamięci jednej
// przeglądarki (moduł 45-settings): bez historii, bez autora, niewidoczne dla agentów i dla drugiego urządzenia.
// Każda zmiana wyglądu albo odczucia kończyła się więc wydaniem kodu. Tutaj wszystko, co da się stroić, jest rzeczą:
//   - pokretlo/1: DEKLARACJA jednej strojonej rzeczy (nazwa, typ, wartość domyślna, zakres suwaka, twarda klamra,
//     zdanie, co zmienia). Dokłada ją każdy: twarz, narzędzie w oknie, agent. Nowe pokrętło to ruch, nie wydanie kodu;
//   - wartosc/1: WARTOŚĆ pokrętła w zasięgu. Zasięgiem jest dowolna rzecz: obszar (także główny, czyli całe Miejsce),
//     widok, okno, uczestnik, profil urządzenia. Jedna wartość na parę (pokrętło, zasięg), więc każda zmiana jest
//     nową wersją tej samej rzeczy: historia, autor i cofnięcie przychodzą z samego środowiska. Wartość leży tam,
//     gdzie jej zasięg, więc prawo do strojenia jest prawem obszaru (w szkicu agent stroi sam, w głównym proponuje);
//   - zestaw/1: nazwany ZESTAW wartości (motyw, preset). Włącza się go wartością pokrętła `srodowisko.zestawy`
//     w zasięgu; zestawy nakładają się warstwami, późniejszy na liście wygrywa;
//   - profil/1: nazwany zasięg bez własnej treści (to urządzenie, ten sposób pracy), podawany jako nakładka.
// Liczenie: dla każdego pokrętła idziemy po zasięgach od najbliższego (nakładki, rzecz, jej obszar i obszary w górę,
// Miejsce). W każdym: najpierw wartość wprost, potem zestawy włączone w tym zasięgu. Na końcu wartość domyślna
// z deklaracji. Wartość, która nie przechodzi dzisiejszej deklaracji, jest pomijana i wymieniona z nazwy: zepsuta
// wartość nie dochodzi do twarzy.
// WARTOŚĆ POCHODNA (18 XI): wszędzie, gdzie stoi wartość (domyślna, wartość wprost, wartość w zestawie), może stać
// odwołanie {"z": "<nazwa pokrętła>"} do pokrętła tego samego typu. Znaczy: "to, co ma tamto pokrętło dla tego samego
// patrzącego". Dzięki temu motyw ustawia kilka barw bazowych, role idą za nimi, a nowa rola dołożona po motywie nie
// rozjeżdża go. Typy `zestawy` i `dowolne` odwołań nie mają (ich wartość jest brana dosłownie).
// Twarda klamra chroni tylko przed rozpadem (liczba, której twarz nie umie narysować); zakres suwaka jest podpowiedzią
// i wartość spoza niego wolno zapisać (zasada 5 z AGENTS.md).
// Czego tu nie ma: czterech ustawień obszaru (ile_wolno, uwaga, widzi, uklada). To prawo i granica, nie pokrętło;
// zostają cechami obszaru. Ten plik nie zna Cloudflare ani drzwi: dostaje środowisko albo jego widok dla czytającego.

// Reguła typu drabina mieszka w module bez zależności, który czyta też twarz (jedna reguła dla zapisu i odczytu).
import { wadaDrabiny, NAJWIECEJ_SZCZEBLI, GRANICE_DRABINY } from '../public/drabina.mjs';

export const FORMAT_USTAWIEN = 'ustawienia-2';
export const POKRETLO_ZESTAWOW = 'srodowisko.zestawy';
// Twarde granice: chronią przed rozpadem (wspólny limit wierszy konta), nie przed strojeniem. Każda odmowa mówi zdaniem.
export const NAJWIECEJ_POKRETEL = 2000;
export const NAJGLEBIEJ_ODWOLAN = 8;
export const NAJWIECEJ_NAZW = 200;
export const PALETA = { jasna: 'wyglad.paleta.jasna.', ciemna: 'wyglad.paleta.ciemna.' };
const NAZWA = /^[a-z][a-z0-9_]{0,39}(\.[a-z][a-z0-9_]{0,39}){1,5}$/;
const ID = /^[0-9a-z]{26}$/;
const KOLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const ELEMENT = /^[a-z][a-z0-9_-]{0,39}$/;
export const KRZYWE = ['liniowa', 'gladka', 'wejscie', 'wyjscie', 'wejscie-wyjscie'];
export const PRZESTRZENIE = ['srgb', 'oklab'];
export const TYPY_POKRETEL = {
  kolor: 'napis #rrggbb albo #rrggbbaa',
  liczba: 'liczba skończona; deklaracja może podać zakres suwaka {od, do, krok} i twardą klamrę {od, do}',
  czas: 'czas w milisekundach, liczba skończona nie mniejsza niż 0; zakres i klamra jak przy liczbie',
  wybor: 'jedna z wartości wymienionych w deklaracji (wartosci)',
  'tak-nie': 'true albo false',
  tekst: 'napis do 2000 znaków',
  krzywa: `krzywa ruchu: jedna z nazw (${KRZYWE.join(', ')}) albo cztery liczby krzywej Béziera [x1, y1, x2, y2], x od 0 do 1`,
  sprezyna: 'sprężyna w parametrach, które czuje ręka: {czas >= 0 (milisekundy: jak szybko dochodzi), odbicie od 0 (bez odbicia) do 1 (nie gaśnie)}',
  rampa: `rampa barw: {przystanki: lista od 2 do 16 przystanków {w: 0..1, kolor} w kolejności rosnącego w, przestrzen: ${PRZESTRZENIE.join(' albo ')} (niewymagana; bez niej srgb)}`,
  kroj: 'krój pisma: {rodzina (napis jak w CSS), grubosc 1..1000 (niewymagana), osie {wght: 600, …} (niewymagane), plik {rzecz: <id rzeczy plik/1>, odcisk: <odcisk jej dzisiejszej wersji>} (niewymagany: krój z bajtów w Miejscu)}',
  cien: 'cień: {x, y, rozmycie >= 0, kolor}; krycie to kanał alfa koloru (#rrggbbaa)',
  drabina: `drabina przedstawień: {szczeble: lista od 1 do ${NAJWIECEJ_SZCZEBLI} szczebli {co: nazwa elementu, miara: {szer, wys} (mniejsza z szerokości i wysokości karty na ekranie razy te liczby), od i do (px miary: przenikanie od niewidocznego do pełnego; 0 i 0 znaczy zawsze) albo rozmiar {od, do} (px pisma: szczebel ciągły) z ucinaj {szer_od, wys_od, rozmiar} (niewymagane)}}; nieznane pole (także krzywa przenikania, której twarz jeszcze nie czyta) jest odrzucane; liczby mają twarde granice (miara do ${GRANICE_DRABINY.miara}, px miary do ${GRANICE_DRABINY.px}, pismo od ${GRANICE_DRABINY.pismo.od} do ${GRANICE_DRABINY.pismo.do} px); twarz pomija co, którego nie zna, a wartość z węższego zasięgu zastępuje całą drabinę`,
  zestawy: 'lista identyfikatorów rzeczy rodzaju zestaw/1 (najwyżej 8); późniejszy na liście wygrywa',
  dowolne: 'dowolna wartość JSON; środowisko jej nie sprawdza (wyjście dla narzędzi z własną strukturą)',
};
const BEZ_ODWOLAN = ['zestawy', 'dowolne'];
const liczba = (x) => typeof x === 'number' && Number.isFinite(x);
// Rodzina kroju to nazwy rodzin jak w CSS: litery, cyfry, spacja, przecinek, cudzysłów prosty, kropka, - i _. Dowolny
// napis nie wstrzykiwał niczego dziś (twarz przypisuje rodzinę jedną własnością), ale byłby pułapką dla każdego, kto
// kiedyś złoży z niej arkusz tekstem (niezależny atak, 18 XI 2026). Ten sam wzorzec stoi w public/pokretla.mjs.
const RODZINA_KROJU = /^[\p{L}\p{N} ,'"._-]{1,300}$/u;
const obiekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Odwołanie (wartość pochodna): nazwa pokrętła, za którym wartość idzie, albo null, gdy wartość jest zwykła.
export function odwolanie(d, w) {
  return d && !BEZ_ODWOLAN.includes(d.typ) && obiekt(w) && Object.keys(w).length === 1 && typeof w.z === 'string' ? w.z : null;
}

// Co jest nie tak z wartością względem deklaracji; null, gdy nic. `maRzecz(id)` oddaje rzecz albo null (dla typu zestawy).
// Odwołań ta funkcja nie zna: sprawdza je ten, kto zna pozostałe deklaracje (zapis i liczenie niżej).
export function wadaWartosci(d, w, maRzecz = () => null) {
  const klamra = () => {
    const t = obiekt(d.twarde) ? d.twarde : {};
    if (liczba(t.od) && w < t.od) return `jest poniżej twardej klamry (${t.od}); klamra chroni tylko przed rozpadem, zakres suwaka jest od niej węższy`;
    if (liczba(t.do) && w > t.do) return `jest powyżej twardej klamry (${t.do}); klamra chroni tylko przed rozpadem, zakres suwaka jest od niej węższy`;
    return null;
  };
  switch (d.typ) {
    case 'kolor': return typeof w === 'string' && KOLOR.test(w) ? null : 'ma być kolorem w zapisie #rrggbb albo #rrggbbaa';
    case 'liczba': return liczba(w) ? klamra() : 'ma być liczbą skończoną';
    case 'czas': return liczba(w) && w >= 0 ? klamra() : 'ma być czasem w milisekundach (liczba nie mniejsza niż 0)';
    case 'wybor': return Array.isArray(d.wartosci) && d.wartosci.includes(w) ? null : `ma być jedną z wartości: ${(d.wartosci || []).join(', ')}`;
    case 'tak-nie': return typeof w === 'boolean' ? null : 'ma być true albo false';
    case 'tekst': return typeof w === 'string' && w.length <= 2000 ? null : 'ma być napisem do 2000 znaków';
    case 'krzywa':
      if (typeof w === 'string') return KRZYWE.includes(w) ? null : `ma być jedną z krzywych: ${KRZYWE.join(', ')}, albo czterema liczbami [x1, y1, x2, y2]`;
      return Array.isArray(w) && w.length === 4 && w.every(liczba) && w[0] >= 0 && w[0] <= 1 && w[2] >= 0 && w[2] <= 1 ? null : 'krzywa Béziera to cztery liczby [x1, y1, x2, y2], x1 i x2 od 0 do 1';
    case 'sprezyna':
      return obiekt(w) && liczba(w.czas) && w.czas >= 0 && liczba(w.odbicie) && w.odbicie >= 0 && w.odbicie <= 1 ? null : 'sprężyna to {czas >= 0 (milisekundy), odbicie od 0 do 1}';
    case 'rampa': {
      if (!obiekt(w) || !Array.isArray(w.przystanki) || w.przystanki.length < 2 || w.przystanki.length > 16) return 'rampa to {przystanki: lista od 2 do 16 przystanków {w, kolor}, przestrzen (niewymagana)}';
      if (w.przestrzen !== undefined && !PRZESTRZENIE.includes(w.przestrzen)) return `przestrzeń barw rampy to jedna z: ${PRZESTRZENIE.join(', ')}`;
      let poprzedni = -Infinity;
      for (const p of w.przystanki) {
        if (!obiekt(p) || !liczba(p.w) || p.w < 0 || p.w > 1 || p.w < poprzedni || typeof p.kolor !== 'string' || !KOLOR.test(p.kolor)) return 'każdy przystanek rampy to {w: 0..1, kolor: #rrggbb}, w kolejności rosnącego w';
        poprzedni = p.w;
      }
      return null;
    }
    case 'kroj':
      if (!obiekt(w) || typeof w.rodzina !== 'string' || !w.rodzina.trim() || !RODZINA_KROJU.test(w.rodzina)) return 'krój to {rodzina: nazwy rodzin jak w CSS (litery, cyfry, spacja, przecinek, cudzysłów prosty, kropka, - i _), do 300 znaków, …}';
      if (w.grubosc !== undefined && !(liczba(w.grubosc) && w.grubosc >= 1 && w.grubosc <= 1000)) return 'grubość kroju to liczba od 1 do 1000';
      if (w.osie !== undefined && !(obiekt(w.osie) && Object.keys(w.osie).length <= 8 && Object.entries(w.osie).every(([n, x]) => /^[A-Za-z]{4}$/.test(n) && liczba(x)))) return 'osie kroju to obiekt {czteroliterowa nazwa osi: liczba}, najwyżej 8 osi';
      if (w.plik !== undefined && !(obiekt(w.plik) && typeof w.plik.rzecz === 'string' && ID.test(w.plik.rzecz) && typeof w.plik.odcisk === 'string' && /^[0-9a-f]{64}$/.test(w.plik.odcisk))) return 'plik kroju to {rzecz: <id rzeczy plik/1>, odcisk: <64 znaki szesnastkowe>}';
      return null;
    case 'cien': return obiekt(w) && liczba(w.x) && liczba(w.y) && liczba(w.rozmycie) && w.rozmycie >= 0 && typeof w.kolor === 'string' && KOLOR.test(w.kolor) ? null : 'cień to {x, y, rozmycie >= 0, kolor: #rrggbb albo #rrggbbaa}';
    case 'drabina': return wadaDrabiny(w);
    case 'zestawy': {
      if (!Array.isArray(w) || w.length > 8) return 'ma być listą najwyżej 8 identyfikatorów zestawów';
      for (const id of w) {
        if (typeof id !== 'string' || !ID.test(id)) return 'każdy element ma być identyfikatorem rzeczy rodzaju zestaw/1 (26 znaków)';
        const z = maRzecz(id);
        if (!z) return `nie ma rzeczy ${id}`;
        if (z.rodzaj !== 'zestaw/1') return `rzecz ${id} jest rodzaju ${z.rodzaj}, a ma być zestaw/1`;
      }
      return null;
    }
    case 'dowolne': return null;
    default: return `deklaracja podaje nieznany typ ${JSON.stringify(d.typ)}`;
  }
}

// Co jest nie tak z deklaracją pokrętła (lista zdań; pusta, gdy nic). Tu tylko to, co widać w samej deklaracji;
// czy pokrętło, za którym idzie wartość domyślna, istnieje i ma ten sam typ, sprawdza zapis (sprawdzUstawienie).
export function wadyDeklaracji(c) {
  const b = [];
  if (typeof c.nazwa !== 'string' || !NAZWA.test(c.nazwa)) b.push('nazwa: od dwóch do sześciu członów z małych liter, cyfr i _, rozdzielonych kropką, np. wyglad.paleta.jasna.tlo albo moje_narzedzie.siatka.odstep');
  if (!Object.hasOwn(TYPY_POKRETEL, c.typ)) { b.push(`typ: jeden z: ${Object.keys(TYPY_POKRETEL).join(', ')}`); return b; }
  if (typeof c.opis !== 'string' || !c.opis.trim()) b.push('opis: jedno zdanie o tym, co to pokrętło zmienia (czyta je ręka i agent)');
  const zakres = (n, pelny) => {
    if (!(n in c) || c[n] === null) return;
    const z = c[n];
    if (!obiekt(z) || (pelny ? !(liczba(z.od) && liczba(z.do) && z.od < z.do && (z.krok === undefined || (liczba(z.krok) && z.krok > 0))) : !((z.od === undefined || liczba(z.od)) && (z.do === undefined || liczba(z.do)) && (z.od === undefined || z.do === undefined || z.od <= z.do))))
      b.push(pelny ? 'zakres: {od, do, krok} z liczb, od mniejsze niż do; to zakres suwaka, nie granica' : 'twarde: {od, do} z liczb; to klamra, poza którą wartość jest odrzucana');
    else if (!['liczba', 'czas'].includes(c.typ)) b.push(`${n} ma sens tylko przy typie liczba albo czas`);
  };
  zakres('zakres', true);
  zakres('twarde', false);
  if (c.typ === 'wybor' && !(Array.isArray(c.wartosci) && c.wartosci.length >= 1 && c.wartosci.length <= 60 && c.wartosci.every((x) => typeof x === 'string' && x.length <= 80) && new Set(c.wartosci).size === c.wartosci.length))
    b.push('wartosci: przy typie wybor lista od 1 do 60 różnych napisów');
  if ('dotyczy' in c && c.dotyczy !== null && !(Array.isArray(c.dotyczy) && c.dotyczy.length >= 1 && c.dotyczy.length <= 12 && c.dotyczy.every((x) => typeof x === 'string' && ELEMENT.test(x))))
    b.push('dotyczy: lista od 1 do 12 nazw elementów twarzy (małe litery, cyfry, _ i -), np. ["karta", "kamera"]');
  if (!b.length) {
    if (!('domyslna' in c)) b.push('domyslna: wartość, którą pokrętło ma, dopóki nikt go nie ruszył');
    else {
      const cel = odwolanie(c, c.domyslna);
      if (cel !== null) {
        if (!NAZWA.test(cel)) b.push('domyslna: odwołanie to {"z": "<nazwa pokrętła>"}');
        else if (cel === c.nazwa) b.push('domyslna: pokrętło nie może iść za samym sobą');
        else if (c.twarde !== undefined && c.twarde !== null) b.push('domyslna: pokrętło, którego wartość domyślna idzie za innym, nie podaje własnej klamry (twarde); obowiązuje klamra pokrętła, za którym idzie');
      } else {
        const w = wadaWartosci(c, c.domyslna, () => null);
        if (w && c.typ !== 'zestawy') b.push('domyslna: ' + w);
        else if (c.typ === 'zestawy' && !(Array.isArray(c.domyslna) && c.domyslna.length === 0)) b.push('domyslna: przy typie zestawy pusta lista');
      }
    }
  }
  return b;
}

const deklaracja = (s, nazwa) => (typeof nazwa === 'string' && NAZWA.test(nazwa) ? s.spis({ rodzaj: 'pokretlo/1', gdzie: { nazwa }, limit: 1 })[0] || null : null);

// Sprawdzenie rzeczy, które środowisko rozumie jako ustawienia, przy zapisie. `widzi(id)`: rzecz oczami piszącego.
// Zwraca null albo { blad, bledy }.
export function sprawdzUstawienie(s, rodzaj, cechy, widzi, obszar = undefined) {
  const dekl = (nazwa) => { const d = deklaracja(s, nazwa); return d && widzi(d.id) ? d : null; };
  // Zaufanie odwołań (to samo liczy liczenie; tutaj po to, żeby zdanie padło już przy zapisie): ustawienie, które leży
  // tam, gdzie zmiana wymaga zgody, nie może iść za pokrętłem zadeklarowanym tam, gdzie uczestnicy zmieniają je sami.
  const prowadza = (r, o) => s._prawoWObszarze(r, o ?? null).tryb === 'skutek';
  const obce = (c, zrodlo) => zrodlo !== undefined && prowadza('pokretlo/1', c.obszar) && !prowadza(zrodlo.rodzaj, zrodlo.obszar);
  // wartość zwykła albo odwołanie do zadeklarowanego pokrętła tego samego typu
  const wada = (d, w, zrodlo = undefined) => {
    const cel = odwolanie(d, w);
    if (cel === null) {
      const zla = wadaWartosci(d, w, widzi);
      if (zla || d.typ !== 'kroj' || !w.plik) return zla;
      // Krój z pliku: plik musi istnieć dla piszącego i być krojem, a odcisk ma być jego odciskiem. Treść pliku jest
      // niezmienna, więc krój, który ktoś przyjął, nie zmieni się bez zmiany samej wartości.
      const f = widzi(w.plik.rzecz);
      if (!f || f.rodzaj !== 'plik/1' || f.odlozone) return `plik kroju: nie ma pliku ${w.plik.rzecz}`;
      if (!String(f.cechy.typ).startsWith('font/')) return `plik kroju ma typ ${f.cechy.typ}, a ma być krojem (font/woff2, font/woff, font/ttf albo font/otf)`;
      if (f.cechy.tresc !== w.plik.odcisk) return 'plik kroju: odcisk nie jest odciskiem tego pliku';
      return null;
    }
    if (!NAZWA.test(cel)) return 'odwołanie to {"z": "<nazwa pokrętła>"}';
    if (cel === d.nazwa) return 'odwołuje się do samego siebie';
    const c = dekl(cel);
    if (!c) return `odwołuje się do pokrętła ${cel}, którego nie ma`;
    if (c.cechy.typ !== d.typ) return `odwołuje się do pokrętła ${cel} typu ${c.cechy.typ}, a samo jest typu ${d.typ}`;
    if (obce(c, zrodlo)) return `odwołuje się do pokrętła ${cel}, które każdy uczestnik zmienia sam tam, gdzie leży; wartość, która obowiązuje tam, gdzie zmiana wymaga zgody, nie może od niego zależeć`;
    return null;
  };
  if (rodzaj === 'pokretlo/1') {
    const b = wadyDeklaracji(cechy);
    const cel = b.length ? null : odwolanie(cechy, cechy.domyslna);
    if (cel !== null) {
      const c = dekl(cel);
      if (!c) b.push(`domyslna: odwołuje się do pokrętła ${cel}, którego nie ma`);
      else if (c.cechy.typ !== cechy.typ) b.push(`domyslna: odwołuje się do pokrętła ${cel} typu ${c.cechy.typ}, a samo jest typu ${cechy.typ}`);
      else if (cechy.typ === 'wybor' && JSON.stringify(c.cechy.wartosci) !== JSON.stringify(cechy.wartosci)) b.push('domyslna: pokrętło typu wybor może iść tylko za pokrętłem o tej samej liście wartości');
      else if (obce(c, obszar === undefined ? undefined : { rodzaj: 'pokretlo/1', obszar })) b.push(`domyslna: odwołuje się do pokrętła ${cel}, które każdy uczestnik zmienia sam tam, gdzie leży; wartość, która obowiązuje tam, gdzie zmiana wymaga zgody, nie może od niego zależeć`);
      else {
        // łańcuch wartości domyślnych musi mieć koniec: nie wraca do tego pokrętła i nie jest dłuższy niż dozwolony
        let n = cel, kroki = 0;
        while (n !== null) {
          if (n === cechy.nazwa) { b.push(`domyslna: odwołania wartości domyślnych zamykają koło (${cechy.nazwa} wraca do siebie przez ${cel})`); break; }
          if (++kroki > NAJGLEBIEJ_ODWOLAN) { b.push(`domyslna: łańcuch odwołań jest dłuższy niż ${NAJGLEBIEJ_ODWOLAN}`); break; }
          const t = dekl(n);
          n = t ? odwolanie(t.cechy, t.cechy.domyslna) : null;
        }
      }
    }
    if (!b.length && !deklaracja(s, cechy.nazwa) && s.ile({ rodzaj: 'pokretlo/1' }) >= NAJWIECEJ_POKRETEL)
      b.push(`w Miejscu jest już ${NAJWIECEJ_POKRETEL} pokręteł: to granica, która chroni wspólny limit bazy, a nie strojenie; odłóż nieużywane albo zbierz kilka wartości w jedno pokrętło typu dowolne`);
    return b.length ? { blad: 'deklaracja pokrętła nie przeszła sprawdzenia: ' + b.join('; '), bledy: b } : null;
  }
  if (rodzaj === 'wartosc/1') {
    const d = dekl(cechy.pokretlo);
    if (!d) return { blad: `nie ma pokrętła o nazwie ${JSON.stringify(cechy.pokretlo)}; zadeklarowane pokrętła: /ustawienia` };
    // Zasięgiem jest rzecz, której wygląd albo odczucie się stroi, a nie samo ustawienie: wartość przypięta do wartości
    // nie ma sensu, a pozwalała budować dowolnie długie łańcuchy rzeczy leżących "z natury" jedna z drugą.
    const z = typeof cechy.zasieg === 'string' ? widzi(cechy.zasieg) : null;
    if (z && ['wartosc', 'pokretlo', 'zestaw', 'propozycja'].includes(String(z.rodzaj).split('/')[0])) return { blad: `zasięgiem wartości nie może być rzecz rodzaju ${z.rodzaj}; zasięg to rzecz, którą się stroi: obszar, widok, okno, uczestnik, profil` };
    // wartość leży tam, gdzie jej zasięg: w obszarze, gdy zasięgiem jest obszar; inaczej tam, gdzie leży rzecz zasięgu
    const lezy = z ? { rodzaj: 'wartosc/1', obszar: z.rodzaj === 'obszar/1' ? (z.id === s.r.meta('obszar_glowny') ? null : z.id) : (z.obszar ?? null) } : undefined;
    const w = wada(d.cechy, cechy.wartosc, lezy);
    return w ? { blad: `wartość pokrętła ${cechy.pokretlo} (typ ${d.cechy.typ}) ${w}` } : null;
  }
  if (rodzaj === 'zestaw/1') {
    if (!obiekt(cechy.wartosci) || Object.keys(cechy.wartosci).length > 400) return { blad: 'wartosci: obiekt {nazwa pokrętła: wartość}, najwyżej 400 pozycji' };
    const b = [];
    for (const [n, w] of Object.entries(cechy.wartosci)) {
      if (n === POKRETLO_ZESTAWOW) { b.push(`${n}: zestaw nie włącza innych zestawów`); continue; }
      const d = dekl(n);
      if (!d) { b.push(`${n}: nie ma takiego pokrętła`); continue; }
      const zle = wada(d.cechy, w);
      if (zle) b.push(`${n} (typ ${d.cechy.typ}) ${zle}`);
    }
    return b.length ? { blad: 'zestaw nie przeszedł sprawdzenia: ' + b.slice(0, 12).join('; ') + (b.length > 12 ? `; i ${b.length - 12} dalszych` : ''), bledy: b } : null;
  }
  return null;
}

// Zasięgi od najbliższego: nakładki, rzecz `dla`, obszar, w którym leży, obszary w górę, na końcu obszar główny (Miejsce).
export function lancuchZasiegow(w, dla = null, nakladki = []) {
  const lancuch = [];
  const dodaj = (rz) => { if (rz && !lancuch.some((x) => x.id === rz.id)) lancuch.push({ id: rz.id, rodzaj: rz.rodzaj, nazwa: w.tytul(rz) }); };
  for (const id of nakladki) dodaj(w.rzecz(id));
  const start = dla ? w.rzecz(dla) : null;
  if (dla && !start) return null;
  if (start) {
    dodaj(start);
    let ob = start.obszar, kroki = 0;
    while (ob && kroki++ < 64) { const o = w.rzecz(ob); if (!o) break; dodaj(o); ob = o.obszar; }
  }
  const glowny = w.r.meta('obszar_glowny');
  if (glowny) dodaj(w.rzecz(glowny));
  return lancuch;
}

// Zestawy włączone w każdym zasięgu: tylko wartość wprost w tym zasięgu; kolejność od ostatniego na liście (ten wygrywa).
function zestawyWZasiegach(w, lancuch, wart) {
  const m = new Map();
  for (const z of lancuch) {
    const x = wart.get(POKRETLO_ZESTAWOW + '|' + z.id);
    const lista = [];
    if (x && Array.isArray(x.cechy.wartosc)) for (const id of x.cechy.wartosc) { const rz = typeof id === 'string' ? w.rzecz(id) : null; if (rz && rz.rodzaj === 'zestaw/1' && !rz.odlozone && obiekt(rz.cechy.wartosci)) lista.push(rz); }
    m.set(z.id, lista.reverse());
  }
  return m;
}

// Wartości wszystkich pokręteł dla zasięgu, policzone oczami czytającego (`w` to widok z srodowisko.dla albo samo
// środowisko). Jedno żądanie daje twarzy wszystko, czego potrzebuje do narysowania się.
// `zrodlo`: deklaracje, wartości i zestawy już wybrane po nazwach (policzUstawieniaDlaNazw); bez niego wszystko, co leży
// w Miejscu.
export function policzUstawienia(w, { dla = null, nakladki = [], deklaracje = false, zrodlo = null } = {}) {
  if (dla !== null && !(typeof dla === 'string' && ID.test(dla))) return { ok: false, status: 400, blad: 'dla: identyfikator rzeczy, dla której liczyć ustawienia (26 znaków); bez niego liczy się dla całego Miejsca' };
  const nakl = (Array.isArray(nakladki) ? nakladki : []).filter((x) => typeof x === 'string' && ID.test(x)).slice(0, 4);
  const lancuch = zrodlo ? zrodlo.lancuch : lancuchZasiegow(w, dla, nakl);
  if (lancuch === null) return { ok: false, status: 404, blad: `nie ma rzeczy ${dla}` };
  const dekl = zrodlo ? zrodlo.dekl : w.pamietaj('ustawienia:deklaracje', () => { const m = new Map(); for (const d of w.wszystkie({ rodzaj: 'pokretlo/1' })) if (typeof d.cechy.nazwa === 'string' && !m.has(d.cechy.nazwa)) m.set(d.cechy.nazwa, d); return m; });
  // Wartości tylko z zasięgów na drodze: każdy zasięg wie, które wartości go wskazują (spis odniesień). Czytanie wszystkich
  // wartości Miejsca rosło z tym, co ktokolwiek ustawił w cudzych widokach i profilach, a ich liczba nie ma granicy
  // (niezależny atak, 18 XI 2026).
  const wart = zrodlo ? zrodlo.wart : new Map(lancuch.flatMap((z) => w.pamietaj('ustawienia:wartosci:' + z.id, () => w._wartosciZasiegu(z.id).map((id) => w.rzecz(id)).filter((x) => x && x.rodzaj === 'wartosc/1' && !x.odlozone)).map((x) => [x.cechy.pokretlo + '|' + z.id, x])));
  const zestawyW = zrodlo && zrodlo.zestawy ? zrodlo.zestawy : (dekl.has(POKRETLO_ZESTAWOW) ? zestawyWZasiegach(w, lancuch, wart) : new Map(lancuch.map((z) => [z.id, []])));
  const pominiete = [];
  const maRzecz = (id) => w.rzecz(id);

  // Zaufanie odwołań: ustawienie, które obowiązuje tam, gdzie zmiana wymaga zgody, nie idzie za pokrętłem zadeklarowanym
  // tam, gdzie uczestnicy zmieniają je sami. Inaczej ten, kto prowadzi w jednym obszarze, zmieniałby wartością domyślną
  // swojego pokrętła wygląd zasięgu, w którym może tylko proponować (ta sama rodzina co zestaw z ataku 17 XI). Źródłem
  // wartości z zestawu jest wartość, która go włącza: to ona mówi, w jakim zasięgu zestaw obowiązuje.
  const prowadzaPamiec = new Map();
  const prowadza = (rodzaj, obszar) => { const k = rodzaj + '|' + (obszar ?? ''); if (!prowadzaPamiec.has(k)) prowadzaPamiec.set(k, w._prawoWObszarze(rodzaj, obszar ?? null).tryb === 'skutek'); return prowadzaPamiec.get(k); };
  const wolnoIscZa = (zrodlo, cel) => { const c = dekl.get(cel); return !c || !(prowadza('pokretlo/1', c.obszar) && !prowadza(zrodlo.rodzaj, zrodlo.obszar)); };
  const OBCE = 'które każdy uczestnik zmienia sam tam, gdzie leży, a to ustawienie obowiązuje tam, gdzie zmiana wymaga zgody';
  // Kandydat przechodzi, gdy jest wartością zgodną z deklaracją albo odwołaniem do zadeklarowanego pokrętła tego samego typu.
  const wadaKandydata = (d, wartosc, zrodlo) => {
    const cel = odwolanie(d.cechy, wartosc);
    if (cel === null) return wadaWartosci(d.cechy, wartosc, maRzecz);
    const c = dekl.get(cel);
    if (!c) return `odwołuje się do pokrętła ${cel}, którego tu nie ma`;
    if (c.cechy.typ !== d.cechy.typ) return `odwołuje się do pokrętła ${cel} typu ${c.cechy.typ}, a samo jest typu ${d.cechy.typ}`;
    if (!wolnoIscZa(zrodlo, cel)) return `odwołuje się do pokrętła ${cel}, ${OBCE}`;
    return null;
  };
  // Pierwsze, co mówi o pokrętle droga zasięgów (wartość wprost, potem zestawy zasięgu, potem zasięg wyżej); null: nic.
  const surowe = new Map();
  const surowy = (nazwa) => {
    if (surowe.has(nazwa)) return surowe.get(nazwa);
    const d = dekl.get(nazwa);
    let wynik = null;
    for (const z of lancuch) {
      const x = wart.get(nazwa + '|' + z.id);
      if (x) {
        const wada = wadaKandydata(d, x.cechy.wartosc, { rodzaj: 'wartosc/1', obszar: x.obszar });
        if (!wada) { wynik = { surowa: x.cechy.wartosc, skad: 'wartosc', zasieg: z.id, rzecz: x.id, wersja: x.wersja }; break; }
        pominiete.push({ pokretlo: nazwa, rzecz: x.id, dlaczego: wada });
      }
      if (nazwa === POKRETLO_ZESTAWOW) continue; // lista zestawów nie dziedziczy się: każdy zasięg włącza swoje
      for (const zs of zestawyW.get(z.id) || []) {
        if (!Object.hasOwn(zs.cechy.wartosci, nazwa)) continue;
        const wada = wadaKandydata(d, zs.cechy.wartosci[nazwa], { rodzaj: 'wartosc/1', obszar: (wart.get(POKRETLO_ZESTAWOW + '|' + z.id) || {}).obszar });
        if (!wada) { wynik = { surowa: zs.cechy.wartosci[nazwa], skad: 'zestaw', zasieg: z.id, rzecz: zs.id, zestaw: w.tytul(zs) }; break; }
        pominiete.push({ pokretlo: nazwa, rzecz: zs.id, dlaczego: wada });
      }
      if (wynik) break;
    }
    surowe.set(nazwa, wynik);
    return wynik;
  };
  // Koniec każdego powrotu: wartość domyślna po samych wartościach domyślnych (zapis pilnuje, żeby ten łańcuch miał koniec).
  const domyslnaKoncowa = (nazwa, glebia = 0) => {
    const d = dekl.get(nazwa);
    if (!d || glebia > NAJGLEBIEJ_ODWOLAN) return undefined;
    const cel = odwolanie(d.cechy, d.cechy.domyslna);
    if (cel === null) return d.cechy.domyslna;
    return wolnoIscZa({ rodzaj: 'pokretlo/1', obszar: d.obszar }, cel) ? domyslnaKoncowa(cel, glebia + 1) : undefined;
  };
  const koncowe = new Map();
  const policz = (nazwa, droga) => {
    if (koncowe.has(nazwa)) return koncowe.get(nazwa);
    const d = dekl.get(nazwa);
    if (!d) return undefined;
    const s = surowy(nazwa) || { surowa: d.cechy.domyslna, skad: 'domyslna' };
    const { surowa, ...skad } = s;
    const cel = odwolanie(d.cechy, surowa);
    let wynik;
    if (cel === null) wynik = { wartosc: surowa, ...skad };
    else {
      let wartosc, powod = null;
      if (cel === nazwa || droga.includes(cel) || droga.length >= NAJGLEBIEJ_ODWOLAN) powod = `odwołania tworzą koło albo łańcuch dłuższy niż ${NAJGLEBIEJ_ODWOLAN} (przez ${cel})`;
      else if (skad.skad === 'domyslna' && !wolnoIscZa({ rodzaj: 'pokretlo/1', obszar: d.obszar }, cel)) powod = `wartość domyślna idzie za pokrętłem ${cel}, ${OBCE}`;
      else {
        const c = policz(cel, [...droga, nazwa]);
        if (!c || c.wartosc === undefined || c.wartosc === null) powod = `pokrętło ${cel}, za którym idzie, nie ma wartości`;
        else { const wada = wadaWartosci(d.cechy, c.wartosc, maRzecz); if (wada) powod = `wartość pokrętła ${cel}, za którym idzie, ${wada}`; else wartosc = c.wartosc; }
      }
      if (powod === null) wynik = { wartosc, ...skad, z: cel };
      else {
        pominiete.push({ pokretlo: nazwa, ...(skad.rzecz ? { rzecz: skad.rzecz } : {}), dlaczego: powod });
        const dom = domyslnaKoncowa(nazwa);
        wynik = dom === undefined ? { wartosc: null, skad: 'brak' } : { wartosc: dom, skad: 'domyslna' };
      }
    }
    koncowe.set(nazwa, wynik);
    return wynik;
  };
  const wartosci = {};
  for (const nazwa of dekl.keys()) wartosci[nazwa] = policz(nazwa, []);

  // Zestaw, który ustawia tylko jedną z palet, miesza się w drugim trybie z wartościami spoza siebie: mówimy to zdaniem.
  const uwagi = [], widziane = new Set();
  for (const z of lancuch) for (const zs of zestawyW.get(z.id) || []) {
    if (widziane.has(zs.id)) continue;
    widziane.add(zs.id);
    const n = Object.keys(zs.cechy.wartosci);
    const jasna = n.some((x) => x.startsWith(PALETA.jasna)), ciemna = n.some((x) => x.startsWith(PALETA.ciemna));
    if (jasna !== ciemna) uwagi.push(`Zestaw "${w.tytul(zs)}" ustawia tylko paletę ${ciemna ? 'ciemną' : 'jasną'}: w trybie ${ciemna ? 'jasnym' : 'ciemnym'} obowiązują barwy spoza niego (inne zestawy, zasięg wyżej, wartości domyślne).`);
  }
  return { ok: true, format: FORMAT_USTAWIEN, akt: w.ostatniNr(), dla, nakladki: nakl, lancuch, wartosci, ...(pominiete.length ? { pominiete } : {}), ...(uwagi.length ? { uwagi } : {}),
    ...(deklaracje ? { deklaracje: [...dekl.values()].map((d) => ({ ...d.cechy, rzecz: d.id, wersja: d.wersja })).sort((a, b) => String(a.grupa || '').localeCompare(String(b.grupa || '')) || a.nazwa.localeCompare(b.nazwa)) } : {}) };
}

// Liczenie dla twarzy: tylko pokrętła o podanych nazwach. Deklaracje i wartości czyta po tożsamości z klucza (nazwa;
// nazwa i zasięg), więc koszt zależy od liczby nazw i długości drogi zasięgów, a nie od tego, ile pokręteł i wartości
// leży w całym Miejscu. Liczenie wszystkiego czytało każdą deklarację i każdą wartość, także z cudzych profili, przy
// każdej zmianie ustawień i w każdej otwartej twarzy: kto dokładał pokrętła tam, gdzie prowadzi, podnosił koszt wszystkim
// (niezależny atak, 17 XI 2026; limit wierszy jest wspólny dla całego konta).
// Pokrętła, za którymi idą wartości pochodne, dociąga samo (najwyżej tyle obiegów, ile wynosi głębokość odwołań).
export async function policzUstawieniaDlaNazw(w, { dla = null, nakladki = [], nazwy = [], deklaracje = false } = {}) {
  if (dla !== null && !(typeof dla === 'string' && ID.test(dla))) return policzUstawienia(w, { dla });
  const lista = [...new Set((Array.isArray(nazwy) ? nazwy : []).filter((n) => typeof n === 'string' && NAZWA.test(n)))];
  if (lista.length > NAJWIECEJ_NAZW) return { ok: false, status: 400, blad: `nazwy: najwyżej ${NAJWIECEJ_NAZW} nazw pokręteł w jednym pytaniu` };
  const nakl = (Array.isArray(nakladki) ? nakladki : []).filter((x) => typeof x === 'string' && ID.test(x)).slice(0, 4);
  const lancuch = lancuchZasiegow(w, dla, nakl);
  if (lancuch === null) return { ok: false, status: 404, blad: `nie ma rzeczy ${dla}` };
  const kP = w.ksztaltDla('pokretlo/1'), kW = w.ksztaltDla('wartosc/1');
  const dekl = new Map(), wart = new Map(), brak = new Set();
  const wez = async (n) => {
    if (dekl.has(n) || brak.has(n)) return;
    const d = w.rzecz(await w._idZKlucza('pokretlo/1', kP, { nazwa: n }));
    if (!d || d.rodzaj !== 'pokretlo/1' || d.odlozone || d.cechy.nazwa !== n) { brak.add(n); return; }
    dekl.set(n, d);
    for (const z of lancuch) {
      const x = w.rzecz(await w._idZKlucza('wartosc/1', kW, { pokretlo: n, zasieg: z.id }));
      if (x && x.rodzaj === 'wartosc/1' && !x.odlozone) wart.set(n + '|' + z.id, x);
    }
  };
  await wez(POKRETLO_ZESTAWOW);
  const zestawy = zestawyWZasiegach(w, lancuch, wart);
  let kolejka = lista;
  const wziete = new Set([POKRETLO_ZESTAWOW]);
  for (let obieg = 0; kolejka.length && obieg <= NAJGLEBIEJ_ODWOLAN; obieg++) {
    const nastepne = [];
    for (const n of kolejka) {
      if (wziete.has(n) && n !== POKRETLO_ZESTAWOW) continue;
      // dociąganie celów odwołań ma granicę zależną od tego, o ile nazw pyta twarz, a nie od tego, jak długie łańcuchy
      // ktoś ułożył w zasięgu, w którym stroi sam; odwołanie, do którego celu nie dociągnęliśmy, jest pomijane jak zepsute
      if (wziete.size >= Math.min(NAJWIECEJ_NAZW * 2, lista.length * 2 + 8)) break;
      wziete.add(n);
      await wez(n);
      const d = dekl.get(n);
      if (!d) continue;
      const cele = [odwolanie(d.cechy, d.cechy.domyslna)];
      for (const z of lancuch) {
        const x = wart.get(n + '|' + z.id);
        if (x) cele.push(odwolanie(d.cechy, x.cechy.wartosc));
        for (const zs of zestawy.get(z.id) || []) if (Object.hasOwn(zs.cechy.wartosci, n)) cele.push(odwolanie(d.cechy, zs.cechy.wartosci[n]));
      }
      for (const c of cele) if (typeof c === 'string' && NAZWA.test(c) && !wziete.has(c)) nastepne.push(c);
    }
    kolejka = nastepne;
  }
  const u = policzUstawienia(w, { dla, nakladki: nakl, deklaracje, zrodlo: { dekl, wart, lancuch, zestawy } });
  if (u.ok) {
    const pytane = new Set(lista);
    u.wartosci = Object.fromEntries(Object.entries(u.wartosci).filter(([n]) => pytane.has(n)));
    // Deklaracje tylko pytanych pokręteł (suwaki świata obok jego okna potrzebują typu, zakresu i grupy tego, co świat
    // czyta), bez pokręteł dociągniętych po drodze: zestawów i celów odwołań.
    if (u.deklaracje) u.deklaracje = u.deklaracje.filter((d) => pytane.has(d.nazwa));
  }
  return u;
}

const pokaz = (x) => { const t = JSON.stringify(x); return t.length > 90 ? t.slice(0, 89) + '…' : t; };

// To samo tekstem, dla ciała, które umie tylko czytać.
export function stronaUstawien(w, { dla = null, origin = '' } = {}) {
  const u = policzUstawienia(w, { dla, deklaracje: true });
  if (!u.ok) return u.blad + '\n';
  const glowny = w.r.meta('obszar_glowny');
  const wiersze = [
    'USTAWIENIA: wszystko, co da się tu stroić, i jaką ma teraz wartość',
    `Policzone dla: ${dla ? 'rzeczy ' + dla : 'całego Miejsca'}; zasięgi od najbliższego: ${u.lancuch.map((z) => `${z.nazwa} [${z.rodzaj}]`).join(' -> ') || 'brak'}.`,
    'Pokrętło to deklaracja (rzecz rodzaju pokretlo/1). Wartość to rzecz rodzaju wartosc/1 w zasięgu, którym jest dowolna rzecz;',
    'bez podanego zasięgu wartość dotyczy całego Miejsca. Zestaw (zestaw/1) to nazwany komplet wartości: motyw albo preset.',
    'Kolejność: wartość wprost w zasięgu, potem zestawy włączone w tym zasięgu (późniejszy na liście wygrywa), potem zasięg wyżej, na końcu wartość domyślna.',
    'Nakładka (profil urządzenia albo sposobu pracy) jest najbliższym zasięgiem: wygrywa z rzeczą, widokiem i obszarami.',
    'Wartość pochodna: zamiast wartości może stać {"z": "<nazwa pokrętła>"}, czyli "to, co ma tamto pokrętło" (ten sam typ; nie dla typów zestawy i dowolne).',
    'Nazwy: pierwszy człon mówi, czym to jest dla człowieka (wyglad, odczucie, srodowisko albo nazwa narzędzia), a nie która twarz to rysuje; jednostka stoi w deklaracji, nie w nazwie.',
    '',
  ];
  if (u.uwagi) wiersze.push('UWAGI', ...u.uwagi.map((x) => '  ' + x), '');
  let grupa = null;
  for (const d of u.deklaracje) {
    if ((d.grupa || 'Inne') !== grupa) { grupa = d.grupa || 'Inne'; wiersze.push(grupa.toUpperCase()); }
    const x = u.wartosci[d.nazwa];
    const skad = x.skad === 'domyslna' ? 'domyślna' : x.skad === 'zestaw' ? `z zestawu "${x.zestaw}"` : x.skad === 'brak' ? 'brak wartości' : `ustawiona wprost (rzecz ${x.rzecz})`;
    wiersze.push(`  ${d.nazwa} = ${pokaz(x.wartosc)}   [${d.typ}${d.jednostka ? ', ' + d.jednostka : ''}; ${skad}${x.z ? '; idzie za ' + x.z : ''}]`);
    wiersze.push(`      ${d.opis}${d.zakres ? ` Zakres suwaka: ${d.zakres.od} do ${d.zakres.do}.` : ''}${d.typ === 'wybor' ? ` Wartości: ${d.wartosci.join(', ')}.` : ''}${Array.isArray(d.dotyczy) ? ` Dotyczy: ${d.dotyczy.join(', ')}.` : ''}`);
  }
  if (u.pominiete) wiersze.push('', 'POMINIĘTE (wartość nie przechodzi dzisiejszej deklaracji albo jej odwołanie nie ma dokąd iść, więc nie dochodzi do twarzy):', ...u.pominiete.map((p) => `  ${p.pokretlo}: ${p.dlaczego}${p.rzecz ? ' -> /rzecz/' + p.rzecz : ''}`));
  wiersze.push('',
    'JAK ZMIENIĆ (ten sam ruch co każdy inny; skutek albo propozycja zależy od obszaru, w którym leży zasięg):',
    `  POST ${origin}/api/srodowisko/ruch`,
    `  {"op":"<Twój identyfikator czynności>","co":"poloz","rodzaj":"wartosc/1","cechy":{"pokretlo":"wyglad.paleta.jasna.akcent","wartosc":"#336699"}}`,
    `  Zasięg inny niż całe Miejsce: dopisz "zasieg":"<id rzeczy>" (całe Miejsce to obszar główny${glowny ? ', id ' + glowny : ''}). Zmiana istniejącej wartości: ten sam ruch z "wersja" z odczytu albo "dowolna".`,
    '  Powrót do wartości odziedziczonej: co: odloz na rzeczy wartości. Poprzednia wartość: co: cofnij. Historia: /rzecz/<id wartości>.',
    '  Nowe pokrętło: rzecz rodzaju pokretlo/1 (nazwa, typ, domyslna, opis; kształt: /rodzaj/pokretlo/1). Nowa rola palety: wyglad.paleta.jasna.<rola> i wyglad.paleta.ciemna.<rola>,',
    '  najlepiej z wartością domyślną przez odwołanie do barwy bazowej (np. {"z":"wyglad.paleta.jasna.akcent"}): wtedy idzie za każdym motywem.',
    '  Zestaw: rzecz rodzaju zestaw/1 z cechą wartosci {nazwa pokrętła: wartość}; włączenie w zasięgu: wartość pokrętła srodowisko.zestawy = [id zestawu, …].',
    '  Propozycja włączenia zestawów pamięta ich wersje: gdy zestaw zmieni się przed przyjęciem, przyjęcie odmawia i mówi, co się zmieniło.',
    `Jako dane: ${origin}/api/srodowisko/ustawienia?dla=<id rzeczy>&deklaracje=tak   Tylko wybrane pokrętła (tanio, dla twarzy): ?nazwy=a,b,c   Typy wartości:`,
    ...Object.entries(TYPY_POKRETEL).map(([t, o]) => `  ${t}: ${o}`),
    '');
  return wiersze.join('\n');
}
