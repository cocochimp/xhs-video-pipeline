/** 工作台后端：Vite 插件提供 /api/*。会改文件或花钱的任务串行执行（python -m studio.edit / studio.work / tools/render.py）。 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

type Kind = "edit" | "undo" | "render" | "text" | "gen" | "apply" | "cover" | "topics" | "fix";
type Job = { id: number; ep?: string; kind: Kind; scene?: string; arg?: string; state: "queued" | "running" | "done" | "error"; progress?: string; result?: unknown };

const SHARED_COMPONENTS = [
  ["Pose", "阿牛姿势入场"], ["Sticker", "贴纸弹出"], ["Card", "卡片滑入"], ["BigText", "大数字砸下来"],
  ["Check", "打勾"], ["Strike", "划掉"], ["TopBar", "顶部进度条 第x/100期"], ["Subtitles", "逐句字幕"],
];

export function studioApi(root: string): Plugin {
  const P = (...p: string[]) => path.join(root, ...p);
  const jobsFile = P("studio/jobs.json"), cfgFile = P("studio/config.json"), py = P(".venv/bin/python");
  const epDir = (id: string) => P("episodes", id);
  const readJson = (f: string, d: unknown = null) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
  const readEp = (id: string) => readJson(path.join(epDir(id), "episode.json"));
  const writeEp = (id: string, ep: unknown) => fs.writeFileSync(path.join(epDir(id), "episode.json"), JSON.stringify(ep, null, 2) + "\n");
  const patchEp = (id: string, kv: object) => writeEp(id, { ...readEp(id), ...kv });
  const setScene = (id: string, sid: string, kv: object) => {
    const ep = readEp(id);
    Object.assign(ep.scenes.find((s: { id: string }) => s.id === sid), kv);
    writeEp(id, ep);
  };
  const epIds = () => fs.readdirSync(P("episodes")).filter((d) => /^ep\d+$/.test(d) && fs.existsSync(path.join(epDir(d), "episode.json"))).sort();
  const config = () => readJson(cfgFile, {});
  const saveConfig = (c: object) => fs.writeFileSync(cfgFile, JSON.stringify(c, null, 2) + "\n");

  let jobs: Job[] = readJson(jobsFile, []);
  jobs.forEach((j) => j.state === "running" && (j.state = "queued")); // 重启后继续
  let busy = false;
  const save = () => fs.writeFileSync(jobsFile, JSON.stringify(jobs.slice(-200), null, 1));

  const pyRun = (args: string[], onErr?: (line: string) => void) =>
    new Promise<{ code: number; result: Record<string, unknown> }>((resolve) => {
      const p = spawn(py, args, { cwd: root });
      let out = "", err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => { err += d; const l = String(d).trim().split("\n").pop(); if (l && onErr) onErr(l); });
      p.on("close", (code) => {
        const last = out.trim().split("\n").pop() ?? "";
        let result: Record<string, unknown>;
        try { result = JSON.parse(last); } catch { result = { ok: false, error: (err || last).slice(-800) }; }
        resolve({ code: code ?? 1, result });
      });
    });

  const argsOf = (j: Job): string[] => {
    const ep = `episodes/${j.ep}`;
    if (j.kind === "render") return ["tools/render.py", ep, ...(j.arg ? [`--${j.arg}`] : [])];
    if (j.kind === "edit" || j.kind === "undo") return ["-m", "studio.edit", j.kind, ep, j.scene!, j.arg!];
    if (j.kind === "apply") return ["-m", "studio.work", "apply", j.arg!];
    if (j.kind === "topics") return ["-m", "studio.work", "topics", j.arg!];
    return ["-m", "studio.work", j.kind, ep, ...(j.arg ? [j.arg] : [])];
  };

  const run = async (j: Job) => {
    const { code, result } = await pyRun(argsOf(j), (l) => { j.progress = l; save(); });
    j.state = code === 0 ? "done" : "error";
    j.result = result;
    if (code !== 0 && j.scene) setScene(j.ep!, j.scene, { status: "error" });
    if (code === 0 && j.kind === "render" && !j.arg) patchEp(j.ep!, { stage: "done", doneAt: new Date().toISOString() });
  };

  const pump = async () => {
    if (busy) return;
    busy = true;
    for (let j; (j = jobs.find((x) => x.state === "queued")); ) {
      j.state = "running"; save();
      await run(j); save();
    }
    busy = false;
  };
  const enqueue = (j: Omit<Job, "id" | "state">) => { jobs.push({ ...j, id: Date.now() + Math.random(), state: "queued" }); save(); void pump(); };

  let usage: { at: number; data: unknown } = { at: 0, data: null };
  const usageSummary = () => {
    if (Date.now() - usage.at > 60_000) {
      try { usage = { at: Date.now(), data: JSON.parse(execFileSync(py, ["-m", "studio.ai"], { cwd: root, encoding: "utf8" })) }; } catch { /* 下次再查 */ }
    }
    return usage.data;
  };

  const topicsFile = P("studio/topics.json");
  type Topic = { id: string; title: string; angle?: string; fav?: boolean; cat: string; status: "ok" | "pending"; at: string };
  type TopicDb = { categories: { id: string; name: string; target?: number }[]; topics: Topic[] };
  const readTopics = (): TopicDb => readJson(topicsFile, { categories: [], topics: [] });
  const writeTopics = (db: TopicDb) => fs.writeFileSync(topicsFile, JSON.stringify(db, null, 1) + "\n");
  const topics = () => {
    const db = readTopics();
    const eps = new Map(epIds().map((id) => { const e = readEp(id); return [norm(e.title), e] as const; }));
    return { categories: db.categories, topics: db.topics.map((t) => { const e = eps.get(norm(t.title)); return { ...t, ep: e?.id, no: e?.no, stage: e?.stage }; }) };
  };
  const topicAction = (u: string[], data: Record<string, string>) => {
    const db = readTopics();
    const now = new Date().toISOString().slice(0, 19);
    const dup = (title: string, except?: string) => db.topics.some((t) => t.id !== except && norm(t.title) === norm(title));
    if (u[1] === "add") {
      const title = String(data.title ?? "").trim();
      if (!title) return { code: 400, body: { error: "选题不能为空" } };
      if (dup(title)) return { code: 409, body: { error: "选题库里已经有这个选题" } };
      const n = Math.max(0, ...db.topics.map((t) => +t.id.slice(1))) + 1;
      db.topics.push({ id: `t${String(n).padStart(3, "0")}`, title, angle: String(data.angle ?? "").trim() || undefined, cat: data.cat || db.categories[0]?.id, status: "ok", at: now });
    } else if (u[1] === "cat") {
      const name = String(data.name ?? "").trim();
      if (!name) return { code: 400, body: { error: "分类名不能为空" } };
      const c = db.categories.find((x) => x.id === data.id);
      if (c) c.name = name; else db.categories.push({ id: `c${Date.now().toString(36)}`, name });
    } else if (u[1] === "angles") {
      enqueue({ kind: "topics", arg: JSON.stringify({ angles: true }) });
      return { code: 200, body: { ok: true } };
    } else if (u[1] === "suggest") {
      enqueue({ kind: "topics", arg: JSON.stringify({ cat: data.cat ?? "", hint: data.hint ?? "" }) });
      return { code: 200, body: { ok: true } };
    } else {
      const t = db.topics.find((x) => x.id === u[1]);
      if (!t) return { code: 404, body: { error: "没有这个选题" } };
      const used = topics().topics.find((x) => x.id === t.id)?.ep;
      if (u[2] === "delete") {
        if (used) return { code: 409, body: { error: "这个选题已经做成作品了，不能删" } };
        db.topics = db.topics.filter((x) => x.id !== t.id);
      } else {
        if (data.title !== undefined) {
          const title = String(data.title).trim();
          if (!title) return { code: 400, body: { error: "选题不能为空" } };
          if (dup(title, t.id)) return { code: 409, body: { error: "选题库里已经有这个选题" } };
          if (used && title !== t.title) return { code: 409, body: { error: "已经做成作品的选题，到作品里改标题" } };
          t.title = title;
        }
        if (data.angle !== undefined) t.angle = String(data.angle).trim() || undefined;
        if (data.fav !== undefined) t.fav = Boolean(data.fav) || undefined;
        if (data.cat) t.cat = data.cat;
        if (data.status === "ok") t.status = "ok";
      }
    }
    writeTopics(db);
    return { code: 200, body: { ok: true } };
  };

  const library = () => {
    const c = config();
    const files = (dir: string, re: RegExp) => (fs.existsSync(P(dir)) ? fs.readdirSync(P(dir)).filter((f) => re.test(f)).sort() : []);
    const sfxUses: Record<string, number> = {};
    for (const id of epIds()) for (const s of readEp(id).scenes ?? []) for (const x of s.sfx ?? []) sfxUses[x.kind] = (sfxUses[x.kind] ?? 0) + 1;
    return {
      mix: { bgm: c.mix?.bgm ?? 1, sfx: c.mix?.sfx ?? {} }, voice: c.voice, voices: c.voices ?? [{ name: "温暖阿虎 2.0", speaker: c.voice?.speaker }], bgm: c.bgm ?? null,
      bgmFiles: files("assets/audio/bgm", /\.(mp3|wav|m4a)$/i),
      sfx: [["pop", "弹出"], ["stamp", "盖章"], ["tick", "滚动咔哒"], ["ding", "叮"]].map(([kind, name]) => ({ kind, name, uses: sfxUses[kind] ?? 0 })),
      poses: files("assets", /^pose_.+\.png$/), props: files("assets", /^prop_.+\.png$/),
      components: SHARED_COMPONENTS,
    };
  };

  const overview = () => ({
    episodes: epIds().map((id) => {
      const e = readEp(id);
      const scenes = e.scenes ?? [];
      return { id, no: e.no, title: e.title, stage: e.stage, cost: (e.cost?.tts ?? 0) + (e.cost?.image ?? 0), doneAt: e.doneAt,
        updated: fs.statSync(path.join(epDir(id), "episode.json")).mtimeMs, scenes: scenes.length,
        duration: readJson(path.join(epDir(id), "audio/timeline.json"), {}).duration ?? null,
        cover: e.cover ? `/covers/${id}/${e.cover}` : null, firstLine: e.scenes?.[2]?.lines?.[0]?.zh?.replace(/[【】]/g, "") ?? "",
        video: fs.existsSync(P("output", `${id}.mp4`)) };
    }),
    usage: usageSummary(),
  });

  const sendFile = (res: import("node:http").ServerResponse, file: string, range?: string) => {
    const size = fs.statSync(file).size;
    const m = range?.match(/bytes=(\d*)-(\d*)/);
    const start = m?.[1] ? +m[1] : 0, end = m?.[2] ? +m[2] : size - 1;
    res.writeHead(m ? 206 : 200, { "content-type": "video/mp4", "accept-ranges": "bytes", "content-length": end - start + 1,
      ...(m ? { "content-range": `bytes ${start}-${end}/${size}` } : {}) });
    fs.createReadStream(file, { start, end }).pipe(res);
  };

  let chatBusy = false;

  return {
    name: "studio-api",
    configureServer(server) {
      void pump();
      server.middlewares.use("/api", (req, res) => {
        const send = (code: number, body: unknown) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(body)); };
        const [url, qs] = (req.url ?? "").split("?");
        const u = url.split("/").filter(Boolean).map(decodeURIComponent);
        const q = new URLSearchParams(qs);
        const chunks: Buffer[] = [];
        req.on("data", (d: Buffer) => chunks.push(d));
        req.on("end", async () => {
          try {
            const raw = Buffer.concat(chunks);
            const GET = req.method === "GET", POST = req.method === "POST";
            if (POST && u[0] === "upload") { // 上传背景音乐：原始字节
              const name = path.basename(q.get("name") ?? "").replace(/[^\w.一-龥-]/g, "_");
              if (!/\.(mp3|wav|m4a)$/i.test(name)) return send(400, { error: "只支持 mp3 / wav / m4a" });
              fs.mkdirSync(P("assets/audio/bgm"), { recursive: true });
              fs.writeFileSync(P("assets/audio/bgm", name), raw);
              fs.mkdirSync(P("public/assets/audio/bgm"), { recursive: true });
              fs.copyFileSync(P("assets/audio/bgm", name), P("public/assets/audio/bgm", name));
              return send(200, { ok: true });
            }
            const data = raw.length ? JSON.parse(raw.toString()) : {};
            if (GET && u[0] === "overview") return send(200, overview());
            if (GET && u[0] === "jobs") return send(200, jobs.slice(-30));
            if (GET && u[0] === "library") return send(200, library());
            if (GET && u[0] === "topics") return send(200, topics());
            if (POST && u[0] === "topics") { const r = topicAction(u, data); return send(r.code, r.body); }
            if (GET && u[0] === "chat") return send(200, { busy: chatBusy, messages: readJson(P("studio/chat.json"), []) });
            if (GET && u[0] === "cover") { // 下载封面：统一叫 ep001.jpg
              const e = /^ep\d+$/.test(u[1] ?? "") ? readEp(u[1]) : null;
              const file = e?.cover ? path.join(epDir(u[1]), "covers", path.basename(e.cover)) : "";
              if (!file || !fs.existsSync(file)) return send(404, { error: "这一期还没选封面" });
              res.writeHead(200, { "content-type": "image/jpeg", "content-disposition": `attachment; filename="${u[1]}.jpg"` });
              return void fs.createReadStream(file).pipe(res);
            }
            if (GET && u[0] === "video") {
              const name = `${u[1]}.mp4`, file = P("output", name);
              if (!/^ep\d+$/.test(u[1] ?? "") || !fs.existsSync(file)) return send(404, { error: "还没有这个视频" });
              if (q.get("download")) res.setHeader("content-disposition", `attachment; filename="${u[1]}.mp4"`); // 下载统一叫 ep001.mp4
              return sendFile(res, file, req.headers.range);
            }
            if (POST && u[0] === "config") {
              const c = config();
              if (data.voice) c.voice = { ...c.voice, ...data.voice };
              if ("bgm" in data) c.bgm = data.bgm;
              if (data.mix) c.mix = { bgm: data.mix.bgm ?? c.mix?.bgm ?? 1, sfx: { ...(c.mix?.sfx ?? {}), ...(data.mix.sfx ?? {}) } };
              if (data.addVoice?.speaker) c.voices = [...(c.voices ?? library().voices), data.addVoice];
              saveConfig(c);
              return send(200, { ok: true });
            }
            if (POST && u[0] === "voice") {
              const { result } = await pyRun(["-m", "studio.work", "voice", data.speaker, String(data.rate ?? 0)]);
              return send(result.ok ? 200 : 500, result);
            }
            if (POST && u[0] === "chat") {
              if (u[1] === "new") { fs.rmSync(P("studio/chat.json"), { force: true }); return send(200, { ok: true }); }
              const last = [...readJson(P("studio/chat.json"), [])].reverse().find((m: { session?: string }) => m.session);
              if (u[1] === "apply") return last ? (enqueue({ kind: "apply", arg: last.session }), send(200, { ok: true })) : send(400, { error: "没有可执行的方案" });
              if (chatBusy) return send(409, { error: "AI 还在回答上一条" });
              chatBusy = true;
              void pyRun(["-m", "studio.work", "chat", last?.session ?? "-", data.page ?? "", data.msg]).finally(() => (chatBusy = false));
              return send(200, { ok: true });
            }
            if (u[0] !== "episodes") return send(404, { error: "unknown route" });
            if (POST && u.length === 1) { // 新建作品
              if (!data.title?.trim()) return send(400, { error: "选题不能为空" });
              const nos = epIds().map((id) => readEp(id).no);
              const no = Math.max(0, ...nos) + 1, id = `ep${String(no).padStart(3, "0")}`;
              fs.mkdirSync(epDir(id), { recursive: true });
              writeEp(id, { id, no, total: 100, stage: "text", title: data.title.trim(),
                segments: [{ id: "open", gap: 0.3 }, { id: "title", gap: 2.35 }, { id: "body", gap: 0.5 }, { id: "end", gap: 0.6 }],
                scenes: [], cost: { tts: 0, image: 0 } });
              enqueue({ ep: id, kind: "text" });
              return send(200, { id });
            }
            const [, id, act, sid, sact] = u;
            if (!id || !readEp(id)) return send(404, { error: "no episode" });
            if (GET && u.length === 2) return send(200, readEp(id));
            if (POST && act === "title") return patchEp(id, { title: String(data.title).trim() }), send(200, { ok: true });
            if (POST && act === "text") return enqueue({ ep: id, kind: "text", arg: data.issue?.trim() || undefined }), send(200, { ok: true });
            if (POST && act === "text-ok") return patchEp(id, { stage: "gen" }), enqueue({ ep: id, kind: "gen" }), send(200, { ok: true });
            if (POST && act === "gen") return enqueue({ ep: id, kind: "gen" }), send(200, { ok: true });
            if (POST && act === "reopen") return patchEp(id, { stage: "review" }), send(200, { ok: true });
            if (POST && act === "delete") {
              fs.mkdirSync(P("episodes/.trash"), { recursive: true });
              fs.renameSync(epDir(id), P("episodes/.trash", `${id}-${Date.now()}`));
              await pyRun(["-m", "studio.work", "register"]);
              return send(200, { ok: true });
            }
            if (POST && act === "approve-all") { // 在完整视频里直接整期通过：全部片通过并渲染成片，完成后进作品库
              const e = readEp(id);
              e.scenes.forEach((s: Record<string, unknown>) => Object.assign(s, { status: "approved", updated: false, voiceUpdated: false }));
              writeEp(id, e);
              return enqueue({ ep: id, kind: "render", arg: "" }), send(200, { ok: true });
            }
            if (POST && act === "fix") return enqueue({ ep: id, kind: "fix" }), send(200, { ok: true });
            if (POST && act === "covers") return enqueue({ ep: id, kind: "cover" }), send(200, { ok: true });
            if (POST && act === "cover") {
              const e = readEp(id);
              if (!(e.covers ?? []).some((c: { file: string }) => c.file === data.file)) return send(400, { error: "没有这张封面" });
              patchEp(id, { cover: data.file });
              if (fs.existsSync(P("output", `${id}.mp4`))) fs.copyFileSync(path.join(epDir(id), "covers", data.file), P("output", `${id}.jpg`)); // 已完结的同步换封面
              return send(200, { ok: true });
            }
            if (POST && act === "open") { // 在访达里打开 output/ 并选中这一期的视频
              const f = P("output", `${id}.mp4`);
              spawn("open", fs.existsSync(f) ? ["-R", f] : [P("output")]);
              return send(200, { ok: true });
            }
            if (POST && act === "render") return enqueue({ ep: id, kind: "render", arg: data.draft ? "draft" : "" }), send(200, { ok: true });
            if (POST && sact === "edit") {
              if (!data.issue?.trim()) return send(400, { error: "问题不能为空" });
              setScene(id, sid, { status: "queued" });
              return enqueue({ ep: id, kind: "edit", scene: sid, arg: data.issue.trim() }), send(200, { ok: true });
            }
            if (POST && sact === "undo") return setScene(id, sid, { status: "queued" }), enqueue({ ep: id, kind: "undo", scene: sid, arg: String(data.round) }), send(200, { ok: true });
            if (POST && sact === "approve") return setScene(id, sid, { status: "approved", updated: false, voiceUpdated: false }), send(200, { ok: true });
            send(404, { error: "unknown route" });
          } catch (e) { send(500, { error: String(e) }); }
        });
      });
    },
  };
}

const norm = (s: string) => s.replace(/[？?！!，,。.\s：:]/g, "");
