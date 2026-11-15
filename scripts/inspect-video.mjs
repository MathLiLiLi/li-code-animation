#!/usr/bin/env node
/**
 * inspect-video.mjs — 成片参数核对（第 6 查）
 *
 * 用 ffprobe 读分辨率、帧率、总帧数、时长、码率、体积，按阈值判定 PASS/FAIL。
 * 90 秒 1080p 的经验基线：体积 15–25MB、码率 ≥1.5Mbps、2700 帧、时长 90.000000s。
 *
 * 用法：
 *   node inspect-video.mjs <file.mp4> [--expect-duration 90] [--min-bitrate 1.5]
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
if (!file || !fs.existsSync(file)) {
  console.error("[inspect] 用法：node inspect-video.mjs <file.mp4> [--expect-duration 90]");
  process.exit(1);
}
const expectDur = Number((argv.find((a) => a.startsWith("--expect-duration=")) || "").split("=")[1]) ||
  Number(argv[argv.indexOf("--expect-duration") + 1]) ||
  0;
const minBitrate = Number((argv.find((a) => a.startsWith("--min-bitrate=")) || "").split("=")[1]) ||
  Number(argv[argv.indexOf("--min-bitrate") + 1]) ||
  1.5;

function probe() {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries",
     "stream=width,height,r_frame_rate,nb_frames,duration,bit_rate:format=duration,size,bit_rate",
     "-of", "json", file],
    { encoding: "utf8" }
  );
  return JSON.parse(out);
}

let data;
try {
  data = probe();
} catch (e) {
  console.error("[inspect] ffprobe 调用失败。请确认 ffprobe 已安装（ffmpeg 通常自带）。");
  console.error(String(e.message || e).slice(0, 300));
  process.exit(1);
}

const s = (data.streams && data.streams[0]) || {};
const fmt = data.format || {};
const sizeBytes = Number(fmt.size || fs.statSync(file).size);
const sizeMB = sizeBytes / 1024 / 1024;

const fpsParts = String(s.r_frame_rate || "30/1").split("/");
const fps = Number(fpsParts[0]) / Number(fpsParts[1] || 1);
const duration = Number(fmt.duration || s.duration || 0);
const frames = Number(s.nb_frames || Math.round(duration * fps));
const bitrateKbps = Number(s.bit_rate || fmt.bit_rate || 0) / 1000;
const bitrateMbps = bitrateKbps / 1000;

const rows = [];
const push = (name, val, ok, note) => rows.push({ name, val, ok, note });

push("分辨率", `${s.width}×${s.height}`, s.width === 1920 && s.height === 1080, "要 1920×1080");
push("帧率", `${fps.toFixed(2)} fps`, Math.abs(fps - 30) < 0.05, "要 30");
push("总帧数", String(frames), frames > 0, "90s 片应为 2700");
push("时长", `${duration.toFixed(6)} s`, true, expectDur ? `应为 ${expectDur} s` : "—");
push(
  "视频码率",
  `${bitrateMbps.toFixed(2)} Mbps`,
  bitrateMbps >= minBitrate,
  `≥ ${minBitrate} Mbps；低于 1Mbps 深色细线必糊`
);
push("体积", `${sizeMB.toFixed(1)} MB`, true, "");

// 体积经验判据：每秒至少 0.11MB（90 秒 ≈ 10MB 下限）
const mbPerSec = duration > 0 ? sizeMB / duration : 0;
push(
  "每秒钟体积",
  `${mbPerSec.toFixed(2)} MB/s`,
  mbPerSec >= 0.11,
  "低于 0.11 说明压过头（90s < 10MB）"
);

let hardFail = false;
if (expectDur > 0 && Math.abs(duration - expectDur) > 0.05) {
  rows.push({
    name: "时长偏差",
    val: `${(duration - expectDur).toFixed(3)} s`,
    ok: false,
    note: "偏差超过 0.05s，帧率或时长算错了",
  });
}
if (expectDur > 0) {
  const expFrames = Math.round(expectDur * 30);
  if (Math.abs(frames - expFrames) > 2) {
    rows.push({
      name: "帧数偏差",
      val: `${frames} vs ${expFrames}`,
      ok: false,
      note: "有帧丢失或时长不对",
    });
  }
}

console.log(`\n===== 成片参数核对：${file} =====`);
for (const r of rows) {
  const mark = r.ok ? "PASS" : "FAIL";
  if (!r.ok) hardFail = true;
  console.log(`${mark}  ${r.name.padEnd(8, " ")} ${String(r.val).padEnd(18, " ")} ${r.note || ""}`);
}
console.log(
  hardFail
    ? "\n结论：不合格。回第 8 步重渲，并显式加 --video-bitrate 3M --quality delivery。\n"
    : "\n结论：参数全部达标。\n"
);
process.exit(hardFail ? 2 : 0);
