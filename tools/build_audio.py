"""按 episode.json 生成整期配音和时间轴。台词和音色都没变的段直接用缓存，不调用 TTS。

  .venv/bin/python tools/build_audio.py episodes/ep001
  .venv/bin/python tools/build_audio.py episodes/ep001 --force   # 全部重配

产物（episodes/<id>/audio/）：vo_<段>_<hash>.mp3、words_<段>_<hash>.json（逐字时间 + 停顿）、timeline.json
按内容 hash 命名，旧版本保留：台词改回原样时直接复用，不再计费；预览也不会被浏览器缓存的旧音频干扰。
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tools.audio_timeline import TAIL, layout, pace_cuts, pace_plan, pace_tag, segment_hash, segment_speech, shift_words  # noqa: E402
from tools.sync_public import sync  # noqa: E402

PRICE = 0.0003  # 豆包语音合成 2.0，元/字（标点也算字）


def load_voice() -> dict:
    return json.loads((ROOT / "studio/config.json").read_text())["voice"]


def detect_silences(mp3: Path) -> list[list[float]]:
    """用 ffmpeg silencedetect 找出音频里的停顿 [[开始, 结束], ...]（秒）；末尾没结束的停顿丢弃。"""
    import imageio_ffmpeg
    r = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-i", str(mp3),
                        "-af", "silencedetect=noise=-40dB:d=0.12", "-f", "null", "-"],
                       capture_output=True, text=True, check=True)
    out, start = [], None
    for m in re.finditer(r"silence_(start|end): (-?[\d.]+)", r.stderr):
        if m.group(1) == "start":
            start = float(m.group(2))
        elif start is not None:
            out.append([round(start, 3), round(float(m.group(2)), 3)])
            start = None
    return out


def splice(raw: Path, out: Path, cuts: list[tuple[float, float]]) -> None:
    """在切点插入静音：句子之间多停一下。"""
    import imageio_ffmpeg
    edges = [0.0] + [t for t, _ in cuts] + [None]
    parts, labels = [], []
    for k in range(len(edges) - 1):
        a, b = edges[k], edges[k + 1]
        trim = f"atrim=start={a:.3f}" + (f":end={b:.3f}" if b is not None else "")
        pad = f",apad=pad_dur={cuts[k][1]:.3f}" if k < len(cuts) else ""
        parts.append(f"[0:a]{trim},asetpts=PTS-STARTPTS{pad}[p{k}]")
        labels.append(f"[p{k}]")
    graph = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=0:a=1[o]"
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(raw), "-filter_complex", graph,
                    "-map", "[o]", "-c:a", "libmp3lame", "-q:a", "3", str(out)], check=True)


def build(ep_dir: Path, force: bool = False, synth=None, voice: dict | None = None, sync_root: Path | None = ROOT,
          detect=detect_silences):
    """返回 (timeline, 本次计费字数, 本次实际合成的段名列表)。"""
    if synth is None:
        import tts_doubao
        synth = tts_doubao.synth
    voice = voice or load_voice()
    episode = json.loads((ep_dir / "episode.json").read_text())
    audio = ep_dir / "audio"
    audio.mkdir(exist_ok=True)
    speech = segment_speech(episode)
    # 先用假音频走一遍排版，音效越界、空台词等错误在计费前暴露
    layout(episode, {seg: {"duration": 1.0, "words": [], "hash": ""} for seg in speech}, voice)
    seg_audio, billed, revoiced = {}, 0, []
    rates = {s["id"]: s["rate"] for s in episode["segments"] if "rate" in s}
    plans = pace_plan(episode)  # 某段单独调语速（如开头）
    try:
        for seg, text in speech.items():
            rate = rates.get(seg, voice["rate"])
            key = segment_hash(voice["speaker"], rate, text + pace_tag(plans.get(seg)))
            wfile, mp3 = audio / f"words_{seg}_{key}.json", audio / f"vo_{seg}_{key}.mp3"
            cached = json.loads(wfile.read_text()) if wfile.exists() and mp3.exists() else None
            if force or not cached or cached["hash"] != key:
                wfile.unlink(missing_ok=True)  # 合成失败时不能留下与新 mp3 不配套的旧缓存
                raw = audio / f"raw_{seg}_{key}.mp3" if plans.get(seg) else mp3
                words = synth(text, raw, speaker=voice["speaker"], speech_rate=rate)
                if not words:
                    raise RuntimeError(f"配音段 {seg} 没有返回逐字时间")
                if plans.get(seg):  # 句间、换片多停一下
                    cuts = pace_cuts(text, words, plans[seg])
                    splice(raw, mp3, cuts)
                    words = shift_words(words, cuts)
                    raw.unlink(missing_ok=True)
                cached = {"hash": key, "words": [list(w) for w in words]}
                wfile.write_text(json.dumps(cached, ensure_ascii=False))
                billed += len(text)
                revoiced.append(seg)
                print(f"  配音 {seg}：{len(text)} 字")
            if "silences" not in cached:
                cached["silences"] = detect(mp3)
                wfile.write_text(json.dumps(cached, ensure_ascii=False))
            words = [tuple(w) for w in cached["words"]]
            seg_audio[seg] = {"duration": words[-1][1] + TAIL, "words": words, "hash": key, "silences": cached["silences"]}
        tl = layout(episode, seg_audio, voice)
        (audio / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1))
    finally:
        if billed:
            tts = episode.setdefault("cost", {}).setdefault("tts", 0)
            episode["cost"]["tts"] = round(tts + billed * PRICE, 4)
            (ep_dir / "episode.json").write_text(json.dumps(episode, ensure_ascii=False, indent=2) + "\n")
    if sync_root:
        sync(sync_root)
    return tl, billed, revoiced


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", type=Path)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    import pipeline
    pipeline.load_env()
    tl, billed, _ = build(a.episode.resolve(), force=a.force)
    print(f"时长 {tl['duration']:.1f}s，{len(tl['scenes'])} 个场景，本次配音 {billed} 字（约 {billed * PRICE:.2f} 元）")


if __name__ == "__main__":
    main()
