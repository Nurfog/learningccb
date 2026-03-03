import os
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from diffusers import StableDiffusionPipeline
from PIL import Image
import uuid

app = FastAPI()

# Configuration
MODEL_ID = "runwayml/stable-diffusion-v1-5"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Global variables for the model
pipe = None

def load_model():
    global pipe
    print("Loading Stable Diffusion model on CPU...")
    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID, 
        torch_dtype=torch.float32,
    )
    pipe.to("cpu")
    # pipe.enable_model_cpu_offload() 
    pipe.enable_attention_slicing()
    print("Model loaded successfully.")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Model loading is heavy, we'll do it on first request to avoid timeout at startup
    yield

app = FastAPI(lifespan=lifespan)

# Serve generated images
from fastapi.staticfiles import StaticFiles
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

class ImageRequest(BaseModel):
    prompt: str
    lesson_id: str

@app.post("/generate")
async def generate_image(request: ImageRequest):
    global pipe
    if pipe is None:
        load_model()
    
    try:
        print(f"Generating image for prompt: {request.prompt}")
        
        generator = torch.manual_seed(42)
        # Using a small number of steps for speed since it's on CPU
        image = pipe(
            request.prompt,
            num_inference_steps=20,
            generator=generator
        ).images[0]
        
        image_filename = f"image_{request.lesson_id}_{uuid.uuid4().hex[:8]}.png"
        image_path = os.path.join(OUTPUT_DIR, image_filename)
        
        image.save(image_path)
        
        # Return the absolute URL pointing to t-800 so the frontend can find it
        hostname = os.getenv("BRIDGE_HOSTNAME", "localhost")
        full_url = f"http://{hostname}:8080/outputs/{image_filename}"
        
        return {"status": "completed", "url": full_url}
        
    except Exception as e:
        print(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": pipe is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
