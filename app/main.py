import base64
import io
import logging
import os
import traceback
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import sentry_sdk

from app.gcode_utils import gcode_output
from app.job_creation import process_job
from app.models import (
    AirbrushJobRequest,
    AirbrushJobResponse,
    AirbrushVectorJobRequest,
    AirbrushVectorJobResponse,
)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

sentry_dsn = os.getenv("SENTRY_DSN", "")
logger.debug(f"SENTRY_DSN is {'set' if sentry_dsn else 'NOT set'}")
if sentry_dsn:
    logger.debug(f"SENTRY_DSN starts with: {sentry_dsn[:20]}...")

sentry_sdk.init(
    dsn=sentry_dsn,
    enable_tracing=True,
    traces_sample_rate=0.1,
    debug=True,
)
sentry_sdk.set_level("info")

client = sentry_sdk.get_client()
logger.debug(f"Sentry client is_active: {client.is_active()}")
logger.debug(f"Sentry DSN configured: {client.dsn}")

app = FastAPI(title="Airbrush Web API", version="0.1.0")

RASTER_GCODE_PARAMETER_ORDER = [
    "filename",
    "job_size",
    "job_origin_corner",
    "job_location",
    "print_channel",
    "print_direction",
    "feedrate",
    "z",
    "padding_distance",
    "ramp_distances",
    "y_step_distance",
    "ab_min",
    "ab_max",
    "gaussian_blur_radius",
    "enable_gradient_border",
    "gradient_border_width",
    "gradient_levels",
    "draw_bounding_box",
]

VECTOR_GCODE_PARAMETER_ORDER = [
    "filename",
    "job_size",
    "job_origin_corner",
    "job_location",
    "feedrate",
    "z",
    "ramp_distances",
    "ab_min",
    "ab_max",
    "darkness",
    "optimize_toolpath",
]

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
    image = Image.open(io.BytesIO(image_data))
    image.load()
    return image.convert("RGB")


def encode_image_to_base64(image: Image.Image) -> str:
    """Encode a PIL Image to a base64 string."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _format_gcode_header_value(value):
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, list):
        return f"[{', '.join(_format_gcode_header_value(item) for item in value)}]"
    return str(value)


def _gcode_parameter_header(request, parameter_order, exclude):
    request_data = request.model_dump(mode="json", exclude=exclude)
    header = ["; Job parameters from tool:"]
    header.extend(
        f"; {parameter}: {_format_gcode_header_value(request_data[parameter])}"
        for parameter in parameter_order
    )
    return header


@app.get("/test")
async def root():
    return {"message": "hello from airbrush-web"}


@app.get("/ping")
async def ping():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


async def _generate_gcode_response(request: AirbrushJobRequest) -> AirbrushJobResponse:
    """Generate G-code from an image and job parameters."""
    try:
        scope = sentry_sdk.get_current_scope()
        scope.clear()
        scope.add_attachment(
            bytes=request.model_dump_json(exclude={"image_base64"}).encode(),
            filename="in_data.json",
        )

        image = decode_base64_image(request.image_base64)

        image_buffer = io.BytesIO()
        image.save(image_buffer, format="PNG")
        scope.add_attachment(bytes=image_buffer.getvalue(), filename=request.filename)

        result = process_job(
            job=request,
            image=image,
            add_bounding_box=request.draw_bounding_box,
            bounding_box_z=request.z,
        )

        gcode_lines = _gcode_parameter_header(
            request, RASTER_GCODE_PARAMETER_ORDER, {"image_base64"}
        )
        gcode_lines += gcode_output(result.gcode_objects, enable_axis_culling=False)
        gcode_string = "\n".join(gcode_lines)

        preview_base64 = encode_image_to_base64(result.preview_image)

        preview_buffer = io.BytesIO()
        result.preview_image.save(preview_buffer, format="PNG")

        with sentry_sdk.push_scope() as scope:
            scope.add_attachment(bytes=gcode_string.encode(), filename="output.gcode")
            scope.add_attachment(
                bytes=preview_buffer.getvalue(), filename="preview.png"
            )
            sentry_sdk.capture_message("gcode generation completed", level="info")

        return AirbrushJobResponse(
            gcode=gcode_string,
            preview_image_base64=preview_base64,
            total_lines=len(gcode_lines),
        )
    except Exception as e:
        traceback.print_exc()
        sentry_sdk.capture_exception(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate", response_model=AirbrushJobResponse)
async def generate_gcode(request: AirbrushJobRequest) -> AirbrushJobResponse:
    return await _generate_gcode_response(request)


async def _generate_vector_gcode_response(
    request: AirbrushVectorJobRequest,
) -> AirbrushVectorJobResponse:
    """Generate G-code from SVG vector content and job parameters."""
    try:
        from app.vector_processing import process_vector_job

        scope = sentry_sdk.get_current_scope()
        scope.clear()
        scope.add_attachment(
            bytes=request.model_dump_json(exclude={"svg_string"}).encode(),
            filename="in_vector_data.json",
        )
        scope.add_attachment(
            bytes=request.svg_string.encode("utf-8"), filename=request.filename
        )

        gcode_objects = process_vector_job(request)
        gcode_lines = _gcode_parameter_header(
            request, VECTOR_GCODE_PARAMETER_ORDER, {"svg_string"}
        )
        gcode_lines += gcode_output(gcode_objects, enable_axis_culling=True)
        gcode_string = "\n".join(gcode_lines)

        with sentry_sdk.push_scope() as scope:
            scope.add_attachment(
                bytes=gcode_string.encode(), filename="output_vector.gcode"
            )
            sentry_sdk.capture_message(
                "vector gcode generation completed", level="info"
            )

        return AirbrushVectorJobResponse(
            gcode=gcode_string,
            total_lines=len(gcode_lines),
        )
    except Exception as e:
        traceback.print_exc()
        sentry_sdk.capture_exception(e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-vector", response_model=AirbrushVectorJobResponse)
async def generate_vector_gcode(
    request: AirbrushVectorJobRequest,
) -> AirbrushVectorJobResponse:
    return await _generate_vector_gcode_response(request)
