"""手绘口播视频半自动流水线。

用法：
  python pipeline.py projects/<slug> character   # 生成角色设定图
  python pipeline.py projects/<slug> images      # 每个镜头一张插画（带角色参考图）
  python pipeline.py projects/<slug> tts         # 整段配音 + 每句时间戳
  python pipeline.py projects/<slug> compose     # 套模板 + 合成 MP4 和封面
  python pipeline.py projects/<slug> all
加 --force 重做已存在的产物；只想重画某几张，删除 shots/NN.jpg 后重跑 images，或用 --only 3,7。
"""

import argparse
import asyncio
import base64
import json
import math
import os
import random
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

IMAGE_MODEL = "doubao-seedream-5-0-flash-260915"  # 0.12 元/张；要更精细换 pro（≤261 万像素 0.30 元）
IMAGE_SIZE = "1440x1080"
W, H = 1440, 1080
FPS = 30
FONT_PATH = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_BOLD, FONT_REGULAR = 2, 0  # ttc face index: W6, W3
ENV_FILE = Path.home() / ".config/xhs-video/.env"


def ffmpeg_exe() -> str:
    import shutil

    if shutil.which("ffmpeg"):
        return "ffmpeg"
    import imageio_ffmpeg  # pip 自带的静态 ffmpeg，系统没装时兜底

    return imageio_ffmpeg.get_ffmpeg_exe()


# ---------- 公共 ----------

def load_env():
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    if not os.environ.get("ARK_API_KEY"):
        sys.exit(f"缺少 ARK_API_KEY，请写入 {ENV_FILE}")


def load_board(proj: Path) -> dict:
    return json.loads((proj / "storyboard.json").read_text())


def font(size, bold=True):
    return ImageFont.truetype(FONT_PATH, size, index=FONT_BOLD if bold else FONT_REGULAR)


# ---------- 生图 ----------

def seedream(prompt: str, out: Path, ref: Path | None = None, retries: int = 2):
    body = {
        "model": IMAGE_MODEL,
        "prompt": prompt,
        "size": IMAGE_SIZE,
        "response_format": "url",
        "watermark": False,
    }
    if ref:
        body["image"] = "data:image/jpeg;base64," + base64.b64encode(ref.read_bytes()).decode()
    url = os.environ.get("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3") + "/images/generations"
    headers = {"Authorization": f"Bearer {os.environ['ARK_API_KEY']}"}
    last = None
    for attempt in range(retries + 1):
        try:
            r = requests.post(url, json=body, headers=headers, timeout=240)
            data = r.json()
            if "error" in data:
                raise RuntimeError(data["error"].get("message", data["error"]))
            img = requests.get(data["data"][0]["url"], timeout=120)
            img.raise_for_status()
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(img.content)
            return
        except Exception as e:  # noqa: BLE001 — 网络/接口错误统一重试
            last = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"{out.name} 生成失败：{last}")


def cmd_character(proj: Path, board: dict, force: bool, **_):
    out = proj / "character.jpg"
    if out.exists() and not force:
        print("character.jpg 已存在，跳过（--force 重做）")
        return
    prompt = (
        f"{board['style']}\n角色设定图：{board['character']}\n"
        "同一张图里并排画出这个角色的三个全身姿势：正面站立微笑、侧身走路、开心举手。"
        "三个姿势的发型、脸型、服装、配色完全一致。纯白背景，不要任何文字。"
    )
    seedream(prompt, out)
    print("角色设定图 →", out)


def shot_prompt(board: dict, shot: dict) -> str:
    return (
        f"{board['style']}\n"
        f"主角就是参考图里的角色，发型、脸型、服装、配色必须与参考图完全一致：{board['character']}\n"
        f"画面：{shot['scene']}。\n"
        f"在画面正上方用黑色手写马克笔字体写「{shot['keyword']}」，字号适中（字高约为画面高度的十分之一），"
        "字要清楚、只写这几个字，不要写其他任何文字。"
        "4:3 横版构图，主角画成全身、身高约占画面一半，主体居中偏下，四周留白。"
    )


def cmd_images(proj: Path, board: dict, force: bool, only: set[int] | None, **_):
    ref = proj / "character.jpg"
    if not ref.exists():
        sys.exit("先运行 character 生成角色设定图")
    jobs = []
    for i, shot in enumerate(board["shots"], 1):
        out = proj / "shots" / f"{i:02d}.jpg"
        if only and i not in only:
            continue
        if out.exists() and not force and not only:
            continue
        jobs.append((i, shot, out))
    print(f"待生成 {len(jobs)} 张（模型 {IMAGE_MODEL}）")
    failed = []

    def run(job):
        i, shot, out = job
        t = time.time()
        try:
            seedream(shot_prompt(board, shot), out, ref=ref)
            print(f"  ✓ {i:02d} {shot['keyword']}  {time.time() - t:.0f}s")
        except Exception as e:  # noqa: BLE001
            failed.append(i)
            print(f"  ✗ {i:02d} {e}")

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(run, jobs))
    if failed:
        print("失败镜头：", sorted(failed), "（重跑 images 会只补这些）")


# ---------- 配音 ----------

def _norm(s: str) -> str:
    return re.sub(r"[\W_]+", "", s)


def cmd_tts(proj: Path, board: dict, force: bool, **_):
    import edge_tts

    audio, timing_file = proj / "narration.mp3", proj / "timings.json"
    if audio.exists() and timing_file.exists() and not force:
        print("配音已存在，跳过（--force 重做）")
        return
    texts = [s["text"] for s in board["shots"]]
    sentences = []

    async def synth():
        com = edge_tts.Communicate("".join(texts), board.get("voice", "zh-CN-XiaoxiaoNeural"),
                                   rate=board.get("rate", "+0%"), boundary="SentenceBoundary")
        with audio.open("wb") as f:
            async for ch in com.stream():
                if ch["type"] == "audio":
                    f.write(ch["data"])
                elif ch["type"] == "SentenceBoundary":
                    sentences.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]))

    asyncio.run(synth())

    # 按句累加文本，把 TTS 的句子边界对齐到镜头
    starts, k = [], 0
    for t in texts:
        target, acc = len(_norm(t)), ""
        if k >= len(sentences):
            starts = None
            break
        starts.append(sentences[k][0])
        while k < len(sentences) and len(_norm(acc)) < target:
            acc += sentences[k][2]
            k += 1
        if _norm(acc) != _norm(t):
            starts = None
            break
    total = sentences[-1][1] if sentences else 0
    if starts is None:
        print("⚠ 句子边界与镜头对不上，改为按字数比例分配时长")
        lens = [len(_norm(t)) for t in texts]
        acc, starts = 0, []
        for n in lens:
            starts.append(total * acc / sum(lens))
            acc += n
    timing_file.write_text(json.dumps({"starts": starts, "end": total}, ensure_ascii=False, indent=1))
    print(f"配音 → {audio}（{total:.1f}s，{len(texts)} 句）")


# ---------- 合成 ----------

def paper_background(seed: int = 7) -> Image.Image:
    rnd = random.Random(seed)
    bg = Image.new("RGB", (W, H), (247, 242, 232))
    noise = Image.effect_noise((W, H), 6).convert("RGB")
    bg = ImageChops.multiply(bg, Image.eval(noise, lambda v: 235 + v // 12))
    d = ImageDraw.Draw(bg)
    colors = [(66, 133, 244), (234, 67, 53), (251, 188, 5), (52, 168, 83), (40, 40, 40)]
    for _ in range(70):  # 边缘的彩色手绘短线
        side = rnd.choice("tblr")
        x = rnd.randint(0, W) if side in "tb" else rnd.choice([rnd.randint(5, 90), rnd.randint(W - 90, W - 5)])
        y = rnd.randint(0, H) if side in "lr" else rnd.choice([rnd.randint(5, 45), rnd.randint(H - 45, H - 5)])
        ang, ln = rnd.uniform(0, 3.14), rnd.randint(10, 26)
        x2, y2 = x + ln * math.cos(ang), y + ln * math.sin(ang)
        d.line([(x, y), (x2, y2)], fill=rnd.choice(colors), width=rnd.choice([2, 3]))
    return bg


def title_width(d: ImageDraw.ImageDraw, text: str, f, stroke: int) -> float:
    return d.textlength(text, font=f) + stroke * (len(text) - 1)


def title_text(d: ImageDraw.ImageDraw, xy, text: str, f, stroke: int):
    """蓝字 + 白描边 + 正下方深色投影。逐字绘制并留出描边宽度的字距，避免相邻字的描边互相压住。"""
    x0, y = xy
    for layer in ("shadow", "face"):
        x = x0
        for ch in text:
            if layer == "shadow":
                d.text((x, y + stroke * 0.7), ch, font=f, fill=(28, 45, 85), stroke_width=stroke + 2, stroke_fill=(28, 45, 85))
            else:
                d.text((x, y), ch, font=f, fill=(58, 120, 214), stroke_width=stroke, stroke_fill=(255, 255, 255))
            x += d.textlength(ch, font=f) + stroke


def draw_title(img: Image.Image, text: str, y: int = 36, size: int = 62):
    f = font(size)
    d = ImageDraw.Draw(img)
    title_text(d, ((W - title_width(d, text, f, 6)) / 2, y), text, f, stroke=6)


def wrap(d: ImageDraw.ImageDraw, text: str, f, max_w: int) -> list[str]:
    lines, cur = [], ""
    tokens = re.findall(r"[A-Za-z0-9'’%.,!?\-—]+ ?|.", text)
    for tok in tokens:
        if d.textlength(cur + tok, font=f) > max_w and cur:
            lines.append(cur.rstrip())
            cur = tok.lstrip()
        else:
            cur += tok
    return lines + [cur.rstrip()] if cur else lines


def draw_subtitles(img: Image.Image, zh: str, en: str):
    d = ImageDraw.Draw(img)
    fz, fe = font(40), font(30, bold=False)
    zl = wrap(d, zh, fz, W - 220)
    el = wrap(d, en, fe, W - 220)
    y = H - 60 - len(el) * 40 - len(zl) * 54
    for line in zl:
        d.text(((W - d.textlength(line, font=fz)) / 2, y), line, font=fz, fill=(25, 25, 25))
        y += 54
    y += 4
    for line in el:
        d.text(((W - d.textlength(line, font=fe)) / 2, y), line, font=fe, fill=(45, 45, 45))
        y += 40


def whiten(a: Image.Image) -> Image.Image:
    """把插画的灰白底提成纯白：以四周边缘的亮度当白点做色阶拉伸。"""
    edge = [a.getpixel((x, y)) for x in range(0, a.width, 16) for y in (2, a.height - 3)]
    white = sorted(sum(p) / 3 for p in edge)[len(edge) // 2]
    k = 255 / max(white - 6, 1)
    return a.point(lambda v: min(255, int(v * k)))


def blend_art(canvas: Image.Image, art: Path, box) -> None:
    """等比缩放进 box 并正片叠底，让白底融进纸面。"""
    a = whiten(Image.open(art).convert("RGB"))
    bw, bh = box[2] - box[0], box[3] - box[1]
    s = min(bw / a.width, bh / a.height)
    a = a.resize((int(a.width * s), int(a.height * s)), Image.LANCZOS)
    x, y = box[0] + (bw - a.width) // 2, box[1] + (bh - a.height) // 2
    canvas.paste(ImageChops.multiply(canvas.crop((x, y, x + a.width, y + a.height)), a), (x, y))


def place_illustration(img: Image.Image, art: Path):
    blend_art(img, art, (130, 130, W - 130, 830))


def make_cover(proj: Path, board: dict, bg_seed: int):
    cw, ch = 1080, 1440
    cover = paper_background(bg_seed).resize((cw, ch))
    blend_art(cover, proj / "shots" / "01.jpg", (40, 330, cw - 40, ch - 80))
    d = ImageDraw.Draw(cover)
    title, size = board["title"], 120
    while size > 84 and title_width(d, title, font(size), 10) > cw - 120:
        size -= 4
    f = font(size)
    lines = [title]
    if title_width(d, title, f, 10) > cw - 120:  # 两行时尽量等长，避免单字落行
        half = (len(title) + 1) // 2
        lines = [title[:half], title[half:]]
    ty = 150 if len(lines) == 1 else 90
    for line in lines:
        title_text(d, ((cw - title_width(d, line, f, 10)) / 2, ty), line, f, stroke=10)
        ty += int(size * 1.35)
    cover.save(proj / "out" / "cover.jpg", quality=92)


def cmd_compose(proj: Path, board: dict, **_):
    shots = board["shots"]
    missing = [i for i in range(1, len(shots) + 1) if not (proj / "shots" / f"{i:02d}.jpg").exists()]
    if missing:
        sys.exit(f"缺少镜头图：{missing}，先跑 images")
    timing = json.loads((proj / "timings.json").read_text())
    starts, end = timing["starts"], timing["end"] + 0.6
    frames = proj / "frames"
    frames.mkdir(exist_ok=True)
    (proj / "out").mkdir(exist_ok=True)
    base = paper_background()
    draw_title(base, board["title"])
    concat = []
    for i, shot in enumerate(shots, 1):
        img = base.copy()
        place_illustration(img, proj / "shots" / f"{i:02d}.jpg")
        draw_subtitles(img, shot["text"], shot.get("en", ""))
        p = frames / f"{i:02d}.png"
        img.save(p)
        start = 0 if i == 1 else starts[i - 1]
        stop = starts[i] if i < len(shots) else end
        concat += [f"file '{p.resolve()}'", f"duration {stop - start:.3f}"]
    concat.append(f"file '{(frames / f'{len(shots):02d}.png').resolve()}'")
    (proj / "frames" / "concat.txt").write_text("\n".join(concat) + "\n")
    out = proj / "out" / "video.mp4"
    subprocess.run([
        ffmpeg_exe(), "-y", "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", str(frames / "concat.txt"),
        "-i", str(proj / "narration.mp3"),
        "-vf", f"fps={FPS},format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "160k", "-af", "apad=pad_dur=0.6", "-shortest",
        "-movflags", "+faststart", str(out),
    ], check=True)
    make_cover(proj, board, bg_seed=7)
    print("成片 →", out, "\n封面 →", proj / "out" / "cover.jpg")


STEPS = {"character": cmd_character, "images": cmd_images, "tts": cmd_tts, "compose": cmd_compose}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project", type=Path)
    ap.add_argument("step", choices=[*STEPS, "all"])
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="只重画这些镜头，如 3,7")
    a = ap.parse_args()
    load_env()
    board = load_board(a.project)
    only = {int(x) for x in a.only.split(",")} if a.only else None
    for name in (STEPS if a.step == "all" else [a.step]):
        STEPS[name](a.project, board, force=a.force, only=only)


if __name__ == "__main__":
    main()
