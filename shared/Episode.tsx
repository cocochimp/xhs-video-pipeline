import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { EpisodeCtx } from "./context";
import { Paper, Subtitles, TopBar } from "./Frame";
import { f, FPS } from "./theme";
import type { EpisodeModule } from "./types";

/** 每个场景放进自己的 <Sequence>，场景里 useCurrentFrame() 从 0 开始 */
const SFX_LEN: Record<string, number> = { tick: 0.1, pop: 0.15, whoosh: 0.45, stamp: 0.4, ding: 0.9 }; // 各音效的长度（秒）

/** preview：网站预览时把音效和背景音乐也放进来（渲染成片时由 opening/make_audio.py 另行混音，不传） */
export const Episode: React.FC<{ ep: EpisodeModule; preview?: { bgm: string } }> = ({ ep, preview }) => {
  const { episode, timeline, scenes } = ep;
  if (timeline.fps !== FPS) throw new Error(`timeline.json 帧率 ${timeline.fps} 与 FPS ${FPS} 不一致`);
  return (
    <EpisodeCtx.Provider value={{ episode, timeline }}>
      <AbsoluteFill>
        <Paper />
        {episode.scenes.map((sc) => {
          const span = timeline.scenes[sc.id];
          if (!span) throw new Error(`场景 ${sc.id} 不在 timeline.json 里，先运行 tools/build_audio.py`);
          if (!scenes[sc.id]) throw new Error(`场景 ${sc.id} 没有对应的场景组件`);
          const from = f(span.start);
          const dur = Math.max(1, f(span.end) - from);
          const starts = timeline.lines.filter((l) => l.scene === sc.id).map((l) => f(l.start) - from);
          const at = (i: number) => {
            if (i < 0 || i > starts.length) throw new Error(`场景 ${sc.id} 没有第 ${i} 句（共 ${starts.length} 句）`);
            return i < starts.length ? starts[i] : dur;
          };
          const Scene = scenes[sc.id];
          return (
            <Sequence key={sc.id} from={from} durationInFrames={dur} name={`${sc.id} ${sc.name}`}>
              <Scene at={at} dur={dur} from={from} />
            </Sequence>
          );
        })}
        <Subtitles />
        <TopBar />
        {Object.entries(timeline.segments).map(([id, s]) => (
          <Sequence key={id} from={f(s.start)} name={`配音 ${id}`}>
            <Audio src={staticFile(`episodes/${episode.id}/audio/vo_${id}_${s.hash}.mp3`)} />
          </Sequence>
        ))}
        {preview && timeline.sfx.map(([t, kind, vol], k) => (
          <Sequence key={`fx${k}`} from={f(t)} durationInFrames={f(SFX_LEN[kind] ?? 0.5)} name={`音效 ${kind}`}>
            <Audio src={staticFile(`library/sfx_${kind}.wav`)} volume={Math.min(1, vol * 0.8)} />
          </Sequence>
        ))}
        {preview && <Audio src={preview.bgm} loop volume={0.12} />}
      </AbsoluteFill>
    </EpisodeCtx.Provider>
  );
};
