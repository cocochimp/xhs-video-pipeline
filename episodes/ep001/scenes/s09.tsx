import React from "react";
import { AbsoluteFill } from "remotion";
import { INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker, Strike } from "../../../shared/ui";

/** 第一步：先算清楚每月花多少 */
const S09: React.FC<SceneProps> = ({ at }) => (
  <AbsoluteFill>
    <Pose name="calc" x={260} h={600} at={at(0)} />
    <Card x={860} y={190} at={at(0)} size={56}>第一步不是赚更多</Card>
    <Strike x={940} y={190} w={330} at={at(0) + 14} />
    <Card x={860} y={400} at={at(1)} size={92} fill={ORANGE} color="#fff" tilt={-2}>先算清楚</Card>
    <Sticker src="calendar" x={720} y={640} h={190} at={at(2)} rot={-6} />
    <Sticker src="calc" x={1000} y={640} h={190} at={at(2) + 5} rot={6} />
    <BigText x={860} y={810} at={at(2) + 8} size={50} color={INK}>一个月到底花多少？</BigText>
  </AbsoluteFill>
);
export default S09;
