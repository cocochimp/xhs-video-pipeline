import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose } from "../../../shared/ui";

const mid = (a: number, b: number) => Math.round((a + b) / 2);

/** 到手8000，每月花5000，到底要攒多少？ */
const S03: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Card x={480} y={320} at={at(0)} size={52}>到手<br /><span style={{ fontSize: 110 }}>¥8000</span></Card>
      <Card x={480} y={640} at={mid(at(0), at(1))} size={52}>每月花<br /><span style={{ fontSize: 110, color: ORANGE }}>¥5000</span></Card>
      <Pose name={frame < at(1) ? "point" : "think"} x={1080} h={640} at={frame < at(1) ? 0 : at(1)} />
      <Card x={1080} y={170} at={at(2)} size={60} fill={ORANGE} color="#fff" tilt={-4}>要攒多少？</Card>
    </AbsoluteFill>
  );
};
export default S03;
