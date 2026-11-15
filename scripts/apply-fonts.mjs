#!/usr/bin/env node
/**
 * apply-fonts.mjs — 给已有工程补齐字体方案（三分角色）
 *
 * 把 Inter（拉丁标签/数字）、TeX Gyre Termes（数学符号衬线斜体）、
 * Noto Sans CJK SC（中文兜底）注入工程的每个 compositions/*.html。
 *
 * 用法：
 *   node apply-fonts.mjs --project <工程目录>
 *
 * 幂等：重复执行不会重复插入。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "..");
const FONTS = path.join(SKILL, "assets", "fonts");

const argv = process.argv.slice(2);
const get = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : null;
};
const project = get("project");
if (!project) {
  console.error("[fonts] 必须给 --project <工程目录>");
  process.exit(1);
}
const comps = path.join(path.resolve(project), "compositions");
if (!fs.existsSync(comps)) {
  console.error(`[fonts] 找不到 ${comps}`);
  process.exit(1);
}

/* ---------- 1. 拷字体 ---------- */
const destFonts = path.join(path.resolve(project), "assets", "fonts");
fs.mkdirSync(destFonts, { recursive: true });
for (const f of fs.readdirSync(FONTS)) {
  fs.copyFileSync(path.join(FONTS, f), path.join(destFonts, f));
}

/* ---------- 2. 声明与规则 ---------- */
const FACES = [
  '@font-face{font-family:"Inter";src:url("../assets/fonts/inter-400.woff2") format("woff2");font-weight:400;font-display:swap}',
  '@font-face{font-family:"Inter";src:url("../assets/fonts/inter-600.woff2") format("woff2");font-weight:600;font-display:swap}',
  '@font-face{font-family:"Inter";src:url("../assets/fonts/inter-700.woff2") format("woff2");font-weight:700;font-display:swap}',
  '@font-face{font-family:"Termes";src:url("../assets/fonts/termes-regular.otf") format("opentype");font-weight:400;font-style:normal;font-display:swap}',
  '@font-face{font-family:"Termes";src:url("../assets/fonts/termes-italic.otf") format("opentype");font-weight:400;font-style:italic;font-display:swap}',
  '@font-face{font-family:"Termes";src:url("../assets/fonts/termes-bolditalic.otf") format("opentype");font-weight:700;font-style:italic;font-display:swap}',
  '@font-face{font-family:"HanSans";src:local("Noto Sans CJK SC"),local("Source Han Sans SC"),local("PingFang SC"),local("Microsoft YaHei"),local("WenQuanYi Zen Hei")}',
].join("");

const RULES = `      /* 容器锁拉丁字体，中文走思源黑体 */
      .row, .cap, .tag, .note, .kicker, .same, .goal, .eqbox, .answer, .lbl, .cell, .head {
        font-family: "Inter", "HanSans", sans-serif;
      }
      /* 数学符号：教材同族衬线斜体（TeX Gyre Termes），比正文大 2px 补衬线的视觉收缩 */
      i, .row i, .cap i, .same i, .eq, .var, .eq i {
        font-family: "Termes", serif;
        font-style: italic;
        font-size: calc(1em + 2px);
      }
`;

/* ---------- 3. 逐文件改写 ---------- */
let changed = 0;
for (const name of fs.readdirSync(comps).filter((f) => f.endsWith(".html"))) {
  const fp = path.join(comps, name);
  let s = fs.readFileSync(fp, "utf8");
  const before = s;

  // 3a. head 里的 <style> 摘掉（取景 harness 不带 head）
  const hm = s.match(/<head>(.*?)<\/head>/s);
  if (hm) {
    const cleaned = hm[1].replace(/<style>.*?<\/style>\s*/gs, "");
    s = s.slice(0, hm.index) + "<head>" + cleaned + "</head>" + s.slice(hm.index + hm[0].length);
  }

  // 3b. template 内只保留第一个 style
  const tm = s.match(/<template>(.*?)<\/template>/s);
  if (!tm) continue;
  let body = tm[1];
  const styles = body.match(/<style>.*?<\/style>/gs) || [];
  if (!styles.length) continue;
  for (const extra of styles.slice(1)) body = body.replace(extra, "");

  let keep = styles[0];
  const hasFaces = keep.includes('@font-face{font-family:"Inter"');
  const hasRules = keep.includes("数学符号：教材同族衬线斜体");
  keep = keep.replace(
    "</style>",
    (hasFaces ? "" : "      " + FACES + "\n") + (hasRules ? "" : RULES) + "</style>"
  );
  body = body.replace(styles[0], keep);
  s = s.slice(0, tm.index) + "<template>" + body + "</template>" + s.slice(tm.index + tm[0].length);

  // 3c. 容器字体
  s = s.replace(/font-family:\s*system-ui\s*,\s*sans-serif/g, 'font-family: "Inter", "HanSans", sans-serif');
  s = s.replace(/font-family:\s*system-ui,\s*sans-serif/g, 'font-family: "Inter", "HanSans", sans-serif');

  // 3d. 文本节点里的变量包 <i>（纯 CSS 选择器管不到裸文本）
  const shields = [];
  const shield = /<i>.*?<\/i>|<style>.*?<\/style>|<svg.*?<\/svg>|<script>.*?<\/script>/gs;
  s = s.replace(shield, (m) => {
    shields.push(m);
    return `\u0000${shields.length - 1}\u0000`;
  });
  s = s.replace(/>([^<>]+)</g, (m, t) => {
    if (!/[xykS]/.test(t)) return m;
    const wrapped = t.replace(/(?<![A-Za-z\u0000])([xykS])(?![A-Za-z])/g, "<i>$1</i>");
    return `>${wrapped}<`;
  });
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => shields[Number(i)]);

  // 3e. SVG 属性：换成衬线，变量斜体
  s = s.replace(/font-family="system-ui, sans-serif"/g, 'font-family="\'Termes\', serif"');
  s = s.replace(/font-family="\'Inter\', sans-serif"/g, 'font-family="\'Termes\', serif"');
  s = s.replace(/(<text[^>]*?)>(x|y|k)<\/text>/g, (m, pre, ch) =>
    pre.includes("font-style") ? m : `${pre} font-style="italic">${ch}</text>`
  );

  if (s !== before) {
    fs.writeFileSync(fp, s, "utf8");
    changed++;
  }
}

console.log(`[fonts] 已处理 ${changed} 个子组合，字体拷到 ${destFonts}`);
console.log(`       下一步：lint → verify → 渲染`);
