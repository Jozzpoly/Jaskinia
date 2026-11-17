// Gospodarz środowiska: strona, która pokazuje, co jest w Miejscu, i otwiera gości w oknach (17 XI 2026). Próba.
// To jedyny kod działający pod adresem Miejsca. Wszystko, co pokazuje, czyta z tych samych drzwi co agenci
// (/api/srodowisko/…), a z gośćmi rozmawia umową okna (opis: /umowa-okna). Dane trafiają na stronę wyłącznie jako
// tekst (textContent), nigdy jako HTML.
(() => {
  'use strict';
  const PAMIEC = 'jaskinia:srodowisko:widziany-akt';
  const $ = (id) => document.getElementById(id);
  const el = (znacznik, cechy = {}, ...dzieci) => {
    const e = document.createElement(znacznik);
    for (const [k, w] of Object.entries(cechy)) {
      if (w === null || w === undefined || w === false) continue;
      if (k === 'tekst') e.textContent = w; else if (k === 'klik') e.addEventListener('click', w); else if (k === 'klasa') e.className = w; else e.setAttribute(k, w === true ? '' : w);
    }
    for (const d of dzieci.flat()) if (d !== null && d !== undefined && d !== false) e.append(d);
    return e;
  };
  const czytaj = async (sciezka) => {
    const o = await fetch(sciezka, { headers: { accept: 'application/json' }, cache: 'no-store' });
    const d = await o.json().catch(() => null);
    if (!o.ok || !d || d.ok === false) throw new Error((d && (d.blad || d.error)) || 'odpowiedź ' + o.status);
    return d;
  };
  const kiedy = (iso) => {
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!Number.isFinite(min)) return '';
    if (min < 1) return 'przed chwilą';
    if (min < 60) return min + ' min temu';
    if (min < 60 * 36) return Math.round(min / 60) + ' godz. temu';
    const dni = Math.round(min / 1440);
    return dni < 60 ? dni + ' dni temu' : Math.round(dni / 30) + ' mies. temu';
  };
  // Im żywszy projekt, tym bardziej zielony: kolor paska bierze się z wieku ostatniej zmiany u źródła.
  const kolorZycia = (iso) => {
    const dni = (Date.now() - Date.parse(iso)) / 86400000;
    if (!Number.isFinite(dni)) return null;
    const t = Math.max(0, Math.min(1, 1 - Math.log10(1 + dni) / Math.log10(181)));
    return `color-mix(in srgb, var(--zywe) ${Math.round(t * 100)}%, var(--stare))`;
  };

  let opis = null, rzeczy = [], akt = 0;
  let widziany = Number(localStorage.getItem(PAMIEC) || 0) || 0;
  const okna = new Map(); // id okna -> { ramka, sekcja, guzik, gosc, chce, nazwa }
  let nrOkna = 0;

  // --- okna gości ----------------------------------------------------------------------------------------------
  // Trzy poziomy zaufania do tego, co otwieramy w ramce:
  //   'kod'   : kod gościa zapisany w Miejscu (piaskownica bez własnego adresu, pamięci i sieci);
  //   'obcy'  : adres podany przez kogoś innego niż właściciel (skrypty tak, własna pamięć i wyskakujące okna nie);
  //   'swoj'  : adres w rzeczy, którą dołożył i ostatnio zmienił właściciel (gra ma własną pamięć pod swoim adresem).
  const PIASKOWNICE = { kod: 'allow-scripts allow-pointer-lock', obcy: 'allow-scripts allow-pointer-lock', swoj: 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups' };
  function otworz({ klucz, tytul, adres, piaskownica, gosc = null }) {
    for (const [id, o] of okna) if (o.klucz === klucz) return pokaz(id, true);
    const id = 'okno-' + ++nrOkna;
    const ramka = el('iframe', { src: adres, title: tytul, referrerpolicy: 'no-referrer', allow: 'fullscreen; gamepad', sandbox: PIASKOWNICE[piaskownica] || PIASKOWNICE.obcy });
    const mowi = el('span', { klasa: 'mowi' });
    const tyt = el('span', { klasa: 'tytul', tekst: tytul });
    const sekcja = el('section', { klasa: 'okno', 'aria-label': tytul },
      el('div', { klasa: 'pasek' }, tyt, mowi,
        el('a', { klasa: 'guzik', href: adres, target: '_blank', rel: 'noopener', tekst: 'nowa karta' }),
        el('button', { tekst: 'zwiń', title: 'Zwiń do guzika na dole; okno zostaje załadowane', klik: () => pokaz(id, false) }),
        el('button', { tekst: '×', title: 'Zamknij okno', klik: () => zamknij(id) })),
      ramka);
    const guzik = el('button', { tekst: tytul, klik: () => pokaz(id, sekcja.hidden) });
    okna.set(id, { klucz, ramka, sekcja, guzik, tyt, mowi, gosc, chce: [], nazwa: tytul });
    ramka.addEventListener('load', () => ramka.contentWindow && ramka.contentWindow.postMessage({ jaskinia: 1, type: 'hi', v: 2 }, '*'));
    $('okna').append(sekcja);
    $('dok').append(guzik);
    pokaz(id, true);
  }
  function pokaz(id, widac) {
    for (const [inne, o] of okna) {
      const ma = inne === id ? widac : (widac ? false : !o.sekcja.hidden);
      if (o.sekcja.hidden === !ma) continue;
      o.sekcja.hidden = !ma;
      o.guzik.classList.toggle('widoczne', ma);
      o.ramka.contentWindow && o.ramka.contentWindow.postMessage({ jaskinia: 1, type: 'visible', visible: ma }, '*');
    }
    const o = okna.get(id);
    if (o) o.guzik.classList.toggle('widoczne', !o.sekcja.hidden);
  }
  function zamknij(id) {
    const o = okna.get(id);
    if (!o) return;
    o.sekcja.remove(); o.guzik.remove(); okna.delete(id);
  }
  // Rozmowa z gośćmi. Przyjmujemy wiadomości tylko od ramek, które sami otworzyliśmy.
  addEventListener('message', async (e) => {
    const m = e.data;
    if (!m || typeof m !== 'object' || m.jaskinia !== 1 || typeof m.type !== 'string') return;
    const o = [...okna.values()].find((x) => x.ramka.contentWindow === e.source);
    if (!o) return;
    const odp = (w) => e.source.postMessage({ jaskinia: 1, ...w }, '*');
    if (m.type === 'hello') {
      if (typeof m.name === 'string' && m.name.trim()) { o.nazwa = m.name.trim().slice(0, 60); o.tyt.textContent = o.nazwa; o.guzik.textContent = o.nazwa; }
      o.chce = Array.isArray(m.wants) ? m.wants.filter((x) => typeof x === 'string').slice(0, 8) : [];
    } else if (m.type === 'state') {
      o.mowi.textContent = typeof m.text === 'string' ? m.text.slice(0, 240) : '';
    } else if (m.type === 'read') {
      try {
        let dane;
        if (m.what === 'spis') {
          const p = new URLSearchParams();
          if (typeof m.rodzaj === 'string') p.set('rodzaj', m.rodzaj);
          if (typeof m.obszar === 'string' || m.obszar === null) p.set('obszar', m.obszar || '');
          if (Number.isInteger(m.pomin) && m.pomin > 0) p.set('pomin', String(m.pomin));
          const d = await czytaj('/api/srodowisko/spis?' + p);
          dane = { rzeczy: d.rzeczy, razem: d.razem, pokazane: d.pokazane, pominiete: d.pominiete, wszystko: d.wszystko };
        } else if (m.what === 'rzecz') {
          const d = await czytaj('/api/srodowisko/rzecz?id=' + encodeURIComponent(String(m.rzecz || '')));
          dane = { rzecz: d.rzecz, historia: d.historia, wskazuja: d.wskazuja };
        } else if (m.what === 'ksztalty') {
          dane = { ksztalty: (await czytaj('/api/srodowisko/ksztalty')).ksztalty };
        } else if (m.what === 'ja') {
          dane = { uczestnik: opis ? opis.czytasz_jako : null, gosc: o.gosc ? { rzecz: o.gosc.id, nazwa: o.gosc.nazwa } : null };
        } else throw new Error('nie znam takiego czytania: ' + String(m.what) + '; znane: spis, rzecz, ksztalty, ja');
        odp({ type: 'result', id: m.id, ok: true, data: dane });
      } catch (blad) { odp({ type: 'result', id: m.id, ok: false, error: String(blad && blad.message || blad).slice(0, 300) }); }
    }
    // signals, event, flag i wszystko nieznane: na razie pomijamy bez błędu (umowa okna, pokolenie 2)
  });

  // --- strona --------------------------------------------------------------------------------------------------
  const lp = (n, a, b, c) => `${n} ${n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c)}`;
  // Most do starej Jaskini (Opus Code, 17 XI 2026). Ta strona jest gospodarzem dla swoich gosci, ale sama
  // bywa gosciem: stara Jaskinia umie otworzyc dowolny adres w oknie i rozmawia ta sama umowa (hello, state,
  // signals, event, flag). Bez tych kilku linii nowe srodowisko otwarte w jej oknie dzialaloby "po cichu":
  // bez nazwy, bez stanu i bez liczb. Dzieki nim jedno miejsce jest prawda od pierwszego dnia, a stara
  // Jaskinia nie wymaga ani jednej zmiany.
  const gospodarzOnad = window.parent && window.parent !== window ? window.parent : null;
  let ostatniStan = null;
  const doGospodarza = (w) => { if (gospodarzOnad) try { gospodarzOnad.postMessage({ jaskinia: 1, ...w }, '*'); } catch { /* okno moglo zniknac */ } };
  function przedstawSie() {
    doGospodarza({ type: 'hello', name: 'Jaskinia: srodowisko', version: '1', wants: [] });
    if (ostatniStan) powiedzStan();
  }
  function powiedzStan() {
    if (!ostatniStan) return;
    doGospodarza({ type: 'state', text: ostatniStan.tekst });
    doGospodarza({ type: 'signals', values: { rzeczy: ostatniStan.rzeczy, czeka: ostatniStan.czeka, akt: ostatniStan.akt } });
  }
  if (gospodarzOnad) {
    // Umowa mowi, ze gospodarz odzywa sie pierwszy, ale nie wiadomo, czy zdazymy go uslyszec: mowimy od razu
    // i jeszcze raz po jego "hi" (ten sam wzor, ktory zastosowal gosc z dowodu D1).
    addEventListener('message', (e) => {
      const m = e.data;
      if (e.source !== gospodarzOnad || !m || m.jaskinia !== 1) return;
      if (m.type === 'hi') przedstawSie();
      else if (m.type === 'state?') powiedzStan();
      else if (m.type === 'remark' && typeof m.text === 'string') doGospodarza({ type: 'event', text: 'uwaga wlasciciela trafila do srodowiska: ' + m.text.slice(0, 120), level: 'info' });
    });
    przedstawSie();
  }

  function rysuj() {
    const t = $('tresc');
    t.textContent = '';
    const d = opis;
    $('stan').textContent = `${lp(d.razem, 'rzecz', 'rzeczy', 'rzeczy')} · akt ${d.miejsce.akt} · ${d.czytasz_jako.imie || 'zwiedzający'}`;
    if (d.miejsce.podglad) t.append(el('p', { klasa: 'uwaga', tekst: 'Podgląd: wszystko tutaj jest publiczne do czytania i niczego prywatnego tu nie ma. To jest środowisko, w którym Jaskinia ma rosnąć; Start jeszcze nie istnieje.' }));

    const czekaIle = d.czeka.propozycje.length + d.czeka.prosby.length;
    const ileRzeczy = Number(d.razem) || 0;
    ostatniStan = { rzeczy: ileRzeczy, czeka: czekaIle, akt: (d.miejsce && d.miejsce.akt) || 0,
      tekst: ileRzeczy + ' rzeczy' + (czekaIle ? ', ' + czekaIle + ' czeka na Ciebie' : '') };
    powiedzStan();
    if (czekaIle) t.append(el('section', {}, el('h2', {}, 'Czeka na właściciela ', el('span', { klasa: 'ile', tekst: String(czekaIle) })),
      el('ul', { klasa: 'lista' },
        d.czeka.prosby.map((p) => el('li', {}, el('a', { href: '/rzecz/' + p.id, tekst: p.tresc }), el('span', { klasa: 'bok', tekst: `prośba od ${p.od} · ${kiedy(p.kiedy)}` }))),
        d.czeka.propozycje.map((p) => el('li', {}, el('a', { href: '/rzecz/' + p.id, tekst: `${p.rzecz ? 'zmiana rzeczy' : 'nowa rzecz'} rodzaju ${p.rodzaj}` }), el('span', { klasa: 'bok', tekst: `propozycja od ${p.od} · ${kiedy(p.kiedy)}` }))))));

    const swieze = rzeczy.filter((r) => r.wersja > widziany && widziany > 0);
    if (swieze.length) t.append(el('section', {}, el('h2', {}, 'Nowe od Twojej ostatniej wizyty ', el('span', { klasa: 'ile', tekst: String(swieze.length) }),
      el('button', { tekst: 'widziałem', klik: () => { widziany = akt; localStorage.setItem(PAMIEC, String(akt)); rysuj(); } })),
      el('ul', { klasa: 'lista' }, swieze.slice(0, 30).map((r) => el('li', {}, el('a', { href: '/rzecz/' + r.id, tekst: r.tytul }), el('span', { klasa: 'bok', tekst: `${r.rodzaj} · ${r.zmienil} · ${kiedy(r.zmieniono)}` }))))));

    const projekty = rzeczy.filter((r) => r.rodzaj.startsWith('projekt/')).sort((a, b) => String(b.cechy.zycie || '').localeCompare(String(a.cechy.zycie || '')));
    const pr = d.przeniesienie;
    t.append(el('section', {}, el('h2', {}, 'Projekty ', el('span', { klasa: 'ile', tekst: pr.publiczne_repozytoria ? `${projekty.length} w środku na ${pr.publiczne_repozytoria.ile} publicznych repozytoriów` : `${projekty.length} w środku` })),
      projekty.length ? el('div', { klasa: 'siatka' }, projekty.map(kartaProjektu)) : el('p', { klasa: 'ciche', tekst: 'Jeszcze żadnego. Projekt dokłada się jednym ruchem: /co-tu-jest, punkt 5.' })));

    const goscie = rzeczy.filter((r) => r.rodzaj.startsWith('gosc/'));
    t.append(el('section', {}, el('h2', {}, 'Organy i narzędzia ', el('span', { klasa: 'ile', tekst: String(goscie.length) })),
      goscie.length ? el('div', { klasa: 'siatka' }, goscie.map(kartaGoscia)) : el('p', { klasa: 'ciche', tekst: 'Jeszcze żadnego.' })));

    const reszta = new Map();
    for (const r of rzeczy) { if (r.rodzaj.startsWith('projekt/') || r.rodzaj.startsWith('gosc/') || r.rodzaj.startsWith('zdolnosc/')) continue; if (!reszta.has(r.rodzaj)) reszta.set(r.rodzaj, []); reszta.get(r.rodzaj).push(r); }
    t.append(el('section', {}, el('h2', {}, 'Pozostałe rzeczy'),
      [...reszta].sort((a, b) => a[0].localeCompare(b[0])).map(([rodzaj, lista]) => el('details', {}, el('summary', {}, rodzaj + ' ', el('span', { klasa: 'ile', tekst: String(lista.length) })),
        el('div', {}, el('ul', { klasa: 'lista' }, lista.map((r) => el('li', {}, el('a', { href: '/rzecz/' + r.id, tekst: r.tytul }), el('span', { klasa: 'bok', tekst: `${r.zmienil} · ${kiedy(r.zmieniono)}` })))))))));

    const stany = [['stoi', 'Stoi'], ['cienko', 'Cienko'], ['brak', 'Jeszcze nie ma']];
    t.append(el('section', {}, el('h2', {}, 'Stan budowy środowiska'),
      el('div', { klasa: 'trzy' }, stany.map(([s, napis]) => el('div', { klasa: 'kolumna ' + s }, el('h3', { tekst: napis.toUpperCase() }),
        d.zdolnosci.filter((z) => z.stan === s).sort((a, b) => a.nazwa.localeCompare(b.nazwa)).map((z) => el('p', {}, el('b', { tekst: z.nazwa + '. ' }), el('span', { tekst: z.opis + (z.jak ? ' ' + z.jak : '') }))))))));
  }
  function kartaProjektu(r) {
    const c = r.cechy;
    const k = el('article', { klasa: 'karta' });
    const kolor = c.zycie ? kolorZycia(c.zycie) : null;
    if (kolor) k.style.borderLeftColor = kolor;
    k.append(el('div', { klasa: 'nazwa', tekst: r.tytul }));
    if (typeof c.opis === 'string' && c.opis) k.append(el('div', { klasa: 'opis', tekst: c.opis }));
    const ruchy = el('div', { klasa: 'ruchy' });
    const swoja = odWlasciciela(r);
    if (typeof c.zagraj === 'string' && /^https:\/\//.test(c.zagraj)) ruchy.append(el('button', { klasa: 'glowny', tekst: 'Zagraj', title: swoja ? c.zagraj : 'Adres podał ' + r.zmienil + ', nie właściciel: otworzy się bez własnej pamięci. ' + c.zagraj, klik: () => otworz({ klucz: 'p:' + r.id, tytul: r.tytul, adres: c.zagraj, piaskownica: swoja ? 'swoj' : 'obcy' }) }));
    if (typeof c.zrodlo === 'string' && /^https:\/\//.test(c.zrodlo)) ruchy.append(el('a', { klasa: 'guzik', href: c.zrodlo, target: '_blank', rel: 'noopener', tekst: 'źródło' }));
    if (ruchy.childNodes.length) k.append(ruchy);
    k.append(el('div', { klasa: 'meta' }, r.wersja > widziany && widziany > 0 ? el('span', { klasa: 'nowe', tekst: 'nowe' }) : null,
      c.zycie ? el('span', { tekst: 'żyje: ' + kiedy(c.zycie) }) : el('span', { tekst: 'brak daty życia' }),
      // skąd rzecz pochodzi: kto ją dołożył i kto ostatnio zmienił; rzecz nie od właściciela jest oznaczona
      el('span', { klasa: swoja ? null : 'nowe', tekst: swoja ? 'od właściciela' : 'dołożył ' + r.utworzyl + (r.zmienil !== r.utworzyl ? ', zmienił ' + r.zmienil : '') }),
      el('a', { href: '/rzecz/' + r.id, tekst: 'szczegóły' })));
    return k;
  }
  // Rzecz "od właściciela": on ją dołożył i on ostatnio zmienił. Każdą inną mógł dołożyć albo zmienić agent.
  const odWlasciciela = (r) => Boolean(opis && opis.wlasciciel && r.utworzyl === opis.wlasciciel && r.zmienil === opis.wlasciciel);
  function kartaGoscia(r) {
    const c = r.cechy;
    const kod = typeof c.kod === 'string' && /^[0-9a-f]{64}$/.test(c.kod) ? '/gosc/' + c.kod : null;
    const adres = !kod && typeof c.adres === 'string' && /^https:\/\//.test(c.adres) ? c.adres : null;
    const k = el('article', { klasa: 'karta' }, el('div', { klasa: 'nazwa', tekst: r.tytul }), el('div', { klasa: 'opis', tekst: typeof c.opis === 'string' ? c.opis : '' }));
    k.style.borderLeftColor = 'var(--akcent)';
    k.append(el('div', { klasa: 'ruchy' }, kod || adres ? el('button', { klasa: 'glowny', tekst: 'Otwórz', klik: () => otworz({ klucz: 'g:' + r.id + ':' + (kod || adres), tytul: r.tytul, adres: kod || adres, piaskownica: kod ? 'kod' : (odWlasciciela(r) ? 'swoj' : 'obcy'), gosc: { id: r.id, nazwa: r.tytul } }) }) : el('span', { klasa: 'ciche', tekst: 'bez kodu i adresu' })),
      el('div', { klasa: 'meta' }, r.wersja > widziany && widziany > 0 ? el('span', { klasa: 'nowe', tekst: 'nowe' }) : null, el('span', { tekst: `dołożył ${r.utworzyl} · ${kiedy(r.utworzono)}` }), el('a', { href: '/rzecz/' + r.id, tekst: 'szczegóły' })));
    return k;
  }

  async function odswiez() {
    const [o, s] = await Promise.all([czytaj('/api/srodowisko/opis'), czytaj('/api/srodowisko/spis')]);
    // spis przychodzi kawałkami po 1000; czytamy do końca, żeby strona nie udawała, że pierwszy kawałek to wszystko
    const wszystkie = s.rzeczy;
    for (let kawalek = s; !kawalek.wszystko && wszystkie.length < 20000;) { kawalek = await czytaj('/api/srodowisko/spis?pomin=' + wszystkie.length); wszystkie.push(...kawalek.rzeczy); if (!kawalek.rzeczy.length) break; }
    opis = o; rzeczy = wszystkie; akt = o.miejsce.akt;
    if (!widziany) { widziany = akt; localStorage.setItem(PAMIEC, String(akt)); }
    rysuj();
  }
  // Zmiany na żywo, cienko: gdy karta jest widoczna, co kilka sekund pytamy o numer ostatniego aktu.
  let czeka = 5000;
  async function puls() {
    if (document.visibilityState === 'visible') {
      try {
        const p = await czytaj('/api/srodowisko/puls');
        if (p.akt !== akt) {
          await odswiez();
          czeka = 5000;
          for (const o of okna.values()) if (o.chce.includes('rzeczy') && o.ramka.contentWindow) o.ramka.contentWindow.postMessage({ jaskinia: 1, type: 'changed', akt }, '*');
        } else czeka = Math.min(30000, czeka + 1000);
      } catch { czeka = 30000; }
    }
    setTimeout(puls, czeka);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') czeka = 5000; });
  odswiez().then(() => setTimeout(puls, czeka), (blad) => { $('tresc').textContent = ''; $('tresc').append(el('p', { klasa: 'uwaga', tekst: 'Nie udało się przeczytać Miejsca: ' + blad.message })); $('stan').textContent = 'brak połączenia'; });
})();
