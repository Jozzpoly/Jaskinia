#!/usr/bin/env node
// Zasila Miejsce publicznymi projektami właściciela: jedna rzecz rodzaju projekt/1 na publiczne repozytorium
// i jedna miara, ile ich jest. Status: próba (TYMCZASOWE.md): robi ręką to, co ma kiedyś robić automat faktów.
// Czyta tylko to, co GitHub podaje publicznie; niczego nie zapisuje na dysk i nie zna żadnej nazwy z góry.
// Wchodzi przez te same drzwi co każdy uczestnik (/api/srodowisko/ruch), więc sam jest sprawdzianem trasy.
// Użycie: node tools/zasil-projekty.mjs <adres Miejsca> <klucz uczestnika> [właściciel na GitHubie]
import { WLASCICIEL } from '../worker/fakty.mjs';

const [adres0, klucz, wlasciciel = WLASCICIEL] = process.argv.slice(2);
if (!adres0 || !klucz) { console.error('Użycie: node tools/zasil-projekty.mjs <adres Miejsca> <klucz uczestnika> [właściciel na GitHubie]'); process.exit(2); }
const adres = adres0.replace(/\/+$/, '');
const naglowki = { authorization: 'Bearer ' + klucz, 'content-type': 'application/json', 'x-cialo': 'node/zasil-projekty' };

async function gh(sciezka) {
  const h = { 'user-agent': 'jaskinia-zasilanie', accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) h.authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const o = await fetch('https://api.github.com' + sciezka, { headers: h });
  if (!o.ok) throw new Error(`GitHub ${sciezka}: ${o.status}`);
  return o.json();
}
async function ruch(cialo) {
  const o = await fetch(adres + '/api/srodowisko/ruch', { method: 'POST', headers: naglowki, body: JSON.stringify(cialo) });
  const d = await o.json().catch(() => ({}));
  return { status: o.status, ...d };
}
const spis = async (rodzaj) => (await (await fetch(`${adres}/api/srodowisko/spis?rodzaj=${rodzaj}`, { headers: naglowki })).json()).rzeczy || [];
const czysty = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const repo = [];
for (let strona = 1; strona <= 5; strona++) {
  const cz = await gh(`/users/${wlasciciel}/repos?type=owner&sort=pushed&per_page=100&page=${strona}`);
  repo.push(...cz.filter((r) => !r.private && !r.fork));
  if (cz.length < 100) break;
}
const teraz = new Date().toISOString();
const juz = new Map((await spis('projekt/1')).map((r) => [r.cechy.zrodlo, r]));
const wynik = { dolozone: 0, zmienione: 0, bez_zmian: 0, propozycje: 0, bledy: [] };
for (const r of repo) {
  const cechy = { nazwa: r.name, ...(r.description ? { opis: r.description } : {}), zrodlo: r.html_url, zycie: r.pushed_at, stan_na: teraz };
  const strona = r.homepage && /^https:\/\//.test(r.homepage) ? r.homepage : (r.has_pages ? `https://${wlasciciel.toLowerCase()}.github.io/${r.name}/` : null);
  if (strona) cechy.zagraj = strona;
  const stara = juz.get(r.html_url);
  if (stara && stara.cechy.zycie === cechy.zycie && stara.cechy.opis === cechy.opis && stara.cechy.zagraj === cechy.zagraj) { wynik.bez_zmian++; continue; }
  const op = `zasil-${r.id}-${czysty(r.pushed_at)}`;
  const w = await ruch(stara ? { op, co: 'poloz', rzecz: stara.id, wersja: stara.wersja, rodzaj: 'projekt/1', cechy: { ...stara.cechy, ...cechy } } : { op, co: 'poloz', rodzaj: 'projekt/1', cechy });
  if (w.ok && w.skutek === 'polozone') wynik[stara ? 'zmienione' : 'dolozone']++;
  else if (w.ok && w.skutek === 'propozycja') wynik.propozycje++;
  else wynik.bledy.push(`${r.id}: ${w.status} ${w.blad || ''}`);
}
const miary = await spis('miara/1');
const m = miary.find((x) => x.cechy.nazwa === 'publiczne-repozytoria');
const mc = { nazwa: 'publiczne-repozytoria', wartosc: repo.length, stan_na: teraz, zrodlo: 'GitHub, publiczne repozytoria właściciela bez forków; powtórzenie: node tools/zasil-projekty.mjs' };
if (!m || m.cechy.wartosc !== repo.length) {
  const w = await ruch(m ? { op: `zasil-miara-${czysty(teraz)}`, co: 'poloz', rzecz: m.id, wersja: m.wersja, rodzaj: 'miara/1', cechy: mc } : { op: `zasil-miara-${czysty(teraz)}`, co: 'poloz', rodzaj: 'miara/1', cechy: mc });
  if (!w.ok) wynik.bledy.push(`miara: ${w.status} ${w.blad || ''}`);
}
console.log(JSON.stringify({ publicznych_repozytoriow: repo.length, ...wynik }, null, 2));
process.exit(wynik.bledy.length ? 1 : 0);
