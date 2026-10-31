"""后期音频：占位背景音乐 + 音效，和配音混在一起。

  ../.venv/bin/python make_audio.py out/opening.mp4 out/opening_mix.mp4 [timeline.json]

- 人声：压缩 + 响度拉到约 -14 LUFS（短视频常见响度）
- 背景音乐：代码合成的轻快拨弦循环，人声出现时自动压低（sidechain ducking）
- 音效：卡片弹出「啵」、盖章「咚」、转场「嗖」，时间点取自 public/timeline.json
背景音乐和音效都是占位，确定账号主题后换成正式素材。
"""

import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 44100


def write_wav(path: Path, x: np.ndarray):
    x = np.clip(x, -1, 1)
    pcm = (x * 32767).astype("<i2").tobytes()
    import wave
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


def pluck(freq: float, dur: float, decay: float = 0.996) -> np.ndarray:
    """Karplus-Strong 拨弦。"""
    n = int(SR * dur)
    period = int(SR / freq)
    buf = np.random.default_rng(int(freq)).uniform(-1, 1, period)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = decay * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out * np.exp(-np.arange(n) / (SR * dur * 0.6))


def bgm(seconds: float) -> np.ndarray:
    bpm, beat = 100, 60 / 100
    chords = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]]  # C Am F G
    bar = beat * 4
    total = np.zeros(int(SR * (seconds + bar + 2)))  # 最后一小节的音符会超出 seconds
    t, k = 0.0, 0
    while t < seconds:
        ch = chords[k % 4]
        for b in range(8):  # 每小节 8 个八分音符分解和弦
            at = int(SR * (t + b * beat / 2))
            note = pluck(ch[b % 3] * (2 if b in (3, 6) else 1), beat * 1.2)
            total[at:at + len(note)] += note * (0.22 if b % 2 else 0.3)
        bass = pluck(ch[0] / 2, bar, decay=0.998)
        total[int(SR * t):int(SR * t) + len(bass)] += bass * 0.35
        for b in range(4):  # 轻鼓点：低频正弦衰减
            at = int(SR * (t + b * beat))
            n = int(SR * 0.18)
            kick = np.sin(2 * np.pi * 60 * np.arange(n) / SR * (1 - np.arange(n) / n * 0.5)) * np.exp(-np.arange(n) / (SR * 0.05))
            total[at:at + n] += kick * (0.5 if b % 2 == 0 else 0.25)
        t += bar
        k += 1
    total = total[: int(SR * seconds)]
    fade = int(SR * 1.5)
    total[-fade:] *= np.linspace(1, 0.35, fade)  # 不淡到 0，避免结尾死寂
    return total / np.abs(total).max() * 0.6


def sfx_pop() -> np.ndarray:
    n = int(SR * 0.12)
    f = np.linspace(900, 300, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-np.arange(n) / (SR * 0.03)) * 0.7


def sfx_stamp() -> np.ndarray:
    n = int(SR * 0.35)
    body = np.sin(2 * np.pi * 70 * np.arange(n) / SR) * np.exp(-np.arange(n) / (SR * 0.08))
    hit = np.random.default_rng(1).uniform(-1, 1, n) * np.exp(-np.arange(n) / (SR * 0.01))
    return (body * 0.9 + hit * 0.4)


def sfx_whoosh() -> np.ndarray:
    n = int(SR * 0.4)
    noise = np.random.default_rng(2).uniform(-1, 1, n)
    # 一阶低通，截止频率由低到高扫，形成「嗖」
    out, y = np.empty(n), 0.0
    for i in range(n):
        a = 0.02 + 0.3 * (i / n)
        y += a * (noise[i] - y)
        out[i] = y
    env = np.sin(np.pi * np.arange(n) / n)
    return out * env * 2.2


def sfx_tick() -> np.ndarray:
    """老虎机滚过一格：短促的木质咔哒"""
    n = int(SR * 0.05)
    t = np.arange(n) / SR
    click = np.random.default_rng(3).uniform(-1, 1, n) * np.exp(-t / 0.004)
    return (click * 0.6 + np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.012) * 0.5)


def sfx_ding() -> np.ndarray:
    """停在本期选题：清脆的叮"""
    n = int(SR * 0.9)
    t = np.arange(n) / SR
    return sum(a * np.sin(2 * np.pi * fr * t) for fr, a in ((1318.5, 0.6), (2637, 0.25), (1975.5, 0.15))) * np.exp(-t / 0.25)


SFX = {"pop": sfx_pop, "stamp": sfx_stamp, "whoosh": sfx_whoosh, "tick": sfx_tick, "ding": sfx_ding}


def mix_config() -> dict:
    """studio/config.json 里的音量倍数：{"bgm": 倍数, "sfx": {种类: 倍数}}，没有就是 1。"""
    cfg = ROOT.parent / "studio/config.json"
    mix = (json.loads(cfg.read_text()).get("mix") if cfg.exists() else None) or {}
    return {"bgm": mix.get("bgm", 1.0), "sfx": mix.get("sfx", {})}


def build_tracks(duration: float, tl: dict, tmp: Path) -> tuple[Path, Path]:
    tmp.mkdir(parents=True, exist_ok=True)
    cfg = ROOT.parent / "studio/config.json"
    chosen = json.loads(cfg.read_text()).get("bgm") if cfg.exists() else None
    bgm_path = ROOT.parent / "assets/audio/bgm" / chosen if chosen else None
    if not (bgm_path and bgm_path.exists()):  # 没选或文件不在：用合成的木琴循环
        bgm_path = tmp / "bgm.wav"
        write_wav(bgm_path, bgm(duration))
    fx = np.zeros(int(SR * (duration + 1)))
    if "sfx" in tl:  # 每期模板：时间轴里直接列出 [时刻, 音效, 音量]
        mix = mix_config()
        events = [(t, SFX[kind], vol * mix["sfx"].get(kind, 1.0)) for t, kind, vol in tl["sfx"]]
    else:  # 开头复刻版
        m, segs = tl["marks"], tl["segments"]
        events = [(m["scared"], sfx_whoosh, 0.8), (m["glow"], sfx_pop, 0.6), (m["read"], sfx_pop, 0.5),
                  (segs["intro"]["start"] + segs["intro"]["duration"], sfx_whoosh, 0.7),
                  (segs["main"]["start"] - 0.2, sfx_whoosh, 0.7),
                  (m["wallet"], sfx_pop, 0.8), (m["spend"], sfx_pop, 0.6), (m["title3"], sfx_whoosh, 0.5),
                  (m["c1"], sfx_pop, 0.8), (m["c2"], sfx_pop, 0.8), (m["c3"], sfx_pop, 0.8),
                  (m["reverse"], sfx_whoosh, 0.5), (m["trap"], sfx_stamp, 0.9), (m["clear"] + 0.1, sfx_stamp, 0.7)]
    for t, fn, vol in events:
        s = fn() * vol
        a = int(SR * t)
        fx[a:a + len(s)] += s[: max(0, len(fx) - a)]
    write_wav(tmp / "sfx.wav", fx)
    return bgm_path, tmp / "sfx.wav"


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    tl_path = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "public/timeline.json"
    tl = json.loads(tl_path.read_text())
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    dur = float(tl["duration"])
    bgm_wav, sfx_wav = build_tracks(dur, tl, dst.parent / "audio")
    bgm_vol = round(0.8 * mix_config()["bgm"], 3)
    graph = (
        "[0:a]aresample=44100,pan=mono|c0=0.5*c0+0.5*c1,"
        "acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=4,"
        "loudnorm=I=-15:TP=-1.5:LRA=7,apad,asplit=2[voice][key];"
        f"[1:a]loudnorm=I=-22:TP=-3:LRA=11,volume={bgm_vol}[bgm];"
        "[bgm][key]sidechaincompress=threshold=0.05:ratio=3:attack=20:release=250[ducked];"
        "[2:a]volume=0.9[fx];"
        "[voice][ducked][fx]amix=inputs=3:normalize=0:duration=longest,"
        "alimiter=limit=0.89,aresample=48000[out]"
    )
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-stream_loop", "-1", "-i", str(bgm_wav), "-i", str(sfx_wav),
                    "-filter_complex", graph, "-map", "0:v", "-map", "[out]",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-t", f"{dur:.3f}", str(dst)], check=True)


if __name__ == "__main__":
    main()
