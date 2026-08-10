import sys
import torch
from diffusers import StableDiffusionPipeline

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_krea_image.py <prompt> <output_path>")
        sys.exit(1)

    prompt = sys.argv[1]
    output_path = sys.argv[2]

    print(f"[Krea SD] Initializing krea/Krea-2-Turbo...")
    try:
        model_id = "krea/Krea-2-Turbo"
        # Load stable diffusion pipeline
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
        )
        if torch.cuda.is_available():
            pipe = pipe.to("cuda")
        else:
            pipe = pipe.to("cpu")

        print(f"[Krea SD] Generating image with prompt: '{prompt}'...")
        # Krea-2-Turbo works exceptionally well with low step counts (e.g. 4-8 steps)
        image = pipe(prompt, num_inference_steps=6).images[0]
        image.save(output_path)
        print(f"[Krea SD] Image generated successfully and saved to: {output_path}")
    except Exception as e:
        print("[Krea SD] Error during local generation:", str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
