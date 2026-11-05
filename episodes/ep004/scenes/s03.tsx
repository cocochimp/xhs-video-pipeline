import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Pose, clamp, pop } from "../../../shared/ui";
import { Bubble, Phone } from "./_kit";

/** 日历月初写「这个月一定存」→ 翻到月底，手机余额跳成 0；阿牛捂脸，头顶冒「我就是存不住」 */
const S03: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const flip = at(1);
  // 翻页：前 6 帧压扁，后 6 帧展开
  const sy = frame < flip ? 1 : Math.abs(interpolate(frame, [flip, flip + 12], [1, -1], clamp));
  const end = frame >= flip + 6;
  const phoneAt = flip + 10;
  const zeroFrom = phoneAt + 12, zeroTo = zeroFrom + 14;
  const money = Math.round(interpolate(frame, [zeroFrom, zeroTo], [6800, 0], clamp));
  const faceAt = zeroTo;
  const cal = pop(frame, at(0) + 4);
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={faceAt}>
        <Pose name="ponder" x={360} h={620} at={0} />
      </Sequence>
      <Sequence from={faceAt} durationInFrames={dur - faceAt}>
        <Pose name="facepalm" x={360} h={620} at={0} />
      </Sequence>

      {/* 日历：月初 → 月底 */}
      {frame >= at(0) + 4 && (
        <div style={{ position: "absolute", left: 950, top: 300, width: 400, height: 330, transform: `translate(-50%,-50%) scale(${cal}) scaleY(${sy})`,
          background: "#fff", border: `5px solid ${INK}`, borderRadius: 22, boxShadow: `8px 8px 0 ${ORANGE}`, overflow: "hidden", fontFamily: FONT, fontWeight: 900 }}>
          <div style={{ height: 80, background: end ? "#8a8378" : ORANGE, borderBottom: `5px solid ${INK}`, color: "#fff", fontSize: 46,
            display: "flex", alignItems: "center", justifyContent: "center" }}>{end ? "月底" : "月初"}</div>
          <div style={{ fontSize: 120, color: INK, textAlign: "center", lineHeight: 1.1, marginTop: 6 }}>{end ? "30" : "1"}</div>
          <div style={{ fontSize: 40, color: end ? "#8a8378" : ORANGE, textAlign: "center" }}>
            {end ? <s>这个月一定存</s> : "这个月一定存！"}
          </div>
        </div>
      )}

      {/* 手机余额跳成 0 */}
      <Phone x={1230} y={680} at={phoneAt} w={250} h={400} tilt={4}>
        <div style={{ fontSize: 34 }}>余额</div>
        <div style={{ fontSize: money === 0 ? 110 : 64, color: money === 0 ? "#e2352b" : ORANGE, marginTop: 10 }}>¥{money}</div>
        {money === 0 && <div style={{ fontSize: 40, marginTop: 6, color: INK }}>又月光</div>}
      </Phone>

      <Bubble x={560} y={170} at={at(2)} size={60}>我就是存不住</Bubble>
    </AbsoluteFill>
  );
};
export default S03;
