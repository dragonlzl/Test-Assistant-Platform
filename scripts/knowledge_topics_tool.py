#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.knowledge_topics import build_topic_bundle, write_topic_bundle


def main() -> None:
    parser = argparse.ArgumentParser(description="Build semantic knowledge topics without changing source Markdown.")
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build")
    build.add_argument("base_dir", type=Path)
    build.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    bundle = build_topic_bundle(args.base_dir)
    if not args.dry_run:
        write_topic_bundle(args.base_dir, bundle)
    print(json.dumps({
        "dry_run": args.dry_run, "knowledge_version": bundle["knowledge_version"],
        "documents": len(bundle["documents"]),
        "topics": sum(len(document["topics"]) for document in bundle["documents"]),
        "topics_path": str(args.base_dir.resolve() / "_llm" / "topics.json"),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
