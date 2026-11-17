// Kanał na żywo: połączenie, którym Miejsce samo mówi otwartym stronom, że coś się zmieniło i kto jest w środku
// (17 XI 2026, fala 3 kampanii). Status: próba (TYMCZASOWE.md).
// Po co: strona pytała o puls co kilka sekund, także wtedy, gdy nic się nie działo. Na darmowym planie to zjada
// dobowy limit żądań, a zmiana i tak docierała z opóźnieniem. Połączenie odwraca kierunek: nic się nie dzieje, to
// nikt o nic nie pyta; coś się zmieniło, to wszyscy wiedzą od razu. Obiekt Miejsca może przy tym spać (gniazda
// przyjmuje sposobem, który pozwala mu zasnąć), więc otwarta strona nie kosztuje czasu działania.
// Kanał NIE jest drugą drogą do danych: niesie sam numer ostatniego aktu i obecność. Treść każdy czyta potem
// zwykłymi drzwiami, ze swoimi prawami, więc reguły widoczności stoją w jednym miejscu.
// Obecność jest cienka i ma wyłącznik: kto jest połączony i przy której rzeczy, tylko dla uczestników z kluczem,
// a uczestnik może słuchać zmian, nie pokazując się (cicho).
// Ten plik nie zna Cloudflare: dostaje gniazda jako zwykłe obiekty (send, close, serializeAttachment,
// deserializeAttachment), więc da się go sprawdzić w Node.
import { wczytajKlucze } from './klucze.mjs';
import { skrot } from './miejsce.mjs';

export const ADRES_ZYWEGO = '/api/srodowisko/zywe';
export const NAJWIECEJ_GNIAZD = 100;
export const NAJWIECEJ_NA_MINUTE = 60;
export const NAJWIECEJ_ZLYCH_KLUCZY = 5;
// Kody zamknięcia z zakresu prywatnego: strona po nich wie, czy łączyć się od razu ponownie.
export const KOD_ZLY_KLUCZ = 4401;
export const KOD_ZA_DUZO = 4429;
export const KOD_USTAP = 4503;
const ID = /^[0-9a-z]{26}$/;
const MINUTA = 60 * 1000;

// Kim jest gniazdo: zapamiętane w jego załączniku, żeby przetrwało uśpienie obiektu.
export const stanGniazda = (ws) => { try { const s = ws.deserializeAttachment(); return s && typeof s === 'object' ? s : {}; } catch { return {}; } };
const zapamietaj = (ws, s) => { try { ws.serializeAttachment(s); } catch { /* gniazdo mogło zniknąć */ } };
const wyslij = (ws, w) => { try { ws.send(JSON.stringify(w)); return true; } catch { return false; } };
const zamknij = (ws, kod, powod) => { try { ws.close(kod, powod); } catch { /* już zamknięte */ } };

// Kto jest teraz w Miejscu: jedno imię raz (kilka kart tej samej osoby to jedna obecność), z rzeczą, przy której jest.
// Uczestnik, który słucha po cichu, nie jest liczony nigdzie.
export function obecni(gniazda) {
  const lista = new Map();
  let bezKlucza = 0;
  for (const ws of gniazda) {
    const s = stanGniazda(ws);
    if (!s.kto) { bezKlucza++; continue; }
    if (s.cicho) continue;
    const jest = lista.get(s.kto);
    if (!jest || (s.przy && !jest.przy)) lista.set(s.kto, { kto: s.kto, ...(s.przy ? { przy: s.przy } : {}) });
  }
  return { lista: [...lista.values()].sort((a, b) => a.kto.localeCompare(b.kto)), bez_klucza: bezKlucza };
}

// Wiadomość do wszystkich gniazd. Poza podglądem gniazdo bez klucza nie dostaje niczego: Miejsce nie jest tam
// publiczne, więc nawet numer aktu jest tylko dla uczestników.
export function rozglos(gniazda, wiadomosc, { podglad = false } = {}) {
  let ile = 0;
  for (const ws of gniazda) {
    if (!podglad && !stanGniazda(ws).kto) continue;
    if (wyslij(ws, wiadomosc)) ile++;
  }
  return ile;
}

// Obecność: imiona tylko dla gniazd z kluczem; gniazdo bez klucza (na podglądzie) dostaje samą liczbę.
const obecnoscDla = (ws, o, podglad) => {
  if (stanGniazda(ws).kto) wyslij(ws, { t: 'obecni', lista: o.lista, bez_klucza: o.bez_klucza });
  else if (podglad) wyslij(ws, { t: 'obecni', ilu: o.lista.length, bez_klucza: o.bez_klucza });
};
export function rozglosObecnych(gniazda, { podglad = false } = {}) {
  const o = obecni(gniazda);
  for (const ws of gniazda) obecnoscDla(ws, o, podglad);
}

// Czy jest miejsce na nowe połączenie. Gdy nie ma, ustępuje najstarsze połączenie bez klucza: zwiedzający nie może
// zająć wszystkich miejsc tak, żeby uczestnik z kluczem nie wszedł. Gdy wszystkie mają klucze, nowe musi poczekać.
export function zrobMiejsce(gniazda, najwiecej = NAJWIECEJ_GNIAZD) {
  if (gniazda.length < najwiecej) return true;
  let najstarsze = null, od = Infinity;
  for (const ws of gniazda) {
    const s = stanGniazda(ws);
    if (!s.kto && (s.od || 0) < od) { od = s.od || 0; najstarsze = ws; }
  }
  if (!najstarsze) return false;
  zamknij(najstarsze, KOD_USTAP, 'ustąp miejsca');
  return true;
}

// Nowe połączenie. `kto` jest znane od razu tylko wtedy, gdy łączący umiał podać klucz w nagłówku (agent);
// przeglądarka przedstawia się dopiero pierwszą wiadomością. `gniazda` to lista już RAZEM z nowym.
export function przyjmijGniazdo(ws, { kto = null, podglad = false, akt = 0, gniazda = [], teraz = Date.now() } = {}) {
  zapamietaj(ws, { kto: kto || null, przy: null, cicho: false, od: teraz, okno: teraz, n: 0, zle: 0 });
  if (kto) {
    wyslij(ws, { t: 'witaj', kto, akt });
    rozglosObecnych(gniazda, { podglad });
  } else if (podglad) {
    wyslij(ws, { t: 'akt', akt });
    obecnoscDla(ws, obecni(gniazda), podglad);
  }
}

// Co gniazdo mówi do Miejsca. Przeglądarka nie umie wysłać nagłówka z kluczem przy otwieraniu połączenia, więc
// przedstawia się pierwszą wiadomością; klucz sprawdzamy tak samo jak przy każdych drzwiach (skrót, nie treść).
// `gniazda` i `akt` to funkcje, bo w czasie liczenia skrótu lista połączeń i numer aktu mogą się zmienić.
export async function przyjmijWiadomosc(ws, surowe, { env = {}, gniazda = () => [], podglad = false, akt = () => 0, teraz = Date.now() } = {}) {
  const s = stanGniazda(ws);
  // Każda wiadomość budzi obiekt i liczy się do dobowego limitu, więc gniazdo, które nimi zalewa, traci połączenie.
  if (!s.okno || teraz - s.okno > MINUTA) { s.okno = teraz; s.n = 0; }
  s.n = (s.n || 0) + 1;
  zapamietaj(ws, s);
  if (s.n > NAJWIECEJ_NA_MINUTE) { zamknij(ws, KOD_ZA_DUZO, 'za dużo wiadomości'); return; }
  if (typeof surowe !== 'string' || surowe.length > 2000) return;
  let m = null;
  try { m = JSON.parse(surowe); } catch { return; }
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;

  if (m.t === 'jestem') {
    const klucz = typeof m.klucz === 'string' && /^\S{16,256}$/.test(m.klucz) ? m.klucz : null;
    const k = wczytajKlucze(env);
    let kto = null;
    if (k.ok && klucz) {
      const h = await skrot(klucz);
      const traf = k.wpisy.find(([, x]) => x === h);
      kto = traf ? traf[0] : null;
    }
    const teraz2 = stanGniazda(ws); // po liczeniu skrótu stan mógł się zmienić: bierzemy świeży
    if (!kto) {
      const zle = (teraz2.zle || 0) + 1;
      zapamietaj(ws, { ...teraz2, zle });
      wyslij(ws, { t: 'blad', blad: 'nieznany klucz' });
      // Poza podglądem połączenie bez klucza i tak niczego nie słyszy, więc po złym kluczu nie ma po co stać.
      if (!podglad || zle >= NAJWIECEJ_ZLYCH_KLUCZY) zamknij(ws, KOD_ZLY_KLUCZ, 'nieznany klucz');
      return;
    }
    zapamietaj(ws, { ...teraz2, kto, zle: 0, cicho: m.cicho === true, przy: null });
    wyslij(ws, { t: 'witaj', kto, akt: akt() });
    rozglosObecnych(gniazda(), { podglad });
  } else if (m.t === 'przy') {
    // przy której rzeczy uczestnik teraz jest (otwarte okno, karta); null znaczy: przy żadnej
    if (!s.kto || s.cicho) return;
    const przy = typeof m.rzecz === 'string' && ID.test(m.rzecz) ? m.rzecz : null;
    if ((s.przy || null) === przy) return;
    zapamietaj(ws, { ...s, przy });
    rozglosObecnych(gniazda(), { podglad });
  } else if (m.t === 'cicho') {
    // wyłącznik obecności: uczestnik dalej słyszy zmiany, ale inni go nie widzą
    if (!s.kto) return;
    const cicho = m.cicho !== false;
    if (Boolean(s.cicho) === cicho) return;
    zapamietaj(ws, { ...s, cicho, przy: cicho ? null : s.przy });
    rozglosObecnych(gniazda(), { podglad });
  } else if (m.t === 'wychodze') {
    if (!s.kto) return;
    zapamietaj(ws, { ...s, kto: null, przy: null, cicho: false });
    rozglosObecnych(gniazda(), { podglad });
  }
}

// Połączenie się skończyło: jeśli było kogoś widać, pozostali dostają nową listę obecnych.
export function poZamknieciu(ws, pozostale, { podglad = false } = {}) {
  const s = stanGniazda(ws);
  if (s.kto && !s.cicho) rozglosObecnych(pozostale.filter((x) => x !== ws), { podglad });
}
