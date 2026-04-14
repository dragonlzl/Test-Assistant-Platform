#!/usr/bin/env python3
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_ROOT = Path("/Users/linzhenlong/work/元气骑士知识库")
OUTPUT_DOCS_DIR = "_llm/docs"
OUTPUT_INDEX_PATH = "_llm/search-index.json"
OUTPUT_MANIFEST_PATH = "kb-manifest.json"
MAX_SUMMARY_CHARS = 180
MAX_CHUNK_CHARS = 1600
GENERIC_TERMS = {
    "元气骑士",
    "模式",
    "页面",
    "内容",
    "机制",
    "介绍",
    "说明",
    "信息",
    "相关",
    "页面状态",
    "抓取时间",
    "来源",
    "模块",
}

IMAGE_RE = re.compile(r"\[图片:\s*([^\]]+?)\]")
IMAGE_SUFFIX_RE = re.compile(r"\.(png|jpg|jpeg|gif|svg|webp)$", re.IGNORECASE)
MULTI_BLANK_RE = re.compile(r"\n{3,}")
TERM_RE = re.compile(r"[\u4e00-\u9fffA-Za-z0-9·_-]{2,24}")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
NOISE_BREAK_PATTERNS = [
    re.compile(r"^NewPP limit report\b", re.IGNORECASE),
    re.compile(r"^Transclusion expansion time report\b", re.IGNORECASE),
    re.compile(r"^Parser profiling data\b", re.IGNORECASE),
    re.compile(r"^Cache report\b", re.IGNORECASE),
]
NOISE_SKIP_PATTERNS = [
    re.compile(r"^-\s*抓取时间："),
    re.compile(r"^-\s*页面状态："),
    re.compile(r"^-\s*来源："),
    re.compile(r"^Cache statistics", re.IGNORECASE),
]


def parse_args():
    parser = argparse.ArgumentParser(description="整理 Markdown 知识库并生成 LLM 检索契约")
    parser.add_argument("--root", default=str(DEFAULT_ROOT), help="知识库根目录")
    return parser.parse_args()


def main():
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise SystemExit("知识库目录不存在：" + str(root))

    docs_dir = root / OUTPUT_DOCS_DIR
    docs_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    doc_count = 0
    for md_path in sorted(iter_markdown_files(root)):
        relative_path = md_path.relative_to(root)
        raw_text = md_path.read_text(encoding="utf-8")
        cleaned_text = clean_markdown(raw_text)
        if not cleaned_text.strip():
            continue

        clean_path = docs_dir / relative_path
        clean_path.parent.mkdir(parents=True, exist_ok=True)
        clean_path.write_text(cleaned_text.rstrip() + "\n", encoding="utf-8")

        metadata = build_doc_metadata(relative_path, cleaned_text)
        chunks = build_chunks(cleaned_text, metadata)
        if not chunks:
            continue

        doc_count += 1
        for chunk_index, chunk in enumerate(chunks):
            entries.append({
                "doc_id": metadata["doc_id"],
                "module": metadata["module"],
                "title": metadata["title"],
                "aliases": metadata["aliases"],
                "keywords": metadata["keywords"],
                "summary": metadata["summary"],
                "heading": chunk["heading"],
                "text": chunk["text"],
                "clean_path": str(Path(OUTPUT_DOCS_DIR) / relative_path),
                "chunk_index": chunk_index,
            })

    generated_at = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    index_payload = {
        "version": 1,
        "generated_at": generated_at,
        "entries": entries,
    }
    manifest_payload = {
        "version": 1,
        "generated_at": generated_at,
        "docs_dir": OUTPUT_DOCS_DIR,
        "index_path": OUTPUT_INDEX_PATH,
        "doc_count": doc_count,
        "entry_count": len(entries),
    }

    (root / OUTPUT_INDEX_PATH).write_text(
        json.dumps(index_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (root / OUTPUT_MANIFEST_PATH).write_text(
        json.dumps(manifest_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps({
        "root": str(root),
        "doc_count": doc_count,
        "entry_count": len(entries),
        "manifest": OUTPUT_MANIFEST_PATH,
        "index": OUTPUT_INDEX_PATH,
        "docs_dir": OUTPUT_DOCS_DIR,
    }, ensure_ascii=False, indent=2))


def iter_markdown_files(root: Path):
    for path in root.rglob("*.md"):
        relative = path.relative_to(root)
        if relative.parts and relative.parts[0] == "_llm":
            continue
        yield path


def clean_markdown(text: str) -> str:
    result_lines = []
    for raw_line in text.splitlines():
        line = str(raw_line or "").rstrip()
        if should_break_on_noise(line):
            break
        if should_skip_line(line):
            continue
        line = IMAGE_RE.sub(lambda match: clean_image_alt(match.group(1)), line)
        line = re.sub(r"\s+\|\s+", " | ", line)
        line = re.sub(r"[ \t]+", " ", line).rstrip()
        if line == "|" or line == "| |":
            continue
        if line.startswith("## 正文") and not result_lines:
            continue
        result_lines.append(line)

    cleaned = "\n".join(trim_blank_lines(result_lines)).strip()
    cleaned = MULTI_BLANK_RE.sub("\n\n", cleaned)
    return cleaned


def clean_image_alt(value: str) -> str:
    text = str(value or "").strip()
    text = IMAGE_SUFFIX_RE.sub("", text)
    return text


def should_break_on_noise(line: str) -> bool:
    text = str(line or "").strip()
    if not text:
        return False
    return any(pattern.search(text) for pattern in NOISE_BREAK_PATTERNS)


def should_skip_line(line: str) -> bool:
    text = str(line or "").strip()
    if not text:
        return False
    return any(pattern.search(text) for pattern in NOISE_SKIP_PATTERNS)


def trim_blank_lines(lines):
    result = []
    blank_pending = False
    for raw_line in lines:
        line = str(raw_line or "").rstrip()
        if not line:
            if blank_pending:
                continue
            blank_pending = True
            result.append("")
            continue
        blank_pending = False
        result.append(line)
    while result and not result[0]:
        result.pop(0)
    while result and not result[-1]:
        result.pop()
    return result


def build_doc_metadata(relative_path: Path, cleaned_text: str):
    lines = [line for line in cleaned_text.splitlines() if line.strip()]
    title = relative_path.stem
    for line in lines:
        match = HEADING_RE.match(line.strip())
        if match and match.group(1) == "#":
            title = match.group(2).strip() or title
            break

    module = extract_module_name(relative_path)
    headings = extract_headings(cleaned_text)
    summary = build_summary(cleaned_text, title)
    aliases = build_aliases(title, relative_path)
    keywords = build_keywords(cleaned_text, title, module, headings)
    return {
        "doc_id": str(relative_path.with_suffix("")),
        "module": module,
        "title": title,
        "aliases": aliases,
        "keywords": keywords,
        "summary": summary,
    }


def extract_module_name(relative_path: Path) -> str:
    if len(relative_path.parts) <= 1:
        return ""
    folder = str(relative_path.parts[0] or "").strip()
    folder = re.sub(r"^\d+[_-]?", "", folder)
    return folder


def extract_headings(text: str):
    headings = []
    for line in text.splitlines():
        match = HEADING_RE.match(line.strip())
        if not match:
            continue
        heading = match.group(2).strip()
        if heading:
            headings.append(heading)
    return headings


def build_summary(text: str, title: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            continue
        if stripped.startswith("|"):
            continue
        lines.append(stripped)
        if len(" ".join(lines)) >= MAX_SUMMARY_CHARS:
            break
    summary = " ".join(lines).strip()
    if not summary:
        summary = title
    if len(summary) > MAX_SUMMARY_CHARS:
        summary = summary[: MAX_SUMMARY_CHARS - 1].rstrip() + "…"
    return summary


def build_aliases(title: str, relative_path: Path):
    values = [
        title,
        relative_path.stem,
        re.sub(r"[·•・\-_/]+", " ", title).strip(),
        re.sub(r"[·•・\-_/]+", "", title).strip(),
    ]
    aliases = []
    seen = set()
    for item in values:
        text = str(item or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        aliases.append(text)
    return aliases


def build_keywords(text: str, title: str, module: str, headings):
    counts = {}
    for seed in [title, module] + list(headings):
        add_keyword_token(seed, counts, bonus=4)
    for match in TERM_RE.findall(text):
        add_keyword_token(match, counts, bonus=1)
    ranked = sorted(counts.items(), key=lambda item: (-item[1], -len(item[0]), item[0]))
    return [item[0] for item in ranked[:18]]


def add_keyword_token(raw: str, counts, bonus: int):
    token = str(raw or "").strip()
    if not token:
        return
    token = IMAGE_SUFFIX_RE.sub("", token)
    if len(token) < 2 or len(token) > 24:
        return
    if token in GENERIC_TERMS:
        return
    counts[token] = counts.get(token, 0) + bonus


def build_chunks(cleaned_text: str, metadata):
    title = metadata["title"]
    sections = []
    current_heading = title
    current_lines = []

    def flush():
        if not current_lines:
            return
        chunk_text = "\n".join(trim_blank_lines(current_lines)).strip()
        if not chunk_text:
            return
        for piece in split_long_chunk(chunk_text):
            sections.append({
                "heading": current_heading,
                "text": piece,
            })

    for raw_line in cleaned_text.splitlines():
        line = str(raw_line or "").rstrip()
        match = HEADING_RE.match(line.strip())
        if match and match.group(1) == "##":
            flush()
            current_heading = match.group(2).strip() or title
            current_lines = []
            continue
        if match and match.group(1) == "#":
            continue
        current_lines.append(line)
    flush()
    if not sections:
        fallback = cleaned_text.strip()
        if fallback:
            sections.append({
                "heading": title,
                "text": fallback,
            })
    return sections


def split_long_chunk(text: str):
    source = str(text or "").strip()
    if not source:
        return []
    if len(source) <= MAX_CHUNK_CHARS:
        return [source]
    paragraphs = [part.strip() for part in source.split("\n\n") if part.strip()]
    chunks = []
    current = []
    current_len = 0
    for part in paragraphs:
        addition = len(part) + (2 if current else 0)
        if current and current_len + addition > MAX_CHUNK_CHARS:
            chunks.append("\n\n".join(current).strip())
            current = [part]
            current_len = len(part)
            continue
        current.append(part)
        current_len += addition
    if current:
        chunks.append("\n\n".join(current).strip())
    return [chunk for chunk in chunks if chunk]


if __name__ == "__main__":
    main()
