# Li 的代码动画技能 / li-code-animation

> 用代码做初中数学知识短视频。HTML/CSS/SVG 写死坐标，GSAP 编排动作，无头 Chromium 逐帧截图，FFmpeg 合成 MP4 —— 16:9、1920×1080、可逐帧复现。

作者：李培泽（吉林市初中数学教师）

当前版本 **v2.1.0**（坐标轴箭头加大、分数对齐规范、BGM 与音效共存、技能自更新）

## 它能做什么

- 函数图像（反比例函数、二次函数、指数对数）
- 几何作图与辅助线推演
- 公式推导、概念辨析、易错题纠错
- 90 秒一支的微课，六镜骨架，逐镜可改

## 为什么用代码而不是剪辑软件

| | 视频剪辑 | 本技能 |
|---|---|---|
| 改一个数字 | 重剪整段 | 改一行代码，重渲 |
| 元素位置 | 手动拖拽，难对齐 | 坐标写死，绝对精确 |
| 版本管理 | 二进制工程文件 | 纯文本，可 git diff |
| 批量出片 | 一条条做 | 换参数批量生成 |

## 快速开始

```bash
# 1. 建工程（需要 Node 20+）
node scripts/init-project.mjs --name my-film --title "反比例函数 k 的几何意义"

# 2. 装依赖
cd my-film && npm i playwright-core

# 3. 改分镜（compositions/*.html，坐标写死，曲线按函数采样）

# 4. 结构合规
npx -y hyperframes@0.8.181 lint      # 要 0 errors 0 warnings

# 5. 逐镜截图自检
node scripts/verify.mjs --browser=<chromium 路径>

# 6. 渲染：先出预览（约 1.8Mbps）
npx -y hyperframes@0.8.181 render -o out.mp4 --quality delivery --video-bitrate 3M

#    要交付清晰版：渲 PNG 序列，再自己编 CBR 4M（`--video-bitrate` 实测不生效）
npx -y hyperframes@0.8.181 render --format png-sequence --output pngseq
ffmpeg -framerate 30 -i pngseq/frame_%06d.png \
  -c:v libx264 -b:v 4M -minrate 4M -maxrate 4M -bufsize 8M -preset slow -tune animation \
  -x264-params "nal-hrd=cbr:aq-mode=3:chroma-qp-offset=-2" \
  -pix_fmt yuv420p -movflags +faststart out.mp4

# 7. 成片参数核对
node scripts/inspect-video.mjs out.mp4 --expect-duration 90
```

## 目录结构

```
li-code-animation/
├── SKILL.md                  # 主文件：十步流程、六镜骨架、口径七条、六道自检
├── VERSION                   # 版本号（自更新比对用）
├── agents/{doubao,openai}.yaml
├── assets/
│   ├── gsap.min.js           # GSAP 本地副本（禁止 CDN）
│   ├── fonts/                # Inter + TeX Gyre Termes
│   ├── project-template/     # 六镜工程模板（已含坐标轴正方向箭头）
│   └── sfx-events.example.json
├── references/               # pipeline / math-rules / visuals / prompts
│                             # revisions / qa / two-tracks
└── scripts/
    ├── init-project.mjs      # 一键建工程
    ├── apply-fonts.mjs       # 给旧工程补字体
    ├── verify.mjs            # 逐镜截图自检
    ├── story-to-filmjson.mjs
    ├── inspect-video.mjs     # 成片参数核对
    ├── make-sfx.py           # 点状音效
    ├── mix-audio.py          # 音效 + 用户指定 BGM 混音（自动算音量）
    └── self-update.py        # 检查/应用新版本
```

## 字体

| 角色 | 字体 | 为什么 |
|---|---|---|
| 中文 | Noto Sans CJK SC（思源黑体） | 系统 sans-serif 默认会落到文泉驿正黑，字形旧 |
| 拉丁标签、数字 | Inter | 屏幕阅读字体，数字区分度高 |
| 数学符号与变量 | **TeX Gyre Termes 衬线斜体** | 与 Times 同族，和教材上的字母形态一致 |

变量斜体、数字正体，是课本的排版规矩。正文里的裸变量必须包 `<i>`，纯 CSS 选择器管不到。`@font-face` 要写在 `<template>` 内的 `<style>`，放 `<head>` 会被取景 harness 丢掉。

## 必装软件

| 软件 | 用途 | 检查 |
|---|---|---|
| Node.js 20+ | 跑脚本、渲染 | `node -v` |
| Chromium / Chrome | 逐帧截图 | `which chromium` |
| FFmpeg | 合成 MP4、加音效 | `ffmpeg -version` |
| Python 3 | 生成点状音效 | `python3 -V` |

## 六个必踩的坑

1. **GSAP 不能用 CDN** —— 断网即黑屏。
2. **别试 4K** —— 软件 GPU 下 2700 帧要一小时以上。
3. **页面内嵌预览会糊** —— 不是片子的问题，下载到本地看。
4. **26px 以下等于没写** —— 手机小窗缩到 390px 宽时只剩 5px。
5. **坐标轴箭头 `markerWidth` 用 10** —— 写 6 只有 12～15px，1920 画布上等于没画。
6. **改完必须重跑自检** —— 坐标字号跑 1/2/3 查，文案跑第 5 查。

## 自动更新

往仓库推一次源码，GitHub Actions 会自动重打 `li-code-animation.zip` 并刷新 `version.json`，下载地址固定不变。

```bash
python3 scripts/self-update.py --check   # 看看有没有新版
python3 scripts/self-update.py --apply   # 有就下载覆盖，原目录先备份
```

断网、包校验不过都只跳过，不影响正常出片；新版本在下个会话生效。

## 许可证

MIT License，见 [LICENSE](LICENSE)。老师学生拿去改、拿去用，不用打招呼。
