// F0 — strażnik granicy publiczne/prywatne dla publicznego repo (próba, 3 XI 2026).
// Kod jest jawny, wzorce prywatne leżą poza repo. Wyniki nigdy nie pokazują dopasowanego tekstu,
// bo logi CI publicznego repo są publiczne. Node >= 18, bez zależności.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const SECRET_RULES = [
  { id: 'token-github', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { id: 'klucz-prywatny', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'klucz-aws', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'klucz-api-sk', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'token-cloudflare', re: /CLOUDFLARE_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{30,}/ },
];
// Polskie cudzysłowy drukarskie zwykle oznaczają cytat z prywatnej rozmowy; w publicznym kodzie nie powinny się pojawiać.
export const QUOTE_RULE = { id: 'cytat-w-cudzyslowie', re: /„[^”\n]{3,}”/ };

const PL = { ł: 'l', Ł: 'l' };
export function normalize(s) {
  return s.replace(/[łŁ]/g, c => PL[c]).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export const hashTerm = s => createHash('sha256').update(normalize(s)).digest('hex').slice(0, 32);

// Plik wzorców: jedna linia = jedno słowo albo fraza; linia sha256:<32 znaki> = sam skrót; # komentarz.
export function parsePatterns(text) {
  const plain = [], hashes = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    if (l.startsWith('sha256:')) hashes.add(l.slice(7).toLowerCase());
    else plain.push(normalize(l));
  }
  return { plain: plain.filter(Boolean), hashes };
}
export function loadPatterns(path) {
  return path && existsSync(path) ? parsePatterns(readFileSync(path, 'utf8')) : { plain: [], hashes: new Set() };
}

function* ngrams(words, max = 4) {
  for (let i = 0; i < words.length; i++)
    for (let n = 1; n <= max && i + n <= words.length; n++) yield words.slice(i, i + n).join(' ');
}

// Zwraca znaleziska bez treści dopasowania: tylko reguła i numer linii.
export function scanText(text, pats, { quotes = true } = {}) {
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const r of SECRET_RULES) if (r.re.test(line)) out.push({ rule: r.id, line: i + 1 });
    if (quotes && QUOTE_RULE.re.test(line)) out.push({ rule: QUOTE_RULE.id, line: i + 1 });
    const norm = ' ' + normalize(line) + ' ';
    if (pats.plain.some(p => norm.includes(' ' + p + ' '))) out.push({ rule: 'wzorzec-prywatny', line: i + 1 });
    else if (pats.hashes.size) {
      for (const g of ngrams(norm.trim().split(' ').filter(Boolean)))
        if (pats.hashes.has(createHash('sha256').update(g).digest('hex').slice(0, 32))) { out.push({ rule: 'wzorzec-prywatny', line: i + 1 }); break; }
    }
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
  const pats = loadPatterns(wi >= 0 ? a[wi + 1] : process.env.JASKINIA_WZORCE);
  let found = [];
  if (a.includes('--staged')) found = scanStaged(pats);
  else if (a.includes('--tree')) found = scanTree(pats, a[a.indexOf('--tree') + 1] && !a[a.indexOf('--tree') + 1].startsWith('--') ? a[a.indexOf('--tree') + 1] : 'HEAD');
  else if (a.includes('--commits')) found = scanCommits(pats, a[a.indexOf('--commits') + 1]);
  if (!pats.plain.length && !pats.hashes.size) console.error('Uwaga: brak prywatnych wzorców, sprawdzam tylko sekrety i cudzysłowy.');
  for (const f of found) console.log([f.file ?? f.commit, f.field, 'linia ' + f.line, f.rule].filter(Boolean).join(' · '));
  console.log(found.length ? `Strażnik: ${found.length} znalezisk, zatrzymuję.` : 'Strażnik: czysto.');
  process.exit(found.length ? 1 : 0);
}
