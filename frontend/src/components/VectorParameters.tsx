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

export interface VectorParams {
  job_size: [number, number];
  job_location: [number, number];
  job_origin_corner: 'upper_left' | 'lower_left';
  ramp_distances: [number, number];
  ab_min: number;
  ab_max: number;
  darkness: number;
  z: number;
  feedrate: number;
  optimize_toolpath: boolean;
}

interface VectorParametersProps {
  params: VectorParams;
  setParams: (params: VectorParams) => void;
  outputFilename: string;
  setOutputFilename: (name: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasSvg: boolean;
  gcode: string | null;
  onDownload: () => void;
}

export function VectorParameters({
  params,
  setParams,
  outputFilename,
  setOutputFilename,
  onGenerate,
  isGenerating,
  hasSvg,
  gcode,
  onDownload,
}: VectorParametersProps) {
  const handleParamChange = <K extends keyof VectorParams>(
    key: K,
    value: VectorParams[K]
  ) => {
    setParams({ ...params, [key]: value });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold px-2 ml-2 pt-2">Parameters</h3>
          <div className="flex flex-col gap-3 px-2 mb-4">
            <div className="flex gap-2 px-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="vector_width">Width (mm)</Label>
                <NumberInput
                  id="vector_width"
                  min={1}
                  value={params.job_size[0]}
                  onValueChange={(value) =>
                    handleParamChange('job_size', [value || 1, params.job_size[1]])
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="vector_height">Height (mm)</Label>
                <NumberInput
                  id="vector_height"
                  min={1}
                  value={params.job_size[1]}
                  onValueChange={(value) =>
                    handleParamChange('job_size', [params.job_size[0], value || 1])
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="vector_job_origin_corner">Reference Corner</Label>
              <Select
                value={params.job_origin_corner}
                onValueChange={(value) =>
                  handleParamChange(
                    'job_origin_corner',
                    value as VectorParams['job_origin_corner']
                  )
                }
              >
                <SelectTrigger id="vector_job_origin_corner">
                  <SelectValue placeholder="Select corner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upper_left">Upper-Left</SelectItem>
                  <SelectItem value="lower_left">Lower-Left</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 px-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="vector_job_x">Job X (mm)</Label>
                <NumberInput
                  id="vector_job_x"
                  decimalScale={1}
                  value={params.job_location[0]}
                  onValueChange={(value) =>
                    handleParamChange('job_location', [value || 0, params.job_location[1]])
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="vector_job_y">Job Y (mm)</Label>
                <NumberInput
                  id="vector_job_y"
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

            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="vector_feedrate">Feedrate (mm/min)</Label>
              <NumberInput
                id="vector_feedrate"
                min={100}
                value={params.feedrate}
                onValueChange={(value) => handleParamChange('feedrate', value || 8000)}
                className="h-9 w-full"
              />
            </div>

            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="vector_z">Z Position (mm)</Label>
              <NumberInput
                id="vector_z"
                decimalScale={1}
                value={params.z}
                onValueChange={(value) => handleParamChange('z', value || 15)}
                className="h-9 w-full"
              />
            </div>

            <div className="flex gap-2 px-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="vector_ramp_before">Ramp Before (mm)</Label>
                <NumberInput
                  id="vector_ramp_before"
                  decimalScale={1}
                  value={params.ramp_distances[0]}
                  onValueChange={(value) =>
                    handleParamChange('ramp_distances', [value || 3, params.ramp_distances[1]])
                  }
                  className="h-9 w-full"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="vector_ramp_after">Ramp After (mm)</Label>
                <NumberInput
                  id="vector_ramp_after"
                  decimalScale={1}
                  value={params.ramp_distances[1]}
                  onValueChange={(value) =>
                    handleParamChange('ramp_distances', [params.ramp_distances[0], value || 3])
                  }
                  className="h-9 w-full"
                />
              </div>
            </div>

            <Separator className="my-1" />

            <div className="flex gap-2 px-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor="vector_ab_min">AB Min μm</Label>
                <NumberInput
                  id="vector_ab_min"
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
                <Label htmlFor="vector_ab_max">AB Max μm</Label>
                <NumberInput
                  id="vector_ab_max"
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

            <div className="flex flex-col gap-1 px-2">
              <Label htmlFor="vector_darkness">Darkness (%)</Label>
              <NumberInput
                id="vector_darkness"
                decimalScale={0}
                min={0}
                max={100}
                value={params.darkness}
                onValueChange={(value) => handleParamChange('darkness', value || 100)}
                className="h-9 w-full"
              />
            </div>

            <Separator className="my-1" />

            <div className="flex items-center gap-2 px-2">
              <Checkbox
                id="vector_optimize_toolpath"
                checked={params.optimize_toolpath}
                onCheckedChange={(checked) =>
                  handleParamChange('optimize_toolpath', checked === true)
                }
              />
              <Label htmlFor="vector_optimize_toolpath">Optimize Toolpath</Label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="vector_output_filename">Output Filename</Label>
          <Input
            id="vector_output_filename"
            value={outputFilename}
            onChange={(e) => setOutputFilename(e.target.value)}
            placeholder="output.nc"
            className="h-9"
          />
        </div>
        <Button disabled={!hasSvg || isGenerating} className="w-full" onClick={onGenerate}>
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isGenerating ? 'Generating...' : 'Generate G-code'}
        </Button>
        <Button disabled={!gcode} variant="outline" className="w-full" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download G-code
        </Button>
      </div>
    </div>
  );
}
