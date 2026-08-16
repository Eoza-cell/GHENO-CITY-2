import sys
import os
import json
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

def main():
    print("[Python Transformer] Initializing...")
    if len(sys.argv) < 3:
        print("❌ Usage: python transformer_model.py <system_prompt> <user_prompt>")
        sys.exit(1)

    system_prompt = sys.argv[1]
    user_prompt = sys.argv[2]

    # Model name: Gemma local Hugging Face RP model
    model_name = "google/gemma-2-2b-it"
    print(f"[Python Transformer] Loading local Gemma 4B/2B Hugging Face model ({model_name})...")

    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None
        )

        chat = [
            {"role": "user", "content": f"SYSTEM: {system_prompt}\n\nUSER_ACTION: {user_prompt}"}
        ]
        prompt = tokenizer.apply_chat_template(chat, tokenize=False, add_generation_prompt=True)

        inputs = tokenizer(prompt, return_tensors="pt").to("cuda" if torch.cuda.is_available() else "cpu")

        print("[Python Transformer] Generating response...")
        outputs = model.generate(
            **inputs,
            max_new_tokens=512,
            temperature=0.7,
            do_sample=True,
            repetition_penalty=1.15
        )

        response = tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True)
        print("\n--- RESPONSE ---")
        print(response.strip())
        print("----------------")

    except Exception as e:
        print(f"❌ Error generating response via local Gemma Hugging Face Transformers: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
