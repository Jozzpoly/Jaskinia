// Obserwator faktów: sam przynosi do Miejsca fakty o publicznych repozytoriach właściciela (17 XI 2026).
// Status: próba (TYMCZASOWE.md). Wchłania `fakty.mjs`: lista repozytoriów nadal pochodzi z `zbierz`, a trzy zasady
// dawcy przeszły dalej bez zmian:
//   1. nieznane to nie zero: odpowiedź niepełna albo nieudana niczego nie odkłada, a luka zostaje w wyniku i w mierze;
//   2. fakty mówią, ile mają lat: każda rzecz niesie `stan_na`, a miara chwilę ostatniego UDANEGO obejścia;
//   3. gorszy wynik nie nadpisuje lepszego: nieudane obejście nie rusza liczby ani chwili ostatniego dobrego,
//      dopisuje tylko, że próba się nie udała.
// Obserwator jest uczestnikiem jak każdy inny (imię `obserwator`, rola automat) i chodzi zwykłym `s.ruch`, więc prawo
// do skutku bierze z danych: obszar Fakty ma ile_wolno: prowadzic. Niczego tu nie omijamy bokiem.
// Zapisuje tylko to, co się zmieniło, bo każda zapisana wersja kosztuje dziennik, a rzecz bez zmian nie ma historii.
//
// DWA ŹRÓDŁA (17 XI 2026). Pierwsze to API GitHuba; bez tokenu odmawia z adresów Cloudflare (403), więc jest drugie:
// publiczny plik faktów starej Jaskini (zwykły plik JSON bez limitu API, bez numeru repozytorium; stara Jaskinia sama go
// odświeża zwykle dwa razy na dobę, więc fakty są tak świeże, jak jej ostatnie odświeżenie; `estate.generated` mówi, ile mają lat).
//   - API działa: pierwszeństwo ma API; plik tylko DOKŁADA to, czego API nie zna (rodzina, tożsamość, ładna nazwa, życie,
//     stos, commity, temat gałęzi), niczego z API nie nadpisując;
//   - API odmawia, a plik jest: fakty idą z pliku, każda rzecz ze stan_na równym wiekowi pliku (estate.generated);
//   - trzecia zasada dosłownie po wieku: rzecz, której stan_na jest NOWSZY niż wiek pliku, nie jest przez plik zmieniana;
//     wolno jej tylko dołożyć cechy, których nie ma;
//   - z pliku odkłada się tylko ostrożnie i odwracalnie: plik musi być PEŁNY (estate.coverage bez braków), NOWSZY niż fakty
//     odkładanej rzeczy, a bezpiecznik chroni przed błędem źródła (zob. ścieżka A w obejdzRaz). Odłożenie przywraca tylko plik
//     nowszy niż ono i tylko wtedy, gdy odłożył sam obserwator: gest człowieka jest ważniejszy niż automat.
// Tożsamość repozytorium to pełna nazwa małymi literami (klucz kształtu), bo tylko ją znają oba źródła.
import { WLASCICIEL, zbierz } from './fakty.mjs';
import { skrot } from './miejsce.mjs';
// Adresy z zewnątrz sprawdza ta sama reguła, którą warstwa środowiska sprawdza cechę typu adres (nie jej kopia).
import { poprawnyAdres as adresOk } from './srodowisko.mjs';

export const OBSERWATOR = 'obserwator';
export const MIARA = 'obserwator-faktow';
export const ZR_API = 'GitHub API';
export const ZR_PLIK = 'plik faktów starej Jaskini';
export const ZR_OBA = `${ZR_API}, uzupełnione z pliku faktów starej Jaskini`;
// Miara z pliku zaczyna swoje źródło od tych słów; po nich /co-tu-jest rozpoznaje, że fakty są z pliku.
export const PREFIKS_PLIKU = 'Plik faktów starej Jaskini';
const KURSOR = 'obserwator:kursor'; // pełna nazwa ostatniego repozytorium, któremu sprawdzono gałęzie; 0 = zacznij od początku
const KOLO = 'obserwator:kolo'; // ile zmian zapisano w bieżącym kole gałęzi: koło bez zmian to koło spokojne
const PROBA = 'obserwator:proba'; // ostatnia próba (także nieudana): czas, stan i skrót luk, żeby awaria była widoczna
const STRON_GALEZI = 3;
const WZOR_WLASCICIELA = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;

// Cechy, które zna API (i tylko je wolno z API nadpisywać), oraz te, które przynosi wyłącznie plik.
const REPO_API = ['pelna_nazwa', 'github_id', 'nazwa', 'adres', 'opis', 'strona', 'jezyk', 'archiwum', 'ostatni_push', 'utworzone', 'galezie'];
const REPO_PLIKOWE = ['ladna_nazwa', 'tozsamosc', 'rodzina', 'zycie', 'commity', 'stos', 'karta', 'wejscie'];
const REPO_Z_PLIKU = ['pelna_nazwa', 'nazwa', 'adres', 'opis', 'strona', 'ostatni_push', 'utworzone', ...REPO_PLIKOWE, 'zrodlo_faktow'];
// kiedy i temat przynosi tylko plik, ale znikają z gałęzi, gdy jej commit się zmienił (temat starego commita byłby fałszem)
const GALAZ_CECHY = ['repo', 'nazwa', 'commit', 'kiedy', 'temat'];
const RODZINA_CECHY = ['znak', 'nazwa', 'pytanie'];
const MAX_PLIKU = 8 * 1024 * 1024; // plik ma ok. 400 KB; dużo większy to nie ten plik
const WZOR_REPO = /^[A-Za-z0-9._-]{1,100}$/;
const WZOR_ZNAKU = /^[A-Za-z0-9_-]{1,40}$/;

// Dwa obejścia jednocześnie (alarm i ręczna prośba) nie mogą czytać tego samego kursora i pisać po sobie.
const KOLEJKI = new WeakMap();

const odcisk = async (x) => (await skrot(JSON.stringify(x))).slice(0, 14);
const krotko = (e) => String((e && e.message) || e).slice(0, 160);
const pelnaNazwa = (owner, nazwa) => `${owner}/${nazwa}`.toLowerCase();
const tekstLubNull = (w, max = 2000) => (typeof w === 'string' && w.trim() ? w.trim().slice(0, max) : null);
const czasLubNull = (w) => (typeof w === 'string' && w.length <= 40 && /^\d{4}-\d{2}-\d{2}(T[0-9:.+Zz-]*)?$/.test(w) && !Number.isNaN(Date.parse(w)) ? w : null);
const iso0 = (ms) => new Date(ms).toISOString();

function stronaRepo(r, owner) {
  const h = typeof r.homepage === 'string' ? r.homepage.trim() : '';
  if (h && adresOk(h)) return h;
  if (r.pages) {
    const o = owner.toLowerCase();
    // repozytorium `<właściciel>.github.io` to strona właściciela, bez nazwy repozytorium w adresie
    return r.nazwa.toLowerCase() === `${o}.github.io` ? `https://${o}.github.io/` : `https://${o}.github.io/${r.nazwa}/`;
  }
  return null;
}

// Gałęzie jednego repozytorium: do trzech stron po sto. Wynik mówi, czy lista jest PEŁNA: tylko z pełnej wolno
// cokolwiek odkładać. `stop` znaczy, że dalsze pytania nie mają sensu (limit albo sieć).
async function pobierzGalezie(fetchFn, naglowki, owner, nazwa) {
  const galezie = [];
  const widziane = new Set();
  let pelna = true, luka = null;
  for (let strona = 1; strona <= STRON_GALEZI; strona++) {
    let odp;
    try {
      odp = await fetchFn(`https://api.github.com/repos/${owner}/${encodeURIComponent(nazwa)}/branches?per_page=100&page=${strona}`, { headers: naglowki });
    } catch (e) {
      return { stop: true, pelna: false, galezie: [], luka: { gdzie: 'galezie', repo: nazwa, blad: 'sieć: ' + krotko(e) } };
    }
    if (!odp.ok) {
      return { stop: odp.status === 403 || odp.status === 429, pelna: false, galezie: [], luka: { gdzie: 'galezie', repo: nazwa, status: odp.status, zostalo_zapytan: odp.headers.get('x-ratelimit-remaining') } };
    }
    const lista = await odp.json().catch(() => null);
    if (!Array.isArray(lista)) return { stop: false, pelna: false, galezie: [], luka: { gdzie: 'galezie', repo: nazwa, blad: 'odpowiedź nie jest listą' } };
    for (const b of lista) {
      if (!b || typeof b.name !== 'string' || !b.name) { pelna = false; luka = luka || { gdzie: 'galezie', repo: nazwa, blad: 'gałąź bez nazwy w odpowiedzi' }; continue; }
      if (widziane.has(b.name)) continue;
      widziane.add(b.name);
      const sha = b.commit && typeof b.commit.sha === 'string' ? b.commit.sha.slice(0, 7) : null;
      galezie.push({ nazwa: b.name, commit: sha });
    }
    if (lista.length < 100) break;
    if (strona === STRON_GALEZI) { pelna = false; luka = luka || { gdzie: 'galezie', repo: nazwa, blad: `więcej niż ${STRON_GALEZI * 100} gałęzi: dalszych stron nie czytam` }; }
  }
  return { stop: false, pelna, galezie, ...(luka ? { luka } : {}) };
}

// Plik faktów starej Jaskini: odczyt, który niczego nie wykonuje i nikomu nie ufa. Zły JSON, brak pól, inny status niż 200
// i błąd sieci dają stan 'brak' i lukę, nigdy wyjątek. Repozytoria, które nie są wprost publiczne (private różne od false),
// pomijamy. Pojedynczy zepsuty wpis to luka i pominięcie wpisu, reszta pliku zostaje; pusta lista repozytoriów to 'brak'
// (nieznane to nie zero). Wynik: { stan: 'ok'|'brak', zebrane (ISO z estate.generated), repos, rodziny, luki }.
export async function zBiblioteki({ fetchFn = fetch, adres, teraz = Date.now() } = {}) {
  void teraz;
  const wynik = { stan: 'brak', zebrane: null, pelny: false, repos: [], rodziny: [], luki: [] };
  let pominiete = 0; // wpisy repozytoriów pominięte z luką: plik z takimi nie jest pełny
  const brak = (blad, extra = {}) => { wynik.luki.push({ gdzie: 'plik', blad, ...extra }); wynik.stan = 'brak'; wynik.pelny = false; wynik.zebrane = null; wynik.repos = []; wynik.rodziny = []; return wynik; };
  try {
    if (!adresOk(adres)) return brak('adres pliku faktów nie jest poprawnym adresem http ani https');
    let odp;
    try { odp = await fetchFn(adres, { headers: { 'user-agent': 'jaskinia-obserwator-faktow', accept: 'application/json' } }); }
    catch (e) { return brak('sieć: ' + krotko(e)); }
    if (!odp || !odp.ok) return brak('plik faktów odpowiedział statusem ' + (odp && odp.status), { status: odp ? odp.status : null });
    let napis;
    try { napis = await odp.text(); } catch (e) { return brak('odczyt pliku faktów się urwał: ' + krotko(e)); }
    if (typeof napis !== 'string' || napis.length > MAX_PLIKU) return brak('plik faktów jest pusty albo większy niż ' + MAX_PLIKU + ' bajtów');
    let d;
    try { d = JSON.parse(napis); } catch { return brak('plik faktów nie jest poprawnym JSON-em'); }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return brak('plik faktów nie jest obiektem');
    const gen = d.estate && typeof d.estate.generated === 'string' ? Date.parse(d.estate.generated) : NaN;
    if (!Number.isFinite(gen)) return brak('plik nie ma poprawnego estate.generated: nie wiadomo, jak stare są fakty');
    if (!Array.isArray(d.repos)) return brak('plik nie ma listy repos');
    const znane = new Set();
    for (const f of Array.isArray(d.families) ? d.families : []) {
      const nazwa = f && tekstLubNull(f.name, 200);
      if (!f || typeof f.id !== 'string' || !WZOR_ZNAKU.test(f.id) || !nazwa) { wynik.luki.push({ gdzie: 'plik', blad: 'rodzina bez poprawnego id albo nazwy: pominięta' }); continue; }
      if (znane.has(f.id)) continue;
      znane.add(f.id);
      const pytanie = tekstLubNull(f.question, 1000);
      wynik.rodziny.push({ znak: f.id, nazwa, ...(pytanie ? { pytanie } : {}) });
    }
    const widziane = new Set();
    for (const x of d.repos) {
      if (!x || typeof x !== 'object' || typeof x.name !== 'string' || !WZOR_REPO.test(x.name)) { pominiete++; wynik.luki.push({ gdzie: 'plik', blad: 'repozytorium bez poprawnej nazwy: pominięte' }); continue; }
      if (x.private === true) continue;
      if (x.private !== false) { pominiete++; wynik.luki.push({ gdzie: 'plik', repo: x.name, blad: 'repozytorium bez pola private: pominięte (nie wiadomo, czy jest publiczne)' }); continue; }
      const k = x.name.toLowerCase();
      if (widziane.has(k)) continue;
      widziane.add(k);
      const galezie = [];
      const gw = new Set();
      for (const b of Array.isArray(x.branches) ? x.branches : []) {
        if (!b || typeof b.n !== 'string' || !b.n || b.n.length > 300 || gw.has(b.n)) continue;
        gw.add(b.n);
        const ms = Number.isFinite(b.ts) && b.ts > 0 && b.ts < 8.6e12 ? b.ts * 1000 : null;
        galezie.push({
          nazwa: b.n, commit: typeof b.sha === 'string' && /^[0-9a-f]{7,40}$/i.test(b.sha) ? b.sha.slice(0, 7).toLowerCase() : null,
          kiedy: ms === null ? null : iso0(ms).replace('.000Z', 'Z'), temat: tekstLubNull(b.s, 200),
        });
      }
      const stos = Array.isArray(x.stack) ? x.stack.filter((z) => typeof z === 'string' && z.trim()).map((z) => z.trim().slice(0, 80)).slice(0, 40) : [];
      wynik.repos.push({
        nazwa: x.name, ladna: tekstLubNull(x.short, 200), rodzina: typeof x.family === 'string' && znane.has(x.family) ? x.family : null,
        tozsamosc: tekstLubNull(x.identity, 1000), opis: tekstLubNull(x.desc, 2000), adres: adresOk(x.url) ? x.url : null, strona: adresOk(x.pages) ? x.pages : null,
        utworzone: czasLubNull(x.created), ostatni_push: czasLubNull(x.pushed), zycie: tekstLubNull(x.life, 80),
        commity: Number.isSafeInteger(x.commits) && x.commits >= 0 ? x.commits : null, stos, galezie,
        // tab: gra, która ma się otwierać w osobnej karcie (ramka dzieli pamięć gry); tylko prawda daje cechę
        karta: x.tab === true, wejscie: tekstLubNull(x.wejscie && x.wejscie.dlaczego, 600),
        // puste repozytorium nie ma gałęzi: zero gałęzi u niepustego to błąd źródła, a nie fakt
        puste: x.empty === true,
      });
    }
    if (!wynik.repos.length) return brak('plik nie zawiera żadnego publicznego repozytorium z poprawną nazwą');
    wynik.zebrane = iso0(gen);
    // Plik jest PEŁNY, gdy sam to o sobie mówi spójnie (estate.coverage) i gdy my przeczytaliśmy tyle, ile obiecuje. Tylko
    // z pełnego pliku wolno cokolwiek odkładać: brak czegoś w niepełnym nie znaczy, że to zniknęło.
    const cov = d.estate.coverage;
    wynik.pelny = !!cov && typeof cov === 'object' && !Array.isArray(cov)
      && Number.isInteger(cov.expected) && Number.isInteger(cov.collected) && cov.expected === cov.collected
      && Array.isArray(cov.missing) && cov.missing.length === 0 && Array.isArray(cov.unlisted) && cov.unlisted.length === 0
      && cov.public === wynik.repos.length && pominiete === 0;
    wynik.stan = 'ok';
    return wynik;
  } catch (e) {
    return brak('plik faktów: nieoczekiwany błąd: ' + krotko(e));
  }
}

// Rzecz odłożoną plik przywraca tylko wtedy, gdy odłożył ją sam obserwator, a plik jest nowszy niż to odłożenie (pole zmieniono).
// Odłożoną ręką właściciela albo agenta zostawiamy: decyzja człowieka jest ważniejsza niż automat.
const mozeWrocic = (rz, zebrane) => rz.zmienil === OBSERWATOR && Date.parse(zebrane) > Date.parse(rz.zmieniono);

// Co wolno zapisać z faktów o wieku `zebrane` na rzecz, która już jest. Rzecz NOWSZA niż fakty dostaje tylko cechy,
// których nie miała (a temat i kiedy gałęzi tylko wtedy, gdy ma ten sam commit); równa albo starsza jest zmieniana
// w cechach `zarz`. Rzecz odłożoną ocenia przedtem `mozeWrocic`. Zwraca { nowe, zarz, stanNa }.
function wedlugWieku(rz, nowe, zarz, zebrane) {
  if (!rz) return { nowe, zarz, stanNa: zebrane };
  if (!(Date.parse(rz.cechy.stan_na) > Date.parse(zebrane))) return { nowe, zarz, stanNa: zebrane };
  const innyCommit = !!(rz.cechy.commit && nowe.commit && rz.cechy.commit !== nowe.commit);
  const brakujace = zarz.filter((k) => rz.cechy[k] === undefined && nowe[k] !== undefined && !(innyCommit && (k === 'kiedy' || k === 'temat')));
  const n = Object.fromEntries(brakujace.map((k) => [k, nowe[k]]));
  if (brakujace.length && zarz.includes('zrodlo_faktow') && String(rz.cechy.zrodlo_faktow || '').startsWith(ZR_API)) { n.zrodlo_faktow = ZR_OBA; brakujace.push('zrodlo_faktow'); }
  return { nowe: n, zarz: brakujace, stanNa: rz.cechy.stan_na };
}

// Krótkie zdanie o lukach do miary i do /co-tu-jest: gdzie i co (bez żadnych sekretów, tylko statusy i błędy sieci).
function opisLuk(luki) {
  if (!luki.length) return 'brak';
  const kawalki = luki.slice(0, 3).map((l) => `${l.repo || l.gdzie || '?'}: ${l.status || l.blad || '?'}`);
  const t = `${luki.length} (${kawalki.join('; ')}${luki.length > 3 ? '; …' : ''})`;
  return t.length > 300 ? t.slice(0, 299) + '…' : t;
}

export function obejdz(s, opcje = {}) {
  const poprzednie = KOLEJKI.get(s) || Promise.resolve();
  const p = poprzednie.then(() => obejdzRaz(s, opcje));
  KOLEJKI.set(s, p.then(() => {}, () => {}));
  return p;
}

async function obejdzRaz(s, { fetchFn = fetch, token = null, owner = WLASCICIEL, teraz = Date.now(), ileRepoNaRaz = 5, biblioteka = null, licznik = null } = {}) {
  // Koszt obejścia w wierszach bazy, jeśli Miejsce liczy wiersze (budzet.mjs): trafia do wyniku i do śladu próby.
  const wierszeNaStarcie = licznik ? { czytane: licznik.czytane, zapisane: licznik.zapisane } : null;
  const wiersze = () => (wierszeNaStarcie ? { czytane: licznik.czytane - wierszeNaStarcie.czytane, zapisane: licznik.zapisane - wierszeNaStarcie.zapisane } : null);
  // zrodlo: skąd były fakty tego obejścia ('api' albo 'plik'); zebrane: wiek faktów z pliku; kolo_spokojne: patrz domknijKolo
  const wynik = { ok: false, stan: 'brak', zrodlo: null, zebrane: null, repozytoria: 0, galezie_sprawdzone: 0, repozytoria_z_galeziami: 0, zmienione: 0, bez_zmian: 0, odlozone: 0, luki: [], zadan: 0 };
  const iso = new Date(teraz).toISOString();
  // Token nie trafia do niczego, co zostaje: gdyby wpadł do komunikatu o błędzie, zasłaniamy go, zanim cokolwiek zapiszemy.
  const czysc = (x) => (token && String(token).length >= 4 ? JSON.parse(JSON.stringify(x).split(String(token)).join('[token]')) : x);
  const zakoncz = () => {
    wynik.luki = czysc(wynik.luki);
    wynik.ok = wynik.stan !== 'brak';
    if (wierszeNaStarcie) wynik.wiersze = wiersze();
    return wynik;
  };
  try {
    if (typeof owner !== 'string' || !WZOR_WLASCICIELA.test(owner)) { wynik.luki.push({ gdzie: 'ustawienia', blad: 'właściciel do obejścia nie jest poprawną nazwą na GitHubie' }); return zakoncz(); }
    const obszar = s.r.meta('obszar_fakty');
    if (!obszar) { wynik.luki.push({ gdzie: 'ustawienia', blad: 'w Miejscu nie ma obszaru Fakty (zasiew się nie odbył)' }); return zakoncz(); }
    const ileMax = Math.max(1, Math.min(50, Math.trunc(Number(ileRepoNaRaz)) || 5));
    const naglowki = { 'user-agent': 'jaskinia-obserwator-faktow', accept: 'application/vnd.github+json' };
    if (token) naglowki.authorization = 'Bearer ' + token;
    const liczacy = (...a) => { wynik.zadan++; return fetchFn(...a); };
    const adresPliku = typeof biblioteka === 'string' && biblioteka ? biblioteka : null;

    // --- zapis jednej zmiany zwykłym ruchem; porażka zostaje lukę, nie wyjątkiem -------------------------------
    const ruch = async (gdzie, cialo) => {
      const w = await s.ruch(OBSERWATOR, cialo, { slad: 'obserwator' });
      if (!w.ok) wynik.luki.push({ gdzie, blad: String(w.blad || 'ruch odrzucony').slice(0, 200), status: w.status });
      return w;
    };
    // Rzecz o danym kluczu: nowa, zmieniona albo bez zmian. Zwraca identyfikator rzeczy albo null, gdy się nie udało.
    // `op` niesie odcisk treści i wersję, z której wychodzimy: ten sam ruch powtórzony niczego nie dubluje, a powrót
    // do wcześniejszej treści (A, B, A) nie trafia w op sprzed dwóch wersji. `stanNa` to wiek zapisywanych faktów:
    // chwila obejścia dla API, wiek pliku dla pliku (nie jest częścią porównania, więc samo nie robi nowej wersji).
    const utrwal = async (gdzie, { rodzaj, klucz, nowe, zarzadzane, stara, stanNa = iso }) => {
      let rz = stara;
      // odłożoną cudzą ręką nie wskrzeszamy (bez luki: to decyzja, nie awaria)
      if (rz && rz.odlozone && rz.zmienil !== OBSERWATOR) { wynik.bez_zmian++; return null; }
      if (rz && rz.odlozone) {
        const w = await ruch(gdzie, { op: `obs-p-${klucz}-${rz.wersja}`, co: 'przywroc', rzecz: rz.id, wersja: rz.wersja });
        if (!w.ok) return null;
        wynik.zmienione++;
        rz = s.rzecz(rz.id);
      }
      const rozne = !rz || zarzadzane.some((k) => JSON.stringify(rz.cechy[k] ?? null) !== JSON.stringify(nowe[k] ?? null));
      if (!rozne) { wynik.bez_zmian++; return rz.id; }
      const cechy = { ...(rz ? rz.cechy : {}), ...nowe, stan_na: stanNa };
      for (const k of zarzadzane) if (nowe[k] === undefined) delete cechy[k];
      const op = `obs-${klucz}-${await odcisk([rodzaj, ...zarzadzane.map((k) => nowe[k] ?? null)])}-${rz ? rz.wersja : 0}`;
      const w = await ruch(gdzie, { op, co: 'poloz', rodzaj, cechy, ...(rz ? { rzecz: rz.id, wersja: rz.wersja } : { obszar }) });
      if (!w.ok) return null;
      wynik.zmienione++;
      return w.rzecz;
    };
    const odloz = async (gdzie, rz, klucz, powod) => {
      const w = await ruch(gdzie, { op: `obs-o-${klucz}-${rz.wersja}`, co: 'odloz', rzecz: rz.id, wersja: rz.wersja, powod });
      if (w.ok) wynik.odlozone++;
      return w.ok;
    };
    const kluczRepo = async (pelna) => `r-${(await odcisk(pelna)).slice(0, 12)}`;
    const kluczGalezi = async (pelna, nazwa) => `g-${(await odcisk([pelna, nazwa])).slice(0, 12)}`;

    // --- kursor gałęzi: wspólny dla obu źródeł, bo oba chodzą po repozytoriach w kolejności pełnych nazw --------
    const kursor = String(s.r.meta(KURSOR) || '0');
    let poczatekKola = kursor === '0';
    const wybierzPartie = (klucze) => {
      let reszta = poczatekKola ? klucze : klucze.filter((k) => k > kursor);
      if (!reszta.length) { reszta = klucze; poczatekKola = true; }
      return reszta.slice(0, ileMax);
    };
    // Kursor idzie dalej tylko tam, gdzie obserwator naprawdę sprawdził gałęzie; po ostatnim repozytorium koło się domyka.
    // Koło jest SPOKOJNE, gdy od jego początku do domknięcia nie zapisano ani jednej zmiany: wtedy źródło, które się nie
    // zmienia (plik), może być pytane rzadziej (miejsce-do.mjs).
    const przesunKursor = (przerobiony, klucze) => {
      if (przerobiony === null) return;
      const suma = (poczatekKola ? 0 : Number(s.r.meta(KOLO)) || 0) + wynik.zmienione + wynik.odlozone;
      if (przerobiony === klucze[klucze.length - 1]) { s.r.ustawMeta(KURSOR, 0); s.r.ustawMeta(KOLO, 0); wynik.kolo_spokojne = suma === 0; }
      else { s.r.ustawMeta(KURSOR, przerobiony); s.r.ustawMeta(KOLO, suma); }
    };

    // --- 1. lista repozytoriów z API (dawca: fakty.mjs) -------------------------------------------------------------
    const zb = await zbierz({ fetchFn: liczacy, token, owner, teraz });
    for (const l of zb.luki) wynik.luki.push({ gdzie: 'lista', ...l });

    // Plik faktów: czytany, gdy API odmówiło (wtedy jest źródłem) albo gdy działa (wtedy tylko dokłada).
    let plik = null;
    if (adresPliku) {
      plik = await zBiblioteki({ fetchFn: liczacy, adres: adresPliku, teraz });
      for (const l of plik.luki) wynik.luki.push(l);
    }
    const plikOk = !!plik && plik.stan === 'ok';

    if (zb.stan === 'brak' && !plikOk) {
      // Gorszy wynik nie nadpisuje lepszego: miara zostaje przy ostatnim dobrym, dopisujemy tylko, że próba się nie udała.
      wynik.luki = czysc(wynik.luki);
      await zapiszMiare(null, `Ostatnia próba (${iso}) nie powiodła się: ${opisLuk(wynik.luki)}.`);
      zapamietajProbe('brak');
      return zakoncz();
    }

    // --- rodziny z pliku: rzeczy rodzina/1; zwraca znak -> identyfikator rzeczy -----------------------------------
    const rodziny = async () => {
      const mapa = new Map();
      const sa = new Map(s.wszystkie({ rodzaj: 'rodzina/1', odlozone: 'razem' }).map((x) => [x.cechy.znak, x]));
      for (const f of plik.rodziny) {
        const bylo = sa.get(f.znak);
        const w = wedlugWieku(bylo, { znak: f.znak, nazwa: f.nazwa, ...(f.pytanie ? { pytanie: f.pytanie } : {}) }, RODZINA_CECHY, plik.zebrane);
        if (!w) continue;
        const id = await utrwal('rodzina', { rodzaj: 'rodzina/1', klucz: `f-${f.znak.slice(0, 30)}`, nowe: w.nowe, zarzadzane: w.zarz, stara: bylo, stanNa: w.stanNa });
        if (id) mapa.set(f.znak, id);
      }
      return mapa;
    };
    // Cechy plikowe repozytorium: wartość z pliku, a gdy jej nie ma, to, co już było (nieznane to nie zero).
    const plikowe = (r, bylo, rodz) => {
      const z = {
        ladna_nazwa: r && r.ladna, tozsamosc: r && r.tozsamosc, rodzina: r && r.rodzina ? rodz.get(r.rodzina) : undefined,
        zycie: r && r.zycie, commity: r && r.commity !== null ? r.commity : undefined, stos: r && r.stos && r.stos.length ? r.stos : undefined,
        karta: r && r.karta ? true : undefined, wejscie: r && r.wejscie ? r.wejscie : undefined,
      };
      const wyn = {};
      for (const k of REPO_PLIKOWE) {
        // karta i wejscie: gdy plik zna repozytorium, jego brak pola znaczy, że cechy nie ma (tab zniknął); reszta zostaje, gdy pliku brak
        const wprost = !!r && (k === 'karta' || k === 'wejscie');
        const v = wprost ? z[k] : (z[k] ?? (bylo ? bylo.cechy[k] : undefined));
        if (v !== undefined && v !== null) wyn[k] = v;
      }
      return wyn;
    };
    const istnieja = new Map();
    for (const x of s.wszystkie({ rodzaj: 'repo/1', odlozone: 'razem' })) if (typeof x.cechy.pelna_nazwa === 'string') istnieja.set(x.cechy.pelna_nazwa, x);
    const plikRepos = new Map();
    if (plikOk) for (const r of plik.repos) plikRepos.set(pelnaNazwa(owner, r.nazwa), r);

    // =====================================================================================================
    // A. API odmówiło, jest plik: fakty z pliku, każda rzecz z wiekiem pliku, niczego nie odkładamy.
    // =====================================================================================================
    if (zb.stan === 'brak') {
      wynik.zrodlo = 'plik';
      wynik.zebrane = plik.zebrane;
      const rodz = await rodziny();
      const klucze = [...plikRepos.keys()].sort();
      wynik.repozytoria = klucze.length;
      const partia = new Set(wybierzPartie(klucze));
      // Repozytorium, którego nie ma w PEŁNYM pliku nowszym niż jego fakty, jest odkładane razem z gałęziami (odwracalnie).
      // Bezpiecznik: gdyby miało zniknąć więcej niż połowa żywych (i co najmniej 3), to wygląda na błąd źródła, nie na fakt.
      if (plik.pelny) {
        const prefiks = `${owner.toLowerCase()}/`;
        const zywe = [...istnieja].filter(([p, rz]) => !rz.odlozone && p.startsWith(prefiks));
        const znikniete = zywe.filter(([p, rz]) => !plikRepos.has(p) && Date.parse(plik.zebrane) > Date.parse(rz.cechy.stan_na));
        if (znikniete.length >= 3 && znikniete.length > zywe.length / 2) {
          wynik.luki.push({ gdzie: 'plik', blad: `z pełnego pliku brakuje ${znikniete.length} z ${zywe.length} żywych repozytoriów: wygląda na błąd źródła, niczego nie odkładam` });
        } else {
          for (const [p, rz] of znikniete) {
            if (!(await odloz('repo', rz, await kluczRepo(p), `repozytorium zniknęło u źródła: plik faktów z ${plik.zebrane} go nie zawiera, a obejmuje pełne klony`))) continue;
            for (const g of s.wszystkie({ rodzaj: 'galaz/1', gdzie: { repo: rz.id } })) await odloz('galaz', g, await kluczGalezi(p, g.cechy.nazwa), 'repozytorium zniknęło u źródła');
          }
        }
      }
      const rzeczRepo = new Map();
      for (const pelna of klucze) {
        const r = plikRepos.get(pelna);
        const bylo = istnieja.get(pelna);
        const nowe = {
          pelna_nazwa: pelna, nazwa: r.nazwa, adres: r.adres || `https://github.com/${owner}/${r.nazwa}`,
          ...(r.opis ? { opis: r.opis } : {}), ...(r.strona ? { strona: r.strona } : {}),
          ...(r.ostatni_push ? { ostatni_push: r.ostatni_push } : {}), ...(r.utworzone ? { utworzone: r.utworzone } : {}),
          ...plikowe(r, bylo, rodz), zrodlo_faktow: ZR_PLIK,
          // liczbę gałęzi znamy dla repozytoriów tej partii: tylko im ją zapisujemy
          ...(partia.has(pelna) ? { galezie: r.galezie.length } : {}),
        };
        // odłożone przez nowsze źródło albo cudzą ręką zostaje odłożone; własne odłożenie przywraca tylko nowszy plik
        if (bylo && bylo.odlozone && !mozeWrocic(bylo, plik.zebrane)) { wynik.bez_zmian++; continue; }
        const w = wedlugWieku(bylo, nowe, partia.has(pelna) ? [...REPO_Z_PLIKU, 'galezie'] : REPO_Z_PLIKU, plik.zebrane);
        const id = await utrwal('repo', { rodzaj: 'repo/1', klucz: await kluczRepo(pelna), nowe: w.nowe, zarzadzane: w.zarz, stara: bylo, stanNa: w.stanNa });
        if (id) rzeczRepo.set(pelna, id);
      }
      let przerobiony = null;
      for (const pelna of klucze) {
        if (!partia.has(pelna)) continue;
        przerobiony = pelna;
        const repoId = rzeczRepo.get(pelna);
        if (!repoId) continue;
        const r = plikRepos.get(pelna);
        wynik.repozytoria_z_galeziami++;
        const bylyG = new Map(s.wszystkie({ rodzaj: 'galaz/1', gdzie: { repo: repoId }, odlozone: 'razem' }).map((x) => [x.cechy.nazwa, x]));
        for (const b of r.galezie) {
          wynik.galezie_sprawdzone++;
          const bylo = bylyG.get(b.nazwa);
          const nowe = { repo: repoId, nazwa: b.nazwa, ...(b.commit ? { commit: b.commit } : {}), ...(b.kiedy ? { kiedy: b.kiedy } : {}), ...(b.temat ? { temat: b.temat } : {}) };
          if (bylo && bylo.odlozone && !mozeWrocic(bylo, plik.zebrane)) { wynik.bez_zmian++; continue; }
          const w = wedlugWieku(bylo, nowe, GALAZ_CECHY, plik.zebrane);
          await utrwal('galaz', { rodzaj: 'galaz/1', klucz: await kluczGalezi(pelna, b.nazwa), nowe: w.nowe, zarzadzane: w.zarz, stara: bylo, stanNa: w.stanNa });
        }
        // gałąź, której nie ma w pełnym, nowszym pliku (a obejmuje on pełne klony), jest odkładana; zero gałęzi u niepustego
        // repozytorium to raczej błąd źródła niż fakt, więc wtedy tylko luka
        if (plik.pelny) {
          if (!r.galezie.length && !r.puste) wynik.luki.push({ gdzie: 'plik', repo: r.nazwa, blad: 'plik podaje zero gałęzi dla repozytorium, które nie jest puste: niczego nie odkładam' });
          else {
            const wPliku = new Set(r.galezie.map((x) => x.nazwa));
            for (const [nazwa, rz] of bylyG) {
              if (rz.odlozone || wPliku.has(nazwa) || !(Date.parse(plik.zebrane) > Date.parse(rz.cechy.stan_na))) continue;
              await odloz('galaz', rz, await kluczGalezi(pelna, nazwa), `gałąź zniknęła u źródła: plik faktów z ${plik.zebrane} jej nie zawiera, a obejmuje pełne klony`);
            }
          }
        }
      }
      przesunKursor(przerobiony, klucze);

      wynik.stan = wynik.luki.length ? 'czesciowe' : 'ok';
      wynik.luki = czysc(wynik.luki);
      // Miara z pliku mówi wiek faktów, nie chwilę obejścia. Nowsza miara (z API) nie jest nadpisywana starszą: dopisujemy zdanie.
      const stara = s.spis({ rodzaj: 'miara/1', gdzie: { nazwa: MIARA }, odlozone: 'razem', limit: 1 })[0] || null;
      if (stara && Date.parse(stara.cechy.stan_na) > Date.parse(plik.zebrane)) {
        await zapiszMiare(null, `Ostatnia próba z pliku starej Jaskini (stan faktów ${plik.zebrane}) nie zmieniła tej miary: fakty z API są nowsze.`);
      } else {
        await zapiszMiare({ wartosc: s.ile({ rodzaj: 'repo/1' }), stan_na: plik.zebrane, zrodlo: `${PREFIKS_PLIKU} (${adresPliku}); stan faktów: ${plik.zebrane}; z tokenem: ${token ? 'tak' : 'nie'}; obejście: ${wynik.stan}; luki: ${opisLuk(wynik.luki)}` });
      }
      zapamietajProbe(wynik.stan);
      return zakoncz();
    }

    // =====================================================================================================
    // B. API działa: fakty z API, plik tylko dokłada.
    // =====================================================================================================
    wynik.zrodlo = 'api';
    if (plikOk) wynik.zebrane = plik.zebrane;
    const chciane = new Map();
    let pominiete = 0;
    for (const r of zb.repos) {
      if (!Number.isSafeInteger(r.id) || r.id <= 0 || typeof r.nazwa !== 'string' || !r.nazwa) { pominiete++; wynik.luki.push({ gdzie: 'lista', blad: 'repozytorium bez poprawnego id albo nazwy w odpowiedzi', repo: r.nazwa || null }); continue; }
      chciane.set(pelnaNazwa(owner, r.nazwa), { ...r, adres: adresOk(r.url) ? r.url : `https://github.com/${owner}/${r.nazwa}` });
    }
    const pelnaLista = zb.stan === 'ok' && pominiete === 0;
    const klucze = [...chciane.keys()].sort();
    wynik.repozytoria = klucze.length;

    // --- 2. repozytoria, które zniknęły z PEŁNEJ listy: odkładamy je razem z gałęziami; z niepełnej nigdy ----------
    // (dotyczy też rzeczy, które przyniósł plik: pełna lista z API jest świeższa niż plik)
    if (pelnaLista) {
      for (const [pelna, rz] of istnieja) {
        if (rz.odlozone || chciane.has(pelna)) continue;
        const k = await kluczRepo(pelna);
        if (await odloz('repo', rz, k, 'repozytorium zniknęło z pełnej listy publicznych repozytoriów u źródła')) {
          for (const g of s.wszystkie({ rodzaj: 'galaz/1', gdzie: { repo: rz.id } })) await odloz('galaz', g, `g-${(await odcisk([pelna, g.cechy.nazwa])).slice(0, 12)}`, 'repozytorium zniknęło u źródła');
        }
      }
    }

    // --- 3. gałęzie: tylko dla ileRepoNaRaz repozytoriów, od kursora; limit API bez tokenu to 60 zapytań na godzinę ---
    const partia = wybierzPartie(klucze);
    const galezie = new Map();
    let przerobiony = null;
    for (const pelna of partia) {
      const odlozoneCudzaReka = istnieja.get(pelna);
      if (odlozoneCudzaReka && odlozoneCudzaReka.odlozone && odlozoneCudzaReka.zmienil !== OBSERWATOR) { przerobiony = pelna; continue; }
      const g = await pobierzGalezie(liczacy, naglowki, owner, chciane.get(pelna).nazwa);
      if (g.luka) wynik.luki.push(g.luka);
      if (g.stop) break;
      galezie.set(pelna, g);
      przerobiony = pelna;
    }

    // --- 3b. rodziny z pliku (jeśli jest) ---------------------------------------------------------------------------
    const rodz = plikOk ? await rodziny() : new Map();

    // --- 4. repozytoria: jedna zapisana wersja na zmianę, razem z liczbą gałęzi, jeśli ją właśnie poznano ---------
    const rzeczRepo = new Map();
    for (const pelna of klucze) {
      const r = chciane.get(pelna);
      const g = galezie.get(pelna);
      const bylo = istnieja.get(pelna);
      const zPliku = plikRepos.get(pelna) || null;
      const pl = plikowe(zPliku, bylo, rodz);
      const nowe = {
        pelna_nazwa: pelna, github_id: r.id, nazwa: r.nazwa, adres: r.adres,
        ...(r.opis ? { opis: r.opis } : {}),
        ...(stronaRepo(r, owner) ? { strona: stronaRepo(r, owner) } : {}),
        ...(r.jezyk ? { jezyk: r.jezyk } : {}),
        archiwum: !!r.archiwum,
        ...(r.ostatni_push ? { ostatni_push: r.ostatni_push } : {}),
        ...(r.utworzone ? { utworzone: r.utworzone } : {}),
        ...(g && g.pelna ? { galezie: g.galezie.length } : bylo && Number.isFinite(bylo.cechy.galezie) ? { galezie: bylo.cechy.galezie } : {}),
        ...pl, zrodlo_faktow: Object.keys(pl).length ? ZR_OBA : ZR_API,
      };
      const id = await utrwal('repo', { rodzaj: 'repo/1', klucz: await kluczRepo(pelna), nowe, zarzadzane: [...REPO_API, ...REPO_PLIKOWE, 'zrodlo_faktow'], stara: bylo });
      if (id) rzeczRepo.set(pelna, id);
    }

    // --- 5. gałęzie sprawdzonych repozytoriów: zmiana, nowa, przywrócona; zniknięta tylko z pełnej odpowiedzi -------
    for (const [pelna, g] of galezie) {
      const repoId = rzeczRepo.get(pelna);
      if (!repoId || !(g.galezie.length || g.pelna)) continue;
      wynik.repozytoria_z_galeziami++;
      wynik.galezie_sprawdzone += g.galezie.length;
      const bylyG = new Map(s.wszystkie({ rodzaj: 'galaz/1', gdzie: { repo: repoId }, odlozone: 'razem' }).map((x) => [x.cechy.nazwa, x]));
      const zPliku = plikRepos.get(pelna);
      const widziane = new Set();
      for (const b of g.galezie) {
        widziane.add(b.nazwa);
        // kiedy i temat z pliku tylko dla TEGO SAMEGO commita; inaczej temat opisywałby cudzą zmianę
        const bylo = bylyG.get(b.nazwa);
        const pg = zPliku ? zPliku.galezie.find((x) => x.nazwa === b.nazwa) : null;
        const zgodny = !!(pg && pg.commit && b.commit && pg.commit === b.commit);
        const stary = bylo && b.commit && bylo.cechy.commit === b.commit ? bylo.cechy : {};
        const kiedy = zgodny && pg.kiedy ? pg.kiedy : stary.kiedy;
        const temat = zgodny && pg.temat ? pg.temat : stary.temat;
        const nowe = { repo: repoId, nazwa: b.nazwa, ...(b.commit ? { commit: b.commit } : {}), ...(kiedy ? { kiedy } : {}), ...(temat ? { temat } : {}) };
        await utrwal('galaz', { rodzaj: 'galaz/1', klucz: await kluczGalezi(pelna, b.nazwa), nowe, zarzadzane: GALAZ_CECHY, stara: bylo });
      }
      if (g.pelna) {
        for (const [nazwa, rz] of bylyG) if (!rz.odlozone && !widziane.has(nazwa)) await odloz('galaz', rz, await kluczGalezi(pelna, nazwa), 'gałąź zniknęła u źródła (pełna, udana odpowiedź GitHuba jej nie zawiera)');
      }
    }

    przesunKursor(przerobiony, klucze);

    wynik.stan = wynik.luki.length ? 'czesciowe' : 'ok';
    wynik.luki = czysc(wynik.luki);
    await zapiszMiare({ wartosc: s.ile({ rodzaj: 'repo/1' }), stan_na: iso, zrodlo: `${ZR_API} (users/${owner}/repos oraz repos/${owner}/<repo>/branches); z tokenem: ${token ? 'tak' : 'nie'}; obejście: ${wynik.stan}; luki: ${opisLuk(wynik.luki)}${plikOk ? `; ${ZR_PLIK} (stan na ${plik.zebrane}) dołożył rodziny, tożsamość, ładne nazwy, życie, stos i commity` : ''}` });
    zapamietajProbe(wynik.stan);
    return zakoncz();
  } catch (e) {
    wynik.luki.push({ gdzie: 'obserwator', blad: 'obejście przerwane: ' + krotko(e) });
    if (wynik.stan === 'ok') wynik.stan = 'czesciowe';
    wynik.luki = czysc(wynik.luki);
    try { zapamietajProbe('przerwane'); } catch { /* ślad próby to wygoda; jego brak nie może zasłonić właściwego błędu */ }
    return zakoncz();
  }

  // Miara to jedna rzecz zmieniana raz na obejście. `nowa` null znaczy: tylko dopisz zdanie o nieudanej próbie,
  // nie ruszając liczby ani chwili ostatniego dobrego obejścia (a bez żadnego dobrego nie zakładaj miary: zero byłoby kłamstwem).
  async function zapiszMiare(nowa, zdanieProby = null) {
    const stara = s.spis({ rodzaj: 'miara/1', gdzie: { nazwa: MIARA }, odlozone: 'razem', limit: 1 })[0] || null;
    if (!nowa && !stara) return;
    const cechy = nowa
      ? { nazwa: MIARA, ...nowa }
      : { ...stara.cechy, zrodlo: String(stara.cechy.zrodlo || '').split(' Ostatnia próba')[0] + ' ' + zdanieProby };
    if (stara && ['wartosc', 'stan_na', 'zrodlo'].every((k) => stara.cechy[k] === cechy[k])) return;
    const op = `obs-m-${await odcisk([cechy.wartosc, cechy.stan_na, cechy.zrodlo])}-${stara ? stara.wersja : 0}`;
    const obszar = s.r.meta('obszar_fakty');
    const w = await s.ruch(OBSERWATOR, { op, co: 'poloz', rodzaj: 'miara/1', cechy, ...(stara ? { rzecz: stara.id, wersja: stara.wersja } : { obszar }) }, { slad: 'obserwator' });
    if (!w.ok) wynik.luki.push({ gdzie: 'miara', blad: String(w.blad || '').slice(0, 200), status: w.status });
  }

  function zapamietajProbe(stan) {
    s.r.ustawMeta(PROBA, JSON.stringify({ czas: iso, stan, zrodlo: wynik.zrodlo, luki: opisLuk(wynik.luki), zmienione: wynik.zmienione + wynik.odlozone, ...(wierszeNaStarcie ? { wiersze: wiersze() } : {}) }));
  }
}
