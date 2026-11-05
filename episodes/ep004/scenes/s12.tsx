import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Check, Pose, Sticker, clamp, pop } from "../../../shared/ui";

/** 日历本周那格打勾；阿牛在电脑前打字，屏幕弹出「发薪日 · 自动转账 10%」，「确认」按下 */
const S12: React.FC<SceneProps> = ({ at }) => {
  const frame = useCurrentFrame();
  const dlgAt = at(1);
  const press = at(1) + Math.round((at(2) - at(1)) * 0.7);
  const btn = 1 - 0.12 * interpolate(frame, [press, press + 3, press + 8], [0, 1, 0], clamp);
  const done = frame >= press + 3;
  return (
    <AbsoluteFill>
      <Pose name="type" x={370} h={620} at={0} />
      <Sticker src="calendar" x={1130} y={290} h={290} at={at(0) + 2} />
      <Check x={1130} y={310} at={at(0) + 16} size={130} />
      {frame >= at(0) + 16 && (
        <div style={{ position: "absolute", left: 1130, top: 470, transform: `translate(-50%,0) scale(${pop(frame, at(0) + 16)})`, fontFamily: FONT,
          fontWeight: 900, fontSize: 40, color: INK, WebkitTextStroke: "8px #fff", paintOrder: "stroke fill", whiteSpace: "nowrap" }}>这周</div>
      )}

      {/* 弹窗 */}
      {frame >= dlgAt && (
        <div style={{ position: "absolute", left: 930, top: 700, width: 560, transform: `translate(-50%,-50%) scale(${pop(frame, dlgAt)})`,
          background: "#fff", border: `5px solid ${INK}`, borderRadius: 24, boxShadow: `8px 8px 0 ${ORANGE}`, overflow: "hidden", fontFamily: FONT, fontWeight: 900 }}>
          <div style={{ background: ORANGE, color: "#fff", fontSize: 36, padding: "10px 0", textAlign: "center", borderBottom: `5px solid ${INK}` }}>手机银行</div>
          <div style={{ fontSize: 44, color: INK, textAlign: "center", padding: "22px 0 14px" }}>
            发薪日 · 自动转账 <span style={{ color: ORANGE }}>10%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 22 }}>
            <div style={{ transform: `scale(${btn})`, background: done ? "#22b14c" : INK, color: "#fff", fontSize: 40, padding: "10px 60px", borderRadius: 16 }}>
              {done ? "已设置 ✓" : "确认"}
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
export default S12;
