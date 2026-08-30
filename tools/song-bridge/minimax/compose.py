#!/usr/bin/env python3
"""MiniMax Music 3 直连作曲 —— 不经过 ComfyUI 服务器。

直接加载三个权重（DiT / 文本编码器+AR / DAV 编解码器）跑完整管线：
  文本编码(AR) → KSampler 采样 → VAE 解码 → MP3 导出
每个任务一个独立进程，跑完退出即释放全部 CPU/GPU 内存。

用法：
  python compose.py --caption "风格描述" --lyrics "歌词" \
      [--seed N] [--duration 秒] [--out song.mp3] \
      [--steps 30] [--cfg 1.7] [--ar-cfg 1.5] [--top-k 50] \
      [--device auto|cuda|cpu]

设备策略：auto = 显存 ≥16GiB 走 GPU，否则快速失败（CPU 太慢默认不用）。
进度以 "[progress] ..." 行输出到 stdout，供 song-bridge 转发 SSE。
"""

import argparse
import io as pyio
import os
import subprocess
import sys
import time

COMFY_SRC = os.environ.get(
    "COMFY_SRC",
    r"C:\Users\Administrator\AppData\Local\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI",
)
MODELS_DIR = os.environ.get(
    "COMFY_MODELS_DIR",
    r"C:\Users\Administrator\AppData\Local\Comfy-Desktop\ComfyUI-Shared\models",
)

sys.path.insert(0, COMFY_SRC)
os.chdir(COMFY_SRC)


def log(msg):
    print(f"[compose] {msg}", flush=True)


def progress(phase, value=0, total=0):
    print(f"[progress] {phase}\t{int(value)}\t{int(total)}", flush=True)


def nvidia_free_gib():
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.total,memory.used", "--format=csv,noheader,nounits"],
            text=True, timeout=10
        ).strip()
        total, used = (int(x) for x in out.split("\n")[0].split(","))
        return (total - used) / 1024
    except Exception:
        return None


def pick_device(requested):
    """auto：显存够（≥16GiB）走 GPU；不够则快速失败（CPU 太慢，默认不用）。
    需要 CPU 时显式传 --device cpu。"""
    if requested != "auto":
        return requested
    free = nvidia_free_gib()
    if free is not None and free >= 16:
        return "cuda"
    print(
        f"[error] 可用显存 {free if free is not None else '?'} GiB < 16GiB，无法 GPU 作曲。"
        "请先停掉占用显存的大模型（如本地 LLM 会话），再点生成；或显式 --device cpu（很慢）。",
        flush=True
    )
    sys.exit(3)


def setup_comfy(device):
    """按设备配置后导入 comfy（args.cpu 必须在 model_management 导入前设置）"""
    import comfy.cli_args

    if device == "cpu":
        comfy.cli_args.args.cpu = True
    # cuda 走全默认：动态显存 + vbar 注册 + CUDA graph（深度解码靠它才快）。
    # 注意：TE 必须在 DiT 之前加载（见 main），加载时显存宽裕，权重才会被整体提升到 GPU。

    import numpy as np  # noqa: F401  (re-export for callers)
    import torch
    import av
    import comfy.sd
    import comfy.sample
    import comfy.utils
    import comfy.model_management as mm
    from comfy.ldm.minimax_music.ar import (
        AUDIO_FRAMES_PER_SECOND,
        CFG_SCALE as AR_CFG_DEFAULT,
        CFG_TOP_K as AR_TOPK_DEFAULT,
        MAX_AUDIO_FRAMES,
    )
    from comfy.ldm.minimax_music.dit import latent_length

    if device == "cpu":
        # ComfyUI 的 flash-attention 可用性检查直接调 torch.cuda.*，CPU 下会炸；打补丁禁用
        import comfy_kitchen

        comfy_kitchen.flash_attention_decode_is_available = lambda *a, **k: False

    return {
        "np": np,
        "torch": torch,
        "av": av,
        "sd": comfy.sd,
        "sample": comfy.sample,
        "utils": comfy.utils,
        "mm": mm,
        "AUDIO_FRAMES_PER_SECOND": AUDIO_FRAMES_PER_SECOND,
        "AR_CFG_DEFAULT": AR_CFG_DEFAULT,
        "AR_TOPK_DEFAULT": AR_TOPK_DEFAULT,
        "MAX_AUDIO_FRAMES": MAX_AUDIO_FRAMES,
        "latent_length": latent_length,
    }


def encode_mp3(waveform, sample_rate, out_path, C):
    """与 ComfyUI 相同的 PyAV libmp3lame 编码（320kbps）"""
    np = C["np"]
    av = C["av"]
    audio_np = waveform.squeeze(0).cpu().contiguous().numpy()
    if audio_np.dtype != np.float32:
        audio_np = audio_np.astype(np.float32)

    buf = pyio.BytesIO()
    container = av.open(buf, mode="w", format="mp3")
    stream = container.add_stream("libmp3lame", rate=int(sample_rate))
    stream.bit_rate = 320000
    frame = av.AudioFrame.from_ndarray(
        audio_np, format="fltp", layout="stereo" if audio_np.shape[0] > 1 else "mono"
    )
    frame.sample_rate = int(sample_rate)
    frame.pts = 0
    container.mux(stream.encode(frame))
    container.mux(stream.encode(None))
    container.close()
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--caption", required=True, help="风格/描述（英文）")
    p.add_argument("--lyrics", default="", help="歌词")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--duration", type=float, default=60.0, help="目标时长（秒），模型可提前结束")
    p.add_argument("--out", required=True, help="输出 mp3 路径")
    p.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    p.add_argument("--steps", type=int, default=30)
    p.add_argument("--cfg", type=float, default=1.7)
    p.add_argument("--ar-cfg", type=float, default=None)
    p.add_argument("--top-k", type=int, default=None)
    p.add_argument("--sampler", default="euler")
    p.add_argument("--scheduler", default="simple")
    p.add_argument("--dit", default=os.path.join(MODELS_DIR, "diffusion_models", "minimax_music3_dit_fp16.safetensors"))
    p.add_argument("--te", default=os.path.join(MODELS_DIR, "text_encoders", "minimax_music3_text_encoder_pruned_int8_convrot.safetensors"))
    p.add_argument("--vae", default=os.path.join(MODELS_DIR, "vae", "minimax_music3_dav.safetensors"))
    args = p.parse_args()

    t0 = time.time()

    # 逐 token 的性能打点（CUDA event 同步 / F.linear 猴补丁 / 深度解码包装）本身会
    # 打断 CPU-GPU 流水线，实测把 AR 解码拖慢一大截，因此默认关闭。
    # 需要定位 AR 性能问题时：设环境变量 SONG_AR_PROFILE=1 再跑。
    ar_profile = os.environ.get("SONG_AR_PROFILE") == "1"

    for name, path in (("DiT", args.dit), ("文本编码器", args.te), ("编解码器", args.vae)):
        if not os.path.isfile(path):
            print(f"[error] 找不到{name}权重：{path}", flush=True)
            sys.exit(2)

    device = pick_device(args.device)
    log(f"设备：{device}")
    C = setup_comfy(device)
    torch = C["torch"]
    sd = C["sd"]
    sample = C["sample"]
    utils = C["utils"]
    mm = C["mm"]
    FPS = C["AUDIO_FRAMES_PER_SECOND"]
    MAX_FRAMES = C["MAX_AUDIO_FRAMES"]
    latent_length = C["latent_length"]
    ar_cfg = args.ar_cfg if args.ar_cfg is not None else C["AR_CFG_DEFAULT"]
    top_k = args.top_k if args.top_k is not None else C["AR_TOPK_DEFAULT"]

    # ---- 1. 加载模型（顺序关键：TE 先于 DiT）----
    # 服务端实测行为：AR 期间只有 TE 在显存里做动态提升（此时空闲显存最大，权重整体驻留、
    # CUDA graph 可用），DiT 到 KSampler 阶段才加载。DiT 提前占 4.6GB 会让估算器把部分
    # TE 单元留在内存流式搬运 → AR 慢 3 倍。
    progress("加载文本编码器")
    log("加载文本编码器（含 AR）…")
    clip = sd.load_clip([args.te], clip_type=sd.CLIPType.MINIMAX)

    progress("加载音频编解码器")
    log("加载 DAV 编解码器…")
    vae_sd, vae_meta = utils.load_torch_file(args.vae, return_metadata=True)
    vae = sd.VAE(sd=vae_sd, metadata=vae_meta)

    if device == "cuda":
        try:
            free_b, total_b = torch.cuda.mem_get_info()
            log(
                f"显存：已用 {(total_b - free_b) / 1024**3:.1f} GiB / {total_b / 1024**3:.1f} GiB"
                f"（剩余 {free_b / 1024**3:.1f} GiB）"
            )
        except Exception:
            pass

        # 纯算力基准：排除进程级 GPU 吞吐问题（正常 5090 bf16 应 >150 TFLOPS）
        # 注意：必须用 get_torch_device()。mm.intermediate_device() 在未加 --gpu-only 时
        # 返回 CPU，早前版本用它导致这里量到的是 CPU 算力（约 3 TFLOPS），是假告警。
        if ar_profile:
            try:
                dev = mm.get_torch_device()
                a = torch.randn(4096, 4096, device=dev, dtype=torch.bfloat16)
                b = torch.randn(4096, 4096, device=dev, dtype=torch.bfloat16)
                for _ in range(5):
                    a @ b
                torch.cuda.synchronize()
                tb0 = time.perf_counter()          # 不要用 t0，它是全局总耗时基准
                nrep = 20
                for _ in range(nrep):
                    a @ b
                torch.cuda.synchronize()
                dt = (time.perf_counter() - tb0) / nrep
                log(f"纯算力：bf16 4096³ matmul {dt * 1000:.3f}ms/iter ≈ {2 * 4096**3 / dt / 1e12:.0f} TFLOPS")
                del a, b
            except Exception as e:
                log(f"纯算力基准失败：{e}")

    # ---- AR 性能打点：定位独立进程比服务端模式慢的原因（CUDA event，不阻塞执行）----
    if device == "cuda":
        import types as _types

        import comfy.model_prefetch as _mp
        from comfy.ldm.minimax_music.ar import MiniMaxMusic3AR as _AR

        ar_model = clip.cond_stage_model
        log(f"AR 模型：{type(ar_model).__name__}，execution_device={getattr(ar_model, 'execution_device', '?')}")
        devs = {}
        for p in ar_model.parameters():
            devs[str(p.device)] = devs.get(str(p.device), 0) + p.numel()
        log(f"参数分布：{{{', '.join(f'{k}: {v / 1e6:.0f}M' for k, v in sorted(devs.items()))}}}")
        try:
            attn = ar_model.model.layers[0].self_attn
            wname = "qkv_proj" if hasattr(attn, "qkv_proj") else "q_proj"
            w = getattr(attn, wname).weight
            log(f"抽查权重 {wname}：{tuple(w.shape)} dtype={getattr(w, 'dtype', '?')} device={w.device} type={type(w).__name__}")
        except Exception as e:
            log(f"权重抽查失败：{e}")
        log(
            f"模式：highvram={mm.args.highvram} "
            f"dynamic_vram={'开' if (not mm.args.disable_dynamic_vram and not mm.args.highvram) else '关'} "
            f"NUM_STREAMS={mm.NUM_STREAMS} vram_state={mm.vram_state.name}"
        )

        # —— 默认路径：只在深度解码「首次前向」探一次 CUDA graph 是否生效，随后立刻还原 ——
        # CUDA graph 是深度解码（每 token 调用约 7 次）提速的关键。启用条件见
        # comfy/model_prefetch.py:63 —— 要求 module._v_block is not None；
        # 而 _v_block 只在「动态显存(vbar)加载路径」中才会被赋值（model_patcher.py:2009）。
        # 若空闲显存过于富裕，ComfyUI 会整体加载权重、跳过该路径 → _v_block 缺失
        # → graph 失效 → 深度解码退回逐 kernel 启动 → GPU 利用率掉到 30~50%。
        if not ar_profile:
            _dec = getattr(getattr(ar_model, "model", None), "audio_decoder", None)
            if _dec is not None:
                _dec_fwd_orig = _dec.forward

                def _dec_probe(*a, **k):
                    _dec.forward = _dec_fwd_orig  # 只探一次，之后零开销
                    _ok = getattr(_dec, "_v_block", None) is not None
                    log(
                        f"[CUDA graph] 深度解码首次前向：_v_block={_ok} "
                        f"_comfy_graph={getattr(_dec, '_comfy_graph', None) is not None} "
                        f"disable_cuda_graphs={mm.args.disable_cuda_graphs}"
                        + ("" if _ok else "  ← graph 未生效，AR 会明显变慢")
                    )
                    return _dec_fwd_orig(*a, **k)

                _dec.forward = _dec_probe

    # ---- 以下为逐 token 深度打点：每 token 会做多次 CUDA event 硬同步、并给 F.linear
    #      套 Python 包装（AR 期间数十万次调用），本身就会打断 CPU-GPU 流水线、拖慢 AR。
    #      仅在 SONG_AR_PROFILE=1 时启用，用于诊断，不要在正常生成时打开。----
    if device == "cuda" and ar_profile:
        log("SONG_AR_PROFILE=1：已启用逐 token 打点，本次生成会明显变慢（仅供诊断）")

        # int8 分发探针：数每次 linear 实际走 ck 内核还是反量化回退（F.linear 收到什么类型的权重）
        try:
            from comfy import quant_ops as _qo
            import torch.nn.functional as _F

            _cnt = {"ck": 0, "q_in": 0, "plain": 0}
            if hasattr(_qo, "ck"):
                log(f"kitchen backends: {_qo.ck.list_backends()}")
                _orig_int8 = _qo.ck.int8_linear

                def _int8_spy(*a, **k):
                    _cnt["ck"] += 1
                    return _orig_int8(*a, **k)

                _qo.ck.int8_linear = _int8_spy
            _orig_flin = _F.linear

            def _flin_spy(x, w, b=None):
                if isinstance(w, _qo.QuantizedTensor):
                    _cnt["q_in"] += 1
                else:
                    _cnt["plain"] += 1
                return _orig_flin(x, w, b)

            _F.linear = _flin_spy
        except Exception as e:
            log(f"分发探针设置失败：{e}")

        # int8 GEMM 微基准：单层 linear 逐次计时（看是一次性开销还是稳态慢）
        try:
            attn = ar_model.model.layers[0].self_attn
            layer = getattr(attn, "qkv_proj" if hasattr(attn, "qkv_proj") else "q_proj")
            # 必须放 GPU：用 intermediate_device()（默认 CPU）会变成跨设备搬运，
            # 早前版本因此量到假的 ~19ms/op。
            x = torch.randn(1, 4096, device=mm.get_torch_device(), dtype=torch.bfloat16)

            def _bench(tag):
                for _ in range(3):
                    layer(x)
                torch.cuda.synchronize()
                per_call = []
                for _ in range(28):
                    torch.cuda.synchronize()
                    tc = time.perf_counter()
                    layer(x)
                    torch.cuda.synchronize()
                    per_call.append((time.perf_counter() - tc) * 1000)
                dt_ms = sum(per_call[-20:]) / len(per_call[-20:])
                log(f"微基准[{tag}] {wname}(1×4096)：前5次 {[f'{t:.1f}' for t in per_call[:5]]}ms，稳态均值 {dt_ms:.2f} ms/op")
                return dt_ms

            _bench("无inference_mode")
            with torch.inference_mode():
                _bench("inference_mode")
            log(f"[分发] 微基准56次调用后：ck内核={_cnt['ck']} F.linear收到量化权重={_cnt['q_in']} 普通权重={_cnt['plain']}")
        except Exception as e:
            log(f"微基准失败：{e}")

        # depth decoder：CUDA graph 需要 _v_block；数每个 token 的 decoder 前向次数
        _dstat = {"n": 0}
        try:
            dec = ar_model.model.audio_decoder
            log(
                f"depth decoder：_v_block={getattr(dec, '_v_block', None) is not None} "
                f"_comfy_graph={getattr(dec, '_comfy_graph', None) is not None} "
                f"disable_cuda_graphs={mm.args.disable_cuda_graphs} 层数={len(getattr(dec, 'blocks', []))}"
            )
            orig_dec_fwd = dec.forward

            def dec_wrapped(*a, **k):
                _dstat["n"] += 1
                return orig_dec_fwd(*a, **k)

            dec.forward = dec_wrapped
        except Exception as e:
            log(f"depth decoder 打点失败：{e}")

        # 逐 token 分相计时：LLM 前向 / 深度解码 / c0 采样，每 25 token 汇报一次
        _phase = {"fwd": 0.0, "depth": 0.0, "sample": 0.0, "n": 0}
        _ar_t0 = time.perf_counter()

        def _time_gpu(fn, key):
            ev0, ev1 = torch.cuda.Event(enable_timing=True), torch.cuda.Event(enable_timing=True)
            ev0.record()
            out = fn()
            ev1.record()
            ev1.synchronize()
            _phase[key] += ev0.elapsed_time(ev1)
            return out

        orig_fwd = ar_model.model.forward

        def fwd_wrapped(*a, **k):
            ev0, ev1 = torch.cuda.Event(enable_timing=True), torch.cuda.Event(enable_timing=True)
            ev0.record()
            out = orig_fwd(*a, **k)
            ev1.record()
            ev1.synchronize()
            _phase["fwd"] += ev0.elapsed_time(ev1)
            _phase["n"] += 1
            if _phase["n"] % 25 == 0:
                wall = (time.perf_counter() - _ar_t0) / _phase["n"] * 1000
                log(
                    f"[AR计时] token#{_phase['n']}：LLM前向 {_phase['fwd']:.0f}ms + 深度解码 {_phase['depth']:.0f}ms"
                    f" + c0采样 {_phase['sample']:.0f}ms（GPU 累计）｜墙钟 {wall:.0f} ms/token"
                    f"｜分发 ck={_cnt['ck']} q={_cnt['q_in']} plain={_cnt['plain']}"
                    f"｜decoder调用 {_dstat.get('n', '?')} 次（每token约 {_dstat.get('n', 0) / max(1, _phase['n']):.1f}）"
                )
            return out

        ar_model.model.forward = _types.MethodType(fwd_wrapped, ar_model.model)

        orig_pop = _mp.prefetch_queue_pop

        def pop_wrapped(queue, dev, module, dtype=None, core=None, enable_graph=False, generator=None):
            if core is None:
                return orig_pop(queue, dev, module, dtype=dtype, core=core, enable_graph=enable_graph, generator=generator)
            _time_gpu(lambda: orig_pop(queue, dev, module, dtype=dtype, core=core, enable_graph=enable_graph, generator=generator), "depth")

        _mp.prefetch_queue_pop = pop_wrapped

        orig_c0 = _AR._sample_c0

        def c0_wrapped(self, *a, **k):
            return _time_gpu(lambda: orig_c0(self, *a, **k), "sample")

        _AR._sample_c0 = c0_wrapped

    # ---- AR 进度上报（常开，与打点无关）：改走 stdout，供 song-bridge 转发 SSE
    #      （bridge 的 stderr 已重定向到文件，管道不再可用）----
    if device == "cuda":
        import comfy.utils as _cu

        _orig_trange = _cu.model_trange

        def _trange_with_progress(*a, **k):
            total = k.get("total") or (a[0] if a else None)
            it = iter(_orig_trange(*a, **k))

            class _P:
                i = 0

                def __iter__(self):
                    return self

                def __next__(self):
                    v = next(it)
                    _P.i += 1
                    if total and (_P.i % 25 == 0 or _P.i >= total):
                        print(f"[progress] AR编码\t{_P.i}\t{total}", flush=True)
                    return v

            return _P()

        _cu.model_trange = _trange_with_progress

    # ---- 2. 文本编码：AR 采样生成声学条件序列 ----
    max_frames = min(MAX_FRAMES, max(1, round(args.duration * FPS)))
    with torch.inference_mode():
        progress("编码歌词与风格")
        log(f"AR 编码（最长 {args.duration}s / {max_frames} 帧）…")
        tokens = clip.tokenize(
            args.caption,
            lyrics=args.lyrics,
            seed=args.seed,
            max_audio_frames=max_frames,
            cfg_scale=ar_cfg,
            top_k=top_k,
        )
        conditioning = clip.encode_from_tokens_scheduled(tokens)
        for cond in conditioning:
            hidden = cond[0]
            cond[1]["conditioning_scale"] = torch.ones(
                (hidden.shape[0], 1, 1), device=hidden.device, dtype=hidden.dtype
            )
        seconds = conditioning[0][0].shape[1] / FPS
        log(f"AR 编码完成，实际时长 {seconds:.1f}s（耗时 {time.time() - t0:.0f}s）")

        # 负向条件：全零（等价 ConditioningZeroOut）
        negative = []
        for t in conditioning:
            d = t[1].copy()
            for k in ("pooled_output", "conditioning_lyrics", "conditioning_scale"):
                if d.get(k) is not None:
                    d[k] = torch.zeros_like(d[k])
            negative.append([torch.zeros_like(t[0]), d])

        # ---- 3. 空音频 latent ----
        audio_frames = min(MAX_FRAMES, max(1, round(seconds * FPS)))
        latent = {
            "samples": torch.zeros(
                (1, 128, latent_length(audio_frames)),
                device=mm.intermediate_device(),
                dtype=mm.intermediate_dtype(),
            ),
            "type": "audio",
            "downscale_ratio_temporal": 512,
        }

        # ---- 4. KSampler 采样（DiT 此时才加载，与服务端行为一致）----
        progress("加载扩散模型")
        log("加载 DiT…")
        model = sd.load_diffusion_model(args.dit)

        latent_image = sample.fix_empty_latent_channels(
            model, latent["samples"], None, latent.get("downscale_ratio_temporal")
        )
        noise = sample.prepare_noise(latent_image, args.seed)

        def cb(step, denoised, x, total):
            progress("采样生成", step + 1, total)

        log(f"KSampler：{args.steps} 步，cfg={args.cfg}，{args.sampler}/{args.scheduler}")
        sampled = sample.sample(
            model, noise, args.steps, args.cfg, args.sampler, args.scheduler,
            conditioning, negative, latent_image, denoise=1.0,
            callback=cb, disable_pbar=True, seed=args.seed,
        )

        # ---- 5. VAE 解码（含与 VAEDecodeAudio 相同的标准差归一化）----
        progress("VAE 解码")
        log("DAV 解码…")
        audio = vae.decode(sampled).movedim(-1, 1)
        std = torch.std(audio, dim=[1, 2], keepdim=True) * 5.0
        std[std < 1.0] = 1.0
        audio = audio / std
        sample_rate = getattr(vae, "audio_sample_rate_output", getattr(vae, "audio_sample_rate", 44100))

    # ---- 6. MP3 导出 ----
    progress("导出 MP3")
    encode_mp3(audio, sample_rate, args.out, C)
    size_mb = os.path.getsize(args.out) / 1e6
    log(f"完成：{args.out}（{seconds:.1f}s，{size_mb:.1f}MB，总耗时 {time.time() - t0:.0f}s）")


if __name__ == "__main__":
    main()
