import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose, clamp } from "../../../shared/ui";
import { BigSign, Jar, RedX, RoadStrip, split } from "./_kit";

const COIN = 64;
/** 罐子里的一枚金币：sleep 时轻轻起伏 + Zzz，work 时上下蹦 */
const coinStyle = (x: number, y: number, frame: number, k: number, work: boolean): React.CSSProperties => ({
  position: "absolute", left: x - COIN / 2, top: y - COIN / 2 - (work ? Math.abs(Math.sin(frame / 4 + k)) * 26 : Math.sin(frame / 14 + k) * 3),
  height: COIN, transform: `rotate(${work ? Math.sin(frame / 3 + k) * 15 : 0}deg)`,
});

/** 路牌「④配资产」亮起 →「活期」罐金币打瞌睡 → 金币挪进货币基金、指数基金开始干活 → 应急金罐先装满，「借钱投」盖红叉 */
const S08: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const l1 = at(1), l2 = at(2), l3 = at(3);
  // 罐子中心（画布坐标）
  const A: [number, number] = [640, 560], B: [number, number] = [930, 560], C: [number, number] = [1220, 560];
  // 4 枚金币：前 2 枚挪进货币基金，后 2 枚挪进指数基金
  const coins = [0, 1, 2, 3].map((k) => {
    const s = split(l2, l3, k < 2 ? 1 : 3, 6) + (k % 2) * 6;
    const p = interpolate(frame, [s, s + 14], [0, 1], clamp);
    const from: [number, number] = [A[0] - 45 + (k % 2) * 90, A[1] + 60 - Math.floor(k / 2) * 70];
    const to: [number, number] = [(k < 2 ? B : C)[0] - 40 + (k % 2) * 80, (k < 2 ? B : C)[1] + 60];
    return { x: from[0] + (to[0] - from[0]) * p, y: from[1] + (to[1] - from[1]) * p - Math.sin(p * Math.PI) * 160, moved: p >= 1, k };
  });
  const showJars = frame >= l1 && frame < l3;
  const fill = interpolate(frame, [l3 + 4, split(l3, dur, 1, 2)], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <RoadStrip n={3} lit={at(0) + 4} />
      <Sequence durationInFrames={l1}>
        <Pose name="point" x={300} h={600} at={0} />
        <BigSign n={3} at={at(0)} />
      </Sequence>
      <Sequence from={l1} durationInFrames={dur - l1}>
        <Pose name="piggy" x={260} h={560} at={0} />
      </Sequence>

      {showJars && (
        <>
          <Jar x={A[0]} y={A[1]} at={l1 + 2} label="活期" w={220} />
          <Jar x={B[0]} y={B[1]} at={l2} label="货币基金" w={220} hot />
          <Jar x={C[0]} y={C[1]} at={l2 + 6} label="指数基金" w={220} hot />
          {frame >= l1 + 6 && coins.map((c) => (
            <Img key={c.k} src={staticFile("assets/prop_coin.png")} style={coinStyle(c.x, c.y, frame, c.k, c.moved)} />
          ))}
          {/* 活期罐里的金币在打瞌睡 */}
          {frame < split(l2, l3, 1, 6) && frame >= l1 + 10 && [0, 1, 2].map((k) => {
            const t = ((frame - l1) / 30 + k / 3) % 1;
            return <div key={k} style={{ position: "absolute", left: A[0] + 40 + t * 70, top: A[1] - 40 - t * 120, opacity: 1 - t,
              fontFamily: FONT, fontWeight: 900, fontSize: 36 + k * 6, color: "#7b8da8" }}>z</div>;
          })}
          <Card x={930} y={300} at={split(l2, l3, 4, 6)} size={52}>让钱替你 <span style={{ color: ORANGE }}>干活</span></Card>
        </>
      )}

      {frame >= l3 && (
        <>
          <Jar x={700} y={540} at={l3} label="应急金" w={240} level={fill} hot={fill >= 1} />
          {fill >= 1 && (
            <div style={{ position: "absolute", left: 700 - 60, top: 300, fontFamily: FONT, fontWeight: 900, fontSize: 44, color: ORANGE }}>先装满</div>
          )}
          <Card x={1150} y={520} at={split(l3, dur, 1, 2) - 4} size={60} fill="#eee">借钱投</Card>
          <RedX x={1150} y={520} at={split(l3, dur, 3, 4)} size={260} />
        </>
      )}
    </AbsoluteFill>
  );
};
export default S08;
