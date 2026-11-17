// Samowyjaśnianie: tekst, którym Miejsce samo mówi, co w nim jest i jak coś dołożyć (17 XI 2026). Status: próba.
// Wszystko tu powstaje z danych w chwili pytania. Stałe są tylko zdania opisujące drzwi i umowę okna.
// Goły tekst, bo najsłabsze ciało agenta umie tylko wejść pod adres i przeczytać.
import { TYPY, STOPNIE, USTAWIENIA } from './srodowisko.mjs';

const dzien = (iso) => String(iso).replace('T', ' ').slice(0, 16) + ' UTC';
const wiersze = (...w) => w.flat(9).filter((x) => x !== null && x !== undefined && x !== false).join('\n');
const obetnij = (s, n = 110) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export const CO_ZNACZY = {
  nic: 'ruchy agentów są odrzucane',
  proponowac: 'każdy ruch agenta staje się propozycją i czeka na właściciela',
  porzadkowac: 'układ ma skutek od razu, zmiana treści jest propozycją',
  prowadzic: 'agenci dokładają i zmieniają sami, ruch ma skutek od razu',
};

export function czasowniki(s) {
  const lista = [
    { nazwa: 'poloz', ktoredy: 'drzwi: POST /api/srodowisko/ruch', opis: 'dołóż nową rzecz albo zmień istniejącą', wejscie: '{op, co:"poloz", rodzaj, cechy, obszar?, rzecz?, wersja?}', wynik: '{skutek: "polozone"|"propozycja", rzecz|propozycja, wersja, numer, adres}' },
    { nazwa: 'odloz', ktoredy: 'drzwi: POST /api/srodowisko/ruch', opis: 'odłóż rzecz: znika z list, zostaje pod swoim adresem i w historii, da się ją przywrócić', wejscie: '{op, co:"odloz", rzecz, wersja, powod?}', wynik: '{skutek: "odlozone"|"propozycja", rzecz, wersja, numer}' },
    { nazwa: 'przywroc', ktoredy: 'drzwi: POST /api/srodowisko/ruch', opis: 'przywróć odłożoną rzecz', wejscie: '{op, co:"przywroc", rzecz, wersja}', wynik: '{skutek: "przywrocone"|"propozycja", rzecz, wersja, numer}' },
    { nazwa: 'cofnij', ktoredy: 'drzwi: POST /api/srodowisko/ruch', opis: 'cofnij rzecz do wcześniejszej wersji (bez pola do: do poprzedniej); cofnięcie jest nową wersją, więc da się cofnąć także je', wejscie: '{op, co:"cofnij", rzecz, wersja, do?}', wynik: '{skutek: "cofniete"|"propozycja", rzecz, wersja, numer, z_wersji}' },
    { nazwa: 'przyjmij', ktoredy: 'drzwi: POST /api/srodowisko/ruch', opis: 'przyjmij czekającą propozycję (zmiana wchodzi w życie)', wejscie: '{op, co:"przyjmij", propozycja}', wynik: '{skutek: "przyjeta", rzecz, adres}' },
    { nazwa: 'odrzuc', ktoredy: 'drzwi: POST /api/srodowisko/ruch', opis: 'odrzuć czekającą propozycję; autor tym samym ruchem wycofuje własną', wejscie: '{op, co:"odrzuc", propozycja, powod?}', wynik: '{skutek: "odrzucona"|"wycofana"}' },
    { nazwa: 'kod', ktoredy: 'drzwi: POST /api/srodowisko/kod?op=…', opis: 'zapisz kod gościa (jeden plik HTML jako ciało żądania)', wejscie: 'tekst HTML', wynik: '{zapis, adres: "/gosc/<zapis>"}' },
    { nazwa: 'spis', ktoredy: 'drzwi: GET /api/srodowisko/spis?rodzaj=&obszar=&gdzie.<cecha>=&szukaj=&odlozone=; tekstem: /rzeczy z tymi samymi dodatkami; okno: read spis', opis: 'lista rzeczy: jednego rodzaju, z jednego obszaru, o danej wartości cechy albo z danym słowem; odłożone tylko na życzenie (odlozone=tak albo razem)', wejscie: 'rodzaj?, obszar?, gdzie?, szukaj?, odlozone?, pomin?, ile?', wynik: '{rzeczy: [{id, rodzaj, obszar, cechy, tytul, wersja, numer, …}], razem, pokazane, wszystko}' },
    { nazwa: 'rzecz', ktoredy: 'drzwi: GET /api/srodowisko/rzecz?id=; tekstem: /rzecz/<id>; okno: read rzecz', opis: 'jedna rzecz z historią i tym, co na nią wskazuje', wejscie: 'id', wynik: '{rzecz, historia: [{numer, akt, kto, kiedy}], wskazuja}' },
    { nazwa: 'wersja', ktoredy: 'drzwi: GET /api/srodowisko/wersja?id=&akt=', opis: 'treść wcześniejszej wersji rzeczy (akt to znacznik z jej historii)', wejscie: 'id, akt', wynik: '{wersja: {rzecz, akt, numer, kto, kiedy, rodzaj, obszar, cechy, odlozone}}' },
    { nazwa: 'widzialem', ktoredy: 'drzwi: POST /api/srodowisko/widzialem', opis: 'zapisz swoją wizytę: następny odczyt /co-tu-jest tym samym kluczem pokaże tylko to, co zmieniło się po niej', wejscie: '{akt?}', wynik: '{widziane_do}' },
    { nazwa: 'ksztalty', ktoredy: 'drzwi: GET /api/srodowisko/ksztalty; tekstem: /rodzaje; okno: read ksztalty', opis: 'wszystkie rodzaje rzeczy z opisem cech', wejscie: '-', wynik: '{ksztalty: [{dla, opis, cechy, …}]}' },
    { nazwa: 'wywoz', ktoredy: 'drzwi: GET /api/miejsce/eksport (tylko właściciel)', opis: 'całe Miejsce jako jeden plik: niezmienne zapisy, dziennik aktów i głowy; z tego da się odtworzyć spis bez kodu Jaskini', wejscie: '-', wynik: '{format: "jaskinia-miejsce", wersja, zebrane, zapisy, akty, glowy, odczyty}' },
    { nazwa: 'obejdz', ktoredy: 'drzwi: POST /api/srodowisko/obejdz (tylko właściciel; działa, gdy obserwator jest włączony ustawieniem OBSERWATOR=tak); sam budzi się alarmem', opis: 'obserwator faktów obchodzi publiczne repozytoria właściciela na GitHubie: zapisuje tylko to, co się zmieniło, i sprawdza gałęzie kilku repozytoriów na raz', wejscie: '-', wynik: '{ok, stan: "ok"|"czesciowe"|"brak", repozytoria, galezie_sprawdzone, zmienione, bez_zmian, odlozone, luki, zadan}' },
    { nazwa: 'puls', ktoredy: 'drzwi: GET /api/srodowisko/puls', opis: 'numer ostatniego aktu; zmienia się po każdym ruchu', wejscie: '-', wynik: '{akt}' },
    { nazwa: 'opis', ktoredy: 'tekstem: /co-tu-jest; drzwi: GET /api/srodowisko/opis', opis: 'ten tekst (albo to samo jako dane)', wejscie: 'od?, jako?', wynik: 'tekst' },
  ];
  for (const g of s.spis({ rodzaj: 'gosc/1', limit: 500 })) {
    if (!Array.isArray(g.cechy.czasowniki)) continue;
    for (const c of g.cechy.czasowniki) if (c && typeof c.nazwa === 'string') lista.push({ nazwa: obetnij(c.nazwa, 60), ktoredy: `gość "${s.tytul(g)}" (/rzecz/${g.id}); wołanie jeszcze nie działa`, opis: obetnij(c.opis || '', 160), wejscie: obetnij(JSON.stringify(c.wejscie ?? '-'), 120), wynik: obetnij(JSON.stringify(c.wynik ?? '-'), 120) });
  }
  return lista;
}

// Co obserwator faktów przyniósł i kiedy: z rzeczy miara/1 o nazwie obserwator-faktow (chwila ostatniego UDANEGO
// obejścia) i z zapisu ostatniej próby, także nieudanej. Gdy nie chodził, mówi to wprost.
function obserwator(s) {
  const m = s.spis({ rodzaj: 'miara/1', gdzie: { nazwa: 'obserwator-faktow' }, limit: 1 })[0] || null;
  let proba = null;
  try { proba = JSON.parse(s.r.meta('obserwator:proba') || 'null'); } catch { /* zapis uszkodzony: jak brak */ }
  return {
    repozytoria: s.ile({ rodzaj: 'repo/1' }), galezie: s.ile({ rodzaj: 'galaz/1' }),
    ostatnie_udane: m ? { stan_na: m.cechy.stan_na, zrodlo: m.cechy.zrodlo || null } : null,
    ostatnia_proba: proba && typeof proba === 'object' ? { czas: proba.czas || null, stan: proba.stan || null, luki: proba.luki || null } : null,
  };
}

function obszary(s) {
  const glowny = s.r.meta('obszar_glowny');
  const wszystkie = s.wszystkie({ rodzaj: 'obszar/1' });
  const wynik = [];
  const ust = (id) => Object.fromEntries(Object.keys(USTAWIENIA).map((k) => [k, s.ustawienie(id, k)]));
  const poNazwie = (a, b) => s.tytul(a).localeCompare(s.tytul(b));
  const widziane = new Set();
  const dodaj = (o, glebokosc) => {
    if (widziane.has(o.id) || glebokosc > 32) return;
    widziane.add(o.id);
    wynik.push({ id: o.id, nazwa: s.tytul(o), glebokosc, glowny: false, ustawienia: ust(o.id), ile: s.ile({ obszar: o.id }) });
    for (const d of wszystkie.filter((x) => x.obszar === o.id).sort(poNazwie)) dodaj(d, glebokosc + 1);
  };
  const g = glowny ? s.rzecz(glowny) : null;
  // Obszar główny pokazujemy raz, jako korzeń; rzeczy z obszarem null leżą właśnie w nim.
  if (g) widziane.add(g.id);
  wynik.push({ id: g ? g.id : null, nazwa: g ? s.tytul(g) : 'Miejsce', glebokosc: 0, glowny: true, ustawienia: ust(null),
    ile: s.ile({ obszar: null }) + (g ? s.ile({ obszar: g.id }) : 0) });
  for (const d of wszystkie.filter((x) => (x.obszar === null || (g && x.obszar === g.id)) && (!g || x.id !== g.id)).sort(poNazwie)) dodaj(d, 1);
  return wynik;
}

function zmiany(s, od, limit = 40) {
  const akty = s.q(`SELECT a.nr, a.kto, a.kiedy, a.glowa, a.z_zapisu, a.cialo FROM akty a WHERE a.co = 'przesun' AND a.glowa LIKE 'rzecz:%' AND a.nr > ? ORDER BY a.nr DESC LIMIT ?`, od | 0, limit + 1);
  const wiecej = akty.length > limit;
  return { wiecej, lista: akty.slice(0, limit).map((a) => {
    const rz = s.rzecz(a.glowa.slice(6));
    return { akt: a.nr, kto: a.kto, kiedy: new Date(a.kiedy).toISOString(), co: a.z_zapisu ? 'zmienił' : 'dołożył', id: a.glowa.slice(6), rodzaj: rz ? rz.rodzaj : '?', tytul: rz ? s.tytul(rz) : '?' };
  }) };
}

// Dane, z których powstaje i tekst, i odpowiedź JSON (jedno źródło dla człowieka i agenta).
export function opisDane(s, { kto = null, jako = null, od = null, origin = '', podglad = false, kluczProbny = null, probnyImie = null } = {}) {
  const ostatni = s.ostatniNr();
  const widzKto = kto || (podglad && jako ? jako : null);
  const rola = s.rola(widzKto);
  const liczby = s.liczby();
  const ks = s.ksztalty();
  const wizyta = kto ? s.r.nowe(kto) : null;
  let odAktu = null, skad = 'pierwszy raz';
  if (Number.isInteger(od) && od >= 0) { odAktu = Math.min(od, ostatni); skad = 'z adresu'; }
  else if (wizyta && !wizyta.pierwszy_raz) { odAktu = wizyta.widziane_do; skad = 'z zapisanej wizyty'; }
  const zm = zmiany(s, odAktu ?? 0, odAktu === null ? 15 : 60);
  const cz = s.czeka();
  const miary = s.spis({ rodzaj: 'miara/1', limit: 200 });
  const m = miary.find((x) => x.cechy.nazwa === 'publiczne-repozytoria');
  return {
    miejsce: { srodowisko: 'srodowisko-1', format: s.r.stan().wersja, adres: origin, akt: ostatni, stan_na: new Date(s.r.teraz()).toISOString(), podglad },
    czytasz_jako: { imie: widzKto, rola, pewnosc: kto ? 'klucz' : (widzKto ? 'bez dowodu (podgląd, ?jako=)' : 'bez klucza') },
    liczby, razem: liczby.reduce((a, x) => a + x.ile, 0),
    rodzaje: [...ks.values()].map((k) => ({ dla: k.cechy.dla, opis: k.cechy.opis, rzecz: k.id, ile: (liczby.find((l) => l.rodzaj === k.cechy.dla) || { ile: 0 }).ile })).sort((a, b) => a.dla.localeCompare(b.dla)),
    bez_ksztaltu: liczby.filter((l) => !ks.has(l.rodzaj)).map((l) => l.rodzaj),
    obszary: obszary(s),
    goscie: s.spis({ rodzaj: 'gosc/1', limit: 500 }).map((g) => ({ id: g.id, nazwa: s.tytul(g), opis: g.cechy.opis || '', kod: g.cechy.kod || null, adres: g.cechy.adres || null, umowa: g.cechy.umowa || null, dolozyl: g.utworzyl })),
    uczestnicy: s.spis({ rodzaj: 'uczestnik/1', limit: 500 }).map((u) => ({ imie: u.cechy.imie, rola: u.cechy.rola, cialo: u.cechy.cialo || null })),
    zmiany: { od: odAktu, skad, pierwszy_raz: odAktu === null, lista: zm.lista, wiecej: zm.wiecej, wizyta_zapisana: wizyta && !wizyta.pierwszy_raz ? { akt: wizyta.widziane_do, kiedy: wizyta.widziane_kiedy } : null },
    czeka: { propozycje: cz.propozycje.map((p) => ({ id: p.id, od: p.cechy.od, rodzaj: p.cechy.rodzaj, obszar: p.obszar, rzecz: p.cechy.rzecz || null, kiedy: p.utworzono })), prosby: cz.prosby.map((p) => ({ id: p.id, tresc: p.cechy.tresc, tryb: p.cechy.tryb || 'czeka', od: p.utworzyl, kiedy: p.utworzono })) },
    zdolnosci: s.spis({ rodzaj: 'zdolnosc/1', limit: 500 }).map((z) => ({ id: z.id, nazwa: z.cechy.nazwa, stan: z.cechy.stan, opis: z.cechy.opis, jak: z.cechy.jak || null })),
    przeniesienie: { projekty_w_srodku: (liczby.find((l) => l.rodzaj === 'projekt/1') || { ile: 0 }).ile, publiczne_repozytoria: m ? { ile: m.cechy.wartosc, stan_na: m.cechy.stan_na || null, zrodlo: m.cechy.zrodlo || null } : null },
    obserwator: obserwator(s),
    czasowniki: czasowniki(s),
    klucz_probny: podglad ? kluczProbny : null,
    probny_imie: podglad ? probnyImie : null,
    zalatwione: { prosby: s.ile({ rodzaj: 'prosba/1', gdzie: { stan: 'zalatwiona' } }), propozycje_przyjete: s.ile({ rodzaj: 'propozycja/1', gdzie: { stan: 'przyjeta' } }), propozycje_odrzucone: s.ile({ rodzaj: 'propozycja/1', gdzie: { stan: 'odrzucona' } }), propozycje_wycofane: s.ile({ rodzaj: 'propozycja/1', gdzie: { stan: 'wycofana' } }) },
    odlozone: s.ile({ odlozone: 'tak' }),
    wlasciciel: s.wlasciciel,
  };
}

export function coTuJest(s, opcje = {}) {
  const d = opisDane(s, opcje);
  const o = d.miejsce.adres;
  const R = d.czytasz_jako.rola;
  const agent = R === 'agent' || R === 'automat';
  const ile = (n, a, b, c) => `${n} ${n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c)}`;
  const obszarNowe = s.r.meta('obszar_nowe');
  const stany = { stoi: 'STOI', cienko: 'CIENKO', brak: 'BRAK' };
  return wiersze(
    'JASKINIA: ŚRODOWISKO (próba, pokolenie 1)',
    `Adres: ${o}   Stan na: ${dzien(d.miejsce.stan_na)}   Ostatni akt: ${d.miejsce.akt}`,
    `Czytasz jako: ${d.czytasz_jako.imie || 'zwiedzający'} (rola: ${R}; ${d.czytasz_jako.pewnosc})`,
    d.miejsce.podglad && 'TO JEST PODGLĄD: wszystko tutaj jest publiczne do czytania, a klucze próbne są jawne. Niczego prywatnego tu nie ma i nie wolno wkładać.',
    'Ten tekst powstaje z danych w chwili, gdy o niego pytasz. Każdy adres zaczynający się od / dopisz do adresu wyżej.',
    '',
    '1. CO TO ZA MIEJSCE',
    'Miejsce to jedna wspólna pamięć: leżą w nim rzeczy właściciela (projekty, wersje, słowa, narzędzia) i wszystko, co dokładają agenci.',
    'Każda rzecz ma stały identyfikator, rodzaj z pokoleniem (np. projekt/1), obszar, w którym leży, i historię zmian z autorem.',
    'Rodzaje rzeczy są danymi, nie kodem: nowy rodzaj dokładasz tym samym ruchem co rzecz. Narzędzia i widoki (goście) też wchodzą ruchem.',
    'Jądro Miejsca nie wie, czym jest projekt ani okno. Start, czyli twarz dla ręki właściciela, jeszcze nie istnieje (punkt 8).',
    '',
    '2. CO TU JEST',
    `Rzeczy: ${d.razem}${d.odlozone ? ` (i ${d.odlozone} odłożonych, których listy nie pokazują: /rzeczy?odlozone=tak)` : ''}. Według rodzaju: ${d.liczby.map((l) => `${l.rodzaj}: ${l.ile}`).join(', ') || 'jeszcze nic'}.`,
    'Lista wszystkich rzeczy tekstem: /rzeczy   (jednego rodzaju: /rzeczy?rodzaj=projekt/1; z jednego obszaru: /rzeczy?obszar=<id>;',
    '  o danej wartości cechy: /rzeczy?rodzaj=prosba/1&gdzie.stan=czeka; ze słowem w którejkolwiek cesze: /rzeczy?szukaj=<słowo>)',
    'Jedna rzecz z historią: /rzecz/<id>',
    '',
    'Rodzaje (każdy ma kształt, czyli opis cech; pełna lista z cechami: /rodzaje):',
    d.rodzaje.map((r) => `  ${r.dla} (${r.ile}): ${obetnij(r.opis, 150)}   -> /rodzaj/${r.dla}`),
    d.bez_ksztaltu.length ? `Rodzaje bez kształtu (rzeczy są zapisane i widoczne, ale nikt nie opisał ich cech): ${d.bez_ksztaltu.join(', ')}` : null,
    '',
    'Obszary (rzecz leży w jednym obszarze; ustawienia dziedziczy się z góry):',
    d.obszary.map((x) => `  ${'  '.repeat(x.glebokosc)}${x.nazwa}${x.glowny ? ' [obszar główny; w ruchu: "obszar": null]' : ''}${x.id ? ` (id ${x.id})` : ''}: ${ile(x.ile, 'rzecz', 'rzeczy', 'rzeczy')}; ile_wolno agentom: ${x.ustawienia.ile_wolno.wartosc}${x.ustawienia.ile_wolno.skad === x.id || (x.glowny && x.ustawienia.ile_wolno.skad) ? '' : ' (odziedziczone)'}`),
    '',
    'Obszar jest też rzeczą (rodzaj obszar/1): jego nazwę i ustawienia czytasz jak każdą rzecz (/rzeczy?rodzaj=obszar/1). W każdej rzeczy pole obszar',
    'to identyfikator obszaru, w którym ona leży; null znaczy obszar główny. Rzecz leży dokładnie w jednym obszarze, a obszary tworzą drzewo.',
    '',
    d.goscie.length ? 'Goście (organy i narzędzia; otwierają się w oknie na stronie głównej /):' : 'Gości (organów i narzędzi) jeszcze nie ma.',
    d.goscie.map((g) => `  ${g.nazwa}: ${obetnij(g.opis, 130)}   -> /rzecz/${g.id}${g.kod ? `, kod: /gosc/${g.kod}` : ''}${g.adres ? `, adres: ${g.adres}` : ''}`),
    '',
    `Uczestnicy: ${d.uczestnicy.map((u) => `${u.imie} (${u.rola})`).join(', ')}. Uczestnik z kluczem, którego tu nie wypisano, ma rolę agent.`,
    d.przeniesienie.publiczne_repozytoria
      ? `Licznik przeniesienia: w środku jest ${ile(d.przeniesienie.projekty_w_srodku, 'projekt', 'projekty', 'projektów')} na ${d.przeniesienie.publiczne_repozytoria.ile} publicznych repozytoriów właściciela (stan na ${dzien(d.przeniesienie.publiczne_repozytoria.stan_na || d.miejsce.stan_na)}).`
      : `Licznik przeniesienia: w środku jest ${ile(d.przeniesienie.projekty_w_srodku, 'projekt', 'projekty', 'projektów')}; ile rzeczy właściciela jest jeszcze na zewnątrz, tego Miejsce nie wie (nikt nie dołożył miary).`,
    d.obserwator.ostatnie_udane
      ? `Obserwator faktów (GitHub): przyniósł ${ile(d.obserwator.repozytoria, 'repozytorium', 'repozytoria', 'repozytoriów')} i ${ile(d.obserwator.galezie, 'gałąź', 'gałęzie', 'gałęzi')} (rzeczy repo/1 i galaz/1 w obszarze Fakty); ostatnie udane obejście: ${dzien(d.obserwator.ostatnie_udane.stan_na)}; ${obetnij(d.obserwator.ostatnie_udane.zrodlo || 'bez opisu źródła', 420)}.`
      : `Obserwator faktów (GitHub): jeszcze nie przyniósł żadnych faktów${d.obserwator.ostatnia_proba ? `; ostatnia próba (${dzien(d.obserwator.ostatnia_proba.czas)}) była ${d.obserwator.ostatnia_proba.stan === 'brak' ? 'nieudana' : d.obserwator.ostatnia_proba.stan}, luki: ${obetnij(d.obserwator.ostatnia_proba.luki || 'brak', 300)}` : ', jeszcze nie chodził (budzi go alarm tam, gdzie ustawiono OBSERWATOR=tak, albo właściciel: POST /api/srodowisko/obejdz)'}.`,
    '',
    '3. CO SIĘ ZMIENIŁO',
    d.zmiany.pierwszy_raz
      ? [`Jesteś tu pierwszy raz albo Miejsce nie wie, kim jesteś: nie ma zapisu Twojej wizyty. Oto ${ile(d.zmiany.lista.length, 'ostatnia zmiana', 'ostatnie zmiany', 'ostatnich zmian')}, od najnowszej.`,
        `Żeby następnym razem zobaczyć tylko to, co zmieniło się od tej chwili, wróć pod adres: /co-tu-jest?od=${d.miejsce.akt}`]
      : [`Od aktu ${d.zmiany.od} (${d.zmiany.skad}): ${d.zmiany.lista.length ? ile(d.zmiany.lista.length, 'zmiana', 'zmiany', 'zmian') + (d.zmiany.wiecej ? ' albo więcej (pokazuję najnowsze)' : '') : 'nic się nie zmieniło'}.`,
        `Następnym razem: /co-tu-jest?od=${d.miejsce.akt}`],
    d.zmiany.lista.map((z) => `  akt ${z.akt}, ${dzien(z.kiedy)}, ${z.kto} ${z.co}: ${obetnij(z.tytul, 70)} [${z.rodzaj}] -> /rzecz/${z.id}`),
    '',
    '4. CO CI WOLNO I GDZIE',
    R === 'wlasciciel' && 'Jesteś właścicielem: każdy Twój ruch ma skutek, w każdym obszarze. Tylko Ty zmieniasz ustawienia obszarów, uczestników i kształty rdzenia.',
    R === 'zwiedzajacy' && 'Bez klucza możesz czytać wszystko, co jest pod tymi adresami, i niczego nie zmienisz. Do ruchu potrzebny jest klucz uczestnika (punkt 5).',
    agent && 'Jesteś agentem. To, czy Twój ruch ma skutek, zależy od obszaru, w którym leży rzecz:',
    R === 'zwiedzajacy' && 'Uczestnik z kluczem (agent) może tyle, ile pozwala obszar, w którym leży rzecz:',
    R !== 'wlasciciel' && d.obszary.map((x) => `  ${'  '.repeat(x.glebokosc)}${x.nazwa}${x.id && !x.glowny ? ` (id ${x.id})` : ''}: ${x.ustawienia.ile_wolno.wartosc} = ${CO_ZNACZY[x.ustawienia.ile_wolno.wartosc]}`),
    R !== 'wlasciciel' && [
      `Nowa rzecz bez podanego obszaru ląduje w obszarze "Nowe"${obszarNowe ? ` (id ${obszarNowe})` : ''}. Rzecz dołożona do obszaru, w którym wolno tylko proponować, staje się propozycją.`,
      'W obszarze z ustawieniem porzadkowac skutek od razu mają tylko rzeczy rodzaju oznaczonego jako układ; każda inna nowa rzecz i każda zmiana treści jest propozycją.',
      'Przy zmianie i przenoszeniu liczy się obszar, w którym rzecz leży, i ten, do którego ma trafić: słabsze z dwóch praw wygrywa.',
      'Tylko właściciel zmienia ze skutkiem: ustawienia obszarów, uczestników, kształty rodzajów ksztalt/1, obszar/1, uczestnik/1 i propozycja/1 oraz to, czy rodzaj jest układem.',
      'Taki ruch zrobiony przez kogoś innego nie jest odrzucany: staje się propozycją do właściciela.',
      'Propozycję przyjmuje właściciel albo uczestnik, który ten sam ruch mógłby zrobić sam ze skutkiem; autor może swoją tylko wycofać (co: odrzuc).',
      'Niczego nie da się tu usunąć: każda zmiana jest nowym zapisem obok starego, a historia zostaje. Rzecz można odłożyć (co: odloz) i przywrócić.',
    ],
    `Możliwe wartości ile_wolno: ${STOPNIE.map((x) => `${x} (${CO_ZNACZY[x]})`).join('; ')}.`,
    '',
    '5. JAK COŚ DOŁOŻYĆ',
    d.klucz_probny ? `Klucz: na tym podglądzie działa jawny klucz próbny agenta: ${d.klucz_probny}${d.probny_imie ? `   (ruchy z tym kluczem robi uczestnik o imieniu ${d.probny_imie}, rola agent)` : ''}` : 'Klucz: daje go właściciel; każdy uczestnik ma własny.',
    'Każdy ruch to jedno żądanie:',
    `  POST ${o}/api/srodowisko/ruch`,
    '  Authorization: Bearer <klucz>',
    '  Content-Type: application/json',
    'Pole op to Twój własny identyfikator tej czynności (8 do 100 znaków z liter, cyfr, _ i -). Ponowienie z tym samym op niczego nie zrobi dwa razy',
    'i odda to, co stało się za pierwszym razem. Każdy uczestnik ma własne op: cudze Ci nie przeszkadzają, a ten sam op dla innej Twojej czynności to błąd 409.',
    'Możesz dodać nagłówek X-Cialo: <czym działasz>, np. X-Cialo: curl; zostanie w historii przy ruchu.',
    '',
    'a) Nowa rzecz istniejącego rodzaju:',
    '  {"op":"moja-czynnosc-0001","co":"poloz","rodzaj":"projekt/1","cechy":{"nazwa":"Przykład","opis":"…"}}',
    '  Odpowiedź: {"ok":true,"skutek":"polozone","rzecz":"<id>","wersja":<znacznik>,"numer":1,"adres":"/rzecz/<id>"}',
    '  albo, gdy w tym obszarze wolno Ci tylko proponować: {"ok":true,"skutek":"propozycja","propozycja":"<id>","powod":"…","kto_przyjmuje":"…"}',
    '  Cechy sprawdza kształt rodzaju (/rodzaj/<rodzaj>). Cecha, której kształt nie zna, zostaje zachowana; cecha niezgodna z kształtem odbija ruch ze zdaniem, co jest nie tak.',
    '  Dwie liczby przy rzeczy: numer to która to jej wersja (1, 2, 3…); wersja to znacznik, który podajesz przy zmianie (numer aktu w dzienniku, rośnie skokami).',
    '',
    'b) Zmiana istniejącej rzeczy: to samo, z jej identyfikatorem i polem wersja z ostatniego odczytu (podajesz wszystkie cechy, nie tylko zmienione):',
    '  {"op":"moja-czynnosc-0002","co":"poloz","rzecz":"<id>","wersja":<znacznik>,"rodzaj":"projekt/1","cechy":{…}}',
    '  Gdy ktoś zmienił rzecz po Twoim odczycie, dostaniesz 409 i aktualny znacznik. Świadome nadpisanie bez czytania: "wersja":"dowolna".',
    '  Przeniesienie do innego obszaru: dodaj "obszar":"<id obszaru>" (albo null dla głównego).',
    '',
    'c) Nowy rodzaj rzeczy: dołóż rzecz rodzaju ksztalt/1, która go opisuje. Nie trzeba niczego wdrażać.',
    '  {"op":"moja-czynnosc-0003","co":"poloz","rodzaj":"ksztalt/1","cechy":{"dla":"postac/1","opis":"Postać ze świata gry.","tytul":"imie",',
    '    "cechy":{"imie":{"typ":"tekst","wymagana":true},"sila":{"typ":"liczba"},"z_projektu":{"typ":"rzecz","rodzaj":"projekt/1","opis":"z którego projektu pochodzi"}}}}',
    '  Od tej chwili można dokładać rzeczy rodzaju postac/1 (punkt a), a sam rodzaj widać w /rodzaje.',
    `  Typy cech: ${Object.entries(TYPY).map(([t, op]) => `${t} (${op})`).join('; ')}.`,
    '  Opis cechy: {"typ":…, "opis":"…", "wymagana":true|false}; dla typu rzecz można dodać "rodzaj"; dla lista: "z" (typ elementów, np. "tekst" albo {"typ":"rzecz","rodzaj":"projekt/1"}); dla wybor: "wartosci":[…].',
    '  Kolejność: najpierw kształt, potem rzeczy tego rodzaju. Rodzaj kod jest zastrzeżony dla kodu gości (punkt d).',
    '  Klucz (nieobowiązkowy): "klucz":["nazwa_cechy",…] w kształcie znaczy, że tożsamość rzeczy liczy się z tych cech. Druga rzecz o tym samym kluczu',
    '  nie powstanie: ruch bez pola rzecz trafi w tę istniejącą i poprosi o wersję. Przydatne dla rzeczy, które przychodzą z zewnątrz wiele razy.',
    '  Gdy pod kształtem leżą już rzeczy, wolno w nim tylko dokładać cechy niewymagane, poszerzać wybór i zmieniać opisy. Każda inna zmiana to',
    '  następne pokolenie rodzaju (np. postac/2): nowy kształt obok starego; stare rzeczy zostają takie, jakie są.',
    '',
    'd) Nowy gość (narzędzie albo inne przedstawienie rzeczy), dwa kroki:',
    `  1. POST ${o}/api/srodowisko/kod?op=moj-gosc-0001   (ciało żądania: jeden plik HTML; nagłówek Authorization jak wyżej)`,
    '     Odpowiedź: {"ok":true,"zapis":"<64 znaki>","adres":"/gosc/<zapis>"}',
    '  2. {"op":"moj-gosc-0002","co":"poloz","rodzaj":"gosc/1","cechy":{"nazwa":"…","opis":"…","kod":"<zapis>","umowa":"okno/2"}}',
    '  Gość otwiera się w oknie na stronie głównej (/). Działa w piaskownicy: nie ma sieci, pamięci ani dostępu do adresu Miejsca; rzeczy czyta, rozmawiając z gospodarzem.',
    '  Jak gość rozmawia z gospodarzem (z gotowym przykładem do skopiowania): /umowa-okna',
    '  Gość, który żyje pod własnym adresem (np. gra): zamiast "kod" podaj "adres":"https://…".',
    '',
    'e) Propozycje: {"op":"…","co":"przyjmij","propozycja":"<id>"} albo {"op":"…","co":"odrzuc","propozycja":"<id>","powod":"…"}. Kto może: punkt 4.',
    '  Czekające propozycje: /rzeczy?rodzaj=propozycja/1&gdzie.stan=czeka',
    '',
    'f) Odkładanie i cofanie (nic nie znika; każde jest nową wersją tej samej rzeczy):',
    '  {"op":"…","co":"odloz","rzecz":"<id>","wersja":<znacznik>,"powod":"…"}   rzecz znika z list, zostaje pod adresem; wraca przez co: przywroc',
    '  {"op":"…","co":"cofnij","rzecz":"<id>","wersja":<znacznik>}             wraca treść poprzedniej wersji; z polem "do":<znacznik z historii> wraca wskazana',
    '',
    'To samo do czytania jako dane (JSON): /api/srodowisko/opis, /api/srodowisko/spis, /api/srodowisko/rzecz?id=<id>, /api/srodowisko/wersja?id=<id>&akt=<znacznik>, /api/srodowisko/ksztalty',
    'Uwaga dla skryptów: sieć przed drzwiami odrzuca (403) domyślnego klienta Pythona; ustaw nagłówek User-Agent. Polskie litery wysyłaj z pliku w UTF-8.',
    '',
    '6. CO CZEKA NA WŁAŚCICIELA',
    !d.czeka.propozycje.length && !d.czeka.prosby.length ? 'Teraz nic nie czeka.' : null,
    d.czeka.propozycje.map((p) => `  propozycja od ${p.od}: ${p.rzecz ? 'zmiana rzeczy ' + p.rzecz : 'nowa rzecz'} rodzaju ${p.rodzaj}, czeka od ${dzien(p.kiedy)} -> /rzecz/${p.id}`),
    d.czeka.prosby.map((p) => `  prośba od ${p.od} (${p.tryb}): ${obetnij(p.tresc, 140)} -> /rzecz/${p.id}`),
    `Już rozstrzygnięte (nie czekają): załatwione prośby: ${d.zalatwione.prosby} (/rzeczy?rodzaj=prosba/1&gdzie.stan=zalatwiona); propozycje przyjęte: ${d.zalatwione.propozycje_przyjete}, odrzucone: ${d.zalatwione.propozycje_odrzucone}, wycofane przez autora: ${d.zalatwione.propozycje_wycofane} (/rzeczy?rodzaj=propozycja/1). Stan każdej stoi w jej cesze stan.`,
    'Prośbę do właściciela zostawia się jako rzecz rodzaju prosba/1 ze stanem "czeka".',
    '',
    '7. SPIS CZASOWNIKÓW (wszystko, co da się tu zrobić; ten sam spis czyta strona i agent)',
    d.czasowniki.map((c) => `  ${c.nazwa}: ${c.opis}\n      którędy: ${c.ktoredy}\n      wejście: ${c.wejscie}   wynik: ${c.wynik}`),
    '',
    '8. STAN BUDOWY (co środowisko umie; każda pozycja jest rzeczą rodzaju zdolnosc/1 i zmienia się ruchem)',
    ['stoi', 'cienko', 'brak'].map((st) => d.zdolnosci.filter((z) => z.stan === st).sort((a, b) => a.nazwa.localeCompare(b.nazwa)).map((z) => `  [${stany[st]}] ${z.nazwa}: ${obetnij(z.opis, 220)}${z.jak ? `\n      ${obetnij(z.jak, 240)}` : ''}`)),
    '',
    '9. GRANICE',
    'Nieodwracalne decyzje (usuwanie, publikacja, pieniądze, dostępy, przełączenie codziennego okna właściciela) należą tylko do właściciela.',
    'Sekrety nie są danymi: żaden klucz ani token nie trafia do rzeczy; rzecz może najwyżej nosić nazwę sekretu.',
    'To jest próba: format i adresy mogą się jeszcze zmienić, a każda taka zmiana będzie widoczna w punkcie 8.',
    '',
  );
}

// Lista zawsze mówi swój zakres: ile jest wszystkich, które pokazuje i czy to już koniec. Ciało, które czyta
// w kawałkach, musi wiedzieć, czy coś mu umknęło (uwaga sędziego po dowodach, 17 XI).
export function listaRzeczy(s, { rodzaj = null, obszar, gdzie = null, szukaj = null, odlozone = 'nie', pomin = 0, ile = 300 } = {}) {
  const calkowita = (x, domyslna) => { const l = Math.trunc(Number(x)); return Number.isFinite(l) ? l : domyslna; };
  const n = Math.max(1, Math.min(1000, calkowita(ile, 300) || 300));
  const od = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, calkowita(pomin, 0)));
  const wybor = { rodzaj, ...(obszar !== undefined ? { obszar } : {}), gdzie, szukaj, odlozone };
  const razem = s.ile(wybor);
  const rz = s.spis({ ...wybor, limit: n, pomin: od });
  const koniec = od + rz.length >= razem;
  const filtr = [rodzaj ? 'rodzaj=' + encodeURIComponent(rodzaj).replace(/%2F/g, '/') : null, obszar !== undefined ? 'obszar=' + (obszar || '') : null,
    ...Object.entries(gdzie || {}).map(([k, w]) => `gdzie.${k}=${encodeURIComponent(String(w))}`), szukaj ? 'szukaj=' + encodeURIComponent(szukaj) : null, odlozone !== 'nie' ? 'odlozone=' + odlozone : null].filter(Boolean).join('&');
  const dalej = `/rzeczy?${filtr ? filtr + '&' : ''}pomin=${od + rz.length}&ile=${n}`;
  const nazwaObszaru = (id) => { if (!id) return 'główny'; const o = s.rzecz(id); return o ? s.tytul(o) : id; };
  const opisWyboru = [gdzie && Object.keys(gdzie).length ? 'gdzie ' + Object.entries(gdzie).map(([k, w]) => `${k} = ${obetnij(String(w), 40)}`).join(' i ') : null, szukaj ? `ze słowem "${obetnij(szukaj, 40)}"` : null, odlozone === 'tak' ? 'tylko odłożone' : odlozone === 'razem' ? 'razem z odłożonymi' : null].filter(Boolean).join(', ');
  return wiersze(
    `RZECZY${rodzaj ? ' rodzaju ' + obetnij(rodzaj, 90) : ''}${obszar !== undefined ? ' w obszarze ' + nazwaObszaru(obszar) : ''}${opisWyboru ? ' (' + opisWyboru + ')' : ''}: ${razem}`,
    rz.length ? `ZAKRES: pokazuję ${rz.length} z ${razem}, pozycje od ${od + 1} do ${od + rz.length}, od ostatnio zmienionej. ${koniec ? 'To jest koniec listy: nic więcej nie ma.' : 'To NIE jest cała lista. Dalszy ciąg: ' + dalej}` : `ZAKRES: lista jest pusta${od ? ' od pozycji ' + (od + 1) : ''}; wszystkich rzeczy w tym wyborze jest ${razem}.`,
    'Każdy wiersz: tytuł [rodzaj] id, obszar, ostatnia zmiana. Jedna rzecz z historią: /rzecz/<id>. Wszystko o Miejscu: /co-tu-jest',
    '',
    rz.map((x) => `${obetnij(s.tytul(x), 80)} [${x.rodzaj}] ${x.id}, obszar: ${nazwaObszaru(x.obszar)}, zmienił ${x.zmienil} ${dzien(x.zmieniono)}${x.odlozone ? ', ODŁOŻONA' : ''}`),
    '',
    koniec ? `KONIEC LISTY (pokazano ${od + rz.length} z ${razem}).` : `CIĄG DALSZY: ${dalej}   (pokazano ${od + rz.length} z ${razem})`,
    '',
  );
}

function cechaTekstem(def) {
  const d = typeof def === 'string' ? { typ: def } : def || {};
  const dod = [d.wymagana ? 'wymagana' : null, d.typ === 'rzecz' && d.rodzaj ? 'rodzaju ' + d.rodzaj : null, d.typ === 'lista' ? 'elementy: ' + (typeof d.z === 'string' ? d.z : JSON.stringify(d.z)) : null, d.typ === 'wybor' ? 'wartości: ' + (d.wartosci || []).join(', ') : null].filter(Boolean);
  return `${d.typ}${dod.length ? ' (' + dod.join('; ') + ')' : ''}${d.opis ? ': ' + d.opis : ''}`;
}

export function listaRodzajow(s) {
  const ks = [...s.ksztalty().values()].sort((a, b) => a.cechy.dla.localeCompare(b.cechy.dla));
  return wiersze(
    `RODZAJE RZECZY: ${ks.length}`,
    'Każdy rodzaj jest opisany rzeczą rodzaju ksztalt/1. Nowy rodzaj dokłada się ruchem: /co-tu-jest, punkt 5c.',
    '',
    ks.map((k) => [`${k.cechy.dla}: ${k.cechy.opis}   (kształt: /rzecz/${k.id}${k.cechy.uklad ? '; układ' : ''})`, Object.entries(k.cechy.cechy || {}).map(([n, def]) => `    ${n}: ${cechaTekstem(def)}`), '']),
  );
}

export function stronaRodzaju(s, rodzaj) {
  // Nazwa z adresu trafia do tekstu, więc najpierw musi być nazwą rodzaju, a nie czymkolwiek.
  if (typeof rodzaj !== 'string' || !/^[a-z][a-z0-9_.-]{0,79}(\/[1-9][0-9]{0,5})?$/.test(rodzaj)) return wiersze('To nie jest nazwa rodzaju (małe litery, cyfry, kropka, - i _, potem /numer, np. projekt/1). Wszystkie rodzaje: /rodzaje', '');
  const k = s.ksztalty().get(rodzaj);
  const ile = (s.liczby().find((l) => l.rodzaj === rodzaj) || { ile: 0 }).ile;
  if (!k) return wiersze(`RODZAJ ${rodzaj}`, ile ? `Ten rodzaj nie ma kształtu: jest ${ile} rzeczy, ale nikt nie opisał ich cech. Kształt dokłada się ruchem: /co-tu-jest, punkt 5c.` : 'Nie ma takiego rodzaju. Wszystkie rodzaje: /rodzaje', '');
  const przyklad = Object.fromEntries(Object.entries(k.cechy.cechy || {}).filter(([, d]) => d && d.wymagana).map(([n, d]) => [n, d.typ === 'liczba' ? 0 : d.typ === 'tak-nie' ? false : d.typ === 'lista' ? [] : d.typ === 'wybor' ? (d.wartosci || [''])[0] : d.typ === 'rzecz' ? '<id rzeczy>' : d.typ === 'zapis' ? '<id zapisu>' : d.typ === 'czas' ? '2026-11-17T12:00:00Z' : d.typ === 'adres' ? 'https://przyklad.pl/' : d.typ === 'dowolne' ? {} : '…']));
  return wiersze(
    `RODZAJ ${rodzaj}`,
    k.cechy.opis,
    `Rzeczy tego rodzaju: ${ile} -> /rzeczy?rodzaj=${rodzaj}   Kształt jest rzeczą: /rzecz/${k.id} (wersja ${k.wersja}, ostatnio zmienił ${k.zmienil})`,
    k.cechy.uklad ? 'To rodzaj układu: w obszarze z ustawieniem porzadkowac agent może go zmieniać ze skutkiem.' : null,
    '',
    'CECHY',
    Object.entries(k.cechy.cechy || {}).map(([n, def]) => `  ${n}: ${cechaTekstem(def)}`),
    `  nazwa rzeczy: cecha ${k.cechy.tytul || 'nazwa'}`,
    Array.isArray(k.cechy.klucz) ? `  klucz (tożsamość rzeczy liczy się z tych cech; druga rzecz o tym samym kluczu nie powstanie): ${k.cechy.klucz.join(', ')}` : null,
    '',
    'JAK DOŁOŻYĆ RZECZ TEGO RODZAJU',
    `  POST /api/srodowisko/ruch   {"op":"<twój identyfikator czynności>","co":"poloz","rodzaj":"${rodzaj}","cechy":${JSON.stringify(przyklad)}}`,
    '  Pełny opis drzwi: /co-tu-jest, punkt 5.',
    '',
  );
}

export function stronaRzeczy(s, id, { kto = null } = {}) {
  const rz = s.rzecz(id);
  if (!rz) return null;
  const h = s.historia(id);
  const wsk = s.wskazujaNa(id);
  const k = s.ksztaltDla(rz.rodzaj);
  const ob = rz.obszar ? s.rzecz(rz.obszar) : null;
  const prawo = s.prawo(kto, { rodzaj: rz.rodzaj, obszar: rz.obszar, rzecz: rz });
  const wart = (w) => (typeof w === 'string' ? w : JSON.stringify(w));
  const jestObszarem = rz.rodzaj === 'obszar/1';
  return wiersze(
    `RZECZ: ${s.tytul(rz)}${rz.odlozone ? '   [ODŁOŻONA]' : ''}`,
    `id: ${rz.id}   rodzaj: ${rz.rodzaj}${k ? ` (-> /rodzaj/${rz.rodzaj})` : ' (rodzaj bez kształtu)'}   numer wersji: ${rz.numer}   wersja (znacznik do zmiany): ${rz.wersja}`,
    rz.odlozone ? `Ta rzecz jest odłożona${rz.powod ? ': ' + obetnij(rz.powod, 300) : ''}. Listy jej nie pokazują; wraca ruchem co: przywroc.` : null,
    `leży w obszarze: ${ob ? `${s.tytul(ob)} (id ${ob.id})` : 'główny'}; tam ile_wolno agentom: ${s.ustawienie(rz.obszar, 'ile_wolno').wartosc}`,
    jestObszarem ? `sama jest obszarem: rzeczom, które w niej leżą, daje ile_wolno agentom: ${s.ustawienie(rz.id, 'ile_wolno').wartosc}; leży w niej ${s.ile({ obszar: rz.id })} rzeczy (/rzeczy?obszar=${rz.id})` : null,
    `dołożył: ${rz.utworzyl}, ${dzien(rz.utworzono)}   ostatnio zmienił: ${rz.zmienil}, ${dzien(rz.zmieniono)}`,
    '',
    'CECHY',
    Object.keys(rz.cechy).length ? Object.entries(rz.cechy).map(([n, w]) => `  ${n}${k && !(n in (k.cechy || {})) ? ' [cecha spoza kształtu]' : ''}: ${obetnij(wart(w), 2000)}`) : '  (żadnych)',
    rz.rodzaj === 'gosc/1' && rz.cechy.kod ? `  kod gościa pod adresem: /gosc/${rz.cechy.kod}` : null,
    '',
    `HISTORIA (${h.length}; każda wersja: numer, znacznik, kiedy, kto; treść dawnej wersji: /api/srodowisko/wersja?id=${rz.id}&akt=<znacznik>)`,
    h.map((a) => `  wersja ${a.numer}, znacznik ${a.akt}, ${dzien(a.kiedy)}, ${a.kto}${a.cialo ? ' [' + a.cialo + ']' : ''}`),
    '',
    wsk.length ? `CO NA NIĄ WSKAZUJE (${wsk.length})` : 'Nic na nią nie wskazuje.',
    wsk.map((w) => { const x = s.rzecz(w.od); return `  ${x ? obetnij(s.tytul(x), 70) + ' [' + x.rodzaj + ']' : '?'} przez cechę ${w.cecha} -> /rzecz/${w.od}`; }),
    '',
    'CO MOŻESZ Z NIĄ ZROBIĆ',
    prawo.tryb === 'skutek' ? '  Twój ruch na tej rzeczy ma skutek od razu.' : prawo.tryb === 'propozycja' ? `  Twój ruch na tej rzeczy stanie się propozycją: ${prawo.powod}.` : `  ${prawo.powod}.`,
    rz.rodzaj === 'propozycja/1'
      ? (rz.cechy.stan === 'czeka' ? `  Rozstrzygnięcie: {"op":"…","co":"przyjmij","propozycja":"${rz.id}"} albo {"op":"…","co":"odrzuc","propozycja":"${rz.id}","powod":"…"}   (kto może: /co-tu-jest, punkt 4${rz.cechy.wymaga === 'wlasciciel' ? '; tę przyjmuje tylko właściciel' : ''})` : `  Ta propozycja jest już rozstrzygnięta: ${rz.cechy.stan}.`)
      : [
        `  Zmiana: POST /api/srodowisko/ruch   {"op":"<twój identyfikator>","co":"poloz","rzecz":"${rz.id}","wersja":${rz.wersja},"rodzaj":"${rz.rodzaj}","cechy":{…wszystkie cechy…}}`,
        rz.odlozone ? `  Przywrócenie: {"op":"…","co":"przywroc","rzecz":"${rz.id}","wersja":${rz.wersja}}` : `  Odłożenie: {"op":"…","co":"odloz","rzecz":"${rz.id}","wersja":${rz.wersja},"powod":"…"}`,
        h.length > 1 ? `  Cofnięcie do poprzedniej wersji: {"op":"…","co":"cofnij","rzecz":"${rz.id}","wersja":${rz.wersja}}   (do innej: dodaj "do":<znacznik z historii>)` : null,
      ],
    '  Wszystko o Miejscu: /co-tu-jest',
    '',
  );
}

export function umowaOkna() {
  return wiersze(
    'UMOWA OKNA, POKOLENIE 2 (okno/2)',
    'Jak gość (narzędzie albo widok otwarty w oknie Jaskini) rozmawia z gospodarzem, czyli stroną, która go otworzyła.',
    'Pokolenie 1 to kontrakt przyrządu starej Jaskini (hello, state, signals, event, flag); pokolenie 2 dokłada czytanie rzeczy.',
    'Gość pokolenia 1 działa u gospodarza pokolenia 2 bez zmian. Nieznane typy wiadomości i nieznane pola obie strony pomijają.',
    '',
    'GDZIE ŻYJE GOŚĆ',
    'Gość z cechą "kod" to jeden plik HTML zapisany w Miejscu. Gospodarz otwiera go w ramce, w piaskownicy:',
    '  - wolno: skrypty i style wpisane w ten sam plik, obrazy z data: i blob:;',
    '  - nie wolno: sieci (fetch, WebSocket, zewnętrzne skrypty, czcionki i obrazy z adresów), pamięci przeglądarki (localStorage, ciasteczka), formularzy, wyskakujących okien;',
    '  - gość nie widzi strony gospodarza ani jego klucza. Wszystko, czego potrzebuje, dostaje wiadomościami.',
    'Gość z cechą "adres" żyje pod własnym adresem i ma tam własną pamięć i sieć; umowa jest ta sama.',
    '',
    'WIADOMOŚCI',
    'Zwykłe obiekty wysyłane przez postMessage, zawsze z polem jaskinia: 1 i polem type.',
    'Gość pisze do gospodarza: window.parent.postMessage({jaskinia: 1, type: …}, "*")',
    'Gość słucha: addEventListener("message", e => { if (e.source !== window.parent || !e.data || e.data.jaskinia !== 1) return; … })',
    '',
    'Od gościa:',
    '  hello    {name (do 60 znaków), version (do 40), wants: ["rzeczy"]}   przedstaw się; wants: ["rzeczy"] znaczy, że chcesz czytać rzeczy i dostawać "changed"',
    '  read     {id, what: "spis", rodzaj?, obszar?, gdzie?, szukaj?, pomin?}   lista rzeczy; rodzaj np. "projekt/1" (z pokoleniem) albo samo "projekt" (wszystkie pokolenia);',
    '                                                    gdzie: {cecha: wartość}, np. {stan: "czeka"}; szukaj: słowo w którejkolwiek cesze',
    '  read     {id, what: "rzecz", rzecz: "<id>"}       jedna rzecz z historią',
    '  read     {id, what: "ksztalty"}                   rodzaje rzeczy z opisem cech',
    '  read     {id, what: "ja"}                         kim jest czytający i jako który gość jesteś otwarty',
    '  state    {text (do 240 znaków), data? (JSON do 8 KB)}   co się u Ciebie dzieje; gospodarz pokazuje tekst pod oknem',
    '  signals  {values: {nazwa: liczba}}                liczby na żywo (do 24)',
    '  event    {text (do 200), level: "info"|"uwaga"|"blad"}',
    '  flag     {}                                       właściciel chce zostawić uwagę przy tym gościu',
    '',
    'Od gospodarza:',
    '  hi       {v: 2}                                   po załadowaniu strony; odpowiedz hello',
    '  result   {id, ok: true, data} albo {id, ok: false, error}   odpowiedź na read o tym samym id',
    '  changed  {akt}                                    w Miejscu coś się zmieniło; jeśli pokazujesz rzeczy, przeczytaj je znowu',
    '  visible  {visible: true|false}                    okno schowane albo znowu widoczne; schowany gość może odpocząć',
    '  remark   {text, at}                               uwaga właściciela, tylko gdy prosiłeś o nią w hello (wants: ["remark"])',
    '',
    'Kształt danych:',
    '  read spis     -> {rzeczy: [{id, rodzaj, obszar, cechy, tytul, wersja, numer, utworzyl, utworzono, zmienil, zmieniono}], razem, pokazane, pominiete, wszystko}',
    '  read rzecz    -> {rzecz: {…jak wyżej…}, historia: [{numer, akt, kto, kiedy}], wskazuja: [{od, cecha}]}',
    'Daty (utworzono, zmieniono, kiedy) są w zapisie ISO 8601 w czasie UTC, więc porządkują się jak zwykłe napisy. numer to która to wersja rzeczy; wersja to znacznik do zmiany.',
    '  read ksztalty -> {ksztalty: [{dla, opis, tytul, cechy: {nazwa: {typ, opis, wymagana}}, rzecz}]}',
    '  read ja       -> {uczestnik: {imie, rola}, gosc: {rzecz, nazwa}}',
    'Pole obszar w rzeczy to identyfikator rzeczy rodzaju obszar/1 (jej nazwa stoi w cesze nazwa) albo null, czyli obszar główny.',
    'Nazwy obszarów dostaniesz przez read spis z rodzaj: "obszar". Rzecz leży dokładnie w jednym obszarze; obszary tworzą drzewo (obszar też ma pole obszar).',
    'read spis oddaje najwyżej 1000 rzeczy, od ostatnio zmienionej; pole razem mówi, ile jest wszystkich, a wszystko: true, że to cała lista. Dalszy kawałek: pomin: <ile już masz>.',
    '',
    'NAJMNIEJSZY DZIAŁAJĄCY GOŚĆ (cały plik; skopiuj i zmień funkcję pokaz)',
    '<!doctype html>',
    '<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mój gość</title></head>',
    '<body><p id="stan">Czekam na gospodarza…</p><div id="tu"></div>',
    '<script>',
    'const gospodarz = window.parent; let nr = 0; const czekaja = new Map();',
    'const powiedz = (m) => gospodarz.postMessage({ jaskinia: 1, ...m }, "*");',
    'function czytaj(what, wiecej) { return new Promise((tak, nie) => { const id = ++nr; czekaja.set(id, { tak, nie }); powiedz({ type: "read", id, what, ...wiecej }); setTimeout(() => { if (czekaja.delete(id)) nie(new Error("gospodarz nie odpowiedział")); }, 8000); }); }',
    'addEventListener("message", (e) => { const m = e.data; if (e.source !== gospodarz || !m || m.jaskinia !== 1) return;',
    '  if (m.type === "hi") { powiedz({ type: "hello", name: "Mój gość", version: "1", wants: ["rzeczy"] }); pokaz(); }',
    '  else if (m.type === "result") { const c = czekaja.get(m.id); if (c) { czekaja.delete(m.id); m.ok ? c.tak(m.data) : c.nie(new Error(m.error)); } }',
    '  else if (m.type === "changed") pokaz(); });',
    'async function pokaz() { const d = await czytaj("spis", {}); document.getElementById("stan").textContent = d.rzeczy.length + " rzeczy";',
    '  document.getElementById("tu").textContent = d.rzeczy.map((r) => r.tytul + " [" + r.rodzaj + "]").join(" · "); powiedz({ type: "state", text: d.rzeczy.length + " rzeczy" }); }',
    'powiedz({ type: "hello", name: "Mój gość", version: "1", wants: ["rzeczy"] });',
    '</script></body></html>',
    '',
    'JAK GO ZGŁOSIĆ: /co-tu-jest, punkt 5d (dwa żądania: kod, potem rzecz rodzaju gosc/1). Potem otwórz stronę główną (/): gość jest na liście i otwiera się w oknie.',
    'Sprawdzenie bez przeglądarki: od chwili zgłoszenia gościa /gosc/<zapis> oddaje dokładnie ten plik, a /rzecz/<id gościa> pokazuje jego cechy.',
    'Gospodarz wysyła hi po załadowaniu ramki; jeśli gość wyśle hello wcześniej, też dobrze (hello można wysłać więcej niż raz).',
    '',
    'CZEGO JESZCZE NIE MA: ruchów z okna (gość na razie tylko czyta), własnej tożsamości gościa przy czytaniu, wołania czasowników gościa,',
    'osadzania jednego gościa w drugim, okna w przestrzeni Startu, pamięci gościa.',
    '',
  );
}
