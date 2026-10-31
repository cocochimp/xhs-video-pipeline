import React from "react";
import { AbsoluteFill } from "remotion";
import { INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Sticker, Strike } from "../../../shared/ui";

/** 阿牛捂脸；「第一步不是赚更多」被划掉，「先算清楚」橙色卡，日历和计算器 */
const S09: React.FC<SceneProps> = ({ at }) => (
  <AbsoluteFill>
    <Pose name="facepalm" x={290} h={620} at={0} />
    <Card x={900} y={200} at={at(0)} size={56}>第一步不是赚更多</Card>
    <Strike x={900} y={200} w={480} at={at(0) + 16} />
    <Card x={900} y={420} at={at(1)} size={92} fill={ORANGE} color="#fff" tilt={-2}>先算清楚</Card>
    <Sticker src="calendar" x={740} y={655} h={180} at={at(2)} rot={-6} />
    <Sticker src="calc" x={1060} y={655} h={180} at={at(2) + 5} rot={6} />
    <BigText x={900} y={850} at={at(2) + 8} size={54} color={INK}>一个月到底花多少？</BigText>
  </AbsoluteFill>
);
export default S09;
