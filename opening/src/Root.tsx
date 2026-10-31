import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile, useCurrentFrame } from "remotion";
import { IntroPart } from "./Intro";
import { MainPart } from "./Main";
import { Subtitles } from "./Subtitles";
import { MAIN_START, T, f } from "./timeline";

const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#f7f2e8" }}>
      {frame < f(MAIN_START) ? <IntroPart /> : <MainPart />}
      <Subtitles />
      {(["intro", "title", "main"] as const).map((seg) => (
        <Sequence key={seg} from={f(T.segments[seg].start)}>
          <Audio src={staticFile(`vo_${seg}.mp3`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <Composition id="Opening" component={Opening} durationInFrames={f(T.duration)} fps={T.fps} width={1440} height={1080} />
);
