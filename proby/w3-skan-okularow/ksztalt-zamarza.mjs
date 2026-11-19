// Czy ksztalt raz zmieniony reka wlasciciela dostanie kiedykolwiek nowe reguly z kodu?
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const imp = (p) => import(pathToFileURL(join(process.env.KOPIA, p)).href);
const { Rdzen } = await imp('worker/miejsce.mjs');
const { sqlZNode } = await imp('worker/sql-node.mjs');
const { Srodowisko } = await imp('worker/srodowisko.mjs');
const { ziarna } = await imp('worker/ziarna.mjs');
const sql = sqlZNode();
let zegar = Date.UTC(2026, 10, 18, 12, 0, 0);
const nowe = () => new Srodowisko(new Rdzen(sql, { wlasciciel: 'jozz', teraz: () => (zegar += 1000) }));
const Z = () => ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] });
const s1 = nowe(); await s1.zasiej(Z());
const k = s1.spis({ rodzaj: 'ksztalt/1', limit: 300 }).find((x) => x.cechy.dla === 'projekt/1');
// wlasciciel zmienia ksztalt reka: dokłada wlasna ceche
const r = await s1.ruch('jozz', { op: 'wlasciciel-zmienia-ksztalt-projektu', co: 'poloz', rzecz: k.id, wersja: k.wersja,
  rodzaj: 'ksztalt/1', obszar: k.obszar, cechy: { ...k.cechy, opis: 'Opis od wlasciciela.' } });
console.log('wlasciciel zmienia ksztalt:', r.ok ? (r.skutek || 'ok') : r.blad);
// nowy kod dokłada do tego ksztaltu WYMAGANA ceche (nowa regula sprawdzania)
const lista = Z();
const i = lista.findIndex((z) => z.rodzaj === 'ksztalt/1' && z.cechy && z.cechy.dla === 'projekt/1');
lista[i] = { ...lista[i], cechy: { ...lista[i].cechy, cechy: { ...(lista[i].cechy.cechy || {}), wazne: { typ: 'tekst', opis: 'Nowa wymagana cecha z nowego kodu.', wymagana: true } } } };
const s2 = nowe();
const zrob = await s2.zasiej(lista);
const po = s2.spis({ rodzaj: 'ksztalt/1', limit: 300 }).find((x) => x.cechy.dla === 'projekt/1');
const ma = !!(po && po.cechy.cechy && po.cechy.cechy.wazne);
console.log(`zrobione: ${zrob.length}; nowa regula doszla: ${ma ? 'TAK' : 'NIE'}; opis teraz: ${po.cechy.opis}; zmienil: ${po.zmienil}`);
console.log(ma ? 'TRZYMA: nowy kod dochodzi takze do ksztaltu zmienionego reka' : 'UWAGA: ksztalt zmieniony reka wlasciciela nie dostanie nowych regul z kodu - cicho');
