import { useState } from 'react';

import { BottomBar, type ViewerTab } from '@/components/BottomBar';
import { VectorDropzone } from '@/components/VectorDropzone';
import { VectorParameters, type VectorParams } from '@/components/VectorParameters';
import { VectorViewer } from '@/components/VectorViewer';

const getDefaultOutputFilename = (filename: string) => {
  if (!filename) return '';
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  return `${nameWithoutExt}_AB.nc`;
};

const defaultVectorParams: VectorParams = {
  job_size: [1000, 1000],
  job_location: [0, 0],
  job_origin_corner: 'upper_left',
  ramp_distances: [3, 3],
  ab_min: 0,
  ab_max: 280,
  darkness: 100,
  z: 8,
  feedrate: 4800,
  optimize_toolpath: true,
};

export function VectorApp() {
  const [svgString, setSvgString] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [outputFilename, setOutputFilename] = useState('');
  const [params, setParams] = useState<VectorParams>(defaultVectorParams);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewerTab, setViewerTab] = useState<ViewerTab>('upload');
  const [gcode, setGcode] = useState<string | null>(null);

  const handleUpload = (uploadedSvg: string, uploadedFilename: string) => {
    setSvgString(uploadedSvg);
    setFilename(uploadedFilename);
    setOutputFilename(getDefaultOutputFilename(uploadedFilename));
    setGcode(null);
    setViewerTab('input');
  };

  const handleParamsChange = (nextParams: VectorParams) => {
    setParams(nextParams);
    setGcode(null);
    if (viewerTab === 'preview') {
      setViewerTab('input');
    }
  };

  const handleDownload = () => {
    if (!gcode) return;
    const blob = new Blob([gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFilename || 'output.nc';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (!svgString) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-vector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          svg_string: svgString,
          filename,
          ...params,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate vector G-code');
      }

      const result = await response.json();
      setGcode(result.gcode);
      setViewerTab('preview');
    } catch (error) {
      console.error('Error generating vector G-code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex h-12 items-center gap-2.5 border-b bg-background px-4">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
        <h1 className="text-sm font-semibold tracking-tight">
          Matr Labs Airbrush
        </h1>
        <span className="text-xs text-muted-foreground">
          G-code Generator · Vector
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r bg-background">
          <VectorParameters
            params={params}
            setParams={handleParamsChange}
            outputFilename={outputFilename}
            setOutputFilename={setOutputFilename}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            hasSvg={!!svgString}
            gcode={gcode}
            onDownload={handleDownload}
          />
        </aside>

        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 p-4 min-h-0 overflow-hidden">
            {viewerTab === 'upload' && <VectorDropzone onUpload={handleUpload} />}
            {viewerTab === 'input' && <VectorViewer viewerTab="input" svgString={svgString} />}
            {viewerTab === 'preview' && (
              <VectorViewer viewerTab="preview" svgString={svgString} />
            )}
          </div>
          <BottomBar
            viewerTab={viewerTab}
            setViewerTab={setViewerTab}
            hasInputImage={!!svgString}
            hasPreviewImage={!!gcode}
            inputLabel="Input SVG"
            previewLabel="Preview"
          />
        </main>
      </div>
    </div>
  );
}
