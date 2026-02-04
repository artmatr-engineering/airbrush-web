import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type ViewerTab = 'upload' | 'input' | 'preview';

interface BottomBarProps {
  viewerTab: ViewerTab;
  setViewerTab: (tab: ViewerTab) => void;
  hasInputImage: boolean;
  hasPreviewImage: boolean;
}

export function BottomBar({
  viewerTab,
  setViewerTab,
  hasInputImage,
  hasPreviewImage,
}: BottomBarProps) {
  return (
    <div className="flex items-center justify-center px-4 py-3 border-t bg-background">
      <Tabs value={viewerTab} onValueChange={(v) => setViewerTab(v as ViewerTab)}>
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="input" disabled={!hasInputImage}>
            Input Image
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!hasPreviewImage}>
            Preview Image
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
