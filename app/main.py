import base64
import io
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from app.gcode_utils import gcode_output
from app.job_creation import process_job
from app.models import AirbrushJobRequest, AirbrushJobResponse

app = FastAPI(title="Airbrush Web API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def decode_base64_image(image_base64: str) -> Image.Image:
    """Decode a base64 string to a PIL Image."""
    if image_base64.startswith("data:image"):
        image_base64 = image_base64.split(",")[1]
    image_data = base64.b64decode(image_base64)
    return Image.open(io.BytesIO(image_data))


def encode_image_to_base64(image: Image.Image) -> str:
    """Encode a PIL Image to a base64 string."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


@app.get("/test")
async def root():
    return {"message": "hello from airbrush-web"}


@app.get("/ping")
async def ping():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/generate", response_model=AirbrushJobResponse)
async def generate_gcode(request: AirbrushJobRequest) -> AirbrushJobResponse:
    """Generate G-code from an image and job parameters."""
    image = decode_base64_image(request.image_base64)

    result = process_job(job=request, image=image)

    gcode_lines = gcode_output(result.gcode_objects, enable_axis_culling=False)
    gcode_string = "\n".join(gcode_lines)

    preview_base64 = encode_image_to_base64(result.preview_image)

    return AirbrushJobResponse(
        gcode=gcode_string,
        preview_image_base64=preview_base64,
        total_lines=len(gcode_lines),
    )
