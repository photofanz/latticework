#!/usr/bin/env python3
"""
merge_edges.py — 合併試點與 5 批代理產出，寫回 site/data/edges.json。

來源檔：
  - site/data/edges.json (試點：24 條經濟×心理)
  - /tmp/edges_batch_1.json … /tmp/edges_batch_5.json

驗證：
  - 每條邊都對應到 models.json 裡某張卡的真實 related 連結
  - 無重複（按無向 key 去重）
  - 預期總數 171 條
"""

from __future__ import annotations
import json
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "site" / "data" / "models.json"
EDGES_OUT = ROOT / "site" / "data" / "edges.json"
EXISTING = ROOT / "site" / "data" / "edges.json"
BATCH_FILES = [Path(f"/tmp/edges_batch_{i}.json") for i in range(1, 6)]


def edge_key(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def main():
    models = json.loads(MODELS.read_text(encoding="utf-8"))
    by_id = {m["id"]: m for m in models}
    real_edges = set()
    for m in models:
        for r in m.get("related", []):
            real_edges.add(edge_key(m["id"], r["id"]))
    print(f"models.json: {len(models)} 張卡 · {len(real_edges)} 條無向 related 邊")

    merged: dict[tuple[int, int], dict] = {}
    sources_log = []

    # 1. seed with pilot
    if EXISTING.exists():
        existing = json.loads(EXISTING.read_text(encoding="utf-8"))
        for e in existing:
            k = edge_key(e["source"], e["target"])
            merged[k] = e
        sources_log.append((str(EXISTING), len(existing)))

    # 2. merge each batch (overrides pilot if both present, though pilot edges are out of batch scope)
    for bf in BATCH_FILES:
        if not bf.exists():
            print(f"  ⚠ {bf} 不存在，先跳過")
            continue
        try:
            data = json.loads(bf.read_text(encoding="utf-8"))
        except Exception as ex:
            print(f"  ✗ {bf} JSON 不合法：{ex}")
            sys.exit(1)
        for e in data:
            k = edge_key(e["source"], e["target"])
            merged[k] = e
        sources_log.append((str(bf), len(data)))

    print("\n來源：")
    for path, n in sources_log:
        print(f"  · {path} → {n} 條")

    # 3. validate each merged edge corresponds to a real related pair
    bad_phantom = []
    for k, e in merged.items():
        if k not in real_edges:
            bad_phantom.append((k, e))
    if bad_phantom:
        print(f"\n  ✗ {len(bad_phantom)} 條邊在 models.json 找不到對應的 related：")
        for k, e in bad_phantom[:10]:
            a, b = k
            na = by_id[a]["name_zh"] if a in by_id else "?"
            nb = by_id[b]["name_zh"] if b in by_id else "?"
            print(f"    #{a:02d} {na} ↔ #{b:02d} {nb}: type={e.get('type')}")
        sys.exit(1)

    # 4. find unclassified
    classified_keys = set(merged.keys())
    unclassified = real_edges - classified_keys
    print(f"\n分類進度：{len(classified_keys)} / {len(real_edges)} 條 ({len(unclassified)} 未分類)")
    if unclassified:
        print("  未分類（前 10）：")
        for k in list(unclassified)[:10]:
            a, b = k
            print(f"    #{a:02d} {by_id[a]['name_zh']} ↔ #{b:02d} {by_id[b]['name_zh']}")

    # 5. type distribution
    types = Counter(e["type"] for e in merged.values())
    print(f"\n類型分佈：")
    for t, n in types.most_common():
        print(f"  {t:<15s} {n} 條")

    # 6. write out
    out_list = sorted(merged.values(), key=lambda e: edge_key(e["source"], e["target"]))
    EDGES_OUT.write_text(json.dumps(out_list, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n寫入 {EDGES_OUT}（{len(out_list)} 條）")


if __name__ == "__main__":
    main()
