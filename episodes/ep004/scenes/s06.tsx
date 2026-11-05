import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose, clamp, pop } from "../../../shared/ui";
import { Arrow, FlowCard, ROW_Y, SLOTS } from "./_kit";

/** 上一片的「工资 → 花 → 存」翻转换位成「工资 → 存 → 花」，「存」放大变橙；阿牛欢呼 */
const S06: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const sw = at(0) + 10;
  const p = interpolate(frame, [sw, sw + 16], [0, 1], clamp);
  const e = p * p * (3 - 2 * p);
  // 「存」从第三格走上弧线到第二格，「花」走下弧线到第三格
  const saveX = SLOTS[2] + (SLOTS[1] - SLOTS[2]) * e, saveY = ROW_Y - 150 * Math.sin(e * Math.PI);
  const spendX = SLOTS[1] + (SLOTS[2] - SLOTS[1]) * e, spendY = ROW_Y + 120 * Math.sin(e * Math.PI);
  const grow = frame >= at(1) ? pop(frame, at(1), 9) : 0;
  const saveS = 0.45 + 0.55 * e + 0.2 * grow;
  const hot = frame >= at(1);
  return (
    <AbsoluteFill>
      <Pose name="cheer" x={260} h={620} at={0} />
      <Card x={900} y={240} at={at(0) + 2} size={60}>顺序<span style={{ color: ORANGE }}>反过来</span></Card>

      <FlowCard x={SLOTS[0]} y={ROW_Y}>工资</FlowCard>
      <Arrow x={(SLOTS[0] + SLOTS[1]) / 2} y={ROW_Y} at={0} />
      <Arrow x={(SLOTS[1] + SLOTS[2]) / 2} y={ROW_Y} at={0} />
      <FlowCard x={spendX} y={spendY}>花</FlowCard>
      <FlowCard x={saveX} y={saveY} s={saveS} fill={hot ? ORANGE : e < 1 ? "#ddd" : "#fff"} color={hot ? "#fff" : e < 1 ? "#8a8378" : INK}>
        {hot ? "先存" : "存"}
      </FlowCard>

      <Card x={SLOTS[2]} y={ROW_Y + 200} at={at(2) + 4} size={40}>随便花 · 不愧疚</Card>
    </AbsoluteFill>
  );
};
export default S06;
