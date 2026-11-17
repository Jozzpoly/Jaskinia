// Durable Object Miejsca: jedna instancja na przestrzeń, z własną bazą SQLite. Status: próba (TYMCZASOWE.md).
// Wzięte z dawcy `claude/miejsce-wspolne-2026-11-11` (11 XI 2026) do kroku 1 rdzenia (15 XI 2026).
// Względem dawcy wypadł most do repozytorium agentów (alarm i `most.mjs`): krok 1 ma stały budżet czterech
// punktów i most do niego nie należy. W `miejsce.mjs` zostały po nim metody i zamknięta ścieżka `most/…`;
// nikt ich stąd nie woła. Zostają do decyzji, czy most wraca, czy znika (wpis w TYMCZASOWE.md).
// Zwykła klasa z fetch(), bez importu cloudflare:workers, żeby testy w Node mogły ładować moduł główny.
// Cloudflare trzyma tę bazę po stronie serwera, z odtworzeniem do dowolnej chwili z ostatnich 30 dni
// (point-in-time recovery dla Durable Objects z SQLite).
import { Rdzen, obsluzMiejsce } from './miejsce.mjs';
import { Srodowisko, AUTOMAT } from './srodowisko.mjs';
import { ziarna } from './ziarna.mjs';
import { obsluzSrodowisko } from './srodowisko-http.mjs';
import { obejdz } from './obserwator.mjs';
import { WLASCICIEL as WLASCICIEL_GITHUBA } from './fakty.mjs';
import { liczacySql, Budzet, naglowekKosztu } from './budzet.mjs';

const MINUTA_MS = 60 * 1000;
// Plik starej Jaskini zmienia się zwykle dwa razy na dobę: gdy koło gałęzi jest domknięte i nic się nie zmieniło,
// zaglądamy do niego co godzinę, a nie co kilka minut.
const SPOKOJNE_KOLO_MIN = 60;
const ADRES_MIEJSCA = 'miejsce:adres';

export class Miejsce {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.env = env;
    // Każde zapytanie do bazy dolicza swoje wiersze do licznika: z niego jest koszt żądania i suma doby (budzet.mjs).
    this.sql = liczacySql(ctx.storage.sql);
    // Kto jest właścicielem, mówi ustawienie Workera (WLASCICIEL), nie kod.
    this.rdzen = new Rdzen(this.sql, { wlasciciel: env.WLASCICIEL });
    this.srod = new Srodowisko(this.rdzen);
    // Dobowy limit zapisów tego Miejsca (BUDZET_ZAPISOW_NA_DOBE); bez ustawienia Miejsce tylko liczy.
    this.budzet = new Budzet(this.rdzen, this.sql.licznik, { limit: env.BUDZET_ZAPISOW_NA_DOBE });
    this.zasiane = null;
    this.alarmSprawdzony = false;
    this.host = null;
  }

  // Zasiew środowiska: jeden na instancję, kolejne wejścia czekają na ten sam.
  _zasiew() {
    this.zasiane ??= this.srod.zasiej(ziarna({ wlasciciel: this.rdzen.wlasciciel })).catch((e) => { this.zasiane = null; throw e; });
    return this.zasiane;
  }

  // Pod jakim adresem stoi to Miejsce. Alarm nie ma żądania, z którego dałoby się to odczytać, więc adres z ostatniego
  // wejścia zostaje w zapisie (jeden zapis, gdy się zmieni).
  _zapamietajAdres(request) {
    let host = null;
    try { host = new URL(request.headers.get('x-origin') || request.url).host.toLowerCase(); } catch { /* bez adresu zostaje poprzedni */ }
    if (!host || host === this.host) return;
    this.host = host;
    try { if (this.rdzen.meta(ADRES_MIEJSCA) !== host) this.rdzen.ustawMeta(ADRES_MIEJSCA, host); } catch { /* adres to wygoda dla alarmu */ }
  }

  _host() {
    if (!this.host) { try { this.host = this.rdzen.meta(ADRES_MIEJSCA) || null; } catch { /* nieznany */ } }
    return this.host;
  }

  // Obserwator chodzi tylko tam, gdzie go wpuszczono. Każdy podgląd gałęzi ma własną bazę, a pierwsze koło faktów to
  // kilkanaście tysięcy zapisanych wierszy ze wspólnego dobowego limitu konta: gdyby chodził na każdym podglądzie,
  // kilka gałęzi jednego dnia zatrzymałoby zapis wszędzie. OBSERWATOR_ADRESY to początki nazw hosta po przecinku
  // (np. "fable-srodowisko-"); bez tego ustawienia obserwator chodzi wszędzie, gdzie OBSERWATOR=tak.
  _wolnoObserwatorowi() {
    if (this.env.OBSERWATOR !== 'tak') return false;
    const lista = String(this.env.OBSERWATOR_ADRESY || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (!lista.length) return true;
    const host = this._host();
    return !!host && lista.some((poczatek) => host.startsWith(poczatek));
  }

  // Obejście obserwatora faktów z ustawieniami Workera. Token tylko z env, nigdy z danych. Adres pliku faktów starej
  // Jaskini (drugie źródło, gdy API GitHuba odmawia) też z env; `dodatkowe` to to, co podały drzwi ręczne (np. ileRepoNaRaz).
  _obejdz(dodatkowe = {}) {
    return obejdz(this.srod, { owner: this.env.OBSERWATOR_WLASCICIEL || WLASCICIEL_GITHUBA, token: this.env.GITHUB_DANE_TOKEN || null, biblioteka: this.env.OBSERWATOR_BIBLIOTEKA || null, licznik: this.sql.licznik, ...dodatkowe });
  }

  // Co ile minut budzi się obserwator: domyślnie 30, nie rzadziej niż raz na dobę i nie częściej niż co 5 minut.
  _coMinut() {
    const n = Number(this.env.OBSERWATOR_CO_MIN);
    return Number.isFinite(n) && n > 0 ? Math.min(1440, Math.max(5, n)) : 30;
  }

  // Pierwszy alarm: po zasiewie, gdy obserwator ma tu wstęp i nikt jeszcze nie ustawił alarmu. Wszystko, co dotyka
  // alarmów, jest opcjonalne: w sprawdzianach ctx.storage ma tylko sql.
  async _pierwszyAlarm() {
    if (this.alarmSprawdzony || !this._wolnoObserwatorowi()) return;
    const st = this.ctx.storage;
    if (typeof st.getAlarm !== 'function' || typeof st.setAlarm !== 'function') return;
    try {
      if ((await st.getAlarm()) == null) await st.setAlarm(Date.now() + MINUTA_MS);
      this.alarmSprawdzony = true;
    } catch { /* alarm to wygoda: bez niego dalej działa ręczne obejście */ }
  }

  // Budzenie obserwatora faktów. Błąd obejścia nie zatrzymuje budzenia: następny alarm ustawia się zawsze.
  // Tam, gdzie obserwator nie ma wstępu, alarm gaśnie sam (nie ustawia następnego).
  async alarm() {
    if (!this._wolnoObserwatorowi()) return;
    let rzadko = false;
    const znacznik = this.budzet.otworz();
    try {
      await this._zasiew();
      // Po dojściu do dobowego limitu zapisów obserwator czeka do jutra: fakty poczekają, wspólny budżet nie.
      if (!this.budzet.przekroczony()) {
        const w = await this._obejdz();
        rzadko = !!(w && w.zrodlo === 'plik' && w.kolo_spokojne === true);
      } else rzadko = true;
    } catch (e) {
      console.error('obserwator: obejście nie wyszło: ' + String((e && e.message) || e).slice(0, 200));
    } finally {
      this.budzet.zamknij(znacznik);
      const co = rzadko ? Math.max(this._coMinut(), SPOKOJNE_KOLO_MIN) : this._coMinut();
      try { await this.ctx.storage?.setAlarm?.(Date.now() + co * MINUTA_MS); } catch { /* następne wejście ustawi alarm od nowa */ }
    }
  }

  // Każde żądanie wychodzi z miarą: ile wierszy bazy przeczytało i zapisało (nagłówek x-koszt).
  async fetch(request) {
    const znacznik = this.budzet.otworz();
    const odp = await this._obsluz(request);
    const koszt = this.budzet.zamknij(znacznik);
    try { odp.headers.set('x-koszt', naglowekKosztu(koszt)); } catch { /* odpowiedź, której nagłówków nie da się zmienić, zostaje bez miary */ }
    return odp;
  }

  async _obsluz(request) {
    const sciezka = new URL(request.url).pathname;
    this._zapamietajAdres(request);
    // Bezpiecznik: po dojściu do dobowego limitu zapisów Miejsce tylko czyta (budzet.mjs).
    if (request.method !== 'GET' && this.budzet.przekroczony()) {
      const o = this.budzet.odmowa();
      return new Response(JSON.stringify(o, null, 2), { status: o.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (sciezka === '/api/miejsce' || sciezka.startsWith('/api/miejsce/')) {
      const odp = await obsluzMiejsce(this.rdzen, request);
      // Po wwozie całości spis środowiska liczy się od nowa z głów i dziennika, a zasiew sprawdza się jeszcze raz:
      // bez tego wwiezione Miejsce miało pusty spis i odrzucało każde żądanie (znalezisko ataku, 17 XI 2026).
      if (request.method === 'POST' && sciezka === '/api/miejsce/import' && odp.status === 200) { this.srod.przebuduj(); this.zasiane = null; this.znani = null; }
      return odp;
    }
    // Środowisko zasiewa swoje rzeczy przy pierwszym wejściu; kolejne wejścia czekają na ten sam zasiew.
    await this._zasiew();
    await this._pierwszyAlarm();
    // Uczestnik, którego klucz właściciel ustawił, ma być widoczny jako rzecz, zanim zrobi pierwszy ruch:
    // inaczej czytający widzi w historii imię, którego nie ma wśród uczestników (uwaga sędziego, 17 XI).
    const imiona = (request.headers.get('x-imiona') || '').split(',').filter((i) => /^[a-z][a-z0-9_-]{0,39}$/.test(i) && i !== this.rdzen.wlasciciel && i !== AUTOMAT);
    this.znani ??= new Set();
    const nowi = imiona.filter((i) => !this.znani.has(i));
    if (nowi.length) {
      await this.srod.zasiej(nowi.map((imie) => ({ nazwa: 'uczestnik-' + imie, rodzaj: 'uczestnik/1', cechy: { imie, rola: 'agent', opis: 'Uczestnik znany z klucza ustawionego przez właściciela.' } })));
      nowi.forEach((i) => this.znani.add(i));
    }
    return obsluzSrodowisko(this.srod, request, { podglad: this.env.PODGLAD === 'tak', kluczProbny: this.env.KLUCZ_PROBNY_AGENTA || null, obejdz: this._wolnoObserwatorowi() ? (dodatkowe) => this._obejdz(dodatkowe) : null, budzet: this.budzet.opis() });
  }
}
