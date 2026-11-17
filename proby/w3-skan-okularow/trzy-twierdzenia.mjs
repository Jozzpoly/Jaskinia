// Druga linia, 17 XI: trzy twierdzenia u zrodla, nie z opisu.
// 1) nakladka z ukrytym id vs nakladka z id, ktorego nie ma (czy drzwi ustawien sa wyrocznia istnienia)
// 2) ksztalty: czy rodzaj polozony w zamknietym obszarze wychodzi w liscie rodzajow
// 3) kanal: czy uczestnik z ODLOZONYM wpisem dalej dostaje imiona obecnych
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const KOPIA = process.env.KOPIA;
const imp = (p) => import(pathToFileURL(join(KOPIA, p)).href);
const { Rdzen } = await imp('worker/miejsce.mjs');
const { sqlZNode } = await imp('worker/sql-node.mjs');
const { Srodowisko } = await imp('worker/srodowisko.mjs');
const { ziarna } = await imp('worker/ziarna.mjs');
let ust = null; try { ust = await imp('worker/ustawienia.mjs'); } catch { }
const NIE_MA = 'zzzzzzzzzzzzzzzzzzzzzzzzzz';
let d = 0, t = 0;
const sprawdz = (dziura, opis) => { if (dziura) { d++; console.log('DZIURA: ' + opis); } else { t++; console.log('TRZYMA: ' + opis); } };
let zegar = Date.UTC(2026, 10, 17, 20, 0, 0);
const r = new Rdzen(sqlZNode(), { wlasciciel: 'jozz', teraz: () => (zegar += 1000) });
const s = new Srodowisko(r);
await s.zasiej(ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a', 'agent-b'] }));
const ok = (w) => { if (!w.ok) throw new Error('oczekiwano ok: ' + JSON.stringify(w)); return w; };
let n = 0; const op = (p = 'op') => `${p}-krok-${String(++n).padStart(4, '0')}`;
const T = ok(await s.ruch('jozz', { op: op('ob'), co: 'poloz', rodzaj: 'obszar/1', cechy: { nazwa: 'Tajne', widzi: 'wlasciciel', ile_wolno: 'prowadzic' } })).rzecz;
const tajny = ok(await s.ruch('jozz', { op: op('rz'), co: 'poloz', rodzaj: 'projekt/1', obszar: T, cechy: { nazwa: 'Tajny' } })).rzecz;

// 1) wyrocznia istnienia w drzwiach ustawien
if (ust && ust.policzUstawienia) {
  const maska = (x, id) => JSON.stringify(x).split(id).join('<ID>');
  const A = maska(ust.policzUstawienia(s.dla('agent-a'), { deklaracje: true, nakladki: [tajny] }), tajny);
  const B = maska(ust.policzUstawienia(s.dla('agent-a'), { deklaracje: true, nakladki: [NIE_MA] }), NIE_MA);
  sprawdz(A !== B, 'ustawienia: nakladka z ukrytym id brzmi jak z id, ktorego nie ma');
  if (A !== B) { console.log('   ukryte:', A.slice(0, 400)); console.log('   nie ma:', B.slice(0, 400)); }
} else console.log('(brak worker/ustawienia.mjs w tej kopii - punkt 1 pominiety)');

// 2) ksztalty: rodzaj polozony w zamknietym obszarze
ok(await s.ruch('jozz', { op: op('ks'), co: 'poloz', rodzaj: 'ksztalt/1', obszar: T, cechy: { dla: 'tajnyrodzaj/1', opis: 'Tajny rodzaj do proby.', cechy: {} } }));
const kszt = JSON.stringify([...s.dla('agent-a').ksztalty().keys()]);
sprawdz(kszt.includes('tajnyrodzaj'), 'ksztalty: rodzaj z zamknietego obszaru nie wychodzi w liscie rodzajow dla czytajacego');
const ksztB = JSON.stringify([...s.ksztalty().keys()]);
console.log('   (dla wlasciciela widoczny?', ksztB.includes('tajnyrodzaj') ? 'tak' : 'NIE - to inny blad', ')');

// 3) uczestnik z odlozonym wpisem
const wpis = s.spis({ rodzaj: 'uczestnik/1', limit: 50 }).find((u) => (u.cechy.imie || u.cechy.kto) === 'agent-a');
console.log('   wpis agent-a:', wpis ? wpis.id : 'BRAK');
if (wpis) {
  ok(await s.ruch('jozz', { op: op('od'), co: 'odloz', rzecz: wpis.id, wersja: 'dowolna' }));
  const rola = s.rola('agent-a');
  sprawdz(rola !== 'zwiedzajacy', `rola po odlozeniu wpisu: ${rola} (ma byc zwiedzajacy)`);
  const widziTajne = s.dla('agent-a').rzecz(tajny) !== null;
  sprawdz(widziTajne, 'odlozony uczestnik nie widzi rzeczy z zamknietego obszaru');
}
console.log(`-- razem: ${d} DZIURA, ${t} TRZYMA`);
