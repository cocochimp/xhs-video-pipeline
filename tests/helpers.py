"""测试用的小型期数数据：3 个配音段、3 个场景、一个选题滚动。"""

import copy

from tools.audio_timeline import norm, segment_speech

_EP = {
    "id": "ep999",
    "title": "标题",
    "segments": [{"id": "open", "gap": 0.3}, {"id": "title", "gap": 1.4}, {"id": "body", "gap": 0.5}],
    "roll": {"after": "open", "dur": 1.2, "topics": ["甲", "乙"]},
    "scenes": [
        {"id": "s01", "lines": [{"seg": "open", "zh": "开场", "say": "开场。"}],
         "sfx": [{"line": 0, "kind": "pop", "vol": 0.8}]},
        {"id": "s02", "lines": [{"seg": "open", "zh": "这期", "say": "这期："},
                                {"seg": "title", "zh": "标题", "say": "标题？"}], "sfx": []},
        {"id": "s03", "lines": [{"seg": "body", "zh": "一二", "say": "一二，"},
                                {"seg": "body", "zh": "三", "say": "三。"}],
         "sfx": [{"line": 1, "kind": "stamp", "vol": 1.0, "offset": -0.1}]},
    ],
    "cost": {"tts": 0, "image": 0},
    "pace": {},  # 测试不加停顿
}


def make_episode() -> dict:
    return copy.deepcopy(_EP)


def words_for(text: str, per: float = 0.2) -> list[tuple[float, float, str]]:
    """假的逐字时间：每个字（不含标点）0.2 秒。"""
    chars = [c for c in text if norm(c)]
    return [(i * per, (i + 1) * per, c) for i, c in enumerate(chars)]


def fake_seg_audio(ep: dict) -> dict:
    return {seg: {"duration": len(norm(t)) * 0.2 + 0.25, "words": words_for(t), "hash": "h"}
            for seg, t in segment_speech(ep).items()}
