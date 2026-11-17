// Klucze do Miejsca: kto pisze i czyta wspólny stan (11 XI 2026). Status: próba (TYMCZASOWE.md).
// Bez Cloudflare Access (Jozz, 4 XI: Zero Trust nie jest domyślnym fundamentem). Zamiast tego każdy uczestnik ma
// własny klucz, a Worker zna tylko ich skróty SHA-256, zapisane w ustawieniu KLUCZE jako JSON {imię: skrót}.
// Imię `jozz` to właściciel. Sam klucz zna tylko jego posiadacz; nie trafia do repo, rozmowy ani dziennika.
// Bez ustawienia KLUCZE Miejsce jest zamknięte i mówi to wprost.
import { skrot, poprawneImie } from './miejsce.mjs';
import { ciastkoZNaglowka, czytajSesje } from './drzwi.mjs';

// Właściciel: jedno imię z ustawienia Workera (ta sama domyślna wartość co w rdzeniu Miejsca).
export const wlascicielZUstawien = (env = {}) => (typeof env.WLASCICIEL === 'string' && poprawneImie(env.WLASCICIEL) ? env.WLASCICIEL : 'jozz');

// Czy w żądaniu jest w ogóle cokolwiek, czym można się przedstawić. Drzwi właściciela nie dają klucza
// w nagłówku, tylko ciastko sesji, więc front musi wiedzieć, że warto zapytać.
export const maTozsamosc = (request) => request.headers.has('authorization') || !!ciastkoZNaglowka(request.headers.get('cookie'));

// Imiona, których nie może nosić żaden klucz: pod nimi działa samo środowisko, więc klucz o takim imieniu
// podszywałby się pod nie w dzienniku (znalezisko niezależnego ataku, 17 XI 2026). `obserwator` to automat, który
// przynosi fakty z GitHuba: chodzi zwykłym ruchem, więc jedyną ochroną jest to, że żaden klucz nie może nosić tego imienia.
export const IMIONA_ZASTRZEZONE = ['srodowisko', 'obserwator'];

export function wczytajKlucze(env = {}) {
  if (!env.KLUCZE) return { ok: false, status: 503, blad: 'Miejsce zamknięte: właściciel nie ustawił kluczy (ustawienie KLUCZE w Cloudflare)' };
  let mapa;
  try { mapa = typeof env.KLUCZE === 'string' ? JSON.parse(env.KLUCZE) : env.KLUCZE; } catch { mapa = null; }
  if (!mapa || typeof mapa !== 'object') return { ok: false, status: 500, blad: 'ustawienie KLUCZE nie jest poprawnym JSON {imię: skrót}' };
  const wpisy = Object.entries(mapa).filter(([imie, s]) => poprawneImie(imie) && !IMIONA_ZASTRZEZONE.includes(imie) && /^[0-9a-f]{64}$/.test(String(s)));
  if (!wpisy.length) return { ok: false, status: 500, blad: 'ustawienie KLUCZE nie ma żadnego poprawnego wpisu' };
  return { ok: true, wpisy };
}

export async function ktoTo(request, env = {}) {
  const k = wczytajKlucze(env);
  if (!k.ok) return k;
  const naglowek = request.headers.get('authorization') || '';
  const m = /^Bearer\s+(\S{16,256})$/.exec(naglowek);
  if (m) {
    const s = await skrot(m[1]);
    const traf = k.wpisy.find(([, h]) => h === s);
    if (!traf) return { ok: false, status: 401, blad: 'nieznany klucz' };
    return { ok: true, kto: traf[0], skad: 'klucz' };
  }
  // Drugie wejście: sesja z drzwi właściciela (ciastko podpisane sekretem z ustawień Workera). Niesie tylko
  // imię właściciela, bo tylko on ma poświadczenie; cudze imię w podpisanym ciastku i tak tu nie wejdzie.
  const zeton = ciastkoZNaglowka(request.headers.get('cookie'));
  if (zeton && typeof env.SEKRET_SESJI === 'string') {
    const sesja = await czytajSesje(env.SEKRET_SESJI, zeton).catch(() => null);
    if (sesja && sesja.imie === wlascicielZUstawien(env)) return { ok: true, kto: sesja.imie, skad: 'sesja' };
  }
  return { ok: false, status: 401, blad: 'potrzebny klucz: nagłówek Authorization: Bearer <klucz>, co najmniej 16 znaków (albo wejście drzwiami właściciela)' };
}
