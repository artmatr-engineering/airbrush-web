from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter

from app.cmyk_processing import get_cmyk_channel
from app.gradient_borders import add_gradient_border
from app.models import AirbrushJobRequest
from app.schema import GcodeCommand, GcodePoint


@dataclass
class JobResult:
    gcode_objects: list[GcodeCommand | GcodePoint]
    preview_image: Image.Image


def generate_bounding_box_gcode(
    job: AirbrushJobRequest, box_z: float, ab_max_mm: float
) -> list[GcodeCommand | GcodePoint]:
    """Generate G-code commands to draw a bounding box around the print area."""
    image_start_x = job.job_location[0]
    image_end_x = image_start_x + job.job_size[0]

    if job.print_direction == "bottom_to_top":
        image_start_y = job.job_location[1]
        image_end_y = image_start_y + job.job_size[1]
    else:
        image_start_y = job.job_location[1] - job.job_size[1]
        image_end_y = job.job_location[1]

    box_commands = [
        GcodePoint(type="G0", x=image_start_x, y=image_start_y),
        GcodeCommand(command="M400"),
        GcodeCommand(command="M42 P1 S1; Turn on Air"),
        GcodeCommand(command="G4 S0.25 ; Dwell to allow air to stabilize"),
        GcodePoint(type="G1", z=box_z),
        GcodePoint(type="G0", u=ab_max_mm),
        GcodePoint(type="G1", x=image_end_x, y=image_start_y),
        GcodePoint(type="G1", x=image_end_x, y=image_end_y),
        GcodePoint(type="G1", x=image_start_x, y=image_end_y),
        GcodePoint(type="G1", x=image_start_x, y=image_start_y),
        GcodePoint(type="G0", u=0),
        GcodePoint(type="G0", x=image_start_x - job.padding_distance, y=image_start_y),
        GcodeCommand(command="M400"),
        GcodeCommand(command="M42 P1 S0; Turn off Air"),
        GcodeCommand(command=f"G1 F{job.feedrate} ; Set feedrate"),
    ]

    return box_commands


def process_job(
    job: AirbrushJobRequest,
    image: Image.Image,
    add_bounding_box: bool = False,
    bounding_box_z: float = 5.0,
    add_headers: bool = True,
) -> JobResult:
    """Process a single job and return gcode objects and preview image."""
    # Convert ab_min/ab_max from microns to mm
    ab_min_mm = job.ab_min / 1000
    ab_max_mm = job.ab_max / 1000

    if job.enable_gradient_border:
        border_width = int(job.gradient_border_width)
        content_size = (
            job.job_size[0] - 2 * border_width,
            job.job_size[1] - 2 * border_width,
        )
        image_resized = image.resize(content_size)
        image_resized = add_gradient_border(
            image_resized,
            border_width=border_width,
            levels=job.gradient_levels,
        )
    else:
        image_resized = image.resize(job.job_size)

    if job.print_channel.upper() == "GRAYSCALE":
        print_image_bw = image_resized.convert("L")
    else:
        print_image_bw = get_cmyk_channel(image_resized, job.print_channel)

    if job.gaussian_blur_radius > 0:
        print_image_bw = print_image_bw.filter(
            ImageFilter.GaussianBlur(radius=job.gaussian_blur_radius)
        )

    preview_image = print_image_bw.copy()

    image_start_x = job.job_location[0]
    image_end_x = image_start_x + job.job_size[0]

    pass_start_x = image_start_x - job.padding_distance
    ramp_start_x = image_start_x - job.ramp_distances[0]
    ramp_end_x = image_end_x + job.ramp_distances[0]
    pass_end_x = image_end_x + job.padding_distance

    begin_pass_x_points = [pass_start_x, ramp_start_x]
    end_pass_x_points = [ramp_end_x, pass_end_x]

    begin_pass_u_values = [0, 0]
    end_pass_u_values = [0, 0]

    image_w_y_steps = print_image_bw.resize(
        (job.job_size[0] + 1, int(job.job_size[1] / job.y_step_distance))
    )

    if job.print_direction == "bottom_to_top":
        image_w_y_steps = image_w_y_steps.transpose(Image.FLIP_TOP_BOTTOM)

    image_np = 255 - np.array(image_w_y_steps)

    gcode_objects: list[GcodeCommand | GcodePoint] = []

    for row in range(image_np.shape[0]):
        if job.print_direction == "bottom_to_top":
            y_location = (
                job.job_location[1]
                + row * job.y_step_distance
                + job.y_step_distance / 2
            )
        else:
            y_location = (
                job.job_location[1]
                - row * job.y_step_distance
                - job.y_step_distance / 2
            )

        x_step_pixels = int(job.x_step_distance)
        x_values = (np.arange(image_np.shape[1]) + image_start_x)[::x_step_pixels]
        u_values = (image_np[row, :] / 255 * (ab_max_mm - ab_min_mm) + ab_min_mm)[
            ::x_step_pixels
        ]

        pre_commands = [
            GcodePoint(type="G1", x=x, u=u)
            for x, u in zip(begin_pass_x_points, begin_pass_u_values)
        ]

        row_body = [GcodePoint(type="G1", x=x, u=u) for x, u in zip(x_values, u_values)]

        post_commands = [
            GcodePoint(type="G1", x=x, u=u)
            for x, u in zip(end_pass_x_points, end_pass_u_values)
        ]

        if job.keep_air_on and row == 0:
            row_header = [
                GcodeCommand(command=f"; Starting row {row}/{image_np.shape[0]}"),
                GcodePoint(type="G0", x=pass_start_x, y=y_location),
                GcodeCommand(command="M400"),
                GcodeCommand(command="M42 P1 S1; Turn on Air"),
                GcodeCommand(command="G4 S0.5 ; Dwell to allow air to stabilize"),
                GcodePoint(type="G0", u=-0.01),
                GcodePoint(type="G0", u=0),
            ]
        elif job.keep_air_on:
            row_header = [
                GcodeCommand(command=f"; Starting row {row}/{image_np.shape[0]}"),
                GcodePoint(type="G0", x=pass_start_x, y=y_location),
            ]
        else:
            row_header = [
                GcodeCommand(command=f"; Starting row {row}/{image_np.shape[0]}"),
                GcodePoint(type="G0", x=pass_start_x, y=y_location),
                GcodeCommand(command="M400"),
                GcodeCommand(command="M42 P1 S1; Turn on Air"),
                GcodeCommand(command="G4 S0.5 ; Dwell to allow air to stabilize"),
            ]

        if job.keep_air_on and row == image_np.shape[0] - 1:
            row_footer = [
                GcodeCommand(command="M400"),
                GcodeCommand(command="M42 P1 S0 ; Turn off Air"),
            ]
        elif job.keep_air_on:
            row_footer = []
        else:
            row_footer = [
                GcodeCommand(command="M400"),
                GcodeCommand(command="M42 P1 S0 ; Turn off Air"),
            ]

        if job.keep_air_on:
            row_commands = (
                row_header + pre_commands + row_body + post_commands + row_footer
            )
        elif not job.kill_air_at_right:
            row_commands = (
                row_header + pre_commands + row_body + post_commands + row_footer
            )
        else:
            kill_air = [
                GcodeCommand(command="M400"),
                GcodeCommand(command="M42 P1 S0 ; Turn off Air"),
            ]
            row_commands = (
                row_header
                + pre_commands
                + row_body
                + kill_air
                + post_commands
                + row_footer
            )

        gcode_objects.extend(row_commands)

    if add_headers:
        first_with_y = next(
            obj
            for obj in gcode_objects
            if isinstance(obj, GcodePoint) and obj.y is not None
        )

        bounding_box_commands: list[GcodeCommand | GcodePoint] = []
        if add_bounding_box:
            bounding_box_commands = generate_bounding_box_gcode(job, bounding_box_z, ab_max_mm)

        header = [
            GcodePoint(type="G0", x=pass_start_x, y=first_with_y.y),
            GcodePoint(type="G0", z=job.z),
            GcodeCommand(command=f"G1 F{job.feedrate}"),
        ]

        gcode_objects = bounding_box_commands + header + gcode_objects

    return JobResult(gcode_objects=gcode_objects, preview_image=preview_image)
