#!/usr/bin/env python3
"""EXPECTED NEGATIVE proof: C1 live raw setTile can trap a world NPC.

Usage: CHROMIUM_EXECUTABLE=/usr/bin/chromium python smoke_invalid_npc_cell.py Tibia_Enhanced_v14_1_DevAPI.html
Tested with Chromium + Playwright, no user browser profile, no original source changes.
"""
from pathlib import Path
import os
import sys
import tempfile
from playwright.sync_api import sync_playwright
from build_live_c1 import build


def check(donor: Path) -> None:
    with tempfile.TemporaryDirectory(prefix='c1-invalid-npc-') as temp:
        output = Path(temp) / 'c1-test.html'
        build(donor, output)
        with sync_playwright() as playwright:
            opts = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
            if os.environ.get('CHROMIUM_EXECUTABLE'):
                opts['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
            browser = playwright.chromium.launch(**opts)
            try:
                context = browser.new_context(viewport={'width': 1500, 'height': 900})
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.set_content(output.read_text('utf-8'), wait_until='domcontentloaded')
                page.wait_for_function('() => document.querySelector("#log")?.textContent === "Gra gotowa"', timeout=20000)
                game, editor = page.frames[1:3]
                npc = game.evaluate("""() => {
                  const a=window.TibiaMapAPI;
                  const n=a.exportWorld().npcs.find(n=>n.type==='healer'&&n.z===0);
                  return {...n,tile:a.getTile(n.z,n.x,n.y)};
                }""")
                assert npc['name'] == 'Uzdrowiciel' and npc['tile'] != 2, npc
                result = editor.evaluate("""async n => {
                  const proto='coopege-c1-live/v1',id=90000;
                  return await new Promise(resolve=>{
                    function receive(e) {
                      if(e.data?.proto===proto&&e.data.kind==='reply'&&e.data.id===id){
                        window.removeEventListener('message',receive);resolve(e.data);
                      }
                    }
                    window.addEventListener('message',receive);
                    window.parent.postMessage({proto,kind:'request',id,action:'set',
                      cell:{z:n.z,x:n.x,y:n.y},expected:n.tile,tile:2},'*');
                  });
                }""", npc)
                assert result['ok'] is True and result['after'] == 2, result
                state = game.evaluate("""n => {
                  const a=window.TibiaMapAPI,v=a.validateWorld();
                  return {tile:a.getTile(n.z,n.x,n.y),
                    npc:a.exportWorld().npcs.find(x=>x.id===n.id),
                    valid:v.ok,issues:v.issues};
                }""", npc)
                assert state['tile']==2 and state['npc'] and state['valid'] is False
                assert any(item['name']=='Uzdrowiciel'
                    for issue in state['issues'] for item in issue.get('blocked',[]))
                assert not errors,errors
                print('EXPECTED NEGATIVE: bridge ACK=ok; game-world validation=FAIL (healer trapped in wall)')
                print('Raw tile mutation bypasses game invariants; not a product API.')
            finally:
                browser.close()


if __name__ == '__main__':
    if len(sys.argv)!=2: raise SystemExit('Usage: smoke_invalid_npc_cell.py GAME.html')
    check(Path(sys.argv[1]).resolve())
