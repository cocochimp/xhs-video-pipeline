import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker } from "../../../shared/ui";

const mid = (a: number, b: number) => Math.round((a + b) / 2);

/** 阿牛先摊手「很吓人？」，再竖大拇指配「好消息」卡片：花得越少，要攒的越少 */
const S07: React.FC<SceneProps> = ({ at, dur }) => (
  <AbsoluteFill>
    <Sequence durationInFrames={at(1)}>
      <Pose name="shrug" x={720} h={600} at={0} />
      <BigText x={720} y={190} at={0} size={90}>很吓人？</BigText>
    </Sequence>
    <Sequence from={at(1)} durationInFrames={dur - at(1)}>
      <Pose name="thumb" x={310} h={620} at={0} />
    </Sequence>
    <Card x={920} y={230} at={at(1)} size={72} fill={ORANGE} color="#fff" tilt={-3}>好消息</Card>
    <Sticker src="coin" x={1210} y={220} h={110} at={at(1) + 8} rot={10} />
    <Card x={920} y={480} at={at(2)} size={60}>花得越少 ↓</Card>
    <Card x={920} y={700} at={mid(at(2), at(3))} size={60}>要攒的越少 <span style={{ color: ORANGE }}>↓</span></Card>
  </AbsoluteFill>
);
export default S07;
