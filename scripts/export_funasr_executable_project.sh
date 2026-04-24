#!/bin/bash
set -euo pipefail

# 导出可执行的 FunASR 语音识别工程目录
# 用法:
#   ./scripts/export_funasr_executable_project.sh
#   ./scripts/export_funasr_executable_project.sh --output ./dist/my-funasr

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_SERVER="$SCRIPT_DIR/funasr_server.py"
SOURCE_REQUIREMENTS="$SCRIPT_DIR/requirements_funasr.txt"
DEFAULT_OUTPUT="$PROJECT_ROOT/dist/funasr-executable-project"
OUTPUT_DIR="$DEFAULT_OUTPUT"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 [--output <输出目录>]"
            exit 1
            ;;
    esac
done

if [[ ! -f "$SOURCE_SERVER" ]]; then
    echo "❌ 未找到源文件: $SOURCE_SERVER"
    exit 1
fi

if [[ ! -f "$SOURCE_REQUIREMENTS" ]]; then
    echo "❌ 未找到依赖文件: $SOURCE_REQUIREMENTS"
    exit 1
fi

echo "准备导出 FunASR 可执行工程..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/bin"
mkdir -p "$OUTPUT_DIR/src"
mkdir -p "$OUTPUT_DIR/build"
mkdir -p "$OUTPUT_DIR/config"

cp "$SOURCE_SERVER" "$OUTPUT_DIR/src/funasr_server.py"
cp "$SOURCE_REQUIREMENTS" "$OUTPUT_DIR/requirements.txt"
cat > "$OUTPUT_DIR/config/hotwords.txt" <<'EOF'
# 每行一个热词（可按你们业务扩展）
忆护同行
健康监测
风险预警
服药提醒
紧急联系人
EOF

cat > "$OUTPUT_DIR/.env.example" <<'EOF'
# FunASR 服务参数（按需复制为 .env 并修改）
FUNASR_MAX_CHUNK_SIZE=320000
FUNASR_CHUNK_OVERLAP=16000
FUNASR_MIN_AUDIO_SIZE=8000

# 优化项（默认开启）
FUNASR_ENABLE_AUDIO_PREPROCESS=1
FUNASR_SILENCE_THRESHOLD=0.01
FUNASR_MIN_KEEP_SAMPLES=3200
FUNASR_ENABLE_VOLUME_NORMALIZE=1
FUNASR_NORMALIZE_TARGET_PEAK=0.95
FUNASR_ENABLE_TEXT_POSTPROCESS=1

# 热词增强
FUNASR_HOTWORDS_PATH=./config/hotwords.txt
EOF

cat > "$OUTPUT_DIR/bin/start.sh" <<'EOF'
#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"

if [[ ! -d "$VENV_DIR" ]]; then
    echo "首次运行，正在创建虚拟环境..."
    python3 -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ROOT_DIR/.env"
    set +a
fi

echo "安装/更新依赖..."
pip install --upgrade pip >/dev/null
pip install -r "$ROOT_DIR/requirements.txt"

echo "启动 FunASR WebSocket 服务..."
echo "地址: ws://localhost:10095"
python "$ROOT_DIR/src/funasr_server.py"
EOF

cat > "$OUTPUT_DIR/bin/build_binary.sh" <<'EOF'
#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
DIST_DIR="$ROOT_DIR/build/dist"
WORK_DIR="$ROOT_DIR/build/work"
SPEC_DIR="$ROOT_DIR/build/spec"

if [[ ! -d "$VENV_DIR" ]]; then
    echo "未找到虚拟环境，先执行: ./bin/start.sh"
    exit 1
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

mkdir -p "$DIST_DIR" "$WORK_DIR" "$SPEC_DIR"

echo "使用 PyInstaller 打包单文件可执行程序..."
python -m PyInstaller \
  --clean \
  --onefile \
  --name funasr-server \
  --distpath "$DIST_DIR" \
  --workpath "$WORK_DIR" \
  --specpath "$SPEC_DIR" \
  "$ROOT_DIR/src/funasr_server.py"

echo "打包完成: $DIST_DIR/funasr-server"
echo "注意: 首次运行仍可能下载模型文件到本机缓存目录。"
EOF

cat > "$OUTPUT_DIR/README.md" <<'EOF'
# FunASR 可执行语音识别工程

这是从主项目导出的独立语音识别工程，可单独运行。

## 目录说明

- `src/funasr_server.py`: 语音识别服务端代码
- `requirements.txt`: 运行与打包依赖
- `.env.example`: 参数模板（可复制为 `.env` 调参）
- `config/hotwords.txt`: 业务热词（可自行维护）
- `bin/start.sh`: 一键运行脚本（自动建 venv + 安装依赖）
- `bin/build_binary.sh`: PyInstaller 打包脚本（生成单文件可执行程序）

## 快速运行

```bash
cd funasr-executable-project
chmod +x ./bin/start.sh ./bin/build_binary.sh
# 若需自定义参数:
cp .env.example .env
# 编辑 .env / config/hotwords.txt 后再启动
./bin/start.sh
```

服务地址: `ws://localhost:10095`

## 打包为可执行文件

先跑一次 `./bin/start.sh` 完成环境安装，然后执行:

```bash
./bin/build_binary.sh
```

产物路径:

- `build/dist/funasr-server`

## 可选: 预下载模型

为避免部署端首次启动下载模型，可在打包机先运行一次服务，确认模型下载完成后再分发。
EOF

chmod +x "$OUTPUT_DIR/bin/start.sh" "$OUTPUT_DIR/bin/build_binary.sh"

echo "✅ 导出完成: $OUTPUT_DIR"
echo "下一步:"
echo "1) cd \"$OUTPUT_DIR\""
echo "2) ./bin/start.sh"
echo "3) 如需可执行文件: ./bin/build_binary.sh"
