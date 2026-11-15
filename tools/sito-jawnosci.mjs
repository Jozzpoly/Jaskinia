// Sito jawności: wspólne części dla każdego pliku, który agent dopisuje, a Jaskinia podaje publicznie.
//
// Powstało 14 XI jako funkcja w `zgloszenia.test.mjs` (Opus czatu, dziura załatana przez drugą linię).
// Wyjęte tutaj 15 XI, gdy drugi taki plik — `public/do-obejrzenia/czeka.json` — potrzebował tego
// samego sita. Kopia byłaby tym kosztem, przez który tymczasowe zamienia się w beton (zasada 7),
// a zasada 8 żąda jawnego adaptera zamiast powtórzonej treści.
//
// Czego to sito NIE robi: nie cofa wycieku. Repozytorium jest publiczne, więc co trafi do tych
// plików, jest jawne od chwili wypchnięcia — także na gałęzi PR-a. Sito zatrzymuje PR (czerwony test
// przed scaleniem) i podnosi alarm na `main`, gdy ktoś wypchnął wprost. Wolnego tekstu z nazw
// prywatnych repozytoriów nie sprawdzi — ich listy z zasady tu nie ma.

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

export const SCIEZKI_LOKALNE = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\/home\/|\/root\/|\/tmp\/|\/mnt\/|\/Users\/|file:|\\)|[A-Za-z]:[\\/](?:Users|home|Program|Windows)\b|localhost|127\.0\.0\.1/;

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

// Każda wartość tekstowa osobno, nie `JSON.stringify`: w JSON-ie cudzysłów w tekście staje się \"
// i udawał ścieżkę z ukośnikiem (14 XI 14:51, druga linia: „Jozz powiedział "tak"” dawało błąd).
export function teksty(obiekt) {
  const out = [];
  (function zbierz(v) {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(zbierz);
  })(obiekt);
  return out;
}

// Sekrety i lokalne ścieżki w dowolnym wpisie. Komunikaty nie powtarzają dopasowanego tekstu —
// logi CI publicznego repozytorium są publiczne.
export function bledyTekstow(wpis, nazwa) {
  const bledy = [];
  const t = teksty(wpis);
  for (const r of SECRET_RULES) if (t.some((x) => r.re.test(x))) bledy.push(`${nazwa}: wygląda na sekret (${r.id})`);
  if (t.some((x) => SCIEZKI_LOKALNE.test(x))) bledy.push(`${nazwa}: lokalna ścieżka albo localhost`);
  return bledy;
}
