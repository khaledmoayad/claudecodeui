import { useCallback, useRef } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button, Input } from '../../../shared/view/ui';
import type { WorkspaceType } from '../types';

type WorkspacePathFieldProps = {
  workspaceType: WorkspaceType;
  value: string;
  disabled?: boolean;
  onChange: (path: string) => void;
  onAdvanceToConfirm: () => void;
};

export default function WorkspacePathField({
  workspaceType,
  value,
  disabled = false,
  onChange,
  onAdvanceToConfirm,
}: WorkspacePathFieldProps) {
  const folderPickerRef = useRef<HTMLInputElement>(null);

  const openFolderPicker = useCallback(() => {
    folderPickerRef.current?.click();
  }, []);

  const handleFolderPicked = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) {
        return;
      }

      const fileWithPath = selectedFile as File & { path?: string; webkitRelativePath?: string };
      const selectedPath = fileWithPath.path
        ? fileWithPath.path.replace(/[\\/][^\\/]+$/, '')
        : fileWithPath.webkitRelativePath
          ? fileWithPath.webkitRelativePath.split('/')[0]
          : selectedFile.name;

      onChange(selectedPath);
      event.target.value = '';

      if (workspaceType === 'existing') {
        onAdvanceToConfirm();
      }
    },
    [onAdvanceToConfirm, onChange, workspaceType],
  );

  return (
    <>
      <div className="flex gap-2">
        <Input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            workspaceType === 'existing'
              ? '/path/to/existing/workspace'
              : '/path/to/new/workspace'
          }
          className="w-full"
          disabled={disabled}
        />

        <Button
          type="button"
          variant="outline"
          onClick={openFolderPicker}
          className="px-3"
          title="Open file explorer"
          disabled={disabled}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>

        <input
          ref={folderPickerRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFolderPicked}
          {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement> & {
            webkitdirectory: string;
          })}
        />
      </div>
    </>
  );
}
