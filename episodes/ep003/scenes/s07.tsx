import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, clamp } from "../../../shared/ui";
import { BigSign, RoadStrip, Wire, split } from "./_kit";

/** 路牌「③倒二手」亮起 → 旧耳机、旧书装箱发货 → 「数码」「书」「母婴」品类卡 → 左手收进、右手卖出，中间冒「差价」 */
const S07: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const l1 = at(1), lp = at(2), l2 = at(3), l3 = at(4);
  // 第二句：两件闲置先出现，再飞进纸箱；第三句：定价发货，纸箱滑走
  const into = (k: number) => interpolate(frame, [l1 + 24 + k * 10, l1 + 40 + k * 10], [0, 1], clamp);
  const ship = interpolate(frame, [split(lp, l2, 1, 2), split(lp, l2, 1, 2) + 16], [0, 1], clamp);
  const item = (src: string, k: number, x0: number, y0: number) => {
    if (frame < l1 + 4 + k * 8) return null;
    const p = into(k);
    if (p >= 1) return null;
    return <Img src={staticFile(`assets/prop_${src}.png`)} style={{ position: "absolute", left: x0 + (980 - x0) * p - 90, top: y0 + (640 - y0) * p - 90 - Math.sin(p * Math.PI) * 100,
      height: 180 * (1 - p * 0.5), filter: "drop-shadow(0 6px 8px rgba(0,0,0,.15))" }} />;
  };
  // 第五句：收进 → 卖出 → 差价
  const buy = l3 + 4, sell = split(l3, dur, 1, 3), gap = split(l3, dur, 2, 3);
  return (
    <AbsoluteFill>
      <RoadStrip n={2} lit={at(0) + 4} />
      <Sequence durationInFrames={l1}>
        <Pose name="point" x={300} h={600} at={0} />
        <BigSign n={2} at={at(0)} />
      </Sequence>

      <Sequence from={l1} durationInFrames={l2 - l1}>
        <Pose name="thumb" x={330} h={600} at={0} />
      </Sequence>
      {frame >= l1 && frame < l2 && (
        <>
          <Img src={staticFile("assets/prop_parcel.png")} style={{ position: "absolute", left: 980 - 130 + ship * 600, top: 640 - 110, height: 240,
            transform: `rotate(${ship * 8}deg)` }} />
          {item("headphones", 0, 760, 360)}
          {item("books", 1, 1180, 360)}
          <Card x={980} y={320} at={lp + 4} size={48}>怎么定价 · 怎么发货</Card>
        </>
      )}

      <Sequence from={l2} durationInFrames={dur - l2}>
        <Pose name="ponder" x={300} h={600} at={0} />
      </Sequence>
      {frame >= l2 && (
        <>
          {["数码", "书", "母婴"].map((t, k) => (
            <Card key={k} x={680 + k * 260} y={frame < l3 ? 500 : 340} at={split(l2, l3, 2 + k, 6)} size={60} tilt={k === 1 ? 0 : k ? 4 : -4}>{t}</Card>
          ))}
        </>
      )}
      {frame >= l3 && (
        <>
          <Card x={640} y={560} at={buy} size={48}>低价收 <span style={{ color: ORANGE }}>¥50</span></Card>
          <Card x={1220} y={560} at={sell} size={48}>合理卖 <span style={{ color: ORANGE }}>¥80</span></Card>
          <Wire a={[790, 560]} b={[1040, 560]} at={sell - 6} d={10} color={INK} width={8} dash />
          <BigText x={930} y={730} at={gap} size={110} color={ORANGE} slam>差价</BigText>
          <Card x={930} y={870} at={gap + 18} size={40}>赚的是懂行的钱</Card>
        </>
      )}
    </AbsoluteFill>
  );
};
export default S07;
