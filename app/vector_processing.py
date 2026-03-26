import re
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import vpype_cli

from app.models import AirbrushVectorJobRequest
from app.schema import GcodeCommand, GcodePoint


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
    polyline_tolerance: float = 0.05,
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
        scaled_paths.append(scaled_path)

    if flip_vertically:
        for path in scaled_paths:
            path[:, 1] = height - path[:, 1]

    if flip_horizontally:
        for path in scaled_paths:
            path[:, 0] = width - path[:, 0]

    return scaled_paths


def extend_or_sample_polyline(
    points: np.ndarray, dist_start: float, dist_end: float
) -> np.ndarray:
    seg_lengths = np.sqrt(np.sum(np.diff(points, axis=0) ** 2, axis=1))
    cum_dist = np.insert(np.cumsum(seg_lengths), 0, 0)

    if dist_start < 0 and dist_end < 0 and abs(dist_start + dist_end) > cum_dist[-1]:
        segment_idx = (
            np.searchsorted(
                cum_dist,
                abs(dist_start) / (abs(dist_start) + abs(dist_end)) * cum_dist[-1],
                side="right",
            )
            - 1
        )
        alpha = (
            abs(dist_start) / (abs(dist_start) + abs(dist_end)) * cum_dist[-1]
            - cum_dist[segment_idx]
        ) / seg_lengths[segment_idx]
        new_point = (1 - alpha) * points[segment_idx] + alpha * points[segment_idx + 1]
        return np.array([new_point])

    direction_start = (points[1] - points[0]) / np.linalg.norm(points[1] - points[0])
    direction_end = (points[-1] - points[-2]) / np.linalg.norm(points[-1] - points[-2])

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

    direction_end = (points[-1] - points[-2]) / np.linalg.norm(points[-1] - points[-2])

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
        if len(polyline) < 2:
            continue

        points_2d = extend_or_sample_polyline(
            polyline, job.ramp_distances[0], job.ramp_distances[1]
        )
        if len(points_2d) < 2:
            continue

        u_values = np.full((points_2d.shape[0], 1), 0.0)
        points_3d = np.hstack((points_2d, u_values))

        u_value = (ab_max_mm - ab_min_mm) * (job.darkness / 100)
        if points_3d.shape[0] == 2:
            points_3d[0][2] = u_value
            points_3d[1][2] = u_value
        else:
            points_3d[1][2] = u_value
            points_3d[-2][2] = u_value

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
