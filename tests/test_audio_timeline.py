import pytest

from tests.helpers import fake_seg_audio, make_episode
from tools.audio_timeline import char_times, layout, segment_hash, segment_speech

VOICE = {"speaker": "x", "rate": 15}


def test_char_times_ignores_punctuation():
    st, en = char_times("一二，三。", [(0, 0.2, "一"), (0.2, 0.4, "二"), (0.4, 0.6, "三")])
    assert st == [0, 0.2, 0.4]
    assert en == [0.2, 0.4, 0.6]


def test_char_times_fills_missing_char_with_previous_end():
    st, en = char_times("一二三", [(0, 0.2, "一"), (0.4, 0.6, "三")])
    assert st[1] == en[1] == 0.2


def test_segment_speech_concatenates_in_order():
    assert segment_speech(make_episode()) == {"open": "开场。这期：", "title": "标题？", "body": "一二，三。"}


def test_segment_speech_rejects_noncontiguous_segment():
    ep = make_episode()
    ep["scenes"][2]["lines"][0]["seg"] = "open"
    with pytest.raises(ValueError, match="不连续"):
        segment_speech(ep)


def test_segment_speech_rejects_unknown_segment():
    ep = make_episode()
    ep["scenes"][2]["lines"][0]["seg"] = "nope"
    with pytest.raises(ValueError, match="未定义"):
        segment_speech(ep)


def test_layout_times():
    ep = make_episode()
    tl = layout(ep, fake_seg_audio(ep), VOICE)
    # open：0.3 起，4 个字 → 0.8 + 0.25 = 1.05；结束于 1.35
    assert tl["segments"]["open"]["start"] == pytest.approx(0.3)
    assert tl["roll"] == {"start": pytest.approx(1.4), "dur": 1.2, "topics": ["甲", "乙", "标题"]}
    assert tl["segments"]["title"]["start"] == pytest.approx(2.75)
    assert tl["segments"]["body"]["start"] == pytest.approx(3.9)
    assert tl["duration"] == pytest.approx(5.95)
    starts = [(l["scene"], l["i"], l["start"]) for l in tl["lines"]]
    assert starts == [("s01", 0, pytest.approx(0.3)), ("s02", 0, pytest.approx(0.7)),
                      ("s02", 1, pytest.approx(2.75)), ("s03", 0, pytest.approx(3.9)), ("s03", 1, pytest.approx(4.3))]
    assert tl["scenes"]["s01"] == {"start": 0.0, "end": pytest.approx(0.7)}
    assert tl["scenes"]["s02"] == {"start": pytest.approx(0.7), "end": pytest.approx(3.9)}
    assert tl["scenes"]["s03"] == {"start": pytest.approx(3.9), "end": pytest.approx(5.95)}
    assert tl["voice"] == VOICE


def test_sfx_expansion_includes_roll_ticks():
    ep = make_episode()
    sfx = layout(ep, fake_seg_audio(ep), VOICE)["sfx"]
    assert [s[1] for s in sfx] == ["pop", "pop", "stamp", "stamp"]
    assert sfx[0][0] == pytest.approx(0.3)      # s01 第 0 句
    assert sfx[1][0] == pytest.approx(1.648)    # 选题滚过第 1 张
    assert sfx[2] == [pytest.approx(2.6), "stamp", 0.8]   # 停在本期标题
    assert sfx[3][0] == pytest.approx(4.2)      # s03 第 1 句提前 0.1 秒


def test_segment_hash_changes_with_rate():
    assert segment_hash("x", 15, "文本") != segment_hash("x", 16, "文本")
    assert segment_hash("x", 15, "文本") == segment_hash("x", 15, "文本")


def test_char_times_limits_skip_ahead():
    words = [(0.0, 0.1, "十"), (0.1, 0.2, "个"), (0.2, 0.3, "人"),
             (0.3, 0.4, "十"), (0.4, 0.5, "分"), (0.5, 0.6, "好")]
    st, en = char_times("10个人，十分好", words)
    chars = "10个人十分好"
    assert st[chars.index("个")] == pytest.approx(0.1)
    assert st == sorted(st)


def test_char_times_splits_multichar_word_evenly():
    st, en = char_times("一二三", [(0, 0.4, "一二")])
    assert st[:2] == pytest.approx([0, 0.2])
    assert en[:2] == pytest.approx([0.2, 0.4])


def test_char_times_is_case_insensitive():
    st, en = char_times("Hello", [(0, 0.5, "hello")])
    assert en[-1] == pytest.approx(0.5)


def test_layout_rejects_unknown_roll_target():
    ep = make_episode()
    ep["roll"]["after"] = "nope"
    with pytest.raises(ValueError, match="nope"):
        layout(ep, fake_seg_audio(ep), VOICE)


def test_char_times_recovers_after_unmatched_word():
    words = [(0.0, 0.2, "二零二四"), (0.2, 0.4, "年"), (0.4, 0.6, "的"), (0.6, 0.8, "春"),
             (0.8, 1.0, "天"), (1.0, 1.2, "来"), (1.2, 1.4, "了")]
    st, en = char_times("2024年的春天来了", words)
    assert st[4] == pytest.approx(0.2)
    assert en[-1] == pytest.approx(1.4)
    assert st == sorted(st)
