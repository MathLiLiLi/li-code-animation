---
name: li-code-animation
display_name: "Li的代码动画技能"
description: 用代码做初中数学知识短视频（函数图像、几何作图、公式推导、概念辨析），16:9 MP4，画面由 HTML/CSS/SVG 写死坐标、GSAP 编排动作、无头 Chromium 逐帧截图、FFmpeg 编码，默认无旁白只画面加字幕、默认深夜光轨深色风、六镜结构、交付前必过六道自检。当用户要做数学微课/知识动画/讲解短片，要改已有代码动画工程的某一镜或某一秒，要换主题重做同款，要复渲、要加码率、要打工程包时使用。不用于数字人口播、实拍剪辑、纯配音课、只要一张图或一份课件。
---

# Li的代码动画技能

**一句话定位**：把数学课上一个"说不清"的地方，做成一支 90 秒、能反复暂停看、公式永远排得正的代码动画片。

核心技术链固定为四步，不用 AI 生成画面：**HTML/CSS/SVG 定画面 → GSAP 排时间线 → 无头 Chromium 逐帧截图 → FFmpeg 编成 H.264 MP4**。HyperFrames 只做工程契约与调度，它不生产任何一帧——**它是台印刷机，稿子得你自己写**。

## 前置条件（开工前先查，缺项不要往下走）

在项目根执行 `npx -y hyperframes@0.8.181 doctor`，下列四项全绿才继续。

| 软件 | 版本 | 用途 | 缺了会怎样 | 怎么补（Linux/云电脑） |
|---|---|---|---|---|
| Node.js | ≥22 | 跑 CLI 与脚本 | 全流程起不来 | `nvm install 22` |
| FFmpeg **和 ffprobe** | 4.x | 编码、抽帧、参数核对 | 只有 ffmpeg 没有 ffprobe，导出与核对都会失败 | `apt install ffmpeg`（自带 ffprobe），不要用第三方包管理器装，容易只装半个 |
| Chromium / Chrome 无头 | 近两年版本 | 逐帧取景 | 出不了图 | `apt install chromium`，云电脑一般在 `/usr/local/bin/chromium` |
| GSAP | 3.x **本地文件** | 时间线与补间 | 引用 CDN 会静默黑屏，无报错 | 从本技能 `assets/gsap.min.js` 拷进工程 `assets/` |

自检另需三样（缺了只是自检打折，不影响出片）：

| 工具 | 用途 | 缺了怎么办 |
|---|---|---|
| playwright-core | 六镜自动截图 | `npm i playwright-core` |
| ffmpeg 的 scale 滤镜 | 截图亮度诊断 | 自动降级为只做 DOM 诊断 |
| zip | 打源码包 | 改用 tar.gz，并在交付说明里写明 |

**五个必踩的坑**

1. `ffmpeg` 与 `ffprobe` 必须同时存在，很多系统只装了前者。
2. 不要用 winget / 便携包混装，PATH 里指向的版本会对不上。
3. GSAP 一律本地文件，**禁止 CDN**；CDN 断连的表现是全片黑屏而不是报错。
4. 浏览器在**软件渲染**下跑（日志出现 `BeginFrame did not run` 是正常的），不用折腾显卡。
5. **渲染默认码率只有约 500 kbps**，1080p 正常应 3–8 Mbps。不显式指定码率，深色细线必糊。见第六节。

## 路线选择：默认走 A，需要旁白或复杂画面才走 B

| | A 轨 · 纯图形（默认） | B 轨 · 旁白/复杂画面 |
|---|---|---|
| 适合 | 函数图像、几何、公式推导、概念辨析 | 要旁白讲解、要手/角色/地图/3D、要配乐成片 |
| 画面 | 本技能六镜 HTML+SVG，坐标写死 | 调用 `code2video` 技能：film.json 剧本 + 积木库 |
| 声音 | 默认无旁白，字幕即画面文字；BGM 用户后期自配 | TTS 旁白 + 配乐 + 响度对齐 |
| 命令 | `npx hyperframes@0.8.181 render` | `node $C/tools/make.mjs <片目录> film` |
| 何时改道 | 用户明确要"有讲解声/要配音/要有旁白"，或画面需要真人动作、地图、角色 | 用户只要画面和字 |

B 轨的能力**继承但不复制**：不把 `code2video` 的 engine/kits/presets 搬进本技能（约 20MB，且会造成两个技能各自升级后版本漂移），改为调用它已安装的那份。桥接细节见 [references/two-tracks.md](references/two-tracks.md)。**分镜脚本两轨通用**，A 轨分镜可转成 B 轨的 `film.json`（`scripts/story-to-filmjson.mjs`）。

## 收到任务后执行流程

### 0 · 环境自检

```bash
npx -y hyperframes@0.8.181 doctor
ls assets/gsap.min.js
```

缺项时给出安装命令并**暂停等用户装好**，不要假装能跑。

### 1 · 追问补全（用户通常只给一句话）

老师开口多是二十个字："用代码做个视频，讲虚数，x²=-4 到底有没有这样的 x。"**剩下的规格由你补齐**，只问四问，每问给现成选项：

| 问 | 为什么必须问 | 建议默认 |
|---|---|---|
| 口径停在哪 | 决定数学结论对不对，是全片唯一会"讲错"的地方 | 停在不需要新概念的那一步 |
| 时长与段落 | 决定切几镜 | 90 秒六镜 |
| 分镜谁来定 | 用户可能已有板书顺序 | 你写，先给他看 |
| 受众年级 | 决定深度与用词 | 按主题所处学段 |

**画风不问**：默认深夜光轨深色风（用户已锁定）。除非用户指定白底。

用户说"你看着办"时，把默认值写成一句话回给他（"按深色、90 秒、六镜、只到这一步做，不对就喊停"），他只需点头。

### 2 · 出六镜分镜，等用户点头

按第三节骨架写一张分镜表：镜号、时长、画面要素、字幕原文、该镜要解决的一个问题。**只给分镜，不写代码**。用户说"可以"再进第 3 步。此步返工成本最低，务必等确认。

### 3 · 建工程

```bash
node <技能目录>/scripts/init-project.mjs --name <工程目录> --title "<片名>" --scenes 6
```

脚本会：拷 `assets/project-template/` 的六镜骨架与 index.html、拷 GSAP、生成 `verify-seeks.json` 骨架。**不用手工 `npx hyperframes init`**，模板已符合契约。

模板内容就是"反比例 k 的几何意义"那支的完整六镜（深色版），可直接复渲出同款；换主题时**保留它的坐标体系、时间轴与样式，只改文案和 K 值**，比从零写快得多。

### 4 · 逐镜写画面

- 六镜各一个文件：`compositions/scene-1-hook.html` … `scene-6-outro.html`；`index.html` 只做挂载，**不要把内容写成一个巨型 HTML**。
- 坐标全部写死，不靠流式布局：先定原点与比例尺（例：`OX=460, OY=620, S=96`，1 单位 = 96 像素），所有点由它算。
- 曲线**按函数采样**生成 path，不许手画近似。
- 公式与配色按 [references/visuals.md](references/visuals.md)；口径按 [references/math-rules.md](references/math-rules.md)。

### 5 · lint

```bash
npx -y hyperframes@0.8.181 lint
```

必须 0 错误 0 警告。有报错就按报错改，改完重跑。

### 6 · 六镜截图（自检 1–3）

```bash
node <技能目录>/scripts/verify.mjs --browser=/usr/local/bin/chromium
```

每镜 seek 到信息最全的那一秒截图到 `verify-shots/`，同时诊断 GSAP 是否加载、时间线是否注册、元素是否溢出、有无 JS 错误。**逐张自己看**，不是跑完就完事。

### 7 · 抽帧核对（自检 4）

对上一版成片抽 16 帧拼板，确认每段关键元素真的在自己声称的时刻出现。做法见 [references/qa.md](references/qa.md)。

### 8 · 渲全片（**必须显式给码率**）

```bash
npx -y hyperframes@0.8.181 render --output <name>.mp4 --quality delivery --video-bitrate 3M
```

`--video-bitrate` 与 `--crf` 互斥，二选一。90 秒 1080p 成品正常 15–25MB；**低于 10MB 说明压过头了**。

### 9 · 成片参数核对（自检 6）

```bash
node <技能目录>/scripts/inspect-video.mjs <name>.mp4 --expect-duration 90
```

核对分辨率、帧率、总帧数、时长、码率、体积；任一项不合格就回第 8 步重渲。

### 10 · 交付

```bash
zip -qr <name>-project.zip <工程目录> \
  -x "<工程目录>/node_modules/*" -x "<工程目录>/verify-shots/*" \
  -x "<工程目录>/.verify-tmp/*" -x "<工程目录>/*.mp4"
```

交付三件：**成片 mp4、纯源码工程包（排除 mp4）、三条说明**（讲了什么、替用户定了什么、哪几处请老师复核）。只发文件不算交付。

## 三、六镜骨架（90 秒基准）

时长可按要求缩放，但**结构顺序不要变**：先勾住，再推一步，再推广，再落推论，再纠错，最后收。

| # | 镜 id | 起点/时长 | 这一镜的任务 | 必含 |
|---|---|---|---|---|
| 1 | `s1-hook` | 0 / 10 | 抛一个真问题，让人想往下看 | 主图形定格 + 右侧三行提问 + 底部图注 |
| 2 | `s2-q1` | 10 / 20 | 在最简单的情形里把关键量算出来 | 坐标轴、曲线、动点、矩形/三角形、逐行字幕 |
| 3 | `s3-other` | 30 / 18 | 换象限验证同一结论 | 四支曲线依次点亮 + 结论卡 |
| 4 | `s4-triangle` | 48 / 15 | 把结论拆成一半，给出大前提 | 几何块 + 直角标记 + 三行推论 |
| 5 | `s5-table` | 63 / 12 | 纠最常见的错 | 细线表 + 错误卡（带删除线）+ 正确卡 + 金句 |
| 6 | `s6-outro` | 75 / 15 | 换坐标尺度复述结论，收住 | 同构图缩小版 + 居中三行 + 脉动强调 |

`index.html` 挂载要点：`body` 背景写死底色（深色 `#050a14`），六镜 `track-index` 0–5 连续，`start`/`duration` 与上表对齐，全片 `title` 写"主题｜角标名"。

## 四、数学口径速查（写错就是教学事故）

硬约束，逐条都要落到画面。完整清单与反例见 [references/math-rules.md](references/math-rules.md)。

1. **只推符号，不代数字**。讲反比例只到 `|k|` 与 `½|k|`，全片不出现"4"这类具体值；讲一般结论时同理。
2. **分数一律水平分数线**，不用斜杠、不用 `a/b` 写法。
3. **三角形符号作 S 的右下角标**，不是与字母平排。
4. **用"公共点"，不用"交点"**。
5. **负数情形表述固定**："k<0 时，二四象限亦是如此"。
6. 同一概念全片一个词，不换说法；字幕用语与教材一致。
7. 结论出现前，画面必须已经把依据画出来；不许"结论先出、依据后补"。

## 五、视觉速查（默认深夜光轨）

完整色值与实现见 [references/visuals.md](references/visuals.md)。记住三条深底铁律，其它都可调：

1. **面积类填充降到 18% 并加描边**——深底上 40% 的填充会糊成雾。
2. **三角形/几何块用「琥珀轮廓 + 极淡青填充」**——金色实心叠在深蓝上会变成脏橄榄色。
3. **表格不用底色，用细线分隔**——白底表格直接搬过来会三行连成一片。

字号整体比白底版大 4 号；左上角角标固定 `Vibe 知识大赏 ｜ 本镜小标题`，26px、字距 5px、left 84 / top 70。

****字体铁律**：分三类角色——中文 Noto Sans CJK SC（思源黑体）、拉丁标签与数字 Inter、数学符号 TeX Gyre Termes 衬线斜体（与 Times 同族，和教材字母形态一致）。`@font-face` 必须写在 `<template>` 的 `<style>` 里（放 head 会被取景 harness 丢掉，字体静默不加载）。细节与四个坑见 [references/visuals.md](references/visuals.md) 第零节。

## 六、渲染与码率

| 参数 | 取值 | 说明 |
|---|---|---|
| `--quality` | `delivery` | 高画质档，默认档会掉码率 |
| `--video-bitrate` | `3M` | **必须显式给**；与 `--crf` 互斥 |
| `--resolution` | 默认 landscape（1920×1080） | 4K 只在明确要求时用 |
| `--resume` | 中断后续渲 | 已渲帧不重来 |

判据：90 秒 → 体积 15–25MB、码率 1.5Mbps 以上、2700 帧、时长 90.000000s。数字不对就重渲，不要交付。

### 清晰度不够时（实测：`--video-bitrate` 不生效）

**2026-11 实测：`--video-bitrate 30M` 渲出来仍是 1.8Mbps，`--quality delivery` 也一样。** 也就是内置编码的码率参数基本被忽略，交付级清晰度只能自己接管编码。用户说"看不清"时按这条路走，别再反复调 `--video-bitrate`：

```bash
# 1) 只渲帧，不编码（2700 帧 / 约 2.4GB / 16 分钟）
npx -y hyperframes@0.8.181 render --format png-sequence --output pngseq

# 2) 自己编码。静止内容多、文字细，必须用 CBR 而不是 CRF（CRF 只给 0.5Mbps，平台二次转码必糊）
ffmpeg -v error -framerate 30 -i pngseq/frame_%06d.png \
  -c:v libx264 -b:v 4M -minrate 4M -maxrate 4M -bufsize 8M \
  -preset slow -tune animation \
  -x264-params "nal-hrd=cbr:aq-mode=3:chroma-qp-offset=-2" \
  -pix_fmt yuv420p -movflags +faststart -y out.mp4
```

`chroma-qp-offset=-2` 是给彩色细笔画用的：青字、琥珀字在 4:2:0 色度抽样下边缘会掉色，这一项让色度比亮度多给一点码率。

约 2 分钟编码，得 90s / 43MB / 4Mbps。**40MB 这条线是"课堂能放、平台转码后还清楚"的平衡点**；低于 10MB 的文件在手机端一看就软。要投平台（视频号/抖音）再加一档 `-b:v 8M` 的母版（约 85MB），平台转码后仍能保住文字。

不要指望 4K 超采样：软件 GPU 下 2700 帧要跑一小时以上（实测 20 分钟才到 8%），单条片子的工期撑不住。

编码后必须抽一帧 1:1 看（`crop=760:300` 看文字边缘有没有块状/振铃），不能只看整体缩略图——缩略图看不出糊。

### 音效（点状音效，不是 BGM）

用户说"加点声音""太静了"但没要 BGM 时，只铺点状音效：**画面每发生一个动作才响一次，响完就归零**。数学讲解片上了背景音乐会削弱思考感，也会盖住老师自己的旁白。

```bash
# 1) 按分镜动作点写时间线（绝对秒），示例见 assets/sfx-events.example.json
python3 <技能目录>/scripts/make-sfx.py events.json -o sfx.wav --duration 90

# 2) 拷视频流、只混音轨（画面一个像素都不动）
ffmpeg -v error -i in.mp4 -i sfx.wav -c:v copy -c:a aac -b:a 128k -shortest \
  -movflags +faststart -y out.mp4
```

六种音效各管一件事：`brush` 曲线/线段生长、`slide` 动点匀速滑动、`tick` 一行文字出现、`ding` 卡片/标题/问句、`thump` 最关键的那个量、`chime` ✓/金句/片尾。

三条规矩：
1. **不给每行字都响**——只挑"画面动作"，90 秒片 30 个点左右就够，密了就吵。
2. **峰值压在 -16dBFS 以内**，`tick` 落在 -29dB 上下、`thump`/`ding` 落在 -24dB 上下，这个量级"听得见但不抢戏"。
3. 混完用 `ffmpeg -ss <t> -t 0.6 -af volumedetect` 抽查：有音效处应 -24~-30dB，空白处应 -91dB（真静音）。有音效处高于 -18dB 就调小。



## 七、六道自检（交付前必须全过）

| # | 查什么 | 命令 | 通过判据 |
|---|---|---|---|
| 1 | 结构合规 | `npx -y hyperframes@0.8.181 lint` | 0/0 |
| 2 | 六镜有画面 | `scripts/verify.mjs` | 六镜全部出图，无黑屏、无 JS 错误 |
| 3 | 元素不越界 | 同上，看诊断报告 | 无溢出条目；字幕距底 ≥80px |
| 4 | 时序真出现 | 抽帧拼板（见 qa.md） | 每段元素在自称时刻已出现，无空段 |
| 5 | 口径正确 | 对照 math-rules.md 逐镜读字幕 | 七条全过 |
| 6 | 成片参数 | `scripts/inspect-video.mjs` | 分辨率/帧数/时长/码率/体积全达标 |

第 1、2、3、4、6 查由机器判，人复核；**第 5 查只能人做**——它是唯一能挡住教学事故的一道。

## 八、修改迭代的规矩

用户提意见要按"三件套"接：**哪一镜 / 哪一秒 / 改成什么**。含混的"这里不太对"要反问定位，不要整段重做。

改完必须重跑：改动涉及坐标或字号 → 1+2+3；涉及文案 → 5；涉及多个镜头 → 全部六查。

一次攒几条一起改比反复小修更快，但**跨镜的大改要重出分镜确认**。

真实修订过程（十条实录）见 [references/revisions.md](references/revisions.md)。

## 九、禁止事项

- `assets/gsap.min.js` 缺失或改用 CDN
- 用 `scaleX/scaleY` + `transformOrigin` 做 SVG 线段生长（只从一端长）
- 用 `onUpdate` 驱动 SVG 属性（seek 时不触发，截图会错）
- 补间 `letterSpacing`、`width` 等会触发回流的属性
- `d=""` 时先调 `getTotalLength()`（必须先给哨兵 d）
- 渲染不提码率
- 把全部内容写进一个 HTML
- 公式用斜杠表示分数
- 交付时只发 mp4 不说改了什么
- SVG `<text>` 里塞 `<sup>`（HTML 标签进 SVG 会让整段文字跑位；上标一律用 `²` 字符）
- 在满宽（1920）的容器上做 scale 脉动（放大 4% 就撞边界，第 3 查直接判溢出；scale 挂在容器内的 inline-block 上）
- 把绝对定位的删除线放在目标文字的**兄弟**位置（会横跨整列；要放进那个文字自己的相对定位容器里）
- 用 `repeat: -1` 做循环脉动（子组合没有 `data-duration` 时 lint 必报错；改成有限的重复次数）
- 在工程根留任何临时 `.html`（会被当成第二个 root，lint 报"只能有一个 index.html"）
- 曲线画两条 path（亮线 + 光晕）时只给亮线设 `dasharray/dashoffset`（光晕会整条提前显影，看起来像"还没画完就有一段暗影"；两条都要设、同一时刻补间）
- 用 `--video-bitrate` 追清晰度（实测不生效，见第六节）
- 编码只给 CRF 不看体积（静止内容 CRF 只出 0.5Mbps，平台转码后必糊）
- 用系统默认字体渲染字母数字（`system-ui` 在无头 Chromium 里是 DejaVu Sans，字母数字呆板；一律 `"Inter", sans-serif`）
- 在 `font-family` 里写中文名（如 `"Noto Sans SC"`，没装会被 lint 判 `font_family_without_font_face`）
- 坐标轴只画两条直线、不在端点画正方向箭头（教材规范：x 朝右、y 朝上，各一个实心箭头，写法见 [references/visuals.md](references/visuals.md) 的「坐标轴」一节）

## 九·五、给旧工程补字体

老工程（字体还是 `system-ui`）不用重建，跑一条命令就能升级到三分角色字体：

```bash
node scripts/apply-fonts.mjs --project <工程目录>
```

它做五件事：拷字体到 `assets/fonts/`、把 `@font-face` 并进 `<template>` 的 `<style>`（head 里的会被取景 harness 丢掉）、给 `.row/.cap/.tag` 容器锁 `Inter`、把**正文里的裸变量 `x/y/k/S` 逐个包成 `<i>`**（纯 CSS 选择器管不到裸文本，这是最常见的“改了字体却没变”的原因）、把 SVG 的 `font-family` 换成 `'Termes', serif` 并给 `x`/`y`/`k` 加斜体。数学符号统一 `calc(1em + 2px)`，补衬线相对无衬线的视觉收缩。幂等，重复跑不会重复插入。

改完照常跑：`lint` → `verify` → `render`，**必须重渲**，字体不会在旧成片上生效。

## 十、参考文件

| 文件 | 什么时候读 |
|---|---|
| [references/pipeline.md](references/pipeline.md) | 第一次做，或要给人讲清四步怎么串起来 |
| [references/math-rules.md](references/math-rules.md) | 写任何公式与结论之前 |
| [references/visuals.md](references/visuals.md) | 定配色、字号、卡片、公式排版时 |
| [references/prompts.md](references/prompts.md) | 追问补全、写分镜、教别人怎么说第一句 |
| [references/revisions.md](references/revisions.md) | 用户提意见、或要给教研组讲"改十遍是怎么回事" |
| [references/qa.md](references/qa.md) | 每轮自检、判断一片能不能交 |
| [references/two-tracks.md](references/two-tracks.md) | 需要旁白/配乐/手/地图/角色，改道 B 轨时 |
| `assets/project-template/` | 建工程时由 `init-project.mjs` 拷贝，不要手改 |
| `assets/gsap.min.js` | 建工程时拷进项目 `assets/` |
