import sys
import os
import json

def read_arg(arg):
    if os.path.exists(arg):
        try:
            with open(arg, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            pass
    return arg

def query_ollama_free_api(system_prompt, user_prompt):
    try:
        from ollamafreeapi import OllamaFreeAPI
        client = OllamaFreeAPI()
    except Exception as e:
        return None

    preferred_models = [
        "llama3.2:latest",
        "smollm2:135m",
        "llama3.2:3b",
        "mistral:latest"
    ]

    for m in preferred_models:
        try:
            full_prompt = f"System: {system_prompt}\nUser: {user_prompt}" if system_prompt else user_prompt
            res = client.chat(prompt=full_prompt, model=m, temperature=0.7)
            if res and isinstance(res, str) and len(res.strip()) > 3:
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
