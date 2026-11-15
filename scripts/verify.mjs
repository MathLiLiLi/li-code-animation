#!/usr/bin/env node
/**
 * verify.mjs — 六镜截图自检（HyperFrames 工程用，跨平台）
 *
 * 做四件事：
 *   1. 把 compositions/ 下每个子组合挂到 1920×1080 舞台
 *   2. 把 GSAP 时间线 seek 到该镜的代表秒数（verify-seeks.json 指定）
 *   3. 无头浏览器逐镜截图到 verify-shots/
 *   4. DOM 诊断：GSAP 是否加载、时间线是否注册、元素是否溢出、JS 报错；
 *      截图后用 ffmpeg 缩放为 1×1 灰图取平均亮度，判断黑屏/全白
 *
 * 用法（在工程根执行）：
 *   node verify.mjs [--browser=/usr/local/bin/chromium] [--seek=2.0] [--dark|--light]
 *
 * 退出码：0 全过；2 有镜失败。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const optBrowser = (args.find((a) => a.startsWith("--browser=")) || "").split("=")[1] || "";
const optSeek = Number((args.find((a) => a.startsWith("--seek=")) || "").split("=")[1]) || 2.0;
const mode = args.includes("--light") ? "light" : "dark";

const ROOT = process.cwd();
const COMP_DIR = path.join(ROOT, "compositions");
const OUT_DIR = path.join(ROOT, "verify-shots");
const TMP_DIR = path.join(ROOT, ".verify-tmp");

/** 依赖要从「工程目录」解析，而不是脚本所在目录 */
function loadChromium() {
  const roots = [path.join(ROOT, "package.json"), import.meta.url];
  for (const r of roots) {
    try {
      return createRequire(r)("playwright-core").chromium;
    } catch {
      /* 换下一个 */
    }
  }
  return null;
}

function findBrowser() {
  if (optBrowser && fs.existsSync(optBrowser)) return optBrowser;
  const cands = [
    "/usr/local/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  // playwright 自带的浏览器
  const pw = path.join(os.homedir(), ".cache", "ms-playwright");
  if (fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw)) {
      const p1 = path.join(pw, d, "chrome-linux", "chrome");
      const p2 = path.join(pw, d, "chrome-headless-shell-linux64", "chrome-headless-shell");
      if (fs.existsSync(p1)) return p1;
      if (fs.existsSync(p2)) return p2;
    }
  }
  return "";
}

/** 用 ffmpeg 把截图缩成 1×1 灰度，读那一个字节 = 平均亮度。失败返回 null。 */
function averageLuma(pngPath) {
  try {
    const buf = execFileSync(
      "ffmpeg",
      ["-v", "error", "-i", pngPath, "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
      { encoding: "buffer" }
    );
    if (buf && buf.length >= 1) return buf[0];
  } catch {
    /* 没装 ffmpeg 就跳过亮度诊断 */
  }
  return null;
}

function extractTemplate(file) {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/<template>([\s\S]*)<\/template>/);
  return m ? m[1] : null;
}

function buildHarness(name, inner, seek) {
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<script src="../assets/gsap.min.js"></script>
<script>window.__timelines={};</script>
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#070a12;}
#stage{position:relative;width:1920px;height:1080px;overflow:hidden;}</style>
</head><body><div id="stage">
${inner}
</div>
<script>
window.addEventListener('load',function(){
  setTimeout(function(){
    Object.keys(window.__timelines||{}).forEach(function(k){
      var tl=window.__timelines[k]; tl.pause(0); tl.seek(${seek});
    });
  },300);
});
</script></body></html>`;
  const fp = path.join(TMP_DIR, name.replace(/\.html$/, "") + ".verify.html");
  fs.writeFileSync(fp, html, "utf8");
  return fp;
}

(async () => {
  if (!fs.existsSync(COMP_DIR)) {
    console.error("[verify] 未找到 compositions/，请在工程根执行。");
    process.exit(1);
  }
  const chromium = loadChromium();
  if (!chromium) {
    console.error("[verify] 缺少 playwright-core，先执行：npm i playwright-core");
    process.exit(1);
  }
  const browserPath = findBrowser();
  if (!browserPath) {
    console.error("[verify] 未找到无头浏览器，用 --browser=<路径> 指定。");
    process.exit(1);
  }

  let seekMap = {};
  const seekFile = path.join(ROOT, "verify-seeks.json");
  if (fs.existsSync(seekFile)) seekMap = JSON.parse(fs.readFileSync(seekFile, "utf8"));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const files = fs.readdirSync(COMP_DIR).filter((f) => f.endsWith(".html")).sort();
  if (!files.length) {
    console.error("[verify] compositions/ 下没有子组合文件。");
    process.exit(1);
  }

  const browser = await chromium.launch({ executablePath: browserPath });
  const report = [];

  for (const f of files) {
    const inner = extractTemplate(path.join(COMP_DIR, f));
    if (!inner) {
      report.push({ file: f, ok: false, issues: ["未找到 <template> 块"] });
      continue;
    }
    const seek = seekMap[f] !== undefined ? seekMap[f] : optSeek;
    const harness = buildHarness(f, inner, seek);
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await page.goto("file://" + harness);
    await page.waitForTimeout(2500);

    const diag = await page.evaluate(() => {
      const issues = [];
      if (typeof window.gsap === "undefined")
        issues.push("GSAP 未加载（检查 assets/gsap.min.js）");
      const keys = Object.keys(window.__timelines || {});
      if (!keys.length) issues.push("window.__timelines 为空（时间线未注册）");
      const overflow = [];
      document.querySelectorAll("#stage *").forEach((el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        if (st.display === "none" || Number(st.opacity) === 0) return;
        if (r.width === 0 || r.height === 0) return;
        if (r.left < -1 || r.top < -1 || r.right > 1921 || r.bottom > 1081) {
          if (!el.hasAttribute("data-layout-allow-overflow"))
            overflow.push(
              (el.id ? "#" + el.id : "." + String(el.className).split(" ")[0]) +
                ` [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`
            );
        }
      });
      if (overflow.length) issues.push("元素溢出画布: " + overflow.slice(0, 5).join(" | "));
      return { issues, timelineKeys: keys };
    });

    const out = path.join(OUT_DIR, f.replace(/\.html$/, "") + ".png");
    await page.screenshot({ path: out });
    await page.close();

    const luma = averageLuma(out);
    if (luma !== null) {
      if (mode === "dark" && luma < 8) diag.issues.push(`平均亮度 ${luma}（<8，疑似黑屏）`);
      if (mode === "light" && luma > 250) diag.issues.push(`平均亮度 ${luma}（>250，疑似全白）`);
    }

    const issues = [...pageErrors.map((e) => "JS 错误: " + e), ...diag.issues];
    report.push({
      file: f,
      ok: issues.length === 0,
      issues,
      seek,
      luma,
      timelines: diag.timelineKeys,
      shot: path.relative(ROOT, out),
    });
  }

  await browser.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });

  console.log("\n===== 六镜截图自检 =====");
  for (const r of report) {
    if (r.ok) {
      console.log(
        `PASS  ${r.file}  seek=${r.seek}s  亮度=${r.luma ?? "n/a"}  timelines=[${r.timelines.join(",")}]  -> ${r.shot}`
      );
    } else {
      console.log(`FAIL  ${r.file}  (seek=${r.seek}s)`);
      r.issues.forEach((i) => console.log("      - " + i));
    }
  }
  const fails = report.filter((r) => !r.ok).length;
  console.log(`\n共 ${report.length} 镜，通过 ${report.length - fails}，失败 ${fails}。`);
  console.log("机器只判「没坏」，请逐张过目：最亮的是否强调项、字是否压图形、暗角是否吃掉图注、填充能否看出边界。\n");
  process.exit(fails ? 2 : 0);
})();
