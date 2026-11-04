// F0 — strażnik granicy publiczne/prywatne dla publicznego repo (próba, 3 XI 2026).
// Kod jest jawny, wzorce prywatne leżą poza repo. Wyniki nigdy nie pokazują dopasowanego tekstu,
// bo logi CI publicznego repo są publiczne. Node >= 18, bez zależności.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Każda reguła ma wagę: 'blok' zatrzymuje commit, 'ostrzezenie' tylko informuje.
export const SECRET_RULES = [
  { id: 'token-github', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { id: 'klucz-prywatny', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'klucz-aws', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'klucz-api-sk', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'token-cloudflare', re: /CLOUDFLARE_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{30,}/ },
];
// Polskie cudzysłowy drukarskie zwykle oznaczają cytat z prywatnej rozmowy; w publicznym kodzie nie powinny się pojawiać.
// Ostrzeżenie, nie blokada: feedback właściciela bywa wartościową dokumentacją, ale warto go zauważyć.
export const QUOTE_RULE = { id: 'cytat-w-cudzyslowie', re: /„[^”\n]{3,}”/, waga: 'ostrzezenie' };

const PL = { ł: 'l', Ł: 'l' };
export function normalize(s) {
  return s.replace(/[łŁ]/g, c => PL[c]).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export const hashTerm = s => createHash('sha256').update(normalize(s)).digest('hex').slice(0, 32);

// Plik wzorców: jedna linia = jedno słowo albo fraza; linia sha256:<32 znaki> = sam skrót; # komentarz.
// Prefiks ostrzez: oznacza wzorzec, który tylko ostrzega (np. nazwa repo, które kiedyś może być jawne).
export function parsePatterns(text) {
  const plain = [], hashes = new Set(), warnPlain = [], warnHashes = new Set();
  for (const raw of text.split(/\r?\n/)) {
    let l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const warn = l.startsWith('ostrzez:');
    if (warn) l = l.slice(8).trim();
    if (l.startsWith('sha256:')) (warn ? warnHashes : hashes).add(l.slice(7).toLowerCase());
    else (warn ? warnPlain : plain).push(normalize(l));
  }
  return { plain: plain.filter(Boolean), hashes, warnPlain: warnPlain.filter(Boolean), warnHashes };
}
// Ścieżka w stylu Git Bash (/c/Users/...) na Windows: Node widzi ją jako C:\\c\\Users,
// więc wzorce cicho się nie wczytywały (znalezisko Opusa Code, 4 XI 2026).
export function resolvePatternsPath(p, platform = process.platform) {
  if (!p) return p;
  const m = /^\/([a-zA-Z])\/(.*)$/.exec(p);
  return platform === 'win32' && m ? `${m[1].toUpperCase()}:/${m[2]}` : p;
}

export function loadPatterns(path) {
  return path && existsSync(path) ? parsePatterns(readFileSync(path, 'utf8')) : { plain: [], hashes: new Set(), warnPlain: [], warnHashes: new Set() };
}

function* ngrams(words, max = 4) {
  for (let i = 0; i < words.length; i++)
    for (let n = 1; n <= max && i + n <= words.length; n++) yield words.slice(i, i + n).join(' ');
}

// Zwraca znaleziska bez treści dopasowania: tylko reguła i numer linii.
function matches(norm, plain = [], hashes = new Set()) {
  if (plain.some(p => norm.includes(' ' + p + ' '))) return true;
  if (!hashes.size) return false;
  for (const g of ngrams(norm.trim().split(' ').filter(Boolean)))
    if (hashes.has(createHash('sha256').update(g).digest('hex').slice(0, 32))) return true;
  return false;
}

export function scanText(text, pats, { quotes = true } = {}) {
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const r of SECRET_RULES) if (r.re.test(line)) out.push({ rule: r.id, line: i + 1, waga: 'blok' });
    if (quotes && QUOTE_RULE.re.test(line)) out.push({ rule: QUOTE_RULE.id, line: i + 1, waga: 'ostrzezenie' });
    const norm = ' ' + normalize(line) + ' ';
    if (matches(norm, pats.plain, pats.hashes)) out.push({ rule: 'wzorzec-prywatny', line: i + 1, waga: 'blok' });
    else if (matches(norm, pats.warnPlain, pats.warnHashes)) out.push({ rule: 'wzorzec-do-sprawdzenia', line: i + 1, waga: 'ostrzezenie' });
  });
  return out;
}

export function scanCommitMeta(meta, pats) {
  // meta: { author, email, committer, cemail, message }
  const out = [];
  for (const [field, value] of Object.entries(meta))
    for (const f of scanText(String(value ?? ''), pats, { quotes: field === 'message' })) out.push({ ...f, field });
  return out;
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const looksBinary = s => s.includes('\u0000');

export function scanStaged(pats) {
  const files = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean);
  return files.flatMap(f => { const t = git('show', ':' + f); return looksBinary(t) ? [] : scanText(t, pats).map(x => ({ file: f, ...x })); });
}
export function scanTree(pats, rev = 'HEAD') {
  const files = git('ls-tree', '-r', '--name-only', rev).split('\n').filter(Boolean);
  return files.flatMap(f => { const t = git('show', `${rev}:${f}`); return looksBinary(t) ? [] : scanText(t, pats).map(x => ({ file: f, ...x })); });
}
export function scanCommits(pats, range) {
  const shas = git('rev-list', range).split('\n').filter(Boolean);
  return shas.flatMap(sha => {
    const [author, email, committer, cemail, ...msg] = git('show', '-s', '--format=%an%n%ae%n%cn%n%ce%n%B', sha).split('\n');
    return scanCommitMeta({ author, email, committer, cemail, message: msg.join('\n') }, pats).map(x => ({ commit: sha.slice(0, 10), ...x }));
  });
}

// Uruchomienie: node straznik.mjs --staged | --tree [rev] | --commits <zakres>
// Wzorce: zmienna JASKINIA_WZORCE (ścieżka poza repo) albo --wzorce <ścieżka>.
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const wi = a.indexOf('--wzorce');
  const given = wi >= 0 ? a[wi + 1] : process.env.JASKINIA_WZORCE;
  const patsPath = resolvePatternsPath(given);
  if (given && !existsSync(patsPath)) {
    // Wskazany plik, którego nie ma, to błąd, a nie tryb bez wzorców: inaczej strażnik udaje sprawdzenie.
    console.error('Strażnik: wskazany plik prywatnych wzorców nie istnieje. Zatrzymuję. Sprawdź ścieżkę (w Git Bash na Windows działa też C:/...).');
    process.exit(2);
  }
  const pats = loadPatterns(patsPath);
  const nBlok = pats.plain.length + pats.hashes.size, nOstrz = pats.warnPlain.length + pats.warnHashes.size;
  console.log(nBlok || nOstrz ? `Strażnik: tryb z prywatnymi wzorcami (${nBlok} blokujących, ${nOstrz} ostrzegających).` : 'Strażnik: tryb bez prywatnych wzorców, sprawdzam tylko sekrety i cudzysłowy.');
  let found = [];
  if (a.includes('--staged')) found = scanStaged(pats);
  else if (a.includes('--tree')) found = scanTree(pats, a[a.indexOf('--tree') + 1] && !a[a.indexOf('--tree') + 1].startsWith('--') ? a[a.indexOf('--tree') + 1] : 'HEAD');
  else if (a.includes('--commits')) found = scanCommits(pats, a[a.indexOf('--commits') + 1]);
  for (const f of found) console.log([f.waga === 'blok' ? 'BLOK' : 'uwaga', f.file ?? f.commit, f.field, 'linia ' + f.line, f.rule].filter(Boolean).join(' · '));
  const blocks = found.filter(f => f.waga === 'blok').length;
  console.log(blocks ? `Strażnik: ${blocks} blokad, zatrzymuję.` : found.length ? `Strażnik: ${found.length} uwag, przepuszczam.` : 'Strażnik: czysto.');
  process.exit(blocks ? 1 : 0);
}
