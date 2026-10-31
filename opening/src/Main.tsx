import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { FONT, FPS, M, MAIN_START, f } from "./timeline";

const NAVY = "#13244a";
const pop = (frame: number, at: number, damping = 10) =>
  spring({ frame: frame - at, fps: FPS, config: { damping, stiffness: 180, mass: 0.6 } });
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const TABS = ["开场", "先存钱", "固定支出", "花销上限", "总结"];

const Blueprint: React.FC = () => (
  <AbsoluteFill style={{ background: NAVY }}>
    <div style={{ position: "absolute", left: 14, right: 14, top: 44, bottom: 14, borderRadius: 26, overflow: "hidden",
      background: "radial-gradient(circle at 50% 40%, #3d82ff 0%, #2163e8 60%, #1a50c4 100%)" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.22, backgroundImage:
        "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      {[[120, 820, 40], [1280, 760, 30], [1190, 170, 26], [210, 300, 22]].map(([x, y, s], i) => (
        <div key={i} style={{ position: "absolute", left: x, top: y, fontSize: s, color: "rgba(255,255,255,.35)" }}>☆</div>
      ))}
    </div>
    <div style={{ position: "absolute", top: 8, left: 22, display: "flex", gap: 10, fontFamily: FONT, fontSize: 18, fontWeight: 700 }}>
      {TABS.map((t, i) => (
        <div key={t} style={{ padding: "3px 14px", borderRadius: 8, color: i === 0 ? NAVY : "rgba(255,255,255,.6)",
          background: i === 0 ? "#ffd23f" : "rgba(255,255,255,.08)" }}>{t}</div>
      ))}
    </div>
  </AbsoluteFill>
);

/** 白色手绘感卡片：图标 + 文字，可选序号 */
const Card: React.FC<{ icon: string; label: string; n?: number; w: number; dim?: number; tilt?: number; red?: boolean }> = ({
  icon, label, n, w, dim = 0, tilt = 0, red,
}) => (
  <div style={{ width: w, height: w * 1.08, background: red ? "#fff3ef" : "#fff", borderRadius: w * 0.09,
    border: `${Math.max(3, w * 0.016)}px solid ${NAVY}`, boxShadow: `0 ${w * 0.03}px 0 ${NAVY}, 0 12px 24px rgba(0,0,0,.25)`,
    transform: `rotate(${tilt}deg)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: w * 0.04, fontFamily: FONT, opacity: 1 - dim * 0.55, filter: `saturate(${1 - dim * 0.8})`, position: "relative" }}>
    {n !== undefined && <div style={{ position: "absolute", top: w * 0.05, left: w * 0.07, fontSize: w * 0.14, fontWeight: 900,
      color: "#2163e8" }}>{n}</div>}
    <Img src={staticFile(icon)} style={{ height: w * 0.5 }} />
    <div style={{ fontSize: w * 0.105, fontWeight: 800, color: NAVY, textAlign: "center", padding: `0 ${w * 0.06}px` }}>{label}</div>
  </div>
);

const Check: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 7], [0, 1], clamp);
  return (
    <svg width="120" height="110" viewBox="0 0 120 110" style={{ position: "absolute", right: -26, top: -40 }}>
      <path d="M12 58 L44 90 L108 14" fill="none" stroke="#22b14c" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="160" strokeDashoffset={160 * (1 - p)} />
    </svg>
  );
};

const Stamp: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at, 12);
  return (
    <div style={{ position: "absolute", left: "50%", top: "46%", transform: `translate(-50%,-50%) rotate(-14deg) scale(${interpolate(p, [0, 1], [2.4, 1])})`,
      opacity: Math.min(1, p * 1.5), border: "8px solid #e2352b", borderRadius: 16, padding: "4px 22px", color: "#e2352b",
      fontFamily: FONT, fontSize: 92, fontWeight: 900, background: "rgba(255,255,255,.75)", letterSpacing: 4 }}>坑</div>
  );
};

/** 逐字打出的标题，指定的词带黄色马克笔底 */
const TypedTitle: React.FC<{ text: string; hl: string; at: number; prefix?: React.ReactNode }> = ({ text, hl, at, prefix }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - at) / 1.5)));
  const hi = text.indexOf(hl);
  const mark = interpolate(frame, [at + text.length * 1.5, at + text.length * 1.5 + 8], [0, 100], clamp);
  return (
    <div style={{ fontFamily: FONT, fontSize: 52, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 18 }}>
      {prefix}
      <span>
        {[...text].slice(0, n).map((ch, i) => (
          <span key={i} style={i >= hi && i < hi + hl.length ? {
            backgroundImage: "linear-gradient(transparent 55%, #ffd23f 55%)", backgroundSize: `${mark}% 100%`,
            backgroundRepeat: "no-repeat", color: "#fff" } : undefined}>{ch}</span>
        ))}
      </span>
    </div>
  );
};

const SLOTS = [270, 570, 870, 1170];

export const MainPart: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = pop(frame, f(MAIN_START), 16);
  const wallet = M("wallet"), spend = M("spend"), title3 = M("title3"), reverse = M("reverse"), trap = M("trap"), clear = M("clear");
  const cardAt = [M("c1"), M("c2"), M("c3")];

  // 工资卡：先在中间弹出，title3 时缩小飞到左上角
  const wp = pop(frame, wallet);
  const fly = interpolate(frame, [title3 - 4, title3 + 8], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const wx = interpolate(fly, [0, 1], [720, 110]), wy = interpolate(fly, [0, 1], [500, 130]);
  const ws = interpolate(fly, [0, 1], [1, 0.36]) * wp;

  const dim = interpolate(frame, [reverse, reverse + 8], [0, 1], clamp);
  const darken = interpolate(frame, [clear, clear + 8], [0, 1], clamp);
  const bigP = pop(frame, clear + 3, 12);

  return (
    <AbsoluteFill style={{ transform: `scale(${interpolate(enter, [0, 1], [1.08, 1])})`, opacity: Math.min(1, enter * 2) }}>
      <Blueprint />
      {frame >= wallet && (
        <div style={{ position: "absolute", left: wx, top: wy, transform: `translate(-50%,-50%) scale(${ws})` }}>
          <Card icon="prop_wallet.png" label="发工资" w={330} tilt={-3} />
        </div>
      )}
      {frame >= spend && frame < title3 && (
        <div style={{ position: "absolute", left: 1010, top: 380, transform: `scale(${pop(frame, spend)}) rotate(6deg)`,
          background: "#fff6b8", border: `4px solid ${NAVY}`, padding: "16px 26px", borderRadius: 10, fontFamily: FONT,
          fontSize: 40, fontWeight: 800, color: NAVY, boxShadow: "0 8px 16px rgba(0,0,0,.25)" }}>先花了再说？</div>
      )}
      {frame >= title3 && frame < reverse && (
        <div style={{ position: "absolute", left: 200, top: 100 }}>
          <TypedTitle text="至少有 3 件事要先做" hl="3" at={title3 + 6}
            prefix={<span style={{ fontSize: 60, fontWeight: 900, color: "#fff" }}>+</span>} />
        </div>
      )}
      {frame >= reverse && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", justifyContent: "center",
          opacity: interpolate(frame, [reverse, reverse + 6], [0, 1], clamp) }}>
          <TypedTitle text="大多数人，顺序做反了" hl="做反了" at={reverse} />
        </div>
      )}
      {[["prop_piggy.png", "先存钱"], ["prop_house.png", "留固定支出"], ["prop_tea.png", "花销定上限"]].map(([icon, label], i) => {
        const at = cardAt[i];
        if (frame < at) return null;
        const p = pop(frame, at);
        return (
          <div key={label} style={{ position: "absolute", left: SLOTS[i], top: 520, transform: `translate(-50%,-50%) scale(${p})` }}>
            <Card icon={icon} label={label} n={i + 1} w={250} tilt={[-3, 2, -2][i]} dim={dim * 0.6} />
            {frame >= reverse + 6 + i * 5 && <Check at={reverse + 6 + i * 5} />}
          </div>
        );
      })}
      {frame >= reverse + 4 && (
        <div style={{ position: "absolute", left: SLOTS[3], top: 520, transform: `translate(-50%,-50%) scale(${pop(frame, reverse + 4)})` }}>
          <Card icon="prop_calc.png" label="月底再存钱" w={250} tilt={3} red />
          <Stamp at={trap} />
        </div>
      )}
      <AbsoluteFill style={{ background: `rgba(8,18,45,${0.6 * darken})` }} />
      {frame >= clear + 3 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 400, textAlign: "center", fontFamily: FONT, fontSize: 130,
          fontWeight: 900, color: "#fff", WebkitTextStroke: `14px ${NAVY}`, paintOrder: "stroke fill",
          transform: `scale(${interpolate(bigP, [0, 1], [0.5, 1])}) rotate(-3deg)`, opacity: bigP }}>一次讲清楚</div>
      )}
    </AbsoluteFill>
  );
};
