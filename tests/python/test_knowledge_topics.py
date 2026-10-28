import copy
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from backend.knowledge_topics import build_topic_bundle, clean_markdown_links, write_topic_bundle


class KnowledgeTopicsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base_dir = Path(self.temporary.name)
        self.docs_dir = self.base_dir / "_llm" / "docs"
        self.docs_dir.mkdir(parents=True)
        self.manifest = {"version": 1, "docs_dir": "_llm/docs", "index_path": "_llm/search-index.json", "entry_count": 99, "custom": "preserved"}
        self.write_json("kb-manifest.json", self.manifest)
        self.write_json("manifest.json", [])
        self.write_json("_llm/search-index.json", {"entries": []})

    def write_json(self, relative_path, value):
        path = self.base_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")

    def write_doc(self, relative_path, text):
        path = self.docs_dir / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def topics(self, bundle, title):
        return next(document["topics"] for document in bundle["documents"] if document["title"] == title)

    def test_link_cleaning_preserves_numbers_nested_labels_and_unsafe_input(self):
        source = "中级小怪[[1]](https://wiki/game#note-1)时回复2点**生命值**；高级[[2]](https://wiki/game#note-2)回复3点。"
        cleaned, targets = clean_markdown_links(source)
        self.assertEqual(cleaned, "中级小怪[1]时回复2点**生命值**；高级[2]回复3点。")
        self.assertEqual(len(targets), 2)
        cleaned, targets = clean_markdown_links("[![技能图](https://images/game_(1).png)](https://wiki/skill_(one))")
        self.assertEqual(cleaned, "（图示：技能图）")
        self.assertEqual(targets, ["https://images/game_(1).png", "https://wiki/skill_(one)"])
        unsafe = "[未闭合](https://wiki/game\n之后仍有2点生命"
        self.assertEqual(clean_markdown_links(unsafe)[0], unsafe)

    def test_skill_subtree_keeps_all_subsections_numbers_footnotes_and_warnings(self):
        self.write_doc("角色/狼人.md", """# 狼人
- 模块：角色与养成
## 正文
生命上限12，护甲上限2。
## 技能
### 狂化
1 技能
伤害降至1/3。
### 吞噬
3 技能
长按吸引，点按吞噬。
#### 攻击效果
中级小怪[[1]](https://wiki/狼人#cite_note-1)回复2点，高级小怪回复3点。
| 类型 | 恢复 |
| --- | --- |
| 首领 | 3 |
#### 消化增益
持续10秒，最多5层。
## 对话
咕噜咕噜。
1. 尚未明确定义。
## Wiki 数据说明
增益结束行为有冲突，待确认；无法据此统一数值。
""")
        self.write_json("manifest.json", [{"relative_path": "角色/狼人.md", "module_title": "角色与养成", "source_url": "https://wiki/狼人", "source_revision_id": 42, "source_revision_timestamp": "2026-10-21T00:00:00Z"}])
        self.write_json("_llm/search-index.json", {"entries": [{"doc_id": "werewolf", "clean_path": "_llm/docs/角色/狼人.md", "aliases": ["狼人", "吞噬", "狼人三技能"]}]})
        bundle = build_topic_bundle(self.base_dir)
        topics = self.topics(bundle, "狼人")
        swallow = next(topic for topic in topics if topic["heading_path"][-1] == "吞噬")
        self.assertEqual(swallow["heading_path"], ["狼人", "技能", "吞噬"])
        for expected in ["回复2点", "回复3点", "持续10秒", "最多5层", "| 首领 | 3 |", "[1] 尚未明确定义。"]:
            self.assertIn(expected, swallow["content"])
        self.assertIn("狼人三技能", swallow["aliases"])
        self.assertIn("狼人3技能", swallow["aliases"])
        self.assertEqual(swallow["source_revision_id"], 42)
        self.assertEqual(swallow["source_url"], "https://wiki/狼人")
        self.assertEqual(swallow["kind"], "rule")
        self.assertTrue(any("增益结束行为有冲突" in warning for warning in swallow["warnings"]))
        dialogue = next(topic for topic in topics if topic["kind"] == "dialogue")
        self.assertNotIn("吞噬", dialogue["aliases"])
        self.assertNotIn("狼人三技能", dialogue["aliases"])
        self.assertFalse(any(topic["heading_path"][-1] == "攻击效果" for topic in topics))
        self.assertTrue(all(topic["warnings"] for topic in topics if topic["kind"] != "warning"))

    def test_empty_index_and_image_only_sections_have_explicit_warnings(self):
        self.write_doc("实体.md", "# 实体\n## 家具索引\n## 地牢索引\n## 蓄力\n![吸引图](https://wiki/image.png)\n")
        topics = self.topics(build_topic_bundle(self.base_dir), "实体")
        self.assertEqual(len(topics), 3)
        self.assertTrue(all(any("资料不足" in warning for warning in topic["warnings"]) for topic in topics))
        self.assertEqual(topics[-1]["content"], "（图示：吸引图）")

    def test_explicit_wiki_links_add_only_one_hop_and_limit_relations(self):
        self.write_doc("角色.md", "# 角色\n## 正文\n角色基础属性。\n## 技能\n### 吞噬\n3 技能\n触发[免疫伤害](https://wiki/免疫伤害#特殊情况)条件。\n")
        self.write_doc("机制.md", "# 免疫伤害\n## 介绍\n免疫伤害基础说明。\n## 特殊情况\n不能伤害[首领](https://wiki/首领)。\n")
        self.write_doc("首领.md", "# 首领\n## 介绍\n这是一个首领规则。\n")
        self.write_json("manifest.json", [{"relative_path": filename, "source_url": url} for filename, url in [("角色.md", "https://wiki/角色"), ("机制.md", "https://wiki/免疫伤害"), ("首领.md", "https://wiki/首领")]])
        bundle = build_topic_bundle(self.base_dir)
        swallow = next(topic for topic in self.topics(bundle, "角色") if topic["heading_path"][-1] == "吞噬")
        special = next(topic for topic in self.topics(bundle, "免疫伤害") if topic["heading_path"][-1] == "特殊情况")
        boss = self.topics(bundle, "首领")[0]
        self.assertIn(special["topic_id"], swallow["related_topic_ids"])
        self.assertNotIn(boss["topic_id"], swallow["related_topic_ids"])
        self.assertLessEqual(len(swallow["related_topic_ids"]), 12)

    def test_version_is_stable_and_writing_preserves_original_assets(self):
        self.write_doc("规则.md", "# 规则\n## 触发条件\n条件成立时回复2点生命。\n")
        before = {path.relative_to(self.base_dir).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in self.base_dir.rglob("*") if path.is_file()}
        first = build_topic_bundle(self.base_dir)
        second = build_topic_bundle(self.base_dir)
        self.assertEqual(first["knowledge_version"], second["knowledge_version"])
        write_topic_bundle(self.base_dir, first)
        manifest = json.loads((self.base_dir / "kb-manifest.json").read_text(encoding="utf-8"))
        preserved = copy.deepcopy(manifest)
        self.assertEqual(preserved.pop("topics_path"), "_llm/topics.json")
        self.assertEqual(preserved.pop("topics_version"), first["knowledge_version"])
        self.assertEqual(preserved, self.manifest)
        for relative_path, digest in before.items():
            if relative_path != "kb-manifest.json":
                self.assertEqual(hashlib.sha256((self.base_dir / relative_path).read_bytes()).hexdigest(), digest)
        self.assertEqual(build_topic_bundle(self.base_dir)["knowledge_version"], first["knowledge_version"])
        self.write_doc("规则.md", "# 规则\n## 触发条件\n条件成立时回复3点生命。\n")
        changed = build_topic_bundle(self.base_dir)
        self.assertNotEqual(changed["knowledge_version"], first["knowledge_version"])
        self.assertEqual(changed["documents"][0]["topics"][0]["topic_id"], first["documents"][0]["topics"][0]["topic_id"])

    def test_duplicate_headings_have_unique_ids_and_history_is_separate(self):
        self.write_doc("技能更新简史.md", "# 技能更新简史\n## 8.1.0\n旧版规则。\n## 8.1.0\n重复标题后的规则。\n")
        topics = self.topics(build_topic_bundle(self.base_dir), "技能更新简史")
        self.assertEqual(len({topic["topic_id"] for topic in topics}), 2)
        self.assertTrue(all(topic["kind"] == "history" for topic in topics))

    def test_numbered_procedure_is_not_mistaken_for_footnotes(self):
        self.write_doc("机制.md", "# 机制\n## 规则\n选择[1]后执行。\n## 操作流程\n1. 点击操作按钮。\n2. 确认弹窗。\n")
        rule = self.topics(build_topic_bundle(self.base_dir), "机制")[0]
        self.assertNotIn("参考脚注", rule["content"])

    def test_large_subtopics_link_back_to_their_parent_conditions(self):
        content = "# 模式\n## 战斗规则\n仅在战斗状态适用，死亡后清空。\n### 攻击\n" + "攻击造成2点伤害。" * 1800 + "\n### 防御\n防御降低1点伤害。\n"
        self.write_doc("模式.md", content)
        topics = self.topics(build_topic_bundle(self.base_dir), "模式")
        parent = next(topic for topic in topics if topic["heading_path"] == ["模式", "战斗规则"])
        attack = next(topic for topic in topics if topic["heading_path"][-1] == "攻击")
        self.assertIn(parent["topic_id"], attack["related_topic_ids"])

    def test_cli_dry_run_does_not_write(self):
        self.write_doc("规则.md", "# 规则\n## 内容\n足够长度的具体规则，回复2点生命。\n")
        tool = Path(__file__).resolve().parents[2] / "scripts" / "knowledge_topics_tool.py"
        completed = subprocess.run([sys.executable, str(tool), "build", str(self.base_dir), "--dry-run"], capture_output=True, text=True, check=True)
        self.assertTrue(json.loads(completed.stdout)["dry_run"])
        self.assertFalse((self.base_dir / "_llm/topics.json").exists())
        self.assertEqual(json.loads((self.base_dir / "kb-manifest.json").read_text(encoding="utf-8")), self.manifest)

    def test_manifest_cannot_escape_base_directory(self):
        self.write_json("kb-manifest.json", {"docs_dir": "../outside"})
        with self.assertRaisesRegex(ValueError, "escapes"):
            build_topic_bundle(self.base_dir)


if __name__ == "__main__":
    unittest.main()
