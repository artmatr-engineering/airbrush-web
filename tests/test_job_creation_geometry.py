from PIL import Image

from app.job_creation import generate_bounding_box_gcode, process_job
from app.models import AirbrushJobRequest
from app.schema import GcodeCommand, GcodePoint


def make_job(**overrides) -> AirbrushJobRequest:
    params = {
        "image_base64": "unused-in-unit-tests",
        "job_size": (6, 4),
        "job_location": (10, 20),
        "padding_distance": 2,
        "ramp_distances": (1, 1),
        "y_step_distance": 1,
        "x_step_distance": 1,
        "ab_min": 0,
        "ab_max": 500,
        "z": 15,
        "feedrate": 8000,
        "gaussian_blur_radius": 0,
        "keep_air_on": True,
    }
    params.update(overrides)
    return AirbrushJobRequest(**params)


def extract_row_start_ys(gcode_objects: list[GcodeCommand | GcodePoint]) -> list[float]:
    row_start_ys: list[float] = []
    waiting_for_row_move = False

    for obj in gcode_objects:
        if isinstance(obj, GcodeCommand) and obj.command.startswith("; Starting row "):
            waiting_for_row_move = True
            continue

        if waiting_for_row_move and isinstance(obj, GcodePoint) and obj.y is not None:
            row_start_ys.append(obj.y)
            waiting_for_row_move = False

    return row_start_ys


def extract_bbox_points(job: AirbrushJobRequest) -> list[tuple[float, float]]:
    bbox = generate_bounding_box_gcode(job, box_z=job.z, ab_max_mm=job.ab_max / 1000)
    return [
        (obj.x, obj.y)
        for obj in bbox
        if isinstance(obj, GcodePoint) and obj.x is not None and obj.y is not None
    ]


def test_print_direction_changes_row_order_without_moving_image():
    image = Image.new("L", (6, 4), color=128)
    bottom_to_top_job = make_job(print_direction="bottom_to_top")
    top_to_bottom_job = make_job(print_direction="top_to_bottom")

    bottom_to_top_result = process_job(
        bottom_to_top_job,
        image,
        add_bounding_box=True,
        bounding_box_z=bottom_to_top_job.z,
    )
    top_to_bottom_result = process_job(
        top_to_bottom_job,
        image,
        add_bounding_box=True,
        bounding_box_z=top_to_bottom_job.z,
    )

    assert extract_bbox_points(bottom_to_top_job) == extract_bbox_points(top_to_bottom_job)

    bottom_to_top_rows = extract_row_start_ys(bottom_to_top_result.gcode_objects)
    top_to_bottom_rows = extract_row_start_ys(top_to_bottom_result.gcode_objects)

    assert bottom_to_top_rows == [20.5, 21.5, 22.5, 23.5]
    assert top_to_bottom_rows == list(reversed(bottom_to_top_rows))
    assert sorted(bottom_to_top_rows) == sorted(top_to_bottom_rows)


def test_job_location_is_the_only_position_input_in_geometry():
    job = make_job(print_direction="top_to_bottom")
    shifted_job = make_job(print_direction="top_to_bottom", job_location=(13, 37))

    base_bbox = extract_bbox_points(job)
    shifted_bbox = extract_bbox_points(shifted_job)

    assert shifted_bbox == [(x + 3, y + 17) for x, y in base_bbox]
