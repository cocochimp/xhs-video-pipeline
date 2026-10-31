import { createContext, useContext } from "react";
import type { EpisodeJson, Timeline } from "./types";

export const EpisodeCtx = createContext<{ episode: EpisodeJson; timeline: Timeline } | null>(null);

export const useEp = () => {
  const v = useContext(EpisodeCtx);
  if (!v) throw new Error("useEp 只能在 <Episode> 里面使用");
  return v;
};
