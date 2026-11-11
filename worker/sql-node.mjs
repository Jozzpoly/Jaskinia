// Tylko dla testów w Node: node:sqlite udające ctx.storage.sql z Durable Object, czyli exec(zapytanie, ...parametry)
// zwracające kursor z toArray(). Ten sam dialekt SQLite po obu stronach.
import { DatabaseSync } from 'node:sqlite';

export function sqlZNode(db = new DatabaseSync(':memory:')) {
  return {
    exec: (q, ...p) => {
      const rows = p.length || /^\s*(SELECT|INSERT|UPDATE|DELETE)/i.test(q) ? db.prepare(q).all(...p) : (db.exec(q), []);
      return { toArray: () => rows };
    },
  };
}
