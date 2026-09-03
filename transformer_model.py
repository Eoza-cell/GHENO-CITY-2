import os
import sys

def read_arg(arg):
    if os.path.exists(arg):
        with open(arg, "r", encoding="utf-8") as handle:
            return handle.read()
    return arg

def main():
    if len(sys.argv) < 3:
        print("", end="")
        return

    system_prompt = read_arg(sys.argv[1]).strip()
    user_prompt = read_arg(sys.argv[2]).strip()

    # Qwen2.5 Instruct follows scene constraints and French system prompts far
    # better than the old generic Empero generation prompt.
    model_name = os.getenv("HF_RP_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
    max_new_tokens = int(os.getenv("HF_RP_MAX_NEW_TOKENS", "420"))

    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM

        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        model_kwargs = {
            "trust_remote_code": True,
            "low_cpu_mem_usage": True
        }

        # Use GPU automatically when available. CPU remains supported.
        if torch.cuda.is_available():
            model_kwargs["torch_dtype"] = torch.float16
            model_kwargs["device_map"] = "auto"

        model = AutoModelForCausalLM.from_pretrained(model_name, **model_kwargs)
        device = next(model.parameters()).device

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        inputs = tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_tensors="pt"
        ).to(device)

        with torch.no_grad():
            output_ids = model.generate(
                inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=float(os.getenv("HF_RP_TEMPERATURE", "0.82")),
                top_p=float(os.getenv("HF_RP_TOP_P", "0.92")),
                repetition_penalty=1.08,
                pad_token_id=tokenizer.eos_token_id
            )

        generated = output_ids[0][inputs.shape[-1]:]
        text = tokenizer.decode(generated, skip_special_tokens=True).strip()

        # Never invent technical reward tags here. Gameplay code decides rewards.
        print(text)
    except Exception as exc:
        print(f"[Transformer Error] {exc}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
