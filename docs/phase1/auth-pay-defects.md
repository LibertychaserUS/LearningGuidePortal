# AUTH / PAY 缺陷清单

一条一条列出先前发现的 Registration & Authentication、Payment Management 缺陷。
编号沿用历史叶子：`AUTH-01`..`AUTH-06`、`PAY-01`..`PAY-10`。不另开一套 ID。

对照文件：

- 可执行黑盒：`tests/io/login.test.ts`、`tests/io/payment.test.ts`（`npm run test:io`）
- Overlay 规格：`suites/login/cases.md`、`suites/payment/cases.md`（套件仍是 `draft`）

状态：

- **已锁**：HTTP 输入/输出能证明正确行为。
- **半锁**：公开 API 只能锁住近似面，完整不变式还要 Stripe / 表 / 内部行。
- **难做纯黑盒**：没有稳定 HTTP 面能单独证明，或必须读 `productStore` / 打真 Stripe。

---

## 一、AUTH 已发现的缺陷

### 1. AUTH-01 邮箱枚举

- **缺陷**：`POST /api/auth/check-email` 返回 `exists`。已注册地址再注册，JSON 文案带 `already exists`。pending 账号登录单独 403 `EMAIL_NOT_VERIFIED`。pending 重发验证信单独 429，未知邮箱却是 200。
- **正确行为**：已知和未知邮箱同一 HTTP 状态、同一公开 JSON 形（可去掉 `requestId`）。没有 `exists`。登录统一 401 `AUTHENTICATION_FAILED`。重发统一 200，不因 pending 单独限流。
- **黑盒**：能做。造 pending 用户时本地设 `EMAIL_DELIVERY=discard`，不发真实邮件。
- **状态**：已锁。

### 2. AUTH-02 重置链接泄漏

- **缺陷**：非生产环境 `POST /api/auth/password-reset/request` 的 JSON 带 `resetUrl` 或裸 token。
- **正确行为**：已知和未知邮箱都是 `{ ok: true }`。正文没有 `resetUrl`、`token`、`token=`。
- **黑盒**：能做。直接比两封邮件的响应。
- **状态**：已锁。

### 3. AUTH-03 `APP_ENV=PRODUCTION` 不算生产

- **缺陷**：`isProductionEnvironment()` 只认 `PROD` / `PPE/PROD`。`APP_ENV=PRODUCTION` 时本地社交会话和 resetUrl 仍开。
- **正确行为**：PRODUCTION 下未配邮件的 reset → 503 且无 URL。`LOCAL_SOCIAL_LOGIN=1` 时 Google 本地会话 → 503、不发 cookie。
- **黑盒**：能做，但要临时改环境。`NEXT_PUBLIC_APP_URL` 必须是 `https://localhost`，否则 origin 检查会先 303。
- **状态**：已锁。

### 4. AUTH-04 环境邮箱提权 Operator

- **缺陷**：注册或 Google 建号时，邮箱等于 `BACKOFFICE_OPERATOR_EMAIL` 就写成 `operator`。`isOperator()` 再按环境邮箱现场提权，学生也能进 Backoffice。
- **正确行为**：该邮箱注册后 `/api/auth/me` 仍是 student。`GET /api/backoffice/courses` 为 403。后来再把环境变量改成这个邮箱，也不提权。
- **黑盒**：注册路径能做。Google 建号要真 OAuth 或固定本地画像，无 OAuth 时走不到。
- **状态**：注册和现场匹配已锁。Google 建号路径难做纯黑盒。

### 5. AUTH-05 pending 覆盖密码 / 并发同邮箱

- **缺陷**：pending 用户再次 `registerUser` 会覆盖 `passwordHash`（后写接管）。两个进程同时注册同一新邮箱，可能两个用户或后写覆盖。
- **正确行为**：第二次注册不接管第一个密码。并发之后只有一个密码能登录，只有一个用户。
- **黑盒**：同进程两次 POST 能锁「后写不接管」。跨进程竞态旧锁用 worker 进 `productStore`；现在 `editData` 在同进程里排队，证明不了文件锁。
- **状态**：同进程 HTTP 已锁。跨进程竞态难做纯黑盒。

### 6. AUTH-06 会话不踢

- **缺陷**：`createSession` 不删该用户其它会话。资料页改密不失效其它会话（重置密码会清，改密不会）。
- **正确行为**：第二次登录后，第一枚 cookie 的 `/api/auth/me` 为 `user: null`。PATCH 改密后原会话不能再 quote。
- **黑盒**：能做。
- **状态**：已锁。

---

## 二、PAY 已发现的缺陷

### 7. PAY-01 `$0` trial 的 `invoice.paid` 升成整段付费

- **缺陷**：试用订阅收到金额为 0 的 `invoice.paid` 时，`convertStripeTrial` 写成整段付费购买，`validTo` 跳到约 6 个月。
- **正确行为**：`$0` 不得转换。试用仍是 trial，到期落在 3 天窗口内，不能出现 purchase 订阅。
- **黑盒**：难。要真实 Stripe subscription / invoice 对象。demo trial 完成后看 `source=trial` 和 `validTo` 只是近似。
- **状态**：半锁。规格在 cases；demo 窗口已锁；真 `$0 invoice.paid` 难做纯黑盒。

### 8. PAY-02 升级只过期本地行，不 cancel Stripe

- **缺陷**：升级履约只把源订阅标 expired，不向 Stripe 发 cancel。源 Stripe 订阅继续自动扣。
- **正确行为**：必须对源 `stripeSubscriptionId` 发出 cancel。本地过期不是证明。
- **黑盒**：难。HTTP 看不到 `stripeCancelIssued`。可执行的只是「没有源订阅的 upgrade quote → 400」。
- **状态**：半锁。真 Stripe cancel 难做纯黑盒。

### 9. PAY-03 同一 quote 两张可付 Session

- **缺陷**：同一 quote 再次 checkout 会 `sessions.create` 第二张可付 Stripe Session。只保住本地第一张 session id 不够。
- **正确行为**：复用第一张 Session，不得再 create。
- **黑盒**：难。demo 两次 checkout 得到同一 `order.id`，证明不了 Stripe 没建第二张。
- **状态**：半锁。demo 复用已锁；Stripe 第二张 Session 难做纯黑盒。

### 10. PAY-04 退款后 `invoice.paid` 复活

- **缺陷**：退款后 entitlement 不立刻死。随后同一订阅的 `invoice.paid` 会把购买救活。
- **正确行为**：退款立即 `revoked` / 不允许。后到的 invoice 不得再授权。
- **黑盒**：难。没有 operator 退款的稳定 HTTP，也没有「已履约再投 invoice」的公开面。未支付 / 孤儿 paid webhook 只证明「没有订单就不授权」。
- **状态**：半锁。退款复活难做纯黑盒。

### 11. PAY-05 重复事件履约两次，无表 UNIQUE

- **缺陷**：同一成功事件处理两次会履约两次。`product.json` 的 `stripeEvents[]` 不是表级 UNIQUE。
- **正确行为**：`stripe_events` 要有 UNIQUE。第二次是 duplicate，active entitlement 仍只有一行。
- **黑盒**：难。HTTP 没有 entitlement 行列表。demo 对同一 order 两次 complete、同一 signed `ping` 两次 `ignored`，都不是 UNIQUE 证明。
- **状态**：半锁。表 UNIQUE 难做纯黑盒。

### 12. PAY-06 grace 锚在 now+3 天

- **缺陷**：`invoice.payment_failed` 把 `validTo` / `graceEndsAt` 写成现在 +3 天，而不是原到期日 +3 天。已付期限会被缩短。
- **正确行为**：`graceEndsAt = 原 validTo + 3 天`。已付 `validTo` 不得缩短。
- **黑盒**：难。公开 API 不返回 `graceEndsAt`。未知 subscription 的 `payment_failed` 只证明「不授权」。
- **状态**：半锁。grace 锚点难做纯黑盒。

### 13. PAY-07 `invoice.paid` 清掉 cancel_at_period_end

- **缺陷**：用户已 cancel-at-period-end 后，续费成功的 `invoice.paid` 把取消标志清掉，resume 又可用。
- **正确行为**：invoice 之后仍是 `cancel_at_period_end`。付费购买不得 resume。
- **黑盒**：demo 取消后仍可学、resume → 400，能锁本地路径。invoice 清标志要 Stripe，难。
- **状态**：半锁。cancel/resume HTTP 已锁；invoice 清标志难做纯黑盒。

### 14. PAY-08 重叠购买删掉上一行 entitlement

- **缺陷**：重叠授权时用 `filter()` 删掉上一行 active entitlement，而不是标 `expired`。审计行消失。
- **正确行为**：旧行保留且 `state=expired`。当前仍只有一行 active。
- **黑盒**：中等。`GET /api/entitlements/check` 只说现在允不允许。`GET /api/subscription` 能看到两个 planId，但那是订阅不是 entitlement。`applyStripeOrderState` 里的 filter-delete 仍在，demo 履约走的是标 expired。
- **状态**：demo 重叠半锁。Stripe resync 删除难做纯黑盒。

### 15. PAY-09 PC 授权忽略设备和重复购买

- **缺陷**：`checkEntitlement(userId, courseId)` 不看 device。PC 购买后 mobile 检查也 allowed。有效期内还能再 quote 同一 plan。
- **正确行为**：`device=pc` 允许，`device=mobile` 不允许。再 quote 同 plan → 400 `already has active access`。
- **黑盒**：能做。check 增加了可选 `device` 查询参数，否则 HTTP 看不见设备带。
- **状态**：已锁。

### 16. PAY-10 取消试用后再 complete 复活

- **缺陷**：demo trial 已 paid 且已取消后，再 `completeDemoTrialOrder` 会把 entitlement 救活。
- **正确行为**：第二次 complete → 400。entitlement 仍 false。
- **黑盒**：能做。trial → confirm → subscription cancel → 再 confirm。
- **状态**：已锁。

---

## 三、很难做纯黑盒的（单独列出）

下面这些在公开 HTTP 上锁不全。旧 TDD 是直接调 `productStore` 或断言内部字段。

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

---

## 四、为什么黑盒锁不住

1. 浏览器进不了 Stripe 真路径。本仓 I/O 只打 webhook 验签 / 未匹配 / 忽略，以及 demo 的 quote、checkout、confirm、trial、subscription。
2. 没有 entitlement 审计列表 API。check 只返回当前是否允许。
3. 没有 operator 退款 HTTP。
4. 并发要跨进程，同进程队列会把竞态藏起来。
5. 黑盒不能 import `productStore` 去读 `passwordHash`、`stripeCancelIssued`、`graceEndsAt`、`stripeEvents[]`。

---

## 五、刻意没做的

1. 不把 `test:io` 加进 Verify 的 `test:ci`。
2. 不把套件写成 `armed`，不写 `reviewed_by`。
3. 不打 `ilovelearningguide.com`。
4. 不把 workshop 的 `pr-title` / `sop-lock` 抄进 Learning Guide CI。
5. 不为 PAY-01..07 再开一轮白盒 Stripe 内部战役。
