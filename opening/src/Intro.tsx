import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { FONT, FPS, INTRO_END, M, TITLE_START, f } from "./timeline";

const pop = (frame: number, at: number, damping = 11) =>
  spring({ frame: frame - at, fps: FPS, config: { damping, stiffness: 170, mass: 0.7 } });

/** 一个会弹出、可以从别处飞进来的贴纸 */
const Sticker: React.FC<{
  src: string; x: number; y: number; h: number; at: number; from?: [number, number];
  rot?: number; spin?: number; drift?: [number, number]; out?: number;
}> = ({ src, x, y, h, at, from, rot = 0, spin = 0, drift = [0, 0], out }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = pop(frame, at);
  const t = (frame - at) / FPS;
  const fx = from ? interpolate(p, [0, 1], [from[0], x]) : x;
  const fy = from ? interpolate(p, [0, 1], [from[1], y]) : y;
  const s = from ? 1 : p;
  const fade = out !== undefined ? interpolate(frame, [out, out + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <Img src={staticFile(src)} style={{
      position: "absolute", height: h, left: fx + drift[0] * t, top: fy + drift[1] * t,
      transform: `translate(-50%,-50%) scale(${s}) rotate(${rot + spin * t}deg)`, opacity: fade,
      filter: "drop-shadow(0 6px 8px rgba(0,0,0,.18))",
    }} />
  );
};

/** 片头：三个姿势切换 + 道具飞入 + 纸张炸开 + 红色发光大字 */
const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const scared = M("scared"), glow = M("glow"), read = M("read");
  const pose = frame < scared ? 1 : frame < read ? 2 : 3;
  const poseAt = pose === 1 ? 0 : pose === 2 ? scared : read;
  const ps = 0.82 + 0.18 * pop(frame, poseAt, 9);
  const breathe = 1 + 0.012 * Math.sin(frame / 6);
  const zoom = interpolate(frame, [0, f(INTRO_END)], [1, 1.07]);
  const shake = frame >= scared && frame < scared + 9 ? Math.sin(frame * 3.1) * 9 : 0;
  const papers = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    const r = 330 + (i % 3) * 70;
    return { src: i % 3 === 0 ? "prop_bill.png" : "prop_paper.png", x: 720 + Math.cos(a) * r * 1.25, y: 470 + Math.sin(a) * r * 0.8,
      rot: (i * 47) % 60 - 30, spin: (i % 2 ? 1 : -1) * (12 + i * 2), drift: [Math.cos(a) * 25, Math.sin(a) * 18 + 10] as [number, number] };
  });
  const glowP = pop(frame, glow, 14);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${shake}px)` }}>
      <Img src={staticFile("paper.png")} style={{ width: "100%", height: "100%" }} />
      {frame >= glow && (
        <div style={{ position: "absolute", inset: 0, opacity: glowP, transform: `scale(${interpolate(glowP, [0, 1], [1.6, 1])})` }}>
          {["管", "钱"].map((ch, i) => (
            <div key={ch} style={{ position: "absolute", top: 230, left: i ? 930 : 230, fontFamily: FONT, fontSize: 280, fontWeight: 900,
              color: "#ef3b2d", WebkitTextStroke: "6px #fff", paintOrder: "stroke fill",
              textShadow: "0 0 30px rgba(255,40,40,.85), 0 0 70px rgba(255,60,60,.6)" }}>{ch}</div>
          ))}
        </div>
      )}
      {papers.map((p, i) => (
        <Sticker key={i} {...p} h={150} at={scared + (i % 4)} from={[720, 520]} out={read} />
      ))}
      <Sticker src="prop_house.png" x={260} y={230} h={170} at={scared + 4} from={[260, -150]} rot={-8} out={read} />
      <Sticker src="prop_coin.png" x={420} y={430} h={110} at={f(0.5)} from={[-120, 380]} spin={40} />
      <Sticker src="prop_card.png" x={1040} y={420} h={120} at={f(0.8)} from={[1600, 360]} rot={14} out={read} />
      <div style={{ position: "absolute", left: 720, top: 960, transform: `translate(-50%,-100%) scale(${ps * breathe})`,
        transformOrigin: "50% 100%" }}>
        <Img src={staticFile(`pose_${pose}.png`)} style={{ height: pose === 3 ? 620 : 680, display: "block",
          filter: "drop-shadow(0 10px 12px rgba(0,0,0,.2))" }} />
      </div>
      <Sticker src="prop_bulb.png" x={1050} y={250} h={170} at={read + 5} rot={10} />
      <Sticker src="prop_growth.png" x={1110} y={640} h={190} at={read + 10} />
      <Sticker src="prop_book.png" x={330} y={660} h={150} at={read + 14} rot={-12} />
    </AbsoluteFill>
  );
};

/** 往期封面快闪 + 圆形放大转场 */
const Montage: React.FC = () => {
  const frame = useCurrentFrame();
  const start = f(INTRO_END), each = 6;
  const i = Math.min(5, Math.floor((frame - start) / each));
  const local = (frame - start) % each;
  return (
    <AbsoluteFill>
      <Img src={staticFile("paper.png")} style={{ width: "100%", height: "100%" }} />
      <Img src={staticFile(`cover_${i + 1}.png`)} style={{ position: "absolute", left: "50%", top: "50%", height: 860,
        transform: `translate(-50%,-50%) scale(${1 + local * 0.012})`, mixBlendMode: "multiply" }} />
    </AbsoluteFill>
  );
};

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const at = f(TITLE_START) - 8;
  const r = interpolate(frame, [at, at + 10], [0, 950], { extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [at, at + f(3.5)], [1.08, 1]);
  return (
    <AbsoluteFill style={{ clipPath: `circle(${r}px at 50% 50%)` }}>
      <Img src={staticFile("paper.png")} style={{ width: "100%", height: "100%" }} />
      <Img src={staticFile("title.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
        mixBlendMode: "multiply", transform: `scale(${zoom})` }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: r < 900 ? "inset 0 0 0 14px #1d2b4f" : "none",
        width: r * 2, height: r * 2, left: 720 - r, top: 540 - r }} />
    </AbsoluteFill>
  );
};

export const IntroPart: React.FC = () => {
  const frame = useCurrentFrame();
  const montageStart = f(INTRO_END);
  const titleAt = f(TITLE_START) - 8;
  return (
    <AbsoluteFill>
      {frame < montageStart ? <BrandIntro /> : <Montage />}
      {frame >= titleAt && <TitleCard />}
    </AbsoluteFill>
  );
};
