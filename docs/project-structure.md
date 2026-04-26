# 项目目录结构说明

本项目按运行边界重新整理为前端、后端、测试、脚本、文档和静态资源几类目录。根目录保留构建配置和启动入口，业务源码不再散落在根目录。

## 顶层结构

```text
.
├── frontend/              # Web 前端源码
├── backend/               # 后端服务与本机后端
├── tests/                 # 自动化测试与测试支撑
├── public/                # Vite 静态资源，按原路径直接发布
├── scripts/               # 本地服务、语音、性能测试等脚本
├── docs/                  # 项目文档、测试文档、集成指南
├── openclaw/              # OpenClaw 插件、配置与脚本
├── index.html             # Vite HTML 入口，加载 frontend/index.tsx
├── package.json           # npm 脚本与依赖
└── vite/vitest/tsconfig   # 构建、测试、类型配置
```

## 前端

```text
frontend/
├── App.tsx
├── index.tsx
├── types.ts
├── components/            # 页面组件、业务组件、老人端/家属端组件
├── core/                  # 场景事件总线、状态 reducer、事件适配器
├── services/              # 前端业务服务与远端 API Client
├── hooks/                 # React hooks
├── utils/                 # 前端工具函数
└── config/                # 前端业务配置
```

`@/` 路径别名指向 `frontend/`，例如：

```ts
import { openclawSyncService } from '@/services/openclawSyncService';
```

## 后端

```text
backend/
├── data-server/           # Node Data Backend，主服务端后端
├── bridge/                # OpenClaw Bridge，本机编排/外发桥接服务
└── android/               # Android 内置本机后端
```

### 服务端存储

`backend/data-server/` 是服务端数据后端，生产/服务器部署推荐使用 PostgreSQL：

```text
PostgreSQL
├── schema_migrations      # schema 版本
├── elder_state            # 老人状态 JSONB 快照，事务行锁保护并发写
├── events                 # 照护事件流水
└── media                  # 媒体索引与元数据
```

服务端配置方式：

```bash
EMOBIT_DATA_SERVER_STORAGE=postgres
EMOBIT_POSTGRES_URL=postgres://emobit:password@host:5432/emobit
EMOBIT_POSTGRES_POOL_MAX=20
```

未配置 PostgreSQL 时，本机开发和演示默认使用 SQLite：

```text
backend/data-server/data/
├── emobit-data.sqlite     # 默认 SQLite 数据库
├── elders/                # 旧 JSON 状态快照/迁移种子
├── events/                # 旧 NDJSON 事件日志/兼容日志
└── uploads/               # 媒体文件托管目录
```

服务端存储负责长期数据：

- 老人完整状态快照
- 照护事件流水
- 媒体元数据
- 上传文件托管

可通过 `EMOBIT_DATA_SERVER_STORAGE=sqlite` 显式使用本机 SQLite，也可通过 `EMOBIT_DATA_SERVER_STORAGE=json` 回退旧 JSON 文件存储。

### 本机/边缘存储

`backend/bridge/` 是本机 Bridge 服务，用于 OpenClaw 联动、出站通知、UI 指令队列和演示闭环。它保留本机状态文件：

```text
backend/bridge/data/state.json
```

该文件定位为本机运行缓存和历史兼容数据源，不作为服务端主数据库。Data Backend 启动时可将它作为旧数据迁移来源。

`backend/android/` 是 Android 设备侧本机后端，使用 Room/SQLite 管理端侧本地数据。

## 测试

```text
tests/
├── config/                # Vitest 分层配置
├── setup/                 # Vitest setup 与 MSW mock
├── unit/                  # 单元测试
├── functional/            # 前端功能测试
├── system/                # Bridge/Data Backend 系统集成测试
└── real/                  # 真实外部服务联调测试，默认按环境跳过
```

测试分层：

- `npm run test:unit`：业务服务、后端存储、插件逻辑
- `npm run test:functional`：前端组件和交互功能
- `npm run test:system`：Data Backend 与 Bridge 系统链路

`@tests/` 路径别名指向 `tests/`，`@backend/` 指向 `backend/`。

## 启动入口

```bash
npm run dev                 # Web 前端
npm run data-server:start   # Data Backend
npm run openclaw:bridge     # Bridge
```
