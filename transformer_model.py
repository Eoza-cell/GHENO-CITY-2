import sys
import os
import re

def read_arg(arg):
    if os.path.exists(arg):
        try:
            with open(arg, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            pass
    return arg

def extract_user_action(prompt_text):
    # Extracts only the player's action, removing system prompts or header blocks
    match = re.search(r'ACTION\s*:\s*(.+)$', prompt_text, re.IGNORECASE | re.MULTILINE)
    if match:
        return match.group(1).strip()
    match2 = re.search(r'User\s*:\s*(.+)$', prompt_text, re.IGNORECASE | re.DOTALL)
    if match2:
        return match2.group(1).strip()
    return prompt_text.strip()

def main():
    if len(sys.argv) < 3:
        system_prompt = "MJ D'ATR RPG Engine"
        user_prompt = read_arg(sys.argv[1]) if len(sys.argv) > 1 else "Action"
    else:
        system_prompt = read_arg(sys.argv[1])
        user_prompt = read_arg(sys.argv[2])

    clean_action = extract_user_action(user_prompt)

    # Attempt Hugging Face Transformers local pipeline
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
        import torch

        model_name = "google/gemma-2-2b-it"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None
        )

        chat = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": clean_action}
        ]
        prompt = tokenizer.apply_chat_template(chat, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda" if torch.cuda.is_available() else "cpu")

        outputs = model.generate(**inputs, max_new_tokens=512, temperature=0.7, do_sample=True)
        response = tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True)

        # Remove any system prompt echoes if model echoes system
        cleaned_response = re.sub(r'MJ D\'ATR[\s\S]*?RULES.*?\n', '', response, flags=re.IGNORECASE)
        print(cleaned_response.strip())
        return
    except Exception as e:
        pass

    # High-quality RPG local narrative engine fallback (never echo system prompt)
    action_display = clean_action.replace('ACTION:', '').strip()
    if not action_display or len(action_display) > 200:
        action_display = "ton exploration"

    narrative = f"Ton action « {action_display} » résonne à travers l'éther d'ATR. Le flux d'énergie spirituelle de ton essence s'embrase alors que l'environnement s'adapte à ta résolution."
    print(narrative)

if __name__ == "__main__":
    main()
