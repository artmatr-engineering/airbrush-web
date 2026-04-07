import re
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import vpype_cli

from app.models import AirbrushVectorJobRequest
from app.schema import GcodeCommand, GcodePoint

MIN_SEGMENT_LENGTH_MM = 1e-9


def _parse_svg_dimension(value: str | None, default_value: float) -> float:
    if not value:
        return default_value

    match = re.match(r"^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))", value)
    if not match:
        return default_value

    return float(match.group(1))


def extract_viewbox(
    svg_data: str, default_width: float = 100, default_height: float = 100
) -> tuple[float, float, float, float]:
    root = ET.fromstring(svg_data.encode("utf-8"))
    viewbox = root.attrib.get("viewBox")

    if viewbox:
        values = [float(v) for v in re.split(r"[ ,]+", viewbox.strip()) if v]
        if len(values) == 4:
            return values[0], values[1], values[2], values[3]

    width = _parse_svg_dimension(root.attrib.get("width"), default_width)
    height = _parse_svg_dimension(root.attrib.get("height"), default_height)
    return 0, 0, width, height


def strip_svg_units(svg_data: str) -> str:
    root = ET.fromstring(svg_data.encode("utf-8"))
    for attr in ("width", "height"):
        if attr in root.attrib:
            del root.attrib[attr]
    return ET.tostring(root, encoding="unicode")


def _sanitize_polyline(
    points: np.ndarray, min_segment_length: float = MIN_SEGMENT_LENGTH_MM
) -> np.ndarray:
    """Drop non-finite points and collapse consecutive points that are effectively identical."""
    points = np.asarray(points, dtype=float)
    if points.size == 0:
        return np.empty((0, 2), dtype=float)

    if points.ndim != 2 or points.shape[1] != 2:
        raise ValueError("Polyline points must be a Nx2 array")

    points = points[np.isfinite(points).all(axis=1)]
    if len(points) == 0:
        return np.empty((0, 2), dtype=float)

    cleaned_points = [points[0]]
    for point in points[1:]:
        if np.linalg.norm(point - cleaned_points[-1]) > min_segment_length:
            cleaned_points.append(point)

    return np.array(cleaned_points, dtype=float)


def _segment_direction(
    start: np.ndarray, end: np.ndarray, min_segment_length: float = MIN_SEGMENT_LENGTH_MM
) -> np.ndarray | None:
    delta = end - start
    norm = np.linalg.norm(delta)
    if norm <= min_segment_length:
        return None
    return delta / norm


def process_svg_string_to_paths(
    svg_string: str,
    single_layer: bool = False,
    tolerance: float = 0.05,
    optimize: bool = False,
) -> list[list[list[list[float]]]]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".svg", delete=False) as temp_svg:
        temp_svg.write(svg_string)
        temp_svg_path = temp_svg.name

    try:
        read_prefix = "-m " if single_layer else ""
        pipeline = f'read {read_prefix}"{temp_svg_path}"'
        if optimize:
            pipeline += " linesort"
        pipeline += f" linesimplify -t {tolerance}"

        document = vpype_cli.execute(pipeline)

        layers: list[list[list[list[float]]]] = []
        for layer_id in sorted(document.layers.keys()):
            layer = document.layers[layer_id]
            paths: list[list[list[float]]] = []
            for line in layer:
                if len(line) < 2:
                    continue
                points = np.column_stack((np.real(line), np.imag(line)))
                paths.append(points.tolist())
            if paths:
                layers.append(paths)
        return layers
    finally:
        Path(temp_svg_path).unlink(missing_ok=True)


def parse_svg(
    svg_data: str,
    width: float,
    height: float,
    polyline_tolerance: float = 0.1,
    optimize: bool = False,
    flip_vertically: bool = True,
    flip_horizontally: bool = False,
) -> list[np.ndarray]:
    vb_min_x, vb_min_y, vb_width, vb_height = extract_viewbox(svg_data)

    if vb_width <= 0 or vb_height <= 0:
        raise ValueError("SVG viewBox width and height must both be greater than zero")

    svg_data_stripped = strip_svg_units(svg_data)
    paths_nested_list = process_svg_string_to_paths(
        svg_data_stripped,
        single_layer=True,
        tolerance=polyline_tolerance,
        optimize=optimize,
    )

    if not paths_nested_list:
        return []

    paths_numpy_array = [
        np.array(path, dtype=float) for path in paths_nested_list[0] if len(path) >= 2
    ]

    scale_x = width / vb_width
    scale_y = height / vb_height

    scaled_paths = []
    for path in paths_numpy_array:
        scaled_path = np.zeros_like(path)
        scaled_path[:, 0] = (path[:, 0] - vb_min_x) * scale_x
        scaled_path[:, 1] = (path[:, 1] - vb_min_y) * scale_y

        if flip_vertically:
            scaled_path[:, 1] = height - scaled_path[:, 1]

        if flip_horizontally:
            scaled_path[:, 0] = width - scaled_path[:, 0]

        scaled_path = _sanitize_polyline(scaled_path)
        if len(scaled_path) >= 2:
            scaled_paths.append(scaled_path)

    return scaled_paths


def extend_or_sample_polyline(
    points: np.ndarray, dist_start: float, dist_end: float
) -> np.ndarray:
    points = _sanitize_polyline(points)
    if len(points) < 2:
        return points

    seg_lengths = np.sqrt(np.sum(np.diff(points, axis=0) ** 2, axis=1))
    cum_dist = np.insert(np.cumsum(seg_lengths), 0, 0)
    total_length = cum_dist[-1]

    if total_length <= MIN_SEGMENT_LENGTH_MM:
        return points[:1].copy()

    if dist_start < 0 and dist_end < 0 and abs(dist_start + dist_end) > total_length:
        segment_idx = (
            np.searchsorted(
                cum_dist,
                abs(dist_start) / (abs(dist_start) + abs(dist_end)) * total_length,
                side="right",
            )
            - 1
        )
        alpha = (
            abs(dist_start) / (abs(dist_start) + abs(dist_end)) * total_length
            - cum_dist[segment_idx]
        ) / seg_lengths[segment_idx]
        new_point = (1 - alpha) * points[segment_idx] + alpha * points[segment_idx + 1]
        return np.array([new_point])

    direction_start = _segment_direction(points[0], points[1])
    direction_end = _segment_direction(points[-2], points[-1])
    if direction_start is None or direction_end is None:
        return points[:1].copy()

    if dist_start < 0:
        segment_idx = np.searchsorted(cum_dist, -dist_start, side="right") - 1
        alpha = (-dist_start - cum_dist[segment_idx]) / seg_lengths[segment_idx]
        new_start = (1 - alpha) * points[segment_idx] + alpha * points[segment_idx + 1]
        points = np.vstack((new_start, points[segment_idx + 1 :]))

        seg_lengths = np.sqrt(np.sum(np.diff(points, axis=0) ** 2, axis=1))
        cum_dist = np.insert(np.cumsum(seg_lengths), 0, 0)
    else:
        new_start = points[0] - dist_start * direction_start
        points = np.vstack((new_start, points))

    points = _sanitize_polyline(points)
    if len(points) < 2:
        return points

    seg_lengths = np.sqrt(np.sum(np.diff(points, axis=0) ** 2, axis=1))
    cum_dist = np.insert(np.cumsum(seg_lengths), 0, 0)

    direction_end = _segment_direction(points[-2], points[-1])
    if direction_end is None:
        return points[:1].copy()

    if dist_end < 0:
        segment_idx = (
            np.searchsorted(cum_dist, cum_dist[-1] + dist_end, side="right") - 1
        )
        alpha = (cum_dist[-1] + dist_end - cum_dist[segment_idx]) / seg_lengths[
            segment_idx
        ]
        new_end = (1 - alpha) * points[segment_idx] + alpha * points[segment_idx + 1]
        points = np.vstack((points[: segment_idx + 1], new_end))
    else:
        new_end = points[-1] + dist_end * direction_end
        points = np.vstack((points, new_end))

    return points


def get_job_y_bounds(job: AirbrushVectorJobRequest) -> tuple[float, float]:
    if job.job_origin_corner == "lower_left":
        image_start_y = job.job_location[1]
        image_end_y = image_start_y + job.job_size[1]
    else:
        image_end_y = job.job_location[1]
        image_start_y = image_end_y - job.job_size[1]
    return image_start_y, image_end_y


def process_vector_job(job: AirbrushVectorJobRequest) -> list[GcodeCommand | GcodePoint]:
    polylines = parse_svg(
        svg_data=job.svg_string,
        width=job.job_size[0],
        height=job.job_size[1],
        optimize=job.optimize_toolpath,
    )

    image_start_y, image_end_y = get_job_y_bounds(job)

    for i in range(len(polylines)):
        polylines[i][:, 0] += job.job_location[0]
        polylines[i][:, 1] += image_start_y

    ab_min_mm = job.ab_min / 1000
    ab_max_mm = job.ab_max / 1000

    job_gcodes: list[GcodeCommand | GcodePoint] = [
        GcodeCommand(command="G21 ;mm units"),
        GcodeCommand(command="M42 P1 S1; Turn on Air"),
        # GcodePoint(type="G0", x=job.job_location[0], y=image_end_y),
        GcodePoint(type="G1", z=job.z),
        GcodeCommand(command=f"G1 F{job.feedrate}"),
        GcodePoint(type="G1", u=0),
    ]

    for i, polyline in enumerate(polylines):
        polyline = _sanitize_polyline(polyline)
        if len(polyline) < 2:
            continue

        points_2d = extend_or_sample_polyline(
            polyline, job.ramp_distances[0], job.ramp_distances[1]
        )
        points_2d = _sanitize_polyline(points_2d)
        if len(points_2d) < 2:
            continue

        seg_lengths = np.sqrt(np.sum(np.diff(points_2d, axis=0) ** 2, axis=1))
        cumulative_distances = np.insert(np.cumsum(seg_lengths), 0, 0.0)
        total_distance = cumulative_distances[-1]

        darkness_ratio = np.clip(job.darkness / 100, 0.0, 1.0)
        u_target_mm = ab_min_mm + ((ab_max_mm - ab_min_mm) * darkness_ratio)
        u_delta_mm = u_target_mm - ab_min_mm

        ramp_in_distance = max(job.ramp_distances[0], 0.0)
        ramp_out_distance = max(job.ramp_distances[1], 0.0)

        ramp_factor = np.ones_like(cumulative_distances)
        if ramp_in_distance > 0:
            ramp_factor = np.minimum(
                ramp_factor,
                np.clip(cumulative_distances / ramp_in_distance, 0.0, 1.0),
            )
        if ramp_out_distance > 0:
            ramp_factor = np.minimum(
                ramp_factor,
                np.clip(
                    (total_distance - cumulative_distances) / ramp_out_distance,
                    0.0,
                    1.0,
                ),
            )

        u_values = (ab_min_mm + (u_delta_mm * ramp_factor)).reshape(-1, 1)
        points_3d = np.hstack((points_2d, u_values))

        path_gcodes: list[GcodeCommand | GcodePoint] = [
            GcodeCommand(command=f"; Starting path {i + 1}/{len(polylines)}"),
            GcodePoint(type="G0", x=points_3d[0][0], y=points_3d[0][1]),
            GcodeCommand(command="G4 S0.1"),
            GcodePoint(type="G1", u=ab_min_mm),
        ]

        for point in points_3d:
            path_gcodes.append(
                GcodePoint(type="G1", x=point[0], y=point[1], u=point[2])
            )

        path_gcodes.append(GcodePoint(type="G1", u=0))
        path_gcodes.append(
            GcodeCommand(command=f"; Ending path {i + 1}/{len(polylines)}")
        )

        job_gcodes += path_gcodes

    job_gcodes.append(GcodeCommand(command="M400"))
    job_gcodes.append(GcodeCommand(command="M42 P1 S0 ; Turn off Air"))

    return job_gcodes
