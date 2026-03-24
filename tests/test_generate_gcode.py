import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_image_base64():
    """Create a simple test image and return as base64."""
    img = Image.new("RGB", (100, 100), color="red")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def test_ping(client):
    response = client.get("/ping")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_generate_gcode_basic(client, sample_image_base64):
    payload = {
        "image_base64": sample_image_base64,
        "job_size": [100, 100],
    }
    response = client.post("/generate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "gcode" in data
    assert "preview_image_base64" in data
    assert "total_lines" in data
    assert data["total_lines"] > 0
    assert len(data["gcode"]) > 0
    assert len(data["preview_image_base64"]) > 0


def test_generate_gcode_with_all_params(client, sample_image_base64):
    payload = {
        "image_base64": sample_image_base64,
        "job_size": [50, 50],
        "job_location": [10, 20],
        "print_channel": "GRAYSCALE",
        "padding_distance": 50,
        "ramp_distances": [4, 4],
        "y_step_distance": 1.0,
        "x_step_distance": 2.0,
        "ab_min": 0.5,
        "ab_max": 3.0,
        "z": 20,
        "feedrate": 5000,
        "gaussian_blur_radius": 2,
        "print_direction": "top_to_bottom",
        "kill_air_at_right": False,
        "keep_air_on": False,
    }
    response = client.post("/generate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "G1 F5000" in data["gcode"]
    assert "G0" in data["gcode"]


def test_generate_gcode_cmyk_channel(client, sample_image_base64):
    for channel in ["C", "M", "Y", "K"]:
        payload = {
            "image_base64": sample_image_base64,
            "job_size": [50, 50],
            "print_channel": channel,
        }
        response = client.post("/generate", json=payload)
        assert response.status_code == 200


def test_generate_gcode_preview_image_is_valid(client, sample_image_base64):
    payload = {
        "image_base64": sample_image_base64,
        "job_size": [100, 100],
    }
    response = client.post("/generate", json=payload)
    assert response.status_code == 200

    data = response.json()
    preview_bytes = base64.b64decode(data["preview_image_base64"])
    preview_image = Image.open(io.BytesIO(preview_bytes))
    assert preview_image.mode == "L"


def test_generate_gcode_with_data_uri(client, sample_image_base64):
    payload = {
        "image_base64": f"data:image/png;base64,{sample_image_base64}",
        "job_size": [100, 100],
    }
    response = client.post("/generate", json=payload)
    assert response.status_code == 200


def test_generate_gcode_missing_required_fields(client):
    payload = {
        "image_base64": "abc123",
    }
    response = client.post("/generate", json=payload)
    assert response.status_code == 422


def test_generate_gcode_with_lower_left_reference_corner(client, sample_image_base64):
    payload = {
        "image_base64": sample_image_base64,
        "job_size": [50, 50],
        "job_location": [10, 20],
        "job_origin_corner": "lower_left",
        "gaussian_blur_radius": 0,
        "print_direction": "top_to_bottom",
    }
    response = client.post("/generate", json=payload)
    assert response.status_code == 200

    gcode_lines = response.json()["gcode"].splitlines()
    assert "G0 X-65 Y69.5" in gcode_lines
    assert "G0 X-65 Y20.5" in gcode_lines
