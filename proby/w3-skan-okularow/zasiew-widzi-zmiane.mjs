// Druga linia, 18 XI: czy skrot po odcisku calosci widzi KAZDA zmiane ziaren. KOPIA=<katalog> node odcisk2.mjs
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const imp = (p) => import(pathToFileURL(join(process.env.KOPIA, p)).href);
const { Rdzen } = await imp('worker/miejsce.mjs');
const { sqlZNode } = await imp('worker/sql-node.mjs');
const { Srodowisko } = await imp('worker/srodowisko.mjs');
const { ziarna } = await imp('worker/ziarna.mjs');
let d = 0, t = 0;
const sprawdz = (dziura, opis, szcz = '') => { if (dziura) { d++; console.log('DZIURA: ' + opis + (szcz ? '\n   ' + szcz : '')); } else { t++; console.log('TRZYMA: ' + opis + (szcz ? '\n   ' + szcz : '')); } };
const sql = sqlZNode();
let zegar = Date.UTC(2026, 10, 18, 12, 0, 0);
const nowe = () => new Srodowisko(new Rdzen(sql, { wlasciciel: 'jozz', teraz: () => (zegar += 1000) }));
const Z = () => ziarna({ wlasciciel: 'jozz', uczestnicy: ['agent-a'] });
await (nowe()).zasiej(Z());

// 1. zmiana TRESCI ziarna (nowy kod zmienia opis rodzaju)
const lista1 = Z();
const i = lista1.findIndex((z) => z.rodzaj === 'ksztalt/1' && z.cechy && z.cechy.dla === 'projekt/1');
console.log('ziarno kształtu projekt/1 w liscie:', i);
lista1[i] = { ...lista1[i], cechy: { ...lista1[i].cechy, opis: 'NOWY OPIS Z NOWEGO KODU.' } };
const s2 = nowe();
const zrob = await s2.zasiej(lista1);
const k = s2.spis({ rodzaj: 'ksztalt/1', limit: 300 }).find((x) => x.cechy.dla === 'projekt/1');
sprawdz(!k || k.cechy.opis !== 'NOWY OPIS Z NOWEGO KODU.', 'zmiana tresci ziarna dochodzi do istniejacego Miejsca',
  `zrobione: ${zrob.length}; opis teraz: ${k ? String(k.cechy.opis).slice(0, 40) : 'brak'}`);

// 2. zmiana ziarna, ktorego cechy podaje FUNKCJA (to byl jego wlasny blad z c9d4cc7)
const lista2 = Z();
const j = lista2.findIndex((z) => typeof z.cechy === 'function');
console.log('pierwsze ziarno z cechami z funkcji:', j, j >= 0 ? lista2[j].nazwa : '');
if (j >= 0) {
  const stara = lista2[j].cechy;
  lista2[j] = { ...lista2[j], cechy: async (s) => { const c = await stara(s); return { ...c, opis: 'OPIS Z FUNKCJI, ZMIENIONY.' }; } };
  const s3 = nowe();
  const zrob2 = await s3.zasiej(lista2);
  const rz = s3.spis({ rodzaj: lista2[j].rodzaj, odlozone: 'razem', limit: 300 }).find((x) => String(x.cechy.opis || '').startsWith('OPIS Z FUNKCJI'));
  sprawdz(!rz, 'zmiana ziarna liczonego funkcja tez dochodzi', `zrobione: ${zrob2.length}; znalezione: ${rz ? rz.id : 'nie ma'}`);
}

// 3. USUNIECIE ziarna z listy: rzecz zostaje (tak ma byc), ale czy odcisk sie zmienia i nic sie nie psuje?
const lista3 = Z().filter((z) => !(z.rodzaj === 'ksztalt/1' && z.cechy && z.cechy.dla === 'projekt/1'));
const s4 = nowe();
const zrob3 = await s4.zasiej(lista3);
const k3 = s4.spis({ rodzaj: 'ksztalt/1', odlozone: 'razem', limit: 300 }).find((x) => x.cechy.dla === 'projekt/1');
sprawdz(!k3, 'po usunieciu ziarna z kodu rzecz zostaje w Miejscu (sierota, nie zniknienie)', `zrobione: ${zrob3.length}`);

// 4. i powrot do pelnej listy po usunieciu: czy odcisk wraca i nic nie sieje sie dwa razy
const s5 = nowe();
const zrob4 = await s5.zasiej(Z());
const ileKsztaltow = s5.spis({ rodzaj: 'ksztalt/1', odlozone: 'razem', limit: 400 }).filter((x) => x.cechy.dla === 'projekt/1').length;
sprawdz(ileKsztaltow !== 1, 'powrot do pelnej listy nie sieje rodzaju drugi raz', `ksztaltow projekt/1: ${ileKsztaltow}; zrobione: ${zrob4.length}`);
console.log(`-- razem: ${d} DZIURA, ${t} TRZYMA`);
