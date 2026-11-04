// Testy strażnika. Wzorce są zmyślone; prawdziwe leżą poza repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePatterns, scanText, scanCommitMeta, hashTerm, normalize, scanStaged, scanCommits } from './straznik.mjs';

const FAKE = parsePatterns(['# zmyślone wzorce', 'Tajne Repo Xyz', 'Żółwik-Testowy', `sha256:${hashTerm('Ukryta Nazwa')}`].join('\n'));
// Ciągi podobne do sekretów składamy w locie, żeby nie leżały w repo.
const fakeGh = 'gh' + 'p_' + 'A1b2C3d4'.repeat(5);
const fakeKey = '-----BEGIN ' + 'RSA PRIVATE KEY-----';

test('łapie zwykły wzorzec niezależnie od wielkości liter, polskich znaków i interpunkcji', () => {
  assert.equal(scanText('linki: tajne-repo-XYZ/README', FAKE).length, 1);
  assert.equal(scanText('autor: zolwik testowy', FAKE).length, 1);
  assert.equal(scanText('nic tu nie ma', FAKE).length, 0);
});

test('łapie wzorzec podany tylko jako skrót, także w środku zdania', () => {
  const f = scanText('Zrobione przez ukryta  nazwa wczoraj', FAKE);
  assert.deepEqual(f.map(x => x.rule), ['wzorzec-prywatny']);
});

test('nie łapie fragmentu słowa (bez fałszywych alarmów w zwykłym kodzie)', () => {
  assert.equal(scanText('const tajnerepoxyz = 1', FAKE).length, 0);
});

test('łapie sekrety i cudzysłowy drukarskie', () => {
  const rules = t => scanText(t, FAKE).map(x => x.rule);
  assert.deepEqual(rules(`token = ${fakeGh}`), ['token-github']);
  assert.deepEqual(rules(fakeKey), ['klucz-prywatny']);
  assert.deepEqual(rules('README: ' + String.fromCharCode(0x201E) + 'to jest czyjś cytat' + String.fromCharCode(0x201D)), ['cytat-w-cudzyslowie']);
});

test('wagi: sekrety i prywatne wzorce blokują, cudzysłowy i wzorce z prefiksem ostrzez: tylko ostrzegają', () => {
  const P = parsePatterns(['Tajne Repo Xyz', 'ostrzez: Kiedys Jawne Repo'].join('\n'));
  const w = t => scanText(t, P).map(x => x.waga);
  assert.deepEqual(w('tajne repo xyz'), ['blok']);
  assert.deepEqual(w('kiedys-jawne-repo'), ['ostrzezenie']);
  assert.deepEqual(w(String.fromCharCode(0x201E) + 'feedback wlasciciela' + String.fromCharCode(0x201D)), ['ostrzezenie']);
  assert.deepEqual(w(fakeGh), ['blok']);
});

test('wynik nigdy nie zawiera dopasowanego tekstu (logi CI są publiczne)', () => {
  const f = scanText(`Tajne Repo Xyz i ${fakeGh}`, FAKE);
  const shown = JSON.stringify(f);
  assert.ok(!/tajne|xyz/i.test(shown));
  assert.ok(!shown.includes(fakeGh));
  const viaHash = JSON.stringify(scanText('podpis: Ukryta Nazwa', FAKE));
  assert.ok(viaHash.includes('wzorzec-prywatny') && !/ukryta|nazwa/i.test(viaHash));
});

test('sprawdza autora, e-mail i opis commita', () => {
  const f = scanCommitMeta({ author: 'Żółwik Testowy', email: 'a@b.c', committer: 'Claude', cemail: 'x@y.z', message: 'zwykły opis' }, FAKE);
  assert.deepEqual(f.map(x => x.field), ['author']);
});

test('normalizacja polskich liter', () => {
  assert.equal(normalize('ŁÓDŹ Żółć'), 'lodz zolc');
});

test('na prawdziwym repo: zatrzymuje brudny commit w indeksie i brudnego autora w historii', () => {
  const dir = mkdtempSync(join(tmpdir(), 'straznik-'));
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.name', 'Agent'); g('config', 'user.email', 'agent@example.com');
  writeFileSync(join(dir, 'a.md'), 'czysto\n'); g('add', '.'); g('commit', '-qm', 'start');
  writeFileSync(join(dir, 'b.md'), 'zobacz Tajne Repo Xyz\n'); g('add', 'b.md');
  const cwd = process.cwd(); process.chdir(dir);
  try {
    assert.deepEqual(scanStaged(FAKE).map(x => [x.file, x.rule]), [['b.md', 'wzorzec-prywatny']]);
    g('reset', '-q', 'b.md');
    g('-c', 'user.name=Żółwik Testowy', 'commit', '-q', '--allow-empty', '-m', 'pusty');
    assert.deepEqual(scanCommits(FAKE, 'HEAD~1..HEAD').map(x => x.field), ['author', 'committer']);
  } finally { process.chdir(cwd); }
});

// Znalezisko Opusa Code z 4 XI: zła ścieżka do wzorców dawała cichy wynik "czysto".
import { spawnSync } from 'node:child_process';
import { resolvePatternsPath } from './straznik.mjs';

test('wskazany, ale nieistniejący plik wzorców zatrzymuje strażnika zamiast udawać sprawdzenie', () => {
  const cli = new URL('./straznik.mjs', import.meta.url).pathname;
  const r = spawnSync(process.execPath, [cli, '--tree', 'HEAD'], {
    env: { ...process.env, JASKINIA_WZORCE: '/nie/ma/takiego/pliku-wzorcow.txt' }, encoding: 'utf8',
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /nie istnieje/);
});

test('ścieżka w stylu Git Bash zamienia się na ścieżkę Windows tylko na Windows', () => {
  assert.equal(resolvePatternsPath('/c/Users/ktos/wzorce.txt', 'win32'), 'C:/Users/ktos/wzorce.txt');
  assert.equal(resolvePatternsPath('/c/Users/ktos/wzorce.txt', 'linux'), '/c/Users/ktos/wzorce.txt');
  assert.equal(resolvePatternsPath(undefined, 'win32'), undefined);
});
