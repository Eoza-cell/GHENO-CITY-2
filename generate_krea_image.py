import sys
import torch
from diffusers import StableDiffusionPipeline, DiffusionPipeline

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_krea_image.py <prompt> <output_path>")
        sys.exit(1)

    prompt = sys.argv[1]
    output_path = sys.argv[2]

    models = [
        ("cagliostrolab/animagine-xl-3.1", DiffusionPipeline, 20),
        ("krea/Krea-2-Turbo", StableDiffusionPipeline, 6),
        ("black-forest-labs/FLUX.1-schnell", DiffusionPipeline, 4)
    ]

    generated = False
    for model_id, pipeline_cls, steps in models:
        print(f"[Image Gen] Trying model: {model_id}...")
        try:
            pipe = pipeline_cls.from_pretrained(
                model_id,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
            )
            if torch.cuda.is_available():
                pipe = pipe.to("cuda")
            else:
                pipe = pipe.to("cpu")

            print(f"[Image Gen] Generating image with prompt: '{prompt[:100]}...'")
            image = pipe(prompt, num_inference_steps=steps).images[0]
            image.save(output_path)
            print(f"[Image Gen] Image generated successfully and saved to: {output_path}")
            generated = True
            break
        except Exception as e:
            print(f"[Image Gen] Model {model_id} failed: {str(e)}")

    if not generated:
        sys.exit(1)

if __name__ == "__main__":
    main()
