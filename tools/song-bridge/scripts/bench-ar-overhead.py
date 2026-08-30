#!/usr/bin/env python3
"""量化 AR 逐 token 解码中「调试打点」的开销。

模拟真实 AR decode 的负载特征：batch=1、每步几十个小 GEMM（kernel 很小、
启动开销占比高、靠 CPU 提前排队才能喂满 GPU）。

对比四种情形：
  A 基线                     —— 不同步、不打补丁
  B 每步 CUDA Event 同步 x3  —— compose.py 现状（fwd / depth / c0 各一次）
  C F.linear 猴补丁          —— compose.py 现状（每次 linear 多一层 Python + isinstance）
  D B + C                    —— compose.py 实际现状
"""
import time
import torch
import torch.nn.functional as F

DEV = "cuda"
DTYPE = torch.bfloat16
HID = 4096
LAYERS = 32          # 每 token 走 32 层
PER_LAYER = 7        # 每层 7 个 linear（qkv/o + mlp）
STEPS = 300          # 模拟 300 个 token

torch.manual_seed(0)
W = [torch.randn(HID, HID, device=DEV, dtype=DTYPE) for _ in range(PER_LAYER)]
x0 = torch.randn(1, HID, device=DEV, dtype=DTYPE)


def one_token(x, linear):
    """一个 token 的前向：LAYERS x PER_LAYER 个小 GEMM"""
    for _ in range(LAYERS):
        for w in linear_weights:
            x = linear(x, w)
            x = torch.nn.functional.silu(x)
        x = x / (x.norm() + 1e-6) * 32.0   # 稳住数值，别溢出
    return x


linear_weights = W


class QuantizedTensorStub:
    pass


def run(tag, sync_per_step=0, patch_linear=False):
    orig = F.linear
    cnt = {"n": 0}
    if patch_linear:
        def spy(x, w, b=None):
            # 与 compose.py 一致：每次 linear 多一次 Python 调用 + isinstance
            if isinstance(w, QuantizedTensorStub):
                cnt["n"] += 1
            else:
                cnt["n"] += 1
            return orig(x, w, b)
        F.linear = spy
    linear = F.linear

    try:
        x = x0.clone()
        # 预热
        for _ in range(5):
            x = one_token(x, linear)
        torch.cuda.synchronize()

        x = x0.clone()
        t0 = time.perf_counter()
        for _ in range(STEPS):
            for _ in range(max(1, sync_per_step) if sync_per_step else 1):
                pass
            if sync_per_step:
                # compose.py 的 _time_gpu / fwd_wrapped：每次都新建两个 Event 并 synchronize
                for _ in range(sync_per_step):
                    ev0 = torch.cuda.Event(enable_timing=True)
                    ev1 = torch.cuda.Event(enable_timing=True)
                    ev0.record()
                    x = one_token(x, linear)
                    ev1.record()
                    ev1.synchronize()          # 硬同步，打断 CPU-GPU 流水
                    ev0.elapsed_time(ev1)
            else:
                x = one_token(x, linear)
        torch.cuda.synchronize()
        dt = time.perf_counter() - t0
    finally:
        F.linear = orig

    # sync_per_step 时每步做了 sync_per_step 次 one_token，折算成"每 token 等效"
    tokens = STEPS * (sync_per_step if sync_per_step else 1)
    print(f"{tag:34s} {tokens/dt:7.2f} it/s   {dt/tokens*1000:6.2f} ms/token   总 {dt:5.1f}s")
    return tokens / dt


print(f"设备 {torch.cuda.get_device_name(0)} | torch {torch.__version__}")
print(f"每 token {LAYERS*PER_LAYER} 个 1x{HID} @ {HID}x{HID} GEMM\n")

a = run("A 基线（无同步·无补丁）")
b = run("B 每步 Event 同步 x3", sync_per_step=3)
c = run("C F.linear 猴补丁", patch_linear=True)
d = run("D B+C（compose.py 现状）", sync_per_step=3, patch_linear=True)

print()
print(f"B 相对 A：{(1-b/a)*100:5.1f}% 变慢")
print(f"C 相对 A：{(1-c/a)*100:5.1f}% 变慢")
print(f"D 相对 A：{(1-d/a)*100:5.1f}% 变慢  → 去掉打点可提速 {a/d:.2f}x")
