import numpy as np

import app.vector_processing as vector_processing
from app.gcode_utils import gcode_output
from app.models import AirbrushVectorJobRequest
from app.schema import GcodePoint


def test_extend_or_sample_polyline_collapses_duplicate_points():
    points = np.array([[1.0, 1.0], [1.0, 1.0]])

    extended = vector_processing.extend_or_sample_polyline(points, 3, 3)

    assert np.isfinite(extended).all()
    np.testing.assert_allclose(extended, np.array([[1.0, 1.0]]))


def test_process_vector_job_skips_degenerate_polylines(monkeypatch):
    def fake_parse_svg(*args, **kwargs):
        return [
            np.array([[1.0, 1.0], [1.0, 1.0]]),
            np.array([[0.0, 0.0], [10.0, 0.0]]),
        ]

    monkeypatch.setattr(vector_processing, "parse_svg", fake_parse_svg)

    job = AirbrushVectorJobRequest(
        svg_string='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
        job_size=(10, 10),
        job_origin_corner="lower_left",
        ramp_distances=(0, 0),
        optimize_toolpath=False,
    )

    gcode_lines = gcode_output(
        vector_processing.process_vector_job(job), enable_axis_culling=False
    )

    assert sum(line.startswith("; Starting path") for line in gcode_lines) == 1
    assert not any("nan" in line.lower() for line in gcode_lines)


def test_gcode_output_skips_redundant_same_type_point_when_axis_culling_enabled():
    gcode_lines = gcode_output(
        [
            GcodePoint(type="G1", x=-3, y=-133.3, u=0),
            GcodePoint(type="G1", x=0, y=-133.3, u=0.5),
            GcodePoint(type="G1", x=0, y=-133.3, u=0.5),
            GcodePoint(type="G1", x=3, y=-133.3, u=0),
        ],
        enable_axis_culling=True,
    )

    assert gcode_lines == [
        "G1 X-3 Y-133.3 U0",
        "X0 U0.5",
        "X3 U0",
    ]


def test_gcode_output_preserves_motion_mode_change_when_axes_are_redundant():
    gcode_lines = gcode_output(
        [
            GcodePoint(type="G1", x=0, y=0),
            GcodePoint(type="G0", x=0, y=0),
            GcodePoint(type="G0", x=1, y=0),
        ],
        enable_axis_culling=True,
    )

    assert gcode_lines == [
        "G1 X0 Y0",
        "G0",
        "X1",
    ]
