import numpy as np
from PIL import Image


def add_gradient_border(image: Image.Image, border_width: int = 50, levels: int = 10) -> Image.Image:
    """
    Add a stepped gradient border to an image where each band spans the full image width/height.

    The gradient pattern:
    - Top border: VERTICAL bands from black (left) to white (right)
    - Right border: HORIZONTAL bands from white (top) to black (bottom)
    - Bottom border: VERTICAL bands from white (left) to black (right)
    - Left border: HORIZONTAL bands from black (top) to white (bottom)
    """
    if image.mode == "RGB":
        img_array = np.array(image)
        is_rgb = True
    elif image.mode == "L":
        img_array = np.array(image)
        is_rgb = False
    else:
        image = image.convert("L")
        img_array = np.array(image)
        is_rgb = False

    original_height, original_width = img_array.shape[:2]

    new_height = original_height + 2 * border_width
    new_width = original_width + 2 * border_width

    if is_rgb:
        new_array = np.zeros((new_height, new_width, 3), dtype=np.uint8)
    else:
        new_array = np.zeros((new_height, new_width), dtype=np.uint8)

    stepped_values = np.round(np.linspace(0, 255, levels, dtype=np.float32)).astype(
        np.uint8
    )

    vertical_band_width = new_width / levels
    horizontal_band_width = new_height / levels

    y_coords, x_coords = np.mgrid[0:new_height, 0:new_width]

    x_band_indices = (x_coords / vertical_band_width).astype(int)
    x_band_indices = np.clip(x_band_indices, 0, levels - 1)

    y_band_indices = (y_coords / horizontal_band_width).astype(int)
    y_band_indices = np.clip(y_band_indices, 0, levels - 1)

    top_mask = y_coords < border_width
    bottom_mask = y_coords >= new_height - border_width
    left_mask = (x_coords < border_width) & (~top_mask) & (~bottom_mask)
    right_mask = (x_coords >= new_width - border_width) & (~top_mask) & (~bottom_mask)

    top_values = stepped_values[x_band_indices[top_mask]]
    if is_rgb:
        new_array[top_mask] = top_values[:, np.newaxis]
    else:
        new_array[top_mask] = top_values

    bottom_values = stepped_values[levels - 1 - x_band_indices[bottom_mask]]
    if is_rgb:
        new_array[bottom_mask] = bottom_values[:, np.newaxis]
    else:
        new_array[bottom_mask] = bottom_values

    left_values = stepped_values[y_band_indices[left_mask]]
    if is_rgb:
        new_array[left_mask] = left_values[:, np.newaxis]
    else:
        new_array[left_mask] = left_values

    right_values = stepped_values[levels - 1 - y_band_indices[right_mask]]
    if is_rgb:
        new_array[right_mask] = right_values[:, np.newaxis]
    else:
        new_array[right_mask] = right_values

    new_array[
        border_width : original_height + border_width,
        border_width : original_width + border_width,
    ] = img_array

    return Image.fromarray(new_array)


def calculate_border_pixel_width(
    current_width: int,
    current_height: int,
    target_width_mm: float,
    target_height_mm: float,
    border_width_mm: float,
) -> tuple[int, float]:
    """Calculate the border width in pixels based on image dimensions and target print size."""
    dpi_x = current_width / (target_width_mm / 25.4)
    dpi_y = current_height / (target_height_mm / 25.4)
    avg_dpi = (dpi_x + dpi_y) / 2
    border_width_pixels = int(round((border_width_mm / 25.4) * avg_dpi))
    border_width_pixels = max(1, border_width_pixels)
    return border_width_pixels, avg_dpi


def add_gradient_border_mm(
    image: Image.Image,
    border_width_mm: float = 10,
    target_width_mm: float = 250,
    target_height_mm: float = 250,
    levels: int = 10,
) -> Image.Image:
    """
    Add a stepped gradient border to an image where the border width is specified in millimeters
    relative to the final printed dimensions.
    """
    current_width, current_height = image.size

    border_width_pixels, _ = calculate_border_pixel_width(
        current_width,
        current_height,
        target_width_mm,
        target_height_mm,
        border_width_mm,
    )

    return add_gradient_border(image, border_width=border_width_pixels, levels=levels)
