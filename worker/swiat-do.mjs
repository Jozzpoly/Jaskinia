// Durable Object Osady: świat żyje po stronie serwera (11 XI 2026). Status: próba (TYMCZASOWE.md).
// Czas świata płynie z zegara, nie z tykania: 1 krok (minuta świata) na KROK_MS prawdziwego czasu, więc doba świata
// trwa 4 godziny. Każde przebudzenie dogania zaległe kroki (najwyżej LIMIT_KROKOW naraz). Alarm budzi świat co
// 30 minut, kiedy nikt nie patrzy (żeby zdarzenia działy się o swojej porze i było widać, że świat żył), i co krok,
// kiedy ktoś ma otwarty podgląd przez WebSocket. WebSockety są hibernowane: połączenie trwa, a obiekt nie płaci
// za czas bezczynności. Klucz przychodzi w pierwszej wiadomości, nie w adresie.
import { nowySwiat, dogon, gest, widok, LIMIT_KROKOW } from './swiat.mjs';
import { ktoTo } from './klucze.mjs';

export const KROK_MS = 10_000;
export const RZADKI_ALARM_MS = 30 * 60_000;

export class Swiat {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS swiat (id INTEGER PRIMARY KEY CHECK (id = 1), stan TEXT NOT NULL, start INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS przebudzenia (nr INTEGER PRIMARY KEY AUTOINCREMENT, kiedy INTEGER NOT NULL, przyczyna TEXT NOT NULL, zrobione INTEGER NOT NULL, zostalo INTEGER NOT NULL)`);
  }

  wczytaj() {
    const w = this.sql.exec(`SELECT stan, start FROM swiat WHERE id = 1`).toArray()[0];
    if (w) return { s: JSON.parse(w.stan), start: w.start };
    const s = nowySwiat(), start = Date.now() - s.krok * KROK_MS;
    this.sql.exec(`INSERT INTO swiat (id, stan, start) VALUES (1, ?, ?)`, JSON.stringify(s), start);
    return { s, start };
  }

  // Dogonić czas i zapisać. Synchronicznie od odczytu do zapisu, więc dwa przebudzenia się nie przeplatają.
  obudz(przyczyna) {
    const { s, start } = this.wczytaj();
    const cel = Math.floor((Date.now() - start) / KROK_MS);
    const r = dogon(s, cel);
    this.sql.exec(`UPDATE swiat SET stan = ? WHERE id = 1`, JSON.stringify(s));
    this.sql.exec(`INSERT INTO przebudzenia (kiedy, przyczyna, zrobione, zostalo) VALUES (?, ?, ?, ?)`, Date.now(), przyczyna, r.zrobione, r.zostalo);
    this.sql.exec(`DELETE FROM przebudzenia WHERE nr <= (SELECT MAX(nr) - 500 FROM przebudzenia)`);
    return { s, ...r };
  }

  patrzacy() { return this.ctx.getWebSockets().filter((ws) => { try { return !!(ws.deserializeAttachment() || {}).kto; } catch { return false; } }); }

  async planuj(zostalo) {
    const za = zostalo > 0 ? 1000 : this.patrzacy().length ? KROK_MS : RZADKI_ALARM_MS;
    const teraz = await this.ctx.storage.getAlarm();
    const kiedy = Date.now() + za;
    if (teraz === null || teraz > kiedy) await this.ctx.storage.setAlarm(kiedy);
  }

  meta() {
    const p = this.sql.exec(`SELECT przyczyna, COUNT(*) AS ile, SUM(zrobione) AS kroki FROM przebudzenia GROUP BY przyczyna`).toArray();
    const ostatnie = this.sql.exec(`SELECT kiedy, przyczyna, zrobione, zostalo FROM przebudzenia ORDER BY nr DESC LIMIT 8`).toArray()
      .map((w) => ({ ...w, kiedy: new Date(w.kiedy).toISOString() }));
    return { krokMs: KROK_MS, limitKrokow: LIMIT_KROKOW, rzadkiAlarmMs: RZADKI_ALARM_MS, patrzacy: this.patrzacy().length, przebudzenia: p, ostatnie };
  }

  rozeslij(s) {
    const lista = this.patrzacy(); if (!lista.length) return;
    const meta = this.meta();
    for (const ws of lista) {
      const a = ws.deserializeAttachment();
      try { ws.send(JSON.stringify({ widok: widok(s, a.od || 0), meta })); a.od = s.nrZdarzenia; ws.serializeAttachment(a); } catch {}
    }
  }

  async alarm() {
    const r = this.obudz('alarm');
    this.rozeslij(r.s);
    await this.planuj(r.zostalo);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const odp = (o, status = 200) => new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    if (url.pathname.endsWith('/ws')) {
      if (request.headers.get('upgrade') !== 'websocket') return odp({ blad: 'potrzebny WebSocket' }, 426);
      const [klient, serwer] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(serwer);
      serwer.serializeAttachment({ kto: null, od: 0 });
      await this.planuj(0);
      return new Response(null, { status: 101, webSocket: klient });
    }
    const kto = request.headers.get('x-kto');
    if (request.method === 'GET') {
      const r = this.obudz('odczyt');
      await this.planuj(r.zostalo);
      return odp({ ok: true, ja: kto, ...widok(r.s, Number(url.searchParams.get('od') || 0)), zaleglosc: r.zostalo, meta: this.meta() });
    }
    if (request.method === 'POST') {
      let g = null; try { g = await request.json(); } catch {}
      const r = this.obudz('gest');
      const w = gest(r.s, kto, g);
      if (w.ok) { this.sql.exec(`UPDATE swiat SET stan = ? WHERE id = 1`, JSON.stringify(r.s)); this.rozeslij(r.s); }
      await this.planuj(r.zostalo);
      return odp(w, w.ok ? 200 : 400);
    }
    return odp({ blad: 'GET albo POST' }, 405);
  }

  async webSocketMessage(ws, wiadomosc) {
    let m = null; try { m = JSON.parse(wiadomosc); } catch {}
    const a = ws.deserializeAttachment() || {};
    if (!a.kto) {
      if (!m || typeof m.klucz !== 'string') { ws.close(4401, 'najpierw klucz'); return; }
      const k = await ktoTo(new Request('https://x/', { headers: { authorization: 'Bearer ' + m.klucz } }), this.env);
      if (!k.ok) { ws.close(4401, k.blad.slice(0, 100)); return; }
      const r = this.obudz('wejscie');
      ws.serializeAttachment({ kto: k.kto, od: r.s.nrZdarzenia });
      ws.send(JSON.stringify({ ja: k.kto, widok: widok(r.s, Math.max(0, r.s.nrZdarzenia - 40)), meta: this.meta() }));
      await this.planuj(r.zostalo);
      return;
    }
    if (m && m.gest) {
      const r = this.obudz('gest');
      const w = gest(r.s, a.kto, m.gest);
      if (w.ok) { this.sql.exec(`UPDATE swiat SET stan = ? WHERE id = 1`, JSON.stringify(r.s)); this.rozeslij(r.s); }
      else ws.send(JSON.stringify({ blad: w.blad }));
    }
  }

  async webSocketClose(ws, code) { try { ws.close(code === 1005 ? 1000 : code, 'koniec'); } catch {} }
}
