# 公式排版：手写分数还是 KaTeX

一句话：**简单式继续手写 `.frac` + Termes（教材本的样子），复杂式才上 KaTeX（能排但字形不同）。一片之内只用一种。**

## 一、先判

| 情形 | 走哪条 |
|---|---|
| 一层分数 `½|k|`、`k/x` | 手写 `.frac` |
| 单项式、方程、短变量 `y=kx+b` | 直接文本 + `<i>` 包变量 |
| 嵌套分式 `(a/b)/(c/d)` | KaTeX |
| 根式、多重上下标 `x^{2n+1}`、分段函数大括号 | KaTeX |
| 行列式、矩阵、长除式 | KaTeX |

判据很简单：**手写版本需要超过 6 个 `<span>` 才能拼出来，就换 KaTeX。**

## 二、手写（默认路线）

```html
<span class="frac"><span class="n">1</span><span class="d">2</span></span>
```

```css
.frac{vertical-align:middle;font-size:.72em;line-height:.98;margin:0 .22em;position:relative;top:-.16em;}
.frac .n{padding:0 .24em .05em;border-bottom:1.5px solid currentColor;}
.frac .d{padding:.05em .24em 0;}
```

横线是**分子的下边框**，不另外插 `<hr>`。细节与三个错法见 [math-rules.md](math-rules.md) 第三节。

## 三、KaTeX（复杂式）

### 1. 写一份 formulas.json

```json
[
  { "id": "f1", "tex": "y=\\dfrac{k}{x}", "display": true },
  { "id": "f2", "tex": "\\Delta=b^{2}-4ac", "display": false }
]
```

`display` 不写默认 `true`（块级居中）。**要行内嵌进一句话里，必须显式写 `false`**。

### 2. 生成静态 HTML

```bash
node <技能目录>/scripts/render-formulas.js formulas.json -o formulas.html
```

输出形如：

```html
<div class="formula formula-big" id="f1" data-formula="y=\dfrac{k}{x}">…KaTeX 字形…</div>
```

脚本语法错误时退出码 2，并把出错公式渲染成 `<span class="formula-error">`，**看到这个标记就说明没成功，别往下走**。

### 3. 粘进分镜

把输出片段整段粘到对应 `scene-*.html` 的 `<template>` 里，然后按 `data-formula` 定位做动画（GSAP 按 `#f1` 选择即可）。

### 4. 引入 KaTeX 样式（必做，而且是唯一容易翻车的一步）

`katex.min.css` 必须**内联进 `<template>` 的 `<style>`**——本技能的铁律是 head 里的样式会被取景 harness 丢掉。

内联前先把字体路径改对，否则公式全变方块：

```bash
# 工程根执行，assets/katex/ 已从技能包拷入
sed 's|url(fonts/|url(assets/katex/fonts/|g' assets/katex/katex.min.css > /tmp/katex-inline.css
# 然后把 /tmp/katex-inline.css 的内容贴进 scene-*.html 的 <style>
```

KaTeX 自己的 `@font-face` 就写在这个 CSS 里，内联后正好符合本技能"字体必须写在 template"的要求，不用另加。

## 四、字号与对齐（和手写那套完全不同）

- KaTeX 输出**继承父容器字号**，所以先把外层 `font-size` 定好，别再单独调公式。
- 行内嵌进正文时用 `vertical-align:middle`；**不要套 `.frac` 的 `top:-.16em`**，KaTeX 自带 baseline，再拽就偏。
- 块级（`display:true`）适合独占一行的结论式；行内（`false`）适合"因为 … 所以 …"这种夹在句中的。

## 五、五个坑

| 症状 | 原因 | 改法 |
|---|---|---|
| 公式变成一堆叠在一起的字母 | 没内联 `katex.min.css` | 按第三节第 4 步内联 |
| 公式全是方块 | 字体路径没改 | `sed` 换成 `assets/katex/fonts/` |
| 单行公式莫名居中、把整句断开 | `display` 默认 `true` | JSON 里显式写 `"display": false` |
| 公式和旁边的 `x` 大小不一 | 外层字号没统一 | 给公式容器和正文同一个 `font-size` |
| 同一屏里字重/字宽明显不同 | KaTeX 与 Termes 混排 | 一片只用一种，简单式回手写 |

## 六、边界

KaTeX 只解决"怎么排得下去"，**不解决"写什么"**。口径仍按 [math-rules.md](math-rules.md) 七条硬约束逐条过——公式再漂亮，把 `|k|` 写成 `k` 一样是教学事故。
