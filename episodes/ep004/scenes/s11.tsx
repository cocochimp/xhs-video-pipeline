import React from "react";
import { AbsoluteFill } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Check, Pose, Strike } from "../../../shared/ui";

/** 「性格」卡被划掉，橙色「能力」卡弹出并打勾；阿牛竖大拇指 */
const S11: React.FC<SceneProps> = ({ at }) => (
  <AbsoluteFill>
    <Pose name="thumb" x={320} h={640} at={0} />
    <Card x={920} y={300} at={at(0) + 4} size={80} fill="#eee" color="#8a8378">性格</Card>
    <Strike x={920} y={300} w={300} at={at(0) + 22} />

    <Card x={920} y={560} at={at(1)} size={110} fill={ORANGE} color="#fff">能力</Card>
    <Check x={1180} y={560} at={at(1) + 12} size={140} />

    <Card x={920} y={800} at={at(2) + 4} size={44}>设一次 · <span style={{ color: ORANGE }}>每月自动存</span></Card>
  </AbsoluteFill>
);
export default S11;
