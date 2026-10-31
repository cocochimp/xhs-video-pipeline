import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useEp } from "../../../shared/context";
import { FONT, INK, ORANGE, f } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { Pose, pop } from "../../../shared/ui";

/** 固定开头：选题像老虎机一样滚动，先快后慢，停在本期选题 */
const S02: React.FC<SceneProps> = ({ from }) => {
  const frame = useCurrentFrame();
  const { timeline } = useEp();
  const roll = timeline.roll!;
  const topics = roll.topics;
  const n = topics.length;
  const s = f(roll.start) - from, d = f(roll.dur);
  const u = Math.min(1, Math.max(0, (frame - s) / d));
  const idx = (n - 1) * (1 - Math.pow(1 - u, 3)); // 缓出：与音效时间点同一条曲线
  const speed = frame >= s && u < 1 ? (3 * (n - 1) * Math.pow(1 - u, 2)) / d : 0; // 每帧滚过的卡片数
  const settled = frame >= s + d;
  const sp = settled ? pop(frame, s + d, 8) : 0;
  const CY = 470, GAP = 176;
  return (
    <AbsoluteFill>
      <Pose name="point" x={250} h={600} at={0} />
      <div style={{ position: "absolute", left: 440, top: 120, fontFamily: FONT, fontSize: 52, fontWeight: 900, color: INK }}>
        这一期聊<span style={{ color: ORANGE }}>：</span>
      </div>
      <div style={{ position: "absolute", left: 440, top: CY - 300, width: 940, height: 600, overflow: "hidden",
        maskImage: "linear-gradient(transparent, #000 22%, #000 78%, transparent)", WebkitMaskImage: "linear-gradient(transparent, #000 22%, #000 78%, transparent)" }}>
        {topics.map((t, k) => {
          const off = (k - idx) * GAP;
          if (Math.abs(off) > 420) return null;
          const final = k === n - 1;
          const far = Math.min(1, Math.abs(off) / 360);
          const scale = (1 - far * 0.12) * (final && settled ? 1 + 0.07 * Math.sin(Math.min(1, sp) * Math.PI) : 1);
          return (
            <div key={k} style={{ position: "absolute", left: 20, top: 300 + off - 66, width: 900, height: 132, borderRadius: 24,
              background: final && settled ? ORANGE : "#fff", border: `5px solid ${INK}`, boxShadow: `8px 8px 0 ${final && settled ? INK : ORANGE}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900,
              fontSize: t.length > 14 ? 44 : 52, color: final && settled ? "#fff" : INK, opacity: 1 - far * 0.6,
              transform: `scale(${scale})`, filter: `blur(${Math.min(5, speed * 9)}px)` }}>
              {t}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
export default S02;
