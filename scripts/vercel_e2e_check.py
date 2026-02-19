import argparse
import json
import time
from dataclasses import dataclass
from typing import Any

import requests


@dataclass
class CheckResult:
    name: str
    ok: bool
    status_code: int | None
    elapsed_ms: int
    payload: Any
    error: str = ""


def request_json(method: str, url: str, body: dict | None = None, timeout: int = 45) -> CheckResult:
    started = time.time()
    try:
        response = requests.request(method=method, url=url, json=body, timeout=timeout)
        elapsed = int((time.time() - started) * 1000)
        payload = response.json() if response.text else {}
        return CheckResult(
            name=url,
            ok=response.ok,
            status_code=response.status_code,
            elapsed_ms=elapsed,
            payload=payload,
        )
    except (requests.RequestException, ValueError, TypeError) as error:
        elapsed = int((time.time() - started) * 1000)
        return CheckResult(
            name=url,
            ok=False,
            status_code=None,
            elapsed_ms=elapsed,
            payload={},
            error=str(error),
        )


def print_result(title: str, result: CheckResult):
    print(f"\n=== {title} ===")
    print(f"ok={result.ok} status={result.status_code} elapsed={result.elapsed_ms}ms")
    if result.error:
        print(f"error: {result.error}")
        return
    print(json.dumps(result.payload, ensure_ascii=False, indent=2)[:3000])


def extract_video_count(payload: dict) -> int:
    videos = payload.get("videos", []) if isinstance(payload, dict) else []
    return len(videos) if isinstance(videos, list) else 0


def result_payload(results: dict[str, CheckResult], key: str) -> dict:
    item = results.get(key)
    if not item or not isinstance(item.payload, dict):
        return {}
    return item.payload


def main():
    parser = argparse.ArgumentParser(description="Vercel and local API end-to-end checker")
    parser.add_argument("--target-url", required=True, help="Alibaba product URL to test")
    parser.add_argument("--vercel-base", default="https://alibaba-video-scraper.vercel.app/api")
    parser.add_argument("--local-base", default="http://127.0.0.1:5000/api")
    parser.add_argument("--skip-local", action="store_true")
    args = parser.parse_args()

    checks = [
        ("health", "GET", "/health", None),
        ("diag", "POST", "/diag", {"url": args.target_url}),
        ("scrape", "POST", "/scrape", {"url": args.target_url}),
        ("extract", "POST", "/extract", {"url": args.target_url}),
    ]

    vercel_results = {}
    local_results = {}

    print("\n############### Vercel checks ###############")
    for title, method, path, body in checks:
        result = request_json(method, f"{args.vercel_base}{path}", body)
        vercel_results[title] = result
        print_result(f"vercel {title}", result)

    if not args.skip_local:
        print("\n############### Local checks ###############")
        for title, method, path, body in checks:
            result = request_json(method, f"{args.local_base}{path}", body)
            local_results[title] = result
            print_result(f"local {title}", result)

    print("\n############### Summary ###############")
    vercel_scrape_count = extract_video_count(result_payload(vercel_results, "scrape"))
    print(f"vercel scrape videos: {vercel_scrape_count}")

    if local_results:
        local_scrape_count = extract_video_count(result_payload(local_results, "scrape"))
        print(f"local scrape videos: {local_scrape_count}")
        delta = local_scrape_count - vercel_scrape_count
        print(f"count delta(local-vercel): {delta}")

    diag_payload = result_payload(vercel_results, "diag")
    tokens = diag_payload.get("video_tokens", {})
    if tokens:
        print(f"vercel diag video tokens: {tokens}")

    print("\n检查完成。")


if __name__ == "__main__":
    main()
