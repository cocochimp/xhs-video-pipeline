import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT, INK, ORANGE } from "../../../shared/theme";
import type { SceneProps } from "../../../shared/types";
import { BigText, Card, Pose, clamp } from "../../../shared/ui";
import { Toast } from "./_kit";

/** 深夜办公室，时钟十点，阿牛打字 → 手机弹出工资到账又清零，阿牛捂脸；「裁员」乌云飘来，「工资」细线被剪断 → 还能靠什么？ */
const S03: React.FC<SceneProps> = ({ at, dur }) => {
  const frame = useCurrentFrame();
  const l1 = at(1), l2 = at(2);
  // 到账金额：先 +8000，再快速清零
  const zeroAt = l1 + 26;
  const money = Math.round(interpolate(frame, [zeroAt, zeroAt + 14], [8000, 0], clamp));
  // 乌云从右上飘进来，飘到细线上方后剪断
  const cloudX = interpolate(frame, [l1 + 30, l1 + 55], [1600, 1110], clamp);
  const cut = l1 + Math.round((l2 - l1) * 0.72);
  const fall = interpolate(frame, [cut, cut + 18], [0, 1], clamp);
  return (
    <AbsoluteFill>
      {/* 深夜窗户 + 时钟 */}
      {frame < l2 && (
        <>
          <div style={{ position: "absolute", left: 80, top: 120, width: 420, height: 300, background: "#2b3150", border: `6px solid ${INK}`, borderRadius: 18 }}>
            <div style={{ position: "absolute", left: 300, top: 40, width: 70, height: 70, borderRadius: "50%", background: "#fff3c4", boxShadow: "-18px 0 0 0 #2b3150 inset" }} />
            {[[60, 70], [150, 150], [230, 60], [90, 220], [330, 210]].map(([x, y], k) => (
              <div key={k} style={{ position: "absolute", left: x, top: y, width: 8, height: 8, borderRadius: 4, background: "#fff", opacity: 0.5 + 0.5 * Math.sin(frame / 6 + k) }} />
            ))}
            <div style={{ position: "absolute", left: 6, right: 6, top: 140, height: 6, background: INK }} />
            <div style={{ position: "absolute", top: 6, bottom: 6, left: 205, width: 6, background: INK }} />
          </div>
          <svg width={200} height={200} viewBox="0 0 100 100" style={{ position: "absolute", left: 560, top: 140 }}>
            <circle cx="50" cy="50" r="44" fill="#fff" stroke={INK} strokeWidth="6" />
            {Array.from({ length: 12 }, (_, k) => (
              <line key={k} x1="50" y1="12" x2="50" y2="18" stroke={INK} strokeWidth="3" transform={`rotate(${k * 30} 50 50)`} />
            ))}
            {/* 十点：时针指向 10，分针指向 12 */}
            <line x1="50" y1="50" x2="50" y2="26" stroke={INK} strokeWidth="6" strokeLinecap="round" transform="rotate(-60 50 50)" />
            <line x1="50" y1="50" x2="50" y2="16" stroke={ORANGE} strokeWidth="4" strokeLinecap="round" />
            <circle cx="50" cy="50" r="5" fill={INK} />
          </svg>
          <div style={{ position: "absolute", left: 560, top: 345, width: 200, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 40, color: INK }}>22:00</div>
        </>
      )}

      <Sequence durationInFrames={l1}>
        <Pose name="type" x={360} h={560} at={0} />
        <Card x={1080} y={560} at={at(0) + Math.round((l1 - at(0)) * 0.55)} size={60}>只有 <span style={{ color: ORANGE }}>一份</span> 工资</Card>
      </Sequence>

      <Sequence from={l1} durationInFrames={l2 - l1}>
        <Pose name="facepalm" x={360} h={600} at={0} />
      </Sequence>
      {frame >= l1 && frame < l2 && (
        <>
          <Toast x={1000} y={470} at={l1 + 2} w={520} size={42}>
            工资到账 <span style={{ color: money ? ORANGE : "#e2352b" }}>{money ? `+${money}` : "余额 0"}</span>
          </Toast>
          {/* 「工资」细线吊着钱袋，被剪断后钱袋掉下去 */}
          <div style={{ position: "absolute", left: 1000, top: 560, width: 4, height: 120 - (fall > 0 ? 60 : 0), background: INK }} />
          {fall > 0 && <div style={{ position: "absolute", left: 1000, top: 620 + fall * 300, width: 4, height: 60, background: INK, opacity: 1 - fall }} />}
          <div style={{ position: "absolute", left: 1020, top: 590, fontFamily: FONT, fontWeight: 900, fontSize: 34, color: INK }}>工资</div>
          <Img src={staticFile("assets/prop_moneybag.png")} style={{ position: "absolute", left: 1002 - 70, top: 670 + fall * fall * 320, height: 150,
            opacity: 1 - fall * 0.8, transform: `rotate(${fall * 40}deg)` }} />
          {fall > 0 && <BigText x={1000} y={700} at={cut + 4} size={110} color="#e2352b" slam>归零</BigText>}
          {/* 裁员乌云 */}
          <div style={{ position: "absolute", left: cloudX - 170, top: 250, width: 340, height: 140, background: "#6f6f78", border: `5px solid ${INK}`,
            borderRadius: 80, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900, fontSize: 64, color: "#fff",
            transform: `translateY(${Math.sin(frame / 8) * 6}px)` }}>裁员</div>
        </>
      )}

      <Sequence from={l2} durationInFrames={dur - l2}>
        <Pose name="think" x={360} h={640} at={0} />
        <Card x={980} y={380} at={4} size={58}>除了打工</Card>
        <BigText x={980} y={580} at={16} size={110} color={ORANGE}>还能靠什么？</BigText>
      </Sequence>
    </AbsoluteFill>
  );
};
export default S03;
