#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.error
import urllib.request


def extract_text_from_response(data):
    if not data:
        return ''
    if isinstance(data, dict) and isinstance(data.get('output_text'), str) and data.get('output_text'):
        return data.get('output_text')
    output = data.get('output') if isinstance(data, dict) else None
    if isinstance(output, list):
        for item in output:
            content = item.get('content') if isinstance(item, dict) else None
            if isinstance(content, list):
                for part in content:
                    if not isinstance(part, dict):
                        continue
                    text = part.get('text') or part.get('output_text')
                    if isinstance(text, str) and text:
                        return text
    return ''


def parse_sse_text(raw_text):
    if not raw_text:
        return ''
    result = []
    for line in raw_text.splitlines():
        if not line:
            continue
        if not line.startswith('data:'):
            continue
        payload = line[5:].strip()
        if not payload or payload == '[DONE]':
            continue
        if payload.startswith('{') or payload.startswith('['):
            try:
                obj = json.loads(payload)
            except Exception:
                result.append(payload)
                continue
            if isinstance(obj, dict) and isinstance(obj.get('response'), dict):
                nested = extract_text_from_response(obj.get('response'))
                if nested:
                    result.append(nested)
                    continue
            delta = obj.get('delta') if isinstance(obj, dict) else None
            if isinstance(delta, dict):
                text = delta.get('text') or delta.get('output_text') or delta.get('content')
                if isinstance(text, str):
                    result.append(text)
            if isinstance(obj, dict) and isinstance(obj.get('output_text'), str):
                result.append(obj.get('output_text'))
        else:
            result.append(payload)
    return ''.join(result).strip()

def is_sse_payload(raw_text):
    if not raw_text:
        return False
    text = raw_text.lstrip()
    return text.startswith('event:') or text.startswith('data:') or '\nevent:' in raw_text or '\ndata:' in raw_text


def build_body(args):
    if args.compat:
        input_text = (args.system + '\n\n' + args.user).strip() if args.system else args.user
        body = {
            'model': args.model,
            'input': input_text,
            'stream': True,
            'max_output_tokens': args.max_tokens,
        }
    else:
        body = {
            'model': args.model,
            'input': [
                {'role': 'system', 'content': [{'type': 'input_text', 'text': args.system}]},
                {'role': 'user', 'content': [{'type': 'input_text', 'text': args.user}]},
            ],
            'stream': False,
            'max_output_tokens': args.max_tokens,
        }
    if args.temperature is not None:
        body['temperature'] = args.temperature
    if args.reasoning:
        body['reasoning_effort'] = args.reasoning
    return body


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://192.168.50.7:23000/v1/responses')
    parser.add_argument('--key', default='')
    parser.add_argument('--model', default='gpt-5.2')
    parser.add_argument('--compat', action='store_true')
    parser.add_argument('--system', default='You are a helpful assistant.')
    parser.add_argument('--user', default='ping')
    parser.add_argument('--temperature', type=float, default=None)
    parser.add_argument('--reasoning', default='')
    parser.add_argument('--max-tokens', type=int, default=64)
    parser.add_argument('--timeout', type=int, default=60)
    args = parser.parse_args()

    body = build_body(args)
    headers = {'Content-Type': 'application/json'}
    if args.key:
        headers['Authorization'] = 'Bearer ' + args.key

    print('POST', args.url)
    print('Body:', json.dumps(body, ensure_ascii=True))

    req = urllib.request.Request(
        args.url,
        data=json.dumps(body).encode('utf-8'),
        headers=headers,
        method='POST',
    )

    try:
        with urllib.request.urlopen(req, timeout=args.timeout) as resp:
            status = resp.getcode()
            raw = resp.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as err:
        status = err.code
        raw = err.read().decode('utf-8', errors='ignore')
    except Exception as err:
        print('Request error:', err)
        sys.exit(2)

    print('HTTP', status)
    if status != 200:
        print(raw[:400])
        sys.exit(1)

    if args.compat or is_sse_payload(raw):
        text = parse_sse_text(raw)
        if text:
            print('Output:', text)
            return
        if args.compat:
            print('Output: <empty>')
            return

    try:
        data = json.loads(raw) if raw else {}
    except Exception as err:
        print('JSON parse error:', err)
        print(raw[:400])
        sys.exit(1)

    text = extract_text_from_response(data)
    print('Output:', text or '<empty>')


if __name__ == '__main__':
    main()
