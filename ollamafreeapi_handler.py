import sys
import os
import json
import urllib.request
import concurrent.futures

def read_arg(arg):
    if os.path.exists(arg):
        try:
            with open(arg, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            pass
    return arg

def query_direct_ollama(system_prompt, user_prompt):
    url = "http://108.181.196.208:11434"
    full_prompt = f"System: {system_prompt}\nUser: {user_prompt}" if system_prompt else user_prompt
    models = ["llama3.2:latest", "smollm2:135m"]

    for m in models:
        try:
            # 1. Try /api/chat
            req_chat = urllib.request.Request(
                f"{url}/api/chat",
                data=json.dumps({
                    "model": m,
                    "messages": [
                        {"role": "system", "content": system_prompt or "Tu es Raiden, une IA libre et humaine dans ATR."},
                        {"role": "user", "content": user_prompt}
                    ],
                    "stream": False,
                    "options": {"temperature": 0.7}
                }).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req_chat, timeout=12) as chat_resp:
                chat_data = json.loads(chat_resp.read().decode('utf-8'))
                content = chat_data.get('message', {}).get('content', '')
                if content and isinstance(content, str) and len(content.strip()) > 3:
                    return content.strip()
        except Exception:
            pass

        try:
            # 2. Try /api/generate
            req_gen = urllib.request.Request(
                f"{url}/api/generate",
                data=json.dumps({
                    "model": m,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {"temperature": 0.7}
                }).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req_gen, timeout=12) as gen_resp:
                gen_data = json.loads(gen_resp.read().decode('utf-8'))
                content = gen_data.get('response', '')
                if content and isinstance(content, str) and len(content.strip()) > 3:
                    return content.strip()
        except Exception:
            pass

    return None

def main():
    if len(sys.argv) < 2:
        sys.exit(1)

    if len(sys.argv) == 2:
        system_prompt = "Tu es le Maître du Jeu d'ATR RPG."
        user_prompt = read_arg(sys.argv[1])
    else:
        system_prompt = read_arg(sys.argv[1])
        user_prompt = read_arg(sys.argv[2])

    result = query_direct_ollama(system_prompt, user_prompt)
    if result:
        print(result)
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
