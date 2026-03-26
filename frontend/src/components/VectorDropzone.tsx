import { useDropzone } from 'react-dropzone';

interface VectorDropzoneProps {
  onUpload: (svgString: string, filename: string) => void;
}

export function VectorDropzone({ onUpload }: VectorDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onUpload(result, file.name);
      };
      reader.readAsText(file);
    },
    maxSize: 5 * 1024 * 1024,
    accept: {
      'image/svg+xml': ['.svg'],
    },
    multiple: false,
  });

  return (
    <div className="h-full w-full">
      <div
        {...getRootProps()}
        className={`h-full w-full cursor-pointer transition-colors rounded-lg border border-dashed ${
          isDragActive ? 'bg-primary/10 border-primary' : 'bg-muted border-muted-foreground/25'
        }`}
      >
        <input {...getInputProps()} />
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-xl font-medium text-foreground mb-2">
              {isDragActive ? 'Drop SVG here' : 'Drop SVG here or click to upload'}
            </p>
            <p className="text-sm text-muted-foreground">Supports SVG (max 5MB)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
