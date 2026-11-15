# 视觉参数：深夜光轨（默认）与白底（备选）

色值可直接拷，不要凭眼调。

## 零、字体（三类角色，先定这一条再谈字号）

深底画面里字体分三类，各管一段，**不能相互替代**：

| 角色 | 字体 | 为什么 |
|---|---|---|
| 中文 | Noto Sans CJK SC（思源黑体） | 系统 sans-serif 默认会落到文泉驿正黑，字形旧、看着像宋体；思源黑体在手机小窗里最稳 |
| 拉丁标签、数字、英文词 | Inter | 屏幕阅读字体，字母几何感强、数字区分度高 |
| 数学符号与变量（`x`、`k`、`|k|`、`S`、`±`、`½`） | **TeX Gyre Termes 衬线斜体** | 与 Times 同族，和教材上的字母形态一致；变量斜体、直立数字，是课本的排版规矩 |

```css
/* 全部声明必须写在 <template> 内的 <style> 里 —— 放 <head> 会在取景 harness 里丢失 */
@font-face{font-family:"Inter";src:url("../assets/fonts/inter-400.woff2") format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Inter";src:url("../assets/fonts/inter-600.woff2") format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:"Inter";src:url("../assets/fonts/inter-700.woff2") format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"Termes";src:url("../assets/fonts/termes-regular.otf") format("opentype");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Termes";src:url("../assets/fonts/termes-italic.otf") format("opentype");font-weight:400;font-style:italic;font-display:swap}
@font-face{font-family:"Termes";src:url("../assets/fonts/termes-bolditalic.otf") format("opentype");font-weight:700;font-style:italic;font-display:swap}
@font-face{font-family:"HanSans";src:local("Noto Sans CJK SC"),local("Source Han Sans SC"),local("PingFang SC"),local("Microsoft YaHei")}

/* 容器：拉丁用 Inter，中文交给 HanSans */
.row, .cap, .tag, .note, .kicker, .same, .goal {
  font-family: "Inter", "HanSans", sans-serif;
}
/* 数学：容器内的 <i>、以及 .eq / .var 走衬线斜体 */
i, .row i, .cap i, .same i, .eq, .var, .eq i {
  font-family: "Termes", serif;
  font-style: italic;
}
```

**四个已经踩过的坑，改字体时必须照着避开**：

1. **`@font-face` 不能放 `<head>`**。`verify.mjs` 的取景 harness 只取 `<template>` 里的内容，head 会被丢掉——字体静默不加载，你看到的"字体没变"其实是根本没加载，一直在用系统兜底。
2. **SVG 里的 `font-family` 属性要用单引号包字体名**。批量替换时写成 `font-family=""Inter", sans-serif"` 会把属性截断，SVG 退回默认衬线，坐标轴标签立刻变"教材字"——但这属于意外，不是设计。
3. **容器必须显式锁字体**。只改 `#root` 不够：某些容器带着 `white-space:nowrap` 或继承链差异，中文会落到系统 serif（宋体感）。给 `.row/.cap/.tag/.note` 这类容器逐个写上 Inter，才稳。
4. **`<i>` 的优先级要压过容器**。容器写了类选择器，`i` 的元素选择器优先级更低，必须写 `.row i` 这种组合才能让数学符号在容器里也走 Termes。

字体文件在 `assets/fonts/`：Inter 三个字重各 24K，Termes 三个变体各约 140K。`init-project.mjs` 会自动拷进工程 `assets/fonts/`，不用手工放。

字号与位置仍按下面各节的表格；换成衬线后同字号视觉略小，**变量类文字可再放大 2–4 号**。

## 一、深夜光轨（默认）

### 底色与氛围

```css
/* 页面底色：左上偏暖，右下深到底 */
background: radial-gradient(ellipse at 24% 4%, #162b4f 0%, #0c1a30 46%, #050a14 100%);
/* 网格：极淡，96px 一格 */
background-image:
  linear-gradient(rgba(120,190,255,.05) 1px, transparent 1px),
  linear-gradient(90deg, rgba(120,190,255,.05) 1px, transparent 1px);
background-size: 96px 96px;
/* 暗角：压四角，把注意力收到中间 */
background: radial-gradient(ellipse at 44% 46%, transparent 44%, rgba(2,6,14,.74) 100%);
```

### 色板

| 用途 | 色值 | 说明 |
|---|---|---|
| 正文文字 | `#e3edf9` | 主级 |
| 次级文字 | `#a7bdd8` / `#b9cbe0` | 注释、说明 |
| 弱文字 | `#93aac6` / `#7d95b5` | 图注、单位 |
| 坐标轴 | `#6f8db3`，线宽 2.5 | 比曲线暗一档 |
| 主曲线 | `#35e0e7`（荧光青） | 全片最亮的东西 |
| 曲线光晕 | `rgba(53,224,231,.10)`，stroke-width 11 | 单独一条 path，垫在曲线下面（2026-11 修正：原 17px/.16 在 1080p 下自带柔焦，交付后会被看成"糊"） |
| 强调 | `#f5b942` / `#f0a92e`（琥珀） | 全片只给最关键的一个量 |
| 亮青（标签） | `#4dd7ff` | 小标签、序号 |
| 警戒 | `#ff5f6d` | 只用于错误卡 |
| 卡片底 | `rgba(14,30,52,.92)` | 加青/金半透明边 + 黑阴影 |

### 三条深底铁律（不遵守就脏）

1. **面积类填充降到 18% 并加描边**
   ```css
   fill: rgba(53,224,231,.18); stroke: rgba(53,224,231,.55); stroke-width:1.5;
   ```
   白底版用 40% 是可以的，深底 40% 会糊成一层雾，图形边界消失。

2. **三角形/几何块用「琥珀轮廓 + 极淡青填充」**
   ```css
   fill: rgba(53,224,231,.06); stroke:#f5b942; stroke-width:2.5;
   ```
   **不要金色实心**：`#f5b942` 大面积填充叠在 `#0c1a30` 上会变成脏橄榄色，看起来像发霉。

3. **表格不用底色，用细线分隔**
   ```css
   border-bottom: 1.5px solid rgba(120,190,255,.18);
   ```
   白底的表格（灰底表头 + 交替行）搬到深色上会三行连成一片，看不出行界。**线不要低于 1.5px**：1px 在 1080p 深底上会被抗锯齿摊成两像素的灰雾，密集文字行就显得"糊"。

### 坐标轴（正方向必须有箭头）

教材里的坐标轴不是两条光秃秃的线：末端要有实心箭头指正方向。缺箭头的画面在教辅语境里一眼就是"不专业"。2026-11 补，见模板 `assets/project-template/compositions/`。

```svg
<defs>
  <marker id="axArrow" viewBox="0 0 10 10" refX="9" refY="5"
          markerUnits="strokeWidth" markerWidth="6" markerHeight="6"
          orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 Z" fill="#6f8db3" />
  </marker>
</defs>

<line id="s2-axx" x1="120" y1="620" x2="880" y2="620"
      stroke="#6f8db3" stroke-width="2" marker-end="url(#axArrow)" />
<line id="s2-axy" x1="460" y1="880" x2="460" y2="160"
      stroke="#6f8db3" stroke-width="2" marker-end="url(#axArrow)" />
```

- **方向**：x 轴写 `x1 < x2`（朝右），y 轴写 `y1 > y2`（朝上）；箭头只画在正方向端点，负方向不画
- **颜色跟轴色走**：深夜光轨 `#6f8db3`，白底 `#9aa6b6`
- **id 逐镜改**：一页里有多个 `<svg>` 时，marker 的 id 要用 `axArrow1`…`axArrow6`，否则几个镜抢同一个定义，只有一个能画出箭头
- **轴标签** `x` / `y` 放箭头外侧 28px 处，40px、衬线斜体（`<i>x</i>`），色 `#7d95b5`；刻度默认不画，需要读数时才加 8px 短刻度

### 字号与位置

| 元素 | 规格 |
|---|---|
| 角标 kicker | `left:84; top:70; font-size:30px; letter-spacing:5px`，文案 `Vibe 知识大赏 ｜ 本镜小标题` |
| 主标题 | 64–72px，字重 600 |
| 正文 | 40–46px，行高 1.5 |
| 说明/次级 | 32–34px |
| 图注 | 30–32px，弱色，左侧加 3px 青竖线，**一条不超过 18 个字** |
| 卡片 | 圆角 10px，内边距 28px，阴影 `0 18px 46px rgba(0,0,0,.45)` |

**字号整体比白底版大 4 号**——深色底视觉上会"缩"，同字号看起来更小。

### 手机可读线（2026-11 实测，必守）

学生绝大多数在手机上看。手机竖屏小窗显示 16:9 视频时，画面只有约 390px 宽，缩放比约 0.20：

| 片上字号 | 手机上等效 | 结果 |
|---|---|---|
| 26px | ≈5px | **等于没写** |
| 32px | ≈6.5px | 勉强辨认 |
| 40px | ≈8px | 能读 |
| 52px | ≈10px | 舒服 |
| 80px+ | ≈16px+ | 醒目 |

所以：
- **任何"学生必须读懂"的字（结论、公式、关键句）≥ 40px**，最好 52px 以上
- 说明类、图注 ≥ 32px，且必须短——长了在手机上就是一片灰纹
- 26px 只许用在纯装饰（角标、刻度、单位），不承载信息
- 信息密度换清晰度：一镜讲一个要点、字号顶上去，比信息塞满更符合手机观看

这条不能靠"编码更清晰"弥补——我已经用 4Mbps CBR + PNG 无损帧验证过：文件本身 1:1 是锐的，糊在缩放比例上。

## 二、白底（备选，用户明确要求时用）

| 用途 | 色值 |
|---|---|
| 页面底 | `linear-gradient(165deg,#fdfdff,#f5f7fb 52%,#eef2f8)` |
| 正文 | `#17202b` |
| 蓝（主色） | `#2f6fed` / 深 `#1d4ed8` |
| 金（强调） | `#c8992b` / 深 `#a5781f` |
| 坐标轴 | `#9aa6b6`，线宽 2 |
| 面积填充 | 40%（白底可以浓） |

白底版不需要光晕层，曲线直接用主色，靠线宽 3 撑住。

## 三、公式排版

见 [math-rules.md](math-rules.md) 第三节。这里只强调：横线用**分母的上边框**，不额外插元素。

## 四、动效的默认节奏

| 动作 | 时长 | 缓动 |
|---|---|---|
| 元素淡入 | 0.6s | `power2.out` |
| 曲线绘制（drawSVG 式） | 1.2–1.4s | `power1.inOut` |
| 点沿曲线滑动 | 2.5–4s | `none`（匀速，学生要跟得住） |
| 文字逐行出现 | 每行 0.5s，间隔 0.7–1.0s | `power2.out` |
| 强调脉动 | 1.2s 一次，两次 | `sine.inOut` |
| 整镜收尾淡出 | 0.07s 起、0.15s 完成 | 硬一点，不要拖 |

**全片不要用弹跳、旋转、缩放强调**。数学片里唯一允许的"花"是光晕和脉动。

## 五、GSAP 四条铁律（都踩过）

1. **不补间 `letterSpacing`、`width`、`height` 等回流属性**——每帧强制重排，30fps 掉到 8fps。要字距变化就在关键帧里直接改值。
2. **SVG path `d=""` 为空时调 `getTotalLength()` 会被判非法**（报 `svg_measure_before_path_d`）。做法：先给哨兵 `d="M0,0 L1,1"`，再赋真值，再测长度。
3. **SVG `<line>` 严禁 `scaleX/scaleY + transformOrigin` 做生长动画**。线会只从一端伸缩，另一端不动。必须补间端点：
   ```js
   tl.to(line, {attr:{x2: 880}, duration:1.2, ease:'power1.inOut'}, 0.25);
   ```
4. **不要用 `onUpdate` 驱动 SVG 属性**。`seek()` 时不触发回调，截图会停在错误状态。用 keyframes 数组做 attr 补间：
   ```js
   tl.to(path, {attr:{d: dMid}, duration:.4}, 1.2)
     .to(path, {attr:{d: dEnd}, duration:.3}, 1.6);
   ```

## 六、自检时的看图要点

截图出来先看四件事，比逐像素比更有效：

1. 最亮的东西是不是你想强调的那个（不该有第二个同样亮）。
2. 文字有没有压住图形（尤其公式与曲线、表格与删除线）。
3. 暗角有没有把边上的东西吃掉（图注常在暗角里消失）。
4. 面积填充部分能不能看出边界（看不出就是浓度太高）。
