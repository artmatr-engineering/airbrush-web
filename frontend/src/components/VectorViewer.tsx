interface VectorViewerProps {
  viewerTab: 'input' | 'preview';
  svgString: string | null;
}

export function VectorViewer({ viewerTab, svgString }: VectorViewerProps) {
  if (viewerTab === 'preview') {
    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <div className="max-w-lg text-center space-y-2">
          <p className="text-lg font-medium">No preview available</p>
          <p className="text-sm text-muted-foreground">
            To preview toolpaths, download the generated G-code and upload it to ncviewer.
          </p>
          <a
            className="text-sm underline text-foreground"
            href="https://ncviewer.com"
            target="_blank"
            rel="noreferrer"
          >
            Open https://ncviewer.com
          </a>
        </div>
      </div>
    );
  }

  if (!svgString) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-muted-foreground">No SVG uploaded</p>
      </div>
    );
  }

  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

  return (
    <div className="h-full w-full flex items-center justify-center p-2 overflow-hidden">
      <img src={dataUri} alt="Uploaded SVG" className="h-full w-full object-contain" />
    </div>
  );
}
