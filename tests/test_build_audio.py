import json
from pathlib import Path

import pytest

from tests.helpers import make_episode, words_for
from tools.build_audio import PRICE, build

VOICE = {"speaker": "x", "rate": 15}


@pytest.fixture
def ep_dir(tmp_path):
    d = tmp_path / "ep999"
    d.mkdir()
    (d / "episode.json").write_text(json.dumps(make_episode(), ensure_ascii=False))
    return d


def fake_synth(calls):
    def synth(text, out_path, speaker, speech_rate):
        calls.append((text, speaker, speech_rate))
        Path(out_path).write_bytes(b"ID3fake")
        return words_for(text)
    return synth


def test_first_build_synthesizes_every_segment(ep_dir):
    calls = []
    tl, billed = build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None)
    assert [c[0] for c in calls] == ["开场。这期：", "标题？", "一二，三。"]
    assert all(c[1:] == ("x", 15) for c in calls)
    assert (ep_dir / "audio/timeline.json").exists()
    assert (ep_dir / "audio/vo_body.mp3").exists()
    assert billed == len("开场。这期：标题？一二，三。")
    cost = json.loads((ep_dir / "episode.json").read_text())["cost"]["tts"]
    assert cost == pytest.approx(billed * PRICE)
    assert tl["duration"] == pytest.approx(5.95)


def test_rebuild_uses_cache(ep_dir):
    calls = []
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None)
    _, billed = build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None)
    assert len(calls) == 3
    assert billed == 0


def test_line_change_only_revoices_its_segment(ep_dir):
    calls = []
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None)
    ep = json.loads((ep_dir / "episode.json").read_text())
    ep["scenes"][2]["lines"][1]["say"] = "三四。"
    (ep_dir / "episode.json").write_text(json.dumps(ep, ensure_ascii=False))
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None)
    assert [c[0] for c in calls[3:]] == ["一二，三四。"]


def test_voice_change_revoices_all(ep_dir):
    calls = []
    build(ep_dir, synth=fake_synth(calls), voice=VOICE, sync_root=None)
    build(ep_dir, synth=fake_synth(calls), voice={"speaker": "x", "rate": 20}, sync_root=None)
    assert len(calls) == 6
