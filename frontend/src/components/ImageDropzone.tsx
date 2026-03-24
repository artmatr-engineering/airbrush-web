import { useDropzone } from 'react-dropzone';

interface ImageDropzoneProps {
  onUpload: (imageBase64: string, filename: string) => void;
}

export function ImageDropzone({ onUpload }: ImageDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Extract base64 data from data URL (remove "data:image/...;base64," prefix)
        const base64 = result.split(',')[1];
        onUpload(base64, file.name);
      };
      reader.readAsDataURL(file);
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    multiple: false
  });

  return (
    <div className="h-full w-full">
      <div
        {...getRootProps()}
        className={`h-full w-full cursor-pointer transition-colors rounded-lg border border-dashed ${
          isDragActive
            ? 'bg-primary/10 border-primary'
            : 'bg-muted border-muted-foreground/25'
        }`}
      >
        <input {...getInputProps()} />
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-xl font-medium text-foreground mb-2">
              {isDragActive ? 'Drop image here' : 'Drop image here or click to upload'}
            </p>
            <p className="text-sm text-muted-foreground">
              Supports PNG and JPG (max 5MB)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
