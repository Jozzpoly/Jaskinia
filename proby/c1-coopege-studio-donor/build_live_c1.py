#!/usr/bin/env python3
"""Build isolated C1 world-authoring research artifact from PUBLIC historical Coopege donor.

Usage: python build_live_c1.py /path/to/Tibia_Enhanced_v14_1_DevAPI.html --out result.html
No network, source modification, user browser data, or Jaskinia main changes.
Not a current Coopege release and not the actual Jaskinia host.
"""
from __future__ import annotations
import argparse
import base64
from pathlib import Path

HERE = Path(__file__).parent

def build(donor: Path, output: Path) -> None:
    source = donor.read_text(encoding='utf-8')
    if '</body>' not in source or 'TibiaMapAPI' not in source:
        raise ValueError('Not the supported Tibia v14.1 donor HTML')
    snippet = (HERE/'live_game_bridge_snippet.html').read_text(encoding='utf-8')
    editor = (HERE/'live_editor_template.html').read_text(encoding='utf-8')
    shell = (HERE/'live_shell_template.html').read_text(encoding='utf-8')
    boot = (HERE/'live_bootstrap_template.html').read_text(encoding='utf-8')
    game = source.replace('</body>', snippet + '\n</body>', 1)
    def b64(content: str) -> str:
        return base64.b64encode(content.encode('utf-8')).decode('ascii')
    boot = boot.replace('__GAME_B64__', b64(game)).replace('__EDITOR_B64__', b64(editor))
    assert shell.endswith('</html>')
    result = shell[:-len('</html>')] + boot + '</html>'
    output.write_text(result, encoding='utf-8')
    print('Built', output, len(result.encode('utf-8')), 'bytes')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('donor', type=Path)
    ap.add_argument('--out', required=True, type=Path)
    a = ap.parse_args()
    build(a.donor, a.out)
