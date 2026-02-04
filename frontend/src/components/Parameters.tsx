import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Download } from 'lucide-react';
import { useAppStore } from '@/store';

export interface AirbrushParams {
  job_size: [number, number];
  job_location: [number, number];
  print_channel: 'C' | 'M' | 'Y' | 'K' | 'GRAYSCALE';
  padding_distance: number;
  ramp_distances: [number, number];
  y_step_distance: number;
  ab_min: number;
  ab_max: number;
  z: number;
  feedrate: number;
  gaussian_blur_radius: number;
  print_direction: 'bottom_to_top' | 'top_to_bottom';
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
  gcode: string | null;
  onDownload: () => void;
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

export function Parameters({
  params,
  setParams,
  onGenerate,
  isGenerating,
  hasImage,
  gcode,
  onDownload,
}: ParametersProps) {
  const handleParamChange = <K extends keyof AirbrushParams>(
    key: K,
    value: AirbrushParams[K]
  ) => {
    setParams({ ...params, [key]: value });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold px-2 ml-2 pt-2">Parameters</h3>
          <div className="flex flex-col gap-3 px-2 mb-4">
            {/* Job Size */}
            <div className="flex gap-2 px-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="width">Width (mm)</Label>
                <NumberInput
                  id="width"
                  min={1}
                  value={params.job_size[0]}
                  onValueChange={(value) =>
                    handleParamChange('job_size', [value || 1, params.job_size[1]])
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="height">Height (mm)</Label>
                <NumberInput
                  id="height"
                  min={1}
                  value={params.job_size[1]}
                  onValueChange={(value) =>
                    handleParamChange('job_size', [params.job_size[0], value || 1])
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Job Location */}
            <div className="flex gap-2 px-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="job_x">Job X (mm)</Label>
                <NumberInput
                  id="job_x"
                  decimalScale={1}
                  value={params.job_location[0]}
                  onValueChange={(value) =>
                    handleParamChange('job_location', [value || 0, params.job_location[1]])
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="job_y">Job Y (mm)</Label>
                <NumberInput
                  id="job_y"
                  decimalScale={1}
                  value={params.job_location[1]}
                  onValueChange={(value) =>
                    handleParamChange('job_location', [params.job_location[0], value || 0])
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>

            <Separator className="my-1" />

            {/* Print Channel */}
            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="print_channel">Print Channel</Label>
              <Select
                value={params.print_channel}
                onValueChange={(value) =>
                  handleParamChange('print_channel', value as AirbrushParams['print_channel'])
                }
              >
                <SelectTrigger id="print_channel">
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
            </div>

            {/* Print Direction */}
            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="print_direction">Print Direction</Label>
              <Select
                value={params.print_direction}
                onValueChange={(value) =>
                  handleParamChange('print_direction', value as AirbrushParams['print_direction'])
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

            <Separator className="my-1" />

            {/* Motion Parameters */}
            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="feedrate">Feedrate (mm/min)</Label>
              <NumberInput
                id="feedrate"
                min={100}
                value={params.feedrate}
                onValueChange={(value) => handleParamChange('feedrate', value || 4000)}
                className="h-9 w-full"
              />
            </div>

            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="z">Z Position (mm)</Label>
              <NumberInput
                id="z"
                decimalScale={1}
                value={params.z}
                onValueChange={(value) => handleParamChange('z', value || 15)}
                className="h-9 w-full"
              />
            </div>

            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="padding_distance">Padding Distance (mm)</Label>
              <NumberInput
                id="padding_distance"
                decimalScale={1}
                value={params.padding_distance}
                onValueChange={(value) => handleParamChange('padding_distance', value || 75)}
                className="h-9 w-full"
              />
            </div>

            {/* Ramp Distances */}
            <div className="flex gap-2 px-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="ramp_before">Ramp Before (mm)</Label>
                <NumberInput
                  id="ramp_before"
                  decimalScale={1}
                  value={params.ramp_distances[0]}
                  onValueChange={(value) =>
                    handleParamChange('ramp_distances', [value || 6, params.ramp_distances[1]])
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
                    handleParamChange('ramp_distances', [params.ramp_distances[0], value || 6])
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Step Distance */}
            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="y_step">Y Step (mm)</Label>
              <NumberInput
                id="y_step"
                decimalScale={2}
                stepper={0.1}
                min={0.1}
                value={params.y_step_distance}
                onValueChange={(value) => handleParamChange('y_step_distance', value || 0.5)}
                className="h-9 w-full"
              />
            </div>

            <Separator className="my-1" />

            {/* Airbrush Valve */}
            <div className="flex gap-2 px-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="ab_min">AB Min μm (white)</Label>
                <NumberInput
                  id="ab_min"
                  decimalScale={0}
                  stepper={10}
                  min={0}
                  max={1000}
                  value={params.ab_min}
                  onValueChange={(value) => handleParamChange('ab_min', value || 0)}
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
                  onValueChange={(value) => handleParamChange('ab_max', value || 500)}
                  className="h-9 w-full"
                />
              </div>
            </div>

            {/* Gaussian Blur */}
            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="blur_radius">Gaussian Blur Radius (px)</Label>
              <NumberInput
                id="blur_radius"
                decimalScale={1}
                stepper={0.5}
                min={0}
                value={params.gaussian_blur_radius}
                onValueChange={(value) => handleParamChange('gaussian_blur_radius', value || 3)}
                className="h-9 w-full"
              />
            </div>

            <Separator className="my-1" />

            {/* Calibration Border */}
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                id="enable_gradient_border"
                checked={params.enable_gradient_border}
                onCheckedChange={(checked) =>
                  handleParamChange('enable_gradient_border', checked === true)
                }
              />
              <Label htmlFor="enable_gradient_border">Enable Calibration Border</Label>
            </div>

            {params.enable_gradient_border && (
              <div className="flex gap-2 px-2">
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="gradient_border_width">Border Width (mm)</Label>
                  <NumberInput
                    id="gradient_border_width"
                    decimalScale={0}
                    min={1}
                    value={params.gradient_border_width}
                    onValueChange={(value) =>
                      handleParamChange('gradient_border_width', value || 40)
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
                      handleParamChange('gradient_levels', value || 10)
                    }
                    className="h-9 w-full"
                  />
                </div>
              </div>
            )}

            <Separator className="my-1" />

            {/* Bounding Box */}
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                id="draw_bounding_box"
                checked={params.draw_bounding_box}
                onCheckedChange={(checked) =>
                  handleParamChange('draw_bounding_box', checked === true)
                }
              />
              <Label htmlFor="draw_bounding_box">Draw Bounding Box</Label>
            </div>

          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="output_filename">Output Filename</Label>
          <FilenameInput />
        </div>
        <Button
          disabled={!hasImage || isGenerating}
          className="w-full"
          onClick={onGenerate}
        >
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isGenerating ? 'Generating...' : 'Generate G-code'}
        </Button>
        <Button
          disabled={!gcode}
          variant="outline"
          className="w-full"
          onClick={onDownload}
        >
          <Download className="mr-2 h-4 w-4" />
          Download G-code
        </Button>
      </div>
    </div>
  );
}
