#!/usr/bin/env python3
"""Bounded C1 live authoring in opaque sandboxed iframes; not HTTPS/Jaskinia.

python smoke_live_c1.py /path/to/Tibia_Enhanced_v14_1_DevAPI.html
Requires Python Playwright and Chromium. Optional CHROMIUM_EXECUTABLE.
Does not touch original game, user saves or Opera browser profile.
"""
from pathlib import Path
import os
import sys
import tempfile
from playwright.sync_api import sync_playwright
from build_live_c1 import build

def verify(game_html: Path) -> None:
    with tempfile.TemporaryDirectory(prefix='c1-live-') as temp:
        output = Path(temp) / 'c1-demo.html'
        build(game_html, output)
        with sync_playwright() as pw:
            opts = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
            if os.environ.get('CHROMIUM_EXECUTABLE'):
                opts['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
            browser = pw.chromium.launch(**opts)
            try:
                context = browser.new_context(viewport={'width': 1500, 'height': 900})
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.set_content(output.read_text(encoding='utf-8'), wait_until='domcontentloaded')
                page.wait_for_function('() => document.querySelector("#log")?.textContent === "Gra gotowa"', timeout=30000)
                game = page.frame_locator('#game')
                editor = page.frame_locator('#studio')
                runtime = page.frames[1]
                assert runtime.evaluate('()=>!!window.TibiaMapAPI')
                blocked = page.frames[2].evaluate('''() => {
                    try { return !!window.parent.document.querySelector('#game') }
                    catch(e) { return e.name }
                }''')
                assert blocked == 'SecurityError', blocked
                game.locator('#game').click(position={'x': 200, 'y': 625})
                page.wait_for_timeout(250)
                alive = runtime.evaluate('()=>TibiaMapAPI.getRuntimeMonsterStats().alive')
                player = runtime.evaluate('()=>TibiaMapAPI.getPlayerState()')
                assert alive == 338 and player['zone'] == 'Twierdza Srebrnej Bramy'
                editor.locator('#nearby').click()
                page.wait_for_timeout(180)
                loc = [int(editor.locator('#z').input_value()), int(editor.locator('#x').input_value()), int(editor.locator('#y').input_value())]
                assert loc == [player['z'], player['tx'] + 3, player['ty']], loc
                get = lambda: runtime.evaluate('(p)=>TibiaMapAPI.getTile(...p)', loc)
                before = get()
                assert before != 4, before
                editor.locator('#set').click()
                page.wait_for_timeout(220)
                assert get() == 4, ('live apply', editor.locator('#status').inner_text())
                assert runtime.evaluate('()=>TibiaMapAPI.getPlayerState()') == player
                assert runtime.evaluate('()=>TibiaMapAPI.getRuntimeMonsterStats().alive') == alive
                print('PASS context->live tile, player/spawn intact')
                editor.locator('#undo').click()
                page.wait_for_timeout(220)
                assert get() == before, ('undo original tile', editor.locator('#status').inner_text())
                print('PASS undo restored original terrain', before)
                editor.locator('#read').click()
                page.wait_for_timeout(150)
                editor.locator('#set').click()
                page.wait_for_timeout(220)
                assert get() == 4
                page.locator('#reload').click()
                page.wait_for_timeout(1200)
                runtime = page.frames[1]
                assert runtime.evaluate('(p)=>window.TibiaMapAPI?.getTile(...p)', loc) == 4
                print('PASS game-only reload replays host-held delta')
                game.locator('#game').click(position={'x': 200, 'y': 625})
                page.wait_for_timeout(300)
                p1 = runtime.evaluate('()=>TibiaMapAPI.getPlayerState()')
                page.locator('#backtoplay').click()
                page.wait_for_timeout(140)
                assert runtime.evaluate('()=>document.activeElement?.id') == 'game'
                page.keyboard.down('d')
                page.wait_for_timeout(500)
                page.keyboard.up('d')
                p2 = runtime.evaluate('()=>TibiaMapAPI.getPlayerState()')
                assert p2['x'] > p1['x'], (p1, p2)
                print('PASS focus handoff and WASD movement', p1['x'], '->', p2['x'])
                editor.locator('#z').select_option('0')
                editor.locator('#x').fill('30')
                editor.locator('#y').fill('83')
                editor.locator('#read').click()
                page.wait_for_timeout(160)
                assert runtime.evaluate('()=>TibiaMapAPI.getTile(0,30,83)') == 0
                runtime.evaluate('()=>TibiaMapAPI.setTile(0,30,83,4)')
                editor.locator('#set').click()
                page.wait_for_timeout(200)
                assert 'STALE_WRITE' in editor.locator('#status').inner_text()
                assert runtime.evaluate('()=>TibiaMapAPI.getTile(0,30,83)') == 4
                print('PASS stale write rejected')
                assert not errors, errors
                print('PASS bounded browser tests; real origins/persistence/Owner feel NOT tested')
            finally:
                browser.close()

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python smoke_live_c1.py Tibia_Enhanced_v14_1_DevAPI.html')
    verify(Path(sys.argv[1]).resolve())
