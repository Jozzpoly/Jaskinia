import asyncio, subprocess, sys, time, os
from playwright.async_api import async_playwright
P=os.path.dirname(os.path.abspath(__file__))
a=subprocess.Popen([sys.executable,'-m','http.server','8765','--bind','127.0.0.1'],cwd=P+'/site',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
b=subprocess.Popen([sys.executable,'-m','http.server','8766','--bind','localhost'],cwd=P+'/organ',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
async def run(pw, name, ctxargs):
    br=await pw.chromium.launch(); ctx=await br.new_context(**ctxargs); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto('http://127.0.0.1:8765/jaskinia.html'); await pg.wait_for_timeout(2500)
    await pg.evaluate("Jaskinia.ext.open('przyrzad',{fresh:true,st:{url:'http://localhost:8766/organ.html',title:'organ'}})")
    await pg.wait_for_timeout(4000)
    rec=await pg.evaluate("localStorage.getItem('jaskinia:przyrzady')")
    of=[f for f in pg.frames if 'organ.html' in f.url]
    seen=await of[0].evaluate("document.getElementById('u').textContent") if of else None
    vis=await pg.evaluate("[...document.querySelectorAll('iframe')].filter(f=>f.src.includes('organ.html')).map(f=>{const r=f.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})")
    await pg.screenshot(path=f'{P}/zrzut-{name}.png')
    print(name, '| zapamiętany:', 'organ próbny' in (rec or ''), '| organ słyszy:', seen, '| ramka px:', vis, '| błędy:', errs[:2])
    await br.close()
async def main():
    async with async_playwright() as pw:
        await run(pw, 'pc-inny-origin', {'viewport':{'width':1280,'height':800}})
        await run(pw, 'telefon-inny-origin', {**pw.devices['iPhone 13']})
asyncio.run(main()); a.terminate(); b.terminate()
