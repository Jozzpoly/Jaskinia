// Zasiew środowiska: rzeczy, bez których Miejsce nie umie opisać samego siebie (17 XI 2026). Status: próba.
// To są DANE, nie kod: po zasianiu każdą z tych rzeczy zmienia się ruchem, a zasiew jej nie nadpisze.
// Kolejność ma znaczenie: najpierw kształt kształtu, potem kształty, potem rzeczy tych rodzajów.
import { STOPNIE, UWAGI, WIDZI, UKLADA, szybkiOdcisk } from './srodowisko.mjs';

const k = (nazwa, cechy) => ({ nazwa: 'ksztalt-' + nazwa, rodzaj: 'ksztalt/1', cechy });
const zd = (nazwa, stan, opis, jak) => ({ nazwa: 'zdolnosc-' + nazwa, rodzaj: 'zdolnosc/1', cechy: { nazwa: opis.split(':')[0], stan, opis: opis.split(':').slice(1).join(':').trim(), ...(jak ? { jak } : {}) } });

// Przykładowy gość: jedna strona HTML, która rozmawia z gospodarzem umową okna (pokolenie 2).
export const GOSC_LISTA = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lista rzeczy</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 12px 14px; font: 15px/1.45 system-ui, sans-serif; }
  h1 { font-size: 1.05rem; margin: 0 0 2px; }
  #stan { margin: 0 0 10px; opacity: .7; font-size: .9rem; }
  h2 { font-size: .8rem; letter-spacing: .04em; text-transform: uppercase; opacity: .6; margin: 14px 0 4px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 5px 0; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
  small { opacity: .6; }
</style>
</head>
<body>
<h1>Lista rzeczy</h1>
<p id="stan">Czekam na gospodarza…</p>
<div id="lista"></div>
<script>
// Gość Jaskini: przykład umowy okna, pokolenie 2. Pełny opis umowy: adres /umowa-okna.
// Cała rozmowa idzie przez postMessage z oknem, które tę stronę otworzyło. Gość nie ma sieci ani pamięci.
const gospodarz = window.parent;
let nr = 0;
const czekaja = new Map();
const powiedz = (m) => gospodarz.postMessage({ jaskinia: 1, ...m }, '*');
function czytaj(what, wiecej) {
  return new Promise((tak, nie) => {
    const id = ++nr;
    czekaja.set(id, { tak, nie });
    powiedz({ type: 'read', id, what, ...wiecej });
    setTimeout(() => { if (czekaja.delete(id)) nie(new Error('gospodarz nie odpowiedział')); }, 8000);
  });
}
addEventListener('message', (e) => {
  const m = e.data;
  if (e.source !== gospodarz || !m || m.jaskinia !== 1) return;
  if (m.type === 'hi') { powiedz({ type: 'hello', name: 'Lista rzeczy', version: '1', wants: ['rzeczy'] }); pokaz(); }
  else if (m.type === 'result') { const c = czekaja.get(m.id); if (c) { czekaja.delete(m.id); if (m.ok) c.tak(m.data); else c.nie(new Error(m.error)); } }
  else if (m.type === 'changed') pokaz();
});
async function pokaz() {
  const stan = document.getElementById('stan');
  try {
    const d = await czytaj('spis', {});
    const grupy = new Map();
    for (const r of d.rzeczy) { if (!grupy.has(r.rodzaj)) grupy.set(r.rodzaj, []); grupy.get(r.rodzaj).push(r); }
    const lista = document.getElementById('lista');
    lista.textContent = '';
    for (const [rodzaj, rzeczy] of [...grupy].sort((a, b) => a[0].localeCompare(b[0]))) {
      const h = document.createElement('h2'); h.textContent = rodzaj + ' (' + rzeczy.length + ')'; lista.append(h);
      const ul = document.createElement('ul');
      for (const r of rzeczy) { const li = document.createElement('li'); li.textContent = r.tytul + ' '; const s = document.createElement('small'); s.textContent = r.id.slice(0, 6); li.append(s); ul.append(li); }
      lista.append(ul);
    }
    stan.textContent = d.rzeczy.length + ' rzeczy, ' + grupy.size + ' rodzajów';
    powiedz({ type: 'state', text: d.rzeczy.length + ' rzeczy na liście' });
  } catch (err) { stan.textContent = 'Nie udało się: ' + err.message; }
}
powiedz({ type: 'hello', name: 'Lista rzeczy', version: '1', wants: ['rzeczy'] });
</script>
</body>
</html>
`;

export function ziarna({ wlasciciel }) {
  return [
    k('ksztalt', { dla: 'ksztalt/1', tytul: 'dla', opis: 'Kształt: opis rodzaju rzeczy, czyli jakie cechy ma rzecz tego rodzaju. Sam jest rzeczą, więc nowy rodzaj dokłada się ruchem, bez zmiany kodu.',
      cechy: {
        dla: { typ: 'tekst', wymagana: true, opis: 'rodzaj z pokoleniem, który ten kształt opisuje, np. postac/1' },
        opis: { typ: 'tekst', wymagana: true, opis: 'jedno zdanie: czym jest rzecz tego rodzaju' },
        cechy: { typ: 'dowolne', wymagana: true, opis: 'obiekt {nazwa cechy: {typ, opis, wymagana}}; może być pusty' },
        tytul: { typ: 'tekst', opis: 'nazwa cechy, która jest nazwą rzeczy; domyślnie cecha nazwa' },
        klucz: { typ: 'lista', z: 'tekst', opis: 'nazwy cech, z których liczy się tożsamość rzeczy: druga rzecz o tym samym kluczu nie powstanie' },
        uklad: { typ: 'tak-nie', opis: 'true, gdy rzeczy tego rodzaju są układaniem, a nie treścią; ustala to tylko właściciel' },
      } }),
    k('obszar', { dla: 'obszar/1', tytul: 'nazwa', opis: 'Obszar: miejsce z własnymi ustawieniami. Rzecz leży w jednym obszarze, obszar może leżeć w obszarze. Pole na Starcie to obszar z wyglądem.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst' },
        ile_wolno: { typ: 'wybor', wartosci: STOPNIE, opis: 'ile wolno tu agentom: nic, proponować, porządkować (tylko układ), prowadzić samodzielnie' },
        uwaga: { typ: 'wybor', wartosci: UWAGI, opis: 'ile uwagi właściciela: cisza, skrót co jakiś czas, znak, budzi' },
        widzi: { typ: 'wybor', wartosci: WIDZI, opis: 'kto widzi: właściciel, uczestnicy z kluczem, wszyscy' },
        uklada: { typ: 'wybor', wartosci: UKLADA, opis: 'kto układa rzeczy: ręka właściciela, reguła, agent' },
      } }),
    k('uczestnik', { dla: 'uczestnik/1', tytul: 'imie', opis: 'Uczestnik: ktoś, kto robi ruchy. Imię jest tym samym, pod którym właściciel ustawił jego klucz.',
      cechy: {
        imie: { typ: 'tekst', wymagana: true },
        rola: { typ: 'wybor', wartosci: ['wlasciciel', 'agent', 'automat'], wymagana: true },
        cialo: { typ: 'tekst', opis: 'czym ten uczestnik zwykle działa (jego własny opis, nie dowód)' },
        opis: { typ: 'tekst' },
      } }),
    k('propozycja', { dla: 'propozycja/1', tytul: 'rodzaj', opis: 'Propozycja: ruch uczestnika, który nie ma prawa do skutku. Leży tam, gdzie rzecz, której dotyczy, i czeka, aż ktoś z prawem ją przyjmie albo odrzuci.',
      cechy: {
        od: { typ: 'tekst', wymagana: true, opis: 'kto proponuje' },
        co: { typ: 'wybor', wartosci: ['poloz', 'odloz', 'przywroc', 'cofnij'], wymagana: true },
        rodzaj: { typ: 'tekst', wymagana: true, opis: 'rodzaj rzeczy, której dotyczy ruch' },
        tresc: { typ: 'dowolne', wymagana: true, opis: '{obszar, cechy}: to, co ruch chciał zapisać' },
        rzecz: { typ: 'rzecz', opis: 'zmieniana rzecz; brak, gdy propozycja dokłada nową' },
        nowa: { typ: 'tekst', opis: 'identyfikator, który dostanie nowa rzecz po przyjęciu' },
        wersja: { typ: 'liczba', opis: 'wersja zmienianej rzeczy z chwili propozycji' },
        wymaga: { typ: 'wybor', wartosci: ['wlasciciel'], opis: 'gdy ruch dotyczy czegoś, co zmienia tylko właściciel: przyjąć może tylko on' },
        stan: { typ: 'wybor', wartosci: ['czeka', 'przyjeta', 'odrzucona', 'wycofana', 'wygasla'], wymagana: true },
        powod: { typ: 'tekst' },
        rozstrzygnal: { typ: 'tekst' },
        rozstrzygnieto: { typ: 'czas' },
        wynik: { typ: 'rzecz', opis: 'rzecz, która powstała albo zmieniła się po przyjęciu' },
      } }),
    k('prosba', { dla: 'prosba/1', tytul: 'tresc', opis: 'Prośba do właściciela: coś, co czeka na jego słowo albo decyzję.',
      cechy: {
        tresc: { typ: 'tekst', wymagana: true },
        dotyczy: { typ: 'lista', z: 'rzecz', opis: 'rzeczy, których prośba dotyczy' },
        tryb: { typ: 'wybor', wartosci: ['czeka', 'budzi'], opis: 'czeka: może poczekać; budzi: potrzebna szybko' },
        stan: { typ: 'wybor', wartosci: ['czeka', 'zalatwiona'], wymagana: true },
        odpowiedz: { typ: 'tekst' },
      } }),
    k('slowo', { dla: 'slowo/1', tytul: 'tresc', opis: 'Słowo przy rzeczy: uwaga albo odpowiedź zostawiona przy jednej albo kilku rzeczach.',
      cechy: {
        tresc: { typ: 'tekst', wymagana: true },
        dotyczy: { typ: 'lista', z: 'rzecz', wymagana: true },
        odpowiada_na: { typ: 'rzecz', rodzaj: 'slowo' },
      } }),
    k('gosc', { dla: 'gosc/1', tytul: 'nazwa', opis: 'Gość: organ albo narzędzie. Kod żyje poza jądrem: jako zapis podawany w piaskownicy (cecha kod) albo pod własnym adresem (cecha adres).',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst', wymagana: true, opis: 'co ten gość pokazuje albo robi' },
        kod: { typ: 'zapis', rodzaj: 'kod/1', opis: 'zapis rodzaju kod/1 z jednym plikiem HTML; powstaje przez POST /api/srodowisko/kod' },
        adres: { typ: 'adres', opis: 'adres strony, która żyje poza Jaskinią (np. gra)' },
        umowa: { typ: 'tekst', opis: 'pokolenie umowy okna, którym gość mówi, np. okno/2' },
        czasowniki: { typ: 'dowolne', opis: 'lista {nazwa, opis, wejscie, wynik}: co ten gość umie zrobić na prośbę' },
      } }),
    k('zdolnosc', { dla: 'zdolnosc/1', tytul: 'nazwa', opis: 'Zdolność środowiska: co ono już umie, co umie cienko, a czego jeszcze nie. Stan budowy mieszka tu, a nie w czyjejś głowie.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        stan: { typ: 'wybor', wartosci: ['stoi', 'cienko', 'brak'], wymagana: true },
        opis: { typ: 'tekst', wymagana: true },
        jak: { typ: 'tekst', opis: 'jak tego użyć albo czego brakuje' },
        dowod: { typ: 'tekst', opis: 'kto i jak to sprawdził' },
      } }),
    k('projekt', { dla: 'projekt/1', tytul: 'nazwa', opis: 'Projekt: jedno z dzieł właściciela (gra, lab, narzędzie). Nie musi mieć repozytorium.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst' },
        zrodlo: { typ: 'adres', opis: 'gdzie leży źródło, np. repozytorium' },
        zagraj: { typ: 'adres', opis: 'adres, pod którym da się to uruchomić' },
        zycie: { typ: 'czas', opis: 'ostatnia zmiana u źródła' },
        stan_na: { typ: 'czas', opis: 'kiedy te fakty zebrano' },
      } }),
    k('relacja', { dla: 'relacja/1', tytul: 'jaka', opis: 'Relacja: nazwane powiązanie dwóch rzeczy. Sama jest rzeczą, więc ma adres i da się przy niej zostawić słowo.',
      cechy: {
        skad: { typ: 'rzecz', wymagana: true },
        dokad: { typ: 'rzecz', wymagana: true },
        jaka: { typ: 'tekst', wymagana: true, opis: 'np. wersja-czego, nalezy-do-rodziny, robi-to-samo-co, pochodzi-z' },
        opis: { typ: 'tekst' },
      } }),
    k('miara', { dla: 'miara/1', tytul: 'nazwa', opis: 'Miara: jedna liczba o świecie na zewnątrz Miejsca, z datą i źródłem (np. ile rzeczy właściciela jeszcze nie jest w środku).',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        wartosc: { typ: 'liczba', wymagana: true },
        stan_na: { typ: 'czas', wymagana: true },
        zrodlo: { typ: 'tekst', opis: 'skąd liczba pochodzi i jak ją powtórzyć' },
      } }),
    { nazwa: 'obszar-glowny', rodzaj: 'obszar/1', meta: 'obszar_glowny', cechy: { nazwa: 'Miejsce', opis: 'Obszar główny. Jego ustawienia obowiązują wszędzie tam, gdzie obszar nie mówi inaczej.', ile_wolno: 'proponowac', uwaga: 'znak', widzi: 'uczestnicy', uklada: 'reka' } },
    { nazwa: 'obszar-nowe', rodzaj: 'obszar/1', meta: 'obszar_nowe', cechy: { nazwa: 'Nowe', opis: 'Tu lądują rzeczy dołożone przez agentów i automaty, gdy nie wskażą obszaru. Agenci prowadzą tu sami; właściciel przenosi stąd rzeczy tam, gdzie chce.', ile_wolno: 'prowadzic', uwaga: 'znak' } },
    { nazwa: 'uczestnik-wlasciciel', rodzaj: 'uczestnik/1', cechy: { imie: wlasciciel, rola: 'wlasciciel', opis: 'Właściciel Miejsca. Jego ruchy zawsze mają skutek; nieodwracalne decyzje należą tylko do niego.' } },
    { nazwa: 'uczestnik-srodowisko', rodzaj: 'uczestnik/1', cechy: { imie: 'srodowisko', rola: 'automat', opis: 'Samo środowisko: zasiewa rzeczy, bez których nie umie opisać siebie.' } },
    zd('rzeczy', 'stoi', 'Rzeczy z tożsamością i historią: każda rzecz ma identyfikator niezależny od nazwy i repozytorium, adres /rzecz/<id> i zapis każdej zmiany z autorem.'),
    zd('ksztalty', 'stoi', 'Rodzaj jako dana: nowy rodzaj rzeczy dokłada się ruchem (rzecz rodzaju ksztalt/1); sprawdzanie jest przy zapisie, nieznana cecha zostaje zachowana.'),
    zd('trasa', 'stoi', 'Trasa: jedno żądanie do drzwi i rzecz jest w Miejscu, widać ją w spisie i zostaje.'),
    zd('samowyjasnianie', 'stoi', 'Samowyjaśnianie pod adresem: /co-tu-jest mówi gołym tekstem, co tu jest, co się zmieniło, co komu wolno i jak coś dołożyć; powstaje z danych.'),
    zd('obszary', 'cienko', 'Obszary i prawo do skutku z danych: ten sam ruch daje skutek, propozycję albo odmowę zależnie od ustawienia obszaru.', 'Działa ile_wolno, liczone w obszarze, w którym rzecz leży, i w tym, do którego trafia. Ustawienia uwaga, widzi i uklada są zapisane, ale nic jeszcze z nich nie wynika. Wszyscy agenci mają w obszarze to samo prawo.'),
    zd('propozycje', 'cienko', 'Propozycje: ruch bez prawa do skutku czeka, aż przyjmie go albo odrzuci właściciel albo ktoś, kto sam mógłby zrobić ten ruch ze skutkiem; autor może swoją wycofać.', 'Ruch, który zmienia coś zastrzeżonego dla właściciela, też staje się propozycją, tylko do niego. Nie ma wygasania ani warstwy do obejrzenia przed przyjęciem.'),
    zd('goscie', 'cienko', 'Goście z kodem w piaskownicy: jeden plik HTML zapisany w Miejscu, podawany bez dostępu do sieci i do adresu Miejsca.', 'Gość czyta rzeczy przez umowę okna. Jeszcze nie proponuje ruchów z okna i nie ma własnej pamięci.'),
    zd('umowa-okna', 'cienko', 'Umowa okna, pokolenie 2: przyrząd starej Jaskini (hello, state, signals, event, flag) i czytanie rzeczy.', 'Opis: /umowa-okna. Brakuje ruchów z okna, wołania czasowników gościa i okna w przestrzeni Startu.'),
    zd('czasowniki', 'cienko', 'Spis czasowników: jedna lista tego, co da się zrobić, z wejściem i wynikiem.', 'Są czasowniki drzwi i okna. Czasowniki gości są tylko wypisane; wołać ich jeszcze się nie da.'),
    zd('na-zywo', 'cienko', 'Zmiany na żywo: otwarta strona dowiaduje się o cudzej zmianie w kilka sekund, bez przeładowania.', 'Przez odpytywanie co kilka sekund, tylko gdy karta jest widoczna. Docelowo kanał.'),
    zd('wywoz', 'cienko', 'Wywóz i wwóz całości: właściciel dostaje wszystko jako jeden plik spod /api/miejsce/eksport; plik sam mówi, jak go czytać, a wwieziony do pustego Miejsca odtwarza to samo środowisko.', 'Obcy czytnik odtworzył spis z samego pliku (dowód D3, 17 XI, sędzia: Opus Code). Powrót do siebie pilnuje sprawdzian budowniczego; nikt obcy go jeszcze nie sądził.'),
    zd('licznik-przeniesienia', 'cienko', 'Licznik przeniesienia: ile jego rzeczy jest już w środku, a ile jeszcze nie.', 'Liczy na razie tylko projekty wzięte z publicznych faktów.'),
    zd('cofanie', 'cienko', 'Odkładanie i cofanie: rzecz da się odłożyć i przywrócić, a jej treść cofnąć do wcześniejszej wersji; każde jest nową wersją, więc nic nie znika.', 'Działa przez drzwi (co: odloz, przywroc, cofnij). Nie ma jeszcze cofania całego gestu jednym krokiem ani guzika na stronie.'),
    zd('szukanie', 'cienko', 'Pytanie po cechach i szukanie: listę rzeczy da się zawęzić do wartości cechy i do słowa.', 'Adresy: /rzeczy?rodzaj=…&gdzie.<cecha>=<wartość> i /rzeczy?szukaj=<słowo>. Szukanie patrzy na napisy w cechach, bez odmiany słów.'),
    zd('klucz-rzeczy', 'cienko', 'Tożsamość z cech: kształt może wskazać klucz, czyli cechy, z których liczy się tożsamość rzeczy; to, co przychodzi z zewnątrz wiele razy, trafia zawsze w tę samą rzecz.', 'Opis: /co-tu-jest, punkt 5c. Żaden zasiany rodzaj jeszcze go nie używa; czeka na automat faktów.'),
    zd('reka-na-stronie', 'cienko', 'Ręka na stronie: właściciel przyjmuje i odrzuca propozycje, odpowiada na prośby, zostawia słowo przy rzeczy i ustawia, ile wolno agentom w obszarze, bez wychodzenia ze strony.', 'Wejście kluczem zapamiętanym w przeglądarce; na podglądzie jednym guzikiem jako właściciel próbny. Prawdziwe drzwi właściciela (bez klucza do wklejania) jeszcze nie stoją.'),
    zd('drzwi-wlasciciela', 'brak', 'Drzwi dla właściciela: wejście z komputera i telefonu jednym dotknięciem.', 'Na podglądzie są jawne klucze próbne. Metoda: teczka kabelków w pamięci wspólnej.'),
    zd('widocznosc', 'brak', 'Widoczność: kto widzi którą rzecz.', 'Na podglądzie wszystko jest publiczne do czytania. W prawdziwym Miejscu czytanie będzie wymagać klucza albo ustawienia widzi: wszyscy. Stare drzwi /api/miejsce, które widoczności nie znają, są tylko dla właściciela. Gość w oknie czyta dziś tyle, co strona, która go otworzyła; ma dostać własną tożsamość, zanim wejdzie pierwsza rzecz prywatna.'),
    zd('adres-czytania', 'brak', 'Adres czytania dla ciała bez rąk: osobny żeton tylko do czytania, żeby agent bez nagłówków widział swoją perspektywę.', 'Na podglądzie zastępuje go ?jako=<imię>, bez dowodu tożsamości.'),
    zd('obecnosc', 'brak', 'Obecność: kto jest teraz gdzie i nad czym pracuje, w obie strony, z wyłącznikiem.', 'Świadomie odłożona. Cienka postać jednego organizmu to zmiany na żywo.'),
    zd('fakty-automatem', 'brak', 'Fakty automatem: wersje, buildy i życie projektów przychodzą same, nie ręką agenta.'),
    zd('start', 'brak', 'Start: Przegląd ze Ścianą w jednym, pierwszy organ dla ręki właściciela.'),
    zd('wolanie-czasownikow', 'brak', 'Wołanie czasowników gościa: agent bez przeglądarki prosi otwartego gościa, żeby coś zrobił, i dostaje wynik.'),
    zd('drugie-miejsce', 'brak', 'Drugie Miejsce: osobne Miejsce obok tego (na pokaz, dla labu), odniesienia między nimi i jedno otwierane w drugim jak gość.'),
    zd('najety-mozg', 'brak', 'Mózg najęty przez Jaskinię: agent działający w środku za API właściciela, z pułapem kosztu jako ustawieniem obszaru.', 'Kierunek, nie plan na teraz. Klucz nigdy nie jest daną: zapis trzyma nazwę sekretu.'),
    { nazwa: 'gosc-lista', rodzaj: 'gosc/1',
      cechy: async (s) => {
        // op niesie odcisk treści: gdy kod przykładu zmieni się w źródle, powstaje nowy zapis zamiast konfliktu op
        const w = await s.r.wykonaj('srodowisko', { op: 'zasiew-kod-lista-' + szybkiOdcisk(GOSC_LISTA), co: 'zapisz', rodzaj: 'kod/1', tresc: GOSC_LISTA }, { slad: 'zasiew' });
        if (!w.ok) throw new Error('kod gościa: ' + w.blad);
        return { nazwa: 'Lista rzeczy', opis: 'Najprostszy gość: wszystkie rzeczy pogrupowane według rodzaju. Przykład umowy okna do skopiowania.', kod: w.zapis ?? w.akt.zapis, umowa: 'okno/2' };
      } },
  ];
}
