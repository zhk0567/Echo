import { memo, useEffect, useId, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  mode?: 'confirm' | 'unsaved';
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  closeOnOverlayClick?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
}

export const ConfirmDialog = memo(function ConfirmDialog({
  open,
  title,
  message,
  mode = 'confirm',
  confirmLabel = '确定',
  cancelLabel = '取消',
  confirmVariant = 'primary',
  closeOnOverlayClick = true,
  onConfirm,
  onCancel,
  onSave,
  onDiscard,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    const focusTarget = cardRef.current?.querySelector<HTMLElement>('button');
    focusTarget?.focus();

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass =
    confirmVariant === 'danger' ? 'btn-danger btn-danger-filled' : 'btn-primary';

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) onCancel();
  };

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div
        ref={cardRef}
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="dialog-title">
          {title}
        </h3>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          {mode === 'unsaved' ? (
            <>
              <button type="button" className="btn-secondary" onClick={onCancel}>
                取消
              </button>
              <button type="button" className="btn-danger" onClick={onDiscard}>
                不保存
              </button>
              <button type="button" className="btn-primary" onClick={onSave}>
                保存并离开
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={onCancel}>
                {cancelLabel}
              </button>
              <button type="button" className={confirmClass} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
