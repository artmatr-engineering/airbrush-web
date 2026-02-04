import { create } from 'zustand';
import type { AirbrushParams } from '@/components/Parameters';
import type { ViewerTab } from '@/components/BottomBar';
import { defaultParams } from '@/defaults';

interface AppState {
  imageBase64: string | null;
  filename: string;
  outputFilename: string;
  params: AirbrushParams;
  isGenerating: boolean;
  viewerTab: ViewerTab;
  previewImageBase64: string | null;
  gcode: string | null;

  setImageUpload: (base64: string, name: string) => void;
  setOutputFilename: (name: string) => void;
  setParams: (params: AirbrushParams) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setViewerTab: (tab: ViewerTab) => void;
  setPreviewImageBase64: (base64: string | null) => void;
  setGcode: (gcode: string | null) => void;
}

const getDefaultOutputFilename = (filename: string) => {
  if (!filename) return '';
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  return `${nameWithoutExt}_AB.nc`;
};

export const useAppStore = create<AppState>((set) => ({
  imageBase64: null,
  filename: '',
  outputFilename: '',
  params: defaultParams,
  isGenerating: false,
  viewerTab: 'upload',
  previewImageBase64: null,
  gcode: null,

  setImageUpload: (base64, name) =>
    set({
      imageBase64: base64,
      filename: name,
      outputFilename: getDefaultOutputFilename(name),
      viewerTab: 'input',
    }),

  setOutputFilename: (name) => set({ outputFilename: name }),

  setParams: (params) => set({ params }),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  setViewerTab: (tab) => set({ viewerTab: tab }),

  setPreviewImageBase64: (base64) => set({ previewImageBase64: base64 }),

  setGcode: (gcode) => set({ gcode }),
}));
