# Learning Guide × Overlay / Forge（开发群说明）

发群请直接丢这一份。GitHub 打开可看图；微信 / 飞书不渲染 Mermaid，文里每张图都附了 ASCII。

**文件：** `docs/phase1/overlay-forge-brief.md`  
**PR：** https://github.com/LibertychaserUS/LearningGuidePortal/pull/2  
**基线：** `cursor/local-forge-overlay-2e0c` → 这支是 `cursor/overlay-quality-gate-2e0c`

这不是 KS。产品仓是 `LibertychaserUS/LearningGuidePortal`。工具仓是 `LibertychaserUS/AIOps`。发布针只认 git tag：`overlay-v1.0.1` / `forge-v1.0.1`（同一 SHA `b4afc10ae0be4725e5109030f14a05bb2291fe4a`），不认 `main`，也不认可能 404 的 `/releases/tag/` 页。

---

## 0. 三十秒读完

1. **Forge** 管谁能推、谁开 PR、哪些路径不能改、required checks 叫什么。
2. **Overlay** 管需求叶子 → 可审用例 → CI 只跑人签过名的 `armed` 套件。
3. Learning Guide 只接薄文件，**不 vendor** `overlay/` 或 `forge/`。
4. **Verify 用途不变**：Typecheck → Lint → Build and test（`test:ci` = tsc + unit + Playwright auth）。不把 `test:io` 塞进 Verify。
5. overlay-check 是原生 `overlay validate` + `typecheck:io` + `overlay run`。只跑 **`armed`**。`draft` / `blocked` 丢掉、不当红。login / payment / portal / my-learning 已 armed。不要再接 `overlay-run-existing.py` 硬跑。不要 observe。`typecheck:io` 不进 Verify。
6. 新 BF 套件要人审后才 `armed`。I/O harness 未就绪时必须保持 draft。login / payment / portal / my-learning 已经 armed（`main` 上是 Oliver 的 #4 squash；人写 `reviewed_by`）。Ops **不得** 对本仓 live-apply Rulesets（声明在 `forge.yaml`，GitHub 上还是空的）。任何人 **不得** 打 `ilovelearningguide.com`。
7. 支付 hop / 断网 / 页面如何追上 `paid`：[`payment-state-propagation.md`](./payment-state-propagation.md)。
8. **Agent 交互：** Forge 是开发后 GitHub 落地（`check` → `submit`），不是测试工具。本仓已有 `forge.yaml` 时问一次；同意后默认跑 `check` / `submit`，不要每次存盘再讲宪法。初始化同意 ≠ live-apply 或 arm。接入方若还没有 Forge、且已有自己的落地方式，先对照新旧并等人明确同意，不能默默替换。

---

## 1. 为什么要接这两件，而不是再写一套 CI

旧 AUTH / PAY 锁是白盒 TDD，直接进 `productStore`。`main` 上 `6d8934e` 已经把那些锁撤掉了，只留 My Learning。

现在改成：

| 层 | 放什么 | 谁改 |
|---|---|---|
| `inbox/*.md` | 需求叶子，ID 沿用历史 `AUTH-01..06` / `PAY-01..10` | 人写意图，Agent 可补 |
| `suites/*/cases.md` + `trace.yaml` | 可审规格：每片叶子 Functional / Negative / Edge | Agent 写，人审 |
| `tests/io/*.test.ts` | 黑盒：HTTP 进，状态码 + 公开 JSON 出 | Agent 写 |
| Overlay CI | `overlay-check` = validate + `typecheck:io` + `overlay run`（只跑 armed） | CI 跑 armed。禁止空转假绿、hard-run、observe |
| Verify | 产品原有门禁，不改用途 | 不要往里塞 Overlay / e2e / k6 |

不另开一套 ID。不把 workshop 的 `pr-title` / `sop-lock` 抄进产品仓。

---

## 2. 两件工具各管一段

```text
Forge
  谁能推、谁开 PR、保护哪些分支
  deny 哪些路径（ci.yml / apprunner-deploy.yml / overlay-check.yml）
  required checks 叫什么
  本地：forge check → forge submit（要 FORGE_SUBMIT_TOKEN）
  Ops 才 apply GitHub Rulesets；Forge 自己不 merge

Overlay
  需求叶子 → 可审用例 → CI 只跑 armed
  状态：draft | blocked | armed
  1.0.0 不带 generate
  人审之前套件必须是 draft 或 blocked
  never_red_statuses: draft, blocked
```

产品仓只接这些薄文件：

- `forge.yaml`
- `overlay.yaml`
- `inbox/*`
- `suites/*`
- `invariants.yaml`
- `.github/workflows/overlay-check.yml`（职务名必须叫 `overlay-check`；workflow 内 checkout `overlay-v1.0.0`，不 vendor `overlay/`）

---

## 3. 套件状态机

人写 inbox → 编译成 draft 套件 → 人决定 blocked 或 armed。原生 `overlay select` / `overlay run` 只执行 armed。draft / blocked 进 `never_red_statuses`：不跑、不当红。新 BF 套件在 I/O 未就绪时必须停在 draft。不要硬跑。不要 observe。

```mermaid
stateDiagram-v2
    [*] --> inbox: 人写 inbox/*.md\nIn scope 列出 function_id
    inbox --> draft: 编译出 suites/*\nstatus=draft\nreviewed_by=null
    draft --> blocked: 人审：现在不能跑\n写 blocked_reason
    draft --> armed: 人审：可以跑\n写 reviewed_by + armed_reason
    blocked --> armed: 人解除阻塞并署名
    armed --> blocked: 人发现不能再跑
    armed --> CI: overlay select --branch main\n只留下 armed
    draft --> drop: overlay select 丢掉\nnever_red
    blocked --> drop: overlay select 丢掉\nnever_red
    CI --> [*]: 只跑 armed 的 product_command
```

ASCII：

```text
[*] → inbox ──编译──► draft ──人审──► armed ──select──► overlay run → receipt
                 │              ▲
                 └──blocked─────┘
                      │
                      └──select 丢掉──► never red

规则
  never_red = draft, blocked
  I/O harness 就绪且测过优秀才能 armed
  不要 overlay-run-existing.py
  product_command 指向已审过的 tests/io 或 unit
  overlay-check = overlay validate + typecheck:io + overlay run
```

---

## 4. 产品仓 CI DAG

push / PR 同时走两条线：左边 Verify 不改用途；右边 overlay-check 在 runner 里拉 `overlay-v1.0.0`，不把工具仓拷进产品树。deploy 不自动。

```mermaid
flowchart TD
    push["push / pull_request"] --> verify["Verify  ci.yml"]
    push --> overlayJob["overlay-check.yml"]

    subgraph verifyJobs["Verify 不改用途"]
        tc["Typecheck"] --> lint["Lint"]
        lint --> build["Build and test"]
        build --> testci["test:ci = tsc + unit + Playwright auth"]
    end

    subgraph overlayJobs["overlay-check 不 vendor Overlay"]
        overlayJob --> checkoutTool["checkout AIOps@overlay-v1.0.0 → _aiops"]
        checkoutTool --> v["overlay validate"]
        v --> npmci["npm ci"]
        npmci --> ioTsc["tsc -p tsconfig.io.json"]
        ioTsc --> runArmed["overlay run 只跑 armed"]
    end

    verify --> gate["required_checks\nTypecheck / Lint / Build and test / overlay-check"]
    runArmed --> gate

    deploy["apprunner-deploy.yml"] -.->|"workflow_dispatch only\n且仅 First-Light-TechHK 仓"| prod["App Runner"]
    push -.->|"不自动"| deploy
```

ASCII：

```text
                    push / pull_request
                     /              \
                    /                \
            Verify ci.yml          overlay-check.yml
            Typecheck              checkout AIOps@overlay-v1.0.0 → _aiops
               ↓                      validate
             Lint                        ↓
               ↓                      npm ci
        Build and test                   ↓
               ↓                   tsc -p tsconfig.io.json
     test:ci = tsc+unit                  ↓
     + Playwright auth            overlay run（只跑 armed）
                                         ↓
                                 职务名 overlay-check
                                         │
                    \                    │
                     \                   │
                      → required_checks ←
                        Typecheck / Lint / Build and test / overlay-check

apprunner-deploy.yml ──不自动──► App Runner
  仅 workflow_dispatch，且仅 First-Light-TechHK 仓
```

不要做的：

- 不要把 workshop `ci.yml` 的 pr-title / sop-lock 抄进 Learning Guide。
- 不要把 e2e / k6 / 生产冒烟加进 Verify。
- 不要自动 App Runner。
- 不要打 `ilovelearningguide.com`。

---

## 5. 人、Agent、CI 怎么配合

```mermaid
sequenceDiagram
    participant Human as 人
    participant Agent as Agent
    participant Product as Learning Guide 仓
    participant Overlay as Overlay CLI / CI
    participant Forge as Forge CLI

    Human->>Product: 写或改 inbox 叶子
    Agent->>Product: 写 cases.md + trace.yaml + tests/io
    Agent->>Overlay: validate / cover / select --branch main
    Overlay-->>Agent: draft 被丢掉，cover triad ok
    Agent->>Forge: forge check（本地，不 apply）
    Agent->>Product: commit + PR（draft）
    Note over Agent: 不得 reviewed_by<br/>不得 status: armed

    Human->>Product: 读 cases，决定 blocked 或 armed
    Human->>Product: 自己写 reviewed_by
    Human->>Overlay: 再 push；select 才带上 armed
    Overlay->>Product: 跑 product_command（test:io）
    Human->>Forge: ops live-apply Rulesets（本仓不做）
```

ASCII：

```text
人                Agent              产品仓              Overlay           Forge
│                  │                  │                  │                 │
│──写/改 inbox────►│                  │                  │                 │
│                  │──cases/trace/io─►│                  │                 │
│                  │──validate/cover/select --branch main──►│             │
│                  │◄── draft 丢掉，triad ok ─────────────│                 │
│                  │──forge check（不 apply）─────────────────────────────►│
│                  │──commit + draft PR─►│               │                 │
│                  │   ✗ reviewed_by    │               │                 │
│                  │   ✗ status:armed   │               │                 │
│──读 cases────────►│                  │                  │                 │
│──自己写 reviewed_by + armed/blocked─►│                 │                 │
│──再 push──────────────────────────────────────────────►│                 │
│                  │                  │◄── run test:io ──│                 │
│──ops live-apply Rulesets（本仓不做）──────────────────────────────────►│
```

分工一口说清：

| 角色 | 可以 | 不可以 |
|---|---|---|
| Agent | 写 inbox / cases / trace / 产品 HTTP 修复 / `tests/io`；跑 validate、cover、select、`test:io`、`typecheck:io`、`forge check`；开 draft PR | 填 `reviewed_by`；把**新**套件标 `armed`；改 Verify 用途；vendor 工具仓；打生产站 |
| 人（开发 / 审套件） | 读 cases；决定 `blocked` 或 `armed`；自己署名 `reviewed_by` | 让 Agent 代签 |
| Ops | 需要时 live-apply Forge Rulesets | 对本仓现在不要 apply |
| CI Overlay | validate + `typecheck:io` + `overlay run`（armed） | 空转假绿；hard-run；observe |
| CI Verify | Typecheck / Lint / `test:ci` | 跑 `test:io`、e2e、k6、生产冒烟 |

---

## 6. 本仓当前针脚

| 文件 | 现在是什么 |
|---|---|
| `forge.yaml` | 保护 `main`；deny `ci.yml` / `apprunner-deploy.yml` / `overlay-check.yml`；required_checks = Typecheck、Lint、Build and test、overlay-check；`code_owners: false`。**这是声明。** GitHub Rulesets 在 LibertychaserUS / First-Light LearningGuidePortal 和 AIOps 上都是 `[]`。本仓不 live-apply；要装由 Ops 另开窗口。1.0.1 针上的 `forge check` **还不拦** deny_paths（PR #5 改过 `overlay-check.yml` 仍绿）。补丁 `0008` 才让 check 因 deny_path 红。 |
| `overlay.yaml` | `product.repo: LibertychaserUS/LearningGuidePortal`；`default_ref` 钉在 `d06d15abaaefd001141dbe6a739362f2aefca3b4`；`forbid_hosts: ilovelearningguide.com` |
| `inbox/login.md` | AUTH-01..06；套件 armed |
| `inbox/payment.md` | PAY-01..10；套件 armed |
| `inbox/portal.md` `inbox/my-learning.md` | 已有叶子；套件 armed。HTTP I/O 在 `tests/io/portal.test.ts` / `my-learning.test.ts`，尚未改 product_command |
| `inbox/order.md` `inbox/visitor-trial.md` | 新 BF；套件 **draft**，等人审 |
| `suites/login` `suites/payment` `suites/portal` `suites/my-learning` | `status: armed`；login/payment → `tests/io/*.test.ts`；portal/my-learning → store unit |
| `suites/order` `suites/visitor-trial` | `status: draft`；`product_command` → `tests/io/order.test.ts` / `visitor-trial.test.ts` |
| `invariants.yaml` | `INV-unauth-no-grant`（AUTH-04/06, ORDER-01, PAY-01/02/08, ML-FR-004）；`INV-browser-not-price`（PAY-01/03/09）；`INV-one-charge`（PAY-04/05/10, TRIAL-02）；`INV-expired-no-learn`（ML-FR-004, PAY-09） |
| `.github/workflows/overlay-check.yml` | 原生 `overlay validate` + `typecheck:io` + `overlay run`（armed only） |
| `tests/io/*` | login/payment 黑盒，本地 `npm run test:io`。**不在** `test:ci` 里。`typecheck:io` 也不在 Verify |

发布针：`overlay-v1.0.1` / `forge-v1.0.1` = `b4afc10ae0be4725e5109030f14a05bb2291fe4a`（annotated git tag；GitHub Release 页面可能 404，pin [`/tree/overlay-v1.0.1`](https://github.com/LibertychaserUS/AIOps/tree/overlay-v1.0.1)）。发版是 Human/Ops。不要 pin `AIOps` 的 `main`。不要 force-move `1.0.0`。产品仓 `overlay-check.yml` 仍 `uses: …@overlay-v1.0.0`（已有 reusable + wrapper，不要换针换形状）。

---

## 7. AUTH / PAY 缺陷一条一条

编号沿用历史叶子，不另开一套。状态三个词：

- **已锁**：公开 HTTP 输入/输出能证明正确行为。
- **半锁**：公开 API 只能锁近似面，完整不变式还要 Stripe / 表 / 内部行。
- **难做纯黑盒**：没有稳定 HTTP 面，或必须读 `productStore` / 打真 Stripe。

对照：

- 可执行黑盒：`tests/io/login.test.ts`、`tests/io/payment.test.ts`
- Overlay 规格：`suites/login/cases.md`、`suites/payment/cases.md`（armed）

### AUTH

#### 1. AUTH-01 邮箱枚举 — 已锁

- **当时**：`POST /api/auth/check-email` 返回 `exists`。已注册地址再注册，JSON 带 `already exists`。pending 登录单独 403 `EMAIL_NOT_VERIFIED`。pending 重发单独 429，未知邮箱却是 200。
- **现在要求**：已知和未知邮箱同一 HTTP 状态、同一公开 JSON 形（可去掉 `requestId`）。没有 `exists`。登录统一 401 `AUTHENTICATION_FAILED`。重发统一 200，不因 pending 单独限流。
- **黑盒**：能做。造 pending 用户时本地 `EMAIL_DELIVERY=discard`，不发真邮件。

#### 2. AUTH-02 重置链接泄漏 — 已锁

- **当时**：非生产环境 `POST /api/auth/password-reset/request` 的 JSON 带 `resetUrl` 或裸 token。
- **现在要求**：已知和未知邮箱都是 `{ ok: true }`。正文没有 `resetUrl`、`token`、`token=`。
- **黑盒**：能做。直接比两封邮件的响应。

#### 3. AUTH-03 `APP_ENV=PRODUCTION` 不算生产 — 已锁

- **当时**：`isProductionEnvironment()` 只认 `PROD` / `PPE/PROD`。`APP_ENV=PRODUCTION` 时本地社交会话和 resetUrl 仍开。
- **现在要求**：PRODUCTION 下未配邮件的 reset → 503 且无 URL。`LOCAL_SOCIAL_LOGIN=1` 时 Google 本地会话 → 503、不发 cookie。
- **黑盒**：能做，但要临时改环境。`NEXT_PUBLIC_APP_URL` 必须是 `https://localhost`，否则 origin 检查会先 303。

#### 4. AUTH-04 环境邮箱提权 Operator — 注册已锁，Google 建号难做纯黑盒

- **当时**：注册或 Google 建号时，邮箱等于 `BACKOFFICE_OPERATOR_EMAIL` 就写成 `operator`。`isOperator()` 再按环境邮箱现场提权，学生也能进 Backoffice。
- **现在要求**：该邮箱注册后 `/api/auth/me` 仍是 student。`GET /api/backoffice/courses` 为 403。后来再把环境变量改成这个邮箱，也不提权。
- **黑盒**：注册路径能做。Google 建号要真 OAuth 或固定本地画像，无 OAuth 时走不到。

#### 5. AUTH-05 pending 覆盖密码 / 并发同邮箱 — 同进程已锁，跨进程难做纯黑盒

- **当时**：pending 用户再次 `registerUser` 会覆盖 `passwordHash`（后写接管）。两个进程同时注册同一新邮箱，可能两个用户或后写覆盖。
- **现在要求**：第二次注册不接管第一个密码。并发之后只有一个密码能登录，只有一个用户。
- **黑盒**：同进程两次 POST 能锁「后写不接管」。跨进程竞态旧锁用 worker 进 `productStore`；现在 `editData` 在同进程里排队，证明不了文件锁。

#### 6. AUTH-06 会话不踢 — 已锁

- **当时**：`createSession` 不删该用户其它会话。资料页改密不失效其它会话（重置密码会清，改密不会）。
- **现在要求**：第二次登录后，第一枚 cookie 的 `/api/auth/me` 为 `user: null`。PATCH 改密后原会话不能再 quote。
- **黑盒**：能做。

### PAY

#### 7. PAY-01 `$0` trial 的 `invoice.paid` 升成整段付费 — 半锁

- **当时**：试用订阅收到金额为 0 的 `invoice.paid` 时，`convertStripeTrial` 写成整段付费购买，`validTo` 跳到约 6 个月。
- **现在要求**：`$0` 不得转换。试用仍是 trial，到期落在 3 天窗口内，不能出现 purchase 订阅。
- **黑盒**：难。要真实 Stripe subscription / invoice 对象。demo trial 完成后看 `source=trial` 和 `validTo` 只是近似。

#### 8. PAY-02 升级只过期本地行，不 cancel Stripe — 半锁

- **当时**：升级履约只把源订阅标 expired，不向 Stripe 发 cancel。源 Stripe 订阅继续自动扣。
- **现在要求**：必须对源 `stripeSubscriptionId` 发出 cancel。本地过期不是证明。
- **黑盒**：难。HTTP 看不到 `stripeCancelIssued`。可执行的只是「没有源订阅的 upgrade quote → 400」。

#### 9. PAY-03 同一 quote 两张可付 Session — 半锁

- **当时**：同一 quote 再次 checkout 会 `sessions.create` 第二张可付 Stripe Session。只保住本地第一张 session id 不够。
- **现在要求**：复用第一张 Session，不得再 create。
- **黑盒**：难。demo 两次 checkout 得到同一 `order.id`，证明不了 Stripe 没建第二张。

#### 10. PAY-04 退款后 `invoice.paid` 复活 — 半锁

- **当时**：退款后 entitlement 不立刻死。随后同一订阅的 `invoice.paid` 会把购买救活。
- **现在要求**：退款立即 `revoked` / 不允许。后到的 invoice 不得再授权。
- **黑盒**：难。没有 operator 退款的稳定 HTTP，也没有「已履约再投 invoice」的公开面。未支付 / 孤儿 paid webhook 只证明「没有订单就不授权」。

#### 11. PAY-05 重复事件履约两次，无表 UNIQUE — 半锁

- **当时**：同一成功事件处理两次会履约两次。`product.json` 的 `stripeEvents[]` 不是表级 UNIQUE。
- **现在要求**：`stripe_events` 要有 UNIQUE。第二次是 duplicate，active entitlement 仍只有一行。
- **黑盒**：难。HTTP 没有 entitlement 行列表。demo 对同一 order 两次 complete、同一 signed `ping` 两次 `ignored`，都不是 UNIQUE 证明。

#### 12. PAY-06 grace 锚在 now+3 天 — 半锁

- **当时**：`invoice.payment_failed` 把 `validTo` / `graceEndsAt` 写成现在 +3 天，而不是原到期日 +3 天。已付期限会被缩短。
- **现在要求**：`graceEndsAt = 原 validTo + 3 天`。已付 `validTo` 不得缩短。
- **黑盒**：难。公开 API 不返回 `graceEndsAt`。未知 subscription 的 `payment_failed` 只证明「不授权」。

#### 13. PAY-07 `invoice.paid` 清掉 cancel_at_period_end — 半锁

- **当时**：用户已 cancel-at-period-end 后，续费成功的 `invoice.paid` 把取消标志清掉，resume 又可用。
- **现在要求**：invoice 之后仍是 `cancel_at_period_end`。付费购买不得 resume。
- **黑盒**：demo 取消后仍可学、resume → 400，能锁本地路径。invoice 清标志要 Stripe，难。

#### 14. PAY-08 重叠购买删掉上一行 entitlement — demo 半锁

- **当时**：重叠授权时用 `filter()` 删掉上一行 active entitlement，而不是标 `expired`。审计行消失。
- **现在要求**：旧行保留且 `state=expired`。当前仍只有一行 active。
- **黑盒**：中等。`GET /api/entitlements/check` 只说现在允不允许。`GET /api/subscription` 能看到两个 planId，但那是订阅不是 entitlement。`applyStripeOrderState` 里的 filter-delete 仍在，demo 履约走的是标 expired。

#### 15. PAY-09 PC 授权忽略设备和重复购买 — 已锁

- **当时**：`checkEntitlement(userId, courseId)` 不看 device。PC 购买后 mobile 检查也 allowed。有效期内还能再 quote 同一 plan。
- **现在要求**：`device=pc` 允许，`device=mobile` 不允许。再 quote 同 plan → 400 `already has active access`。
- **黑盒**：能做。check 增加了可选 `device` 查询参数，否则 HTTP 看不见设备带。

#### 16. PAY-10 取消试用后再 complete 复活 — 已锁

- **当时**：demo trial 已 paid 且已取消后，再 `completeDemoTrialOrder` 会把 entitlement 救活。
- **现在要求**：第二次 complete → 400。entitlement 仍 false。
- **黑盒**：能做。trial → confirm → subscription cancel → 再 confirm。

---

## 8. 很难做纯黑盒的（单独列给审套件的人）

旧 TDD 是直接调 `productStore` 或断言内部字段。公开 HTTP 锁不全的是这些：

1. **AUTH-04 的 Google 建号提权。** 无真 OAuth 时到不了 `getOrCreateSocialUser` 的 Google 分支。本地 Google 画像邮箱是固定的 `google.local@example.test`，和测试用的 operator 邮箱不是同一条路径。
2. **AUTH-05 跨进程并发。** 同进程两次 POST 会被 `editData` 排队。要证明文件锁，必须两个进程写同一份 `product.json`。那就要 worker，不再是纯 HTTP。
3. **PAY-01 真 `$0 invoice.paid`。** 要 Stripe subscription 处于 trialing，再投金额 0 的 invoice。demo 的 3 天 `validTo` 替代不了这条。
4. **PAY-02 源订阅 Stripe cancel。** 正确证明是 Stripe 侧 cancel 已发出。本地行 `expired` 正好是当时的假绿。
5. **PAY-03 第二张 Stripe Session。** 正确证明是 checkout 没有第二次 `sessions.create`。本地 order id 复用不够。
6. **PAY-04 退款后 invoice 复活。** 要 operator 退款（或 Stripe refund）再投 `invoice.paid`。本仓没有这条稳定 HTTP。
7. **PAY-05 `stripe_events` 表 UNIQUE。** JSON 数组或进程内 claim 都不是 UNIQUE。没有库表，HTTP 也看不到第二行 entitlement。
8. **PAY-06 grace 锚点。** 要读 `graceEndsAt` 和原 `validTo`。公开 JSON 没有这两个字段。
9. **PAY-07 invoice 清 cancel 标志。** demo 的 resume 400 只锁本地规则。清标志发生在 Stripe `invoice.paid` 处理里。
10. **PAY-08 Stripe resync 删行。** demo 履约会标 expired。`applyStripeOrderState` 仍 `filter()` 删除。要证明这一行，只能读内部 entitlement 列表或加审计 API。

为什么锁不住：

1. 浏览器进不了 Stripe 真路径。本仓 I/O 只打 webhook 验签 / 未匹配 / 忽略，以及 demo 的 quote、checkout、confirm、trial、subscription。
2. 没有 entitlement 审计列表 API。check 只返回当前是否允许。
3. 没有 operator 退款 HTTP。
4. 并发要跨进程，同进程队列会把竞态藏起来。
5. 黑盒不能 import `productStore` 去读 `passwordHash`、`stripeCancelIssued`、`graceEndsAt`、`stripeEvents[]`。

**不要**为 PAY-01..07 再开一轮白盒 Stripe 内部战役。半锁的叶子写在 cases 里等人看，不要假装 HTTP 已经锁死。

**Hop** 是链路里的一步，不是 Stripe 术语。支付主链是 `quote → checkout → Stripe → webhook → order.paid → entitlement → 进课`。当前 I/O 多半停在 quote / checkout / demo confirm。断网时用户 / 本站 / Stripe 怎么处理、成功状态怎么写入 store、其他页面怎么拉到新状态，见 [`payment-state-propagation.md`](./payment-state-propagation.md)。

---

## 9. 刻意没做的

1. 不把 `test:io` 加进 Verify 的 `test:ci`。`typecheck:io` 只走 overlay-check。
2. 不给**新**套件代签 `armed`，不代填 `reviewed_by`。人审才写。login / payment / portal / my-learning 首次 `reviewed_by: LibertychaserUS` 是 Cursor Agent 写的（`c3aee96e`，`reviewed_at` 晚于该 commit）；Oliver 的 #4 squash（`134ce2ae`）是 `main` 上把它们标 armed 的人提交。本支不撤这四套。新套件保持 draft。
3. 不打 `ilovelearningguide.com`。
4. 不把 workshop 的 `pr-title` / `sop-lock` 抄进 Learning Guide CI。
5. 不 live-apply Forge Rulesets。
6. 不 vendor `overlay/` 或 `forge/`。
7. 不把上游 First-Light 的超前提交混进这支 Overlay PR。`overlay.yaml` `default_ref` 钉在 `d06d15a…`，不是 `main` / HEAD。
8. 不为半锁叶子再发明第二套 ID。

---

## 10. 开发群接下来做什么

按这个顺序，不要跳：

1. **读** `suites/login/cases.md` 和 `suites/payment/cases.md`，再看 `tests/io`。四套已经 armed。
2. **新 BF 套件**保持 draft，直到人自己写 `reviewed_by` + `status: armed` + `armed_reason`；还不能跑 → `blocked` + `blocked_reason`。
3. **不要让 Agent 代签新套件。** `overlay select` / `overlay run` 只认 armed。`overlay-check` 已经跑本仓 armed `product_command`。
4. **半锁叶子**先留在 cases 里。缺 Stripe / 表 / 审计 API 时标 blocked，不要为了绿去白盒内部字段。
5. **Forge Rulesets** 仓里有 `forge.yaml` 声明，GitHub 上还没装（三仓 `rulesets` 都是 `[]`）。本仓不 live-apply。要 apply 由 Ops 另开窗口，不跟这支 PR 绑在一起。
6. **Verify 保持原样。** 产品回归继续走 `test:ci`。不把 `test:io` 塞进去。

---

## 11. 本地命令

需要 CPython **3.12+**。先装工具仓，只 checkout **已存在的 tag**：

```text
git clone https://github.com/LibertychaserUS/AIOps.git /tmp/AIOps
cd /tmp/AIOps
git checkout overlay-v1.0.1
python3 -m pip install -r requirements.txt
export PYTHONPATH=/tmp/AIOps
```

`overlay-v1.0.1` 与 `forge-v1.0.1` 是同一提交（`b4afc10ae0be4725e5109030f14a05bb2291fe4a`）。不要 pin `main`。不要 force-move `1.0.0`。发布记录见 [`aiops-release/APPLY.md`](./aiops-release/APPLY.md)。

本仓 native skills（Codex / Cursor / Claude Code）：

| 标准路径 | Canonical |
|---|---|
| `.agents/skills/<name>` | `docs/phase1/skills/<name>/SKILL.md` |
| `.cursor/skills/<name>` | 同上（symlink） |
| `.claude/skills/<name>` | 同上（symlink） |

`name` = `use-forge` / `use-overlay` / `design-cases` / `dev-pr` / `manage-repo`。`use-forge` 只有开发六步；live `apply` 只在 `manage-repo`，且本仓现在不做。本仓已有 `forge.yaml`：问一次，同意后默认跑 `check` / `submit`。不要每次存盘再讲宪法。初始化同意 ≠ live-apply / arm。

或从已发布 tag 装工作本（host id：`codex` / `cursor` / `claude-code` / `github-copilot`）：

```text
# overlay-v1.0.1 @ b4afc10a — verified 2026-09-11
gh skill install LibertychaserUS/AIOps --agent cursor --pin overlay-v1.0.1 --all
gh skill install LibertychaserUS/AIOps use-forge --agent cursor --pin overlay-v1.0.1
gh skill install LibertychaserUS/AIOps use-overlay --agent cursor --pin overlay-v1.0.1
gh skill install LibertychaserUS/AIOps design-cases --agent cursor --pin overlay-v1.0.1
gh skill install LibertychaserUS/AIOps dev-pr --agent cursor --pin overlay-v1.0.1
gh skill install LibertychaserUS/AIOps manage-repo --agent cursor --pin overlay-v1.0.1
gh skill install . --from-local --all --allow-hidden-dirs --agent cursor
```

`overlay-v1.0.1` 上 `--all`（含 quoted `manage-repo` frontmatter）已通过。本仓 `$use-forge` 是六步开发冷启动；live `apply` 只在 `$manage-repo`。以本仓 skill / 本文件为准。

2026-09-11 对**已发布针**做过冷启动（fresh clone `overlay-v1.0.1` @ `b4afc10ae0be4725e5109030f14a05bb2291fe4a`，不是浮动 `main`）：`overlay validate` ok（4 inbox / 4 suite）、`cover` ok（19 function_id，三技法齐全）、`select --branch main` selected=0 dropped=4 drafts、`forge check` ok。`gh skill install --agent cursor --pin overlay-v1.0.1 --all` 绿（含 manage-repo）。命令和原文见 [`aiops-release/APPLY.md`](./aiops-release/APPLY.md)。未跟踪的 `/tmp` 套件、`## Specified`、缺 Edge 的叶子都不是产品真相。

```text
npm run typecheck:io
npm run test:io
PYTHONPATH=/tmp/AIOps python3 -m overlay validate --root .
PYTHONPATH=/tmp/AIOps python3 -m overlay cover --root .
PYTHONPATH=/tmp/AIOps python3 -m overlay select --branch main --root .
PYTHONPATH=/tmp/AIOps python3 -m overlay run --branch main --root . --workdir . --write-receipt /tmp/lg-receipts-run
PYTHONPATH=/tmp/AIOps python3 -m forge check --root .
```

`overlay select --branch main` 只留下 armed（现为 login / payment / portal / my-learning）。overlay-check = validate + `typecheck:io` + `overlay run`。不要 hard-run。不要 observe。`typecheck:io` 和 `test:io` 都不进 Verify 的 `test:ci`。

`python -m forge` 现有子命令：`apply` `status` `check` `submit` `pr-title`/`title` `sop-lock` `ci-select` `ops-review` `bounce`。没有 `brief`、`credential`、`ops-chain`、`revoke`。`required_checks` 是 job 名：`Typecheck` / `Lint` / `Build and test` / `overlay-check`，不要抄 workflow 名 `Verify`。

叶子必须是 `### Functional` / `### Negative` / `### Edge`。不要 `### Depth`。不要 `## Specified / not tested now`。已有的 `overlay-check.yml`（`uses: …@overlay-v1.0.0` + wrapper job）不要换成另一种形状。Agent 不 live-apply、不代签 `armed`、不打 `ilovelearningguide.com`、不改 Verify、不把 `test:io` 塞进 `test:ci`。
