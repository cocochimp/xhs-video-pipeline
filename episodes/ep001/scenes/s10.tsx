import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, Strike } from "../../../shared/ui";

/** 「第一步不是赚更多」被划掉，「先算清楚」橙卡弹出；阿牛拿手机记账，日历一格格打勾，月底合计 × 25 */
const S10: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const span0 = at(1) - at(0);
  const DAYS = 28, COLS = 7, CW = 92, CH = 72, GX = 760, GY = 300;
  const tickFrom = at(1) + 6, tickTo = at(2) - 4;
  const ticked = Math.max(0, Math.min(DAYS, Math.floor(((frame - tickFrom) / Math.max(1, tickTo - tickFrom)) * DAYS)));
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at(1)}>
        <Pose name="point" x={280} h={600} at={0} />
        <Card x={900} y={360} at={at(0) + 2} size={64}>第一步：赚更多</Card>
        <Strike x={900} y={360} w={560} at={at(0) + Math.round(span0 * 0.45)} />
        <Card x={900} y={600} at={at(0) + Math.round(span0 * 0.65)} size={96} fill={ORANGE} color="#fff">先算清楚</Card>
      </Sequence>
      <Sequence from={at(1)} durationInFrames={dur - at(1)}>
        <Pose name="phone" x={300} h={620} at={0} />
        {/* 日历 */}
        <div style={{ position: "absolute", left: GX - 20, top: GY - 110, width: COLS * CW + 40, height: (DAYS / COLS) * CH + 140, background: "#fff",
          border: `5px solid ${INK}`, borderRadius: 22, boxShadow: `8px 8px 0 ${ORANGE}` }}>
          <div style={{ height: 70, background: ORANGE, borderRadius: "16px 16px 0 0", color: "#fff", fontFamily: FONT, fontSize: 44, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center" }}>这个月记账</div>
        </div>
        {[...Array(DAYS)].map((_, d) => {
          const x = GX + (d % COLS) * CW, y = GY + Math.floor(d / COLS) * CH;
          const on = d < ticked;
          return (
            <div key={d} style={{ position: "absolute", left: x, top: y, width: CW - 10, height: CH - 10, borderRadius: 10, background: on ? "#e6f6e9" : "#f3efe7",
              fontFamily: FONT, fontSize: on ? 44 : 26, fontWeight: 900, color: on ? "#22b14c" : "#8a8378", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {on ? "✓" : d + 1}
            </div>
          );
        })}
      </Sequence>
      <Card x={1000} y={720} at={at(2) + 2} size={56}>月底合计 <span style={{ color: ORANGE }}>× 25</span></Card>
      <BigText x={1000} y={880} at={at(2) + 20} size={84} color={ORANGE}>= 你的退休数字</BigText>
    </AbsoluteFill>
  );
};
export default S10;
