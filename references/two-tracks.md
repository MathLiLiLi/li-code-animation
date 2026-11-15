# 双轨：什么时候改道 B 轨（旁白 / 配乐 / 复杂画面）

A 轨是本技能的默认：纯图形、无旁白、字幕即画面文字。**但有一类需求 A 轨做不了**，这时改道调用 `code2video`。

## 一、A 轨做不了的四类需求

| 需求 | 为什么 A 轨不行 | B 轨怎么解决 |
|---|---|---|
| 要旁白讲解 | A 轨没有音轨制作链 | film.json 写旁白 → TTS 配音 → 自动对齐字幕 |
| 要配乐成片 | A 轨只出无声 mp4，BGM 靠后期 | `synth.mjs` 自动配乐 + `audio.mjs` 混音 + 响度对齐 -14 LUFS |
| 要手、角色、地图、3D | A 轨只有 SVG 图元 | 积木库：`hands2d`、`character2d`、`human3d`、地图镜头 |
| 要"边讲边演"的示范 | A 轨是板书式静态图形 | 自由画面 + 动作人偶 |

## 二、继承方式：调用，不复制

**不把 `code2video` 的 `engine/`、`kits/`、`presets/` 搬进本技能**，原因三条：

1. 体积：kits 832K + presets 16M + vendor 2.3M，搬进来约 20MB，而本技能主体不到 1MB。
2. 版本漂移：那边升级积木后，两个技能里的副本会不一致。
3. 维护：改了 bug 要改两处。

正确做法：**用已安装的那一份**。调用前置检查：

```bash
ls /home/user/.doubao/agent_mode/workspace/.skills/code2video/tools/make.mjs
node /home/user/.doubao/agent_mode/workspace/.skills/code2video/tools/doctor.mjs
```

若该技能不存在，先让用户安装，或降级回 A 轨并说明"这片子只能出无声版"。

## 三、B 轨的最小用法

```bash
C=/home/user/.doubao/agent_mode/workspace/.skills/code2video
node $C/tools/new.mjs films/<短名> --title "<片名>" --form explain --look <风格卡> --query "<用户原话>"
# 写 films/<短名>/film.json 与 scene.js
node $C/tools/make.mjs films/<短名> build      # 配音 → 编译 → 时间表 → 配乐
node $C/tools/make.mjs films/<短名> check      # 质检 + 体检 + 内容约束
node $C/tools/make.mjs films/<短名> film       # 出片
```

**B 轨自己的规矩照它的 SKILL.md 走**，不要用本技能的六查去套它——它有自己的 `check`（含画面停住、强度、色彩度、文字出界、响度）。

## 四、配音怎么做（云电脑没有本地 TTS）

`build` 会报"还差配音"并生成 `voice/todo.json`。链路：

1. 先用 `text_to_audio_plus` 生成约 5 秒样音，锁定声线（写音色描述 + 一句样句）。
2. 每项用 `audio_to_audio_plus`，以样音为参考，把整段一次配成（句间停顿已写好）。原文照抄，不改字。
3. `make.mjs <片> voices split` 去掉平台自动念的 AI 标识，并按句切回一句一个文件。
4. 再 `build`。

细节与坑（例如参考音链接没有 `.wav` 后缀会被拒、要先下载再上传拿签名直链）见 `code2video` 的 SKILL.md「配音」一节，**不要凭记忆操作**。

## 五、配乐与混音

- 用户给了 mp3：`film.json` 里 `"music": { "file": "assets/歌.mp3" }`，`build` 自动混音。
- 用户没给：`synth.mjs` 按片长合成一条；本方法用户习惯是**后期自己配 77BPM**，所以 A 轨默认不加，B 轨可按需。
- 响度自动对到 -14 LUFS，真峰值不超过 -1 dBTP，不用手调。

## 六、分镜在两个轨道间迁移

本技能的分镜表（镜号/时长/画面/字幕）可转成 `film.json` 的幕：

```bash
node <技能目录>/scripts/story-to-filmjson.mjs <分镜.md> --out films/<短名>/film.json --title "<片名>"
```

生成的是**骨架**（幕与旁白），镜头类型和积木选择仍要人工填。转换的目的不是省事，是保证两轨讲的是同一个内容、同样的口径。

## 七、选轨的三句话判据

1. 学生要**边听边看**吗？是 → B 轨。
2. 画面里需要**人动手**吗（剪纸、量、摆）？是 → B 轨。
3. 只需要**图和字**，且能暂停看？→ A 轨，快一倍，而且公式能排得更正。

## 八、混合：A 轨为主体，B 轨补声音

最实用的折中：用 A 轨的六镜出画面（画质、公式、坐标都最好），再把 A 轨的 mp4 当画面、用 `code2video` 的 `audio.mjs` 配旁白与配乐，`ffmpeg` 混流：

```bash
ffmpeg -i silent.mp4 -i voice.wav -c:v copy -c:a aac -b:a 128k -shortest final.mp4
```

注意：A 轨没有配音时间轴，字幕时刻是照画面定的，加旁白后要**重新核对话与画是否同步**（第 4 查）。
