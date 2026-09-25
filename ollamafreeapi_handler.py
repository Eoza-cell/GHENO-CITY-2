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

def normalize_url(raw_url):
    if not raw_url:
        return None
    raw_url = str(raw_url).strip()
    if not raw_url.startswith(('http://', 'https://')):
        return f"http://{raw_url}"
    return raw_url

def check_and_query_server(url, system_prompt, user_prompt):
    url = normalize_url(url)
    if not url:
        return None

    try:
        tags_req = urllib.request.Request(f"{url}/api/tags")
        with urllib.request.urlopen(tags_req, timeout=2) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            raw_tags = [item.get('name') for item in data.get('models', []) if item.get('name')]

            valid_tags = [
                t for t in raw_tags
                if not any(bad in t.lower() for bad in ['probe', 'pentest', 'nonexistent', 'llava', 'bakllava'])
            ]

            valid_tags.sort(key=lambda x: 0 if any(f in x.lower() for f in ['llama', 'smollm2', 'mistral', 'deepseek']) else 1)

            for t in valid_tags:
                try:
                    payload = {
                        "model": t,
                        "messages": [],
                        "stream": False,
                        "options": {"temperature": 0.7}
                    }
                    if system_prompt:
                        payload["messages"].append({"role": "system", "content": system_prompt})
                    payload["messages"].append({"role": "user", "content": user_prompt})

                    chat_req = urllib.request.Request(
                        f"{url}/api/chat",
                        data=json.dumps(payload).encode('utf-8'),
                        headers={'Content-Type': 'application/json'},
                        method='POST'
                    )
                    with urllib.request.urlopen(chat_req, timeout=8) as chat_resp:
                        chat_data = json.loads(chat_resp.read().decode('utf-8'))
                        content = chat_data.get('message', {}).get('content', '')
                        if content and isinstance(content, str) and len(content.strip()) > 5:
                            return content.strip()
                except Exception:
                    continue
    except Exception:
        pass
    return None

def query_ollama_free_api(system_prompt, user_prompt):
    try:
        from ollamafreeapi import OllamaFreeAPI
        client = OllamaFreeAPI()
    except Exception:
        client = None

    preferred_models = [
        "llama3.2:latest",
        "smollm2:135m",
        "llama3.2:3b",
        "mistral:latest",
        "deepseek-r1:latest",
        "gpt-oss:20b"
    ]

    server_urls = set()
    if client and hasattr(client, '_models_data') and isinstance(client._models_data, dict):
        for family, models in client._models_data.items():
            if isinstance(models, list):
                for model_info in models:
                    if isinstance(model_info, dict) and model_info.get('ip_port'):
                        norm = normalize_url(model_info['ip_port'])
                        if norm:
                            server_urls.add(norm)

    if server_urls:
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(server_urls)) as executor:
            futures = [
                executor.submit(check_and_query_server, url, system_prompt, user_prompt)
                for url in server_urls
            ]
            for future in concurrent.futures.as_completed(futures):
                try:
                    res = future.result()
                    if res:
                        return res
                except Exception:
                    continue

    if client:
        for m in preferred_models:
            try:
                full_prompt = f"System: {system_prompt}\nUser: {user_prompt}" if system_prompt else user_prompt
                res = client.chat(prompt=full_prompt, model=m, temperature=0.7)
                if res and isinstance(res, str) and len(res.strip()) > 5:
                    return res.strip()
            except Exception:
                continue

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

    result = query_ollama_free_api(system_prompt, user_prompt)
    if result:
        print(result)
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
