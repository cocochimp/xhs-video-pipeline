import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Card, Pose, clamp, pop } from "../../../shared/ui";
import { Cart, Phone } from "./_kit";

/** 阿牛下班瘫着，外卖盒和购物车从手机里飘出来；头顶「意志力」电量一格格掉到红色；最后橙色「机制」亮起 */
const S05: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const barAt = at(0) + 6;
  // 第二句开始掉电，到第四句前掉到只剩 1 格
  const lost = Math.floor(interpolate(frame, [at(1), at(3) - 4], [0, 4], clamp));
  const left = 5 - lost;
  const col = left >= 4 ? "#22b14c" : left >= 2 ? ORANGE : "#e2352b";
  const phoneAt = at(1) + 6;
  const float = (s: number) => interpolate(frame, [s, s + 24], [0, 1], clamp);
  const fa = float(at(2)), fb = float(at(2) + 10);
  return (
    <AbsoluteFill>
      <Pose name="tired" x={330} h={620} at={0} />

      {/* 意志力电量条 */}
      {frame >= barAt && (
        <div style={{ position: "absolute", left: 330, top: 170, transform: `translate(-50%,-50%) scale(${pop(frame, barAt)})`, display: "flex",
          alignItems: "center", gap: 18, fontFamily: FONT, fontWeight: 900, fontSize: 44, color: INK }}>
          <span style={{ WebkitTextStroke: "8px #fff", paintOrder: "stroke fill" }}>意志力</span>
          <div style={{ display: "flex", gap: 6, padding: 8, border: `5px solid ${INK}`, borderRadius: 12, background: "#fff" }}>
            {[0, 1, 2, 3, 4].map((k) => (
              <div key={k} style={{ width: 34, height: 46, borderRadius: 5, background: k < left ? col : "#eee" }} />
            ))}
          </div>
          <div style={{ width: 12, height: 26, background: INK, borderRadius: 3, marginLeft: -14 }} />
        </div>
      )}

      <Phone x={800} y={680} at={phoneAt} w={200} h={320} tilt={-6}>
        <div style={{ fontSize: 34, color: ORANGE }}>下单？</div>
      </Phone>
      {frame >= at(2) && (
        <Img src={staticFile("assets/prop_takeout.png")} style={{ position: "absolute", left: 800 + 180 * fa - 100, top: 600 - 340 * fa - 100, height: 200,
          opacity: Math.min(1, fa * 3), transform: `scale(${0.4 + 0.6 * fa}) rotate(${-8 * fa}deg)`, filter: "drop-shadow(0 6px 8px rgba(0,0,0,.15))" }} />
      )}
      {frame >= at(2) + 10 && (
        <div style={{ position: "absolute", left: 800 + 400 * fb - 75, top: 600 - 230 * fb - 75, opacity: Math.min(1, fb * 3),
          transform: `scale(${0.4 + 0.6 * fb}) rotate(${10 * fb}deg)` }}>
          <Cart size={150} />
        </div>
      )}

      <Card x={1150} y={700} at={at(3)} size={96} fill={ORANGE} color="#fff">机制</Card>
      <Card x={1150} y={860} at={at(3) + 10} size={36}>不会累</Card>
    </AbsoluteFill>
  );
};
export default S05;
