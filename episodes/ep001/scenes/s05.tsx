import React from "react";
import { AbsoluteFill } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose } from "../../../shared/ui";

/** 年支出 × 25 = 退休数字 */
const S05: React.FC<SceneProps> = ({ at }) => (
  <AbsoluteFill>
    <BigText x={720} y={190} at={at(0)} size={70}>反过来算</BigText>
    <Card x={300} y={420} at={at(1)} size={66}>年支出</Card>
    <BigText x={560} y={420} at={at(1) + 6} size={90}>×</BigText>
    <Card x={760} y={420} at={at(1) + 10} size={80} fill={ORANGE} color="#fff">25</Card>
    <BigText x={960} y={420} at={at(2)} size={90}>=</BigText>
    <Card x={1180} y={420} at={at(2) + 4} size={66}>退休数字</Card>
    <Pose name="calc" x={720} h={360} at={at(0)} />
  </AbsoluteFill>
);
export default S05;
