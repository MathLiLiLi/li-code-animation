#!/usr/bin/env python3
"""self-update.py — 从 GitHub 拉最新技能包，比对版本并可选覆盖自身。

设计原则：
- 默认只「检查」，不动机器上的文件；要覆盖必须显式 --apply。
- 覆盖前先把当前技能目录整份备份成 `<技能名>.bak-<时间戳>`，改坏了能回滚。
- 网络不通、仓库没版本文件、校验不过，一律**不阻塞使用**：打印原因，退出码 0。

版本号来源：技能根目录的 `VERSION` 文件（纯文本，如 `2.1.0`）。
仓库根目录由 GitHub Actions 自动生成 `version.json`（比对用）和 `li-code-animation.zip`（下载用）。

用法：
  python3 scripts/self-update.py --check     # 只看有没有新版（默认）
  python3 scripts/self-update.py --apply     # 有新版就下载覆盖（先备份）
  python3 scripts/self-update.py --apply --force   # 同版本也强制覆盖
"""
import argparse
import hashlib
import json
import shutil
import sys
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

REPO = "MathLiLiLi/li-code-animation"
BRANCH = "main"
RAW = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}"
TIMEOUT = 10

SKILL = Path(__file__).resolve().parent.parent
SKILL_NAME = SKILL.name


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "li-code-animation-selfupdate/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        data = resp.read()
    return data if binary else data.decode("utf-8")


def ver_tuple(v):
    """'2.1.0' -> (2,1,0)；取不到数字的段落按 0。"""
    out = []
    for part in str(v).strip().split("."):
        digits = "".join(ch for ch in part if ch.isdigit())
        out.append(int(digits) if digits else 0)
    return tuple(out) + (0, 0, 0)


def local_version():
    f = SKILL / "VERSION"
    if not f.exists():
        return None
    return f.read_text(encoding="utf-8").strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只检查（默认行为）")
    ap.add_argument("--apply", action="store_true", help="有新版就下载并覆盖")
    ap.add_argument("--force", action="store_true", help="版本相同也覆盖")
    ap.add_argument("--json", action="store_true", help="输出 JSON，供脚本调用")
    args = ap.parse_args()

    local = local_version()
    if local is None:
        print(f"[update] 技能目录里没有 VERSION 文件，判定为非官方包，跳过。路径：{SKILL}")
        return 0

    try:
        meta = json.loads(fetch(f"{RAW}/version.json"))
    except Exception as e:
        if args.json:
            print(json.dumps({"local": local, "remote": None, "error": type(e).__name__,
                              "applied": False}, ensure_ascii=False))
        else:
            print(f"[update] 读取远端版本失败（{type(e).__name__}），可能没网或被墙，继续用本地 {local} 版")
        return 0

    remote = str(meta.get("version", "0")).strip()
    zip_name = meta.get("zip", "li-code-animation.zip")
    remote_sha = meta.get("sha256", "")

    newer = ver_tuple(remote) > ver_tuple(local)
    need = newer or args.force

    result = {
        "local": local,
        "remote": remote,
        "newer": newer,
        "commit": meta.get("commit", ""),
        "generated_at": meta.get("generated_at", ""),
        "applied": False,
    }

    if args.json:
        pass  # 最后统一 dumps
    else:
        print(f"[update] 本地 {local} ｜ 远端 {remote}" +
              (f"（{meta.get('generated_at','')[:10]} 更新）" if meta.get("generated_at") else ""))
        if not newer:
            print("[update] 已是最新版，不用动。" if not args.force else "[update] 版本相同，按 --force 强制覆盖。")

    if not need or not args.apply:
        if args.json:
            print(json.dumps(result, ensure_ascii=False))
        elif newer:
            print(f"[update] 有新版本。要更新请跑：python3 {Path(__file__).name} --apply")
        return 0

    # ---- 下载并覆盖 ----
    try:
        blob = fetch(f"{RAW}/{zip_name}", binary=True)
    except Exception as e:
        print(f"[update] 下载技能包失败（{type(e).__name__}），保持本地版本")
        return 0

    if remote_sha:
        got = hashlib.sha256(blob).hexdigest()
        if got != remote_sha:
            print(f"[update] 校验不符，拒绝覆盖。远端声明 {remote_sha[:12]}…，实际 {got[:12]}…")
            return 0

    tmp = Path(tempfile.mkdtemp(prefix="li-update-"))
    zpath = tmp / zip_name
    zpath.write_bytes(blob)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(tmp)
    src = tmp / SKILL_NAME
    if not src.is_dir():
        print(f"[update] 包内找不到顶层目录 {SKILL_NAME}/，包结构不对，拒绝覆盖")
        return 0

    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup = SKILL.parent / f"{SKILL_NAME}.bak-{stamp}"
    shutil.copytree(SKILL, backup)
    shutil.copytree(src, SKILL, dirs_exist_ok=True)

    result["applied"] = True
    result["backup"] = str(backup)
    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(f"[update] 已更新到 {remote} 版")
        print(f"[update] 原版本备份在：{backup}")
        print("[update] 新技能在**下个会话**生效（当前会话仍用旧文件的缓存）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
