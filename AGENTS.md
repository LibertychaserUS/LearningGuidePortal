# Learning Guide：开发代理规则

本文件是开发人员和 AI coding tool 的强制入口。开始修改代码前，必须先阅读：

1. `docs/phase1/requirements-map.md`
2. `docs/phase1/domain-model.md`
3. `docs/phase1/api-contracts.md`
4. `docs/phase1/release-runbook.md`
5. `DESIGN.md`
6. `docs/phase1/overlay-forge-brief.md` — Overlay / Forge 入口。本地只 pin 已发布的 `overlay-v1.0.0` / `forge-v1.0.0`（同一 SHA `235e514e673fa68b24879c8e139f2a5c6633ebb5`）。不要 pin `main`。不要 checkout 还不存在的 `v1.0.1`（AIOps `main` README 若已写 1.0.1，忽略，等人类发布；补丁在 `docs/phase1/aiops-release/APPLY.md`）。不要 vendor `overlay/` 或 `forge/`。不要 live-apply Forge Rulesets。不要代签 `reviewed_by` / `armed`。不要把 `test:io` 加进 Verify。不要打 `ilovelearningguide.com`。不要改 Verify。

本仓已有 native skills（不要 vendor 工具仓 Python）：`use-forge`（开发冷启动六步，无 live apply）、`use-overlay`、`design-cases`、`dev-pr`、`manage-repo`。标准路径：

- `.agents/skills/`（Codex / 多 host 共用）
- `.cursor/skills/`
- `.claude/skills/`

Canonical：`docs/phase1/skills/<name>/SKILL.md`。或从**已存在的 tag** 装工作本 skill（`gh skill` 没有 `--agent copilot`）：

```text
gh skill install LibertychaserUS/AIOps --agent codex --pin overlay-v1.0.0 --all
gh skill install LibertychaserUS/AIOps --agent cursor --pin overlay-v1.0.0 --all
gh skill install LibertychaserUS/AIOps --agent claude-code --pin overlay-v1.0.0 --all
gh skill install . --from-local --all --allow-hidden-dirs --agent cursor
```

`overlay-v1.0.0` 上的 `use-forge` 仍把 `apply` 写进旧安装步骤；`manage-repo` 的 description 有未加引号的 `Ops only:`，`gh skill install --all` 会失败。本仓 `$use-forge` 才是六步开发冷启动。live `apply` 只在 `$manage-repo`，且本仓现在不做。

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
git -C /tmp/AIOps checkout overlay-v1.0.0
python3 -m pip install -r /tmp/AIOps/requirements.txt
export PYTHONPATH=/tmp/AIOps
python3 -m overlay validate --root .
python3 -m overlay cover --root .
python3 -m forge check --root .
```

需要 CPython 3.12+。`python -m forge` 子命令：`apply` `status` `check` `submit` `pr-title`/`title` `sop-lock` `ci-select` `ops-review` `bounce`（发布针上没有 `brief` / `credential` / `ops-chain` / `revoke`）。`required_checks` 用本仓 CI **job 名**：`Typecheck` / `Lint` / `Build and test` / `overlay-check`（不要抄 workflow 名 `Verify`）。叶子标题必须是 `### Functional` / `### Negative` / `### Edge`；不要写 `### Depth` 或 `## Specified`。`function_id` 全局唯一；invariant 必须对上 `##` 标题。已有的 `overlay-check.yml`（reusable `uses:` + wrapper job）不要换成另一种形状。

## 项目边界

- 这是 Learning Guide Phase 1 生产网站，不是 KS 产品。
- 功能范围只来自七份 PRD：My Learning、Order Management、Payment Management、Portal、Registration & Authentication、Subscription Management、Visitor / Trial。
- KS 是 Study、Understanding/Assessment、AI Tutor 的组成部分。KS Phase 2 可以并行开发，但不能改变 Phase 1 的购买、账户、课程访问和上线链路。
- 旧 Java/Vue 项目只用于核对已有行为和数据，不作为新的部署目标。

## 架构规则

- 只有一个 Next.js 应用，页面和 API Route Handler 在同一仓库、同一部署单元。
- 四个正式环境：DEV、SIT、UAT、PPE/PROD。每个环境是一个 AWS App Runner 服务，使用同一镜像结构和不同配置。
- Cloud 只使用当前约定的轻量服务：App Runner、RDS PostgreSQL、S3、Secrets Manager、CloudWatch、SES；需要外部能力时使用 Stripe、Google、WeChat、OpenRouter。
- 不为每个 Business Function 创建微服务。用 `modules/<business-function>` 隔离代码，用 `services` 处理跨模块流程，用 `repositories` 统一数据访问。
- 浏览器不能决定价格、Order、Payment、Subscription、Entitlement 或 Course 访问权限。所有这些事实由服务端从 PostgreSQL 或受信任的外部回调计算。

## 固定用词

代码、路由、接口文档和页面文案保持图中的词：Role、User Interface、Business Function、Basic Components、Cloud、Channel、Partner；Tourists/Users、Course Manager/Operator；Learning Guide Portal、Learning Guide App、Learning Guide Backoffice Portal；Tourists Visit、User Registration、Purchase、Student Management、Course Management、Study、Understanding/Assessment、Group Study、Order Management、Payment Management、Exploration、AI Tutor、Reporting；User Authentication、Rule Engine、Process Engine、Message Queue、Data Management；Database、Containers、Network、Monitor、Security Strategy。

## 实施要求

- 所有范围内页面均按 `DESIGN.md` 的 Figma 设计依据验收；不能把 UI 对照范围限制为 Excel/PPT 修改清单。修改清单仅约束其涉及的功能。
- 新功能先写数据类型、服务函数和 API contract，再写页面。
- 每个 Route Handler 只做：解析 request、校验输入、取得 session、调用 application service、返回统一结果。
- 业务规则放在 application service 或 Rule Engine；SQL 只放在 repository；Stripe 只在 Payment Management service 调用。
- 涉及 Order、Payment、Subscription、Entitlement 的写入必须可重复执行；Stripe event id、client event id 等外部幂等键必须有唯一约束。
- UI 和静态内容使用 native i18n，默认 `en-GB`，另有 `zh-CN`。课程正文、字幕和 Stripe 页面不是 UI 翻译文件。
- 每个已实现的用户路径至少有一个服务测试和一个页面/API 集成测试；支付 Webhook、未登录访问、过期 Entitlement、重复 Webhook 必须有失败测试。
- 不提交 `.env`、`.env.local`、Stripe secret、OpenRouter key、OAuth secret 或真实个人资料。

## 完成定义

代码只有同时满足以下条件才算完成：

1. 对应 PRD 条目在 `requirements-map.md` 中有实现位置。
2. API、数据库迁移、页面和测试已提交。
3. `npm run build` 通过。
4. 在目标环境按 `release-runbook.md` 完成冒烟测试。
5. 页面状态、错误信息和跳转路径已覆盖，不以“主流程能打开”作为完成标准。
