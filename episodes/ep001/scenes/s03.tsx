import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose, Sticker } from "../../../shared/ui";

const mid = (a: number, b: number) => Math.round((a + b) / 2);

/** 阿牛奔跑上班 → 躺平想不上班也有钱花；右侧到手8000、每月花5000，最后问要攒多少 */
const S03: React.FC<SceneProps> = ({ at, dur }) => (
  <AbsoluteFill>
    <Sequence durationInFrames={at(1)}>
      <Pose name="run" x={340} h={580} at={0} />
    </Sequence>
    <Sequence from={at(1)} durationInFrames={dur - at(1)}>
      <Pose name="lie" x={340} h={540} at={0} />
    </Sequence>
    {/* 躺平时头顶飘金币 */}
    <Sticker src="coin" x={170} y={220} h={90} at={at(1) + 4} rot={-12} />
    <Sticker src="coin" x={340} y={160} h={100} at={at(1) + 8} />
    <Sticker src="coin" x={510} y={220} h={90} at={at(1) + 12} rot={12} />
    <Card x={1010} y={235} at={at(0)} size={50}>到手<br /><span style={{ fontSize: 104 }}>¥8000</span></Card>
    <Card x={1010} y={505} at={mid(at(0), at(1))} size={50}>每月花<br /><span style={{ fontSize: 104, color: ORANGE }}>¥5000</span></Card>
    <Card x={1010} y={770} at={at(2)} size={64} fill={ORANGE} color="#fff" tilt={-3}>到底要攒多少？</Card>
  </AbsoluteFill>
);
export default S03;
