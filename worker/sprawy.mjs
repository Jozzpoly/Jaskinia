// Sprawy: to, co agenci przygotowali w repozytoriach właściciela, pokazane w Jaskini, bez wchodzenia na GitHub
// (11 XI 2026). Status: próba (TYMCZASOWE.md).
// Jozz nie pracuje z GitHubem; chce robić wszystko z Jaskini (rejestr potrzeb #7). Dlatego otwarte PR-y są tu
// rozłożone na trzy rodzaje:
//   - decyzja: agent wpisał w opisie linię "Decyzja dla Jozza: ..." (umowa dla agentów, AGENTS.md); to pytanie idzie
//     na górę, z podglądem do sprawdzenia i, po podłączeniu, z jednym gestem;
//   - próba: szkic albo tytuł z DO NOT MERGE, R&D, próba, dowód; widać, co superorganizm robi, nic nie trzeba;
//   - otwarte: reszta.
// Zatwierdzenie scala dokładnie tę wersję, którą Jozz widział (parametr sha w API GitHuba): jeśli agent dopisze coś
// po jego spojrzeniu, scalenie się nie uda i Jaskinia to powie. Bez tokenu GITHUB_ZAPIS_TOKEN tylko odczyt.

export const DOMYSLNY_WLASCICIEL = 'Jozzpoly';
const PROBA = /DO NOT MERGE|R&D|ARCHIVAL|\bpróba\b|\bpróby\b|dowód, nie scalanie|\bdraft\b/i;
const DECYZJA = /^\s*(?:\*\*)?Decyzja dla Jozza:(?:\*\*)?\s*(.+)$/im;

const naglowki = (token) => ({ 'user-agent': 'jaskinia-sprawy', accept: 'application/vnd.github+json', ...(token ? { authorization: 'Bearer ' + token } : {}) });

// Pierwszy akapit opisu jako zwykły tekst: bez nagłówków, list, linków i podpisów narzędzi.
export function streszczenie(body) {
  if (!body) return null;
  const akapity = String(body).replace(/\r/g, '').split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean)
    .filter((a) => !/^#{1,6}\s/.test(a) && !/Generated with|claude\.ai\/code|^https?:\/\//i.test(a));
  if (!akapity.length) return null;
  const t = akapity[0].replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>#]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 320 ? t.slice(0, 317).trimEnd() + '…' : t;
}

export function rodzaj(pr) {
  const d = DECYZJA.exec(pr.body || '');
  if (d) return { rodzaj: 'decyzja', pytanie: d[1].replace(/[*_`]/g, '').trim().slice(0, 400) };
  if (pr.draft || PROBA.test(pr.title || '')) return { rodzaj: 'proba' };
  return { rodzaj: 'otwarte' };
}

// Adres podglądu gałęzi w Cloudflare Worker Previews: nazwa gałęzi małymi literami, inne znaki jako '-'.
export function podgladGalezi(galaz, worker = 'jaskinia', subdomena = 'jozzpoly') {
  const s = String(galaz).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s ? `https://${s}-${worker}.${subdomena}.workers.dev` : null;
}

export async function zbierzSprawy({ fetchFn = fetch, token = null, owner = DOMYSLNY_WLASCICIEL, teraz = Date.now(), repoZPodgladem = ['Jaskinia'] } = {}) {
  const luki = [];
  const sprawy = [];
  for (let strona = 1; strona <= 3; strona++) {
    let odp;
    try { odp = await fetchFn(`https://api.github.com/search/issues?q=${encodeURIComponent(`is:pr is:open user:${owner}`)}&sort=updated&order=desc&per_page=100&page=${strona}`, { headers: naglowki(token) }); }
    catch (e) { luki.push({ co: 'wyszukiwanie', strona, blad: 'sieć: ' + String(e && e.message || e).slice(0, 100) }); break; }
    if (!odp.ok) { luki.push({ co: 'wyszukiwanie', strona, status: odp.status, zostalo_zapytan: odp.headers.get('x-ratelimit-remaining') }); break; }
    const j = await odp.json().catch(() => null);
    if (!j || !Array.isArray(j.items)) { luki.push({ co: 'wyszukiwanie', strona, blad: 'odpowiedź bez listy' }); break; }
    for (const it of j.items) {
      const repo = String(it.repository_url || '').split('/').pop();
      sprawy.push({ repo, nr: it.number, tytul: it.title, url: it.html_url, szkic: !!it.draft, ...rodzaj(it),
        streszczenie: streszczenie(it.body), utworzone: it.created_at, zaktualizowane: it.updated_at });
    }
    if (j.items.length < 100 || sprawy.length >= j.total_count) break;
  }
  // Podglądy: nazwy gałęzi są tylko w liście PR-ów repozytorium (wyszukiwanie ich nie zwraca).
  for (const repo of repoZPodgladem) {
    if (!sprawy.some((s) => s.repo === repo)) continue;
    try {
      const odp = await fetchFn(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`, { headers: naglowki(token) });
      if (!odp.ok) { luki.push({ co: 'podglądy', repo, status: odp.status }); continue; }
      for (const p of await odp.json()) {
        const s = sprawy.find((x) => x.repo === repo && x.nr === p.number);
        if (s) { s.galaz = p.head.ref; s.wersja = p.head.sha; s.podglad = podgladGalezi(p.head.ref); }
      }
    } catch (e) { luki.push({ co: 'podglądy', repo, blad: 'sieć' }); }
  }
  const kolej = { decyzja: 0, otwarte: 1, proba: 2 };
  sprawy.sort((a, b) => kolej[a.rodzaj] - kolej[b.rodzaj] || Date.parse(b.zaktualizowane) - Date.parse(a.zaktualizowane));
  const stan = !luki.some((l) => l.co === 'wyszukiwanie') ? (luki.length ? 'czesciowe' : 'ok') : sprawy.length ? 'czesciowe' : 'brak';
  return { zebrane: new Date(teraz).toISOString(), z_tokenem: !!token, stan, luki, sprawy: stan === 'brak' ? null : sprawy };
}

// Pamięć w izolacie: wyszukiwanie GitHuba bez klucza pozwala na 10 zapytań na minutę, więc nie pytamy przy każdym
// otwarciu strony. Wynik niesie swój wiek, jak fakty.
let pamiec = null;
export const SWIEZE_SPRAWY_S = 5 * 60;
export async function sprawyDlaStrony(env = {}, { fetchFn = fetch, teraz = Date.now(), wymus = false } = {}) {
  if (!wymus && pamiec && (teraz - Date.parse(pamiec.zebrane)) / 1000 < SWIEZE_SPRAWY_S) return { ...pamiec, wiek_s: Math.round((teraz - Date.parse(pamiec.zebrane)) / 1000), skad: 'z pamięci' };
  const nowe = await zbierzSprawy({ fetchFn, token: env.GITHUB_DANE_TOKEN || env.GITHUB_ZAPIS_TOKEN || null, teraz });
  // gorszy wynik nie nadpisuje lepszego: przy braku odpowiedzi zostaje poprzednia lista z informacją o próbie
  if (nowe.stan === 'brak' && pamiec && pamiec.sprawy) { pamiec = { ...pamiec, ostatnia_proba: { zebrane: nowe.zebrane, luki: nowe.luki } }; }
  else pamiec = nowe;
  return { ...pamiec, wiek_s: Math.round((teraz - Date.parse(pamiec.zebrane)) / 1000), skad: 'na żywo', zatwierdzanie: !!env.GITHUB_ZAPIS_TOKEN };
}
export function _wyczyscPamiec() { pamiec = null; }

// Zatwierdzenie: scala PR w dokładnie tej wersji, którą właściciel widział. Repo musi być na liście ZATWIERDZ_REPO.
export async function zatwierdz(env = {}, { repo, nr, wersja } = {}, { fetchFn = fetch, owner = DOMYSLNY_WLASCICIEL } = {}) {
  if (!env.GITHUB_ZAPIS_TOKEN) return { ok: false, status: 503, blad: 'Jaskinia nie ma jeszcze prawa scalać (brak GITHUB_ZAPIS_TOKEN): jednorazowe podłączenie' };
  let dozwolone = [];
  try { dozwolone = JSON.parse(env.ZATWIERDZ_REPO || '[]'); } catch { /* zostaje pusta lista */ }
  if (!dozwolone.includes(repo)) return { ok: false, status: 403, blad: `repo ${repo} nie jest na liście ZATWIERDZ_REPO` };
  if (!Number.isInteger(nr) || nr < 1) return { ok: false, status: 400, blad: 'nr: numer PR' };
  if (typeof wersja !== 'string' || !/^[0-9a-f]{40}$/.test(wersja)) return { ok: false, status: 400, blad: 'wersja: pełny sha wersji, którą widziałeś' };
  let odp;
  try {
    odp = await fetchFn(`https://api.github.com/repos/${owner}/${repo}/pulls/${nr}/merge`, {
      method: 'PUT', headers: { ...naglowki(env.GITHUB_ZAPIS_TOKEN), 'content-type': 'application/json' },
      body: JSON.stringify({ sha: wersja, merge_method: 'merge', commit_title: `Zatwierdzone w Jaskini: ${repo}#${nr}` }),
    });
  } catch { return { ok: false, status: 502, blad: 'GitHub nie odpowiada' }; }
  const j = await odp.json().catch(() => ({}));
  if (odp.status === 409) return { ok: false, status: 409, blad: 'agent zmienił tę sprawę po tym, jak ją oglądałeś; zobacz nową wersję i zdecyduj jeszcze raz' };
  if (odp.status === 405) return { ok: false, status: 409, blad: 'GitHub nie pozwala scalić: ' + String(j.message || 'konflikt albo nieskończone sprawdzenia').slice(0, 200) };
  if (!odp.ok) return { ok: false, status: 502, blad: `GitHub odmówił (${odp.status}): ` + String(j.message || '').slice(0, 200) };
  pamiec = null; // lista się zmieniła
  return { ok: true, scalone: true, wersja: j.sha || null };
}
