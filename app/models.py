from typing import Literal

from pydantic import BaseModel, Field


class AirbrushJobRequest(BaseModel):
    image_base64: str = Field(description="Base64-encoded image data")
    job_size: tuple[int, int] = Field(description="Target size (width_mm, height_mm)")
    job_location: tuple[float, float] = Field(
        default=(0, 0), description="Job location (x, y) in mm"
    )
    print_channel: Literal["C", "M", "Y", "K", "GRAYSCALE"] = Field(
        default="GRAYSCALE", description="CMYK channel or GRAYSCALE"
    )
    padding_distance: float = Field(
        default=75, description="Padding distance for acceleration/deceleration in mm"
    )
    ramp_distances: tuple[float, float] = Field(
        default=(6, 6), description="Overspray distance (before, after) in mm"
    )
    y_step_distance: float = Field(
        default=0.5, description="Distance between each Y line in mm"
    )
    x_step_distance: float = Field(
        default=1.0, description="Distance between each X step in mm"
    )
    ab_min: float = Field(
        default=0, description="Minimum airbrush valve value in microns (white areas)"
    )
    ab_max: float = Field(
        default=500, description="Maximum airbrush valve value in microns (dark areas)"
    )
    z: float = Field(default=15, description="Z position in mm")
    feedrate: float = Field(default=4000, description="Feedrate in mm/min")
    gaussian_blur_radius: float = Field(
        default=3, description="Gaussian blur radius in pixels"
    )
    print_direction: Literal["bottom_to_top", "top_to_bottom"] = Field(
        default="bottom_to_top", description="Print direction"
    )
    kill_air_at_right: bool = Field(
        default=False,
        description="If True, turn off air after rightmost X position",
    )
    keep_air_on: bool = Field(
        default=True,
        description="If True, keep air on continuously throughout job",
    )
    enable_gradient_border: bool = Field(
        default=False,
        description="If True, add gradient calibration border around image",
    )
    gradient_border_width: float = Field(
        default=40, description="Width of gradient calibration border in mm"
    )
    gradient_levels: int = Field(
        default=10, description="Number of grey levels in gradient border"
    )


class AirbrushJobResponse(BaseModel):
    gcode: str = Field(description="Generated G-code as a string")
    preview_image_base64: str = Field(
        description="Base64-encoded preview image (grayscale or CMYK channel)"
    )
    total_lines: int = Field(description="Total number of G-code lines generated")
