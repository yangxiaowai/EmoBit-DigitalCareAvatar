# FunASR 可执行工程打包指南

这个指南用于把项目中的语音识别部分（`FunASR`）导出为可独立交付、可执行的工程文件。

## 1. 一键导出独立工程

在项目根目录执行：

```bash
chmod +x ./scripts/export_funasr_executable_project.sh
./scripts/export_funasr_executable_project.sh
```

默认会生成：

- `dist/funasr-executable-project`

也可以自定义输出目录：

```bash
./scripts/export_funasr_executable_project.sh --output ./dist/my-funasr-project
```

导出后的工程已内置优化能力：

- 音频前处理（边缘静音裁剪 + 音量归一化）
- 文本后处理（重复词/重复标点清理）
- 热词增强（`config/hotwords.txt`）

## 2. 运行导出的工程

```bash
cd dist/funasr-executable-project
./bin/start.sh
```

`start.sh` 会自动：

- 创建 Python 虚拟环境 `.venv`
- 安装 `requirements.txt` 依赖
- 启动 WebSocket 语音识别服务 `ws://localhost:10095`

如需调优参数：

```bash
cp .env.example .env
# 修改 .env 和 config/hotwords.txt
./bin/start.sh
```

## 3. 打包单文件可执行程序（可选）

在导出目录内执行：

```bash
./bin/build_binary.sh
```

产物位于：

- `build/dist/funasr-server`

## 4. 对接前端配置

前端默认连接：

- `ws://localhost:10095`

若部署地址不同，设置环境变量：

- `VITE_FUNASR_WS_URL=ws://你的主机:10095`

## 5. 交付建议

- 首次运行会下载模型，建议在交付前先跑一次服务，把模型缓存准备好。
- 给评审/部署同学直接提供 `dist/funasr-executable-project` 目录即可快速复现。
