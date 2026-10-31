import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Check, Pose, Sticker, clamp } from "../../../shared/ui";

/** 4%法则：每年只花4%，钱基本花不完 */
const S04: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const coins = [0, 1, 2].map((k) => {
    const t = at(1) + 8 + k * 16;
    if (frame < t) return null;
    const p = interpolate(frame, [t, t + 22], [0, 1], clamp);
    return <Sticker key={k} src="coin" x={470 + k * 30} y={640 + 200 * p} h={70} at={t} style={{ opacity: 1 - p }} />;
  });
  return (
    <AbsoluteFill>
      <Card x={720} y={180} at={at(0)} size={88}>4% 法则</Card>
      <Sticker src="piggy" x={500} y={520} h={300} at={at(1)} />
      {coins}
      <Card x={930} y={430} at={at(1) + 6} size={54}>每年只花 <span style={{ color: ORANGE }}>4%</span></Card>
      <Card x={930} y={620} at={at(2)} size={54}>钱基本花不完</Card>
      <Check x={1210} y={600} at={at(2) + 6} />
      <Pose name="point" x={1270} h={420} at={at(0)} />
    </AbsoluteFill>
  );
};
export default S04;
