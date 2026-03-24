from typing import Literal

from pydantic import BaseModel


DEFAULT_PRECISION = 1


def fg(number: float, precision: int = DEFAULT_PRECISION) -> str:
    """Formats a number for gcode output."""
    if number == 0:
        return "0"
    elif number % 1 == 0:
        return str(int(number))
    elif 0 < abs(number) < 1:
        return f"{number:0.{precision}f}".rstrip("0").rstrip(".")
    else:
        return f"{number:.{precision}f}".rstrip("0").rstrip(".")


class GcodePoint(BaseModel):
    type: Literal["G1", "G0"]
    x: float | None = None
    y: float | None = None
    z: float | None = None
    u: float | None = None

    def out(self, skip_prefix: bool = False) -> str:
        """Render the point as a g-code command string."""
        if skip_prefix:
            out_fragments = []
        else:
            out_fragments = [f"{self.type}"]

        if self.x is not None:
            out_fragments.append(f"X{fg(self.x)}")
        if self.y is not None:
            out_fragments.append(f"Y{fg(self.y)}")
        if self.z is not None:
            out_fragments.append(f"Z{fg(self.z)}")
        if self.u is not None:
            out_fragments.append(f"U{fg(self.u, precision=3)}")
        return " ".join(out_fragments)


class GcodeCommand(BaseModel):
    command: str

    def out(self) -> str:
        return self.command
