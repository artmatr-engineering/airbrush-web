import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_svg_string():
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
        '<path d="M0 0 L10 0" stroke="black" fill="none"/>'
        "</svg>"
    )


def test_generate_vector_gcode_basic(client, sample_svg_string):
    payload = {
        "svg_string": sample_svg_string,
        "job_size": [100, 100],
    }

    response = client.post("/generate-vector", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "gcode" in data
    assert "total_lines" in data
    assert data["total_lines"] > 0
    assert "G21 ;mm units" in data["gcode"]
    assert "M42 P1 S1; Turn on Air" in data["gcode"]


def test_generate_vector_gcode_includes_frontend_parameter_header(
    client, sample_svg_string
):
    payload = {
        "svg_string": sample_svg_string,
        "filename": "source-vector.svg",
        "job_size": [50, 40],
        "job_location": [10, 20],
        "job_origin_corner": "lower_left",
        "ramp_distances": [4, 6],
        "ab_min": 10,
        "ab_max": 280,
        "darkness": 75,
        "z": 8,
        "feedrate": 4800,
        "optimize_toolpath": False,
    }
    response = client.post("/generate-vector", json=payload)
    assert response.status_code == 200

    gcode_lines = response.json()["gcode"].splitlines()
    expected_header = [
        "; Job parameters from tool:",
        "; filename: source-vector.svg",
        "; job_size: [50, 40]",
        "; job_origin_corner: lower_left",
        "; job_location: [10, 20]",
        "; feedrate: 4800",
        "; z: 8",
        "; ramp_distances: [4, 6]",
        "; ab_min: 10",
        "; ab_max: 280",
        "; darkness: 75",
        "; optimize_toolpath: false",
    ]

    assert gcode_lines[: len(expected_header)] == expected_header
    header_text = "\n".join(gcode_lines[: len(expected_header)])
    assert "svg_string" not in header_text


def test_generate_vector_gcode_origin_corner_changes_y_position(client, sample_svg_string):
    shared_payload = {
        "svg_string": sample_svg_string,
        "job_size": [10, 10],
        "job_location": [5, 20],
        "ramp_distances": [0, 0],
        "darkness": 100,
        "ab_min": 0,
        "ab_max": 500,
        "optimize_toolpath": False,
    }

    upper_left_response = client.post(
        "/generate-vector", json={**shared_payload, "job_origin_corner": "upper_left"}
    )
    lower_left_response = client.post(
        "/generate-vector", json={**shared_payload, "job_origin_corner": "lower_left"}
    )

    assert upper_left_response.status_code == 200
    assert lower_left_response.status_code == 200

    upper_gcode_lines = upper_left_response.json()["gcode"].splitlines()
    lower_gcode_lines = lower_left_response.json()["gcode"].splitlines()

    assert "G0 X5 Y20" in upper_gcode_lines
    assert "G0 X5 Y30" in lower_gcode_lines


def test_generate_vector_gcode_missing_required_fields(client):
    response = client.post("/generate-vector", json={"job_size": [100, 100]})
    assert response.status_code == 422


def test_generate_vector_gcode_ramps_u_values(client, sample_svg_string):
    payload = {
        "svg_string": sample_svg_string,
        "job_size": [10, 10],
        "ramp_distances": [2, 2],
        "darkness": 50,
        "ab_min": 100,
        "ab_max": 500,
        "optimize_toolpath": False,
    }

    response = client.post("/generate-vector", json=payload)
    assert response.status_code == 200

    gcode_lines = response.json()["gcode"].splitlines()
    start_idx = gcode_lines.index("; Starting path 1/1")
    end_idx = gcode_lines.index("; Ending path 1/1")

    assert gcode_lines[start_idx + 1 : end_idx] == [
        "G0 X-2 Y0",
        "G4 S0.1",
        "G1 U0.1",
        "X-2 Y0",
        "X0 U0.3",
        "X10",
        "X12 U0.1",
        "U0",
    ]
