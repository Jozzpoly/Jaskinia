// Tylko dla testów w Node: node:sqlite udające ctx.storage.sql z Durable Object, czyli exec(zapytanie, ...parametry)
// zwracające kursor z toArray(). Ten sam dialekt SQLite po obu stronach.
import { DatabaseSync } from 'node:sqlite';

export function sqlZNode(db = new DatabaseSync(':memory:')) {
  let nr = 0;
  return {
    exec: (q, ...p) => {
      const rows = p.length || /^\s*(SELECT|INSERT|UPDATE|DELETE|PRAGMA|WITH)/i.test(q) ? db.prepare(q).all(...p) : (db.exec(q), []);
      return { toArray: () => rows };
    },
    // Odpowiednik ctx.storage.transactionSync(fn): wyjątek w fn cofa wszystkie jej zapisy (punkt zapisu SQLite).
    transakcja: (fn) => {
      const n = 'tr' + ++nr;
      db.exec(`SAVEPOINT ${n}`);
      try { const w = fn(); db.exec(`RELEASE ${n}`); return w; }
      catch (e) { db.exec(`ROLLBACK TO ${n}`); db.exec(`RELEASE ${n}`); throw e; }
    },
  };
}
