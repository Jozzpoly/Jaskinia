# Próba P1: organ nowej Jaskini w oknie starej. Instrukcja w README.md obok.
import asyncio, json, subprocess, sys, time, os
from playwright.async_api import async_playwright
P=os.path.dirname(os.path.abspath(__file__))
srv=subprocess.Popen([sys.executable,'-m','http.server','8765','--bind','127.0.0.1'],cwd=P+'/site' if os.path.isdir(P+'/site') else P,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
async def main():
    async with async_playwright() as pw:
        b=await pw.chromium.launch(); pg=await b.new_page(viewport={'width':1280,'height':800})
        logs=[]; pg.on('console', lambda m: logs.append(m.text))
        await pg.goto('http://127.0.0.1:8765/jaskinia.html'); await pg.wait_for_timeout(2500)
        has=await pg.evaluate("typeof window.Jaskinia==='object' && !!window.Jaskinia.ext")
        print('API starej Jaskini:', has)
        wid=await pg.evaluate("Jaskinia.ext.open('przyrzad',{fresh:true,st:{url:'http://127.0.0.1:8765/organ.html',title:'organ'}})")
        print('okno:', wid)
        await pg.wait_for_timeout(4000)
        recent=await pg.evaluate("localStorage.getItem('jaskinia:przyrzady')")
        print('ostatnie przyrządy:', recent)
        frames=[f.url for f in pg.frames]; print('ramki:', [u for u in frames if 'organ' in u])
        of=[f for f in pg.frames if 'organ.html' in f.url]
        if of: print('organ widzi:', await of[0].evaluate("document.getElementById('u').textContent"))
        await pg.screenshot(path=P+'/zrzut.png')
        print('błędy w konsoli:', [l for l in logs if 'rror' in l][:3])
        await b.close()
asyncio.run(main()); srv.terminate()
