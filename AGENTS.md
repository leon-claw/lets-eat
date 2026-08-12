## 工程实现原则

- 选择能够完全满足当前需求的最简单实现。
  避免预防性的抽象、额外配置和不必要的间接层。

- 逐层构建系统。
  从能够端到端运行的最小版本开始，在已经可以正常工作的产品之上逐步增加新的能力。
  不要为了尚未完成的复杂设计，牺牲一个已经能够正常工作的产品。

- 保持组件模块化，并明确分离不同关注点。

- 如果成熟且维护良好的现有库能够降低整体复杂度或提高可靠性，优先使用它。
  没有明确理由，不要重新实现已有的通用功能。

- 在自己实现功能或添加新的依赖包之前，优先利用项目中已经存在的依赖。
  不要在没有检查文档和类型定义之前，就假设某个库不具备所需能力。

- 架构决策要面向长期。
  不要接受“先这样做，以后再替换”的临时方案。

## 产品规格入口

- 在规划、实现或修改产品功能前，必须先阅读
  `docs/superpowers/specs/2026-08-12-food-game-e2e-design.md`。
- 涉及后端、多人同步、数据持久化、部署或测试时，还必须阅读
  `docs/superpowers/specs/2026-08-12-food-game-multiplayer-technical-design.md`。
- 该文档是当前完整 Web 版产品流程和交互规则的主要事实来源。
- 当前 MVP 使用所有用户共享的只读固定菜品库，不提供设置、菜品新增、编辑或图片上传功能。
- Figma 只用于确认视觉布局和层级，不用于补全未写明的业务规则。
- 信息发生冲突时，优先级依次为：用户最新确认、上述本地产品规格、Figma 原型、现有代码与旧文档。
- 如果实现需要改变已确认的产品流程，先更新规格并获得用户确认，再修改代码。

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
