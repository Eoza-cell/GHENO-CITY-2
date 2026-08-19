import sys
import torch
from diffusers import StableDiffusionPipeline, DiffusionPipeline

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_krea_image.py <prompt> <output_path>")
        sys.exit(1)

    prompt = sys.argv[1]
    output_path = sys.argv[2]

    negative_prompt = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, distorted face, 3d, realistic photo"

    models = [
        ("cagliostrolab/animagine-xl-3.1", DiffusionPipeline, 24),
        ("krea/Krea-2-Turbo", StableDiffusionPipeline, 8),
        ("black-forest-labs/FLUX.1-schnell", DiffusionPipeline, 4)
    ]

    generated = False
    for model_id, pipeline_cls, steps in models:
        print(f"[Shonen Anime Gen] Trying model: {model_id}...")
        try:
            pipe = pipeline_cls.from_pretrained(
                model_id,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
            )
            if torch.cuda.is_available():
                pipe = pipe.to("cuda")
            else:
                pipe = pipe.to("cpu")

            print(f"[Shonen Anime Gen] Generating image with prompt: '{prompt[:120]}...'")
            if "FLUX" in model_id:
                image = pipe(prompt, num_inference_steps=steps).images[0]
            else:
                image = pipe(prompt, negative_prompt=negative_prompt, num_inference_steps=steps).images[0]

            image.save(output_path)
            print(f"[Shonen Anime Gen] Image generated successfully and saved to: {output_path}")
            generated = True
            break
        except Exception as e:
            print(f"[Shonen Anime Gen] Model {model_id} failed: {str(e)}")

    if not generated:
        sys.exit(1)

if __name__ == "__main__":
    main()
