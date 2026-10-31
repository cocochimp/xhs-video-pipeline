/** 审片网站后端：Vite 插件提供 /api/*，任务串行执行（调用 python -m studio.edit / tools/render.py）。 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

type Job = { id: number; ep: string; kind: "edit" | "undo" | "render"; scene?: string; arg?: string; state: "queued" | "running" | "done" | "error"; result?: unknown };

export function studioApi(root: string): Plugin {
  const jobsFile = path.join(root, "studio/jobs.json");
  const py = path.join(root, ".venv/bin/python");
  const epDir = (id: string) => path.join(root, "episodes", id);
  const readEp = (id: string) => JSON.parse(fs.readFileSync(path.join(epDir(id), "episode.json"), "utf8"));
  const writeEp = (id: string, ep: unknown) => fs.writeFileSync(path.join(epDir(id), "episode.json"), JSON.stringify(ep, null, 2) + "\n");
  const setScene = (id: string, sid: string, kv: object) => {
    const ep = readEp(id);
    Object.assign(ep.scenes.find((s: { id: string }) => s.id === sid), kv);
    writeEp(id, ep);
  };

  let jobs: Job[] = fs.existsSync(jobsFile) ? JSON.parse(fs.readFileSync(jobsFile, "utf8")) : [];
  jobs.forEach((j) => j.state === "running" && (j.state = "queued")); // 重启后继续
  let busy = false;
  const save = () => fs.writeFileSync(jobsFile, JSON.stringify(jobs.slice(-200), null, 1));

  const run = (j: Job) =>
    new Promise<void>((resolve) => {
      const args = j.kind === "render"
        ? ["tools/render.py", `episodes/${j.ep}`, ...(j.arg === "draft" ? ["--draft"] : [])]
        : ["-m", "studio.edit", j.kind, `episodes/${j.ep}`, j.scene!, j.arg!];
      const p = spawn(py, args, { cwd: root });
      let out = "", err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      p.on("close", (code) => {
        const last = out.trim().split("\n").pop() ?? "";
        j.state = code === 0 ? "done" : "error";
        try { j.result = JSON.parse(last); } catch { j.result = { output: last, error: err.slice(-800) }; }
        if (code !== 0 && j.scene) setScene(j.ep, j.scene, { status: "error" });
        resolve();
      });
    });

  const pump = async () => {
    if (busy) return;
    busy = true;
    for (let j; (j = jobs.find((x) => x.state === "queued")); ) {
      j.state = "running"; save();
      await run(j); save();
    }
    busy = false;
  };

  const enqueue = (j: Omit<Job, "id" | "state">) => {
    jobs.push({ ...j, id: Date.now(), state: "queued" });
    save(); void pump();
  };

  return {
    name: "studio-api",
    configureServer(server) {
      void pump();
      server.middlewares.use("/api", (req, res) => {
        const send = (code: number, body: unknown) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(body)); };
        let body = "";
        req.on("data", (d) => (body += d));
        req.on("end", () => {
          try {
            const data = body ? JSON.parse(body) : {};
            const u = (req.url ?? "").split("?")[0].split("/").filter(Boolean); // episodes/:id/...
            if (req.method === "GET" && u.length === 1 && u[0] === "episodes")
              return send(200, fs.readdirSync(path.join(root, "episodes")).filter((d) => /^ep\d+$/.test(d)).sort().map(readEp));
            if (req.method === "GET" && u.length === 1 && u[0] === "jobs") return send(200, jobs.slice(-30));
            const [, id, , sid, action] = u;
            if (!id || !fs.existsSync(path.join(epDir(id), "episode.json"))) return send(404, { error: "no episode" });
            if (req.method === "GET" && u.length === 2) return send(200, readEp(id));
            if (req.method === "POST" && u[2] === "render") return enqueue({ ep: id, kind: "render", arg: data.draft ? "draft" : "" }), send(200, { ok: true });
            if (req.method === "POST" && action === "edit") {
              if (!data.issue?.trim()) return send(400, { error: "issue 不能为空" });
              setScene(id, sid, { status: "queued" });
              return enqueue({ ep: id, kind: "edit", scene: sid, arg: data.issue.trim() }), send(200, { ok: true });
            }
            if (req.method === "POST" && action === "undo") return setScene(id, sid, { status: "queued" }), enqueue({ ep: id, kind: "undo", scene: sid, arg: String(data.round) }), send(200, { ok: true });
            if (req.method === "POST" && action === "approve") return setScene(id, sid, { status: "approved", updated: false, voiceUpdated: false }), send(200, { ok: true });
            send(404, { error: "unknown route" });
          } catch (e) { send(500, { error: String(e) }); }
        });
      });
    },
  };
}
