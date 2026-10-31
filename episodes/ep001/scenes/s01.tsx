import React from "react";
import { AbsoluteFill } from "remotion";
import { useEp } from "../../../shared/context";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Pose } from "../../../shared/ui";

/** 固定开头：阿牛举牌「第x期」 */
const S01: React.FC<SceneProps> = ({ at }) => {
  const { episode } = useEp();
  return (
    <AbsoluteFill>
      <Pose name="sign" x={720} h={760} at={Math.max(0, at(0) - 4)}
        sign={<span>第<span style={{ color: ORANGE }}>{episode.no}</span>期</span>} />
    </AbsoluteFill>
  );
};
export default S01;
