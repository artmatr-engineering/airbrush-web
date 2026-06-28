import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageViewerProps {
  imageBase64: string | null;
}

export function ImageViewer({ imageBase64 }: ImageViewerProps) {
  if (!imageBase64) {
    return (
      <div className="h-full w-full flex items-center justify-center rounded-lg border bg-muted/20">
        <p className="text-sm text-muted-foreground">No image uploaded</p>
      </div>
    );
  }

  const dataUri = `data:image/png;base64,${imageBase64}`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border bg-muted/20">
      <TransformWrapper
        minScale={0.5}
        maxScale={12}
        centerOnInit
        wheel={{ step: 0.01, smoothStep: 0.0015 }}
        doubleClick={{ mode: "reset" }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => zoomIn()}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => zoomOut()}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                onClick={() => resetTransform()}
                title="Reset view"
                aria-label="Reset view"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
            <TransformComponent
              wrapperClass="!h-full !w-full"
              contentClass="!h-full !w-full !items-center !justify-center"
            >
              <img
                src={dataUri}
                alt="Uploaded"
                draggable={false}
                className="h-full w-full select-none object-contain"
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
