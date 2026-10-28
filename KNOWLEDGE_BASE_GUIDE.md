# 结构化知识库与用例生成

网页的 XMind 和用例库生成使用以下流程：分析需求和具体主题 → 读取选中主题的完整资料 → 由生成模型判断适用性并生成用例。主题目录只用于定位资料，正文中的数值、限制、子章节、脚注、来源修订和冲突提示在读取阶段保留。角色的具体技能可以独立选择，无需注入整个角色分类。

## 构建主题索引

在项目根目录运行（Windows）：

```powershell
.venv\Scripts\python.exe scripts/knowledge_topics_tool.py build F:\share\sk --dry-run
.venv\Scripts\python.exe scripts/knowledge_topics_tool.py build F:\share\sk
```

macOS/Linux 使用 `.venv/bin/python` 并替换知识库路径。构建只依赖 Python 标准库，不连接平台数据库或模型。

知识库需要已有 `kb-manifest.json`、`manifest.json`、`_llm/docs/` 和原搜索索引。工具从完整 Markdown 构建 `_llm/topics.json`，给 `kb-manifest.json` 增加 `topics_path`、`topics_version`，保留原字段和原资料。主题按标题结构组织，技能子树保持完整，较大的通用章节可按完整子章节拆分并关联父主题。明确的 Wiki 链接提供一跳参考关系；关联信息供 AI 选择，不自动无限扩展正文。

每次同步 Wiki 资料后重新运行构建命令，再将主题文件和清单部署到同一知识库源站。主题内容、元数据或来源修订发生变化会产生新的版本；仅重新执行构建不会改变版本。先发布主题文件，再发布清单；并发发布时若读取版本不一致，本轮跳过知识注入并提示重试。

`F:\share\sk` 已构建为 137 份文档、1230 个主题。原 Markdown、搜索索引和压缩包保留。源站必须能通过原有知识库地址读取新增的 `_llm/topics.json`。

## 检索、预算与复用

- AI 从主题目录中选择直接相关和必要依赖主题，每轮最多 32 个，系统校验返回 ID 和结构后读取完整正文。
- 新主题库不再额外调用 AI 对正文做片段精筛。目录超限时按请求体积分批选择并合并结果；没有主题索引的旧库继续兼容原文档/章节流程。
- 默认正文注入上限为 120000 字符。超过预算时按完整主题省略，界面显示未注入的主题，避免把条件和结果截断。已保存的个人上限保持原值，可在设置中调整。
- 生成前重新检查项目授权和知识版本。需求、目标模块、模型、推理设置、温度或限额变化会重新检索；相同条件下复用已读取结果。
- 冲突、资料不足和旧版本信息随完整资料送入生成模型。新需求优先，未知数值需要确认，不能用旧知识扩展无关需求范围。

## 验证与部署

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests/python -p "test_knowledge_topics*.py" -v
node tests/node/knowledge_topics_pipeline.test.js
npm run test:ui -- tests/ui/xmind_knowledge_base.spec.js --workers=1
```

Python 测试使用临时知识库和权限 mock，浏览器测试使用 API/模型 mock，不连接正式数据库或真实模型。部署平台代码后重启后端、刷新页面加载静态资源；源站同步上述两个派生文件。项目知识库登记和权限要求见 `MCP_GUIDE.md`，API 字段见 `API_DOC.md`。
