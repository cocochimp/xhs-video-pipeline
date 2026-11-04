import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, clamp, pop } from "../../../shared/ui";
import { BigSign, RoadStrip } from "./_kit";

/** 路牌「②做内容」亮起 → 阿牛举手机拍，笔记卡片一张张叠起 → 进度条先慢后快，卡片越叠越高 → 旁边写「资产」 */
const S06: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const l1 = at(1);
  // 卡片出现时间：第二句、三四句稀疏，第五句越来越密
  const times: number[] = [];
  for (let k = 0; k < 3; k++) times.push(l1 + 6 + k * Math.round((at(2) - l1) / 3));
  for (let k = 0; k < 2; k++) times.push(at(2) + 10 + k * Math.round((at(4) - at(2)) / 2));
  for (let k = 0; k < 6; k++) times.push(at(4) + 2 + Math.round(k * 7 * (1 - k * 0.06)));
  const labels = ["笔记", "视频", "笔记", "视频", "笔记", "视频", "笔记", "视频", "笔记", "视频", "笔记"];
  // 进度条：起步慢，第五句加速
  const prog = interpolate(frame, [at(2), at(4), dur], [0.05, 0.22, 1], clamp);
  return (
    <AbsoluteFill>
      <RoadStrip n={1} lit={at(0) + 4} />
      <Sequence durationInFrames={l1}>
        <Pose name="point" x={300} h={600} at={0} />
        <BigSign n={1} at={at(0)} />
      </Sequence>
      <Sequence from={l1} durationInFrames={dur - l1}>
        <Pose name="phone" x={330} h={600} at={0} />
      </Sequence>

      {/* 笔记卡片叠高 */}
      {times.map((t, k) => {
        if (frame < t) return null;
        const p = pop(frame, t, 12);
        return (
          <div key={k} style={{ position: "absolute", left: 900 - 150 + (k % 2 ? 10 : -10), top: 800 - k * 44 - (1 - p) * 80, width: 300, height: 64,
            background: k % 2 ? "#fff" : "#fff3e8", border: `5px solid ${INK}`, borderRadius: 12, opacity: Math.min(1, p * 1.5),
            transform: `rotate(${k % 2 ? 2 : -2}deg)`, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT, fontWeight: 900, fontSize: 34, color: INK }}>
            {labels[k]}
          </div>
        );
      })}

      {/* 进度条 */}
      {frame >= at(2) && (
        <div style={{ position: "absolute", left: 560, top: 290, width: 480, height: 46, border: `5px solid ${INK}`, borderRadius: 26, background: "#fff", overflow: "hidden",
          transform: `scale(${pop(frame, at(2))})` }}>
          <div style={{ width: `${prog * 100}%`, height: "100%", background: ORANGE }} />
        </div>
      )}
      <Card x={1240} y={313} at={at(2) + 4} size={40}>{frame < at(3) ? "起步慢" : "一直被刷到"}</Card>

      <BigText x={1210} y={600} at={at(4) + Math.round((dur - at(4)) * 0.55)} size={150} color={ORANGE} slam>资产</BigText>
    </AbsoluteFill>
  );
};
export default S06;
