#!/usr/bin/env bash
# 启动 FreeToken 推理服务（Qwen3.8-27B-NVFP4）
#
# 三处环境/参数都是针对本机 RTX 5090 (sm_120) 的已知坑，不要随手删：
#   1. env -u PYTHONPATH      : WorkBuddy 注入的 sitecustomize 会劫持 os.removedirs，
#                               triton 编译完清理临时目录时抛 safe-delete 异常。
#   2. FREETOKEN_FORCE_E4M3_EMU=1 : sm_120 上 torch._scaled_mm 的 rowwise scaling 不被支持，
#                               融合投影（linear_attn 的 in_proj_qkvz）会崩
#                               "Rowwise scaling is not currently supported on your device"。
#                               打开后走 triton 内核分支，绕过 cuBLASLt。
#   3. TRITON_CACHE_DIR      : 指向已用 MSVC (cl.exe) 编译成功的缓存目录，
#                              避免回退到 TinyCC 产出的坏 cuda_utils.pyd。
set -euo pipefail

FT_HOME="${FT_HOME:-C:/Users/Administrator/AppData/Local/FreeToken}"
MODEL_PATH="${FT_MODEL_PATH:-D:/Users/a/ai_models/Qwen3.8-27B-NVFP4}"
PORT="${FT_PORT:-1919}"
HOST="${FT_HOST:-127.0.0.1}"
MEMORY_RATIO="${FT_MEMORY_RATIO:-0.85}"
MAX_RUNNING="${FT_MAX_RUNNING_REQUESTS:-4}"
SERVED_NAME="${FT_SERVED_MODEL_NAME:-Qwen3.8-27B-NVFP4}"
LOG_DIR="${FT_LOG_DIR:-D:/lab/woaiios/tools/song-bridge/logs}"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/freetoken-$PORT.log"

export FREETOKEN_FORCE_E4M3_EMU=1
export TRITON_CACHE_DIR="${TRITON_CACHE_DIR:-C:/Users/Administrator/AppData/Local/Temp/triton-e4m3emu}"
export CC="${CC:-C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64/cl.exe}"
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"

echo "[start-freetoken] model=$MODEL_PATH port=$PORT log=$LOG_FILE"

# 注意：env -u PYTHONPATH 必须在 exec 之前，切断 WorkBuddy 的 shim
exec env -u PYTHONPATH \
  "$FT_HOME/venv/Scripts/ft.exe" serve \
    --model-path "$MODEL_PATH" \
    --host "$HOST" \
    --port "$PORT" \
    --memory-ratio "$MEMORY_RATIO" \
    --max-running-requests "$MAX_RUNNING" \
    --served-model-name "$SERVED_NAME" \
    --tool-call-parser qwen3_coder \
    --reasoning-parser qwen3 \
    --cors-origins "*" \
    >> "$LOG_FILE" 2>&1
