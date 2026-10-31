import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { useEp } from "../../../shared/context";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose } from "../../../shared/ui";

/** 固定开头：钩子问题「普通人，要如何才能提前退休？」→ 阿牛举牌「第x期」 */
const S01: React.FC<SceneProps> = ({ at, dur }) => {
  const { episode } = useEp();
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at(1)}>
        <Pose name="think" x={430} h={700} at={0} />
        <BigText x={980} y={430} at={Math.max(0, at(0) + 18)} size={150} color={ORANGE} slam>提前退休？</BigText>
      </Sequence>
      <Sequence from={at(1)} durationInFrames={dur - at(1)}>
        <Pose name="sign" x={720} h={760} at={0}
          sign={<span>第<span style={{ color: ORANGE }}>{episode.no}</span>期</span>} />
      </Sequence>
    </AbsoluteFill>
  );
};
export default S01;
