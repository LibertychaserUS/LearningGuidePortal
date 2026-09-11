# AUTH / PAY 缺陷清单（黑盒 I/O 对照）

本页只列先前找到的 Registration & Authentication、Payment Management 缺陷。
编号沿用历史叶子：`AUTH-01`..`AUTH-06`、`PAY-01`..`PAY-10`。
不另开一套 ID。

状态含义：

- **已锁**：`tests/io/*.test.ts` 用 HTTP 输入/输出锁住正确行为；`npm run test:io` 覆盖。
- **仅规格**：写在 `suites/payment/cases.md`，可执行 I/O 只覆盖最近的 HTTP 面；完整证明仍要 Stripe / 表约束 / 内部时间。
- **难做纯黑盒**：没有稳定的公开 HTTP 面能单独证明该不变式，或必须伪造 Stripe 对象 / 读内部行。

Overlay 套件 `login` / `payment` 仍是 `draft`。人未 arm 前，`overlay-check` 不会跑这些用例。

---

## AUTH

| ID | 缺陷 | 正确 I/O | 黑盒难度 | 状态 |
|---|---|---|---|---|
| AUTH-01 | `check-email` 返回 `exists`；注册文案写 already exists；pending 登录单独 403；pending 重发单独 429 | 已知/未知邮箱同一 JSON 形（去掉 `requestId`）；没有 `exists`；登录统一 401 `AUTHENTICATION_FAILED`；重发统一 200 | 低。要造 pending 用户时，本地用 `EMAIL_DELIVERY=discard`，不发真实邮件 | 已锁 |
| AUTH-02 | 非生产 `password-reset` JSON 带 `resetUrl` / token | 已知和未知邮箱都是 `{ ok: true }`，正文没有 `resetUrl`、`token`、`token=` | 低 | 已锁 |
| AUTH-03 | `APP_ENV=PRODUCTION` 不算生产：本地社交会话和 resetUrl 仍开 | PRODUCTION 下 reset 不配邮件 → 503 且无 URL；`LOCAL_SOCIAL_LOGIN=1` 的 Google 本地会话 → 503、不发 cookie | 中。要临时改 `APP_ENV`，并给 `NEXT_PUBLIC_APP_URL=https://localhost` 以免 origin 跳走 | 已锁 |
| AUTH-04 | 注册/Google 匹配 `BACKOFFICE_OPERATOR_EMAIL` 写成 operator；`isOperator` 再按环境邮箱提权 | 该邮箱注册后 `/api/auth/me` 仍是 student；`/api/backoffice/courses` 403 | 低。Google 本地画像邮箱固定，HTTP 只锁了注册路径 | 已锁（注册/现场匹配）；Google 注册路径仍难在无 OAuth 时黑盒走到 |
| AUTH-05 | pending 二次注册覆盖 `passwordHash`；并发同邮箱可两用户或后写覆盖 | 第二次注册不接管第一个密码；并发后只有一个密码能登录 | 中。并发在同一进程里靠 `editData` 队列串行，不是跨进程文件锁证明 | 已锁（同进程 HTTP）；跨进程竞态仍难 |
| AUTH-06 | `createSession` 不踢旧会话；改密不失效其它会话 | 第二次登录后第一枚 cookie 的 `/api/auth/me` 为 null；PATCH 改密后原会话 401 | 低 | 已锁 |

---

## PAY

| ID | 缺陷 | 正确 I/O / 规格 | 黑盒难度 | 状态 |
|---|---|---|---|---|
| PAY-01 | `$0` trial 的 `invoice.paid` 把试用写成整段付费 | 规格：`$0` 不得 `convertStripeTrial`。可执行：demo trial 完成后 `validTo` 落在 3 天内，`source=trial` | 高。真 Stripe `$0 invoice.paid` 要真实 subscription 对象 | 规格完整；demo 窗口已锁 |
| PAY-02 | 升级只过期本地行，不向 Stripe 发 cancel | 规格：必须对源 `stripeSubscriptionId` 发 cancel。可执行：无源订阅的 upgrade quote → 400 | 高。没有 Stripe 就不能证明 `stripeCancelIssued` | 仅规格 + HTTP 400 |
| PAY-03 | 同一 quote 再 `sessions.create` 出第二张可付 Session | 规格：复用第一张 Session。可执行：demo 同一 quote 两次 checkout 得到同一 `order.id` | 高。demo 复用订单 ≠ Stripe 未第二次 `sessions.create` | 规格完整；demo 复用已锁 |
| PAY-04 | 退款后 entitlement 不立刻死；随后 `invoice.paid` 复活 | 规格：退款立即 revoked；后到的 invoice 不得激活。可执行：未支付 / 孤儿 paid webhook 不授权 | 高。没有 operator 退款 HTTP，也没有已履约后再投 invoice | 仅规格 + 未支付/孤儿 webhook |
| PAY-05 | 重复成功事件履约两次；`stripe_events` 无表 UNIQUE | 规格：要有表级 UNIQUE。可执行：同一 order 两次 complete 仍只授权一次；同一 signed `ping` 两次 `ignored` | 高。JSON 数组去重不是 UNIQUE；没有第二张 entitlement 列表 API | 规格完整；demo/webhook 近似已锁 |
| PAY-06 | grace 写成 now+3 天，不是原到期日 +3 天 | 规格：`graceEndsAt = 原 validTo + 3d`，且不缩短已付 `validTo`。可执行：未知 sub 的 `invoice.payment_failed` 不授权 | 高。HTTP 看不到 `graceEndsAt` | 仅规格 + 未知失败事件 |
| PAY-07 | `invoice.paid` 清掉 `cancel_at_period_end`，允许 resume | 规格：invoice 后仍是 cancel_at_period_end，resume 拒绝。可执行：demo 取消购买后仍可学，resume → 400 | 中。demo 取消路径可锁；invoice 清标志不能 | 规格完整；cancel/resume HTTP 已锁 |
| PAY-08 | 重叠购买 `filter()` 删掉上一行 entitlement，而不是标 expired | 规格：旧行保留且 `expired`。可执行：课+类目购买后课程仍 allowed；`GET /api/subscription` 仍能看到两个 planId | 中。订阅列表不是 entitlement 审计行；Stripe resync 的 filter-delete 仍在 `applyStripeOrderState` | 已锁（demo 重叠）；Stripe resync 删除仍难 |
| PAY-09 | `checkEntitlement` 忽略 device；有效期内可再 quote 同一 plan | PC 购买后 `device=mobile` → allowed false；再 quote 同 plan → 400 | 低。给 check 增加了可选 `device` 查询参数，否则 HTTP 看不见设备带 | 已锁 |
| PAY-10 | trial 取消后再 `completeDemoTrialOrder` 复活 | 第二次 complete → 400；entitlement 仍 false | 低 | 已锁 |

---

## 为什么有些锁不住

1. **浏览器进不了 Stripe 真路径。** PAY-01 转换、PAY-02 cancel、PAY-03 第二张 Session、PAY-04 退款复活、PAY-05 表 UNIQUE、PAY-06 grace 锚点、PAY-07 invoice 清 cancel，都要 Stripe 对象或表约束。本仓 I/O 只打 `/api/payment/webhook` 的验签 / 未匹配 / 忽略，以及 demo quote / checkout / confirm / trial / subscription。
2. **没有审计列表 API。** PAY-08 要看「旧 entitlement 行还在且 expired」。`GET /api/subscription` 只接近。`GET /api/entitlements/check` 只返回当前是否允许。
3. **没有 operator 退款 HTTP。** PAY-04 的立即撤权在黑盒里走不到，除非另做 Backoffice Payment 的 I/O（仍不是 Stripe refund）。
4. **并发要跨进程。** AUTH-05 旧锁用 worker 进 `productStore`。现在的 I/O 用同进程两次 POST；`editData` 队列会串行，证明不了跨进程 last-write-wins。
5. **不能为了断言去 import `productStore`。** 旧 TDD 直接读 `passwordHash`、`stripeCancelIssued`、`graceEndsAt`、`stripeEvents[]`。黑盒只看 status 和 JSON。

---

## 刻意没做的

- 不把 `test:io` 加进 Verify 的 `test:ci`。
- 不把套件写成 `armed`，不写 `reviewed_by`。
- 不打 `ilovelearningguide.com`。
- 不把 workshop 的 `pr-title` / `sop-lock` 抄进 Learning Guide CI。
- 不为 PAY-01..07 再开一轮白盒 Stripe 内部战役。
