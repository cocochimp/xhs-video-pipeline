import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose } from "../../../shared/ui";

const mid = (a: number, b: number) => Math.round((a + b) / 2);

/** 很吓人？好消息：花得越少，要攒的就越少 */
const S07: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const shrug = frame < at(1);
  return (
    <AbsoluteFill>
      {shrug && <BigText x={720} y={190} at={at(0)} size={84}>很吓人？</BigText>}
      <Pose name={shrug ? "shrug" : "point"} x={shrug ? 720 : 300} h={shrug ? 620 : 600} at={shrug ? at(0) : at(1)} />
      {!shrug && <Card x={880} y={230} at={at(1)} size={70} fill={ORANGE} color="#fff" tilt={-3}>好消息</Card>}
      {!shrug && <Card x={880} y={470} at={at(2)} size={60}>花得越少 ↓</Card>}
      {!shrug && <Card x={880} y={660} at={mid(at(2), at(3))} size={60}>要攒的越少 <span style={{ color: ORANGE }}>↓</span></Card>}
    </AbsoluteFill>
  );
};
export default S07;
