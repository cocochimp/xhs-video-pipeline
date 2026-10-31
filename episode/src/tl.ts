import data from "../public/timeline.json";

type Seg = { start: number; duration: number };
type Key = "open" | "title" | "body" | "end";

export const T = data as unknown as {
  fps: number;
  duration: number;
  no: number;
  total: number;
  title: string;
  roll: { start: number; dur: number; topics: string[] };
  segs: Record<Key, Seg>;
  cl: Record<Key, number[]>;
  subs: { seg: string; zh: string; start: number; end: number }[];
};

export const FPS = T.fps;
export const f = (sec: number) => Math.round(sec * FPS);
/** 各段第 i 句开始的帧 */
export const O = (i: number) => f(T.cl.open[i]);
export const B = (i: number) => f(T.cl.body[i]);
export const E = (i: number) => f(T.cl.end[i]);
export const segStart = (k: Key) => f(T.segs[k].start);

export const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
export const INK = "#1f1f1f";
export const ORANGE = "#FF8A3D";
export const PAPER = "#FFFBF3";
