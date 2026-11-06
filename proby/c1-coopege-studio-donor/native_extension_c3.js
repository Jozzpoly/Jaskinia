/* C3 R&D: game and its thin live editor use *native* Jaskinia windows.
   This script is injected into a disposable web build of old Jaskinia (not main).
   No custom desktop/window management, no localStorage usage by the adapter.
   Donor: historical Tibia v14.1, not Oct 26 Coopege or production-quality Studio. */
(() => {
  'use strict';
  const ext = window.Jaskinia?.ext;
  if (!ext) throw Error('C3: genuine Jaskinia API not present');
  const PROTO = 'coopege-c1-live/v1';
  const GAME_TYPE = 'c3_game', EDITOR_TYPE = 'c3_editor';
  const SESSION = 'c3-isolated-legacy-tibia';
  const decode = s => new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  const origin = location.origin || 'null';
  const gameSource = decode('__GAME_B64__').replaceAll('__PARENT_ORIGIN__', origin);
  const editorSource = decode('__EDITOR_B64__').replaceAll('__PARENT_ORIGIN__', origin);
  // The host controls routing; the two sandboxed iframes cannot read each other's DOM.
  const holders = { game: null, editor: null };
  let ready = false;
  let seq = 1000000;
  const authored = new Map(); // volatile for C2; NOT a long-lived save.
  const replaying = new Map();
  const pairKey = cell => `${cell.z}/${cell.x}/${cell.y}`;
  const live = part => holders[part]?.frame?.contentWindow || null;
  const tell = (part, data) => { const dst = live(part); if (dst) dst.postMessage(data, '*'); };
  function observeSet(d) {
    if (d.action !== 'set' || !d.ok || !d.cell) return;
    const k = pairKey(d.cell), old = authored.get(k);
    if (!old) authored.set(k, { cell: d.cell, before: d.before, tile: d.after });
    else if (old.before === d.after) authored.delete(k);
    else old.tile = d.after;
  }
  function sendReplay() {
    for (const delta of authored.values()) {
      const id = ++seq;
      replaying.set(id, delta);
      tell('game', { proto: PROTO, kind: 'request', id, action: 'set', cell: delta.cell, expected: delta.before, tile: delta.tile });
    }
  }
  window.addEventListener('message', event => {
    const d = event.data;
    if (!d || d.proto !== PROTO || event.origin !== 'null') return;
    if (event.source === live('game')) {
      if (d.kind === 'ready') {
        ready = true;
        sendReplay();
        tell('editor', { proto: PROTO, kind: 'engine-ready' });
      } else if (d.kind === 'reply') {
        if (replaying.has(d.id)) {
          replaying.delete(d.id);
          if (!d.ok) console.warn('C3 replay rejected', d);
        } else {
          observeSet(d);
          tell('editor', d);
        }
      }
    } else if (event.source === live('editor') && d.kind === 'request') {
      if (!ready) {
        tell('editor', { proto: PROTO, kind: 'reply', action: d.action, id: d.id, ok: false, error: 'Game not ready' });
        return;
      }
      if (d.action === 'focus') {
        // Bring up the REAL Jaskinia window, not a fake game panel.
        ext.open(GAME_TYPE, { fresh: false });
      }
      tell('game', d);
    }
  });
  function createNativeWindow(part, typeName) {
    return {
      group: 'studio', name: typeName, glyph: 't_przyrzad',
      desc: part === 'game' ? 'Jedna działająca gra, w oknie Jaskini' : 'Edytor połączony z tą grą',
      live: true, liveKey: () => [SESSION], fill: true, noZoom: true,
      render(box, c) {
        if (holders[part]) { // prevent two copies silently claiming one session
          const info = document.createElement('p');
          info.textContent = 'C3: ten przyrząd jest już otwarty w innym oknie.';
          box.append(info);
          return;
        }
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('title', typeName);
        frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#101820;';
        const holder = { id: c.id, frame };
        holders[part] = holder;
        c.onDispose(() => {
          if (holders[part] === holder) {
            holders[part] = null;
            if (part === 'game') ready = false;
          }
        });
        frame.addEventListener('load', () => {
          if (part === 'game') ready = false;
          if (part === 'editor' && ready) tell('editor', { proto: PROTO, kind: 'engine-ready' });
        });
        box.append(frame);
        frame.srcdoc = part === 'game' ? gameSource : editorSource;
      },
    };
  }
  ext.type(GAME_TYPE, createNativeWindow('game', 'C3 · Gra'));
  ext.type(EDITOR_TYPE, createNativeWindow('editor', 'C3 · Pracownia'));
  // This is a real native Jaskinia tiled workspace, not two fake side-by-side iframes.
  // __JASK is a diagnostic internal used ONLY in a disposable build; do not expose
  // this internal as a stable integration API or merge it to production.
  const j = window.__JASK, WORKSPACE = 'C3 · Gra + pracownia';
  if (!j?.store || typeof j.setSpace !== 'function') throw Error('C3: Jaskinia runtime not initialized');
  let sp = j.store.spaces.find(x => x.name === WORKSPACE);
  if (!sp) {
    const used = new Set(j.store.spaces.flatMap(x => Object.keys(x.L?.wins || {})));
    const uidWin = () => { let id; do id = 'w' + Math.random().toString(36).slice(2,10); while (used.has(id)); used.add(id); return id; };
    const gameId = uidWin(), editorId = uidWin();
    const layout = {tree:{t:'s',d:'row',r:0.69,a:{t:'w',id:gameId},b:{t:'w',id:editorId}},
      wins:{
        [gameId]:{type:GAME_TYPE,z:1,pin:null,st:{}},
        [editorId]:{type:EDITOR_TYPE,z:1,pin:null,st:{}}
      },floats:[],max:null,focus:gameId,stats:{}};
    sp={id:'c3-disposable-workspace',name:WORKSPACE,
      purpose:'Prawdziwy podział i przeciąganie okien Jaskini; bezpieczny eksperyment z grą.',
      preset:null,L:layout};
    j.store.spaces.push(sp);
  }
  j.setSpace(sp.id);
  console.info('C3 initialized with a NATIVE old Jaskinia split workspace; world delta is VOLATILE');

})();
