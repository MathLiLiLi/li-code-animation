#!/usr/bin/env bash
# env-check.sh — 开工前环境自检：缺什么、怎么装，一次说清
# 用法：bash <技能目录>/scripts/env-check.sh [项目根目录]
# 退出码：0 全部就绪；1 有阻塞项（必须先装）；2 只有警告（可继续，但效果打折）

set -u
PROJECT_DIR="${1:-$(pwd)}"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLOCK=0
WARN=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }
ok()    { green "  ✅ $1"; }
warn()  { yellow "  ⚠️  $1"; WARN=1; }
fail()  { red "  ❌ $1"; BLOCK=1; }

OS="$(uname -s)"
PKG_HINT="apt install"
if [ "$OS" = "Darwin" ]; then PKG_HINT="brew install"; fi
if [ "$OS" = "MINGW64_NT"* ] || [ "$OS" = "MSYS_NT"* ]; then PKG_HINT="choco install"; fi

echo "===== 1. 运行时 ====="
if command -v node >/dev/null 2>&1; then
  NODE_V="$(node -v | sed 's/v//')"
  MAJOR="${NODE_V%%.*}"
  if [ "$MAJOR" -ge 20 ] 2>/dev/null; then ok "Node $NODE_V（要求 ≥20）"; else
    fail "Node $NODE_V 版本过低"; echo "     安装：https://nodejs.org 下载 LTS 22+，Windows 安装时勾选 Add to PATH"
  fi
else
  fail "未安装 Node.js"; echo "     安装：https://nodejs.org（选 LTS 22 或更高）"
fi

if command -v npx >/dev/null 2>&1; then ok "npx $(npx -v)"; else fail "npx 不可用（通常随 Node 一起安装）"; fi

if command -v ffmpeg >/dev/null 2>&1; then
  ok "ffmpeg $(ffmpeg -version 2>/dev/null | head -1 | awk '{print $3}')"
else
  fail "未安装 FFmpeg（渲染与成片核验都需要）"
  echo "     macOS：$PKG_HINT ffmpeg"
  echo "     Ubuntu：sudo apt update && sudo apt install -y ffmpeg"
  echo "     Windows：choco install ffmpeg（或下载后把 bin 目录加入 PATH）"
fi

if command -v ffprobe >/dev/null 2>&1; then ok "ffprobe（用于成片核验）"; else warn "缺少 ffprobe（通常与 ffmpeg 同包安装）"; fi

echo
echo "===== 2. 渲染器（SVG/CSS/Canvas 都由它渲染，不需要另装绘图软件） ====="
BROWSER=""
for p in /usr/local/bin/chromium /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome \
         /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
         "$HOME/.cache/ms-playwright"; do
  if [ -e "$p" ]; then BROWSER="$p"; break; fi
done
if [ -n "$BROWSER" ]; then ok "找到浏览器：$BROWSER"; else
  warn "未找到 Chrome/Chromium（render 与视觉自检需要）"
  echo "     Linux：sudo apt install -y chromium-browser  或  npx playwright install chromium"
fi

if node -e "require.resolve('playwright-core')" >/dev/null 2>&1; then
  ok "playwright-core 已安装（视觉自检用）"
else
  warn "playwright-core 未安装（视觉自检用）"
  echo "     安装：npm i playwright-core      # 在项目根执行"
fi

echo
echo "===== 3. HyperFrames CLI ====="
echo "  说明：首次使用需联网下载，锁定版本 0.8.181（离线环境请改用示例工程直接渲染）"
if [ -d "$PROJECT_DIR" ]; then
  ( cd "$PROJECT_DIR" && timeout 180 npx -y hyperframes@0.8.181 doctor >/tmp/hf-doctor.log 2>&1 )
  if [ $? -eq 0 ]; then ok "hyperframes doctor 通过"; else
    warn "hyperframes doctor 未通过（可能是首次下载慢或网络受限）"
    echo "     查看日志：cat /tmp/hf-doctor.log | tail -20"
  fi
else
  warn "项目目录不存在：$PROJECT_DIR"
fi

echo
echo "===== 4. 中文字体 ====="
if command -v fc-list >/dev/null 2>&1; then
  CNT="$(fc-list :lang=zh 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$CNT" -gt 0 ] 2>/dev/null; then ok "中文字体 $CNT 款"; else
    fail "没有中文字体，成片会显示方块"
    echo "     Ubuntu：sudo apt install -y fonts-noto-cjk"
    echo "     macOS：系统自带，无需安装"
  fi
else
  warn "无 fc-list（Linux 请装 fontconfig；macOS 一般自带字体无需检查）"
fi

echo
echo "===== 5. 工程依赖文件 ====="
check_asset() {
  if [ -f "$1" ]; then ok "$2 存在"; else
    if [ "$3" = "must" ]; then fail "$2 缺失 → 从技能包复制：cp -r $SKILL_DIR/assets/* <项目>/assets/";
    elif [ "$3" = "opt" ]; then echo "  · $2 未装（复杂公式才需要）→ cp -r $SKILL_DIR/assets/katex <项目>/assets/";
    else warn "$2 缺失"; fi
  fi
}
check_asset "$PROJECT_DIR/assets/gsap.min.js" "assets/gsap.min.js" must
check_asset "$PROJECT_DIR/assets/katex/katex.min.js" "assets/katex/katex.min.js" opt
if [ -d "$PROJECT_DIR/assets/katex/fonts" ]; then
  FCNT="$(ls "$PROJECT_DIR/assets/katex/fonts" 2>/dev/null | wc -l | tr -d ' ')"
  ok "KaTeX 字体 $FCNT 个"; [ "$FCNT" -lt 40 ] && warn "KaTeX 字体数量异常（应为 60 个左右），公式可能变方块"
else
  echo "  · 未装 KaTeX（不影响简单公式；只用 .frac 手写分数时可以不管）"
fi

echo
echo "===== 6. 磁盘与权限 ====="
if [ -w "$PROJECT_DIR" ]; then ok "项目目录可写：$PROJECT_DIR"; else fail "项目目录不可写（检查授权）"; fi
AVAIL="$(df -Pk "$PROJECT_DIR" 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "$AVAIL" ] && [ "$AVAIL" -lt 500000 ] 2>/dev/null; then
  warn "可用空间不足 500MB（1080p 渲染会占用较多空间）"
else
  [ -n "$AVAIL" ] && ok "可用空间 $((AVAIL / 1024)) MB"
fi

echo
if [ "$BLOCK" -eq 1 ]; then
  red "结论：有阻塞项，先按上面的安装命令补齐，再开工。"
  exit 1
elif [ "$WARN" -eq 1 ]; then
  yellow "结论：可开工，但存在警告项（可能影响成片质量或自动化程度）。"
  exit 2
else
  green "结论：环境全部就绪，可以开工。"
  exit 0
fi
