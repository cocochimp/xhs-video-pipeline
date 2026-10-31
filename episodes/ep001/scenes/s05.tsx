import React from "react";
import { AbsoluteFill } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose } from "../../../shared/ui";

/** 公式卡：年支出 × 25 = 退休数字，阿牛在右边按计算器 */
const S05: React.FC<SceneProps> = ({ at }) => (
  <AbsoluteFill>
    <Pose name="calc" x={1150} h={620} at={0} />
    <BigText x={520} y={200} at={at(0)} size={80}>反过来算</BigText>
    <Card x={300} y={430} at={at(1)} size={66}>年支出</Card>
    <BigText x={510} y={430} at={at(1) + 6} size={90}>×</BigText>
    <Card x={690} y={430} at={at(1) + 10} size={80} fill={ORANGE} color="#fff">25</Card>
    <BigText x={260} y={680} at={at(2)} size={100}>=</BigText>
    <Card x={560} y={680} at={at(2) + 4} size={80} fill={ORANGE} color="#fff" tilt={-2}>退休数字</Card>
  </AbsoluteFill>
);
export default S05;
