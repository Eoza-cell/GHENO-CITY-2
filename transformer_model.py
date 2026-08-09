import sys
import os
import json
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

def main():
    print("[Python Transformer] Initializing...")
    # Load parameters from Node
    if len(sys.argv) < 3:
        print("❌ Usage: python transformer_model.py <system_prompt> <user_prompt>")
        sys.exit(1)

    system_prompt = sys.argv[1]
    user_prompt = sys.argv[2]

    # Model name: lightweight Gemma 2B or similar open-source model
    model_name = "google/gemma-2b-it"
    print(f"[Python Transformer] Loading lightweight open-source {model_name}...")

    try:
        # Load tokenizer and model in 8-bit or half precision to protect system RAM
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto"
        )

        # Structure the instruction prompt
        chat = [
            {"role": "user", "content": f"SYSTEM: {system_prompt}\n\nUSER_ACTION: {user_prompt}"}
        ]
        prompt = tokenizer.apply_chat_template(chat, tokenize=False, add_generation_prompt=True)

        inputs = tokenizer(prompt, return_tensors="pt").to("cuda" if torch.cuda.is_available() else "cpu")

        print("[Python Transformer] Generating response...")
        outputs = model.generate(
            **inputs,
            max_new_tokens=512,
            temperature=0.85,
            do_sample=True,
            repetition_penalty=1.15
        )

        response = tokenizer.decode(outputs[0][inputs.input_ids.shape[-1]:], skip_special_tokens=True)
        print("\n--- RESPONSE ---")
        print(response.strip())
        print("----------------")

    except Exception as e:
        print(f"❌ Error loading/generating via local Python Transformers: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
