// Durable Object Miejsca: jedna instancja na przestrzeń, z własną bazą SQLite (11 XI 2026). Status: próba.
// Zwykła klasa z fetch(), bez importu cloudflare:workers, żeby testy w Node mogły ładować moduł główny.
// Cloudflare trzyma tę bazę po stronie serwera, z odtworzeniem do dowolnej chwili z ostatnich 30 dni
// (point-in-time recovery dla Durable Objects z SQLite).
// Alarm prowadzi most do repozytorium agentów (worker/most.mjs): 2 s po nowym akcie, potem co 5 minut, żeby
// odpowiedzi agentów wchodziły same. Bez ustawień mostu alarm nie jest ustawiany wcale.
import { Rdzen, obsluzMiejsce } from './miejsce.mjs';
import { przebiegMostu, mostGotowy } from './most.mjs';

export const MOST_CO_MS = 5 * 60_000;

export class Miejsce {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.env = env;
    this.rdzen = new Rdzen(ctx.storage.sql);
  }

  async planuj(za) {
    if (!mostGotowy(this.env) || !this.ctx.storage.setAlarm) return;
    const teraz = await this.ctx.storage.getAlarm();
    if (teraz === null || teraz > Date.now() + za) await this.ctx.storage.setAlarm(Date.now() + za);
  }

  async fetch(request) {
    const odp = await obsluzMiejsce(this.rdzen, request);
    const nowyAkt = request.method === 'POST' && new URL(request.url).pathname.endsWith('/akt') && odp.status === 200;
    await this.planuj(nowyAkt ? 2000 : MOST_CO_MS);
    return odp;
  }

  async alarm() {
    const wynik = await przebiegMostu(this.env, { obsluz: (r) => obsluzMiejsce(this.rdzen, r) });
    this.rdzen.ustawMeta('most_ostatni', JSON.stringify({ kiedy: new Date().toISOString(), ...wynik }));
    if (mostGotowy(this.env)) await this.ctx.storage.setAlarm(Date.now() + (wynik.bledy && wynik.bledy.length ? 60_000 : MOST_CO_MS));
  }
}
