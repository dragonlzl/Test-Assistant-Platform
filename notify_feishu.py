#!/usr/bin/env python3
"""
飞书机器人通知脚本。
使用环境变量 FEISHU_WEBHOOK 或命令行参数传入 webhook URL。
如有自定义根证书，可通过环境变量 FEISHU_CA_BUNDLE 指定证书路径。
"""

import json
import os
import sys
import ssl
import urllib.error
import urllib.request


MESSAGE_TEXT = "任务执行完毕！！！"


def build_ssl_context() -> ssl.SSLContext:
    """
    构造 SSL Context。
    - 若设置 FEISHU_CA_BUNDLE，则使用指定证书路径。
    - 其次尝试使用 certifi 的 CA 包。
    - 最后回退到系统默认证书。
    """
    ca_bundle = os.environ.get("FEISHU_CA_BUNDLE")
    if ca_bundle:
        if not os.path.exists(ca_bundle):
            raise FileNotFoundError(f"FEISHU_CA_BUNDLE 指定的证书不存在: {ca_bundle}")
        return ssl.create_default_context(cafile=ca_bundle)

    try:
        import certifi
    except ImportError:
        certifi = None

    if certifi:
        return ssl.create_default_context(cafile=certifi.where())

    return ssl.create_default_context()


def send_feishu_message(webhook_url: str, text: str) -> None:
    """向飞书群机器人发送文本消息。"""
    payload = {
        "msg_type": "text",
        "content": {"text": text},
    }
    data = json.dumps(payload).encode("utf-8")
    ssl_context = build_ssl_context()
    request = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10, context=ssl_context) as response:
        body = response.read().decode("utf-8", errors="replace")
        if response.status >= 300:
            raise RuntimeError(f"飞书返回状态码 {response.status}: {body}")


def main() -> int:
    webhook_env = os.environ.get("FEISHU_WEBHOOK", "").strip()
    webhook_arg = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    webhook_url = (
        webhook_arg
        or webhook_env
        or "https://open.feishu.cn/open-apis/bot/v2/hook/e83422c4-18dc-4062-9aee-9a83d37abe3b"
    )
    if not webhook_url:
        sys.stderr.write("请通过命令行参数或环境变量 FEISHU_WEBHOOK 提供 webhook URL。\n")
        return 1

    try:
        send_feishu_message(webhook_url, MESSAGE_TEXT)
    except (urllib.error.URLError, RuntimeError) as exc:
        sys.stderr.write(f"发送失败: {exc}\n")
        return 1

    print("飞书通知已发送。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
