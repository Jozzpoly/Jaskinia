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
    k('widok', { dla: 'widok/1', tytul: 'nazwa', opis: 'Widok: nazwane ułożenie rzeczy w przestrzeni (np. Start). Sam widok nie trzyma położeń: każde położenie jest osobną rzeczą rodzaju miejsce, więc ma własną historię i autora. Widok leży w obszarze, a jego ustawienia mówią, kto może w nim układać.',
      cechy: {
        nazwa: { typ: 'tekst', wymagana: true },
        opis: { typ: 'tekst' },
      } }),
    k('miejsce', { dla: 'miejsce/1', klucz: ['widok', 'rzecz'], opis: 'Miejsce rzeczy w widoku: gdzie leży i jak duża jest z ręki. Jedna rzecz ma w jednym widoku jedno miejsce (klucz: widok i rzecz), więc każde przesunięcie jest nową wersją tego samego miejsca, a historia mówi, kto i kiedy ją tam położył. Rzecz bez miejsca leży w siatce domyślnej widoku.',
      cechy: {
        widok: { typ: 'rzecz', rodzaj: 'widok/1', wymagana: true },
        rzecz: { typ: 'rzecz', wymagana: true, opis: 'rzecz, która tu leży' },
        x: { typ: 'liczba', wymagana: true, opis: 'środek rzeczy w jednostkach świata (karta ma 240 na 150)' },
        y: { typ: 'liczba', wymagana: true },
        skala: { typ: 'liczba', opis: 'mnożnik wielkości z ręki, od 0.4 do 4; bez niej 1' },
      } }),
    k('rodzina', { dla: 'rodzina/1', tytul: 'nazwa', klucz: ['znak'], opis: 'Rodzina projektów: pytanie, wokół którego krąży kilka repozytoriów. Fakt przyniesiony przez obserwatora ze starej Jaskini.',
      cechy: {
        znak: { typ: 'tekst', wymagana: true, opis: 'krótki identyfikator rodziny w pliku faktów starej Jaskini, np. zywe; z niego liczy się tożsamość rzeczy' },
        nazwa: { typ: 'tekst', wymagana: true },
        pytanie: { typ: 'tekst', opis: 'pytanie, wokół którego krąży rodzina' },
        stan_na: { typ: 'czas', wymagana: true, opis: 'jak stare są te fakty: chwila zebrania pliku, z którego pochodzą' },
      } }),
    // Klucz repozytorium to pełna nazwa małymi literami (<właściciel>/<nazwa>), nie numer z GitHuba: dwa źródła faktów
    // (API GitHuba i plik starej Jaskini) znają nazwę, a numer zna tylko API. Cena: zmiana nazwy u źródła to dziś NOWA
    // rzecz, a stara zostaje odłożona (znane ograniczenie, TYMCZASOWE.md). Numer zostaje zwykłą cechą.
    // tytul zostaje 'nazwa': kształt ma jedną cechę tytułu i musi ona być zawsze wypełniona, a ladna_nazwa (z pliku) bywa pusta;
    // stronę gospodarza uczy się brać ladna_nazwa, gdy jest.
    k('repo', { dla: 'repo/1', tytul: 'nazwa', klucz: ['pelna_nazwa'], opis: 'Repozytorium na GitHubie: fakt przyniesiony przez obserwatora (z API GitHuba albo z pliku faktów starej Jaskini), nie dzieło.',
      cechy: {
        pelna_nazwa: { typ: 'tekst', wymagana: true, opis: '<właściciel>/<nazwa> małymi literami; z tego liczy się tożsamość rzeczy, więc to samo repozytorium z dwóch źródeł trafia w jedną rzecz' },
        github_id: { typ: 'liczba', opis: 'numer repozytorium na GitHubie, gdy źródło go zna (API tak, plik starej Jaskini nie)' },
        nazwa: { typ: 'tekst', wymagana: true },
        adres: { typ: 'adres', wymagana: true, opis: 'strona repozytorium' },
        opis: { typ: 'tekst' },
        strona: { typ: 'adres', opis: 'gdzie da się to uruchomić, gdy repozytorium ma stronę' },
        jezyk: { typ: 'tekst' },
        archiwum: { typ: 'tak-nie' },
        ostatni_push: { typ: 'czas' },
        utworzone: { typ: 'czas' },
        galezie: { typ: 'liczba', opis: 'ile gałęzi widział obserwator; brak, gdy jeszcze ich nie sprawdził' },
        ladna_nazwa: { typ: 'tekst', opis: 'nazwa dla ludzi, z pliku faktów starej Jaskini' },
        tozsamosc: { typ: 'tekst', opis: 'jedno zdanie: czym to jest (z pliku faktów starej Jaskini)' },
        rodzina: { typ: 'rzecz', rodzaj: 'rodzina/1', opis: 'rodzina projektów, do której repozytorium należy według pliku starej Jaskini' },
        zycie: { typ: 'tekst', opis: 'jak żywe jest repozytorium według pliku starej Jaskini, np. żywe, stygnące' },
        commity: { typ: 'liczba', opis: 'ile commitów według pliku starej Jaskini (na chwilę jego zebrania)' },
        stos: { typ: 'lista', z: 'tekst', opis: 'technologie według pliku starej Jaskini' },
        karta: { typ: 'tak-nie', opis: 'prawda tylko dla gier, które mają się otwierać w osobnej karcie (ramka dzieli pamięć gry); z pliku starej Jaskini' },
        wejscie: { typ: 'tekst', opis: 'jedno zdanie o wejściu, np. dlaczego nie ma guzika albo co trzeba wiedzieć przed grą (z pliku starej Jaskini, do 600 znaków)' },
        zrodlo_faktow: { typ: 'tekst', opis: 'skąd są te fakty: GitHub API, plik faktów starej Jaskini albo oba' },
        stan_na: { typ: 'czas', wymagana: true, opis: 'jak stare są te fakty: chwila zebrania u źródła (dla API chwila obejścia, dla pliku jego estate.generated)' },
      } }),
    k('galaz', { dla: 'galaz/1', tytul: 'nazwa', klucz: ['repo', 'nazwa'], opis: 'Gałąź repozytorium: fakt przyniesiony przez obserwatora.',
      cechy: {
        repo: { typ: 'rzecz', rodzaj: 'repo/1', wymagana: true },
        nazwa: { typ: 'tekst', wymagana: true },
        commit: { typ: 'tekst', opis: 'skrót ostatniego commita' },
        kiedy: { typ: 'czas', opis: 'kiedy był ostatni commit tej gałęzi (z pliku faktów starej Jaskini)' },
        temat: { typ: 'tekst', opis: 'temat ostatniego commita, obcięty do 200 znaków (z pliku faktów starej Jaskini)' },
        stan_na: { typ: 'czas', wymagana: true, opis: 'jak stare są te fakty: chwila zebrania u źródła' },
      } }),
    { nazwa: 'obszar-glowny', rodzaj: 'obszar/1', meta: 'obszar_glowny', cechy: { nazwa: 'Miejsce', opis: 'Obszar główny. Jego ustawienia obowiązują wszędzie tam, gdzie obszar nie mówi inaczej.', ile_wolno: 'proponowac', uwaga: 'znak', widzi: 'uczestnicy', uklada: 'reka' } },
    { nazwa: 'obszar-nowe', rodzaj: 'obszar/1', meta: 'obszar_nowe', cechy: { nazwa: 'Nowe', opis: 'Tu lądują rzeczy dołożone przez agentów i automaty, gdy nie wskażą obszaru. Agenci prowadzą tu sami; właściciel przenosi stąd rzeczy tam, gdzie chce.', ile_wolno: 'prowadzic', uwaga: 'znak' } },
    { nazwa: 'obszar-fakty', rodzaj: 'obszar/1', meta: 'obszar_fakty', cechy: { nazwa: 'Fakty', opis: 'Rzeczy w tym obszarze przynosi obserwator: to fakty z zewnątrz (repozytoria, gałęzie i rodziny projektów: z GitHuba albo z pliku starej Jaskini), nie dzieła właściciela. Obserwator prowadzi tu sam; właściciel je czyta.', ile_wolno: 'prowadzic', uwaga: 'cisza' } },
    { nazwa: 'uczestnik-wlasciciel', rodzaj: 'uczestnik/1', cechy: { imie: wlasciciel, rola: 'wlasciciel', opis: 'Właściciel Miejsca. Jego ruchy zawsze mają skutek; nieodwracalne decyzje należą tylko do niego.' } },
    { nazwa: 'uczestnik-srodowisko', rodzaj: 'uczestnik/1', cechy: { imie: 'srodowisko', rola: 'automat', opis: 'Samo środowisko: zasiewa rzeczy, bez których nie umie opisać siebie.' } },
    { nazwa: 'uczestnik-obserwator', rodzaj: 'uczestnik/1', cechy: { imie: 'obserwator', rola: 'automat', opis: 'Przynosi fakty z GitHuba (publiczne repozytoria i ich gałęzie) albo, gdy GitHub odmawia, z pliku faktów starej Jaskini. Nikt nie ma jego klucza: imię jest zastrzeżone, więc z zewnątrz nie da się pod nim robić ruchów.' } },
    zd('rzeczy', 'stoi', 'Rzeczy z tożsamością i historią: każda rzecz ma identyfikator niezależny od nazwy i repozytorium, adres /rzecz/<id> i zapis każdej zmiany z autorem.'),
    zd('ksztalty', 'stoi', 'Rodzaj jako dana: nowy rodzaj rzeczy dokłada się ruchem (rzecz rodzaju ksztalt/1); sprawdzanie jest przy zapisie, nieznana cecha zostaje zachowana.'),
    zd('trasa', 'stoi', 'Trasa: jedno żądanie do drzwi i rzecz jest w Miejscu, widać ją w spisie i zostaje.'),
    zd('samowyjasnianie', 'stoi', 'Samowyjaśnianie pod adresem: /co-tu-jest mówi gołym tekstem, co tu jest, co się zmieniło, co komu wolno i jak coś dołożyć; powstaje z danych.'),
    zd('obszary', 'cienko', 'Obszary i prawo do skutku z danych: ten sam ruch daje skutek, propozycję albo odmowę zależnie od ustawienia obszaru.', 'Działa ile_wolno, liczone w obszarze, w którym rzecz leży, i w tym, do którego trafia. Ustawienia uwaga, widzi i uklada są zapisane, ale nic jeszcze z nich nie wynika. Wszyscy agenci mają w obszarze to samo prawo.'),
    zd('propozycje', 'cienko', 'Propozycje: ruch bez prawa do skutku czeka, aż przyjmie go albo odrzuci właściciel albo ktoś, kto sam mógłby zrobić ten ruch ze skutkiem; autor może swoją wycofać.', 'Ruch, który zmienia coś zastrzeżonego dla właściciela, też staje się propozycją, tylko do niego. Nie ma wygasania ani warstwy do obejrzenia przed przyjęciem.'),
    zd('goscie', 'cienko', 'Goście z kodem w piaskownicy: jeden plik HTML zapisany w Miejscu, podawany bez dostępu do sieci i do adresu Miejsca.', 'Gość czyta rzeczy przez umowę okna. Jeszcze nie proponuje ruchów z okna i nie ma własnej pamięci.'),
    zd('umowa-okna', 'cienko', 'Umowa okna, pokolenie 2: przyrząd starej Jaskini (hello, state, signals, event, flag) i czytanie rzeczy.', 'Opis: /umowa-okna. Brakuje ruchów z okna, wołania czasowników gościa i okna w przestrzeni Startu.'),
    zd('czasowniki', 'cienko', 'Spis czasowników: jedna lista tego, co da się zrobić, z wejściem i wynikiem.', 'Są czasowniki drzwi i okna. Czasowniki gości są tylko wypisane; wołać ich jeszcze się nie da.'),
    zd('na-zywo', 'cienko', 'Zmiany na żywo: otwarta strona dowiaduje się o cudzej zmianie od razu, bez przeładowania i bez pytania.', 'Kanał: połączenie pod /api/srodowisko/zywe niesie sam numer ostatniego aktu, a strona doczytuje tylko to, co się zmieniło (spis z po=<akt>). Gdy połączenie nie stoi, strona pyta o puls co kilka sekund. Niesprawdzone na prawdziwym telefonie ani przy słabej sieci.'),
    zd('wywoz', 'cienko', 'Wywóz i wwóz całości: właściciel dostaje wszystko jako jeden plik spod /api/miejsce/eksport; plik sam mówi, jak go czytać, a wwieziony do pustego Miejsca odtwarza to samo środowisko.', 'Obcy czytnik odtworzył spis z samego pliku (dowód D3, 17 XI, sędzia: Opus Code). Powrót do siebie pilnuje sprawdzian budowniczego; nikt obcy go jeszcze nie sądził.'),
    zd('licznik-przeniesienia', 'cienko', 'Licznik przeniesienia: ile jego rzeczy jest już w środku, a ile jeszcze nie.', 'Liczy na razie tylko projekty wzięte z publicznych faktów.'),
    zd('cofanie', 'cienko', 'Odkładanie i cofanie: rzecz da się odłożyć i przywrócić, a jej treść cofnąć do wcześniejszej wersji; każde jest nową wersją, więc nic nie znika.', 'Działa przez drzwi (co: odloz, przywroc, cofnij). Nie ma jeszcze cofania całego gestu jednym krokiem ani guzika na stronie.'),
    zd('szukanie', 'cienko', 'Pytanie po cechach i szukanie: listę rzeczy da się zawęzić do wartości cechy i do słowa.', 'Adresy: /rzeczy?rodzaj=…&gdzie.<cecha>=<wartość> i /rzeczy?szukaj=<słowo>. Szukanie patrzy na napisy w cechach, bez odmiany słów.'),
    zd('klucz-rzeczy', 'cienko', 'Tożsamość z cech: kształt może wskazać klucz, czyli cechy, z których liczy się tożsamość rzeczy; to, co przychodzi z zewnątrz wiele razy, trafia zawsze w tę samą rzecz.', 'Opis: /co-tu-jest, punkt 5c. Używają go repo/1 (klucz pelna_nazwa), rodzina/1 (klucz znak) i galaz/1 (klucz repo + nazwa), które przynosi obserwator faktów.'),
    zd('reka-na-stronie', 'cienko', 'Ręka na stronie: właściciel przyjmuje i odrzuca propozycje, odpowiada na prośby, zostawia słowo przy rzeczy i ustawia, ile wolno agentom w obszarze, bez wychodzenia ze strony.', 'Wejście kluczem zapamiętanym w przeglądarce; na podglądzie jednym guzikiem jako właściciel próbny. Prawdziwe drzwi właściciela (bez klucza do wklejania) jeszcze nie stoją.'),
    zd('drzwi-wlasciciela', 'brak', 'Drzwi dla właściciela: wejście z komputera i telefonu jednym dotknięciem.', 'Na podglądzie są jawne klucze próbne. Metoda: teczka kabelków w pamięci wspólnej.'),
    zd('widocznosc', 'brak', 'Widoczność: kto widzi którą rzecz.', 'Na podglądzie wszystko jest publiczne do czytania. W prawdziwym Miejscu czytanie będzie wymagać klucza albo ustawienia widzi: wszyscy. Stare drzwi /api/miejsce, które widoczności nie znają, są tylko dla właściciela. Gość w oknie czyta dziś tyle, co strona, która go otworzyła; ma dostać własną tożsamość, zanim wejdzie pierwsza rzecz prywatna.'),
    zd('adres-czytania', 'brak', 'Adres czytania dla ciała bez rąk: osobny żeton tylko do czytania, żeby agent bez nagłówków widział swoją perspektywę.', 'Na podglądzie zastępuje go ?jako=<imię>, bez dowodu tożsamości.'),
    zd('obecnosc', 'cienko', 'Obecność: kto jest teraz gdzie i nad czym pracuje, w obie strony, z wyłącznikiem.', 'Uczestnicy połączeni kanałem na żywo widzą swoje imiona i rzecz, przy której każdy jest (otwarte okno albo karta); zwiedzający widzi samą liczbę. Wyłącznik na stronie (widać mnie): uczestnik słucha zmian, nie pokazując się. Nic z tego nie trafia do dziennika. Agent bez przeglądarki łączy się z kluczem w nagłówku. Nad czym kto pracuje, mówi tylko rzecz, przy której jest.'),
    zd('budzet-wierszy', 'cienko', 'Budżet wierszy: Miejsce mierzy u źródła, ile wierszy bazy przeczytało i zapisało, i może mieć dobowy limit zapisów.', 'Koszt każdego żądania stoi w nagłówku odpowiedzi x-koszt, suma doby w /co-tu-jest. Po dojściu do limitu ruch dostaje odmowę ze zdaniem dlaczego, a czytanie działa dalej. Licznik zna tylko to Miejsce: wspólnego limitu konta nie widzi.'),
    zd('fakty-automatem', 'cienko', 'Fakty automatem: obserwator sam przynosi publiczne repozytoria i ich gałęzie jako rzeczy repo/1 i galaz/1 (oraz rodziny projektów jako rodzina/1) w obszarze Fakty, z dwóch źródeł: z API GitHuba i z pliku faktów starej Jaskini. Budzi go alarm (tylko tam, gdzie ustawiono OBSERWATOR=tak) i ręczne obejście (POST /api/srodowisko/obejdz, tylko właściciel).', 'Źródła: API GitHuba idzie pierwsze; gdy odmawia (bez tokenu GitHub często odmawia z adresów Cloudflare, 403), obejście bierze fakty z pliku starej Jaskini (adres z OBSERWATOR_BIBLIOTEKA), który stara Jaskinia sama odświeża zwykle dwa razy na dobę (fakty są tak świeże, jak jej ostatnie odświeżenie; z tokenem obserwator czytałby GitHuba sam i częściej) i który NIE zna numeru repozytorium. Gdy API działa, plik tylko dokłada to, czego API nie zna (rodzina, tożsamość, ładna nazwa, życie, stos, commity, temat gałęzi). Każda rzecz mówi swój wiek (stan_na) i źródło (zrodlo_faktow); nowszy fakt nie jest cofany starszym. Z pliku odkłada się tylko ostrożnie i odwracalnie: plik musi być pełny (estate.coverage bez braków) i nowszy niż fakty odkładanej rzeczy, a bezpiecznik wstrzymuje odkładanie, gdy zniknęłaby ponad połowa repozytoriów; odłożone przez obserwatora przywraca nowszy plik, odłożonych cudzą ręką obserwator nie rusza. Czego nie ma: wdrożeń i wersji do uruchomienia (tylko adres strony), repozytoriów prywatnych, zdarzeń na żywo zamiast odpytywania, rozpoznania zmiany nazwy repozytorium (to dziś nowa rzecz i odłożona stara). Gałęzie sprawdza po pięć repozytoriów na obejście, więc pełne koło trwa kilka obejść. Awaria źródła niczego nie odkłada i zostawia lukę w mierze obserwator-faktow. Nikt jeszcze nie sprawdził tego na prawdziwym GitHubie ani na Cloudflare.'),
    { nazwa: 'widok-start', rodzaj: 'widok/1', cechy: { nazwa: 'Start', opis: 'Widok, od którego właściciel zaczyna: jego projekty w przestrzeni, w stanie stałym (tam, gdzie je położył) albo ciekłym (wypełniają okno, ważniejsze większe).' } },
    zd('start', 'cienko', 'Start: Przegląd ze Ścianą w jednym, pierwszy organ dla ręki właściciela.', 'Szkielet pod /start/: projekty na płótnie w stanie stałym (położenia z ręki jako rzeczy rodzaju miejsce w widoku Start, zapis przy puszczeniu) i ciekłym (wypełniają okno, liczone z położeń stałego), przełącznik i suwak między nimi, przybliżanie z gałęziami w środku projektu, karta rzeczy ze zdaniem, skąd się tu wzięła, wejście do grania, zmiany na żywo. Nie ma jeszcze: odpychania się rzeczy, grup, zaznaczania wielu, nazwanych ułożeń, Pól na płótnie, narzędzi w przestrzeni ani motywów. Niesprawdzone jego ręką.'),
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
