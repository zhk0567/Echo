import { memo, useCallback, useRef, useState } from 'react';

interface ExportTxtButtonProps {
  onNotify?: (message: string) => void;
}

export const ExportTxtButton = memo(function ExportTxtButton({ onNotify }: ExportTxtButtonProps) {
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);

  const handleExport = useCallback(async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const result = await window.diaryAPI.exportToTxt();
      if (result.ok) {
        onNotify?.(`已导出 ${result.count} 篇日记至 ${result.path}`);
      } else if (!result.cancelled) {
        onNotify?.('导出失败，请检查目标路径是否可写');
      }
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [onNotify]);

  return (
    <button
      type="button"
      className="btn-export-txt"
      onClick={() => void handleExport()}
      disabled={exporting}
      title="导出全部日记为 TXT"
    >
      {exporting ? '导出中…' : '导出 TXT'}
    </button>
  );
});
