// Sprawdzian narzędzia Drogi: skutkiem, na prawdziwych plikach, a nie na jego własnych funkcjach.
// Każdy przypadek buduje maleńkie repo w katalogu tymczasowym i patrzy, co narzędzie powie i z jakim
// kodem wyjścia się skończy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const NARZEDZIE = join(dirname(fileURLToPath(import.meta.url)), 'drogi.mjs');

const DRZWI_Z_SASIADAMI = [
  '# Próbne repo',
  '',
  'Sąsiedzi:',
  '- [stara Jaskinia](https://github.com/Jozzpoly/Jozz-Cave-Workbench)',
  '- [Medium](https://github.com/Jozzpoly/Shared-Work-Medium-Lab)',
  '- [Feniks Studio](https://github.com/Jozzpoly/Feniks-Studio)',
  '',
].join('\n');

function repo(pliki) {
  const katalog = mkdtempSync(join(tmpdir(), 'drogi-'));
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    const pelna = join(katalog, sciezka);
    mkdirSync(dirname(pelna), { recursive: true });
    writeFileSync(pelna, tresc);
  }
  return katalog;
}

function uruchom(katalog) {
  const w = spawnSync(process.execPath, [NARZEDZIE, katalog], { encoding: 'utf8' });
  return { kod: w.status, tekst: (w.stdout || '') + (w.stderr || '') };
}

test('spięte repo przechodzi i mówi 100%', () => {
  const k = repo({
    'README.md': DRZWI_Z_SASIADAMI + '\nDalej: [notatka](docs/notatka.md)\n',
    'docs/notatka.md': '# Notatka\n',
  });
  try {
    const { kod, tekst } = uruchom(k);
    assert.equal(kod, 0);
    assert.match(tekst, /2 z 2 dokumentów osiągalnych od drzwi \(100%\)/);
  } finally { rmSync(k, { recursive: true, force: true }); }
});

test('dokument bez odnośnika do siebie jest zgłoszony jako sierota', () => {
  const k = repo({
    'README.md': DRZWI_Z_SASIADAMI,
    'rundy/wazny-raport.md': '# Ważny raport\n',
  });
  try {
    const { kod, tekst } = uruchom(k);
    assert.equal(kod, 1);
    assert.match(tekst, /sierota · rundy\/wazny-raport\.md/);
  } finally { rmSync(k, { recursive: true, force: true }); }
});

test('odnośnik donikąd jest zgłoszony jako martwy', () => {
  const k = repo({ 'README.md': DRZWI_Z_SASIADAMI + '\n[plan](PLAN.md)\n' });
  try {
    const { kod, tekst } = uruchom(k);
    assert.equal(kod, 1);
    assert.match(tekst, /martwy · README\.md → PLAN\.md/);
  } finally { rmSync(k, { recursive: true, force: true }); }
});

test('ścieżka do dokumentu z innego repozytorium ma być adresem', () => {
  const k = repo({ 'README.md': DRZWI_Z_SASIADAMI + '\n[stan badań](docs/RESEARCH_STATE.md)\n' });
  try {
    const { kod, tekst } = uruchom(k);
    assert.equal(kod, 1);
    assert.match(tekst, /obca ścieżka · README\.md → docs\/RESEARCH_STATE\.md/);
  } finally { rmSync(k, { recursive: true, force: true }); }
});

test('drzwi bez adresów sąsiadów nie przechodzą', () => {
  const k = repo({ 'README.md': '# Próbne repo\n' });
  try {
    const { kod, tekst } = uruchom(k);
    assert.equal(kod, 1);
    assert.match(tekst, /sąsiad · drzwi nie podają adresu: Medium/);
  } finally { rmSync(k, { recursive: true, force: true }); }
});

test('odnośnik do katalogu żyje, ale nie udostępnia jego zawartości', () => {
  const k = repo({
    'README.md': DRZWI_Z_SASIADAMI + '\nWszystko leży w [rundy/](rundy/)\n',
    'rundy/schowany.md': '# Schowany\n',
  });
  try {
    const { kod, tekst } = uruchom(k);
    assert.equal(kod, 1, 'katalog nie może udawać spisu treści');
    assert.match(tekst, /sierota · rundy\/schowany\.md/);
    assert.doesNotMatch(tekst, /martwy · README\.md → rundy\//);
  } finally { rmSync(k, { recursive: true, force: true }); }
});
