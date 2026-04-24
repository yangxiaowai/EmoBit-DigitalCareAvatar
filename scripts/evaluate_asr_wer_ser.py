#!/usr/bin/env python3
"""
Evaluate ASR WER and character-level SER/CER.

Usage:
  1. Generate a reference manifest template from local audio:
     python3 scripts/evaluate_asr_wer_ser.py \
       --audio-root val/Audio_files \
       --template-out docs/test-artifacts/asr_eval_manifest.template.csv \
       --limit 50

  2. Fill the "reference" column with human transcripts.

  3. Run evaluation. If "hypothesis" is empty, the script calls a running
     FunASR WebSocket server and fills ASR output before computing metrics:
     python3 scripts/evaluate_asr_wer_ser.py \
       --manifest docs/test-artifacts/asr_eval_manifest.template.csv \
       --funasr-url ws://127.0.0.1:10095

Notes:
  - The user-facing request calls the character metric "SER". In this script
    SER is implemented as character error rate and also exported as CER.
  - True WER/SER requires human reference transcripts. Emotion labels or model
    self-transcripts are not valid references.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable


AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm"}
PUNCT_RE = re.compile(r"[^\w\u4e00-\u9fff]+", re.UNICODE)
TOKEN_RE = re.compile(r"[\u4e00-\u9fff]|[a-z0-9]+", re.IGNORECASE)


@dataclass
class EditCounts:
    substitutions: int
    insertions: int
    deletions: int

    @property
    def errors(self) -> int:
        return self.substitutions + self.insertions + self.deletions


@dataclass
class SampleResult:
    audio_path: str
    reference: str
    hypothesis: str
    language: str | None
    wer_errors: int
    wer_ref_units: int
    wer: float | None
    ser_errors: int
    ser_ref_units: int
    ser: float | None
    latency_ms: int | None


def normalize_text(text: str) -> str:
    return PUNCT_RE.sub(" ", str(text or "").lower()).strip()


def tokenize_words(text: str) -> list[str]:
    return TOKEN_RE.findall(normalize_text(text))


def tokenize_chars(text: str) -> list[str]:
    normalized = normalize_text(text)
    return [ch for ch in normalized.replace(" ", "")]


def edit_distance_counts(reference: list[str], hypothesis: list[str]) -> EditCounts:
    rows = len(reference) + 1
    cols = len(hypothesis) + 1
    dp = [[0] * cols for _ in range(rows)]
    op = [[""] * cols for _ in range(rows)]

    for i in range(1, rows):
        dp[i][0] = i
        op[i][0] = "D"
    for j in range(1, cols):
        dp[0][j] = j
        op[0][j] = "I"

    for i in range(1, rows):
        for j in range(1, cols):
            if reference[i - 1] == hypothesis[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
                op[i][j] = "M"
                continue

            candidates = [
                (dp[i - 1][j - 1] + 1, "S"),
                (dp[i][j - 1] + 1, "I"),
                (dp[i - 1][j] + 1, "D"),
            ]
            dp[i][j], op[i][j] = min(candidates, key=lambda x: x[0])

    i = len(reference)
    j = len(hypothesis)
    substitutions = insertions = deletions = 0
    while i > 0 or j > 0:
        current = op[i][j]
        if current == "M":
            i -= 1
            j -= 1
        elif current == "S":
            substitutions += 1
            i -= 1
            j -= 1
        elif current == "I":
            insertions += 1
            j -= 1
        elif current == "D":
            deletions += 1
            i -= 1
        else:
            break

    return EditCounts(substitutions=substitutions, insertions=insertions, deletions=deletions)


def natural_key(path: Path) -> list[object]:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", str(path))]


def discover_audio_files(audio_root: Path, limit: int | None) -> list[Path]:
    files = sorted(
        (p for p in audio_root.rglob("*") if p.is_file() and p.suffix.lower() in AUDIO_EXTENSIONS),
        key=natural_key,
    )
    return files[:limit] if limit is not None else files


def write_manifest_template(audio_root: Path, template_out: Path, limit: int | None) -> int:
    files = discover_audio_files(audio_root, limit)
    template_out.parent.mkdir(parents=True, exist_ok=True)
    with template_out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["audio_path", "reference", "hypothesis"])
        writer.writeheader()
        for audio_path in files:
            writer.writerow({
                "audio_path": str(audio_path),
                "reference": "",
                "hypothesis": "",
            })
    return len(files)


def read_manifest(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        required = {"audio_path", "reference"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"manifest 缺少必要列: {', '.join(sorted(missing))}")
        return [{k: (v or "").strip() for k, v in row.items()} for row in reader]


def transcode_to_pcm16k(audio_path: Path) -> bytes:
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(audio_path),
            "-f",
            "s16le",
            "-acodec",
            "pcm_s16le",
            "-ac",
            "1",
            "-ar",
            "16000",
            "pipe:1",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 转码失败: {audio_path}\n{result.stderr.decode('utf-8', 'ignore')}")
    return result.stdout


async def recognize_with_funasr(
    funasr_url: str,
    audio_path: Path,
    language: str,
    timeout_seconds: int,
) -> tuple[str, str | None, int]:
    try:
        import websockets
    except ImportError as exc:
        raise RuntimeError("缺少 websockets，请先安装 FunASR 运行依赖") from exc

    pcm = transcode_to_pcm16k(audio_path)
    started_at = time.perf_counter()
    async with websockets.connect(funasr_url, open_timeout=timeout_seconds) as ws:
        await ws.send(json.dumps({"type": "start", "language": language}, ensure_ascii=False))
        while True:
            data = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout_seconds))
            if data.get("type") == "ready":
                break

        await ws.send(pcm)
        await ws.send(json.dumps({"type": "stop", "is_speaking": False}, ensure_ascii=False))

        while True:
            data = json.loads(await asyncio.wait_for(ws.recv(), timeout=timeout_seconds))
            if data.get("is_final") is True:
                latency_ms = int((time.perf_counter() - started_at) * 1000)
                return str(data.get("text") or "").strip(), data.get("language"), latency_ms


async def maybe_recognize_rows(
    rows: list[dict[str, str]],
    funasr_url: str | None,
    language: str,
    timeout_seconds: int,
) -> list[tuple[str, str | None, int | None]]:
    outputs: list[tuple[str, str | None, int | None]] = []
    for row in rows:
        hypothesis = row.get("hypothesis", "").strip()
        if hypothesis:
            outputs.append((hypothesis, row.get("language") or None, None))
            continue
        if not funasr_url:
            outputs.append(("", None, None))
            continue
        text, detected_language, latency_ms = await recognize_with_funasr(
            funasr_url,
            Path(row["audio_path"]),
            language,
            timeout_seconds,
        )
        outputs.append((text, detected_language, latency_ms))
    return outputs


def evaluate_samples(
    rows: list[dict[str, str]],
    hypotheses: list[tuple[str, str | None, int | None]],
) -> list[SampleResult]:
    samples: list[SampleResult] = []
    for row, (hypothesis, language, latency_ms) in zip(rows, hypotheses):
        reference = row.get("reference", "").strip()
        ref_words = tokenize_words(reference)
        hyp_words = tokenize_words(hypothesis)
        ref_chars = tokenize_chars(reference)
        hyp_chars = tokenize_chars(hypothesis)
        word_counts = edit_distance_counts(ref_words, hyp_words)
        char_counts = edit_distance_counts(ref_chars, hyp_chars)
        samples.append(
            SampleResult(
                audio_path=row["audio_path"],
                reference=reference,
                hypothesis=hypothesis,
                language=language,
                wer_errors=word_counts.errors,
                wer_ref_units=len(ref_words),
                wer=(word_counts.errors / len(ref_words)) if ref_words else None,
                ser_errors=char_counts.errors,
                ser_ref_units=len(ref_chars),
                ser=(char_counts.errors / len(ref_chars)) if ref_chars else None,
                latency_ms=latency_ms,
            )
        )
    return samples


def build_report(samples: list[SampleResult], manifest: Path | None) -> dict:
    total_word_errors = sum(s.wer_errors for s in samples)
    total_word_units = sum(s.wer_ref_units for s in samples)
    total_char_errors = sum(s.ser_errors for s in samples)
    total_char_units = sum(s.ser_ref_units for s in samples)
    latencies = [s.latency_ms for s in samples if s.latency_ms is not None]
    return {
        "status": "ok" if samples else "reference_missing",
        "manifest": str(manifest) if manifest else None,
        "sample_count": len(samples),
        "metric_definitions": {
            "wer": "word/token error rate = (substitutions + insertions + deletions) / reference token count",
            "ser": "character error rate used as 字错率 = (substitutions + insertions + deletions) / reference character count",
            "cer": "alias of ser in this report",
            "tokenization": "CJK characters are individual tokens; Latin letters/digits are grouped into alphanumeric words; punctuation is ignored.",
        },
        "aggregate": {
            "wer": (total_word_errors / total_word_units) if total_word_units else None,
            "wer_percent": (total_word_errors / total_word_units * 100) if total_word_units else None,
            "wer_errors": total_word_errors,
            "wer_reference_units": total_word_units,
            "ser": (total_char_errors / total_char_units) if total_char_units else None,
            "ser_percent": (total_char_errors / total_char_units * 100) if total_char_units else None,
            "cer": (total_char_errors / total_char_units) if total_char_units else None,
            "cer_percent": (total_char_errors / total_char_units * 100) if total_char_units else None,
            "ser_errors": total_char_errors,
            "ser_reference_units": total_char_units,
            "latency_ms": {
                "min": min(latencies) if latencies else None,
                "max": max(latencies) if latencies else None,
                "mean": (sum(latencies) / len(latencies)) if latencies else None,
            },
        },
        "samples": [asdict(s) for s in samples],
    }


def write_sample_csv(samples: Iterable[SampleResult], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(SampleResult.__dataclass_fields__.keys())
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for sample in samples:
            writer.writerow(asdict(sample))


def run_self_test() -> None:
    rows = [
        {"audio_path": "dummy1.wav", "reference": "hello world"},
        {"audio_path": "dummy2.wav", "reference": "你好世界"},
    ]
    samples = evaluate_samples(rows, [("hello word", None, None), ("你好世", None, None)])
    report = build_report(samples, None)
    assert round(samples[0].wer or 0, 4) == 0.5
    assert round(samples[1].ser or 0, 4) == 0.25
    assert report["aggregate"]["wer_reference_units"] == 6
    print(json.dumps(report["aggregate"], ensure_ascii=False, indent=2))


async def main_async(args: argparse.Namespace) -> int:
    if args.self_test:
        run_self_test()
        return 0

    if args.audio_root:
        count = write_manifest_template(Path(args.audio_root), Path(args.template_out), args.limit)
        print(f"已生成待标注清单: {args.template_out}，样本数: {count}")
        if not args.manifest:
            print("未提供 manifest/reference，暂不计算 WER/SER。请填写 reference 列后重新运行。")
            return 0

    if not args.manifest:
        raise SystemExit("需要 --manifest，或先用 --audio-root 生成待标注模板。")

    manifest = Path(args.manifest)
    rows = read_manifest(manifest)
    rows_with_reference = [row for row in rows if row.get("reference", "").strip()]
    skipped = len(rows) - len(rows_with_reference)

    if args.limit is not None:
        rows_with_reference = rows_with_reference[:args.limit]

    if not rows_with_reference:
        output = {
            "status": "reference_missing",
            "manifest": str(manifest),
            "total_rows": len(rows),
            "rows_with_reference": 0,
            "message": "没有人工参考转写，无法计算真实 WER/SER。请填写 reference 列。",
        }
        Path(args.result_out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.result_out).write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 2

    hypotheses = await maybe_recognize_rows(
        rows_with_reference,
        args.funasr_url,
        args.language,
        args.timeout_seconds,
    )
    samples = evaluate_samples(rows_with_reference, hypotheses)
    report = build_report(samples, manifest)
    report["skipped_rows_without_reference"] = skipped

    result_out = Path(args.result_out)
    result_out.parent.mkdir(parents=True, exist_ok=True)
    result_out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_sample_csv(samples, Path(args.per_sample_out))

    print(json.dumps(report["aggregate"], ensure_ascii=False, indent=2))
    print(f"结果已写入: {result_out}")
    print(f"逐样本结果已写入: {args.per_sample_out}")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate FunASR WER and character-level SER/CER.")
    parser.add_argument("--manifest", help="CSV with columns: audio_path,reference[,hypothesis]")
    parser.add_argument("--audio-root", help="Generate a reference manifest template from this audio root.")
    parser.add_argument("--template-out", default="docs/test-artifacts/asr_eval_manifest.template.csv")
    parser.add_argument("--result-out", default="docs/test-artifacts/asr_wer_ser_results.json")
    parser.add_argument("--per-sample-out", default="docs/test-artifacts/asr_wer_ser_samples.csv")
    parser.add_argument("--funasr-url", default=os.getenv("VITE_FUNASR_WS_URL", ""))
    parser.add_argument("--language", default=os.getenv("VITE_FUNASR_LANGUAGE", "auto"))
    parser.add_argument("--timeout-seconds", type=int, default=180)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
