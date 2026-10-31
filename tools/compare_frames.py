"""迁移校验：每个场景在旧版成片和新版成片里各取一帧（场景结束前 0.3 秒），并排对比。

  git show bc96c1b:episode/public/timeline.json > /tmp/old_timeline.json   # 旧时间轴（旧工程已删除，从 git 历史取）
  .venv/bin/python tools/compare_frames.py out/legacy/ep1.mp4 /tmp/old_timeline.json out/ep001/ep001.mp4 episodes/ep001

输出 out/ep001/compare.jpg；任一场景平均灰度差 > 14 时退出码为 1。
旧时间轴的 subs 与新 episode.json 的台词一一对应（共 27 句），据此算出旧版各场景的结束时间。
"""

import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

THRESHOLD = 14
FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"


def grab(video: Path, t: float, path: Path) -> Image.Image:
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", str(video),
                    "-frames:v", "1", str(path)], check=True)
    return Image.open(path).convert("RGB")


def main():
    old_mp4, old_tl_path, new_mp4, ep_dir = map(Path, sys.argv[1:5])
    if not old_mp4.exists():
        sys.exit(f"找不到旧版成片 {old_mp4}")
    old = json.loads(old_tl_path.read_text())
    ep = json.loads((ep_dir / "episode.json").read_text())
    new = json.loads((ep_dir / "audio/timeline.json").read_text())
    firsts, k = [], 0
    for sc in ep["scenes"]:
        firsts.append(k)
        k += len(sc["lines"])
    if k != len(old["subs"]):
        sys.exit(f"台词数不一致：新版 {k} 句，旧版 {len(old['subs'])} 句")

    tmp = new_mp4.parent / "compare"
    tmp.mkdir(exist_ok=True)
    w, h = 480, 360
    font = ImageFont.truetype(FONT, 24, index=2)
    sheet = Image.new("RGB", (w * 2, h * len(firsts)), "white")
    d = ImageDraw.Draw(sheet)
    bad = []
    for j, sc in enumerate(ep["scenes"]):
        old_end = old["subs"][firsts[j + 1]]["start"] if j + 1 < len(firsts) else old["duration"]
        new_end = new["scenes"][sc["id"]]["end"]
        a = grab(old_mp4, old_end - 0.3, tmp / f"{sc['id']}_old.png").resize((w, h))
        b = grab(new_mp4, new_end - 0.3, tmp / f"{sc['id']}_new.png").resize((w, h))
        diff = float(np.abs(np.asarray(a.convert("L"), float) - np.asarray(b.convert("L"), float)).mean())
        flag = diff > THRESHOLD
        sheet.paste(a, (0, j * h))
        sheet.paste(b, (w, j * h))
        d.text((8, j * h + 84), f"{sc['id']} {sc['name']} · 旧", font=font, fill="red")
        d.text((w + 8, j * h + 84), f"新 · 差异 {diff:.1f}{' ⚠' if flag else ''}", font=font, fill="red")
        print(f"{sc['id']} {sc['name']:<8} 差异 {diff:5.1f}  {'⚠ 超出' if flag else 'ok'}")
        if flag:
            bad.append(sc["id"])
    out = new_mp4.parent / "compare.jpg"
    sheet.save(out, quality=85)
    print("对比图 →", out)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
