# Gainframe 开发路线图

> 这是唯一的任务清单。完整的产品计划在 [计划文档](https://claude.ai/artifact/RgNpVnYBw26jVjvPhPCMaD)，这里只写"做什么、按什么顺序、怎么验证做完了"。
>
> 规则：
> - 一个任务 = 一个分支 = 一个 PR。任务 ID 写进分支名和 PR 标题，例如 `m1/05-set-logger`、`feat(workout): set logger [M1-05]`。
> - 按顺序做。跳着做或者临时插入新任务，先在这里加一行并说明原因。
> - 每个任务都有"验证"：这是 bw 自己能动手确认的方法，不是"测试通过"四个字。
> - 做完把 `[ ]` 改成 `[x]`，并更新 [STATUS.md](STATUS.md)。
> - 标 👤 的任务需要 bw 亲手做（账号、付费、手机实测），AI 只写步骤。

估时按每周 10–15 小时。第 5 周带去健身房用，第 16 周 MVP，第 18 周作品集完整。

---

## M0 基础（第 1–2 周）

完成标准：推一次代码就自动部署到 dev；计时器原型在 iPhone 上实测可以接受。

- [ ] **M0-01 仓库规则**：CLAUDE.md、本路线图、架构与规范文档、PR 模板、`.gitattributes`、`.gitignore`。
  验证：bw 读完 CLAUDE.md 和 ROADMAP，没有看不懂或不同意的条目。
- [ ] **M0-02 👤 本机环境**：把仓库移出 OneDrive；装 Node、pnpm、Docker Desktop、Terraform、AWS CLI、gh、Claude Code 和推荐插件。步骤见 [docs/setup-windows.md](setup-windows.md)。
  验证：`node -v`、`pnpm -v`、`docker run hello-world`、`terraform -v`、`aws --version`、`gh auth status` 全部正常。
- [ ] **M0-03 👤 AWS 账号安全**：root 开 MFA 后不再使用；开 IAM Identity Center，建自己的管理员用户；Budgets 设 1 美元和 5 美元两档邮件告警；打开 Cost Anomaly Detection；在 ap-southeast-1 的 Bedrock 控制台申请 Claude 模型访问，记下可用的推理配置文件（inference profile）ID。
  验证：`aws sso login` 后 `aws sts get-caller-identity` 返回你的用户；Bedrock 控制台的 playground 能用 Claude 回答一句话。
- [ ] **M0-04 Monorepo 骨架**：pnpm workspaces（`apps/web`、`apps/api`、`packages/shared`、`infra`）；TypeScript strict 共用配置；ESLint + Prettier；Vitest；根目录 `pnpm check` 一次跑完 lint、typecheck、test；在 `.claude/settings.json` 加一个 hook：Claude 每次改完文件自动跑 Prettier 和 ESLint，把错误直接反馈给它。确认 Lambda 支持的最新 Node 主版本，用 `.nvmrc` 和 `engines` 锁定。web 是一个 Next.js 静态导出的空页面，api 是一个带 `/health` 和单元测试的 Hono 应用。
  验证：全新 clone 后 `pnpm install && pnpm check && pnpm build` 通过；`pnpm --filter web dev` 能打开页面。
- [ ] **M0-05 本地数据库**：`docker-compose.yml` 起 Postgres（版本与 Neon 一致）；`.env.example`；`pnpm db:up` / `db:down` 脚本。
  验证：`pnpm db:up` 后 `pnpm --filter api dev`，访问 `/health` 显示数据库已连接。
- [ ] **M0-06 CI**：GitHub Actions 在每个 PR 上跑 install、lint、typecheck、test（用 Postgres 服务容器）、build；pnpm 缓存。👤 bw 在 GitHub 打开 main 分支保护：必须走 PR、必须 CI 通过。
  验证：故意推一个类型错误的 PR，CI 变红；修好后变绿。
- [ ] **M0-07 Terraform 引导**：`infra/bootstrap`：存 state 的 S3 桶（版本控制 + 加密，用 S3 原生锁，不建 DynamoDB）、GitHub OIDC 身份提供商、两个 IAM 角色（PR 用的只读 plan 角色、main 用的 apply 角色）。👤 这一步由 bw 在本地 `terraform apply` 一次，以后不再动。
  验证：`terraform plan` 显示无变化；IAM 控制台能看到两个角色，信任策略只允许这个仓库。
- [ ] **M0-08 dev 环境基础设施**：`infra/envs/dev` + 可复用的 `infra/modules`：S3 网站桶 + CloudFront（OAC）、Lambda（zip）+ Function URL、CloudFront 把 `/api/*` 转给 Lambda、SSM 参数、CloudWatch 日志保留 14 天、所有资源打 `project=gainframe`、`env=dev` 标签。先在这一步验证 CloudFront 到 Function URL 的鉴权方式（见 architecture.md 的"已知坑"），结论写成 ADR。
  验证：CloudFront 默认域名能打开空页面，`/api/health` 返回 `ok`；直接访问 Function URL 被拒绝。
- [ ] **M0-09 CD**：PR 上自动跑 `terraform plan` 并把结果贴成评论；合并到 main 后自动 build、`terraform apply`（dev）、上传前端到 S3、刷新 CloudFront 缓存。
  验证：改一行页面文字并合并，10 分钟内 dev 地址上看到变化；PR 页面能看到 plan 评论。
- [ ] **M0-10 设计 token 与动效基础**：把原型里的颜色、字体、间距、圆角和三套弹簧搬进 `apps/web/src/styles/tokens.css` 和 Tailwind 主题；本地托管 Martian Mono；`motion` 预设（std / pop / soft / press）；`<Pressable>` 组件（按下 0.96 回弹）；减少动态效果的降级；一个只在开发环境出现的 `/dev/kitchen-sink` 页面展示所有 token 和动效。规范见 [docs/design-system.md](design-system.md)。
  验证：在 iPhone 上打开 kitchen-sink，深浅色切换正确，按压回弹和原型一致；打开系统"减弱动态效果"后只剩淡入淡出。
- [ ] **M0-11 PWA 外壳**：manifest、图标、启动画面、安全区；Serwist 预缓存应用外壳；离线时打开显示应用而不是浏览器错误页。
  验证：👤 iPhone Safari"添加到主屏幕"后全屏打开；开飞行模式重新打开仍然能进入应用。
- [ ] **M0-12 👤 计时器原型实测**：一个独立页面：开始休息倒计时、屏幕常亮（Wake Lock）、到时声音提示（iOS 需要先由一次点击解锁音频）。bw 带去健身房用 2–3 次。
  验证：bw 写下实测结论（锁屏、切到别的 App、来电时分别会怎样），记进 ADR-0003。
- [ ] **M0-13 ADR 与看板**：ADR-0001 数据模型与同步规则、ADR-0002 为什么做 PWA 不做原生、ADR-0003 计时器在 iOS 上的限制与三层保障。用 `gh` 把 M1 的任务建成 GitHub Issues 和 Projects 看板。
  验证：`docs/adr/` 下有 3 篇；看板上能看到 M1 的全部任务。

## M1 训练记录 + 计时器（第 3–5 周，数据只存本地）

完成标准：连续一周只用它记录训练，记一组不超过 5 秒。

- [ ] **M1-01 训练领域模型**：`packages/shared` 里的 Zod schema（exercise、template、workout、set）和纯函数：估算 1RM（Epley）、容量、找上次同动作的表现、判断是否新纪录。单元测试覆盖边界情况（0 次、热身组、递减组不算纪录）。
  验证：`pnpm test` 通过；bw 能看懂每个函数的测试用例。
- [ ] **M1-02 本地数据库层**：Dexie schema v1；按表封装的读写函数；客户端生成 UUIDv7；自动写 `created_at`/`updated_at`；软删除；为 M2 预留 outbox 表。用 fake-indexeddb 测试。
  验证：测试通过；在浏览器 DevTools 的 IndexedDB 里能看到写入的数据。
- [ ] **M1-03 应用外壳与导航**：底部三个标签（今天 / 训练 / 饮食）、图标切换动画、页面过渡（View Transitions）、next-intl 中英切换（静态导出下的做法先验证）。
  验证：iPhone 上切换标签顺滑；切成英文后所有文字都变，没有漏翻的硬编码。
- [ ] **M1-04 动作库**：内置约 60 个常用动作（中英名、部位、器械、默认休息秒数）；搜索；新建和编辑自定义动作。
  验证：能搜到"卧推"和"bench"；新建一个自定义动作后重启应用还在。
- [ ] **M1-05 训练进行页 + 记组**：开始空白训练、加动作；每组行显示上次数据并自动带出；重量和次数步进器；组类型（热身 / 正式 / 递减 / 力竭）、RPE、备注；完成一组的打勾动画和数字滚动。
  验证：在手机上单手记完一组 ≤ 5 秒；刷新页面后训练进度不丢。
- [ ] **M1-06 休息计时器**：完成一组自动开始倒计时，时长取动作默认值；±15 秒；底部抽屉可下拉收成小胶囊；屏幕常亮；到时声音。
  验证：完成一组 → 抽屉升起 → 拖成胶囊 → 到时有声音；时间准确（误差 < 1 秒）。
- [ ] **M1-07 超级组**：把两个以上动作编成一组交替记录，一整轮完成后才开始休息。
  验证：A1/A2 交替记 3 轮，计时器只在每轮结束时启动。
- [ ] **M1-08 结束训练 + 总结**：结束页显示时长、容量、新纪录；三档庆祝特效（镁粉 / 杠铃片 / 达标波纹），遵守出现时机规则。
  验证：破一次纪录时出现"新纪录"杠铃片；普通完成一组只有镁粉。
- [ ] **M1-09 模板**：从零建模板、从一次训练另存为模板、一键从模板开始。
  验证：用"推日 A"开始训练，动作顺序和目标组数都正确带出。
- [ ] **M1-10 历史记录**：训练列表、单次详情、修改或删除过去的组（左滑删除）。
  验证：改一组过去的重量后，下一次训练"上次数据"跟着变。
- [ ] **M1-11 端到端测试**：Playwright 用 iPhone 视口跑"离线开始训练 → 记 3 组 → 结束 → 历史可见"。加进 CI。
  验证：CI 里这条 e2e 绿色；故意弄坏记组逻辑时它变红。
- [ ] **M1-12 👤 实战周**：bw 连续一周只用它记录。问题建成 Issue，严重的当周修。
  验证：一周的训练都在历史里；Issue 列表就是问题清单。

## M2 账号与同步（第 6–7 周）

完成标准：换一台设备登录，数据都在。

- [ ] **M2-01 Neon + Drizzle**：👤 bw 建 Neon 项目（新加坡区），建 dev 和 prod 两个分支；连接串放进 SSM。Drizzle schema 与 Dexie 一一对应；`drizzle-kit generate` 生成迁移；部署时自动对 dev 执行迁移。
  验证：本地和 dev 都能 `pnpm db:migrate`；Neon 控制台里能看到表。
- [ ] **M2-02 Cognito**：Terraform 建用户池（邮箱 + Google）、托管登录页、PKCE；前端登录 / 退出 / 刷新 token。
  验证：👤 在 iPhone 的主屏幕 PWA 里完成 Google 登录并回到应用（iOS PWA 的跳转要专门测）。
- [ ] **M2-03 API 鉴权与基础**：每个请求验证 Cognito JWT；从 token 里取 user_id，不信任请求体里的 user_id；统一错误格式；结构化 JSON 日志；请求 ID。
  验证：不带 token 返回 401；集成测试证明用户 A 读不到用户 B 的数据。
- [ ] **M2-04 同步接口**：`POST /sync/push`（批量 upsert，按 `updated_at` 后写者胜，软删除）和 `GET /sync/pull?cursor=`。集成测试覆盖冲突、删除、重复提交。
  验证：测试通过；bw 能用测试用例解释"两台设备同时改同一组"会发生什么。
- [ ] **M2-05 客户端同步引擎**：outbox 批量上传、上线和回到前台时拉取、失败退避重试、界面上的同步状态。
  验证：飞行模式下记 3 组 → 关飞行模式 → 另一台设备刷新后看到这 3 组。
- [ ] **M2-06 首次登录合并本地数据**：M1 期间存的本地数据在登录后归到这个账号。
  验证：bw 自己 M1 的历史在登录后完整保留。
- [ ] **M2-07 prod 环境**：`infra/envs/prod`；GitHub Environment 需要 bw 手动批准才部署 prod；prod 用 Neon prod 分支。
  验证：合并后 dev 自动更新，prod 等待批准；批准后 prod 地址可用。
- [ ] **M2-08 监控告警**：Lambda 错误和限流告警发邮件；前端错误上报到一个接口写进 CloudWatch；检查所有日志组都设了保留期。
  验证：故意让 `/api/debug/throw`（仅 dev）报错，几分钟内收到告警邮件。
- [ ] **M2-09 安全检查**：跑一次 `/security-review`；可选：用 Strix 扫 dev 环境（见 [docs/tooling.md](tooling.md)）。发现的问题建 Issue 修掉。
  验证：报告里没有未处理的高危项。

## M3 饮食 + AI 看图（第 8–10 周）

完成标准：一顿饭 30 秒内记完；评测脚本输出蛋白质平均误差。

- [ ] **M3-01 饮食领域模型**：meal、meal_item 的 schema、营养合计函数、`local_date`；Dexie 和同步扩展到这两张表。
  验证：测试通过；手动建一餐能同步到另一台设备。
- [ ] **M3-02 手动记录 + 常吃食物**：手动加食物；从"常吃"一键添加；左滑删除。
  验证：从常吃里加一餐 ≤ 10 秒。
- [ ] **M3-03 照片上传**：前端压缩（长边 ≤ 1600px）；API 发预签名 PUT URL（限制类型和大小，5 分钟过期）；S3 生命周期 30 天删除。
  验证：上传后 S3 里能看到文件；生命周期规则在控制台可见；超大文件被拒。
- [ ] **M3-04 AI 服务层**：`apps/api/src/ai`：统一接口，实现 Bedrock、Anthropic、OpenAI 三个提供方；模型 ID 放配置；结构化输出用 Zod 校验，失败重试一次；超时；记录 token 用量；每人每日调用上限（Postgres 计数）。
  验证：单元测试用假的提供方覆盖重试、超时、超限；dev 上真实调用一次 Bedrock 成功。
- [ ] **M3-05 看图估算接口**：`prompts/vision/v1.md`；把这位用户相关的历史纠正作为参考一起发给模型；返回每项食物、克数、蛋白质、热量和备选名字。
  验证：用 3 张测试照片调用，返回的 JSON 通过 schema 校验。
- [ ] **M3-06 确认修改页**：照片扫描动画、点名字纠正（先给备选）、克数步进器、提示补油和酱汁、餐次选择、"记住这次纠正"；保存时同时存 AI 原始值和最终值。
  验证：👤 拍一顿真实的饭，30 秒内记完；首页数字联动。
- [ ] **M3-07 自带 Key**：设置页填 Claude 或 OpenAI Key。存储方式先写 ADR 再做（推荐：Key 只存在手机本地，每次请求经 HTTPS 发给 API 使用，服务器不保存、不打日志）。
  验证：填自己的 Key 后请求走该提供方；日志里搜不到 Key。
- [ ] **M3-08 评测脚本**：`pnpm eval:vision` 读取标注集，按提示词版本输出蛋白质和热量的平均绝对误差，生成 markdown 报告。照片放私有 S3 或本地，不进公开仓库。
  验证：跑一次得到 v1 的误差数字，写进 README 草稿。
- [ ] **M3-09 👤 评测集**：bw 从现在就开始拍包装食品或称重过的饭，记下真实蛋白质和热量，目标 30–50 张。
  验证：标注文件里 ≥ 30 条。

## M4 目标、体重与趋势（第 11–12 周）

完成标准：打开第一屏就知道今天还差多少、这周体重涨了多少。

- [ ] **M4-01 目标设置**：阶段（默认增肌）、蛋白质算法（g/kg 或固定克数）、消耗估算（Mifflin-St Jeor × 活动系数）、建议盈余，都可覆盖。
  验证：输入 bw 的身高体重，建议值与手算一致（测试里写明公式）。
- [ ] **M4-02 体重记录**：每日称重、7 日均值、每周增速、目标走廊。
  验证：测试用固定数据验证均值和增速；界面上显示"在目标内 / 偏慢 / 偏快"。
- [ ] **M4-03 今天页**：热量盈余条、蛋白质环、今天的训练入口、体重卡片，数字联动。
  验证：记一餐后回到今天页，数字滚动到新值。
- [ ] **M4-04 趋势图**：visx 画体重、单动作 1RM、每周容量、蛋白质与热量历史；拖动查看数值。
  验证：iPhone 上拖动顺滑，60fps（Safari 时间线检查）。
- [ ] **M4-05 宽屏布局**：电脑上两栏布局，方便面试官在电脑上看。
  验证：1440px 宽下没有被拉伸的单栏页面。

## M5 打通、停滞检测与周报（第 13–14 周）

完成标准：用构造的停滞数据能触发分析；周一收到基于真实数据的周报。

- [ ] **M5-01 Web Push**：VAPID 密钥进 SSM；订阅流程（iOS 需要已安装到主屏幕并由点击触发）；`push_subscriptions` 表；发送函数。
  验证：👤 在 iPhone 上点"测试推送"收到通知。
- [ ] **M5-02 锁屏休息推送**：完成一组时 API 用 EventBridge Scheduler 建一次性定时，到点发推送；跳过休息时取消。
  验证：完成一组后锁屏，到时收到推送；跳过休息则不收到。
- [ ] **M5-03 提醒规则引擎**：纯函数 + 可调阈值配置；第一条规则：大容量训练后蛋白质还差很多。
  验证：测试用构造数据覆盖触发和不触发。
- [ ] **M5-04 停滞规则**：某动作连续 3 周（≥ 3 次）估算 1RM 不涨；周均体重连续 2 周不涨。
  验证：用 fixture 数据测试触发、不触发和边界。
- [ ] **M5-05 停滞分析**：生成数据快照 → AI 结构化输出原因和建议 → 写入 `nudges` → 推送。
  验证：构造一份停滞数据，收到的分析引用了快照里的真实数字。
- [ ] **M5-06 周报**：每周一 08:00（马来西亚时间）定时任务；统计快照 + AI 正文写入 `weekly_summaries`；今天页显示周报卡片。
  验证：手动触发一次，周报里的训练次数、达标天数和数据库一致。
- [ ] **M5-07 周报评测**：几份固定快照，检查生成的周报数字没有编造（规则断言为主）。
  验证：`pnpm eval:summary` 通过。

## M6 AI 健身问答（第 15–16 周，MVP 完成）

完成标准：问"我卧推为什么不涨"能引用你的数据回答；问无关问题会被拒绝。

- [ ] **M6-01 话题过滤**：小模型判断问题是否属于健身范围；≥ 50 条越界和不越界的测试问题；评测脚本输出准确率。
  验证：`pnpm eval:guard` 报告准确率 ≥ 95%。
- [ ] **M6-02 数据查询工具**：get_workouts、get_exercise_progress、get_nutrition_summary、get_weight_trend、get_plateaus。只读；user_id 由服务器从 token 注入，模型无法指定；参数用 Zod 校验。
  验证：单元测试证明工具只能查到当前用户的数据。
- [ ] **M6-03 问答接口**：工具调用循环（最多 N 轮）、流式返回、只保留最近几轮、每日上限、伤病和用药问题建议咨询专业人士。
  验证：问"我卧推为什么不涨"，回答里引用了真实的数字。
- [ ] **M6-04 问答界面**：符合设计规范（不用聊天气泡，回答像普通数据卡片一样呈现，标注 AI 来源）；"不是医疗建议"说明。
  验证：👤 在手机上问 3 个问题，体验顺滑。
- [ ] **M6-05 问答评测**：固定用户数据 + 一组问题，检查是否调用了正确的工具、是否拒绝越界问题。
  验证：`pnpm eval:coach` 通过。

## M7 打磨与展示（第 17–18 周）

完成标准：陌生人 5 分钟内能看懂并点开试用。

- [ ] **M7-01 Demo 账号**：示例数据种子脚本；每日 AI 上限；每晚重置。
- [ ] **M7-02 落地页**：一句话定位、动画 GIF、"开始试用"按钮。
- [ ] **M7-03 双语 README**：定位、Demo 链接、GIF、架构图、"我自己用了 N 周"的真实数据、AI 评测结果、成本。
- [ ] **M7-04 ADR 补齐到 5–8 篇**。
- [ ] **M7-05 Playwright 覆盖关键流程**：训练、饮食确认、登录同步。
- [ ] **M7-06 安全与性能**：Strix 扫一次 prod 前的 dev；Lighthouse PWA 和性能报告；问题清零。
- [ ] **M7-07 演示 GIF 与截图**：Terraform plan 评论、自动部署、告警截图。
- [ ] **M7-08 博客**：例如"用 AI 估算蛋白质有多准"。

验证（整个 M7）：找一个没见过项目的朋友，5 分钟内看懂并试用成功。

---

时间不够时，先压缩 M4 和 M7，M5 和 M6 不砍。MVP 之后：训练计划排期、CSV 导入导出、文字估算。
