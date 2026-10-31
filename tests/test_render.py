import json
from pathlib import Path

import pytest

from tests.helpers import make_episode, words_for
from tools.build_audio import build
from tools.render import check_timeline

VOICE = {"speaker": "x", "rate": 15}


def _synth(text, out_path, speaker, speech_rate):
    Path(out_path).write_bytes(b"ID3fake")
    return words_for(text)


@pytest.fixture
def built(tmp_path):
    d = tmp_path / "ep999"
    d.mkdir()
    (d / "episode.json").write_text(json.dumps(make_episode(), ensure_ascii=False))
    build(d, synth=_synth, detect=lambda p: [], voice=VOICE, sync_root=None)
    return json.loads((d / "episode.json").read_text()), json.loads((d / "audio/timeline.json").read_text())


def test_fresh_timeline_passes(built):
    ep, tl = built
    check_timeline(ep, tl, VOICE, "ep999")


def test_edited_say_fails(built):
    ep, tl = built
    ep["scenes"][2]["lines"][1]["say"] = "三四。"
    with pytest.raises(RuntimeError, match="build_audio"):
        check_timeline(ep, tl, VOICE, "ep999")


def test_edited_zh_fails(built):
    ep, tl = built
    ep["scenes"][2]["lines"][0]["zh"] = "改过的字幕"
    with pytest.raises(RuntimeError, match="build_audio"):
        check_timeline(ep, tl, VOICE, "ep999")


def test_changed_voice_fails(built):
    ep, tl = built
    with pytest.raises(RuntimeError, match="build_audio"):
        check_timeline(ep, tl, {"speaker": "x", "rate": 20}, "ep999")


def test_wrong_dir_name_fails(built):
    ep, tl = built
    with pytest.raises(RuntimeError, match="ep999"):
        check_timeline(ep, tl, VOICE, "ep002")
