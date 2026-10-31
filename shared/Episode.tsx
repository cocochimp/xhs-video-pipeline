import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { EpisodeCtx } from "./context";
import { Paper, Subtitles, TopBar } from "./Frame";
import { f } from "./theme";
import type { EpisodeModule } from "./types";

/** 每个场景放进自己的 <Sequence>，场景里 useCurrentFrame() 从 0 开始 */
export const Episode: React.FC<{ ep: EpisodeModule }> = ({ ep }) => {
  const { episode, timeline, scenes } = ep;
  return (
    <EpisodeCtx.Provider value={{ episode, timeline }}>
      <AbsoluteFill>
        <Paper />
        {episode.scenes.map((sc) => {
          const span = timeline.scenes[sc.id];
          const from = f(span.start);
          const dur = Math.max(1, f(span.end) - from);
          const starts = timeline.lines.filter((l) => l.scene === sc.id).map((l) => f(l.start) - from);
          const at = (i: number) => (i < starts.length ? starts[i] : dur);
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
            <Audio src={staticFile(`episodes/${episode.id}/audio/vo_${id}.mp3`)} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </EpisodeCtx.Provider>
  );
};
