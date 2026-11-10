// Durable Object Miejsca: jedna instancja na przestrzeń, z własną bazą SQLite (11 XI 2026). Status: próba.
// Zwykła klasa z fetch(), bez importu cloudflare:workers, żeby testy w Node mogły ładować moduł główny.
// Cloudflare trzyma tę bazę po stronie serwera, z odtworzeniem do dowolnej chwili z ostatnich 30 dni
// (point-in-time recovery dla Durable Objects z SQLite).
import { Rdzen, obsluzMiejsce } from './miejsce.mjs';

export class Miejsce {
  constructor(ctx) {
    this.rdzen = new Rdzen(ctx.storage.sql);
  }

  async fetch(request) {
    return obsluzMiejsce(this.rdzen, request);
  }
}
