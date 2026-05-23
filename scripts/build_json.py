#!/usr/bin/env python3
"""
build_json.py — 從 vault/models/*.md 產生 data/models.json，供 site/ 前端使用。

獨立於 PyYAML / python-markdown，使用最小限度的 stdlib 解析。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VAULT_DIR = ROOT / "vault" / "models"
OUT_FILE = ROOT / "site" / "data" / "models.json"


# ---------------------------------------------------------------------------
# Minimal YAML frontmatter parser
# 僅支援我們的卡片格式：scalar string、整數、list of strings（block 或 inline）
# ---------------------------------------------------------------------------

def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Split a markdown file into (frontmatter_dict, body_markdown)."""
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    raw = parts[1]
    body = parts[2].lstrip("\n")

    data: dict = {}
    lines = raw.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue

        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()

        if val == "" or val is None:
            # block list expected on following lines (- item)
            items = []
            j = i + 1
            while j < len(lines) and re.match(r"^\s+-\s", lines[j]):
                item = lines[j].strip()[1:].strip()
                items.append(unquote(item))
                j += 1
            data[key] = items
            i = j
            continue

        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            items = [unquote(p.strip()) for p in split_csv(inner)] if inner else []
            data[key] = items
        else:
            data[key] = coerce(unquote(val))
        i += 1
    return data, body


def unquote(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        return s[1:-1]
    return s


def split_csv(s: str) -> list[str]:
    # naive split that respects single/double quotes
    out, buf, q = [], [], None
    for ch in s:
        if q:
            buf.append(ch)
            if ch == q:
                q = None
        elif ch in ("'", '"'):
            q = ch
            buf.append(ch)
        elif ch == ",":
            out.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if buf:
        out.append("".join(buf).strip())
    return out


def coerce(v: str):
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    return v


# ---------------------------------------------------------------------------
# Markdown -> HTML (minimal, scoped to our card structure)
# 支援：# / ## / ### headings、段落、無序列表、有序列表、blockquote、
#       **bold**、*italic*、行內 `code`、[[wikilink]]
# ---------------------------------------------------------------------------

def md_to_html(md: str, models_index: dict[str, dict] | None = None) -> str:
    lines = md.splitlines()
    html_parts: list[str] = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # heading
        m = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if m:
            level = len(m.group(1))
            content = inline(m.group(2), models_index)
            html_parts.append(f"<h{level}>{content}</h{level}>")
            i += 1
            continue

        # blockquote (one or more consecutive > lines)
        if line.startswith("> "):
            buf = []
            while i < len(lines) and lines[i].startswith("> "):
                buf.append(lines[i][2:])
                i += 1
            html_parts.append(f"<blockquote>{inline(' '.join(buf), models_index)}</blockquote>")
            continue

        # unordered list
        if re.match(r"^\s*[-*+]\s+", line):
            items = []
            while i < len(lines) and re.match(r"^\s*[-*+]\s+", lines[i]):
                item = re.sub(r"^\s*[-*+]\s+", "", lines[i])
                items.append(f"<li>{inline(item, models_index)}</li>")
                i += 1
            html_parts.append("<ul>" + "".join(items) + "</ul>")
            continue

        # ordered list
        if re.match(r"^\s*\d+\.\s+", line):
            items = []
            while i < len(lines) and re.match(r"^\s*\d+\.\s+", lines[i]):
                item = re.sub(r"^\s*\d+\.\s+", "", lines[i])
                items.append(f"<li>{inline(item, models_index)}</li>")
                i += 1
            html_parts.append("<ol>" + "".join(items) + "</ol>")
            continue

        # blank line
        if not line.strip():
            i += 1
            continue

        # paragraph (gather until blank)
        buf = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not is_block_start(lines[i]):
            buf.append(lines[i])
            i += 1
        html_parts.append(f"<p>{inline(' '.join(buf), models_index)}</p>")

    return "\n".join(html_parts)


def is_block_start(line: str) -> bool:
    return (
        line.startswith("#") or
        line.startswith("> ") or
        bool(re.match(r"^\s*[-*+]\s+", line)) or
        bool(re.match(r"^\s*\d+\.\s+", line))
    )


def inline(text: str, models_index: dict[str, dict] | None) -> str:
    # escape HTML first
    out = (text
           .replace("&", "&amp;")
           .replace("<", "&lt;")
           .replace(">", "&gt;"))

    # wikilinks [[id-name]]
    def wiki_repl(m):
        target = m.group(1).strip()
        # try to resolve to a known model
        if models_index:
            slug = target.replace(" ", "")
            entry = models_index.get(slug) or models_index.get(target)
            if entry:
                return f'<a class="wikilink" data-id="{entry["id"]}" href="#m{entry["id"]}">{entry["name_zh"]}</a>'
        return f'<span class="wikilink-dangling">{target}</span>'
    out = re.sub(r"\[\[([^\]]+)\]\]", wiki_repl, out)

    # bold then italic
    out = re.sub(r"\*\*([^*\n]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", out)

    # inline code
    out = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", out)

    return out


# ---------------------------------------------------------------------------
# Card loader
# ---------------------------------------------------------------------------

def load_cards() -> list[dict]:
    if not VAULT_DIR.exists():
        sys.exit(f"vault models dir missing: {VAULT_DIR}")
    cards = []
    for fp in sorted(VAULT_DIR.glob("*.md")):
        text = fp.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(text)
        if not fm.get("id"):
            print(f"[skip] {fp.name}: missing id in frontmatter", file=sys.stderr)
            continue
        cards.append({
            "id": int(fm["id"]),
            "slug": fm.get("slug", ""),
            "name_zh": fm.get("name_zh", ""),
            "name_en": fm.get("name_en", ""),
            "discipline": fm.get("discipline", ""),
            "tier": fm.get("tier", "reference"),
            "case_anchor": fm.get("case_anchor", ""),
            "tags": fm.get("tags", []) or [],
            "scenarios": fm.get("scenarios", []) or [],
            "_related_raw": fm.get("related", []) or [],
            "_body_md": body,
            "_file": fp.name,
        })
    cards.sort(key=lambda c: c["id"])
    return cards


def build_index(cards: list[dict]) -> dict[str, dict]:
    """Map filename stem (e.g. '01-供需法則') to card dict, for wikilink resolution."""
    idx = {}
    for c in cards:
        stem = c["_file"].removesuffix(".md")
        idx[stem] = c
        idx[c["name_zh"]] = c
    return idx


def extract_summary(body_md: str) -> str:
    """Pull the '一句話定義' content for use as card summary."""
    m = re.search(r"##\s*一句話定義\s*\n+(.+?)(?=\n##|\Z)", body_md, re.DOTALL)
    if m:
        return m.group(1).strip().split("\n")[0].strip()
    # fallback: first non-heading, non-blockquote paragraph
    for line in body_md.splitlines():
        s = line.strip()
        if not s or s.startswith("#") or s.startswith(">"):
            continue
        return s
    return ""


def resolve_related(raw: list[str], index: dict[str, dict]) -> list[dict]:
    out = []
    for item in raw:
        # strip "[[" and "]]" if present
        cleaned = item.strip().strip("[]")
        entry = index.get(cleaned)
        if entry:
            out.append({"id": entry["id"], "name_zh": entry["name_zh"]})
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    cards = load_cards()
    index = build_index(cards)
    out = []
    for c in cards:
        body_md = c.pop("_body_md")
        c.pop("_file")
        raw_related = c.pop("_related_raw")

        c["summary"] = extract_summary(body_md)
        c["body_html"] = md_to_html(body_md, index)
        c["body_text"] = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c["body_html"])).strip()
        c["related"] = resolve_related(raw_related, index)
        out.append(c)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(out)} cards to {OUT_FILE}")


if __name__ == "__main__":
    main()
