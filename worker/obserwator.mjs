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
import { WLASCICIEL, zbierz } from './fakty.mjs';
import { skrot } from './miejsce.mjs';
// Adresy z zewnątrz sprawdza ta sama reguła, którą warstwa środowiska sprawdza cechę typu adres (nie jej kopia).
import { poprawnyAdres as adresOk } from './srodowisko.mjs';

export const OBSERWATOR = 'obserwator';
export const MIARA = 'obserwator-faktow';
const KURSOR = 'obserwator:kursor'; // github_id ostatniego repozytorium, któremu sprawdzono gałęzie; 0 = zacznij od początku
const PROBA = 'obserwator:proba'; // ostatnia próba (także nieudana): czas, stan i skrót luk, żeby awaria była widoczna
const STRON_GALEZI = 3;
const WZOR_WLASCICIELA = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;

const REPO_CECHY = ['github_id', 'nazwa', 'adres', 'opis', 'strona', 'jezyk', 'archiwum', 'ostatni_push', 'utworzone', 'galezie'];
const GALAZ_CECHY = ['repo', 'nazwa', 'commit'];

// Dwa obejścia jednocześnie (alarm i ręczna prośba) nie mogą czytać tego samego kursora i pisać po sobie.
const KOLEJKI = new WeakMap();

const odcisk = async (x) => (await skrot(JSON.stringify(x))).slice(0, 14);
const krotko = (e) => String((e && e.message) || e).slice(0, 160);

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

async function obejdzRaz(s, { fetchFn = fetch, token = null, owner = WLASCICIEL, teraz = Date.now(), ileRepoNaRaz = 5 } = {}) {
  const wynik = { ok: false, stan: 'brak', repozytoria: 0, galezie_sprawdzone: 0, repozytoria_z_galeziami: 0, zmienione: 0, bez_zmian: 0, odlozone: 0, luki: [], zadan: 0 };
  const iso = new Date(teraz).toISOString();
  // Token nie trafia do niczego, co zostaje: gdyby wpadł do komunikatu o błędzie, zasłaniamy go, zanim cokolwiek zapiszemy.
  const czysc = (x) => (token && String(token).length >= 4 ? JSON.parse(JSON.stringify(x).split(String(token)).join('[token]')) : x);
  const zakoncz = () => {
    wynik.luki = czysc(wynik.luki);
    wynik.ok = wynik.stan !== 'brak';
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

    // --- zapis jednej zmiany zwykłym ruchem; porażka zostaje lukę, nie wyjątkiem -------------------------------
    const ruch = async (gdzie, cialo) => {
      const w = await s.ruch(OBSERWATOR, cialo, { slad: 'obserwator' });
      if (!w.ok) wynik.luki.push({ gdzie, blad: String(w.blad || 'ruch odrzucony').slice(0, 200), status: w.status });
      return w;
    };
    // Rzecz o danym kluczu: nowa, zmieniona albo bez zmian. Zwraca identyfikator rzeczy albo null, gdy się nie udało.
    // `op` niesie odcisk treści i wersję, z której wychodzimy: ten sam ruch powtórzony niczego nie dubluje, a powrót
    // do wcześniejszej treści (A, B, A) nie trafia w op sprzed dwóch wersji.
    const utrwal = async (gdzie, { rodzaj, klucz, nowe, zarzadzane, stara }) => {
      let rz = stara;
      if (rz && rz.odlozone) {
        const w = await ruch(gdzie, { op: `obs-p-${klucz}-${rz.wersja}`, co: 'przywroc', rzecz: rz.id, wersja: rz.wersja });
        if (!w.ok) return null;
        wynik.zmienione++;
        rz = s.rzecz(rz.id);
      }
      const rozne = !rz || zarzadzane.some((k) => JSON.stringify(rz.cechy[k] ?? null) !== JSON.stringify(nowe[k] ?? null));
      if (!rozne) { wynik.bez_zmian++; return rz.id; }
      const cechy = { ...(rz ? rz.cechy : {}), ...nowe, stan_na: iso };
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

    // --- 1. lista repozytoriów (dawca: fakty.mjs) ----------------------------------------------------------------
    const zb = await zbierz({ fetchFn: liczacy, token, owner, teraz });
    for (const l of zb.luki) wynik.luki.push({ gdzie: 'lista', ...l });
    if (zb.stan === 'brak') {
      // Gorszy wynik nie nadpisuje lepszego: miara zostaje przy ostatnim dobrym, dopisujemy tylko, że próba się nie udała.
      wynik.luki = czysc(wynik.luki);
      await zapiszMiare(null, `Ostatnia próba (${iso}) nie powiodła się: ${opisLuk(wynik.luki)}.`);
      zapamietajProbe('brak');
      return zakoncz();
    }
    const chciane = new Map();
    let pominiete = 0;
    for (const r of zb.repos) {
      if (!Number.isSafeInteger(r.id) || r.id <= 0 || typeof r.nazwa !== 'string' || !r.nazwa) { pominiete++; wynik.luki.push({ gdzie: 'lista', blad: 'repozytorium bez poprawnego id albo nazwy w odpowiedzi', repo: r.nazwa || null }); continue; }
      chciane.set(r.id, { ...r, adres: adresOk(r.url) ? r.url : `https://github.com/${owner}/${r.nazwa}` });
    }
    const pelnaLista = zb.stan === 'ok' && pominiete === 0;
    const ids = [...chciane.keys()].sort((a, b) => a - b);
    wynik.repozytoria = ids.length;

    const istnieja = new Map();
    for (const x of s.wszystkie({ rodzaj: 'repo/1', odlozone: 'razem' })) if (Number.isSafeInteger(x.cechy.github_id)) istnieja.set(x.cechy.github_id, x);

    // --- 2. repozytoria, które zniknęły z PEŁNEJ listy: odkładamy je razem z gałęziami; z niepełnej nigdy ----------
    if (pelnaLista) {
      for (const [gid, rz] of istnieja) {
        if (rz.odlozone || chciane.has(gid)) continue;
        if (await odloz('repo', rz, `r${gid}`, 'repozytorium zniknęło z pełnej listy publicznych repozytoriów u źródła')) {
          for (const g of s.wszystkie({ rodzaj: 'galaz/1', gdzie: { repo: rz.id } })) await odloz('galaz', g, `g${gid}-${(await odcisk(g.cechy.nazwa)).slice(0, 8)}`, 'repozytorium zniknęło u źródła');
        }
      }
    }

    // --- 3. gałęzie: tylko dla ileRepoNaRaz repozytoriów, od kursora; limit API bez tokenu to 60 zapytań na godzinę ---
    const kursor = Number(s.r.meta(KURSOR)) || 0;
    let reszta = ids.filter((id) => id > kursor);
    if (!reszta.length) reszta = ids;
    const partia = reszta.slice(0, ileMax);
    const galezie = new Map();
    let przerobiony = null;
    for (const gid of partia) {
      const g = await pobierzGalezie(liczacy, naglowki, owner, chciane.get(gid).nazwa);
      if (g.luka) wynik.luki.push(g.luka);
      if (g.stop) break;
      galezie.set(gid, g);
      przerobiony = gid;
    }

    // --- 4. repozytoria: jedna zapisana wersja na zmianę, razem z liczbą gałęzi, jeśli ją właśnie poznano ---------
    const rzeczRepo = new Map();
    for (const gid of ids) {
      const r = chciane.get(gid);
      const g = galezie.get(gid);
      const bylo = istnieja.get(gid);
      const nowe = {
        github_id: gid, nazwa: r.nazwa, adres: r.adres,
        ...(r.opis ? { opis: r.opis } : {}),
        ...(stronaRepo(r, owner) ? { strona: stronaRepo(r, owner) } : {}),
        ...(r.jezyk ? { jezyk: r.jezyk } : {}),
        archiwum: !!r.archiwum,
        ...(r.ostatni_push ? { ostatni_push: r.ostatni_push } : {}),
        ...(r.utworzone ? { utworzone: r.utworzone } : {}),
        ...(g && g.pelna ? { galezie: g.galezie.length } : bylo && Number.isFinite(bylo.cechy.galezie) ? { galezie: bylo.cechy.galezie } : {}),
      };
      const id = await utrwal('repo', { rodzaj: 'repo/1', klucz: `r${gid}`, nowe, zarzadzane: REPO_CECHY, stara: bylo });
      if (id) rzeczRepo.set(gid, id);
    }

    // --- 5. gałęzie sprawdzonych repozytoriów: zmiana, nowa, przywrócona; zniknięta tylko z pełnej odpowiedzi -------
    for (const [gid, g] of galezie) {
      const repoId = rzeczRepo.get(gid);
      if (!repoId || !(g.galezie.length || g.pelna)) continue;
      wynik.repozytoria_z_galeziami++;
      wynik.galezie_sprawdzone += g.galezie.length;
      const bylyG = new Map(s.wszystkie({ rodzaj: 'galaz/1', gdzie: { repo: repoId }, odlozone: 'razem' }).map((x) => [x.cechy.nazwa, x]));
      const widziane = new Set();
      for (const b of g.galezie) {
        widziane.add(b.nazwa);
        const nowe = { repo: repoId, nazwa: b.nazwa, ...(b.commit ? { commit: b.commit } : {}) };
        await utrwal('galaz', { rodzaj: 'galaz/1', klucz: `g${gid}-${(await odcisk(b.nazwa)).slice(0, 10)}`, nowe, zarzadzane: GALAZ_CECHY, stara: bylyG.get(b.nazwa) });
      }
      if (g.pelna) {
        for (const [nazwa, rz] of bylyG) if (!rz.odlozone && !widziane.has(nazwa)) await odloz('galaz', rz, `g${gid}-${(await odcisk(nazwa)).slice(0, 10)}`, 'gałąź zniknęła u źródła (pełna, udana odpowiedź GitHuba jej nie zawiera)');
      }
    }

    // kursor idzie dalej tylko tam, gdzie obserwator naprawdę sprawdził gałęzie; po ostatnim repozytorium koło się domyka
    if (przerobiony !== null) s.r.ustawMeta(KURSOR, przerobiony === ids[ids.length - 1] ? 0 : przerobiony);

    wynik.stan = wynik.luki.length ? 'czesciowe' : 'ok';
    wynik.luki = czysc(wynik.luki);
    await zapiszMiare({ wartosc: s.ile({ rodzaj: 'repo/1' }), stan_na: iso, zrodlo: `GitHub API (users/${owner}/repos oraz repos/${owner}/<repo>/branches); z tokenem: ${token ? 'tak' : 'nie'}; obejście: ${wynik.stan}; luki: ${opisLuk(wynik.luki)}` });
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
    s.r.ustawMeta(PROBA, JSON.stringify({ czas: iso, stan, luki: opisLuk(wynik.luki) }));
  }
}
