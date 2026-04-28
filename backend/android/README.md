# Android 内置后端（Bridge + Data Backend）

该目录提供一个可在 Android 模拟器/真机内运行的本地后端：

- Bridge（默认端口 `4318`）：对齐 `backend/bridge/server.mjs` 的核心 HTTP 接口（演示/测试用）。
- Data Backend（默认端口 `4328`）：对齐 `backend/data-server/server.mjs` 的核心 HTTP 接口（持久化/媒体托管用）。

## 运行方式（推荐）

使用 Android Studio 打开 `backend/android/`，Run `app`。

运行后会在设备上启动两个本地服务（监听 `127.0.0.1`）：

- `http://127.0.0.1:4318/healthz`
- `http://127.0.0.1:4328/healthz`

## 让电脑访问 Android 内置后端（adb reverse）

在电脑终端执行：

```bash
adb reverse tcp:4318 tcp:4318
adb reverse tcp:4328 tcp:4328
```

然后电脑可直接访问：

```bash
curl http://127.0.0.1:4318/healthz
curl http://127.0.0.1:4328/healthz
```

## 数据存储位置

- SQLite（Room）：`emobit.db`（应用私有数据库目录）
- 媒体文件：`filesDir/uploads/…`

## SQLite 表设计

Android 端 SQLite 定位为老人端/家属端本地缓存和离线设置，不作为服务端主库。核心表：

| 表 | 用途 |
|---|---|
| `elder_state` | 完整 elder 状态缓存，用于离线恢复和与服务端同步 |
| `local_elder_profiles` | 老人基础资料缓存 |
| `local_guardian_contacts` | 家属联系人、通知渠道和本地通知开关 |
| `local_medication_cache` | 老人端必要药物信息缓存 |
| `local_client_settings` | 老人端/家属端本地设置 |
| `local_sync_state` | 端云同步状态和待同步变更 |
| `events` | 端侧事件缓存 |
| `media` | 端侧媒体索引 |
