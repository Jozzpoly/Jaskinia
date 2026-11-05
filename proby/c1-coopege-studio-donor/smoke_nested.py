#!/usr/bin/env python3
"""Double-iframe feasibility probe: isolated Jaskinia-style shell → old Tibia Studio → game.

Not a test of the real Jaskinia runtime, cross-origin storage, focus or saved user data.
Usage: python smoke_nested.py path/to/Tibia_Developer_Studio_v3_1.html path/to/Tibia_Enhanced_v14_1_DevAPI.html
Requires Python Playwright + Chromium. Optional CHROMIUM_EXECUTABLE.
"""
from pathlib import Path
import os
import sys
from playwright.sync_api import sync_playwright


def check(studio: Path, game: Path) -> None:
    assert studio.is_file() and game.is_file()
    with sync_playwright() as pw:
        args = dict(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        if os.environ.get("CHROMIUM_EXECUTABLE"):
            args["executable_path"] = os.environ["CHROMIUM_EXECUTABLE"]
        browser = pw.chromium.launch(**args)
        try:
            context = browser.new_context(viewport={"width": 1600, "height": 960})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.set_content(
                '<!doctype html><meta charset="utf-8"><title>Experimental shell</title>'
                '<style>body{margin:0}iframe{border:0;width:100vw;height:100vh}</style>'
                '<iframe id="studio"></iframe>'
            )
            page.locator("#studio").evaluate(
                "(el, content) => { el.srcdoc = content; }", studio.read_text(encoding="utf-8")
            )
            inner = page.frame_locator("#studio")
            inner.locator("#gameFile").set_input_files(str(game))
            page.wait_for_function(
                "() => document.querySelector('#studio').contentWindow.document"
                ".querySelector('#statusText')?.textContent.startsWith('Gra połączona')",
                timeout=30000,
            )
            present = page.locator("#studio").evaluate(
                """el => ({
                  studioReady: !!el.contentWindow.document.querySelector('#gameFrame'),
                  gameReady: !!el.contentWindow.document.querySelector('#gameFrame')
                             .contentWindow.TibiaMapAPI,
                  isNotTopLevelGame: !window.TibiaMapAPI
                })"""
            )
            assert all(present.values()), present
            inner.locator('[data-page="map"]').click()
            assert inner.locator("#mapCanvas").is_visible()
            assert not errors, errors
            print("PASS nested studio + internal game + map UI, zero page errors")
            print("NOT TESTED: real Jaskinia, normal URL origins, shared world/session, owner feel")
        finally:
            browser.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python smoke_nested.py STUDIO.html GAME.html")
    check(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
