import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Pose, Sticker, clamp, pop } from "../../../shared/ui";
import { Jar } from "./_kit";

const STEP_W = 210, STEP_L = 480, TOP0 = 880, RISE = 130;
const stepX = (k: number) => STEP_L + STEP_W * k + STEP_W / 2;
const stepTop = (k: number) => TOP0 - RISE * k;

/** 台阶从左下到右上，阿牛一级级往上跑；台阶上出现「涨薪」「奖金」，钱袋落下；每上一级，存钱罐比例往上跳 */
const S10: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const hops = [at(1), at(1) + Math.round((at(2) - at(1)) / 2), at(2) + 6];
  // 当前所在台阶（连续值，用于平滑移动）
  const pos = hops.reduce((acc, h) => acc + interpolate(frame, [h, h + 10], [0, 1], clamp), 0);
  const k0 = Math.floor(pos), t = pos - k0;
  const x = stepX(k0) + (k0 < 3 ? (stepX(k0 + 1) - stepX(k0)) * t : 0);
  const bottom = stepTop(k0) - (k0 < 3 ? RISE * t : 0) - 70 * Math.sin(t * Math.PI);
  const level = 0.25 + 0.15 * pos;
  const steps = Math.floor(pos + 0.5);
  return (
    <AbsoluteFill>
      {/* 台阶 */}
      {[0, 1, 2, 3].map((k) => (
        <div key={k} style={{ position: "absolute", left: STEP_L + STEP_W * k, top: stepTop(k), width: STEP_W, height: 960 - stepTop(k),
          background: k <= steps ? "#fff3e6" : "#fff", border: `5px solid ${INK}`, borderRadius: "10px 10px 0 0", boxSizing: "border-box",
          transform: `scaleY(${pop(frame, k * 3)})`, transformOrigin: "50% 100%" }} />
      ))}
      {[["涨薪", 1, at(1)], ["奖金", 2, hops[1]]].map(([label, k, s]) =>
        frame >= (s as number) ? (
          <div key={label as string} style={{ position: "absolute", left: stepX(k as number), top: stepTop(k as number) + 60, transform: `translateX(-50%) scale(${pop(frame, s as number)})`,
            fontFamily: FONT, fontWeight: 900, fontSize: 48, color: ORANGE, whiteSpace: "nowrap" }}>{label}</div>
        ) : null,
      )}
      <Sticker src="moneybag" x={1375} y={880} h={110} at={hops[1] + 6} />

      <Pose name="run" x={x} bottom={bottom} h={320} at={0} />

      {/* 存钱罐：比例一级级往上 */}
      <Jar x={250} y={420} at={at(0) + 2} label="存钱比例" w={200} level={level}>
        <span style={{ color: ORANGE }}>10%</span>
      </Jar>
      {[0, 1, 2].map((k) =>
        frame >= hops[k] + 4 ? (
          <div key={k} style={{ position: "absolute", left: 385, top: 450 - k * 70, transform: `translate(-50%,-50%) scale(${pop(frame, hops[k] + 4)})`,
            fontFamily: FONT, fontWeight: 900, fontSize: 64, color: "#22b14c", WebkitTextStroke: "8px #fff", paintOrder: "stroke fill" }}>↑</div>
        ) : null,
      )}

      <BigText x={800} y={180} at={at(3)} size={76}>不用天天<span style={{ color: ORANGE }}>咬牙</span></BigText>
    </AbsoluteFill>
  );
};
export default S10;
