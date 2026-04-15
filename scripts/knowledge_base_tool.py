#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


IGNORE_DIRS = {"_llm", ".git", "__pycache__", ".DS_Store"}
DEFAULT_DOCS_DIR = "_llm/docs"
DEFAULT_INDEX_PATH = "_llm/search-index.json"
MAX_SUMMARY_CHARS = 280
MAX_CHUNK_CHARS = 900


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().replace(microsecond=0).isoformat()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def normalize_rel(path: Path) -> str:
    return path.as_posix().lstrip("./")


def is_ignored(path: Path, base_dir: Path) -> bool:
    try:
        parts = path.relative_to(base_dir).parts
    except ValueError:
        return True
    return any(part in IGNORE_DIRS for part in parts)


def extract_heading_title(text: str, fallback: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip() or fallback
    return fallback


def extract_source_url(text: str) -> str:
    patterns = [
        r"-\s*来源：\[[^\]]+\]\((https?://[^)]+)\)",
        r"-\s*来源：\s*(https?://\S+)",
        r"原页面[:：]\s*(https?://\S+)",
    ]
    for pattern in patterns:
        matched = re.search(pattern, text)
        if matched:
            return str(matched.group(1) or "").strip()
    return ""


def extract_module_title(text: str, relative_path: Path) -> str:
    matched = re.search(r"-\s*模块：\s*(.+)", text)
    if matched:
        return str(matched.group(1) or "").strip()
    parent_name = relative_path.parent.name if relative_path.parent and str(relative_path.parent) != "." else ""
    if "_" in parent_name:
        return parent_name.split("_", 1)[1].strip() or parent_name
    return parent_name


def build_doc_id(relative_path: Path) -> str:
    if relative_path.name.lower() == "readme.md" and relative_path.parent and str(relative_path.parent) != ".":
      return relative_path.parent.name
    return relative_path.with_suffix("").as_posix().replace("/", "__")


def tokenize_keywords(text: str, limit: int = 20) -> List[str]:
    tokens: List[str] = []
    seen = set()

    def push(value: str) -> None:
        item = str(value or "").strip()
        if not item:
            return
        lowered = item.lower()
        if lowered in seen:
            return
        seen.add(lowered)
        tokens.append(item)

    for token in re.findall(r"[A-Za-z0-9][A-Za-z0-9_\-]{1,31}", text):
        push(token)
        if len(tokens) >= limit:
            return tokens
    for token in re.findall(r"[\u4e00-\u9fff]{2,24}", text):
        push(token)
        if len(tokens) >= limit:
            return tokens
    return tokens[:limit]


def normalize_excerpt(text: str, limit: int = MAX_SUMMARY_CHARS) -> str:
    compact = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(compact) <= limit:
        return compact
    return compact[:limit].rstrip() + "…"


def split_chunks(text: str, max_chars: int = MAX_CHUNK_CHARS) -> List[Tuple[str, str]]:
    lines = text.splitlines()
    current_heading = ""
    buffer: List[str] = []
    chunks: List[Tuple[str, str]] = []

    def flush() -> None:
        body = "\n".join(buffer).strip()
        if not body:
            buffer[:] = []
            return
        if len(body) <= max_chars:
            chunks.append((current_heading, body))
            buffer[:] = []
            return
        paragraphs = re.split(r"\n{2,}", body)
        temp = ""
        for paragraph in paragraphs:
            part = paragraph.strip()
            if not part:
                continue
            candidate = part if not temp else (temp + "\n\n" + part)
            if temp and len(candidate) > max_chars:
                chunks.append((current_heading, temp))
                temp = part
                continue
            if len(part) > max_chars:
                start = 0
                while start < len(part):
                    section = part[start:start + max_chars]
                    chunks.append((current_heading, section))
                    start += max_chars
                temp = ""
                continue
            temp = candidate
        if temp:
            chunks.append((current_heading, temp))
        buffer[:] = []

    for line in lines:
        stripped = line.strip()
        if re.match(r"^#{1,6}\s+", stripped):
            flush()
            current_heading = re.sub(r"^#{1,6}\s+", "", stripped).strip()
            buffer.append(line)
            continue
        buffer.append(line)
    flush()
    return chunks


@dataclass
class DocRecord:
    source_path: Path
    relative_path: Path
    module_slug: str
    module_title: str
    title: str
    source_url: str
    content: str

    @property
    def clean_rel_path(self) -> Path:
        return Path(DEFAULT_DOCS_DIR) / self.relative_path

    @property
    def doc_id(self) -> str:
        return build_doc_id(self.relative_path)


def discover_markdown_docs(base_dir: Path) -> List[DocRecord]:
    docs: List[DocRecord] = []
    for path in sorted(base_dir.rglob("*.md")):
        if not path.is_file():
            continue
        if is_ignored(path, base_dir):
            continue
        relative_path = path.relative_to(base_dir)
        content = read_text(path)
        title = extract_heading_title(content, path.stem)
        module_slug = relative_path.parent.parts[0] if len(relative_path.parts) > 1 else ""
        if relative_path.name.lower() == "readme.md" and len(relative_path.parts) == 1:
            module_slug = ""
        docs.append(DocRecord(
            source_path=path,
            relative_path=relative_path,
            module_slug=module_slug,
            module_title=extract_module_title(content, relative_path),
            title=title,
            source_url=extract_source_url(content),
            content=content,
        ))
    return docs


def build_manifest(docs: Sequence[DocRecord]) -> List[Dict[str, str]]:
    manifest: List[Dict[str, str]] = []
    for doc in docs:
        manifest.append({
            "module_slug": doc.module_slug,
            "module_title": doc.module_title,
            "title": doc.title,
            "seed_title": doc.title,
            "source_url": doc.source_url,
            "relative_path": normalize_rel(doc.relative_path),
        })
    return manifest


def build_search_index(docs: Sequence[DocRecord]) -> Dict[str, object]:
    generated_at = now_iso()
    entries: List[Dict[str, object]] = []
    for doc in docs:
        aliases = [doc.title]
        if doc.relative_path.name.lower() == "readme.md" and doc.module_title:
            aliases.append(doc.module_title)
        for idx, (heading, chunk_text) in enumerate(split_chunks(doc.content)):
            text = chunk_text.strip()
            if not text:
                continue
            keywords = tokenize_keywords(" ".join([
                doc.module_title,
                doc.title,
                heading,
                doc.relative_path.as_posix(),
                text[:400],
            ]))
            entries.append({
                "doc_id": doc.doc_id,
                "module": doc.module_title,
                "title": doc.title,
                "aliases": aliases,
                "keywords": keywords,
                "summary": normalize_excerpt(text),
                "heading": heading or doc.title,
                "text": text,
                "clean_path": normalize_rel(doc.clean_rel_path),
                "chunk_index": idx,
            })
    return {
        "version": 1,
        "generated_at": generated_at,
        "entries": entries,
    }


def rebuild_knowledge_base(base_dir: Path) -> Dict[str, object]:
    docs = discover_markdown_docs(base_dir)
    generated_at = now_iso()
    docs_root = base_dir / DEFAULT_DOCS_DIR
    if docs_root.exists():
        shutil.rmtree(docs_root)
    docs_root.mkdir(parents=True, exist_ok=True)

    for doc in docs:
        target = base_dir / doc.clean_rel_path
        write_text(target, doc.content)

    manifest = build_manifest(docs)
    index = build_search_index(docs)
    kb_manifest = {
        "version": 1,
        "generated_at": generated_at,
        "docs_dir": DEFAULT_DOCS_DIR,
        "index_path": DEFAULT_INDEX_PATH,
        "doc_count": len(docs),
        "entry_count": len(index.get("entries") or []),
    }
    write_json(base_dir / "manifest.json", manifest)
    write_json(base_dir / "kb-manifest.json", kb_manifest)
    write_json(base_dir / DEFAULT_INDEX_PATH, index)
    return {
        "ok": True,
        "path": str(base_dir),
        "generated_at": generated_at,
        "doc_count": len(docs),
        "entry_count": len(index.get("entries") or []),
        "docs_dir": DEFAULT_DOCS_DIR,
        "index_path": DEFAULT_INDEX_PATH,
    }


def validate_knowledge_base(base_dir: Path) -> Dict[str, object]:
    manifest_path = base_dir / "manifest.json"
    kb_manifest_path = base_dir / "kb-manifest.json"
    missing_files: List[Dict[str, str]] = []
    invalid_paths: List[Dict[str, str]] = []
    warnings: List[str] = []

    if not manifest_path.exists():
        raise FileNotFoundError("缺少 manifest.json")
    if not kb_manifest_path.exists():
        raise FileNotFoundError("缺少 kb-manifest.json")

    manifest = json.loads(read_text(manifest_path))
    kb_manifest = json.loads(read_text(kb_manifest_path))
    index_path = base_dir / str(kb_manifest.get("index_path") or DEFAULT_INDEX_PATH)
    if not index_path.exists():
        raise FileNotFoundError("缺少索引文件: " + str(index_path))
    index_payload = json.loads(read_text(index_path))
    entries = index_payload.get("entries") if isinstance(index_payload, dict) else None
    if not isinstance(manifest, list):
        raise ValueError("manifest.json 格式不正确，必须为数组")
    if not isinstance(entries, list):
        raise ValueError("search-index.json 格式不正确，entries 必须为数组")

    doc_paths = set()
    for item in manifest:
        if not isinstance(item, dict):
            invalid_paths.append({"path": "", "detail": "manifest.json 含有非对象条目"})
            continue
        rel = str(item.get("relative_path") or "").strip()
        if not rel:
            invalid_paths.append({"path": "", "detail": "manifest.json 条目缺少 relative_path"})
            continue
        doc_paths.add(rel)
        if not (base_dir / rel).exists():
            missing_files.append({"path": rel, "detail": "源 Markdown 文件不存在"})

    clean_paths = set()
    for entry in entries:
        if not isinstance(entry, dict):
            invalid_paths.append({"path": "", "detail": "search-index.json 含有非对象条目"})
            continue
        clean_path = str(entry.get("clean_path") or "").strip()
        if not clean_path:
            invalid_paths.append({"path": "", "detail": "索引条目缺少 clean_path"})
            continue
        clean_paths.add(clean_path)
        if not (base_dir / clean_path).exists():
            missing_files.append({"path": clean_path, "detail": "索引引用的清洗文档不存在"})

    declared_doc_count = int(kb_manifest.get("doc_count") or 0)
    declared_entry_count = int(kb_manifest.get("entry_count") or 0)
    if declared_doc_count and declared_doc_count != len(manifest):
        warnings.append("kb-manifest 声明的文档数与 manifest.json 实际条目数不一致")
    if declared_entry_count and declared_entry_count != len(entries):
        warnings.append("kb-manifest 声明的索引条数与 search-index.json 实际条目数不一致")

    return {
        "ok": not missing_files and not invalid_paths,
        "path": str(base_dir),
        "manifest_exists": manifest_path.exists(),
        "kb_manifest_exists": kb_manifest_path.exists(),
        "index_exists": index_path.exists(),
        "docs_dir": str(kb_manifest.get("docs_dir") or DEFAULT_DOCS_DIR),
        "index_path": str(kb_manifest.get("index_path") or DEFAULT_INDEX_PATH),
        "doc_count": len(manifest),
        "entry_count": len(entries),
        "indexed_doc_count": len(clean_paths),
        "missing_files": missing_files,
        "invalid_paths": invalid_paths,
        "warnings": warnings,
    }


def print_payload(payload: Dict[str, object]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="共享知识库 Markdown 结构校验与重建工具")
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate", help="校验 manifest / index / docs 结构")
    validate_parser.add_argument("--path", required=True, help="知识库目录")

    rebuild_parser = subparsers.add_parser("rebuild", help="从本地 Markdown 目录重建 manifest / index / docs")
    rebuild_parser.add_argument("--path", required=True, help="知识库目录")

    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    base_dir = Path(args.path).expanduser().resolve()
    if not base_dir.exists() or not base_dir.is_dir():
        print_payload({
            "ok": False,
            "path": str(base_dir),
            "error": "知识库目录不存在",
        })
        return 1
    try:
        if args.command == "validate":
            payload = validate_knowledge_base(base_dir)
        else:
            payload = rebuild_knowledge_base(base_dir)
        print_payload(payload)
        return 0 if payload.get("ok") else 1
    except Exception as exc:
        print_payload({
            "ok": False,
            "path": str(base_dir),
            "error": str(exc),
        })
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
