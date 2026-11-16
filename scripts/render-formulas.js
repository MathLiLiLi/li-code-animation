#!/usr/bin/env node
/**
 * render-formulas.js — 把数学公式「构建期」预渲染成静态 HTML（确定性，不依赖运行时 JS）
 *
 * 为什么需要：视频渲染是逐帧截图的，如果公式靠页面加载后再用 JS 渲染，
 * 早期帧可能截到空白或字体回退的公式。构建期预渲染后，公式在 DOM 里就是静态字形，
 * 帧帧一致、可被 lint / 视觉自检稳定检出。
 *
 * 用法：
 *   node scripts/render-formulas.js formulas.json -o out/formulas.html
 *
 * formulas.json 格式：
 *   [
 *     { "id": "f1", "tex": "y=a(x-h)^2+k", "display": true,  "class": "formula-big" },
 *     { "id": "f2", "tex": "\\Delta=b^2-4ac", "display": false }
 *   ]
 *
 * 输出片段（可直接粘进 scene-*.html 的 <template> 内）：
 *   <div class="formula formula-big" id="f1" data-formula="y=a(x-h)^2+k">…KaTeX HTML…</div>
 *
 * 依赖：技能自带 assets/katex/katex.min.js（本地，禁止 CDN）
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith("-"));
const outIdx = args.indexOf("-o");
const output = outIdx > -1 ? args[outIdx + 1] : "";

if (!input) {
  console.error("用法: node scripts/render-formulas.js formulas.json -o out.html");
  process.exit(1);
}

const katexCandidates = [
  path.join(__dirname, "..", "assets", "katex", "katex.min.js"),
  path.join(process.cwd(), "assets", "katex", "katex.min.js"),
  path.join(process.cwd(), "node_modules", "katex", "dist", "katex.min.js")
];
const katexPath = katexCandidates.find(p => fs.existsSync(p));
if (!katexPath) {
  console.error("[render-formulas] 找不到 katex.min.js，请确认 assets/katex/katex.min.js 存在");
  process.exit(1);
}
const katex = require(katexPath);

const list = JSON.parse(fs.readFileSync(input, "utf8"));
if (!Array.isArray(list) || !list.length) {
  console.error("[render-formulas] JSON 必须是形如 [{id, tex, display}] 的非空数组");
  process.exit(1);
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let failed = 0;
const parts = list.map(item => {
  const tex = item.tex || "";
  let html;
  try {
    html = katex.renderToString(tex, {
      displayMode: item.display !== false,
      throwOnError: true,
      output: "html",
      strict: false
    });
  } catch (e) {
    failed += 1;
    console.error(`[render-formulas] 公式 #${item.id} 语法错误: ${e.message}\n  tex: ${tex}`);
    html = `<span class="formula-error">公式错误: ${esc(tex)}</span>`;
  }
  const cls = ["formula", item.class].filter(Boolean).join(" ");
  return `<div class="${cls}" id="${esc(item.id || "")}" data-formula="${esc(tex)}">${html}</div>`;
});

const wrapped = `<!-- 由 render-formulas.js 自动生成，请勿手改；改了 formulas.json 后重新生成 -->\n${parts.join("\n")}\n`;

if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, wrapped, "utf8");
  console.log(`[render-formulas] 已生成 ${list.length} 个公式 -> ${output}${failed ? `（其中 ${failed} 个报错）` : ""}`);
} else {
  process.stdout.write(wrapped);
}

process.exit(failed ? 2 : 0);
