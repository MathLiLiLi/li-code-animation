#!/usr/bin/env python3
"""按时间线合成点状音效轨（非 BGM），输出一条与成片等长的单声道 WAV。

用法:
    python3 make_sfx.py events.json -o sfx.wav --duration 90

events.json 格式（秒，绝对时间）:
    [[3.7, "tick", 1.0],
     [11.4, "thump", 1.0],
     [1.4, "brush", 1.0, 1.4],     # 第 4 位可选：持续秒数（brush/slide 用）
     [54.1, "chime", 1.0]]

可用音效:
    tick   1400Hz 极短点击，给"一行文字出现"
    ding   880+1320Hz 双音，给"卡片/标题/问句出现"
    thump  88Hz 低频，给"最关键的那个量出现"
    chime  三音和弦，给"✓ / 金句 / 片尾"
    brush  噪声笔触，给"曲线/线段生长"，默认 1.4s
    slide  更平更轻的噪声，给"动点匀速滑动"，需要持续秒数

原则: 只给"画面动作"配音，不给每行文字都响；峰值压在 -16dBFS 以内，绝不盖过讲解。
"""
import argparse
import json
import wave

import numpy as np

SR = 44100
# 每类音效的绝对幅度（感知音量）。噪声类峰值高但听着轻，不能跟正弦共用一套归一化。
LEVEL = {
    "tick": 0.036,
    "ding": 0.052,
    "thump": 0.062,
    "chime": 0.052,
    "brush": 0.028,
    "slide": 0.018,
}


def _env(n, attack=0.01, power=2.0):
    t = np.linspace(0, 1, n)
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    return a * np.exp(-power * 3.0 * t)


def _tick():
    n = int(SR * 0.075)
    return np.sin(2 * np.pi * 1400 * np.arange(n) / SR) * _env(n, 0.002, 3.5)


def _ding():
    n = int(SR * 0.34)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 880 * t) * 0.7 + np.sin(2 * np.pi * 1320 * t) * 0.35) * _env(n, 0.004, 2.2)


def _thump(rng):
    n = int(SR * 0.30)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * 88 * t) * _env(n, 0.006, 1.6)
    return s + rng.normal(0, 1, n) * 0.06 * _env(n, 0.002, 4.0)


def _chime():
    n = int(SR * 0.75)
    s = np.zeros(n)
    for f, off in ((523.25, 0.0), (659.25, 0.09), (783.99, 0.18)):
        i = int(off * SR)
        seg = np.sin(2 * np.pi * f * np.arange(n - i) / SR) * _env(n - i, 0.004, 2.6)
        s[i:] += seg * 0.5
    return s


def _brush(rng, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = np.diff(rng.normal(0, 1, n), prepend=0)
    amp = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8
    return noise * amp * (1 + 0.25 * np.sin(2 * np.pi * 9 * t))


def _slide(rng, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    noise = np.diff(rng.normal(0, 1, n), prepend=0)
    amp = np.ones(n)
    fade = max(int(SR * 0.25), 1)
    amp[:fade] = np.linspace(0, 1, fade)
    amp[-fade:] = np.linspace(1, 0, fade)
    return noise * amp * (0.85 + 0.15 * np.sin(2 * np.pi * 6 * t))


def build(events, duration, seed=7):
    rng = np.random.default_rng(seed)
    buf = np.zeros(int(SR * duration))
    made = 0
    for ev in events:
        t, kind = float(ev[0]), ev[1]
        gain = float(ev[2]) if len(ev) > 2 else 1.0
        dur = float(ev[3]) if len(ev) > 3 else None
        if kind == "tick":
            sig = _tick()
        elif kind == "ding":
            sig = _ding()
        elif kind == "thump":
            sig = _thump(rng)
        elif kind == "chime":
            sig = _chime()
        elif kind == "brush":
            sig = _brush(rng, dur or 1.4)
        elif kind == "slide":
            sig = _slide(rng, dur or 3.0)
        else:
            raise SystemExit(f"未知音效: {kind}")
        i = int(t * SR)
        n = min(len(sig), len(buf) - i)
        if n > 0:
            buf[i:i + n] += sig[:n] * LEVEL[kind] * gain
            made += 1
    fade = int(SR * 0.4)
    buf[:fade] *= np.linspace(0, 1, fade)
    peak = float(np.abs(buf).max())
    if peak > 0.38:
        buf = buf / peak * 0.38
    return buf, made, peak


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("events", help="events.json")
    ap.add_argument("-o", "--output", default="sfx.wav")
    ap.add_argument("--duration", type=float, default=90.0)
    ap.add_argument("--peak", type=float, default=0.38, help="峰值上限（0-1），默认 0.38≈-8dBFS 保护")
    ap.add_argument("--gain", type=float, default=0.0, help="整体提升 dB。后期要再叠 BGM 时给 +6~+9")
    a = ap.parse_args()

    with open(a.events, encoding="utf-8") as f:
        events = json.load(f)
    buf, made, peak = build(events, a.duration)
    if a.gain:
        buf = buf * (10 ** (a.gain / 20.0))
    peak = float(np.abs(buf).max())
    if a.peak < peak:
        buf = buf / peak * a.peak
    pcm = np.round(buf * 32767).astype(np.int16)
    with wave.open(a.output, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{made} 个音效 · {a.duration}s · 原始峰值 {peak:.3f} · -> {a.output}")


if __name__ == "__main__":
    main()
