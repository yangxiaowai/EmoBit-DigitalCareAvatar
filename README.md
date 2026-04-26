# 忆护同行——面向老年智能陪伴、健康监测与风险预警的 AI 智慧照护系统

本项目是一套面向居家养老场景的 AI 智慧照护系统，覆盖老人端陪伴交互、家属端协同照护、健康监测、风险预警与状态回写闭环。

当前仓库保留前端、Bridge、独立 Data Backend、Android 内置后端与相关测试脚本，可直接在本地运行和演示。

## Project Structure

- `frontend/`：Web 前端源码，包含组件、业务服务、hooks、配置和场景事件核心。
- `backend/`：后端代码，包含 `data-server/`、`bridge/` 和 `android/`；服务端主库推荐 PostgreSQL，本机演示保留 SQLite/JSON 回退。
- `tests/`：测试代码，按 `unit/`、`functional/`、`system/`、`real/` 分层。
- `public/`：Vite 静态资源。
- `scripts/`：本地语音服务、性能测试和辅助脚本。

更完整的目录和存储说明见 [docs/project-structure.md](docs/project-structure.md)。

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
