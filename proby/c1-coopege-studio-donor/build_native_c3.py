#!/usr/bin/env python3
"""Build C3 test in disposable OLD Jaskinia HTML using its real window API.

Requires the public old-Jaskinia build (host=web) and public historical Tibia donor.
Does not edit either original; outputs a NEW HTML only. No network access.

  python build_native_c3.py JASKINIA_WEB.html Tibia_Enhanced_v14_1_DevAPI.html --out C3.html

Output uses genuine native old-Jaskinia tiles; still NOT new Jaskinia, not Oct Coopege.
"""
import argparse
import base64
from pathlib import Path

HERE = Path(__file__).resolve().parent

def build(jaskinia: Path, donor: Path, out: Path) -> None:
    shell = jaskinia.read_text('utf-8')
    game = donor.read_text('utf-8')
    bridge = (HERE / 'live_game_bridge_snippet.html').read_text('utf-8')
    editor = (HERE / 'live_editor_template.html').read_text('utf-8')
    extension = (HERE / 'native_extension_c3.js').read_text('utf-8')
    # Critical: this disposable C3 build must not read/write regular Jaskinia
    # localStorage keys, even if launched from the same file:// or HTTP origin.
    # The quote is part of the prefix to preserve unquoted object keys
    # such as the instrument protocol field `jaskinia: 1`.
    for prefix in ("'jaskinia:", '"jaskinia:', '`jaskinia:'):
        shell = shell.replace(prefix, prefix[0] + 'c3-lab-2026-11-06:')
    if not ('window.Jaskinia' in shell and 'JASKINIA_API' in shell):
        raise ValueError('Input is not an old Jaskinia build with public ext API')
    if '</body>' not in shell or 'window.TibiaMapAPI' not in game or '</body>' not in game:
        raise ValueError('Expected Jaskinia and historical Tibia donor files')
    if not ('__GAME_B64__' in extension and '__EDITOR_B64__' in extension):
        raise ValueError('Generator placeholders missing')
    # The source donor remains untouched. Only a copy is instrumented.
    game = game.replace('</body>', bridge + '\n</body>', 1)
    # The editor is deliberately thin; layout/window chrome belongs to native Jaskinia.
    addon = '''<div style="margin-top:12px"><button id="back" type="button">Wróć do gry</button></div>
<script>document.querySelector('#back').onclick=()=>window.parent.postMessage({proto:'coopege-c1-live/v1',kind:'request',id:987654,action:'focus'},location.origin==='null'?'*':location.origin);</script>
'''
    editor = editor.replace('To eksperyment z fragmentem Studia,', 'Zmiany mapy w tym wariancie nie przetrwają zamknięcia całego pliku. To eksperyment z fragmentem Studia,')
    editor = editor.replace('</html>', addon + '</html>')
    b64 = lambda s: base64.b64encode(s.encode('utf-8')).decode('ascii')
    extension = extension.replace('__GAME_B64__', b64(game)).replace('__EDITOR_B64__', b64(editor))
    script = '<script>\n' + extension.replace('</script', '<\\/script') + '\n</script>\n'
    pos = shell.rfind('</body>')
    finished = shell[:pos] + script + shell[pos:]
    out.write_text(finished, encoding='utf-8')
    print('C3 native Jaskinia experiment:', out, len(finished.encode('utf-8')), 'bytes')

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('jaskinia', type=Path)
    p.add_argument('donor', type=Path)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    build(a.jaskinia, a.donor, a.out)
