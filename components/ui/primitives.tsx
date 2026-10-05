'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { c } from '../../lib/styles';
import { severity } from '../../lib/format';
export function Lede({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={c('lede')}>
      <div>
        <div className={c('eyebrow')}>{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className={c('actions')}>{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={c('panel', className)}>
      <div className={c('panel-head')}>
        <h2>{title}</h2>
        {aside && <div className={c('right')}>{aside}</div>}
      </div>
      <div className={c('panel-body')}>{children}</div>
    </div>
  );
}
export function Stat({ label, value, foot }: { label: string; value: ReactNode; foot: string }) {
  return (
    <div className={c('stat')}>
      <div className={c('eyebrow')}>{label}</div>
      <div className={c('v mono')}>{value}</div>
      <div className={c('f')}>{foot}</div>
    </div>
  );
}
export function Notice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={c('notice')}>
      <em>{label}</em>
      <span>{children}</span>
    </div>
  );
}
export function MockNotice() {
  return (
    <Notice label="Sample data">
      The backend is in mock mode. Sample map points and reports are illustrative; uploads and
      deletions are not persisted.
    </Notice>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className={c('empty')}>{children}</div>;
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={c('empty')} role="status">
      <span className={c('spinner')} aria-hidden="true" /> {label}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className={c('error-state')} role="alert">
      <p>{message}</p>
      {retry && (
        <button className={c('btn quiet')} onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function SeverityTag({ confidence }: { confidence: number }) {
  const band = severity(confidence);
  return <span className={c('tag', band)}>{band}</span>;
}
export function Dialog({
  open,
  onClose,
  children,
  label,
  drawer = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={c(drawer ? 'drawer dialog-drawer' : 'modal')}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
