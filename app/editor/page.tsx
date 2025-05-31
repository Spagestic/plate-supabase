import { Toaster } from 'sonner';

import { PlateEditor } from '@/components/plate-editor';
import { SettingsProvider } from '@/components/settings';

export default function Page() {
  return (
    <div className="h-screen w-full" data-registry="plate">
      <SettingsProvider>
        <PlateEditor />
      </SettingsProvider>

      <Toaster />
    </div>
  );
}
