#!/usr/bin/env node
/**
 * story-to-filmjson.mjs — 把六镜分镜表转成 code2video 的 film.json 骨架
 *
 * 输入：Markdown 表格，列顺序为「镜 | 时间 | 要解决的问题 | 画面要素 | 字幕原文」
 * 输出：film.json（幕结构），用于 B 轨（旁白版）
 *
 * 用法：
 *   node story-to-filmjson.mjs story.md --out films/demo/film.json \
 *        --title "反比例函数 k 的几何意义" --audience "九年级" --theme paper
 *
 * 说明：生成的是**骨架**。镜头类型先用 card（title/ask/end），要"演"的地方
 * 仍需人工改成 shot:free 并在 scene.js 写画面。
 */
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const get = (k, d) => {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  if (hit) return hit.split("=").slice(1).join("=");
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const file = argv.find((a) => !a.startsWith("--"));
if (!file || !fs.existsSync(file)) {
  console.error("[story] 用法：node story-to-filmjson.mjs <story.md> --out <film.json> …");
  process.exit(1);
}

const md = fs.readFileSync(file, "utf8");
const lines = md.split(/\r?\n/);

/** 解析第一个 Markdown 表格，返回行数组（跳过表头与分隔线） */
function parseTable(src) {
  const rows = [];
  let inTable = false;
  for (const raw of src) {
    const line = raw.trim();
    if (!line.startsWith("|")) {
      if (inTable && rows.length) break;
      continue;
    }
    inTable = true;
    const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (/^[-: ]+$/.test(cells[0].replace(/\|/g, ""))) continue; // 分隔线
    if (cells[0] === "镜" || cells[0] === "#") continue; // 表头
    if (!cells[0]) continue;
    rows.push(cells);
  }
  return rows;
}

const rows = parseTable(lines);
if (!rows.length) {
  console.error("[story] 没找到分镜表。需要一张「镜 | 时间 | 要解决的问题 | 画面要素 | 字幕原文」的 Markdown 表格。");
  process.exit(1);
}

/** 按中文句末标点切成一句一条（配音以句为单位） */
function toSentences(text) {
  return String(text || "")
    .split(/(?<=[。！？；])/)
    .map((s) => s.trim().replace(/[。！？；]$/, "").trim())
    .filter((s) => s.length > 0);
}

const title = get("title", path.basename(file, ".md"));
const subtitle = get("subtitle", "");
const audience = get("audience", "");
const theme = get("theme", "paper");

const scenes = [];
rows.forEach((cells, i) => {
  const [, time, problem, elements, caption] = cells;
  // 「10-30s」按区间算时长，「12s」按单值算
  const tm = String(time || "").match(/(\d+(?:\.\d+)?)\s*[-–~—]\s*(\d+(?:\.\d+)?)/);
  const dur = tm
    ? Math.max(1, Number(tm[2]) - Number(tm[1]))
    : Number(String(time || "").match(/(\d+(?:\.\d+)?)/)?.[1] || 12);
  const chips = String(elements || "")
    .split(/[、，,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  const lines = toSentences(caption);

  if (i === 0) {
    scenes.push({ shot: "card", type: "title", title, subtitle: subtitle || problem || "", dur });
  } else if (i === rows.length - 1) {
    scenes.push({
      shot: "card",
      type: "end",
      refs: [],
      notes: ["画面为代码渲染，非 AI 生成"],
      dur,
      lines,
    });
  } else {
    scenes.push({
      shot: "card",
      type: "ask",
      text: problem || "",
      chips,
      lines,
      dur,
    });
  }
});

const length = scenes.reduce((a, s) => a + (Number(s.dur) || 0), 0);
const film = {
  title,
  subtitle,
  form: "explain",
  audience,
  length,
  theme,
  voice: { narrator: "tingting", rate: 172, desc: "温和清楚的女老师，普通话，语速适中" },
  cast: {},
  derive: { textbook: "", assume: [] },
  refs: [],
  scenes,
};

const out = get("out", "");
if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(film, null, 2) + "\n", "utf8");
  console.log(`[story] 已写 ${out}：${scenes.length} 幕，合计 ${length}s`);
} else {
  console.log(JSON.stringify(film, null, 2));
}
console.log("[story] 这是骨架：card 的 title/ask/end 都能直接出画面；");
console.log("        需要「演」的幕改成 shot:free 并在 scene.js 里写画面，再跑 make.mjs <片> check。");
