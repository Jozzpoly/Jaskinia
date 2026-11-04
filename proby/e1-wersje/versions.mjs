// Tożsamość wersji, przypięcia i propozycje na starszej podstawie.
// Rdzeń wersji rzeczy autorskich. Bez zależności; działa w Node >= 18 i w przeglądarce.
// Wersja wyjściowa z próby E1; fundament rośnie z niej po sprawdzeniu na prawdziwym przypadku.
import { sha256hex } from './sha256.mjs';

// ---------- tożsamość ----------
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

// Wersja = treść rzeczy. Ta sama treść tej samej rzeczy ma zawsze to samo id,
// na każdym urządzeniu i u każdego agenta. Historia (kto, kiedy, skąd) jest osobno, w dzienniku.
export function versionId(thing, content) {
  return 'v_' + sha256hex(canonical({ thing, content })).slice(0, 16);
}

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ---------- różnice ----------
// Ścieżka to klucze połączone kropką. Kropka i ukośnik wsteczny w samym kluczu są poprzedzane
// ukośnikiem, a pusty klucz to \e. Bez tego klucz "a.b" i zagnieżdżone a → b dawały tę samą
// ścieżkę (kontrprzykład Browsera GPT, 4 XI 2026).
const escapeKey = k => (k === '' ? '\\e' : k.replace(/\\/g, '\\\\').replace(/\./g, '\\.'));
export const joinPath = parts => parts.map(escapeKey).join('.');
export function parsePath(path) {
  if (Array.isArray(path)) return path.map(String);
  const parts = [];
  let cur = '';
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c === '\\') { const n = path[++i]; if (n !== 'e') cur += n ?? ''; }
    else if (c === '.') { parts.push(cur); cur = ''; }
    else cur += c;
  }
  parts.push(cur);
  return parts;
}
const toPath = path => (Array.isArray(path) ? joinPath(path) : path);

// Spłaszcza obiekt do ścieżek. Tablice i wartości proste są liśćmi (świadome uproszczenie).
export function flatten(obj, prefix = '', out = new Map()) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out.set(prefix, canonical(obj));
    return out;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0 && prefix) out.set(prefix, '{}');
  for (const k of keys) flatten(obj[k], prefix ? prefix + '.' + escapeKey(k) : escapeKey(k), out);
  return out;
}

export function diff(a, b) {
  const fa = flatten(a), fb = flatten(b), changed = new Map();
  for (const [p, v] of fa) if (fb.get(p) !== v) changed.set(p, fb.has(p) ? fb.get(p) : undefined);
  for (const [p, v] of fb) if (!fa.has(p)) changed.set(p, v);
  return changed; // ścieżka -> nowa wartość (kanoniczna) albo undefined = usunięta
}

// Ścieżka pusta to cała treść (np. liczba jako treść rzeczy), więc nachodzi na każdą inną.
const overlaps = (p, q) => p === '' || q === '' || p === q || p.startsWith(q + '.') || q.startsWith(p + '.');

// Zapis pod ścieżką; zwraca nowy korzeń, bo ścieżka pusta podmienia całą treść
// (kontrprzykład K4 Opusa Code: skalar wracał jako obiekt z pustym kluczem).
function applyPath(root, path, canonValue) {
  if (path === '') return canonValue === undefined ? undefined : JSON.parse(canonValue);
  if (root === null || typeof root !== 'object' || Array.isArray(root)) root = {};
  setPath(root, path, canonValue);
  return root;
}

function setPath(obj, path, canonValue) {
  const parts = parsePath(path);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object' || Array.isArray(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (canonValue === undefined) delete cur[last];
  else cur[last] = JSON.parse(canonValue);
}

// ---------- magazyn ----------
export class Store {
  constructor() {
    this.versions = new Map();   // id -> { thing, content }
    this.heads = new Map();      // thing -> id (zapisana wersja autora)
    this.drafts = new Map();     // thing -> treść robocza (nie jest wersją)
    this.proposals = new Map();  // pid -> { thing, base, proposed, by, why, state }
    this.pins = new Map();       // `${world}::${thing}` -> id
    this.verdicts = [];          // { version, by, kind, text, at }
    this.events = [];            // dziennik tylko do dopisywania
    this.clock = 0;
  }

  #log(e) { this.events.push({ n: ++this.clock, ...e }); }
  #owner(by, what) { if (by?.role !== 'owner') throw new Error(`Tylko właściciel może: ${what}`); }
  #put(thing, content) {
    const id = versionId(thing, content);
    if (!this.versions.has(id)) this.versions.set(id, { thing, content: clone(content) });
    return id;
  }

  get(id) { const v = this.versions.get(id); return v && { thing: v.thing, content: clone(v.content) }; }
  head(thing) { return this.heads.get(thing); }
  draft(thing) {
    if (!this.drafts.has(thing)) this.drafts.set(thing, clone(this.head(thing) ? this.versions.get(this.head(thing)).content : {}));
    return clone(this.drafts.get(thing));
  }

  // Edycja zmienia tylko szkic. Żaden autozapis nie tworzy wersji.
  edit(thing, path, value, by) {
    const d = this.draft(thing);
    path = toPath(path); // tablica kluczy albo ścieżka z kropkami (kropka w kluczu jako \\.)
    this.drafts.set(thing, applyPath(d, path, value === undefined ? undefined : canonical(value)));
    this.#log({ type: 'edit-draft', thing, path, by: by?.who });
  }

  // Zapis jest zawsze jawnym gestem właściciela.
  save(thing, by, note = '') {
    this.#owner(by, 'zapisać wersję');
    const from = this.head(thing);
    const id = this.#put(thing, this.draft(thing));
    this.heads.set(thing, id);
    this.#log({ type: 'save', thing, from, to: id, by: by.who, note });
    return id;
  }

  // Wczytanie przywraca pełną treść wersji (nie łata szkicu częściowo).
  load(thing, id, by) {
    const v = this.versions.get(id);
    if (!v || v.thing !== thing) throw new Error('Nie ma takiej wersji tej rzeczy');
    this.drafts.set(thing, clone(v.content));
    this.#log({ type: 'load', thing, to: id, by: by?.who });
  }

  // Agent proponuje pełną treść na podstawie konkretnej wersji. Nic nie zmienia u autora.
  propose(thing, base, content, by, why = '') {
    if (base && !this.versions.has(base)) throw new Error('Nieznana podstawa propozycji');
    const proposed = this.#put(thing, content);
    const pid = 'p' + (this.proposals.size + 1);
    this.proposals.set(pid, { thing, base, proposed, by: by.who, why, state: 'open' });
    this.#log({ type: 'propose', thing, base, to: proposed, pid, by: by.who });
    return pid;
  }

  // Ocena propozycji wobec obecnej wersji autora: trzy strony, pole po polu.
  evaluate(pid) {
    const p = this.proposals.get(pid);
    const head = this.head(p.thing);
    const baseC = p.base ? this.versions.get(p.base).content : {};
    const headC = head ? this.versions.get(head).content : {};
    const propC = this.versions.get(p.proposed).content;
    const agent = diff(baseC, propC), owner = diff(baseC, headC);
    if (agent.size === 0) return { status: 'no-op', head, conflicts: [], changes: [] };
    if (head === p.base) return { status: 'fast-forward', head, conflicts: [], changes: [...agent.keys()], preview: clone(propC) };
    const conflicts = [];
    let preview = clone(headC);
    for (const [path, val] of agent) {
      const clash = [...owner.keys()].filter(q => overlaps(path, q));
      const same = clash.length === 1 && clash[0] === path && owner.get(path) === val;
      if (clash.length && !same) {
        conflicts.push({ path, base: flatten(baseC).get(path), owner: owner.get(path) ?? flatten(headC).get(path), agent: val });
      } else if (!same) preview = applyPath(preview, path, val);
    }
    return { status: conflicts.length ? 'conflict' : 'mergeable', head, conflicts, changes: [...agent.keys()], preview: conflicts.length ? undefined : preview };
  }

  // Przyjąć może tylko właściciel; konflikt wymaga jego rozstrzygnięcia pole po polu.
  accept(pid, by, resolution = {}) {
    this.#owner(by, 'przyjąć propozycję');
    const p = this.proposals.get(pid);
    const ev = this.evaluate(pid);
    let content;
    if (ev.status === 'conflict') {
      const missing = ev.conflicts.filter(c => !(c.path in resolution));
      if (missing.length) throw new Error('Konflikt bez rozstrzygnięcia: ' + missing.map(c => c.path).join(', '));
      content = clone(this.versions.get(ev.head).content);
      for (const [path] of diff(p.base ? this.versions.get(p.base).content : {}, this.versions.get(p.proposed).content)) {
        const c = ev.conflicts.find(x => x.path === path);
        content = applyPath(content, path, c ? canonical(resolution[path]) : flatten(this.versions.get(p.proposed).content).get(path));
      }
    } else content = ev.preview ?? clone(this.versions.get(ev.head).content);
    const from = this.head(p.thing);
    const id = this.#put(p.thing, content);
    this.heads.set(p.thing, id);
    this.drafts.set(p.thing, clone(content));
    p.state = 'accepted';
    this.#log({ type: 'accept', thing: p.thing, from, to: id, pid, by: by.who });
    return id;
  }

  reject(pid, by, why = '') {
    this.#owner(by, 'odrzucić propozycję');
    this.proposals.get(pid).state = 'rejected';
    this.#log({ type: 'reject', pid, by: by.who, why });
  }

  // Świat używa przypiętej wersji, dopóki właściciel jej nie przepnie.
  pin(world, thing, id, by) {
    this.#owner(by, 'przypiąć wersję w świecie');
    if (this.versions.get(id)?.thing !== thing) throw new Error('Nie ma takiej wersji tej rzeczy');
    this.pins.set(`${world}::${thing}`, id);
    this.#log({ type: 'pin', world, thing, to: id, by: by.who });
  }
  pinned(world, thing) { return this.pins.get(`${world}::${thing}`); }

  // Werdykt dotyczy dokładnie jednej wersji. Werdykty przodków są kontekstem, nie wyrokiem.
  verdict(id, by, kind, text = '') {
    if ((kind === 'PASS' || kind === 'FAIL') && by?.role !== 'owner') throw new Error('PASS i FAIL daje tylko właściciel');
    this.verdicts.push({ version: id, by: by.who, kind, text, at: ++this.clock });
  }
  ancestors(id) {
    const seen = new Set(), stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of this.events) if (e.to === cur && e.from && !seen.has(e.from)) { seen.add(e.from); stack.push(e.from); }
    }
    seen.delete(id);
    return seen;
  }
  verdictsFor(id) {
    const anc = this.ancestors(id);
    return {
      exact: this.verdicts.filter(v => v.version === id),
      ancestors: this.verdicts.filter(v => anc.has(v.version)),
    };
  }

  export() {
    return JSON.parse(JSON.stringify({
      versions: [...this.versions], heads: [...this.heads], proposals: [...this.proposals],
      pins: [...this.pins], verdicts: this.verdicts, events: this.events, clock: this.clock,
    }));
  }
  static import(data) {
    const s = new Store();
    s.versions = new Map(data.versions); s.heads = new Map(data.heads); s.proposals = new Map(data.proposals);
    s.pins = new Map(data.pins); s.verdicts = data.verdicts; s.events = data.events; s.clock = data.clock;
    for (const [id, v] of s.versions) if (versionId(v.thing, v.content) !== id) throw new Error('Uszkodzona wersja ' + id);
    return s;
  }
}
