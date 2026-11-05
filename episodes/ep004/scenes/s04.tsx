import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose, clamp, pop } from "../../../shared/ui";
import { Arrow, FlowCard, ROW_Y, SLOTS } from "./_kit";

/** 三张卡「工资 → 花 → 存」，最后的「存」越缩越小、变灰；阿牛摊手 */
const S04: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const c = [at(1) + 4, at(1) + 12, at(1) + 20];
  // 第三句：「存」从正常缩到 0.45 并变灰
  const shrink = interpolate(frame, [at(2) + 6, at(2) + 40], [0, 1], clamp);
  const sSave = (frame >= c[2] ? pop(frame, c[2]) : 0) * (1 - 0.55 * shrink);
  return (
    <AbsoluteFill>
      <Pose name="shrug" x={260} h={600} at={0} />
      <Sequence durationInFrames={at(1)}>
        <Card x={900} y={300} at={at(0) + 6} size={64}>不怪你<span style={{ color: ORANGE }}>性格</span></Card>
      </Sequence>
      <Card x={900} y={260} at={at(1)} size={60}>问题出在<span style={{ color: ORANGE }}>顺序</span></Card>

      {frame >= c[0] && <FlowCard x={SLOTS[0]} y={ROW_Y} s={pop(frame, c[0])}>工资</FlowCard>}
      <Arrow x={(SLOTS[0] + SLOTS[1]) / 2} y={ROW_Y} at={c[0] + 4} />
      {frame >= c[1] && <FlowCard x={SLOTS[1]} y={ROW_Y} s={pop(frame, c[1])} fill="#fff">花</FlowCard>}
      <Arrow x={(SLOTS[1] + SLOTS[2]) / 2} y={ROW_Y} at={c[1] + 4} />
      {frame >= c[2] && (
        <FlowCard x={SLOTS[2]} y={ROW_Y} s={sSave} fill={shrink > 0.5 ? "#ddd" : "#fff"} color={shrink > 0.5 ? "#8a8378" : "#1f1f1f"}>存</FlowCard>
      )}
      <Card x={SLOTS[2]} y={ROW_Y + 190} at={at(2) + 40} size={40}>花剩才存</Card>
    </AbsoluteFill>
  );
};
export default S04;
