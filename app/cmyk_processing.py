from pathlib import Path

from PIL import Image, ImageOps, ImageCms


ICC_PROFILE_PATH = Path(__file__).parent / "USWebCoatedSWOP.icc"


def load_cmyk_profile(profile_path: Path = ICC_PROFILE_PATH):
    """Load CMYK color profile from ICC file."""
    try:
        with open(profile_path, "rb") as icc_file:
            return ImageCms.ImageCmsProfile(icc_file)
    except FileNotFoundError:
        print(f"Warning: CMYK profile {profile_path} not found. Using default profile.")
        return None


def create_rgb_to_cmyk_transform(cmyk_profile=None):
    """Create RGB to CMYK color transform."""
    rgb_profile = ImageCms.createProfile("sRGB")

    if cmyk_profile is None:
        cmyk_profile = ImageCms.createProfile("CMYK")

    return ImageCms.buildTransform(
        rgb_profile,
        cmyk_profile,
        "RGB",
        "CMYK",
    )


def split_cmyk(image: Image.Image, transform=None) -> list[Image.Image]:
    """Split a CMYK image into its four components.

    Args:
        image: PIL Image in RGB format
        transform: Optional CMYK transform, will create default if None

    Returns:
        List of PIL Images [C, M, Y, K] with inverted channels
    """
    if transform is None:
        cmyk_profile = load_cmyk_profile()
        transform = create_rgb_to_cmyk_transform(cmyk_profile)

    cmyk_image = ImageCms.applyTransform(image, transform)
    return [ImageOps.invert(c) for c in cmyk_image.split()]


def get_cmyk_channel(image: Image.Image, channel: str, transform=None) -> Image.Image:
    """Get a specific CMYK channel from an RGB image.

    Args:
        image: PIL Image in RGB format
        channel: One of 'C', 'M', 'Y', 'K' (case insensitive)
        transform: Optional CMYK transform

    Returns:
        PIL Image of the specified channel
    """
    channel = channel.upper()
    if channel not in ["C", "M", "Y", "K"]:
        raise ValueError(
            f"Invalid channel '{channel}'. Must be one of 'C', 'M', 'Y', 'K'"
        )

    channels = split_cmyk(image, transform)
    channel_map = {"C": 0, "M": 1, "Y": 2, "K": 3}

    return channels[channel_map[channel]]


# Initialize global transform for efficiency
_cmyk_profile = load_cmyk_profile()
rgb_to_cmyk_transform = create_rgb_to_cmyk_transform(_cmyk_profile)
