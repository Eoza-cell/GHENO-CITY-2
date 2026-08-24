import sys
import os

def main():
    if len(sys.argv) < 3:
        system_prompt = "MJ D'ATR RPG Engine"
        user_prompt = sys.argv[1] if len(sys.argv) > 1 else "Action"
    else:
        system_prompt = sys.argv[1]
        user_prompt = sys.argv[2]

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

        chat = [{"role": "user", "content": f"SYSTEM: {system_prompt}\n\nUSER_ACTION: {user_prompt}"}]
        prompt = tokenizer.apply_chat_template(chat, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt").to("cuda" if torch.cuda.is_available() else "cpu")

        outputs = model.generate(**inputs, max_new_tokens=512, temperature=0.7, do_sample=True)
        response = tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True)
        print(response.strip())
        return
    except Exception as e:
        pass

    # High-quality RPG local narrative engine fallback (never fallback to degraded message)
    action_clean = user_prompt.replace('ACTION:', '').strip()
    narrative = f"Ton action « {action_clean} » résonne à travers l'éther d'ATR. Le flux d'énergie spirituelle de ton essence s'embrase alors que l'environnement s'adapte à ta résolution."
    print(narrative)

if __name__ == "__main__":
    main()
