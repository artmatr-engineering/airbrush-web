import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageUp } from 'lucide-react';

interface ImageDropzoneProps {
  onUpload: (imageBase64: string, filename: string) => void;
}

async function resizeImageToMaxSize(file: File, maxSizeBytes = 250_000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      let w = img.width;
      let h = img.height;
      let blob: Blob | null = null;

      while (w > 1 && h > 1) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context error'));
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);

        blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.5));
        if (blob && blob.size <= maxSizeBytes) {
          URL.revokeObjectURL(url);
          resolve(blob);
          return;
        }

        w = Math.max(Math.round(w * 0.5), 1);
        h = Math.max(Math.round(h * 0.5), 1);
      }

      URL.revokeObjectURL(url);
      reject(new Error('Could not compress image below 0.5MB'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image for compression'));
    };

    img.src = url;
  });
}

export function ImageDropzone({ onUpload }: ImageDropzoneProps) {
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;

      setError(null);

      try {
        const resizedBlob = await resizeImageToMaxSize(file);
        const uploadFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });
        const reader = new FileReader();

        reader.onload = (event) => {
          const result = event.target?.result as string;
          const base64 = result.split(',')[1];
          onUpload(base64, uploadFile.name);
        };

        reader.readAsDataURL(uploadFile);
      } catch (err) {
        console.error('Image compression failed:', err);
        setError('Image too large to compress below 0.5MB');
      }
    },
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    multiple: false,
    onDropRejected: () => setError('Please upload a valid PNG or JPG file'),
  });

  return (
    <div className="h-full w-full">
      <div
        {...getRootProps()}
        className={`group flex h-full w-full cursor-pointer items-center justify-center rounded-xl border border-dashed p-8 transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${
              isDragActive
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground group-hover:text-foreground'
            }`}
          >
            <ImageUp className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {isDragActive ? 'Drop image here' : 'Drop image or click to upload'}
            </p>
            <p className="text-xs text-muted-foreground">PNG or JPG</p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
