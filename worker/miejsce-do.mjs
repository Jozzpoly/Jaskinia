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

const MINUTA_MS = 60 * 1000;

export class Miejsce {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.env = env;
    // Kto jest właścicielem, mówi ustawienie Workera (WLASCICIEL), nie kod.
    this.rdzen = new Rdzen(ctx.storage.sql, { wlasciciel: env.WLASCICIEL });
    this.srod = new Srodowisko(this.rdzen);
    this.zasiane = null;
    this.alarmSprawdzony = false;
  }

  // Zasiew środowiska: jeden na instancję, kolejne wejścia czekają na ten sam.
  _zasiew() {
    this.zasiane ??= this.srod.zasiej(ziarna({ wlasciciel: this.rdzen.wlasciciel })).catch((e) => { this.zasiane = null; throw e; });
    return this.zasiane;
  }

  // Obejście obserwatora faktów z ustawieniami Workera. Token tylko z env, nigdy z danych.
  _obejdz() {
    return obejdz(this.srod, { owner: this.env.OBSERWATOR_WLASCICIEL || WLASCICIEL_GITHUBA, token: this.env.GITHUB_DANE_TOKEN || null });
  }

  // Co ile minut budzi się obserwator: domyślnie 30, nie rzadziej niż raz na dobę i nie częściej niż co 5 minut.
  _coMinut() {
    const n = Number(this.env.OBSERWATOR_CO_MIN);
    return Number.isFinite(n) && n > 0 ? Math.min(1440, Math.max(5, n)) : 30;
  }

  // Pierwszy alarm: po zasiewie, gdy obserwator jest włączony i nikt jeszcze nie ustawił alarmu. Wszystko, co dotyka
  // alarmów, jest opcjonalne: w sprawdzianach ctx.storage ma tylko sql.
  async _pierwszyAlarm() {
    if (this.alarmSprawdzony || this.env.OBSERWATOR !== 'tak') return;
    const st = this.ctx.storage;
    if (typeof st.getAlarm !== 'function' || typeof st.setAlarm !== 'function') return;
    try {
      if ((await st.getAlarm()) == null) await st.setAlarm(Date.now() + MINUTA_MS);
      this.alarmSprawdzony = true;
    } catch { /* alarm to wygoda: bez niego dalej działa ręczne obejście */ }
  }

  // Budzenie obserwatora faktów. Błąd obejścia nie zatrzymuje budzenia: następny alarm ustawia się zawsze.
  async alarm() {
    if (this.env.OBSERWATOR !== 'tak') return;
    try {
      await this._zasiew();
      await this._obejdz();
    } catch (e) {
      console.error('obserwator: obejście nie wyszło: ' + String((e && e.message) || e).slice(0, 200));
    } finally {
      try { await this.ctx.storage?.setAlarm?.(Date.now() + this._coMinut() * MINUTA_MS); } catch { /* następne wejście ustawi alarm od nowa */ }
    }
  }

  async fetch(request) {
    const sciezka = new URL(request.url).pathname;
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
    return obsluzSrodowisko(this.srod, request, { podglad: this.env.PODGLAD === 'tak', kluczProbny: this.env.KLUCZ_PROBNY_AGENTA || null, obejdz: this.env.OBSERWATOR === 'tak' ? () => this._obejdz() : null });
  }
}
