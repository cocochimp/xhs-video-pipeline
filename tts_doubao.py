"""豆包语音合成 2.0：整段合成，返回 mp3 和逐字时间戳。

key 读取 ~/.config/xhs-video/.env 的 VOLC_TTS_API_KEY（经 pipeline.load_env 加载）。
计费 0.0003 元/字，标点也算字。
"""

import base64
import json
import os

import requests

URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
RESOURCE = "seed-tts-2.0"
DEFAULT_SPEAKER = "zh_male_wennuanahu_uranus_bigtts"  # 温暖阿虎 2.0


def synth(text: str, out_path, speaker: str = DEFAULT_SPEAKER, speech_rate: int = 0) -> list[tuple[float, float, str]]:
    """合成 text 写入 out_path（mp3），返回 [(开始秒, 结束秒, 字), ...]。speech_rate 取值 -50..100，0 为正常语速。"""
    body = {
        "user": {"uid": "xhs-pipeline"},
        "req_params": {
            "text": text,
            "speaker": speaker,
            "audio_params": {"format": "mp3", "sample_rate": 24000, "speech_rate": speech_rate, "enable_subtitle": True},
        },
    }
    headers = {"X-Api-Key": os.environ["VOLC_TTS_API_KEY"], "X-Api-Resource-Id": RESOURCE}
    r = requests.post(URL, json=body, headers=headers, timeout=120, stream=True)
    r.raise_for_status()
    audio, words = b"", []
    for line in r.iter_lines():
        if not line:
            continue
        d = json.loads(line)
        if d.get("code") not in (0, 20000000):
            raise RuntimeError(f"豆包 TTS 失败：{d}")
        if d.get("data"):
            audio += base64.b64decode(d["data"])
        for w in (d.get("sentence") or {}).get("words", []):
            words.append((w["startTime"], w["endTime"], w["word"]))
    if not audio:
        raise RuntimeError("豆包 TTS 没有返回音频")
    with open(out_path, "wb") as f:
        f.write(audio)
    return words
