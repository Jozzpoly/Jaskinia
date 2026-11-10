// Czy mechanizmy ochronne jeszcze żyją?
//
// POWÓD. 10 XI znalazłem w tym repo trzy martwe albo bezzębne zabezpieczenia naraz:
//   1. blok CLI strażnika nie wykonywał się na Windows i kończył zerem (naprawione, c431262);
//   2. `core.hooksPath` nie było ustawione, więc hook pre-commit był nieaktywny;
//   3. pliku prywatnych wzorców (`JASKINIA_WZORCE`) nie ma na tej maszynie, więc
//      blokująca waga strażnika nigdy nie miała na czym blokować.
// Żadne z tych trzech nie dawało czerwonego wyniku. Wszystkie trzy były niewidoczne.
//
// ZASADA. Mechanizm, który nigdy nie zadziałał, jest nieodróżnialny od zepsutego.
// Rozróżnia je INGERENCJA, nie obserwacja: zielone CI mówi, że nic nie wybuchło,
// a nie że strażnik działa. Dlatego ten plik nie czyta konfiguracji i nie wnioskuje
// z niej — podkłada rzeczy, które strażnik MUSI złapać, i sprawdza, czy złapał.
//
// Astra, 10 XI, niezależnie: "Przy automatyzacji sprawdzić również brak kolejnego
// uruchomienia, a nie tylko jego czerwony wynik." (Nie wiem, czy czytała mój opis
// z tego samego dnia, więc nie twierdzę, że to dwa niezależne dojścia.)
//
// DWA RODZAJE WYNIKU, celowo rozdzielone:
//   PROWOKACJE  — twierdzenia. Nieudana prowokacja to kod wyjścia 1: mechanizm jest martwy.
//   ROZPOZNANIE — sprawozdanie. Nigdy nie przewraca wyniku, bo brak prywatnych wzorców
//                 w CI jest zamierzony (logi CI są publiczne, zasada 2).
//
// Nigdy nie wypisuje treści wzorców ani dopasowań — tylko liczby i nazwy reguł.
// Sekrety do prowokacji są składane w czasie wykonania, żeby ten plik sam nie zawierał
// łańcucha pasującego do reguły i nie zatrzymywał commitów, w których jest.
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { SECRET_RULES, QUOTE_RULE, scanText, loadPatterns, resolvePatternsPath, hashTerm } from './straznik.mjs';

const PUSTE = { plain: [], hashes: new Set(), warnPlain: [], warnHashes: new Set() };

// Syntetyczne wartości pasujące do reguł. Nie są niczyimi sekretami.
export function przyneta(id) {
  const p = {
    'token-github': () => 'gh' + 'p_' + 'x'.repeat(36),
    'klucz-prywatny': () => '-----BEGIN ' + 'TEST PRIVATE KEY' + '-----',
    'klucz-aws': () => 'AKIA' + 'Q'.repeat(16),
    'klucz-api-sk': () => 'sk' + '-' + 'y'.repeat(24),
    'token-cloudflare': () => 'CLOUDFLARE' + '_API_TOKEN=' + 'z'.repeat(32),
  }[id];
  if (!p) throw new Error('Brak przynęty dla reguły ' + id + ' — dopisz ją, bo inaczej reguła nie jest sprawdzana');
  return p();
}
const cudzyslowy = () => String.fromCharCode(0x201E) + 'zdanie z rozmowy' + String.fromCharCode(0x201D);

/* ------------------------------------------------------------------- prowokacje */

export function prowokacje() {
  const wyniki = [];
  const zdaj = (nazwa, ok, uwaga = '') => wyniki.push({ nazwa, ok, uwaga });

  // 1. Każda reguła sekretu osobno. Brak przynęty dla nowej reguły jest błędem, nie ciszą.
  for (const r of SECRET_RULES) {
    const f = scanText('przed\n' + przyneta(r.id) + '\npo', PUSTE);
    zdaj(`sekret/${r.id}`, f.some(x => x.rule === r.id && x.waga === 'blok'),
      'podłożony syntetyczny sekret musi dać wagę blok');
  }

  // 2. Cudzysłowy drukarskie: ostrzeżenie, nie blokada (zasada 9).
  const c = scanText(cudzyslowy(), PUSTE);
  zdaj('cytat/ostrzezenie', c.some(x => x.rule === QUOTE_RULE.id && x.waga === 'ostrzezenie'),
    'cytat ma ostrzegać, a nie blokować');

  // 3-5. Maszyneria prywatnych wzorców, na WŁASNYM pliku tymczasowym.
  //      Nie znam prywatnych wzorców Jozza i nie muszę ich znać, żeby sprawdzić mechanizm.
  const kat = mkdtempSync(join(tmpdir(), 'zyje-'));
  try {
    const jawny = 'kryptonim prowokacyjny alfa';
    const skrotem = 'kryptonim prowokacyjny beta';
    const ostrzegany = 'kryptonim prowokacyjny gamma';
    const plik = join(kat, 'wzorce.txt');
    writeFileSync(plik, [
      '# plik prowokacyjny, nie zawiera niczyich danych',
      jawny,
      'sha256:' + hashTerm(skrotem),
      'ostrzez:' + ostrzegany,
    ].join('\n'), 'utf8');
    const pats = loadPatterns(plik);

    zdaj('wzorce/wczytane', pats.plain.length === 1 && pats.hashes.size === 1 && pats.warnPlain.length === 1,
      `wczytano plain=${pats.plain.length} hash=${pats.hashes.size} ostrzez=${pats.warnPlain.length}`);
    zdaj('wzorce/jawny-blokuje',
      scanText('tekst z ' + jawny + ' w środku', pats).some(x => x.rule === 'wzorzec-prywatny' && x.waga === 'blok'));
    zdaj('wzorce/skrot-blokuje',
      scanText('tekst z ' + skrotem + ' w środku', pats).some(x => x.rule === 'wzorzec-prywatny' && x.waga === 'blok'),
      'droga przez sha256 jest osobna od jawnej i trzeba ją sprawdzać osobno');
    zdaj('wzorce/ostrzegany-nie-blokuje', (() => {
      const f = scanText('tekst z ' + ostrzegany + ' w środku', pats);
      return f.some(x => x.rule === 'wzorzec-do-sprawdzenia' && x.waga === 'ostrzezenie')
        && !f.some(x => x.waga === 'blok');
    })(), 'dwie wagi muszą być rozróżnialne, inaczej jedna z nich nie istnieje');

    // 6. Kontrola przeciwna: strażnik, który łapie wszystko, przeszedłby wszystkie
    //    prowokacje wyżej i byłby bezużyteczny. Czysty tekst musi dać zero znalezisk.
    zdaj('kontrola/czysty-tekst-przechodzi',
      scanText('zwyczajny kod bez niczego wrazliwego\nconst a = 1;', pats).length === 0,
      'bez tego testu "wszystko blokuje" wyglądałoby jak zdrowie');
  } finally {
    rmSync(kat, { recursive: true, force: true });
  }

  // 7. Ścieżka w stylu Git Bash. To była prawdziwa pułapka: /c/... Node widzi jako C:\c\...
  //    i wzorce cicho się nie wczytywały (4 XI). Sprawdzam obie platformy jawnie.
  zdaj('sciezka/git-bash-na-windows', resolvePatternsPath('/c/Users/x/wzorce.txt', 'win32') === 'C:/Users/x/wzorce.txt');
  zdaj('sciezka/bez-zmian-na-linux', resolvePatternsPath('/c/Users/x/wzorce.txt', 'linux') === '/c/Users/x/wzorce.txt');

  return wyniki;
}

/* ------------------------------------------------------------------ rozpoznanie */

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8' }).trim(); } catch { return ''; } };

export function rozpoznanie({ cwd = process.cwd(), env = process.env } = {}) {
  const out = [];
  const mow = (co, stan, uwaga = '') => out.push({ co, stan, uwaga });

  const hooks = git('config', 'core.hooksPath');
  mow('core.hooksPath', hooks || '(nieustawione)',
    hooks === '.githooks' ? '' : 'hook pre-commit jest NIEAKTYWNY; zasada 1: git config core.hooksPath .githooks');

  const hook = join(cwd, '.githooks', 'pre-commit');
  if (existsSync(hook)) {
    const t = readFileSync(hook, 'utf8');
    mow('.githooks/pre-commit', 'jest', t.includes('straznik.mjs') ? '' : 'NIE wywołuje strażnika');
    // Bit wykonywalności podaję tylko poza Windows. Tam git uruchamia hooka przez `sh`
    // niezależnie od bitu (sprawdzone uruchomieniem: hook zadziałał przy commicie 10 XI),
    // więc "nie" byłoby fałszywym alarmem — a w narzędziu do sprawdzania życia
    // fałszywy alarm jest gorszy od ciszy.
    if (process.platform !== 'win32') {
      try { mow('hook wykonywalny', (statSync(hook).mode & 0o111) ? 'tak' : 'NIE', (statSync(hook).mode & 0o111) ? '' : 'chmod +x .githooks/pre-commit'); } catch { /* nieistotne */ }
    }
  } else mow('.githooks/pre-commit', 'BRAK', 'nie ma czego uruchamiać');

  const ci = join(cwd, '.github', 'workflows', 'ci.yml');
  mow('strażnik w CI', existsSync(ci) && readFileSync(ci, 'utf8').includes('straznik.mjs') ? 'tak' : 'NIE');

  const wz = env.JASKINIA_WZORCE;
  if (!wz) {
    mow('JASKINIA_WZORCE', '(nieustawione)',
      'blokująca waga prywatnych wzorców NIE DZIAŁA; sekrety i cudzysłowy sprawdzane są nadal');
  } else {
    const p = resolvePatternsPath(wz);
    if (!existsSync(p)) mow('JASKINIA_WZORCE', 'USTAWIONE, ale pliku nie ma', 'strażnik zatrzyma się z kodem 2');
    else {
      const pats = loadPatterns(p);
      // Tylko liczby. Nigdy treść (zasada 2 i 12).
      mow('JASKINIA_WZORCE', 'plik jest',
        `wzorców blokujących ${pats.plain.length + pats.hashes.size}, ostrzegających ${pats.warnPlain.length + pats.warnHashes.size}`);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- CLI */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const p = prowokacje();
  const zle = p.filter(x => !x.ok);
  console.log('PROWOKACJE (mechanizm sprawdzony działaniem, nie konfiguracją):');
  for (const x of p) console.log(`  ${x.ok ? 'OK  ' : 'MARTWE'} ${x.nazwa}${x.uwaga && !x.ok ? '  — ' + x.uwaga : ''}`);
  console.log('\nROZPOZNANIE (sprawozdanie, nie przewraca wyniku):');
  for (const x of rozpoznanie()) console.log(`  ${x.co}: ${x.stan}${x.uwaga ? '  — ' + x.uwaga : ''}`);
  if (zle.length) {
    console.error(`\nMARTWE: ${zle.length} z ${p.length} prowokacji nie zadziałało. To nie jest ostrzeżenie.`);
    process.exit(1);
  }
  console.log(`\nWszystkie ${p.length} prowokacji zadziałały. Co NIE jest sprawdzane, stoi w rozpoznaniu wyżej.`);
}
