# 忆护同行——面向老年智能陪伴、健康监测与风险预警的 AI 智慧照护系统

本项目是一套面向居家养老场景的 AI 智慧照护系统，覆盖老人端陪伴交互、家属端协同照护、健康监测、风险预警与状态回写闭环。

当前仓库保留前端、Bridge、独立 Data Backend、Android 内置后端与相关测试脚本，可直接在本地运行和演示。

## Project Structure

- `frontend/`：Web 前端源码，包含组件、业务服务、hooks、配置和场景事件核心。
- `backend/`：后端代码，包含 `data-server/`、`bridge/` 和 `android/`；服务端主库统一 PostgreSQL，端侧本地缓存使用 SQLite，旧 JSON 仅用于迁移。
- `tests/`：测试代码，按 `unit/`、`functional/`、`system/`、`real/` 分层。
- `public/`：Vite 静态资源。
- `scripts/`：本地语音服务、性能测试和辅助脚本。

更完整的目录和存储说明见 [docs/project-structure.md](docs/project-structure.md)。

## Backend & Storage Design

当前后端按运行边界拆成三层：

- **Data Backend (`backend/data-server/`)**：服务端主数据服务，正式存储统一使用 PostgreSQL。
- **Bridge (`backend/bridge/`)**：OpenClaw、家属通知、老人端 UI 指令和出站动作编排层。
- **Android Embedded Backend (`backend/android/`)**：老人端/家属端设备内置后端，使用 Room/SQLite 做端侧缓存和本地设置。

### PostgreSQL 服务端主库

Data Backend 默认端口为 `4328`，服务端不再自动回退 SQLite/JSON。启动前需要配置：

```bash
EMOBIT_POSTGRES_URL="postgres://emobit:password@127.0.0.1:5432/emobit"
npm run data-server:start
```

服务端 PostgreSQL 采用“完整状态快照 + 业务投影表 + 事件流水”的设计：

- `elder_state` 保存完整 `elder` JSONB 快照，保证现有前端、Bridge 和 Android 同步契约稳定。
- `elders`、`elder_guardian_contacts`、`elder_medications`、`elder_health_snapshots`、`elder_care_plan_items`、`elder_ui_commands` 等表保存多老人、多业务维度的可查询数据。
- `events` 保存照护事件流水，支持按老人、时间、事件类型检索。
- `media` 保存媒体索引，文件本体仍存放在 `backend/data-server/data/uploads/`。

旧 JSON 数据会作为迁移来源自动导入 PostgreSQL：

- `backend/data-server/data/elders/*.json`
- `backend/bridge/data/state.json`
- `backend/data-server/data/events/*.ndjson`

也可以显式执行：

```bash
npm run data-server:migrate-json
```

### SQLite 端侧本地库

SQLite 只用于老人端/家属端设备本地数据，不再作为服务端主存储。Android Room 数据库包含：

- `elder_state`：端侧完整状态缓存。
- `local_elder_profiles`：老人基础资料缓存。
- `local_guardian_contacts`：家属联系人和通知设置。
- `local_medication_cache`：老人端必要药物信息。
- `local_client_settings`：老人端/家属端本地设置。
- `local_sync_state`：端云同步状态和待同步变更。
- `events`、`media`：端侧事件和媒体缓存。

这种分层可以同时满足服务端多老人管理、端侧离线可用和现有演示链路兼容。

## Run Locally

**Prerequisites:** Node.js、PostgreSQL。语音服务需要 Python 环境。


1. Install dependencies:
   `npm install`
2. Set the `VITE_DEEPSEEK_API_KEY` and `EMOBIT_POSTGRES_URL` in `.env.local`
3. Start Data Backend:
   `npm run data-server:start`
4. Start Bridge if OpenClaw/通知联动 is needed:
   `npm run openclaw:bridge`
5. Run the app:
   `npm run dev`
