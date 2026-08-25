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

def main():
    if len(sys.argv) < 3:
        system_prompt = "MJ D'ATR RPG Engine"
        user_prompt = read_arg(sys.argv[1]) if len(sys.argv) > 1 else "Action"
    else:
        system_prompt = read_arg(sys.argv[1])
        user_prompt = read_arg(sys.argv[2])

    try:
        import g4f

        providers = [
            g4f.Provider.Blackbox,
            g4f.Provider.DarkAI,
            g4f.Provider.DeepInfra,
            g4f.Provider.DuckDuckGo,
            g4f.Provider.Llama
        ]

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        for provider in providers:
            try:
                response = g4f.ChatCompletion.create(
                    model="gpt-4o",
                    provider=provider,
                    messages=messages,
                    stream=False
                )
                if response and len(response.strip()) > 10:
                    print(response.strip())
                    return
            except Exception:
                continue

    except Exception as e:
        pass

    # High-quality RPG local narrative engine fallback if g4f package is not installed or offline
    action_display = user_prompt.replace('ACTION:', '').strip()
    if not action_display or len(action_display) > 200:
        action_display = "ton exploration"

    narrative = f"Ton action « {action_display} » résonne à travers l'éther d'ATR. Le flux d'énergie spirituelle de ton essence s'embrase alors que l'environnement s'adapte à ta résolution."
    print(narrative)

if __name__ == "__main__":
    main()
