interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  mode?: 'confirm' | 'unsaved';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  mode = 'confirm',
  confirmLabel = '确定',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
  onSave,
  onDiscard,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          {mode === 'unsaved' ? (
            <>
              <button className="btn-secondary" onClick={onCancel}>
                取消
              </button>
              <button className="btn-danger" onClick={onDiscard}>
                不保存
              </button>
              <button className="btn-primary" onClick={onSave}>
                保存并离开
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={onCancel}>
                {cancelLabel}
              </button>
              <button className="btn-primary" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
