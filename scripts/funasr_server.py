"""
FunASR WebSocket Server for EmoBit (兼容新版websockets)
语音识别服务端 - 正确处理WebSocket音频流

使用方法:
pip install "numpy<2" funasr modelscope websockets
python funasr_server.py

配置选项:
- ENABLE_INTERIM_RESULTS: 是否启用中间结果发送（默认False，只在用户停止后发送最终结果）
- INTERIM_BUFFER_SIZE: 中间结果缓冲区大小（默认64000字节，约2秒音频）
"""

import asyncio
import json
import logging
import sys
import numpy as np
import os
import re
import threading

# 配置：是否启用中间结果（实时识别）
# False = 只在用户停止说话后发送最终结果（推荐，减少网络传输，提高准确性）
# True = 实时发送中间结果（适合需要实时反馈的场景）
ENABLE_INTERIM_RESULTS = False  # 强制禁用中间结果，只发送最终结果

# 配置：长音频分块大小（字节）
# FunASR 模型对单次处理的音频长度有限制，长音频需要分块处理
# 16kHz, 16bit = 32000 字节/秒
# 建议每块不超过 10 秒（320000 字节），以确保识别质量
MAX_CHUNK_SIZE = int(os.getenv('FUNASR_MAX_CHUNK_SIZE', '320000'))  # 约10秒音频
CHUNK_OVERLAP = int(os.getenv('FUNASR_CHUNK_OVERLAP', '16000'))  # 约0.5秒重叠，避免截断句子

# 配置：最小音频长度（字节）
# 小于此长度的音频可能识别不准确，建议至少 0.5 秒
MIN_AUDIO_SIZE = int(os.getenv('FUNASR_MIN_AUDIO_SIZE', '8000'))  # 约0.5秒音频

# 配置：静音裁剪和音频预处理（提升准确率与推理效率）
ENABLE_AUDIO_PREPROCESS = os.getenv('FUNASR_ENABLE_AUDIO_PREPROCESS', '1') == '1'
SILENCE_THRESHOLD = float(os.getenv('FUNASR_SILENCE_THRESHOLD', '0.01'))
MIN_KEEP_SAMPLES = int(os.getenv('FUNASR_MIN_KEEP_SAMPLES', '3200'))  # 约0.2秒
ENABLE_VOLUME_NORMALIZE = os.getenv('FUNASR_ENABLE_VOLUME_NORMALIZE', '1') == '1'
NORMALIZE_TARGET_PEAK = float(os.getenv('FUNASR_NORMALIZE_TARGET_PEAK', '0.95'))

# 配置：识别后文本优化（去重、清洗）
ENABLE_TEXT_POSTPROCESS = os.getenv('FUNASR_ENABLE_TEXT_POSTPROCESS', '1') == '1'

# 配置：热词增强（可选）
HOTWORDS_PATH = os.getenv('FUNASR_HOTWORDS_PATH', '')
HOTWORDS = []

try:
    import websockets
    from funasr import AutoModel
except ImportError as e:
    print(f"请先安装依赖: pip install \"numpy<2\" funasr modelscope websockets")
    print(f"错误: {e}")
    sys.exit(1)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 全局模型实例
model = None
model_lock = threading.Lock()

def load_hotwords():
    """加载热词列表（每行一个词）"""
    global HOTWORDS
    HOTWORDS = []
    if not HOTWORDS_PATH:
        return
    if not os.path.exists(HOTWORDS_PATH):
        logger.warning(f"热词文件不存在: {HOTWORDS_PATH}")
        return
    try:
        with open(HOTWORDS_PATH, "r", encoding="utf-8") as f:
            words = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
        HOTWORDS = words
        logger.info(f"✅ 已加载热词 {len(HOTWORDS)} 个")
    except Exception as e:
        logger.warning(f"加载热词失败: {e}")

def preprocess_audio(audio_float32: np.ndarray) -> np.ndarray:
    """预处理音频：边缘静音裁剪 + 峰值归一化"""
    if audio_float32.size == 0:
        return audio_float32

    processed = audio_float32

    if ENABLE_AUDIO_PREPROCESS:
        abs_audio = np.abs(processed)
        non_silent = np.where(abs_audio > SILENCE_THRESHOLD)[0]
        if non_silent.size > 0:
            start_idx = int(non_silent[0])
            end_idx = int(non_silent[-1]) + 1
            if end_idx - start_idx >= MIN_KEEP_SAMPLES:
                processed = processed[start_idx:end_idx]

    if ENABLE_VOLUME_NORMALIZE and processed.size > 0:
        peak = float(np.max(np.abs(processed)))
        if peak > 0:
            scale = min(NORMALIZE_TARGET_PEAK / peak, 3.0)
            processed = np.clip(processed * scale, -1.0, 1.0)

    return processed

def postprocess_text(text: str) -> str:
    """识别后处理：去掉常见重复和多余空白"""
    if not text:
        return ""
    cleaned = text.strip()
    if not ENABLE_TEXT_POSTPROCESS:
        return cleaned

    # 折叠多空白
    cleaned = re.sub(r"\s+", " ", cleaned)
    # 去掉连续重复标点
    cleaned = re.sub(r"([，。！？,.!?])\1+", r"\1", cleaned)
    # 去掉明显重复短句（如 "你好你好"）
    cleaned = re.sub(r"(.{1,8})\1{1,}", r"\1", cleaned)
    return cleaned.strip()

def generate_with_options(input_audio: np.ndarray):
    """调用模型推理，自动兼容不同 FunASR 参数版本"""
    kwargs = {"input": input_audio, "batch_size_s": 300}
    if HOTWORDS:
        kwargs["hotword"] = HOTWORDS
    try:
        with model_lock:
            return model.generate(**kwargs)
    except TypeError:
        # 某些版本可能不支持 hotword 参数，回退到基础调用
        kwargs.pop("hotword", None)
        with model_lock:
            return model.generate(**kwargs)

def load_model():
    """加载ASR模型"""
    global model
    
    # 使用 print 确保立即输出（不缓冲）
    print("=" * 60, flush=True)
    print("正在加载FunASR模型...", flush=True)
    print("这可能需要几分钟时间，请耐心等待...", flush=True)
    print("=" * 60, flush=True)
    logger.info("=" * 60)
    logger.info("正在加载FunASR模型...")
    logger.info("这可能需要几分钟时间，请耐心等待...")
    logger.info("=" * 60)
    
    try:
        import time
        start_time = time.time()
        
        print("\n步骤 1/3: 开始初始化 AutoModel...", flush=True)
        print("        (模型大小: ~2GB, 加载到内存需要时间)", flush=True)
        print("        正在加载 ASR 模型 (paraformer-zh, ~944MB)...", flush=True)
        logger.info("步骤 1/3: 初始化 ASR 模型 (paraformer-zh)...")
        logger.info("        (模型大小: ~944MB, 加载到内存需要时间)")
        
        # 使用 disable_update 加快启动
        print("        正在调用 AutoModel()...", flush=True)
        sys.stdout.flush()  # 强制刷新输出
        
        model = AutoModel(
            model="paraformer-zh",
            vad_model="fsmn-vad",
            punc_model="ct-punc",
            device="cpu",
            disable_update=True,  # 禁用更新检查
        )
        load_hotwords()
        
        elapsed = time.time() - start_time
        print(f"\n✅ 模型加载完成! (耗时: {elapsed:.1f} 秒)", flush=True)
        print("=" * 60, flush=True)
        logger.info("=" * 60)
        logger.info(f"✅ 模型加载完成! (耗时: {elapsed:.1f} 秒)")
        logger.info("=" * 60)
        return True
    except Exception as e:
        print(f"\n❌ 模型加载失败!", flush=True)
        print(f"错误信息: {e}", flush=True)
        print("=" * 60, flush=True)
        logger.error("=" * 60)
        logger.error("❌ 模型加载失败!")
        logger.error(f"错误信息: {e}")
        logger.error("=" * 60)
        import traceback
        traceback.print_exc()
        return False

async def handle_client(websocket):
    """处理WebSocket客户端连接 (新版websockets API - 不需要path参数)"""
    client_addr = websocket.remote_address
    logger.info(f"新客户端连接: {client_addr}")
    
    audio_buffer = bytearray()
    is_speaking = True
    
    try:
        async for message in websocket:
            # 处理文本消息（控制命令）
            if isinstance(message, str):
                try:
                    data = json.loads(message)
                    logger.info(f"收到控制消息: {data}")
                    
                    if data.get("type") == "start":
                        audio_buffer.clear()
                        is_speaking = True
                        print(f"[客户端 {client_addr}] 开始录音", flush=True)
                        logger.info(f"[客户端 {client_addr}] 开始录音")
                        await websocket.send(json.dumps({"type": "ready"}))
                        
                    elif data.get("type") == "stop" or data.get("is_speaking") == False:
                        is_speaking = False
                        print(f"\n[客户端 {client_addr}] ========================================", flush=True)
                        print(f"[客户端 {client_addr}] 停止录音，处理音频缓冲区 (大小: {len(audio_buffer)} 字节)", flush=True)
                        logger.info(f"[客户端 {client_addr}] 停止录音，处理音频缓冲区 (大小: {len(audio_buffer)} 字节)")
                        
                        # 检查音频长度是否足够
                        if len(audio_buffer) >= MIN_AUDIO_SIZE:
                            try:
                                result = process_audio(bytes(audio_buffer))
                                if result and result.strip():
                                    # 确保只发送最终结果，is_final 必须为 True
                                    response = {
                                        "text": result,
                                        "is_final": True  # 强制设置为 True，确保是最终结果
                                    }
                                    print(f"[客户端 {client_addr}] ✅ 发送最终结果到前端: {result}", flush=True)
                                    print(f"[客户端 {client_addr}] ✅ 消息类型: is_final=True (最终结果)", flush=True)
                                    logger.info(f"[客户端 {client_addr}] ✅ 发送最终结果到前端: {result}")
                                    
                                    try:
                                        await websocket.send(json.dumps(response))
                                        print(f"[客户端 {client_addr}] ✅ WebSocket 消息已发送 (is_final=True)", flush=True)
                                        # 发送完成后，等待一小段时间确保消息送达
                                        await asyncio.sleep(0.1)
                                    except websockets.exceptions.ConnectionClosed:
                                        print(f"[客户端 {client_addr}] ⚠️ 连接已关闭，无法发送最终结果", flush=True)
                                        logger.warning(f"[客户端 {client_addr}] 连接已关闭，无法发送最终结果")
                                    except Exception as send_error:
                                        print(f"[客户端 {client_addr}] ❌ 发送失败: {send_error}", flush=True)
                                        logger.error(f"[客户端 {client_addr}] 发送失败: {send_error}")
                                else:
                                    print(f"[客户端 {client_addr}] ⚠️ 识别结果为空", flush=True)
                                    logger.warning(f"[客户端 {client_addr}] 识别结果为空")
                                    # 即使结果为空，也发送一个空结果，让前端知道处理完成
                                    try:
                                        await websocket.send(json.dumps({"text": "", "is_final": True}))
                                    except:
                                        pass
                            except Exception as process_error:
                                print(f"[客户端 {client_addr}] ❌ 处理音频失败: {process_error}", flush=True)
                                logger.error(f"[客户端 {client_addr}] 处理音频失败: {process_error}")
                        else:
                            print(f"[客户端 {client_addr}] ⚠️ 音频缓冲区太小 ({len(audio_buffer)} 字节 < {MIN_AUDIO_SIZE} 字节)，跳过处理", flush=True)
                            logger.warning(f"[客户端 {client_addr}] 音频缓冲区太小: {len(audio_buffer)} 字节 (最小要求: {MIN_AUDIO_SIZE} 字节)")
                            # 发送空结果，让前端知道处理完成
                            try:
                                await websocket.send(json.dumps({"text": "", "is_final": True}))
                            except:
                                pass
                        
                        print(f"[客户端 {client_addr}] ========================================\n", flush=True)
                        audio_buffer.clear()
                        
                except json.JSONDecodeError:
                    logger.warning(f"无效JSON: {message[:100]}")
                continue
            
            # 处理二进制音频数据
            if isinstance(message, bytes) and is_speaking:
                audio_buffer.extend(message)
                # 只在调试模式下记录详细日志，避免日志过多
                if len(audio_buffer) % 32000 == 0:  # 每1秒记录一次
                    logger.debug(f"收到音频数据: 缓冲区大小 {len(audio_buffer)} 字节 (约 {len(audio_buffer)//16000} 秒)")
                
                # 完全禁用中间结果：只累积音频，不发送中间结果
                # 音频会一直累积，直到用户停止说话后统一处理完整音频
                # 这样可以：
                # 1. 减少网络传输
                # 2. 提高最终结果的准确性（使用完整音频上下文）
                # 3. 支持长音频识别（通过分块处理）
                pass
                    
    except websockets.exceptions.ConnectionClosed as e:
        logger.info(f"客户端断开连接: {client_addr}, 代码: {e.code}, 原因: {e.reason}")
        print(f"[客户端 {client_addr}] 连接已关闭 (代码: {e.code})", flush=True)
    except websockets.exceptions.ConnectionClosedError as e:
        logger.info(f"客户端连接关闭错误: {client_addr}, {e}")
        print(f"[客户端 {client_addr}] 连接关闭错误: {e}", flush=True)
    except Exception as e:
        logger.error(f"处理消息时出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 连接关闭时，如果还有未处理的音频，尝试处理
        if len(audio_buffer) >= MIN_AUDIO_SIZE:
            print(f"[客户端 {client_addr}] 连接关闭，处理剩余音频 (大小: {len(audio_buffer)} 字节)", flush=True)
            try:
                result = process_audio(bytes(audio_buffer))
                if result and result.strip():
                    try:
                        await websocket.send(json.dumps({
                            "text": result,
                            "is_final": True
                        }))
                        print(f"[客户端 {client_addr}] ✅ 已发送最终结果: {result}", flush=True)
                    except:
                        pass
            except Exception as e:
                logger.error(f"[客户端 {client_addr}] 处理剩余音频失败: {e}")

def process_audio(audio_bytes):
    """处理音频数据并返回识别结果"""
    global model
    
    if model is None:
        logger.warning("模型未加载，无法处理音频")
        return ""
    
    if len(audio_bytes) < MIN_AUDIO_SIZE:
        logger.debug(f"音频数据太短: {len(audio_bytes)} 字节 (最小要求: {MIN_AUDIO_SIZE} 字节)")
        return ""
    
    try:
        # 转换音频格式
        audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
        audio_float32 = audio_int16.astype(np.float32) / 32768.0
        
        raw_audio_length = len(audio_float32)
        audio_float32 = preprocess_audio(audio_float32)
        audio_length = len(audio_float32)
        sample_rate = 16000  # FunASR 默认采样率
        duration_seconds = audio_length / sample_rate
        
        print(
            f"[处理音频] 音频长度: 原始 {raw_audio_length} -> 预处理后 {audio_length} 采样点, 约 {duration_seconds:.2f} 秒",
            flush=True
        )
        logger.info(f"正在识别音频 (预处理后长度: {audio_length} 采样点, {duration_seconds:.2f} 秒)")

        if audio_length < MIN_KEEP_SAMPLES:
            logger.info(f"预处理后音频过短，跳过识别: {audio_length} < {MIN_KEEP_SAMPLES}")
            return ""
        
        # 检查是否需要分块处理（长音频）
        if len(audio_bytes) > MAX_CHUNK_SIZE:
            print(f"[处理音频] ⚠️ 音频较长 ({duration_seconds:.2f}秒 > {MAX_CHUNK_SIZE//16000}秒)，将分块处理", flush=True)
            return process_long_audio(audio_float32, sample_rate)
        
        # 短音频直接处理
        # 调用模型识别，使用 batch_size_s 参数支持长音频
        result = generate_with_options(audio_float32)
        
        if result and len(result) > 0:
            text = postprocess_text(result[0].get("text", ""))
            if text and text.strip():
                # 使用 print 和 logger 双重输出，确保能看到
                print(f"\n{'='*60}", flush=True)
                print(f"🎤 语音识别结果: {text}", flush=True)
                print(f"{'='*60}\n", flush=True)
                logger.info("=" * 60)
                logger.info(f"🎤 语音识别结果: {text}")
                logger.info("=" * 60)
                return text
            else:
                logger.warning("识别结果为空")
                return ""
        else:
            logger.warning("模型返回空结果")
            return ""
    except Exception as e:
        logger.error(f"❌ 音频处理失败: {e}")
        import traceback
        traceback.print_exc()
        return ""

def process_long_audio(audio_float32: np.ndarray, sample_rate: int = 16000) -> str:
    """处理长音频：分块识别后整合结果"""
    global model
    if model is None:
        return ""
    
    try:
        audio_length = len(audio_float32)
        chunk_size_samples = MAX_CHUNK_SIZE // 2  # 转换为采样点数（16bit = 2字节）
        overlap_samples = CHUNK_OVERLAP // 2
        
        start_idx = 0
        chunk_results = []
        chunk_num = 0
        
        while start_idx < audio_length:
            chunk_num += 1
            # 计算当前块的结束位置
            end_idx = min(start_idx + chunk_size_samples, audio_length)
            chunk_audio = audio_float32[start_idx:end_idx]
            
            chunk_duration = len(chunk_audio) / sample_rate
            
            # 处理当前块（至少0.3秒才处理）
            if chunk_duration >= 0.3:
                try:
                    print(f"[处理音频] 处理块 {chunk_num}: {chunk_duration:.2f} 秒 (位置: {start_idx//sample_rate:.1f}s - {end_idx//sample_rate:.1f}s)", flush=True)
                    result = generate_with_options(chunk_audio)
                    if result and len(result) > 0:
                        chunk_text = postprocess_text(result[0].get("text", ""))
                        if chunk_text:
                            chunk_results.append(chunk_text)
                            print(f"[处理音频] 块 {chunk_num} 识别结果: {chunk_text}", flush=True)
                except Exception as e:
                    logger.warning(f"处理音频块 {chunk_num} 时出错: {e}")
                    print(f"[处理音频] ⚠️ 块 {chunk_num} 处理失败: {e}", flush=True)
            
            # 移动到下一块（带重叠）
            if end_idx >= audio_length:
                break
            start_idx = end_idx - overlap_samples
        
        # 整合所有块的结果
        if chunk_results:
            # 合并结果，用空格连接
            final_text = " ".join(chunk_results)
            # 清理：移除重复的标点符号和多余空格
            final_text = re.sub(r'([。！？])\s*\1+', r'\1', final_text)  # 重复标点
            final_text = re.sub(r'\s+', ' ', final_text).strip()  # 多余空格
            final_text = re.sub(r'\s+([，。！？])', r'\1', final_text)  # 标点前空格
            final_text = postprocess_text(final_text)
            
            print(f"\n{'='*60}", flush=True)
            print(f"🎤 长音频识别完成 ({chunk_num}块, {len(chunk_results)}个有效结果): {final_text}", flush=True)
            print(f"{'='*60}\n", flush=True)
            logger.info("=" * 60)
            logger.info(f"🎤 长音频识别完成 ({chunk_num}块): {final_text}")
            logger.info("=" * 60)
            return final_text
        
        print(f"[处理音频] ⚠️ 所有音频块识别结果为空", flush=True)
        return ""
    except Exception as e:
        logger.error(f"处理长音频时出错: {e}")
        import traceback
        traceback.print_exc()
        return ""

async def main():
    print("=" * 60, flush=True)
    print("📋 配置信息:", flush=True)
    print(f"   - 中间结果发送: ❌ 禁用（只发送最终结果）", flush=True)
    print(f"   - 最小音频长度: {MIN_AUDIO_SIZE} 字节 (约 {MIN_AUDIO_SIZE//16000} 秒)", flush=True)
    print(f"   - 长音频分块大小: {MAX_CHUNK_SIZE} 字节 (约 {MAX_CHUNK_SIZE//16000} 秒/块)", flush=True)
    print(f"   - 分块重叠: {CHUNK_OVERLAP} 字节 (约 {CHUNK_OVERLAP//16000} 秒)", flush=True)
    print(f"   - 预处理: {'✅ 启用' if ENABLE_AUDIO_PREPROCESS else '❌ 禁用'} (静音阈值={SILENCE_THRESHOLD})", flush=True)
    print(f"   - 音量归一化: {'✅ 启用' if ENABLE_VOLUME_NORMALIZE else '❌ 禁用'}", flush=True)
    print(f"   - 文本后处理: {'✅ 启用' if ENABLE_TEXT_POSTPROCESS else '❌ 禁用'}", flush=True)
    print(f"   - 热词数量: {len(HOTWORDS)}", flush=True)
    print("=" * 60, flush=True)
    logger.info("=" * 60)
    logger.info("📋 配置信息:")
    logger.info(f"   - 中间结果发送: ❌ 禁用（只发送最终结果）")
    logger.info(f"   - 最小音频长度: {MIN_AUDIO_SIZE} 字节")
    logger.info(f"   - 长音频分块大小: {MAX_CHUNK_SIZE} 字节")
    logger.info(f"   - 分块重叠: {CHUNK_OVERLAP} 字节")
    logger.info(f"   - 预处理: {'启用' if ENABLE_AUDIO_PREPROCESS else '禁用'} (静音阈值={SILENCE_THRESHOLD})")
    logger.info(f"   - 音量归一化: {'启用' if ENABLE_VOLUME_NORMALIZE else '禁用'}")
    logger.info(f"   - 文本后处理: {'启用' if ENABLE_TEXT_POSTPROCESS else '禁用'}")
    logger.info(f"   - 热词数量: {len(HOTWORDS)}")
    logger.info("=" * 60)
    """主函数"""
    print("\n" + "=" * 50, flush=True)
    print("FunASR 服务器启动中...", flush=True)
    print("=" * 50 + "\n", flush=True)
    logger.info("=" * 50)
    logger.info("FunASR 服务器启动中...")
    logger.info("=" * 50)
    
    if not load_model():
        print("\n❌ 无法启动服务器: 模型加载失败", flush=True)
        logger.error("无法启动服务器: 模型加载失败")
        return
    
    host = "0.0.0.0"
    port = 10095
    
    print("\n" + "=" * 50, flush=True)
    print(f"启动FunASR WebSocket服务器: ws://{host}:{port}", flush=True)
    print("=" * 50 + "\n", flush=True)
    logger.info("=" * 50)
    logger.info(f"启动FunASR WebSocket服务器: ws://{host}:{port}")
    logger.info("=" * 50)
    
    # 使用新版websockets API
    try:
        async with websockets.serve(handle_client, host, port, max_size=10*1024*1024):
            print("✅ 服务器已启动，等待连接...", flush=True)
            print("可以在浏览器中连接: ws://localhost:10095\n", flush=True)
            logger.info("✅ 服务器已启动，等待连接...")
            logger.info("可以在浏览器中连接: ws://localhost:10095")
            await asyncio.Future()  # 永久运行
    except Exception as e:
        print(f"\n❌ 服务器启动失败: {e}", flush=True)
        logger.error(f"服务器启动失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("服务器已停止")
