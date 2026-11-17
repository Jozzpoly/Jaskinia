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
import { ADRES_ZYWEGO, przyjmijGniazdo, przyjmijWiadomosc, poZamknieciu, rozglos, zrobMiejsce } from './zywe.mjs';

const odmowa = (status, blad) => new Response(JSON.stringify({ ok: false, status, blad }, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export class Miejsce {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.env = env;
    // Kto jest właścicielem, mówi ustawienie Workera (WLASCICIEL), nie kod.
    this.rdzen = new Rdzen(ctx.storage.sql, { wlasciciel: env.WLASCICIEL });
    this.srod = new Srodowisko(this.rdzen);
    this.zasiane = null;
    // Samo "ping" dostaje "pong" bez budzenia obiektu: strona sprawdza tak, czy połączenie na żywo jeszcze stoi.
    try {
      if (typeof WebSocketRequestResponsePair === 'function' && typeof ctx.setWebSocketAutoResponse === 'function') ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch { /* bez tej wygody kanał działa dalej */ }
  }

  get _podglad() { return this.env.PODGLAD === 'tak'; }

  // Zasiew środowiska: jeden na instancję, kolejne wejścia czekają na ten sam.
  _zasiew() {
    this.zasiane ??= this.srod.zasiej(ziarna({ wlasciciel: this.rdzen.wlasciciel })).catch((e) => { this.zasiane = null; throw e; });
    return this.zasiane;
  }

  // Otwarte połączenia na żywo. W sprawdzianach ctx ma tylko bazę, więc brak tej zdolności znaczy: żadnych połączeń.
  _gniazda() {
    try { return typeof this.ctx.getWebSockets === 'function' ? this.ctx.getWebSockets() : []; } catch { return []; }
  }

  // Każda zmiana w Miejscu idzie do otwartych połączeń jako sam numer ostatniego aktu. Treść każdy czyta potem
  // swoimi drzwiami i ze swoimi prawami, więc kanał nie jest drugą drogą do danych. `calosc` mówi stronie, że
  // Miejsce zostało podmienione w całości (wwóz) i trzeba przeczytać wszystko od nowa.
  _rozglosZmiane(przed, dodatkowe = {}) {
    const teraz = this.srod.ostatniNr();
    if (teraz === przed && !dodatkowe.calosc) return 0;
    const gniazda = this._gniazda();
    return gniazda.length ? rozglos(gniazda, { t: 'akt', akt: teraz, ...dodatkowe }, { podglad: this._podglad }) : 0;
  }

  async fetch(request) {
    const sciezka = new URL(request.url).pathname;
    if (sciezka === ADRES_ZYWEGO) return this._zywe(request);
    // Tylko żądania, które mogą coś zmienić, płacą za sprawdzenie numeru aktu przed i po.
    const zmienia = request.method !== 'GET';
    const przed = zmienia ? this.srod.ostatniNr() : 0;
    if (sciezka === '/api/miejsce' || sciezka.startsWith('/api/miejsce/')) {
      const odp = await obsluzMiejsce(this.rdzen, request);
      // Po wwozie całości spis środowiska liczy się od nowa z głów i dziennika, a zasiew sprawdza się jeszcze raz:
      // bez tego wwiezione Miejsce miało pusty spis i odrzucało każde żądanie (znalezisko ataku, 17 XI 2026).
      const wwoz = request.method === 'POST' && sciezka === '/api/miejsce/import' && odp.status === 200;
      if (wwoz) { this.srod.przebuduj(); this.zasiane = null; this.znani = null; }
      if (zmienia) this._rozglosZmiane(przed, wwoz ? { calosc: true } : {});
      return odp;
    }
    // Środowisko zasiewa swoje rzeczy przy pierwszym wejściu; kolejne wejścia czekają na ten sam zasiew.
    await this._zasiew();
    // Uczestnik, którego klucz właściciel ustawił, ma być widoczny jako rzecz, zanim zrobi pierwszy ruch:
    // inaczej czytający widzi w historii imię, którego nie ma wśród uczestników (uwaga sędziego, 17 XI).
    const imiona = (request.headers.get('x-imiona') || '').split(',').filter((i) => /^[a-z][a-z0-9_-]{0,39}$/.test(i) && i !== this.rdzen.wlasciciel && i !== AUTOMAT);
    this.znani ??= new Set();
    const nowi = imiona.filter((i) => !this.znani.has(i));
    if (nowi.length) {
      await this.srod.zasiej(nowi.map((imie) => ({ nazwa: 'uczestnik-' + imie, rodzaj: 'uczestnik/1', cechy: { imie, rola: 'agent', opis: 'Uczestnik znany z klucza ustawionego przez właściciela.' } })));
      nowi.forEach((i) => this.znani.add(i));
    }
    const odp = await obsluzSrodowisko(this.srod, request, { podglad: this._podglad, kluczProbny: this.env.KLUCZ_PROBNY_AGENTA || null, kluczProbnyWlasciciela: this.env.KLUCZ_PROBNY_WLASCICIELA || null });
    if (zmienia) this._rozglosZmiane(przed);
    return odp;
  }

  // Drzwi kanału na żywo. Zwraca albo odmowę, albo gniazdo dla łączącego; samo przyjęcie jest osobno, żeby dało się
  // je sprawdzić bez środowiska Cloudflare.
  async _otworzZywe(request) {
    if ((request.headers.get('upgrade') || '').toLowerCase() !== 'websocket') return { status: 426, blad: 'to są drzwi kanału na żywo: potrzebne połączenie WebSocket (nagłówek Upgrade: websocket)' };
    if (typeof WebSocketPair !== 'function' || typeof this.ctx.acceptWebSocket !== 'function') return { status: 501, blad: 'to środowisko nie umie połączeń na żywo' };
    await this._zasiew();
    if (!zrobMiejsce(this._gniazda())) return { status: 503, blad: 'za dużo połączeń na żywo naraz; spróbuj za chwilę' };
    const para = new WebSocketPair();
    const klient = para[0], serwer = para[1];
    // Przyjęcie w sposób, który pozwala obiektowi zasnąć między wiadomościami: połączenie stoi, a czas nie biegnie.
    this.ctx.acceptWebSocket(serwer);
    przyjmijGniazdo(serwer, { kto: request.headers.get('x-kto') || null, podglad: this._podglad, akt: this.srod.ostatniNr(), gniazda: this._gniazda() });
    return { klient };
  }

  async _zywe(request) {
    const w = await this._otworzZywe(request);
    return w.klient ? new Response(null, { status: 101, webSocket: w.klient }) : odmowa(w.status, w.blad);
  }

  // Wiadomość od połączenia budzi obiekt; pamięć instancji mogła zniknąć, więc wszystko, co potrzebne, jest w gnieździe.
  async webSocketMessage(ws, wiadomosc) {
    await przyjmijWiadomosc(ws, wiadomosc, { env: this.env, gniazda: () => this._gniazda(), podglad: this._podglad, akt: () => this.srod.ostatniNr() });
  }

  async webSocketClose(ws) {
    try { ws.close(1000, 'do zobaczenia'); } catch { /* druga strona już zamknęła */ }
    poZamknieciu(ws, this._gniazda(), { podglad: this._podglad });
  }

  async webSocketError(ws) {
    poZamknieciu(ws, this._gniazda(), { podglad: this._podglad });
  }
}
