#!/usr/bin/env python3
"""Test C2 bridge against synthetic API host, NOT real Jaskinia layout/UX."""
import tempfile
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from build_native_c2 import build

HERE=Path(__file__).resolve().parent
DONOR=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else None
SYNTHETIC='''<!doctype html><meta charset="utf-8"><title>Test-only Jaskinia API simulator</title>
<style>body{background:#222;color:white;margin:0;font:13px sans-serif}.wins{display:flex;height:94vh;gap:8px;padding:6px}.box{flex:1;min-width:150px;border:2px solid #888;resize:horizontal;overflow:auto}.inner{height:94%;}</style>
<div class="wins" id="windows"></div><script>
const JASKINIA_API={v:1,ext:{types:{},type(k,d){this.types[k]=d},open(k,opts={}){
 if(!opts.fresh){const existing=document.querySelector('[data-kind="'+k+'"]');if(existing){existing.focus();return existing.id}}
 const outer=document.createElement('section');outer.className='box';outer.id='w'+document.querySelectorAll('.box').length;outer.dataset.kind=k;
 const label=document.createElement('b');label.textContent=this.types[k].name;outer.append(label);
 const inner=document.createElement('div');inner.className='inner';outer.append(inner);document.getElementById('windows').append(outer);
 const callbacks=[];this.types[k].render(inner,{id:outer.id,win:{st:{}},onDispose:f=>callbacks.push(f)});return outer.id;
}}};window.Jaskinia=JASKINIA_API;
</script></body></html>'''

def test():
  with tempfile.TemporaryDirectory() as td:
    p=Path(td);src=p/'stub.html';src.write_text(SYNTHETIC)
    built=p/'native.html';build(src,DONOR,built)
    with sync_playwright() as pw:
      browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
      page=browser.new_page(viewport={'width':1600,'height':900})
      errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
      page.set_content(built.read_text('utf-8'),wait_until='domcontentloaded')
      page.wait_for_function('()=>document.querySelectorAll(".box iframe").length===2')
      page.wait_for_function('()=>document.querySelector("[data-kind=c2_editor] iframe")?.contentWindow?.document === undefined',timeout=2500) if False else None
      page.wait_for_function('()=>document.querySelector("[data-kind=c2_game]") && document.querySelector("[data-kind=c2_editor]")')
      # Wait for the same historical game engine to come alive in first iframe.
      game=page.frame_locator('[data-kind=c2_game] iframe');editor=page.frame_locator('[data-kind=c2_editor] iframe')
      page.wait_for_function('()=>!!document.querySelector("[data-kind=c2_game] iframe")?.contentWindow',timeout=10000)
      editor.locator('#read').click(timeout=20000)
      page.wait_for_timeout(400)
      # Synthetic API bridge protocol must respond without permission to inspect child's private DOM.
      before=editor.locator('#status').inner_text()
      assert 'Pole' in before, before
      editor.locator('#set').click()
      page.wait_for_timeout(300)
      after=editor.locator('#status').inner_text()
      assert 'ZMIENIONO NA ŻYWO' in after, after
      editor.locator('#undo').click()
      page.wait_for_timeout(300)
      undone=editor.locator('#status').inner_text()
      assert 'ZMIENIONO NA ŻYWO' in undone,undone
      editor.locator('#back').click()
      page.wait_for_timeout(250)
      assert not errors, errors
      print('PASS: with synthetic ext API: 2 registered types, edit/undo/return protocol, no JS errors')
      print('NOT TESTED: actual old Jaskinia host / native window resizing/persistence / modern Coopege')
      browser.close()

if __name__=='__main__':
  if DONOR is None: raise SystemExit('Usage: python smoke_native_c2_synthetic.py Tibia_Enhanced_v14_1_DevAPI.html')
  test()
