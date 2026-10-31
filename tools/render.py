"""渲染整期：同步静态文件 → Remotion 渲染画面 → 混入背景音乐和音效。

  .venv/bin/python tools/render.py episodes/ep001           # → out/ep001/ep001.mp4
  .venv/bin/python tools/render.py episodes/ep001 --draft   # → out/ep001/ep001-draft.mp4
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.sync_public import sync  # noqa: E402


def render(ep_dir: Path, draft: bool = False) -> Path:
    eid = json.loads((ep_dir / "episode.json").read_text())["id"]
    out = ROOT / "out" / eid
    out.mkdir(parents=True, exist_ok=True)
    sync(ROOT)
    raw = out / f"{eid}_raw.mp4"
    subprocess.run(["npx", "remotion", "render", "shared/index.ts", eid, str(raw), "--log=error"], cwd=ROOT, check=True)
    final = out / f"{eid}{'-draft' if draft else ''}.mp4"
    subprocess.run([sys.executable, str(ROOT / "opening/make_audio.py"), str(raw), str(final),
                    str(ep_dir / "audio/timeline.json")], check=True)
    return final


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", type=Path)
    ap.add_argument("--draft", action="store_true")
    a = ap.parse_args()
    print("→", render(a.episode.resolve(), a.draft))
