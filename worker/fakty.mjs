// Obserwator faktów: co dzieje się w publicznych repo właściciela, prosto z API GitHuba (10 XI 2026).
// Status: próba (TYMCZASOWE.md). Zasady, które ma przenieść dalej, niezależnie od kodu:
//   - nieznane to nie zero: gdy API odmówi albo urwie się w połowie, wynik mówi to wprost, a nie podaje krótszej listy
//     jako pełnej;
//   - fakty mówią, ile mają lat: każdy wynik niesie chwilę zebrania, a odpowiedź dla strony także swój wiek, więc
//     zamilknięcie obserwatora widać na ekranie;
//   - gorszy wynik nie nadpisuje lepszego: nieudana próba zostaje zapisana obok ostatnich dobrych faktów.
// Bez KV liczy na żywo przy każdym pytaniu; z wiązaniem FAKTY (KV) zbiera je cron, a strona czyta zapamiętane.

export const WLASCICIEL = 'Jozzpoly';
export const KLUCZ = 'fakty:ostatnie';
export const SWIEZE_S = 45 * 60; // dłużej bez nowego zebrania = obserwator milczy, strona mówi stare

export async function zbierz({ fetchFn = fetch, token = null, owner = WLASCICIEL, teraz = Date.now() } = {}) {
  const naglowki = { 'user-agent': 'jaskinia-obserwator-faktow', accept: 'application/vnd.github+json' };
  if (token) naglowki.authorization = 'Bearer ' + token;
  const repos = [];
  const luki = [];
  for (let strona = 1; strona <= 5; strona++) {
    let odp;
    try {
      odp = await fetchFn(`https://api.github.com/users/${owner}/repos?type=owner&sort=pushed&per_page=100&page=${strona}`, { headers: naglowki });
    } catch (e) {
      luki.push({ strona, blad: 'sieć: ' + String(e && e.message || e).slice(0, 120) });
      break;
    }
    if (!odp.ok) {
      luki.push({ strona, status: odp.status, zostalo_zapytan: odp.headers.get('x-ratelimit-remaining') });
      break;
    }
    const lista = await odp.json().catch(() => null);
    if (!Array.isArray(lista)) { luki.push({ strona, blad: 'odpowiedź nie jest listą' }); break; }
    for (const r of lista) {
      if (r.private) continue;
      repos.push({
        nazwa: r.name, opis: r.description || null, ostatni_push: r.pushed_at, utworzone: r.created_at,
        // GitHub liczy tu razem issues i pull requesty
        otwarte_issues_i_pr: r.open_issues_count, pages: !!r.has_pages, archiwum: !!r.archived,
        jezyk: r.language || null, url: r.html_url,
      });
    }
    if (lista.length < 100) break;
    if (strona === 5) luki.push({ strona, blad: 'więcej niż 500 repo: dalszych stron nie czytam' });
  }
  const stan = !luki.length ? 'ok' : repos.length ? 'czesciowe' : 'brak';
  return {
    wersja: 1, zebrane: new Date(teraz).toISOString(), zrodlo: `GitHub API, users/${owner}/repos`,
    z_tokenem: !!token, stan, luki, repos: stan === 'brak' ? null : repos,
  };
}

// Co zapisać, gdy przyszedł nowy wynik: lepszego nigdy nie zastępuje gorszy.
export function scal(stare, nowe) {
  if (nowe.stan === 'ok' || !stare || stare.stan !== 'ok') return { ...nowe, ostatnia_proba: null };
  return { ...stare, ostatnia_proba: { zebrane: nowe.zebrane, stan: nowe.stan, luki: nowe.luki } };
}

// Odpowiedź dla strony: fakty i ich wiek.
export function dlaStrony(fakty, teraz = Date.now(), skad = 'na żywo') {
  if (!fakty) return { stan: 'brak', repos: null, wiek_s: null, swiezosc: 'nie wiadomo', skad };
  const wiek = Math.max(0, Math.round((teraz - Date.parse(fakty.zebrane)) / 1000));
  return { ...fakty, wiek_s: wiek, swiezosc: wiek <= SWIEZE_S ? 'swieze' : 'stare', skad };
}

export async function odpowiedz(env = {}, { fetchFn = fetch, teraz = Date.now() } = {}) {
  const token = env.GITHUB_DANE_TOKEN || null;
  if (env.FAKTY) {
    const zapamietane = await env.FAKTY.get(KLUCZ, 'json');
    if (zapamietane && (teraz - Date.parse(zapamietane.zebrane)) / 1000 <= SWIEZE_S) return dlaStrony(zapamietane, teraz, 'z pamięci (cron)');
    // cron milczy albo jeszcze nie ruszył: zbieramy teraz, zapisujemy lepsze z dwóch i mówimy, skąd są fakty
    const nowe = await zbierz({ fetchFn, token, teraz });
    const wynik = scal(zapamietane, nowe);
    await env.FAKTY.put(KLUCZ, JSON.stringify(wynik));
    return dlaStrony(wynik, teraz, wynik === nowe || wynik.zebrane === nowe.zebrane ? 'na żywo' : 'z pamięci (nowa próba nie powiodła się)');
  }
  return dlaStrony(await zbierz({ fetchFn, token, teraz }), teraz, 'na żywo (bez pamięci KV)');
}

export async function wCronie(env = {}, { fetchFn = fetch, teraz = Date.now() } = {}) {
  if (!env.FAKTY) return { zapisane: false, powod: 'brak wiązania FAKTY (KV)' };
  const stare = await env.FAKTY.get(KLUCZ, 'json');
  const wynik = scal(stare, await zbierz({ fetchFn, token: env.GITHUB_DANE_TOKEN || null, teraz }));
  await env.FAKTY.put(KLUCZ, JSON.stringify(wynik));
  return { zapisane: true, stan: wynik.stan, proba: wynik.ostatnia_proba ? wynik.ostatnia_proba.stan : 'ok' };
}
