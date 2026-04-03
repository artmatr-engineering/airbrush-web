import { useState } from 'react';
import { useDropzone } from 'react-dropzone';

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
              Supports PNG and JPG (compressed before upload)
            </p>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
