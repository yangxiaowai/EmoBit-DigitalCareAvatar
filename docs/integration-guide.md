# 忆护同行——面向老年智能陪伴、健康监测与风险预警的 AI 智慧照护系统 · 集成联调指南

## 启动顺序

按以下顺序启动各服务，每启动一个就检查 `/healthz`：

```
1. Data Backend → 2. Bridge → 3. FunASR → 4. Voice Clone → 5. App (Vite)
```

---

## 1. Data Backend

```bash
node backend/data-server/server.mjs
```

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `EMOBIT_DATA_SERVER_HOST` | `0.0.0.0` | 监听地址 |
| `EMOBIT_DATA_SERVER_PORT` | `4328` | 监听端口 |
| `EMOBIT_DATA_SERVER_ROOT` | `backend/data-server/data` | 数据存储根目录 |
| `EMOBIT_DATA_SERVER_STORAGE` | 自动选择 | 存储引擎。服务端推荐 `postgres`；未配置 PostgreSQL 时默认 `sqlite`；兼容回退 `json` |
| `EMOBIT_POSTGRES_URL` / `DATABASE_URL` | (空) | PostgreSQL 连接串。存在时默认启用 `postgres` 存储 |
| `EMOBIT_POSTGRES_POOL_MAX` | `20` | PostgreSQL 连接池最大连接数 |
| `EMOBIT_POSTGRES_SSL` | (空) | PostgreSQL SSL 开关，设为 `true` 时使用 `rejectUnauthorized:false` |
| `EMOBIT_DATA_SERVER_DB_PATH` | `backend/data-server/data/emobit-data.sqlite` | SQLite 数据库文件路径 |
| `EMOBIT_DATA_SERVER_PUBLIC_BASE_URL` | (空) | 媒体文件公开 URL 前缀 |
| `EMOBIT_ELDER_ID` | `elder_demo` | 默认老人 ID |

**检查：**
```bash
curl http://127.0.0.1:4328/healthz
# 期望: {"ok":true,"service":"emobit-data-server",...}

curl "http://127.0.0.1:4328/api/elder?elderId=elder_demo"
# 期望: {"ok":true,"elderId":"elder_demo","elder":{...完整 elder 结构}}
```

### Data Backend 服务接口

Data Backend 可以作为独立后端直接服务前端、Android、本地脚本和 Bridge。核心接口如下：

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/healthz` | 健康检查，返回数据目录与老人数量 |
| `GET` | `/api/elders` | 列出已持久化的老人 ID |
| `GET` | `/api/elder?elderId=elder_demo` | 读取完整老人状态 |
| `GET` | `/api/state?elderId=elder_demo` | Bridge 兼容的完整状态读取 |
| `POST` | `/api/elder/state/:section` | 更新指定状态分区 |
| `POST` | `/api/state/:section` | Bridge 兼容的状态分区更新 |
| `POST` | `/api/elder/events` | 追加照护事件并同步派生分区 |
| `POST` | `/api/events` | Bridge 兼容的事件追加 |
| `GET` | `/api/elder/events?elderId=elder_demo&type=sundowning&limit=50` | 查询事件日志，支持类型前缀过滤 |
| `GET` | `/api/context/:type?elderId=elder_demo` | 读取聚合上下文，支持 `wandering`、`medication`、`daily-report`、`sundowning`、`care-plan`、`trends`、`family-control` |
| `GET` | `/api/elder/context/:type?elderId=elder_demo` | 与上方等价的老人语义路径 |
| `GET` | `/api/ui/commands?elderId=elder_demo&since=0` | 查询 OpenClaw/家属控制下发给老人端的 UI 指令 |
| `POST` | `/api/ui/commands` | 追加 UI 指令 |
| `POST` | `/api/outbound/record` | 记录通知家属、通知老人、语音外呼等出站动作 |
| `POST` | `/api/media/upload` | 上传 base64 媒体并返回 `/media/...` URL |
| `GET` | `/media/:mediaId` | 读取已上传媒体 |

常用业务快捷写入接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/elder/medication/logs` | 追加用药记录 |
| `POST` | `/api/elder/cognitive/conversations` | 追加认知/陪伴对话事件 |
| `POST` | `/api/elder/cognitive/assessments` | 追加认知测评事件，低分自动标记 `warn` |
| `POST` | `/api/elder/care-plan/events` | 追加照护计划事件 |

示例：

```bash
curl -X POST http://127.0.0.1:4328/api/elder/medication/logs \
  -H "Content-Type: application/json" \
  -d '{"elderId":"elder_demo","medicationId":"med_1","medicationName":"盐酸奥司他韦","scheduledTime":"08:00","status":"taken"}'

curl "http://127.0.0.1:4328/api/context/daily-report?elderId=elder_demo"
```

### 数据库设计

Node Data Backend 的服务端主库推荐使用 PostgreSQL。配置 `EMOBIT_POSTGRES_URL` 或 `DATABASE_URL` 后，服务会自动选择 PostgreSQL；也可以显式设置 `EMOBIT_DATA_SERVER_STORAGE=postgres`。未配置 PostgreSQL 时，本机演示默认使用 SQLite；JSON 仅作为兼容回退和历史数据迁移来源。

PostgreSQL 写路径使用连接池、事务和单老人状态行级锁：

- 状态更新和事件追加会在事务中读取 `elder_state ... FOR UPDATE`
- 多实例并发写同一老人时不会覆盖状态
- 事件、媒体、老人状态均有独立索引
- 连接池大小由 `EMOBIT_POSTGRES_POOL_MAX` 控制

启动示例：

```bash
EMOBIT_DATA_SERVER_STORAGE=postgres \
EMOBIT_POSTGRES_URL="postgres://emobit:password@127.0.0.1:5432/emobit" \
node backend/data-server/server.mjs
```

如果已有旧版 JSON 数据，会从 `backend/data-server/data/elders/*.json` 与 `backend/bridge/data/state.json` 自动引导迁移到当前存储引擎。媒体二进制仍存放在 `uploads/` 目录，数据库保存索引与元数据。

| 表 | 关键字段 | 用途 |
|---|---|---|
| `schema_migrations` | `version`, `applied_at` | 记录数据库 schema 版本 |
| `elder_state` | `elder_id`, `updated_at`, `state_json JSONB` | 老人完整状态快照，供前端、Bridge、Android 同步 |
| `events` | `event_id`, `elder_id`, `type`, `severity`, `timestamp_ms`, `payload_json JSONB`, `event_json JSONB` | 照护事件流水，支持按老人、时间、事件类型索引 |
| `media` | `media_id`, `elder_id`, `type`, `mime_type`, `size_bytes`, `relative_path`, `url` | 人脸、相册、语音等媒体文件索引 |

索引设计：

| 索引 | 说明 |
|---|---|
| `idx_events_elder_id` | 按老人查询事件 |
| `idx_events_elder_timestamp` | 按老人和时间查询时间线 |
| `idx_events_elder_type` | 按老人和事件类型查询风险/业务事件 |
| `idx_media_elder_id` | 按老人查询媒体 |
| `idx_media_elder_type` | 按老人和媒体类型查询人脸、相册、语音 |

如需本机演示或临时回退：

```bash
EMOBIT_DATA_SERVER_STORAGE=sqlite node backend/data-server/server.mjs
EMOBIT_DATA_SERVER_STORAGE=json node backend/data-server/server.mjs
```

---

## 2. Bridge

```bash
node backend/bridge/server.mjs
```

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `EMOBIT_BRIDGE_PORT` | `4318` | 监听端口 |
| `EMOBIT_BRIDGE_HOST` | `0.0.0.0` | 监听地址 |
| `EMOBIT_BRIDGE_TOKEN` | (空) | 请求鉴权 token |
| `EMOBIT_DATA_BACKEND_URL` | `http://127.0.0.1:4328` | Data Backend 地址 |
| `EMOBIT_ELDER_ID` | `elder_demo` | 默认老人 ID |
| `OPENCLAW_GATEWAY_URL` | (空) | OpenClaw 网关地址 |

**检查：**
```bash
curl http://127.0.0.1:4318/healthz
# 期望: {"ok":true,"dataBackendOk":true,...}

# 写入 → 读回验证
curl -X POST http://127.0.0.1:4318/api/state/health \
  -H "Content-Type: application/json" \
  -d '{"elderId":"elder_demo","payload":{"metrics":{"heartRate":75},"alerts":[]}}'
# 期望: {"ok":true,"elderId":"elder_demo","section":"health","state":{...}}

curl -X GET "http://127.0.0.1:4318/api/context/daily-report?elderId=elder_demo"
# 期望: {"ok":true,"elderId":"elder_demo","contextType":"daily-report","context":{...}}
```

---

## 3. FunASR 语音识别

```bash
bash scripts/start_funasr.sh
```

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_FUNASR_WS_URL` | `ws://localhost:10095` | WebSocket 地址 |

---

## 4. Voice Clone 语音克隆

```bash
bash scripts/start_voice_clone.sh
```

---

## 5. App (Vite 前端)

```bash
npm run dev
```

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_OPENCLAW_BRIDGE_URL` | (空) | Bridge 地址 |
| `VITE_OPENCLAW_BRIDGE_TOKEN` | (空) | Bridge 鉴权 token |
| `VITE_GROQ_API_KEY` | (空) | Groq LLM API Key |
| `VITE_AMAP_JS_KEY` | (空) | 高德地图 JS Key |

**浏览器访问：** `http://localhost:3000`

---

## 端点配置（多设备）

| 场景 | Data Backend | Bridge | App |
|---|---|---|---|
| 浏览器（本机） | `http://127.0.0.1:4328` | `http://127.0.0.1:4318` | `http://localhost:3000` |
| 局域网其他设备 | `http://<局域网IP>:4328` | `http://<局域网IP>:4318` | `http://<局域网IP>:3000` |
| Android 模拟器 | `http://10.0.2.2:4328` | `http://10.0.2.2:4318` | `http://10.0.2.2:3000` |

> 查看本机局域网 IP：Windows 执行 `ipconfig`，Linux/Mac 执行 `ifconfig` 或 `ip addr`

---

## 上传链路验证

```bash
# 通过 Data Backend 上传文件
curl -X POST http://127.0.0.1:4328/api/media/upload \
  -H "Content-Type: application/json" \
  -d '{
    "elderId": "elder_demo",
    "type": "faces",
    "filename": "test.png",
    "mimeType": "image/png",
    "contentBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ysAAAAASUVORK5CYII="
  }'
# 期望: {"ok":true,"url":"http://127.0.0.1:4328/media/elder_demo/faces/xxx.png",...}

# 验证媒体可访问
curl -I <返回的 url>
# 期望: HTTP 200, Content-Type: image/png
```

---

## 自动化测试

```bash
npm run test:system    # 系统集成测试（Bridge ↔ Data Backend）
npm run test:unit      # 单元测试
npx vitest run tests/unit/backend/data-server/server.test.ts  # Data Backend 独立测试
```
