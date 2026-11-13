// Drogi: sprawdza, czy do każdego dokumentu w tym repo da się dojść i czy każdy odnośnik dokądś prowadzi.
// Status: próba (zob. TYMCZASOWE.md). Uruchamiane w CI i ręcznie: `npm run drogi`.
//
// Po co: 14 XI 2026 zmierzono, że w prywatnym repo wspólnej pamięci 54% bajtów nie ma żadnej ścieżki
// odnośników od pliku wejściowego, a z dwunastu możliwych kierunków między repozytoriami właściciela
// dziewięć nie ma ani jednego odnośnika. Dokumenty powstają i lądują w pustce, więc ta sama wiedza
// bywa odkrywana od nowa średnio po trzydziestu dniach. Ten plik zamienia to w liczbę, którą widać
// przy każdym pchnięciu.
//
// Cztery sprawdzenia, każde takie, że nie da się go spełnić pisząc prozę:
//   1. martwy odnośnik  — odnośnik względny, który nie wskazuje na istniejący plik ani katalog;
//   2. sierota          — dokument, do którego nie prowadzi żadna ścieżka odnośników od drzwi;
//   3. sąsiedzi         — drzwi muszą podawać adresy pozostałych repozytoriów ekosystemu;
//   4. ścieżka obca     — odnośnik względny do dokumentu, którego tu nie ma, a który wygląda na
//                         plik z innego repozytorium (ma być adresem, nie ścieżką).
//
// Odnośnik do katalogu liczy się jako żywy, ale NIE udostępnia jego zawartości: katalog ze stoma
// plikami to magazyn, nie spis treści. Tak samo widzi to osoba, która tam wchodzi.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';

const KORZEN = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const DRZWI = ['README.md', 'AGENTS.md'];
const POMIJANE = new Set(['.git', 'node_modules', 'vendor', '.wrangler']);

// Sąsiedzi: publiczne repozytoria ekosystemu. Prywatnego repo wspólnej pamięci tu nie wymieniamy
// świadomie (zasada 2 i 3 w AGENTS.md): w publicznym repo nie podajemy nawet jego nazwy.
const SASIEDZI = [
  { nazwa: 'stara Jaskinia', adres: 'https://github.com/Jozzpoly/Jozz-Cave-Workbench' },
  { nazwa: 'Medium', adres: 'https://github.com/Jozzpoly/Shared-Work-Medium-Lab' },
  { nazwa: 'Feniks Studio', adres: 'https://github.com/Jozzpoly/Feniks-Studio' },
];

const ukosniki = (p) => p.split(sep).join('/');

function dokumenty(katalog = KORZEN, zebrane = []) {
  for (const wpis of readdirSync(katalog, { withFileTypes: true })) {
    if (POMIJANE.has(wpis.name)) continue;
    const pelna = join(katalog, wpis.name);
    if (wpis.isDirectory()) dokumenty(pelna, zebrane);
    else if (wpis.name.toLowerCase().endsWith('.md')) zebrane.push(ukosniki(relative(KORZEN, pelna)));
  }
  return zebrane;
}

function istnieje(sciezka) {
  try { statSync(join(KORZEN, sciezka)); return true; } catch { return false; }
}

function katalogiem(sciezka) {
  try { return statSync(join(KORZEN, sciezka)).isDirectory(); } catch { return false; }
}

// Odnośniki markdown: [tekst](cel). Pomijamy adresy, kotwice i obrazki z danymi.
const ODNOSNIK = /\[[^\]]*\]\(\s*([^)\s]+?)\s*(?:"[^"]*")?\)/g;

function odnosniki(dokument) {
  const tresc = readFileSync(join(KORZEN, dokument), 'utf8');
  const out = [];
  for (const m of tresc.matchAll(ODNOSNIK)) {
    const surowy = m[1];
    if (/^(https?:|mailto:|#|data:)/i.test(surowy)) continue;
    const bezKotwicy = surowy.split('#')[0];
    if (!bezKotwicy) continue;
    out.push({ surowy, cel: ukosniki(relative(KORZEN, resolve(KORZEN, dirname(dokument), bezKotwicy))) });
  }
  return out;
}

const wszystkie = dokumenty().sort();
const zbior = new Set(wszystkie);
const graf = new Map();
const martwe = [];
const obce = [];

for (const d of wszystkie) {
  const dalej = new Set();
  for (const { surowy, cel } of odnosniki(d)) {
    if (cel.startsWith('..')) { martwe.push({ d, surowy, powod: 'poza repozytorium' }); continue; }
    if (!istnieje(cel)) {
      // Czy to wygląda na dokument z innego repozytorium podany jak ścieżka lokalna?
      const wyglada = /\.md$/i.test(cel) && cel.includes('/');
      (wyglada ? obce : martwe).push({ d, surowy, powod: wyglada ? 'dokument spoza repo podany jak ścieżka' : 'nie ma takiego pliku' });
      continue;
    }
    if (katalogiem(cel)) continue; // katalog żyje, ale nie udostępnia zawartości
    if (zbior.has(cel)) dalej.add(cel);
  }
  graf.set(d, dalej);
}

const drzwi = DRZWI.filter((d) => zbior.has(d));
const widziane = new Set(drzwi);
const kolejka = [...drzwi];
while (kolejka.length) {
  for (const cel of graf.get(kolejka.shift()) ?? []) {
    if (!widziane.has(cel)) { widziane.add(cel); kolejka.push(cel); }
  }
}
const sieroty = wszystkie.filter((d) => !widziane.has(d));

const trescDrzwi = drzwi.map((d) => readFileSync(join(KORZEN, d), 'utf8')).join('\n');
const brakSasiadow = SASIEDZI.filter((s) => !trescDrzwi.includes(s.adres));

const procent = wszystkie.length ? Math.round((widziane.size / wszystkie.length) * 100) : 100;
const linie = [];
const powiedz = (s) => { linie.push(s); console.log(s); };

powiedz(`Drogi: ${widziane.size} z ${wszystkie.length} dokumentów osiągalnych od drzwi (${procent}%).`);
for (const s of sieroty) powiedz(`  sierota · ${s} · nie prowadzi do niego żaden odnośnik`);
for (const m of martwe) powiedz(`  martwy · ${m.d} → ${m.surowy} · ${m.powod}`);
for (const o of obce) powiedz(`  obca ścieżka · ${o.d} → ${o.surowy} · podaj adres, nie ścieżkę`);
for (const s of brakSasiadow) powiedz(`  sąsiad · drzwi nie podają adresu: ${s.nazwa} (${s.adres})`);

const raport = process.argv.indexOf('--raport');
if (raport > -1 && process.argv[raport + 1]) {
  writeFileSync(join(KORZEN, process.argv[raport + 1]),
    `<!-- generowane przez tools/drogi.mjs, nie poprawiaj ręcznie -->\n` +
    `# Drogi\n\n${procent}% dokumentów (${widziane.size} z ${wszystkie.length}) jest osiągalnych od drzwi.\n\n` +
    linie.slice(1).map((l) => `- ${l.trim()}`).join('\n') + (linie.length > 1 ? '\n' : 'Nic nie leży w pustce.\n'));
}

const bledy = sieroty.length + martwe.length + obce.length + brakSasiadow.length;
if (bledy) {
  console.error(`\nDrogi: ${bledy} ${bledy === 1 ? 'rzecz leży' : 'rzeczy leżą'} w pustce albo prowadzą donikąd.`);
  process.exit(1);
}
console.log('Drogi: każdy dokument osiągalny, każdy odnośnik prowadzi dokądś.');
