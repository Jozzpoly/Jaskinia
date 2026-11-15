// Klucze do Miejsca: kto pisze i czyta wspólny stan (11 XI 2026). Status: próba (TYMCZASOWE.md).
// Bez Cloudflare Access (Jozz, 4 XI: Zero Trust nie jest domyślnym fundamentem). Zamiast tego każdy uczestnik ma
// własny klucz, a Worker zna tylko ich skróty SHA-256, zapisane w ustawieniu KLUCZE jako JSON {imię: skrót}.
// Imię `jozz` to właściciel. Sam klucz zna tylko jego posiadacz; nie trafia do repo, rozmowy ani dziennika.
// Bez ustawienia KLUCZE Miejsce jest zamknięte i mówi to wprost.
import { skrot, poprawneImie } from './miejsce.mjs';

export function wczytajKlucze(env = {}) {
  if (!env.KLUCZE) return { ok: false, status: 503, blad: 'Miejsce zamknięte: właściciel nie ustawił kluczy (ustawienie KLUCZE w Cloudflare)' };
  let mapa;
  try { mapa = typeof env.KLUCZE === 'string' ? JSON.parse(env.KLUCZE) : env.KLUCZE; } catch { mapa = null; }
  if (!mapa || typeof mapa !== 'object') return { ok: false, status: 500, blad: 'ustawienie KLUCZE nie jest poprawnym JSON {imię: skrót}' };
  const wpisy = Object.entries(mapa).filter(([imie, s]) => poprawneImie(imie) && /^[0-9a-f]{64}$/.test(String(s)));
  if (!wpisy.length) return { ok: false, status: 500, blad: 'ustawienie KLUCZE nie ma żadnego poprawnego wpisu' };
  return { ok: true, wpisy };
}

export async function ktoTo(request, env = {}) {
  const k = wczytajKlucze(env);
  if (!k.ok) return k;
  const naglowek = request.headers.get('authorization') || '';
  const m = /^Bearer\s+(\S{16,256})$/.exec(naglowek);
  if (!m) return { ok: false, status: 401, blad: 'potrzebny klucz: nagłówek Authorization: Bearer <klucz>, co najmniej 16 znaków' };
  const s = await skrot(m[1]);
  const traf = k.wpisy.find(([, h]) => h === s);
  if (!traf) return { ok: false, status: 401, blad: 'nieznany klucz' };
  return { ok: true, kto: traf[0] };
}
