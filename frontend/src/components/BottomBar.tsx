import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type ViewerTab = 'upload' | 'input' | 'preview';

interface BottomBarProps {
  viewerTab: ViewerTab;
  setViewerTab: (tab: ViewerTab) => void;
  hasInputImage: boolean;
  hasPreviewImage: boolean;
  inputLabel?: string;
  previewLabel?: string;
}

export function BottomBar({
  viewerTab,
  setViewerTab,
  hasInputImage,
  hasPreviewImage,
  inputLabel = 'Input Image',
  previewLabel = 'Preview Image',
}: BottomBarProps) {
  return (
    <div className="flex items-center justify-center px-4 py-3 border-t bg-background">
      <Tabs value={viewerTab} onValueChange={(v) => setViewerTab(v as ViewerTab)}>
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="input" disabled={!hasInputImage}>
            {inputLabel}
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!hasPreviewImage}>
            {previewLabel}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
