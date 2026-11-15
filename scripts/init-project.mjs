#!/usr/bin/env node
/**
 * init-project.mjs — 一键建工程
 *
 * 从技能 assets/project-template/ 拷六个子组合，拷 GSAP，生成可 lint / 可渲染的
 * index.html（含 #root 外壳与 window.__timelines 注册），并生成 verify-seeks.json 骨架。
 *
 * 用法：
 *   node init-project.mjs --name k-geometry --title "反比例函数 k 的几何意义" [--scenes 6] [--out .]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "..");
const TPL = path.join(SKILL, "assets", "project-template");
const GSAP = path.join(SKILL, "assets", "gsap.min.js");

const argv = process.argv.slice(2);
const get = (k, d) => {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  if (hit) return hit.split("=").slice(1).join("=");
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const name = get("name");
const title = get("title", "数学知识动画");
const scenes = Number(get("scenes", 6));
const outRoot = path.resolve(get("out", "."));

if (!name) {
  console.error("[init] 必须给 --name <目录名>");
  process.exit(1);
}
if (!fs.existsSync(TPL)) {
  console.error(`[init] 模板缺失：${TPL}`);
  process.exit(1);
}

const dest = path.join(outRoot, name);
if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) {
  console.error(`[init] 目标已存在且非空：${dest}（不覆盖，换个 --name）`);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
fs.mkdirSync(path.join(dest, "assets"), { recursive: true });
fs.mkdirSync(path.join(dest, "compositions"), { recursive: true });

/* ---------- 1. 子组合 ---------- */
const compSrc = path.join(TPL, "compositions");
const allComps = fs.readdirSync(compSrc).filter((f) => f.endsWith(".html")).sort();
const kept = scenes >= allComps.length ? allComps : allComps.slice(0, Math.max(1, scenes));
for (const f of kept) fs.copyFileSync(path.join(compSrc, f), path.join(dest, "compositions", f));

/* ---------- 2. GSAP ---------- */
if (!fs.existsSync(GSAP)) {
  console.error(`[init] GSAP 缺失：${GSAP}`);
  process.exit(1);
}
fs.copyFileSync(GSAP, path.join(dest, "assets", "gsap.min.js"));

/* 2b. 字体（模板的 CSS 直接引 ../assets/fonts/，不拷就是全部 fallback） */
const FONTDIR = path.join(SKILL, "assets", "fonts");
if (fs.existsSync(FONTDIR)) {
  fs.cpSync(FONTDIR, path.join(dest, "assets", "fonts"), { recursive: true });
}

/* ---------- 2b. 字体（Inter，拉丁字母与数字专用） ---------- */
const FONTS = path.join(SKILL, "assets", "fonts");
if (fs.existsSync(FONTS)) {
  fs.cpSync(FONTS, path.join(dest, "assets", "fonts"), { recursive: true });
} else {
  console.error(`[init] 字体缺失：${FONTS}（字母数字会退回系统默认，建议补齐）`);
}

/* ---------- 3. index.html ---------- */
// 样式直接取自模板，保证与契约一致
const tplIndex = fs.readFileSync(path.join(TPL, "index.html"), "utf8");
const styleBlock = (tplIndex.match(/<style>[\s\S]*?<\/style>/) || [""])[0];

const DUR = [10, 20, 18, 15, 12, 15];
const CID = ["s1-hook", "s2-q1", "s3-other", "s4-triangle", "s5-table", "s6-outro"];
const NAMES6 = ["开场钩子", "第一步推导", "推广验证", "落推论", "纠错辨析", "收尾定格"];

let start = 0;
const mounts = kept
  .map((f, i) => {
    const d = DUR[i] ?? 12;
    const cid = CID[i] ?? `s${i + 1}-scene`;
    const nick = NAMES6[i] ?? `第${i + 1}镜`;
    const blk = `      <!-- 镜${i + 1}：${nick}｜${start}-${start + d}s -->
      <div
        id="s${i + 1}"
        data-composition-id="${cid}"
        data-composition-src="compositions/${f}"
        data-start="${start}"
        data-duration="${d}"
        data-track-index="${i}"
        data-width="1920"
        data-height="1080"
      ></div>`;
    start += d;
    return blk;
  })
  .join("\n\n");

const total = start;

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>${title}</title>
    <!-- GSAP 本地化：assets/gsap.min.js，禁止 CDN -->
    <script src="assets/gsap.min.js"></script>
${styleBlock}
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-width="1920"
      data-height="1080"
      data-duration="${total}"
    >
${mounts}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
fs.writeFileSync(path.join(dest, "index.html"), html, "utf8");

/* ---------- 4. verify-seeks ---------- */
const seeks = {};
kept.forEach((f, i) => {
  const d = DUR[i] ?? 12;
  seeks[f] = Number((d * 0.6).toFixed(1));
});
fs.writeFileSync(path.join(dest, "verify-seeks.json"), JSON.stringify(seeks, null, 2) + "\n", "utf8");

console.log(`[init] 已建工程：${dest}`);
console.log(`       子组合 ${kept.length} 个，总时长 ${total}s`);
console.log(`       下一步：`);
console.log(`       1) cd ${name} && npm i playwright-core`);
console.log(`       2) 按分镜改 compositions/*.html（坐标写死，曲线按函数采样）`);
console.log(`       3) npx -y hyperframes@0.8.181 lint`);
console.log(`       4) node ${path.join(SKILL, "scripts", "verify.mjs")} --browser=<chromium路径>`);
console.log(`       5) npx -y hyperframes@0.8.181 render --output out.mp4 --quality delivery --video-bitrate 3M`);
console.log(`       6) node ${path.join(SKILL, "scripts", "inspect-video.mjs")} out.mp4 --expect-duration ${total}`);
