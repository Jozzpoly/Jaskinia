// Most: skrzynka Jaskini <-> prywatna pamięć agentów w repozytorium (11 XI 2026). Status: próba (TYMCZASOWE.md).
// Agenci nie słyszą Jaskini bezpośrednio: Claude w chmurze nie dosięga workers.dev, linie GPT budzą się tylko w
// rozmowie. Wszyscy czytają za to wspólne prywatne repozytorium. Most robi z niego dwukierunkowy kanał, więc
// Jozz pisze raz, w Jaskini, a nie osiem razy w ośmiu rozmowach:
//   - na zewnątrz: każda wiadomość ze skrzynki trafia jako plik skrzynka/RRRR/MM/DD/<czas>-<kto>-<nr>.md;
//   - do środka: plik, który agent położy w skrzynka/od-agentow/, wchodzi do skrzynki jako jego wiadomość.
// Nazwa repozytorium jest tylko w ustawieniu MOST_REPO (publiczny kod jej nie zna). Token: GITHUB_ZAPIS_TOKEN.
// Wszystko idempotentne: plik wiadomości ma stałą ścieżkę z numeru aktu (drugi zapis to 422, czyli już jest),
// a wiadomość agenta ma op z sha pliku (drugie przyjęcie to ten sam akt). Nic nie jest usuwane.

const API = 'https://api.github.com';
const nag = (token) => ({ 'user-agent': 'jaskinia-most', accept: 'application/vnd.github+json', authorization: 'Bearer ' + token, 'content-type': 'application/json' });

export function doBase64(tekst) {
  const b = new TextEncoder().encode(tekst);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export function zBase64(b64) {
  const s = atob(String(b64).replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
}

export function wiadomoscDoPliku(akt) {
  let w = {};
  try { w = JSON.parse(akt.tresc); } catch { w = { tekst: akt.tresc }; }
  const kiedy = akt.kiedy;
  const d = kiedy.slice(0, 10).split('-'), czas = kiedy.slice(11, 19).replace(/:/g, '');
  const sciezka = `skrzynka/${d[0]}/${d[1]}/${d[2]}/${czas}-${akt.kto}-${akt.nr}.md`;
  const fm = ['---', `nr: ${akt.nr}`, `kto: ${akt.kto}`, `kiedy: ${kiedy}`, `waga: ${w.waga || 'zwykla'}`];
  if (Array.isArray(w.do) && w.do.length) fm.push(`do: ${w.do.join(', ')}`);
  if (w.odp) fm.push(`odp: ${w.odp}`);
  fm.push('---', '', String(w.tekst || ''), '');
  return { sciezka, tresc: fm.join('\n') };
}

const IMIE = /^[a-z][a-z0-9_-]{0,39}$/;
// Plik agenta: nagłówek "---" z kto (wymagane), waga, do (po przecinku), odp (numer), potem tekst.
export function plikDoWiadomosci(tekst) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(String(tekst).replace(/\r/g, ''));
  if (!m) return { ok: false, blad: 'brak nagłówka --- kto: ... ---' };
  const pola = Object.fromEntries(m[1].split('\n').map((l) => /^([a-z]+):\s*(.*)$/.exec(l.trim())).filter(Boolean).map((x) => [x[1], x[2].trim()]));
  if (!IMIE.test(pola.kto || '')) return { ok: false, blad: 'kto: imię agenta małymi literami' };
  if (pola.kto === 'jozz') return { ok: false, blad: 'przez most nie pisze się jako właściciel; Jozz pisze w Jaskini' };
  const tresc = { tekst: m[2].trim(), waga: ['wazna', 'pilna'].includes(pola.waga) ? pola.waga : 'zwykla' };
  if (pola.do) tresc.do = pola.do.split(',').map((x) => x.trim()).filter(Boolean);
  if (/^\d+$/.test(pola.odp || '')) tresc.odp = Number(pola.odp);
  if (!tresc.tekst) return { ok: false, blad: 'pusty tekst' };
  return { ok: true, kto: pola.kto, tresc: JSON.stringify(tresc) };
}

// Nagłówek x-wewnetrzne nie przyjdzie z zewnątrz: Worker buduje nagłówki do Miejsca od zera.
export const mostGotowy = (env = {}) => Boolean(env.MOST_REPO && env.GITHUB_ZAPIS_TOKEN);
export const zadanieWewnetrzne = (sciezka, cialo) => new Request('https://miejsce/api/miejsce/' + sciezka, {
  method: cialo ? 'POST' : 'GET', headers: { 'x-wewnetrzne': 'tak', 'x-kto': 'jaskinia', 'content-type': 'application/json' }, body: cialo ? JSON.stringify(cialo) : undefined,
});

// Jeden przebieg mostu. Woła go alarm samego Miejsca (nie cron: alarm Durable Object nie liczy się do limitu
// cronów konta, a po nowej wiadomości przychodzi po 2 s, nie po 5 minutach). `obsluz` to droga do Miejsca:
// w alarmie bezpośrednio, w testach przez Workera.
export async function przebiegMostu(env = {}, { fetchFn = fetch, obsluz = null } = {}) {
  if (!mostGotowy(env) || (!obsluz && !env.MIEJSCE)) return { ok: false, pominiety: 'brak MOST_REPO, GITHUB_ZAPIS_TOKEN albo wiązania MIEJSCE' };
  const repo = env.MOST_REPO, token = env.GITHUB_ZAPIS_TOKEN;
  const doMiejsca = obsluz || ((r) => env.MIEJSCE.get(env.MIEJSCE.idFromName('dom')).fetch(r));
  const wew = (sciezka, cialo) => doMiejsca(zadanieWewnetrzne(sciezka, cialo)).then((r) => r.json());
  const wynik = { ok: true, wyslane: 0, przyjete: 0, bledy: [] };

  // 1. na zewnątrz, po kolei; zatrzymuje się na pierwszym błędzie, żeby kolejność plików była kolejnością aktów
  const doWyslania = await wew('most/do-wyslania');
  for (const akt of doWyslania.akty || []) {
    const { sciezka, tresc } = wiadomoscDoPliku(akt);
    let odp;
    try {
      odp = await fetchFn(`${API}/repos/${repo}/contents/${sciezka}`, { method: 'PUT', headers: nag(token),
        body: JSON.stringify({ message: `Skrzynka: ${akt.kto}, #${akt.nr}\n\nZ Jaskini, przez most.\n\nAgent: Jaskinia (Worker)`, content: doBase64(tresc) }) });
    } catch { wynik.bledy.push({ nr: akt.nr, blad: 'sieć' }); break; }
    if (!odp.ok && odp.status !== 422) { wynik.bledy.push({ nr: akt.nr, status: odp.status }); break; }
    await wew('most/wyslane', { nr: akt.nr });
    wynik.wyslane += 1;
  }

  // 2. do środka: pliki agentów, których jeszcze nie ma (op z sha pliku)
  let lista = [];
  try {
    const odp = await fetchFn(`${API}/repos/${repo}/contents/skrzynka/od-agentow`, { headers: nag(token) });
    if (odp.ok) lista = (await odp.json()).filter((p) => p.type === 'file' && p.name.endsWith('.md'));
    else if (odp.status !== 404) wynik.bledy.push({ co: 'lista od agentów', status: odp.status });
  } catch { wynik.bledy.push({ co: 'lista od agentów', blad: 'sieć' }); }
  const znane = new Set((await wew('most/znane-pliki', { opy: lista.map((p) => 'most-' + p.sha) })).znane || []);
  for (const p of lista) {
    const op = 'most-' + p.sha;
    if (znane.has(op)) continue;
    try {
      const odp = await fetchFn(`${API}/repos/${repo}/contents/${p.path}`, { headers: nag(token) });
      if (!odp.ok) { wynik.bledy.push({ plik: p.name, status: odp.status }); continue; }
      const w = plikDoWiadomosci(zBase64((await odp.json()).content));
      if (!w.ok) { wynik.bledy.push({ plik: p.name, blad: w.blad }); continue; }
      const r = await wew('most/przyjmij', { kto: w.kto, op, tresc: w.tresc });
      if (r.ok && !r.powtorzone) wynik.przyjete += 1;
    } catch { wynik.bledy.push({ plik: p.name, blad: 'sieć' }); }
  }
  return wynik;
}
