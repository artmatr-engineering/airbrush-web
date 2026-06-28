import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Download,
  Lock,
  LockOpen,
  Layers,
  ChevronDown,
  Eye,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAppStore } from "@/store";

export interface AirbrushParams {
  job_size: [number, number];
  job_location: [number, number];
  job_origin_corner: "upper_left" | "lower_left";
  print_channel: "C" | "M" | "Y" | "K" | "GRAYSCALE";
  padding_distance: number;
  ramp_distances: [number, number];
  y_step_distance: number;
  ab_min: number;
  ab_max: number;
  z: number;
  feedrate: number;
  gaussian_blur_radius: number;
  print_direction: "bottom_to_top" | "top_to_bottom";
  enable_gradient_border: boolean;
  gradient_border_width: number;
  gradient_levels: number;
  draw_bounding_box: boolean;
}

interface ParametersProps {
  params: AirbrushParams;
  setParams: (params: AirbrushParams) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasImage: boolean;
  onGetCMYK: () => void;
  isGeneratingCMYK: boolean;
  cmykChannel: string | null;
  onPreview: () => void;
  isPreviewing: boolean;
}

function FilenameInput() {
  const { outputFilename, setOutputFilename } = useAppStore();
  return (
    <Input
      id="output_filename"
      value={outputFilename}
      onChange={(e) => setOutputFilename(e.target.value)}
      placeholder="output.nc"
      className="h-9"
    />
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-border/70 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-3 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {title}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 pb-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function Parameters({
  params,
  setParams,
  onGenerate,
  isGenerating,
  hasImage,
  onGetCMYK,
  isGeneratingCMYK,
  cmykChannel,
  onPreview,
  isPreviewing,
}: ParametersProps) {
  const handleParamChange = <K extends keyof AirbrushParams>(
    key: K,
    value: AirbrushParams[K],
  ) => {
    setParams({ ...params, [key]: value });
  };

  // Lock width/height to the source image's aspect ratio. UI-only state, so it
  // is not part of `params` (never sent to the backend or persisted).
  const imageBase64 = useAppStore((s) => s.imageBase64);
  // Locked by default so a freshly loaded image keeps its proportions.
  const [aspectLocked, setAspectLocked] = useState(true);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  // Natural pixel size of the loaded image — the 100% reference for the scale
  // readout (Photoshop-style).
  const [imageSize, setImageSize] = useState<[number, number] | null>(null);
  // Display unit for the size fields. Stored size is always millimetres.
  const [unit, setUnit] = useState<"mm" | "in">("mm");

  const setSize = (width: number, height: number) =>
    handleParamChange("job_size", [Math.max(1, width), Math.max(1, height)]);

  useEffect(() => {
    if (!imageBase64) {
      setImageAspect(null);
      setImageSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w > 0 && h > 0) {
        setImageAspect(w / h);
        setImageSize([w, h]);
        // Adopt the image's native dimensions and lock the ratio on load, so
        // the job starts at 100% of the original and scales proportionally.
        setAspectLocked(true);
        setSize(w, h);
      }
    };
    // The store holds raw base64 (the data-URL prefix is stripped on upload),
    // so rebuild a valid data URL for the Image to load.
    img.src = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageBase64]);

  // Aspect to enforce when locked: the image's ratio if available, otherwise
  // whatever ratio the current size already has (preserves it on edit).
  const lockedAspect =
    imageAspect ??
    (params.job_size[1] ? params.job_size[0] / params.job_size[1] : 1);

  // Current job size as a percentage of the original image (width-based).
  const scalePercent =
    imageSize && imageSize[0]
      ? (params.job_size[0] / imageSize[0]) * 100
      : null;

  // Size fields are shown in the selected unit but stored as millimetres.
  const MM_PER_IN = 25.4;
  const toDisplay = (mm: number) => (unit === "in" ? mm / MM_PER_IN : mm);
  const toMm = (value: number) => (unit === "in" ? value * MM_PER_IN : value);

  // While a size field is being typed, hold its raw value locally and only
  // commit it — recomputing the linked dimension and scale — on blur. This
  // keeps live keystrokes from triggering store updates and aspect-ratio
  // recalculation that would fight the user's typing.
  type SizeField = "w" | "h" | "s";
  const [draft, setDraft] = useState<{
    field: SizeField;
    value: number | undefined;
  } | null>(null);

  const widthValue =
    draft?.field === "w" ? draft.value : toDisplay(params.job_size[0]);
  const heightValue =
    draft?.field === "h" ? draft.value : toDisplay(params.job_size[1]);
  const scaleValue =
    draft?.field === "s" ? draft.value : (scalePercent ?? undefined);

  const commitDraft = () => {
    if (!draft) return;
    const v = draft.value;
    if (draft.field === "w") {
      const width = Math.max(1, toMm(v || 0));
      setSize(width, aspectLocked ? width / lockedAspect : params.job_size[1]);
    } else if (draft.field === "h") {
      const height = Math.max(1, toMm(v || 0));
      setSize(
        aspectLocked ? height * lockedAspect : params.job_size[0],
        height,
      );
    } else if (draft.field === "s" && imageSize) {
      const pct = (v || 0) / 100;
      setSize(imageSize[0] * pct, imageSize[1] * pct);
    }
    setDraft(null);
  };

  const toggleAspectLock = () => {
    const next = !aspectLocked;
    setAspectLocked(next);
    // On enable, snap height to the image ratio so the size is immediately
    // consistent (otherwise the lock only takes effect on the next edit).
    if (next && imageAspect) {
      setSize(params.job_size[0], params.job_size[0] / imageAspect);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="px-4 pt-4 pb-1">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em]">
            Parameters
          </h3>
        </div>
        <div className="flex flex-col px-4 pb-6">
          {/* Geometry */}
          <Section title="Geometry">
            {/* Job Size */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Size</Label>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center rounded-md border border-border p-0.5">
                    {(["mm", "in"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        aria-pressed={unit === u}
                        className={`rounded px-1.5 py-0.5 text-[0.7rem] transition-colors ${
                          unit === u
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={toggleAspectLock}
                    aria-pressed={aspectLocked}
                    title="Lock width/height to the image aspect ratio"
                    className={`flex items-center rounded-md p-1 text-xs transition-colors ${
                      aspectLocked
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {aspectLocked ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <LockOpen className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="width">Width</Label>
                  <NumberInput
                    id="width"
                    min={unit === "in" ? 0.1 : 1}
                    decimalScale={unit === "in" ? 3 : 0}
                    value={widthValue}
                    onValueChange={(value) => setDraft({ field: "w", value })}
                    onBlur={commitDraft}
                    className="h-9 w-full"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="height">Height</Label>
                  <NumberInput
                    id="height"
                    min={unit === "in" ? 0.1 : 1}
                    decimalScale={unit === "in" ? 3 : 0}
                    value={heightValue}
                    onValueChange={(value) => setDraft({ field: "h", value })}
                    onBlur={commitDraft}
                    className="h-9 w-full"
                  />
                </div>
              </div>
              {imageSize && aspectLocked && (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="scale" className="text-muted-foreground">
                      Scale
                    </Label>
                    <NumberInput
                      id="scale"
                      min={1}
                      decimalScale={1}
                      stepper={5}
                      suffix="%"
                      value={scaleValue}
                      onValueChange={(value) => setDraft({ field: "s", value })}
                      onBlur={commitDraft}
                      className="h-8 w-[5.5rem]"
                    />
                  </div>
                  <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
                    {imageSize[0]} × {imageSize[1]} px
                  </span>
                </div>
              )}
            </div>

            {/* Job Origin Corner */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="job_origin_corner">Reference Corner</Label>
              <Select
                value={params.job_origin_corner}
                onValueChange={(value) =>
                  handleParamChange(
                    "job_origin_corner",
                    value as AirbrushParams["job_origin_corner"],
                  )
                }
              >
                <SelectTrigger id="job_origin_corner">
                  <SelectValue placeholder="Select corner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upper_left">Upper-Left</SelectItem>
                  <SelectItem value="lower_left">Lower-Left</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Job Location */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="job_x">Ref. X (mm)</Label>
                <NumberInput
                  id="job_x"
                  decimalScale={1}
                  value={params.job_location[0]}
                  onValueChange={(value) =>
                    handleParamChange("job_location", [
                      value || 0,
                      params.job_location[1],
                    ])
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="job_y">Ref. Y (mm)</Label>
                <NumberInput
                  id="job_y"
                  decimalScale={1}
                  value={params.job_location[1]}
                  onValueChange={(value) =>
                    handleParamChange("job_location", [
                      params.job_location[0],
                      value || 0,
                    ])
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>
          </Section>

          {/* Motion */}
          <Section title="Motion" defaultOpen={false}>
            {/* Print Direction */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="print_direction">Print Direction</Label>
              <Select
                value={params.print_direction}
                onValueChange={(value) =>
                  handleParamChange(
                    "print_direction",
                    value as AirbrushParams["print_direction"],
                  )
                }
              >
                <SelectTrigger id="print_direction">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom_to_top">Bottom to Top</SelectItem>
                  <SelectItem value="top_to_bottom">Top to Bottom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="feedrate">Feedrate (mm/min)</Label>
              <NumberInput
                id="feedrate"
                min={100}
                value={params.feedrate}
                onValueChange={(value) =>
                  handleParamChange("feedrate", value || 4000)
                }
                className="h-9 w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="z">Z Position (mm)</Label>
              <NumberInput
                id="z"
                decimalScale={1}
                value={params.z}
                onValueChange={(value) => handleParamChange("z", value || 15)}
                className="h-9 w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="padding_distance">Padding Distance (mm)</Label>
              <NumberInput
                id="padding_distance"
                decimalScale={1}
                value={params.padding_distance}
                onValueChange={(value) =>
                  handleParamChange("padding_distance", value || 75)
                }
                className="h-9 w-full"
              />
            </div>

            {/* Ramp Distances */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="ramp_before">Ramp Before (mm)</Label>
                <NumberInput
                  id="ramp_before"
                  decimalScale={1}
                  value={params.ramp_distances[0]}
                  onValueChange={(value) =>
                    handleParamChange("ramp_distances", [
                      value || 6,
                      params.ramp_distances[1],
                    ])
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="ramp_after">Ramp After (mm)</Label>
                <NumberInput
                  id="ramp_after"
                  decimalScale={1}
                  value={params.ramp_distances[1]}
                  onValueChange={(value) =>
                    handleParamChange("ramp_distances", [
                      params.ramp_distances[0],
                      value || 6,
                    ])
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Step Distance */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="y_step">Y Step (mm)</Label>
              <NumberInput
                id="y_step"
                decimalScale={2}
                stepper={0.1}
                min={0.1}
                value={params.y_step_distance}
                onValueChange={(value) =>
                  handleParamChange("y_step_distance", value || 0.5)
                }
                className="h-9 w-full"
              />
            </div>
          </Section>

          {/* Airbrush */}
          <Section title="Airbrush" defaultOpen={false}>
            {/* Airbrush Valve */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="ab_min">AB Min μm (white)</Label>
                <NumberInput
                  id="ab_min"
                  decimalScale={0}
                  stepper={10}
                  min={0}
                  max={1000}
                  value={params.ab_min}
                  onValueChange={(value) =>
                    handleParamChange("ab_min", value || 0)
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="ab_max">AB Max μm (dark)</Label>
                <NumberInput
                  id="ab_max"
                  decimalScale={0}
                  stepper={10}
                  min={0}
                  max={1000}
                  value={params.ab_max}
                  onValueChange={(value) =>
                    handleParamChange("ab_max", value || 500)
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Gaussian Blur */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="blur_radius">Gaussian Blur Radius (px)</Label>
              <NumberInput
                id="blur_radius"
                decimalScale={1}
                stepper={0.5}
                min={0}
                value={params.gaussian_blur_radius}
                onValueChange={(value) =>
                  handleParamChange("gaussian_blur_radius", value || 1)
                }
                className="h-9 w-full"
              />
            </div>
          </Section>

          {/* Calibration */}
          <Section title="Calibration" defaultOpen={false}>
            {/* Calibration Border */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable_gradient_border"
                checked={params.enable_gradient_border}
                onCheckedChange={(checked) =>
                  handleParamChange("enable_gradient_border", checked === true)
                }
              />
              <Label htmlFor="enable_gradient_border">
                Enable Calibration Border
              </Label>
            </div>

            {params.enable_gradient_border && (
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="gradient_border_width">
                    Border Width (mm)
                  </Label>
                  <NumberInput
                    id="gradient_border_width"
                    decimalScale={0}
                    min={1}
                    value={params.gradient_border_width}
                    onValueChange={(value) =>
                      handleParamChange("gradient_border_width", value || 40)
                    }
                    className="h-9 w-full"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="gradient_levels">Gradient Levels</Label>
                  <NumberInput
                    id="gradient_levels"
                    decimalScale={0}
                    min={2}
                    max={20}
                    value={params.gradient_levels}
                    onValueChange={(value) =>
                      handleParamChange("gradient_levels", value || 10)
                    }
                    className="h-9 w-full"
                  />
                </div>
              </div>
            )}

            {/* Bounding Box */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="draw_bounding_box"
                checked={params.draw_bounding_box}
                onCheckedChange={(checked) =>
                  handleParamChange("draw_bounding_box", checked === true)
                }
              />
              <Label htmlFor="draw_bounding_box">Draw Bounding Box</Label>
            </div>
          </Section>
        </div>
      </div>

      <div className="flex-shrink-0 border-t p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="output_filename">Output Filename</Label>
          <FilenameInput />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="print_channel">Print Channel</Label>
          <div className="flex gap-2">
            <Select
              value={params.print_channel}
              onValueChange={(value) =>
                handleParamChange(
                  "print_channel",
                  value as AirbrushParams["print_channel"],
                )
              }
            >
              <SelectTrigger id="print_channel" className="flex-1">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GRAYSCALE">Grayscale</SelectItem>
                <SelectItem value="C">Cyan (C)</SelectItem>
                <SelectItem value="M">Magenta (M)</SelectItem>
                <SelectItem value="Y">Yellow (Y)</SelectItem>
                <SelectItem value="K">Black (K)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!hasImage || isGenerating || isGeneratingCMYK || isPreviewing}
              onClick={onPreview}
              title="Generate a preview"
              aria-label="Generate a preview"
            >
              {isPreviewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Button
          disabled={!hasImage || isGenerating || isGeneratingCMYK || isPreviewing}
          className="w-full"
          variant="secondary"
          onClick={onGenerate}
          title="Generate the selected channel's G-code and download it"
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {isGenerating ? "Generating..." : "Get channel"}
        </Button>
        <Button
          disabled={!hasImage || isGenerating || isGeneratingCMYK || isPreviewing}
          className="w-full"
          onClick={onGetCMYK}
          title="Generate and download a separate .nc file for each CMYK channel"
        >
          {isGeneratingCMYK ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Layers className="mr-2 h-4 w-4" />
          )}
          {isGeneratingCMYK
            ? `Generating ${cmykChannel ?? ""}…`
            : "Get CMYK (4 files)"}
        </Button>
      </div>
    </div>
  );
}
