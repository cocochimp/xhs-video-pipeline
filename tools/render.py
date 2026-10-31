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

from tools.audio_timeline import segment_hash, segment_speech  # noqa: E402
from tools.sync_public import sync  # noqa: E402


def check_timeline(episode: dict, timeline: dict, voice: dict, dir_name: str) -> None:
    """时间轴必须和当前 episode.json、音色一致，否则渲染出来的字幕和配音会对不上。"""
    if episode["id"] != dir_name:
        raise RuntimeError(f"episode.json 的 id（{episode['id']}）与目录名（{dir_name}）不一致")
    stale = []
    for seg, text in segment_speech(episode).items():
        have = timeline.get("segments", {}).get(seg, {}).get("hash")
        rate = next((g.get("rate", voice["rate"]) for g in episode["segments"] if g["id"] == seg), voice["rate"])
        if have != segment_hash(voice["speaker"], rate, text):
            stale.append(f"配音段 {seg}")
    want = [(sc["id"], i, ln["zh"]) for sc in episode["scenes"] for i, ln in enumerate(sc["lines"])]
    got = [(ln["scene"], ln["i"], ln["zh"]) for ln in timeline.get("lines", [])]
    if want != got:
        stale.append("台词/字幕")
    if stale:
        raise RuntimeError(f"timeline.json 已过期（{'、'.join(stale)}与 episode.json 不一致），先运行 tools/build_audio.py")


def render(ep_dir: Path, draft: bool = False, hd: bool = False) -> Path:
    """hd：导出高清，1.5 倍分辨率（2160×1620）、更高码率，文件名 <id>-hd.mp4。"""
    episode = json.loads((ep_dir / "episode.json").read_text())
    timeline = json.loads((ep_dir / "audio/timeline.json").read_text())
    voice = json.loads((ROOT / "studio/config.json").read_text())["voice"]
    try:
        check_timeline(episode, timeline, voice, ep_dir.name)
    except RuntimeError:  # 台词或音色改过：只重配变了的段（有缓存的不花钱），再渲染
        from tools.build_audio import build
        timeline, billed, _ = build(ep_dir)
        print(f"  重新配音 {billed} 字（约 {billed * 0.0003:.2f} 元）", file=sys.stderr)
        episode = json.loads((ep_dir / "episode.json").read_text())
        check_timeline(episode, timeline, voice, ep_dir.name)
    eid = episode["id"]
    out = ROOT / "out" / eid
    out.mkdir(parents=True, exist_ok=True)
    sync(ROOT)
    raw = out / f"{eid}_raw.mp4"
    extra = ["--scale=1.5", "--crf=16"] if hd else []
    subprocess.run(["npx", "remotion", "render", "shared/index.ts", eid, str(raw), "--log=error", *extra], cwd=ROOT, check=True)
    final = out / f"{eid}{'-draft' if draft else '-hd' if hd else ''}.mp4"
    subprocess.run([sys.executable, str(ROOT / "opening/make_audio.py"), str(raw), str(final),
                    str(ep_dir / "audio/timeline.json")], check=True)
    return final


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", type=Path)
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--hd", action="store_true")
    a = ap.parse_args()
    print("→", render(a.episode.resolve(), a.draft, a.hd))
