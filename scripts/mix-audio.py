#!/usr/bin/env python3
"""mix-audio.py — 把点状音效和用户指定 BGM 混进成片，音量比例自动算。

规矩（写死在这，不要每次手调）：
  BGM 峰值 = 音效输出峰值 − GAP，GAP 默认 9dB。
  差 8~10dB：音乐当底、每一下音效都冒出来；
  差 ≤5dB：音效被吃掉；差 ≥15dB：音乐等于没有。

用法：
  python3 mix-audio.py --video out.mp4 --sfx sfx.wav --bgm bgm.mp3 \
      --duration 90 --out mixed.mp4

输出最后会打印两件事：算出来的两个 volume 值、以及验收用的抽查命令。
验收判据：有音效处比纯音乐处高 8dB 以上。
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile


def run(cmd, quiet=True):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 and not quiet:
        sys.stderr.write(r.stderr[-2000:])
    return r


def probe_peak(path):
    """返回 (max_volume_db, mean_volume_db)；取不到返回 (None, None)。"""
    r = run(["ffmpeg", "-v", "info", "-i", path, "-vn",
             "-af", "volumedetect", "-f", "null", os.devnull])
    peak = re.search(r"max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB", r.stderr)
    mean = re.search(r"mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB", r.stderr)
    return (float(peak.group(1)) if peak else None,
            float(mean.group(1)) if mean else None)


def db_to_volume(db):
    """dB 衰减 → ffmpeg volume 倍率。"""
    return 10.0 ** (db / 20.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True, help="已编码好的、无音轨或音轨可丢弃的 mp4")
    ap.add_argument("--sfx", required=True, help="点状音效 wav（make-sfx.py 产出）")
    ap.add_argument("--bgm", required=True, help="用户给的配乐（mp3/m4a/wav 都行）")
    ap.add_argument("--duration", type=float, default=90.0)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sfx-ceiling", type=float, default=-10.0,
                    help="音效峰值上限（dB），默认 -10：低于它就不动音效，高于它才压下来")
    ap.add_argument("--gap", type=float, default=10.0,
                    help="音效峰值高于 BGM 峰值的分贝数，默认 10（8~10 都可用）")
    ap.add_argument("--fade-in", type=float, default=1.5)
    ap.add_argument("--fade-out", type=float, default=2.0)
    ap.add_argument("--dry-run", action="store_true", help="只算音量打印命令，不执行")
    args = ap.parse_args()

    for p in (args.video, args.sfx, args.bgm):
        if not os.path.isfile(p):
            sys.exit(f"[mix] 文件不存在：{p}")

    tmpdir = tempfile.mkdtemp(prefix="mixaudio-")
    bgm_wav = os.path.join(tmpdir, "bgm.wav")

    # 1) 配乐截到片长、统一 44.1k 立体声（不同来源采样率不一致，amix 会错位）
    run(["ffmpeg", "-v", "error", "-y", "-i", args.bgm, "-vn",
         "-t", f"{args.duration}", "-c:a", "pcm_s16le",
         "-ar", "44100", "-ac", "2", bgm_wav], quiet=False)

    sfx_peak, sfx_mean = probe_peak(args.sfx)
    bgm_peak, bgm_mean = probe_peak(bgm_wav)
    if sfx_peak is None or bgm_peak is None:
        sys.exit("[mix] 读不到电平，检查 ffmpeg 是否正常、轨道是否有声音")
    if bgm_peak <= sfx_peak - args.gap:
        print(f"[mix] 配乐本来就比音效低 {sfx_peak - bgm_peak:.1f}dB，不需要再压")

    # 2) 反推两个 volume：音效不衰减（低于上限就原样），配乐压到 (音效峰值 - GAP)
    sfx_out = sfx_peak if sfx_peak <= args.sfx_ceiling else args.sfx_ceiling
    sfx_vol = db_to_volume(sfx_out - sfx_peak)
    bgm_target = sfx_out - args.gap
    bgm_vol = db_to_volume(bgm_target - bgm_peak)

    print(f"[mix] 音效 峰值 {sfx_peak:.1f}dB / 均值 {sfx_mean:.1f}dB -> volume={sfx_vol:.2f}"
          f"（输出峰值 {sfx_out:.1f}dB）")
    print(f"[mix] 配乐 峰值 {bgm_peak:.1f}dB / 均值 {bgm_mean:.1f}dB -> volume={bgm_vol:.3f}"
          f"（目标峰值 {bgm_target:.1f}dB）")
    print(f"[mix] 两者差值 {args.gap:.0f}dB。验收判据：同一时刻有音效处比纯音乐处高 6dB 以上就算能听出，"
          f"8dB 以上算突出")

    fade_out_start = max(0.0, args.duration - args.fade_out)
    chain = (
        f"[1:a]volume={sfx_vol:.3f},aresample=44100,"
        f"aformat=channel_layouts=stereo[s];"
        f"[2:a]volume={bgm_vol:.4f},"
        f"afade=t=in:st=0:d={args.fade_in},"
        f"afade=t=out:st={fade_out_start:.2f}:d={args.fade_out},"
        f"aresample=44100,aformat=channel_layouts=stereo[b];"
        f"[s][b]amix=inputs=2:duration=longest:normalize=0[a]"
    )
    cmd = ["ffmpeg", "-v", "error", "-y",
           "-i", args.video, "-i", args.sfx, "-i", bgm_wav,
           "-filter_complex", chain,
           "-map", "0:v", "-map", "[a]",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
           "-shortest", "-movflags", "+faststart", args.out]
    if args.dry_run:
        print("[mix] dry-run，命令如下：\n" + " ".join(cmd))
        return

    run(cmd, quiet=False)
    if not os.path.isfile(args.out):
        sys.exit("[mix] 混音失败，没产出文件")

    out_peak, _ = probe_peak(args.out)
    print(f"[mix] 成品：{args.out}（{os.path.getsize(args.out)/1e6:.1f}MB，峰值 {out_peak:.1f}dB）")
    print("[mix] 下一步验收：抽 0.5s 窗口，有音效处比纯音乐处高 6dB 以上即合格（8dB 以上更突出）")
    for t in (2.0, 4.5, 6.2):
        print(f"  ffmpeg -v info -ss {t} -t 0.5 -i {args.out} -vn "
              f"-af volumedetect -f null /dev/null 2>&1 | grep max_volume")


if __name__ == "__main__":
    main()
