import { Parameters } from '@/components/Parameters';
import { ImageDropzone } from '@/components/ImageDropzone';
import { ImageViewer } from '@/components/ImageViewer';
import { BottomBar } from '@/components/BottomBar';
import { useAppStore } from '@/store';

function App() {
  const {
    imageBase64,
    filename,
    outputFilename,
    params,
    isGenerating,
    viewerTab,
    previewImageBase64,
    gcode,
    setImageUpload,
    setParams,
    setIsGenerating,
    setViewerTab,
    setPreviewImageBase64,
    setGcode,
  } = useAppStore();

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
    if (!imageBase64) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          filename,
          ...params,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate G-code');
      }

      const result = await response.json();
      setGcode(result.gcode);
      setPreviewImageBase64(result.preview_image_base64);
      setViewerTab('preview');
    } catch (error) {
      console.error('Error generating G-code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background px-4 py-2">
        <h1 className="text-[1.1rem] font-bold">Matr Labs Airbrush GCODE Generator</h1>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r bg-background">
          <Parameters
            params={params}
            setParams={setParams}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            hasImage={!!imageBase64}
            gcode={gcode}
            onDownload={handleDownload}
          />
        </aside>

        {/* Main viewer area */}
        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 p-4 min-h-0 overflow-hidden">
            {viewerTab === 'upload' && (
              <ImageDropzone onUpload={setImageUpload} />
            )}
            {viewerTab === 'input' && (
              <ImageViewer imageBase64={imageBase64} />
            )}
            {viewerTab === 'preview' && (
              <ImageViewer imageBase64={previewImageBase64} />
            )}
          </div>
          <BottomBar
            viewerTab={viewerTab}
            setViewerTab={setViewerTab}
            hasInputImage={!!imageBase64}
            hasPreviewImage={!!previewImageBase64}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
