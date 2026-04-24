# FunASR 快速开始指南

## 🚀 5 分钟快速集成

### 步骤 1：安装依赖

```bash
# 激活 conda 环境
conda activate emobit

# 安装 FunASR
pip install "numpy<2" funasr modelscope websockets
```

### 步骤 2：启动服务器

```bash
# 使用启动脚本
./scripts/start_funasr.sh

# 或直接运行
python scripts/funasr_server.py
```

等待看到 "服务器已启动，等待连接..." 表示成功。

### 步骤 3：启动前端

```bash
npm run dev
```

系统会自动检测并使用 FunASR！

## ✅ 验证是否成功

1. 打开浏览器控制台
2. 点击麦克风按钮开始录音
3. 查看控制台日志：
   - 如果看到 `[SpeechService] 使用 FunASR 开始识别` → ✅ 成功
   - 如果看到错误 "FunASR 服务不可用" → ❌ 请确认服务器已启动

## 🔧 常见问题

**Q: 服务器启动失败？**

A: 检查 Python 版本（需要 3.8+）和依赖是否安装完整。

**Q: 前端无法连接？**

A: 确认服务器正在运行，检查端口 10095 是否被占用。

**Q: 识别不准确？**

A: 首次运行需要下载模型（约 500MB），请耐心等待。确保麦克风权限已授予。

## 📖 更多信息

详细文档请查看：[FunASR 集成指南](./funasr-integration-guide.md)

如需导出可执行语音识别工程，请查看：[FunASR 可执行工程打包指南](./funasr-executable-packaging-guide.md)
