from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import unquote, urlsplit


TOPICS_PATH = "_llm/topics.json"
MAX_RELATED_TOPICS = 12
LARGE_SECTION_CHARS = 14000


@dataclass
class _Section:
    level: int
    heading: str
    body: List[str] = field(default_factory=list)
    children: List["_Section"] = field(default_factory=list)


def _read_json(path: Path, default):
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _inside(base_dir: Path, relative_path: str) -> Path:
    path = (base_dir / relative_path).resolve()
    if not path.is_relative_to(base_dir.resolve()):
        raise ValueError("Knowledge path escapes its base directory: " + relative_path)
    return path


def _closing(text: str, start: int, opening: str, closing: str) -> int:
    depth = 0
    position = start
    while position < len(text):
        char = text[position]
        if char == "\\":
            position += 2
            continue
        if char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return position
        position += 1
    return -1


def clean_markdown_links(text: str) -> Tuple[str, List[str]]:
    output = []
    targets = []
    position = 0
    while position < len(text):
        image = text.startswith("![", position)
        bracket = position + 1 if image else position
        if text[bracket:bracket + 1] != "[" or (position > 0 and text[position - 1] == "\\"):
            output.append(text[position])
            position += 1
            continue
        label_end = _closing(text, bracket, "[", "]")
        if label_end < 0 or text[label_end + 1:label_end + 2] != "(":
            output.append(text[position])
            position += 1
            continue
        target_end = _closing(text, label_end + 1, "(", ")")
        if target_end < 0:
            output.append(text[position])
            position += 1
            continue
        target = text[label_end + 2:target_end].strip()
        if "\n" in target or not target:
            output.append(text[position])
            position += 1
            continue
        label, nested_targets = clean_markdown_links(text[bracket + 1:label_end])
        targets.extend(nested_targets)
        targets.append(re.split(r"\s+[\"']", target, maxsplit=1)[0].strip("<>"))
        output.append("（图示：" + label + "）" if image else label)
        position = target_end + 1
    return "".join(output), targets


def _plain(text: str) -> str:
    cleaned, _ = clean_markdown_links(text)
    return re.sub(r"[*_`]+", "", cleaned).strip()


def _parse(text: str, fallback_title: str) -> _Section:
    root = _Section(0, fallback_title)
    stack = [root]
    fence = ""
    title_seen = False
    for line in text.splitlines():
        fence_match = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
        if fence_match:
            marker = fence_match.group(1)
            if not fence:
                fence = marker[0]
            elif marker[0] == fence:
                fence = ""
            stack[-1].body.append(line)
            continue
        heading = None if fence else re.match(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if heading:
            level = len(heading.group(1))
            title = _plain(heading.group(2))
            if level == 1 and not title_seen:
                root.heading = title
                title_seen = True
                continue
            while len(stack) > 1 and stack[-1].level >= level:
                stack.pop()
            section = _Section(level, title)
            stack[-1].children.append(section)
            stack.append(section)
        elif len(stack) > 1 or not re.match(r"^\s*-\s*(模块|来源|抓取时间|Wiki修订ID|Wiki修订时间|页面状态)[:：]", line):
            stack[-1].body.append(line)
    return root


def _render(section: _Section, include_heading: bool = True) -> str:
    parts = []
    if include_heading and section.heading:
        parts.append("#" * max(2, section.level) + " " + section.heading)
    if "\n".join(section.body).strip():
        parts.append("\n".join(section.body).strip())
    parts.extend(_render(child) for child in section.children)
    return "\n\n".join(parts).strip()


def _warning_section(section: _Section) -> bool:
    return bool(re.search(r"Wiki\s*数据说明|来源.*待确认|待确认内容|临时编写日志", section.heading, re.I))


def _kind(title: str, heading_path: List[str], section: _Section) -> str:
    heading = " / ".join(heading_path[1:])
    if _warning_section(section):
        return "warning"
    if re.search(r"更新日志|更新简史|旧版|历史", title + " / " + heading):
        return "history"
    if re.search(r"对白|对话|台词", heading):
        return "dialogue"
    if re.search(r"皮肤|外观|画廊|轶事", heading):
        return "appearance"
    if title in {"首页", "阅读指南", "README"} or title.endswith("目录") or section.heading.endswith("索引"):
        return "overview"
    if section.heading in {"正文", "介绍", "角色总括", "模式总览"} or not heading:
        return "overview"
    return "rule"


def _topic_sections(root: _Section):
    if "\n".join(root.body).strip() or not root.children:
        yield [root.heading], _Section(1, root.heading, list(root.body))
    for section in root.children:
        path = [root.heading, section.heading]
        is_skill = bool(re.fullmatch(r"技能(?:介绍|详解)?", section.heading))
        large = len(clean_markdown_links(_render(section))[0]) > LARGE_SECTION_CHARS and len(section.children) > 1
        if section.children and (is_skill or large):
            if "\n".join(section.body).strip():
                yield path, _Section(section.level, section.heading, list(section.body))
            for child in section.children:
                yield path + [child.heading], child
        else:
            yield path, section


def _footnotes(text: str) -> Dict[str, str]:
    definitions = {}
    for line in text.splitlines():
        matched = re.match(r"^\s*\[\^?(\d+)\]:\s*(.+)$", line)
        if matched:
            definitions[matched.group(1)] = matched.group(2)
    references = set(re.findall(r"\[\[(\d+)\]\]\([^\n)]*#cite_note", text))
    before_warnings = re.split(r"^#{1,6}\s+Wiki\s*数据说明", text, maxsplit=1, flags=re.M | re.I)[0].rstrip()
    tail = []
    for line in reversed(before_warnings.splitlines()):
        if not line.strip():
            continue
        matched = re.match(r"^\s*(\d+)\.\s+(.+)$", line)
        if not matched:
            break
        tail.append((matched.group(1), matched.group(2)))
    tail.reverse()
    if tail and [int(number) for number, _ in tail] == list(range(1, len(tail) + 1)):
        definitions.update({number: value for number, value in tail if number in references})
    return definitions


def _insufficient(section: _Section, content: str) -> bool:
    body = re.sub(r"^\s*#{1,6}\s+.*$", "", content, flags=re.M)
    body = re.sub(r"（图示：[^）]*）|[\s*_|`#>\-]", "", body)
    return len(body) < 10 or (section.heading.endswith("索引") and len(body) < 30)


def _unique(values: List[str]) -> List[str]:
    return list(dict.fromkeys(value for value in values if value))


def _aliases(title: str, section: _Section, heading_path: List[str]) -> List[str]:
    heading = section.heading
    aliases = [title]
    if heading != title:
        aliases.extend([heading, title + heading])
    if any(re.fullmatch(r"技能(?:介绍|详解)?", part) for part in heading_path[1:-1]):
        matched = re.search(r"^\s*([1-9])\s*技能\s*$", "\n".join(section.body), re.M)
        if matched:
            number = int(matched.group(1))
            aliases.extend([title + str(number) + "技能", title + "一二三四五六七八九"[number - 1] + "技能"])
    return _unique(aliases)


def _canonical_url(url: str) -> str:
    parts = urlsplit(url)
    return parts.netloc.lower() + unquote(parts.path).rstrip("/")


def _metadata(text: str) -> dict:
    result = {}
    for name, field_name in [("来源", "source_url"), ("Wiki修订ID", "source_revision_id"), ("Wiki修订时间", "source_revision_timestamp")]:
        matched = re.search(r"^\s*-\s*" + name + r"[:：]\s*(.+)$", text, re.M)
        if matched:
            value = matched.group(1).strip()
            if name == "来源":
                _, targets = clean_markdown_links(value)
                value = targets[0] if targets else value
            result[field_name] = value
    return result


def _add_relations(documents: List[dict], links: Dict[str, List[str]]) -> None:
    by_url = {_canonical_url(doc["source_url"]): doc for doc in documents if doc["source_url"]}
    by_path = {}
    for doc in documents:
        by_path[doc["relative_path"]] = doc
        by_path[doc["clean_path"]] = doc
    for doc in documents:
        general = [topic for topic in doc["topics"] if topic["kind"] == "overview"][:2]
        for topic in doc["topics"]:
            related = [item["topic_id"] for item in general if item["topic_id"] != topic["topic_id"]]
            parent_topics = [item for item in doc["topics"] if item["heading_path"] == topic["heading_path"][:-1]]
            related = [item["topic_id"] for item in parent_topics] + related
            for target in links[topic["topic_id"]]:
                parsed = urlsplit(target)
                other = by_url.get(_canonical_url(target)) if parsed.netloc else None
                if not parsed.netloc and parsed.path:
                    local_path = (Path(doc["relative_path"]).parent / unquote(parsed.path)).as_posix()
                    local_path = os.path.normpath(local_path).replace("\\", "/")
                    other = by_path.get(local_path)
                if not parsed.path and parsed.fragment:
                    other = doc
                if not other:
                    continue
                candidates = [item for item in other["topics"] if item["kind"] in {"rule", "overview", "warning"}]
                anchor = unquote(parsed.fragment).replace("_", " ")
                matching = [item for item in candidates if anchor and anchor in item["heading_path"]]
                chosen = matching[:1] if matching else candidates[:1]
                related.extend(item["topic_id"] for item in chosen if item["topic_id"] != topic["topic_id"])
            topic["related_topic_ids"] = _unique(related)[:MAX_RELATED_TOPICS]


def build_topic_bundle(base_dir: Path) -> dict:
    base_dir = Path(base_dir).resolve()
    kb_manifest = _read_json(base_dir / "kb-manifest.json", {})
    docs_dir = _inside(base_dir, kb_manifest.get("docs_dir", "_llm/docs"))
    if not docs_dir.is_dir():
        raise ValueError("Knowledge Markdown directory does not exist: " + str(docs_dir))
    manifest = _read_json(base_dir / "manifest.json", [])
    metadata = {item["relative_path"]: item for item in manifest if isinstance(item, dict) and item.get("relative_path")}
    index = _read_json(_inside(base_dir, kb_manifest.get("index_path", "_llm/search-index.json")), {})
    index_docs = {}
    for entry in index.get("entries", []):
        if isinstance(entry, dict) and entry.get("clean_path"):
            index_docs.setdefault(entry["clean_path"], entry)
    documents = []
    links = {}
    for path in sorted(docs_dir.rglob("*.md")):
        if not path.resolve().is_relative_to(docs_dir):
            raise ValueError("Knowledge Markdown file escapes docs directory: " + str(path))
        relative_path = path.relative_to(docs_dir).as_posix()
        clean_path = path.relative_to(base_dir).as_posix()
        text = path.read_text(encoding="utf-8-sig")
        root = _parse(text, path.stem)
        indexed = index_docs.get(clean_path, {})
        source = {**_metadata(text), **metadata.get(relative_path, {})}
        doc_id = indexed.get("doc_id") or Path(relative_path).with_suffix("").as_posix()
        module = source.get("module_title") or indexed.get("module") or ""
        source_fields = {key: source.get(key, "") for key in ["source_url", "source_revision_id", "source_revision_timestamp"]}
        doc_warnings = []
        for section in root.children:
            if _warning_section(section):
                warning, _ = clean_markdown_links(_render(section))
                doc_warnings.append(warning)
        definitions = _footnotes(text)
        topics = []
        occurrences = {}
        for heading_path, section in _topic_sections(root):
            raw_content = _render(section, include_heading=False)
            content, targets = clean_markdown_links(raw_content)
            footnote_parts = []
            for number in _unique(re.findall(r"\[\^?(\d+)\]", content)):
                if number in definitions:
                    definition, definition_targets = clean_markdown_links(definitions[number])
                    footnote_parts.append("[" + number + "] " + definition)
                    targets.extend(definition_targets)
            if footnote_parts:
                content += "\n\n参考脚注\n" + "\n".join(footnote_parts)
            signature = json.dumps(heading_path, ensure_ascii=False)
            ordinal = occurrences.get(signature, 0)
            occurrences[signature] = ordinal + 1
            topic_id = doc_id + "::" + hashlib.sha256((signature + ":" + str(ordinal)).encode("utf-8")).hexdigest()[:16]
            kind = _kind(root.heading, heading_path, section)
            warnings = [] if kind == "warning" else list(doc_warnings)
            if _insufficient(section, content):
                warnings.append("资料不足：本主题只有名称、图示或空索引，不能据此确定具体规则或数值。")
            topics.append({
                "topic_id": topic_id, "doc_id": doc_id, "module": module, "title": root.heading,
                "heading_path": heading_path, "aliases": _aliases(root.heading, section, heading_path),
                "summary": re.sub(r"\s+", " ", _plain(content)).strip()[:360], "content": content.strip(),
                "kind": kind, "related_topic_ids": [], "warnings": warnings, **source_fields,
            })
            links[topic_id] = targets
        documents.append({
            "doc_id": doc_id, "module": module, "title": root.heading, "relative_path": relative_path,
            "clean_path": clean_path, **source_fields,
            "aliases": _unique([root.heading] + list(indexed.get("aliases", []))), "topics": topics,
        })
    _add_relations(documents, links)
    stable = {"version": 1, "documents": documents}
    knowledge_version = hashlib.sha256(json.dumps(stable, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    return {"version": 1, "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(), "knowledge_version": knowledge_version, "documents": documents}


def _atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=path.name + ".", suffix=".tmp", delete=False) as stream:
            temporary_path = Path(stream.name)
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def write_topic_bundle(base_dir: Path, bundle: Optional[dict] = None) -> dict:
    base_dir = Path(base_dir).resolve()
    bundle = build_topic_bundle(base_dir) if bundle is None else bundle
    manifest_path = base_dir / "kb-manifest.json"
    manifest = _read_json(manifest_path, {})
    manifest.update({"topics_path": TOPICS_PATH, "topics_version": bundle["knowledge_version"]})
    _atomic_json(_inside(base_dir, TOPICS_PATH), bundle)
    _atomic_json(manifest_path, manifest)
    return bundle
