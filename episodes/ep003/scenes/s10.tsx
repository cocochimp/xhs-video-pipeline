import React from "react";
import { AbsoluteFill } from "remotion";
import { ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose } from "../../../shared/ui";
import { ROADS, Signpost, Wire, split } from "./_kit";

/** 五块路牌并排，阿牛托腮思考；路牌下依次弹出条件卡「有手艺」「有耐心」「懂货」「有存款」「圈子广」，与路牌连线 */
const S10: React.FC<SceneProps> = ({ at, dur }) => {
  const conds = ["有手艺", "有耐心", "懂货", "有存款", "圈子广"];
  // 条件卡按念到的位置出现：第二句两个，第三句一个，第四句两个
  const times = [at(1) + 4, split(at(1), at(2), 1, 2), at(2) + 4,
    at(3) + 4, split(at(3), dur, 1, 2)];
  const xs = ROADS.map((_, k) => 200 + k * 260);
  return (
    <AbsoluteFill>
      {ROADS.map((r, k) => (
        <Signpost key={k} x={xs[k]} y={210} at={at(0) + k * 4} w={220} size={38} label={r} lit={times[k] - 4} />
      ))}
      {conds.map((c, k) => (
        <React.Fragment key={k}>
          <Wire a={[xs[k], 300]} b={[xs[k], 440]} at={times[k] - 4} d={8} color={ORANGE} width={8} />
          <Card x={xs[k]} y={480} at={times[k]} size={44} fill="#fff3e8">{c}</Card>
        </React.Fragment>
      ))}
      <Pose name="think" x={720} h={360} bottom={900} at={0} />
      <Card x={1150} y={720} at={at(0) + 20} size={44}>不用全做</Card>
    </AbsoluteFill>
  );
};
export default S10;
