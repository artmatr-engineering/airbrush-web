import { Parameters } from "@/components/Parameters";
import { ImageDropzone } from "@/components/ImageDropzone";
import { ImageViewer } from "@/components/ImageViewer";
import { BottomBar } from "@/components/BottomBar";
import { useAppStore } from "@/store";
import { VectorApp } from "@/VectorApp";
import { useState } from "react";

const CMYK_CHANNELS = ["C", "M", "Y", "K"] as const;

/** Insert a channel suffix before the file extension, e.g. art.nc -> art_C.nc */
function channelFilename(base: string, channel: string): string {
  const name = base.trim() || "output.nc";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name}_${channel}.nc`;
  return `${name.slice(0, dot)}_${channel}${name.slice(dot)}`;
}

function downloadGcode(gcode: string, filename: string) {
  const blob = new Blob([gcode], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RasterApp() {
  const {
    imageBase64,
    filename,
    outputFilename,
    params,
    isGenerating,
    viewerTab,
    previewImageBase64,
    setImageUpload,
    setParams,
    setIsGenerating,
    setViewerTab,
    setPreviewImageBase64,
    setGcode,
  } = useAppStore();

  const [isGeneratingCMYK, setIsGeneratingCMYK] = useState(false);
  const [cmykChannel, setCmykChannel] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Generate a preview only: render the G-code and show its preview image
  // without downloading anything (the old "Generate G-code" behaviour).
  const handlePreview = async () => {
    if (!imageBase64 || isGenerating || isGeneratingCMYK || isPreviewing) return;

    setIsPreviewing(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: imageBase64,
          filename,
          ...params,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate preview");
      }

      const result = await response.json();
      setGcode(result.gcode);
      setPreviewImageBase64(result.preview_image_base64);
      setViewerTab("preview");
    } catch (error) {
      console.error("Error generating preview:", error);
    } finally {
      setIsPreviewing(false);
    }
  };

  // Generate a separate .nc file for each CMYK channel and download them.
  // Reuses the single-channel /api/generate endpoint, one request per channel,
  // overriding only print_channel so all other parameters stay identical.
  const handleGetCMYK = async () => {
    if (!imageBase64 || isGenerating || isGeneratingCMYK) return;

    setIsGeneratingCMYK(true);
    try {
      for (const channel of CMYK_CHANNELS) {
        setCmykChannel(channel);
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: imageBase64,
            filename,
            ...params,
            print_channel: channel,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate ${channel} channel`);
        }

        const result = await response.json();
        downloadGcode(result.gcode, channelFilename(outputFilename, channel));
      }
    } catch (error) {
      console.error("Error generating CMYK G-code:", error);
    } finally {
      setIsGeneratingCMYK(false);
      setCmykChannel(null);
    }
  };

  const handleGenerate = async () => {
    if (!imageBase64) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          filename,
          ...params,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate G-code");
      }

      const result = await response.json();
      setGcode(result.gcode);
      setPreviewImageBase64(result.preview_image_base64);
      setViewerTab("preview");
      downloadGcode(result.gcode, outputFilename || "output.nc");
    } catch (error) {
      console.error("Error generating G-code:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 items-center gap-2.5 border-b bg-background px-4">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
        <h1 className="text-sm font-semibold tracking-tight">
          Matr Labs Internal Tools
        </h1>
        <span className="text-xs text-muted-foreground">
          Airbrush G-code Generator
        </span>
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
            onGetCMYK={handleGetCMYK}
            isGeneratingCMYK={isGeneratingCMYK}
            cmykChannel={cmykChannel}
            onPreview={handlePreview}
            isPreviewing={isPreviewing}
          />
        </aside>

        {/* Main viewer area */}
        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 p-4 min-h-0 overflow-hidden">
            {viewerTab === "upload" && (
              <ImageDropzone onUpload={setImageUpload} />
            )}
            {viewerTab === "input" && <ImageViewer imageBase64={imageBase64} />}
            {viewerTab === "preview" && (
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

function App() {
  if (window.location.pathname.startsWith("/vector")) {
    return <VectorApp />;
  }
  return <RasterApp />;
}

export default App;
