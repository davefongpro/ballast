import React from 'react';

/* Primitive components. Every one is a thin wrapper over a class in
   `src/styles/base.css` — no inline colour, size or spacing values live here.
   Behaviour is deliberately minimal: these carry appearance, not logic. */

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const classes = [
    'btn',
    variant !== 'default' ? `btn--${variant}` : '',
    size !== 'md' ? `btn--${size}` : '',
    className,
  ].filter(Boolean).join(' ');
  return <button type="button" className={classes} {...rest} />;
}

export function Chip({
  pressed,
  dotColor,
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean; dotColor?: string }) {
  return (
    <button type="button" className={`chip ${className}`} aria-pressed={pressed} {...rest}>
      {dotColor && <span className="chip__dot" style={{ background: dotColor }} />}
      {children}
    </button>
  );
}

export function Card({
  title,
  actions,
  flush,
  children,
  className = '',
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card__head">
          <h3 className="card__title">{title}</h3>
          {actions && <div className="toolbar__group">{actions}</div>}
        </header>
      )}
      <div className={`card__body${flush ? ' card__body--flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Toolbar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`toolbar ${className}`}>{children}</div>;
}

export function ToolbarGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="toolbar__group">
      {label && <span className="toolbar__label">{label}</span>}
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  id,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
  onDismiss,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'ok';
  title?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--s-3)' }}>
        <div style={{ minWidth: 0 }}>
          {title && <div className="notice__title">{title}</div>}
          {children}
        </div>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} aria-label="Dismiss">×</Button>
        )}
      </div>
    </div>
  );
}

/**
 * A section that starts collapsed on a phone and open on a larger screen.
 *
 * The controls above a chart are worth having in view on a desktop and are pure
 * obstruction on a phone, where they push the chart itself entirely below the
 * fold. Defaulting by width means neither screen pays for the other's needs.
 */
export function Collapsible({
  summary,
  children,
  className = '',
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  return (
    <details className={`collapsible ${className}`} open={open} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="collapsible__summary">{summary}</summary>
      <div className="collapsible__body">{children}</div>
    </details>
  );
}

/** Accessible modal shell: labelled dialog, Escape to close, backdrop click to close. */
export function Modal({
  title,
  onClose,
  footer,
  width,
  centreTitle,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  width?: number;
  /** Centre the title and let it wrap — for a dialog named after user content,
   *  where a long name would otherwise run under the close button. */
  centreTitle?: boolean;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        <header className={`modal__head${centreTitle ? ' modal__head--centred' : ''}`}>
          <h2 className="modal__title">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">×</Button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}
