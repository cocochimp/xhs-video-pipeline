import pytest

from tests.helpers import fake_seg_audio, make_episode, words_for
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
    assert [s[1] for s in sfx] == ["pop", "tick", "ding", "stamp"]
    assert sfx[0][0] == pytest.approx(0.3)      # s01 第 0 句
    assert sfx[1][0] == pytest.approx(1.648)    # 选题滚过第 1 张
    assert sfx[2] == [pytest.approx(2.6), "ding", 0.9]   # 停在本期标题
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


def test_snap_start_moves_start_to_pause_end():
    from tools.audio_timeline import snap_start
    assert snap_start(19.04, [[19.14, 19.69]]) == 19.69   # 停顿在开始后不久出现
    assert snap_start(5.46, [[4.97, 5.55]]) == 5.55       # 开始落在停顿里
    assert snap_start(2.48, [[2.02, 2.45]]) == 2.48       # 停顿已经结束，不动
    assert snap_start(1.0, [[1.5, 2.0]]) == 1.0           # 停顿太远，不动


def test_layout_snaps_line_start_to_silence_end():
    ep = make_episode()
    audio = fake_seg_audio(ep)
    before = layout(ep, audio, VOICE)
    audio["body"]["silences"] = [[0.35, 0.55]]
    after = layout(ep, audio, VOICE)
    b = {(l["scene"], l["i"]): l["start"] for l in before["lines"]}
    a = {(l["scene"], l["i"]): l["start"] for l in after["lines"]}
    moved = {k for k in a if a[k] != b[k]}
    assert moved == {("s03", 1)}
    assert a[("s03", 1)] == pytest.approx(b[("s03", 1)] - 0.4 + 0.55)


def test_layout_snap_past_tts_end_extends_end():
    ep = make_episode()
    audio = fake_seg_audio(ep)
    before = {(l["scene"], l["i"]): l for l in layout(ep, audio, VOICE)["lines"]}[("s03", 1)]
    audio["body"]["silences"] = [[0.45, 0.65]]   # 停顿在 TTS 开始后 0.05s 出现，TTS 结束落在停顿里
    after = {(l["scene"], l["i"]): l for l in layout(ep, audio, VOICE)["lines"]}[("s03", 1)]
    base = before["start"] - 0.4
    assert before["end"] == pytest.approx(base + 0.6)
    assert after["start"] == pytest.approx(base + 0.65)
    assert after["end"] >= after["start"]


def test_limit_sfx_caps_density():
    from tools.audio_timeline import limit_sfx
    ev = [[0.0, "pop", 1], [0.5, "pop", 1], [2.0, "whoosh", 1]] + [[2.0 + 2 * i, "pop", 1] for i in range(1, 8)]
    kept = limit_sfx(ev)
    assert [k[0] for k in kept] == [0.0, 4.0, 6.0, 8.0]   # 0.5 太近、whoosh 停用、pop 最多 4 个


def test_pace_plan_and_shift():
    from tools.audio_timeline import pace_cuts, pace_plan, pace_tag, shift_words
    ep = make_episode()
    ep["pace"] = {}
    assert pace_plan(ep) == {}
    ep["pace"] = {"line": 0.3, "scene": 0.6}
    plan = pace_plan(ep)
    assert plan == {"open": [(2, 0.6)], "body": [(2, 0.3)]}   # 开场→这期 换片；一二→三 同片
    assert pace_tag(plan["body"]) == "|pace:2:0.3"
    w = words_for("一二，三。")
    cuts = pace_cuts("一二，三。", w, plan["body"])
    assert cuts == [(pytest.approx(0.4), 0.3)]
    assert [x[0] for x in shift_words(w, cuts)] == [0.0, 0.2, pytest.approx(0.7)]


def test_snap_never_skips_a_whole_short_line():
    ep = make_episode()
    audio = fake_seg_audio(ep)
    audio["body"]["silences"] = [[0.3, 0.5]]   # 「一二，」读完就停：开头 0.0 吸附会跳到 0.5，越过整句
    lines = layout(ep, audio, {"speaker": "x", "rate": 15})["lines"]
    body = [l for l in lines if l["seg"] == "body"]
    assert body[0]["start"] < body[0]["end"] <= body[1]["start"]
