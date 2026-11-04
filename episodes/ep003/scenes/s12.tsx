import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Check, Pose, Sticker, Strike, clamp, pop } from "../../../shared/ui";
import { ROADS, Signpost, Toast, split } from "./_kit";

/** 「一夜暴富」被划掉 → 阿牛从五块路牌里抽出一块，橙色目标卡「每月多赚1000块」→ 手机发布商品，日历本周打勾 */
const S12: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const l1 = at(1), l2 = at(2);
  // 第二句：第 1 块路牌被抽出来，往下落到目标卡上方
  const pull = interpolate(frame, [l1 + 4, l1 + 20], [0, 1], clamp);
  const weeks = ["本周", "第2周", "第3周", "第4周"];
  const calAt = l2 + 10, tick = split(l2, dur, 2, 3);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={l1}>
        <Pose name="shrug" x={320} h={620} at={0} />
        <Sticker src="goldpile" x={960} y={400} h={300} at={at(0) + 4} />
        <Card x={960} y={600} at={at(0) + 10} size={70}>一夜暴富</Card>
        <Strike x={960} y={600} w={380} at={split(at(0), l1, 3, 5)} />
      </Sequence>

      <Sequence from={l1} durationInFrames={l2 - l1}>
        <Pose name="point" x={300} h={600} at={0} />
      </Sequence>
      {frame >= l1 && frame < l2 && (
        <>
          {ROADS.map((r, k) => (k === 0 ? null : <Signpost key={k} x={250 + k * 235} y={150} at={l1} w={200} size={34} label={r} dim />))}
          <Signpost x={250 + 710 * pull} y={150 + 230 * pull} at={l1} w={200 + 80 * pull} size={34 + 14 * pull} label={ROADS[0]} lit={l1 + 4} />
          <Card x={960} y={640} at={l1 + 2} size={72} fill={ORANGE} color="#fff">每月多赚 1000块</Card>
        </>
      )}

      <Sequence from={l2} durationInFrames={dur - l2}>
        <Pose name="phone" x={320} h={620} at={0} />
        <Toast x={960} y={290} at={4} w={520} size={42}>发布成功：<span style={{ color: ORANGE }}>第一单</span></Toast>
      </Sequence>
      {frame >= calAt && (
        <div style={{ position: "absolute", left: 960 - 330, top: 440, width: 660, transform: `scale(${pop(frame, calAt)})`, background: "#fff",
          border: `5px solid ${INK}`, borderRadius: 20, boxShadow: `8px 8px 0 ${ORANGE}`, overflow: "hidden", fontFamily: FONT, fontWeight: 900 }}>
          <div style={{ background: ORANGE, color: "#fff", fontSize: 36, padding: "8px 0", textAlign: "center" }}>这个月</div>
          <div style={{ display: "flex" }}>
            {weeks.map((w, k) => (
              <div key={k} style={{ flex: 1, height: 170, borderLeft: k ? `4px solid ${INK}` : "none", display: "flex", alignItems: "flex-start",
                justifyContent: "center", paddingTop: 16, fontSize: 36, color: k ? "#aaa" : INK, background: k ? "#fff" : "#fff3e8" }}>{w}</div>
            ))}
          </div>
        </div>
      )}
      <Check x={960 - 330 + 82} y={600} at={tick} size={110} />
    </AbsoluteFill>
  );
};
export default S12;
