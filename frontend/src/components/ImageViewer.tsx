interface ImageViewerProps {
  imageBase64: string | null;
}

export function ImageViewer({ imageBase64 }: ImageViewerProps) {
  if (!imageBase64) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-muted-foreground">No image uploaded</p>
      </div>
    );
  }

  // Construct data URI from base64
  const dataUri = `data:image/png;base64,${imageBase64}`;

  return (
    <div className="h-full w-full flex items-center justify-center p-2 overflow-hidden">
      <img
        src={dataUri}
        alt="Uploaded Image"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
