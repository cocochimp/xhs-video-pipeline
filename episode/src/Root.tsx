import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile, useCurrentFrame } from "remotion";
import { BodyPart } from "./Body";
import { EndPart } from "./End";
import { Paper, Subtitles, TopBar } from "./Frame";
import { OpenPart, RollPart } from "./Open";
import { O, T, f, segStart } from "./tl";

const Episode: React.FC = () => {
  const frame = useCurrentFrame();
  const part = frame < O(1) - 4 ? <OpenPart /> : frame < segStart("body") ? <RollPart /> : frame < segStart("end") ? <BodyPart /> : <EndPart />;
  return (
    <AbsoluteFill>
      <Paper />
      {part}
      <Subtitles />
      <TopBar />
      {(["open", "title", "body", "end"] as const).map((k) => (
        <Sequence key={k} from={f(T.segs[k].start)}>
          <Audio src={staticFile(`vo_${k}.mp3`)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const Root: React.FC = () => (
  <Composition id="Episode" component={Episode} durationInFrames={f(T.duration)} fps={T.fps} width={1440} height={1080} />
);
