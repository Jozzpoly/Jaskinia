#!/usr/bin/env python3
"""Read-only-input, isolated browser smoke test of historical Tibia Studio + engine.

Usage: python smoke_legacy.py path/to/Tibia_Developer_Studio_v3_1.html path/to/Tibia_Enhanced_v14_1_DevAPI.html
Optional CHROMIUM_EXECUTABLE=/usr/bin/chromium. Needs Python Playwright and Chromium.
No external server/network, no original file or browser-profile changes.
"""
from pathlib import Path
import os
import re
import sys
import tempfile
from playwright.sync_api import sync_playwright


def check(studio: Path, game: Path) -> None:
    assert studio.is_file(), studio
    assert game.is_file(), game
    errors: list[str] = []
    with sync_playwright() as pw:
        kwargs = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if os.environ.get("CHROMIUM_EXECUTABLE"):
            kwargs["executable_path"] = os.environ["CHROMIUM_EXECUTABLE"]
        browser = pw.chromium.launch(**kwargs)
        try:
            ctx = browser.new_context(viewport={"width": 1600, "height": 960}, accept_downloads=True)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            # set_content is intentional: avoid pretending this proves file/HTTP origin semantics.
            page.set_content(studio.read_text(encoding="utf-8"), wait_until="domcontentloaded")
            page.locator("#gameFile").set_input_files(str(game))
            page.wait_for_function(
                "() => document.querySelector('#statusText').textContent.startsWith('Gra połączona')",
                timeout=30000,
            )
            observed = page.locator("#gameFrame").evaluate(
                """el => ['TibiaAssetAPI','TibiaMapAPI','TibiaContentAPI','TibiaProjectAPI']
                    .map(k => !!el.contentWindow[k])"""
            )
            assert observed == [True] * 4, observed
            print("APIs PASS", observed)
            print("Engine:", page.locator("#dashEngine").inner_text(),
                  "Assets:", page.locator("#dashAssets").inner_text(),
                  "Map:", page.locator("#dashMap").inner_text(),
                  "Floors:", page.locator("#dashFloors").inner_text(),
                  "Monsters:", page.locator("#dashMonsters").inner_text())

            page.locator('[data-page="map"]').click()
            canvas = page.locator("#mapCanvas")
            canvas.hover(position={"x": 190, "y": 380})
            coord = page.locator("#mapCoord").inner_text()
            match = re.search(r"x:\s*(\d+)\s*y:\s*(\d+)\s*z:\s*0", coord)
            assert match, "Map hover did not produce expected surface floor coordinates: " + coord
            x, y = map(int, match.groups())
            pos = [x, y]
            getter = "(el, xy) => el.contentWindow.TibiaMapAPI.getTile(0, xy[0], xy[1])"
            before = page.locator("#gameFrame").evaluate(getter, pos)
            after = 4 if before != 4 else 0  # walkable earth/grass; avoid blocking paths
            page.locator(f'#tilePalette button[data-tile="{after}"]').click()
            canvas.click(position={"x": 190, "y": 380})
            assert page.locator("#undoBtn").is_enabled(), "Map stroke not accepted"
            assert page.locator("#gameFrame").evaluate(getter, pos) == before, (
                "Studio UI changed the running game before the explicit Apply"
            )
            page.locator("#applyMapBtn").click()
            page.wait_for_function(
                "(p) => document.querySelector('#gameFrame').contentWindow.TibiaMapAPI.getTile(0,p[0],p[1]) === p[2]",
                arg=[x, y, after], timeout=10000,
            )
            assert "zaakceptowany" in page.locator("#statusText").inner_text(), (
                "The change reached runtime but validation rejected the project"
            )
            print(f"STUDIO APPLY PASS: z=0 x={x} y={y}: {before} -> {after}")

            with tempfile.TemporaryDirectory() as td:
                with page.expect_download(timeout=25000) as info:
                    page.locator("#saveBuildBtn").click()
                exported = Path(td) / "new-build.html"
                info.value.save_as(str(exported))
                assert exported.stat().st_size > 100_000
                cold = ctx.new_page()
                cold_errors: list[str] = []
                cold.on("pageerror", lambda e: cold_errors.append(str(e)))
                cold.set_content(exported.read_text(encoding="utf-8"), wait_until="domcontentloaded")
                cold.wait_for_function(
                    "(p) => !!window.TibiaMapAPI && window.TibiaMapAPI.getTile(0,p[0],p[1]) === p[2]",
                    arg=[x, y, after], timeout=20000,
                )
                assert not cold_errors, cold_errors
                print("COLD EXPORTED BUILD PASS", exported.stat().st_size, "bytes")

                pristine = ctx.new_page()
                pristine.set_content(game.read_text(encoding="utf-8"), wait_until="domcontentloaded")
                pristine.wait_for_function("() => !!window.TibiaMapAPI", timeout=15000)
                assert pristine.evaluate(
                    "(xy) => window.TibiaMapAPI.getTile(0,xy[0],xy[1])", pos
                ) == before, "A separate clean game must not be the same live runtime"
                print("INDEPENDENT RUNTIME PASS (unchanged original world)")
            assert not errors, errors
            print("ALL TESTED GATES PASS; Jaskinia hosting / modern Coopege NOT tested")
        finally:
            browser.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python smoke_legacy.py STUDIO.html GAME.html")
    check(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
