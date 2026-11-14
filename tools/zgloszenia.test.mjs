// Plik kart dla paska „Do obejrzenia” musi się parsować i mieć wymagane pola.
// Fable, 14 XI (atak 2): jeden zbędny przecinek gasił cały pasek, a testy i strażnik go przepuszczały.
// Karty dopisują agenci — także ręcznie, przez konektor GitHuba (Medium docs/ODDAJ-JOZZOWI.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const plik = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'do-obejrzenia', 'zgloszenia.json');

test('zgloszenia.json parsuje się i każda karta ma pola, które czyta pasek', () => {
  const d = JSON.parse(fs.readFileSync(plik, 'utf8'));
  assert.equal(d.wersja, 1, 'format v1');
  assert.ok(Array.isArray(d.zgloszenia), 'zgloszenia to tablica');
  const nry = new Set();
  for (const k of d.zgloszenia) {
    for (const pole of ['nr', 'czas', 'repo', 'co', 'adres', 'agent', 'model']) {
      assert.ok(k[pole] !== undefined && k[pole] !== '', `karta ${k.nr ?? '?'}: brak pola ${pole}`);
    }
    assert.ok(Number.isInteger(k.nr) && !nry.has(k.nr), `karta ${k.nr}: nr całkowity i niepowtarzalny`);
    nry.add(k.nr);
    assert.match(new URL(k.adres).protocol, /^https?:$/, `karta ${k.nr}: adres tylko http(s)`);
    assert.ok(!Number.isNaN(Date.parse(k.czas)), `karta ${k.nr}: czas jako data ISO`);
    if (k.podobne !== undefined) assert.ok(Array.isArray(k.podobne), `karta ${k.nr}: podobne to tablica`);
    for (const x of k.podobne || []) assert.ok(x && typeof x === 'object', `karta ${k.nr}: każdy element podobne to obiekt (pasek czyta x.data, x.repo, x.plik)`);
  }
});

// Sito na drodze ręcznej (14 XI, Opus czatu; zgłosił Opus Code, przed nim Fable §2 pkt 8).
// Repo jest publiczne: co trafi do tego pliku, jest jawne od chwili wypchnięcia — także na gałęzi PR-a.
// Sito nie cofa wycieku. Robi dwie rzeczy: zatrzymuje PR (czerwony test przed scaleniem) i podnosi
// alarm na `main`, gdy ktoś wypchnął wprost. Pola strukturalne sprawdza listą dozwolonych; wolnego
// tekstu (`co`) z nazw prywatnych repo nie sprawdzi — ich listy z zasady tu nie ma.
import { SECRET_RULES } from './straznik.mjs';

// Publiczne repo Jozzpoly (widoczność sprawdzona `gh api repos/Jozzpoly/<repo> --jq .private`, 14 XI).
// Nowe publiczne repo → dopisz tu; czerwony test to sygnał, nie awaria (nie blokuje wdrożenia).
export const REPO_JAWNE = new Set([
  'jaskinia', 'jozz-cave-workbench', 'shared-work-medium-lab', 'feniks-studio', 'coopege', 'llm-live-npc',
  'box3d-character-controler', 'box3d_funproject', 'cloudflare-multiplayer-lab', 'cognitive-ecology-lab',
  'combat-lab', 'companion-brain-lab', 'framematter-lab', 'gloopipelago', 'jozz-splat-game-lab',
  'jozz-universal-rig-editor', 'jozzue_vehicles_sandbox', 'jv-box3d-web-experiment', 'jv-box3d-web-public',
  'minecraftlike-fun-project', 'mini_feniks', 'project-anvil-machine-matter-physical-fabric-laboratory',
  'reflexbrain-lab', 'simply_game_experiment', 'tysi-c-the-game', 'voxel-aeronautics-workshop', 'webxr-lab',
]);
const POLA = new Set(['nr', 'czas', 'repo', 'galaz', 'commit', 'co', 'adres', 'agent', 'model', 'podobne', 'podobne_w_prywatnych']);
const SCIEZKI_LOKALNE = /(?:^|[\s"'(])(?:[A-Za-z]:\\|\/home\/|\/root\/|\/tmp\/|\/mnt\/|\/Users\/|file:|\\\\)|localhost|127\.0\.0\.1/;

export function adresDozwolony(adres) {
  const u = new URL(adres);
  if (u.protocol !== 'https:') return false;
  if (u.hostname === 'jaskinia.jozzpoly.workers.dev' || /^[a-z0-9-]+-jaskinia\.jozzpoly\.workers\.dev$/.test(u.hostname)) return true;
  if (u.hostname === 'jozzpoly.github.io') return REPO_JAWNE.has((u.pathname.split('/')[1] || '').toLowerCase());
  if (u.hostname === 'github.com') {
    const [wl, repo] = u.pathname.split('/').slice(1);
    return wl === 'Jozzpoly' && REPO_JAWNE.has((repo || '').toLowerCase());
  }
  return false;
}

export function sito(d) {
  const bledy = [];
  for (const k of d.zgloszenia) {
    const n = `karta ${k.nr}`;
    for (const p of Object.keys(k)) if (!POLA.has(p)) bledy.push(`${n}: nieznane pole ${p} (każde pole jest publiczne — dopisz je świadomie do POLA)`);
    if (!REPO_JAWNE.has(String(k.repo).toLowerCase())) bledy.push(`${n}: repo spoza listy publicznych`);
    for (const x of k.podobne || []) if (x && x.repo && !REPO_JAWNE.has(String(x.repo).toLowerCase())) bledy.push(`${n}: podobne wskazuje repo spoza listy publicznych`);
    if (k.podobne_w_prywatnych !== undefined && !Number.isInteger(k.podobne_w_prywatnych)) bledy.push(`${n}: podobne_w_prywatnych to tylko liczba`);
    try { if (!adresDozwolony(k.adres)) bledy.push(`${n}: adres poza Jaskinią, jej gałęziami i publicznymi repo Jozzpoly`); }
    catch { bledy.push(`${n}: adres nie jest poprawnym URL`); }
    const tekst = JSON.stringify(k);
    for (const r of SECRET_RULES) if (r.re.test(tekst)) bledy.push(`${n}: wygląda na sekret (${r.id})`);
    if (SCIEZKI_LOKALNE.test(tekst)) bledy.push(`${n}: lokalna ścieżka albo localhost`);
  }
  return bledy; // Komunikaty nie powtarzają dopasowanego tekstu — logi CI publicznego repo są publiczne.
}

test('zgloszenia.json przechodzi przez sito jawności', () => {
  const bledy = sito(JSON.parse(fs.readFileSync(plik, 'utf8')));
  assert.deepEqual(bledy, [], bledy.join('\n'));
});

test('sito łapie to, po co jest (próby na kopiach w pamięci)', () => {
  const dobra = { nr: 1, czas: '2026-11-14T08:00:00Z', repo: 'Jaskinia', co: 'x', adres: 'https://jaskinia.jozzpoly.workers.dev/', agent: 'a', model: 'm', podobne: [] };
  const k = zmiana => ({ wersja: 1, zgloszenia: [{ ...dobra, ...zmiana }] });
  assert.deepEqual(sito(k({})), []);
  assert.deepEqual(sito(k({ adres: 'https://opus-code-studio-do-klikniecia-jaskinia.jozzpoly.workers.dev/studio/' })), []);
  assert.equal(sito(k({ repo: 'jakies-prywatne' })).length, 1);
  assert.equal(sito(k({ podobne: [{ data: '2026-10-01', repo: 'jakies-prywatne', plik: 'a.md' }] })).length, 1);
  assert.equal(sito(k({ adres: 'https://example.com/' })).length, 1);
  assert.equal(sito(k({ adres: 'http://jaskinia.jozzpoly.workers.dev/' })).length, 1);
  assert.equal(sito(k({ adres: 'https://jozzpoly.github.io/jakies-prywatne/' })).length, 1);
  assert.equal(sito(k({ co: 'klucz ghp_' + 'a'.repeat(36) })).length, 1);
  assert.equal(sito(k({ co: 'plik w C:\\Gry\\x' })).length, 1);
  assert.equal(sito(k({ co: 'zobacz /home/claude/x' })).length, 1);
  assert.equal(sito(k({ notatka: 'cokolwiek' })).length, 1);
  assert.equal(sito(k({ podobne_w_prywatnych: 'nazwa' })).length, 1);
});
