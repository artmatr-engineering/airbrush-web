from app.schema import GcodePoint, GcodeCommand, fg


def gcode_output(
    gcode_objects: list[GcodePoint | GcodeCommand], enable_axis_culling: bool = True
) -> list[str]:
    """
    Iterates through gcode objects and returns the gcode file lines.
    Removes consecutive moves with the same x, y, or u value (if enable_axis_culling is True).
    Removes G1/G0 prefixes if the previous move was the same type.
    """
    COMPARISON_TOLERANCE = 3
    gcode_strings = []

    running_x = None
    running_y = None
    running_u = None
    previous_point_type = None

    for obj in gcode_objects:
        if isinstance(obj, GcodePoint):
            fx = fg(obj.x) if obj.x is not None else None
            fy = fg(obj.y) if obj.y is not None else None
            fu = fg(obj.u, COMPARISON_TOLERANCE) if obj.u is not None else None
            rendered_x = obj.x
            rendered_y = obj.y
            rendered_u = obj.u

            if enable_axis_culling:
                if running_x == fx:
                    rendered_x = None
                if running_y == fy:
                    rendered_y = None
                if running_u == fu:
                    rendered_u = None

            skip_prefix = previous_point_type == obj.type
            if (
                skip_prefix
                and rendered_x is None
                and rendered_y is None
                and obj.z is None
                and rendered_u is None
            ):
                continue

            rendered_point = GcodePoint(
                type=obj.type,
                x=rendered_x,
                y=rendered_y,
                z=obj.z,
                u=rendered_u,
            )
            gcode_strings.append(rendered_point.out(skip_prefix=skip_prefix))
            previous_point_type = obj.type
            running_x = fx
            running_y = fy
            running_u = fu
        else:
            gcode_strings.append(obj.out())
            previous_point_type = None
            running_x = None
            running_y = None
            running_u = None

    return gcode_strings
