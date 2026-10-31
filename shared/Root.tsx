import React from "react";
import { Composition } from "remotion";
import { EPISODES } from "../episodes";
import { Episode } from "./Episode";
import { FPS, f } from "./theme";

// 每期一个组件，避免把场景组件放进 defaultProps（defaultProps 必须可序列化）
const COMPS = EPISODES.map((ep) => ({ ep, C: () => <Episode ep={ep} /> }));

export const Root: React.FC = () => (
  <>
    {COMPS.map(({ ep, C }) => (
      <Composition key={ep.episode.id} id={ep.episode.id} component={C}
        durationInFrames={f(ep.timeline.duration)} fps={FPS} width={1440} height={1080} />
    ))}
  </>
);
