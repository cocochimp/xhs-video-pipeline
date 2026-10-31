import data from "../public/timeline.json";

export type Sub = { seg: string; zh: string; en: string; hl: string[]; chars: number[]; end: number };

export const T = data as {
  fps: number;
  duration: number;
  segments: Record<"intro" | "title" | "main", { start: number; duration: number }>;
  subs: Sub[];
  marks: Record<string, number>;
};

export const FPS = T.fps;
export const f = (sec: number) => Math.round(sec * FPS);
export const M = (key: string) => f(T.marks[key]);

export const INTRO_END = T.segments.intro.start + T.segments.intro.duration;
export const TITLE_START = T.segments.title.start;
export const MAIN_START = T.segments.main.start;

export const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
