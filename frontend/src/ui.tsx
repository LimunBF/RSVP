import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type React from 'react';

export type Notice = { kind: 'error' | 'success'; text: string } | null;
export const EASE = [.16, 1, .3, 1] as const;

// Sidomukti-inspired floral diamond. Calmer wedding symbol than Truntum: prosperity and a good shared life.
export function Ornament({ className = '' }: { className?: string }) {
  return <svg className={`truntum-mark sidomukti-mark ${className}`} viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5 68 31 95 50 68 69 50 95 32 69 5 50 32 31Z"/><path d="M50 20c7 10 11 17 11 30S57 70 50 80c-7-10-11-17-11-30s4-20 11-30Z"/><path d="M20 50c10-7 17-11 30-11s20 4 30 11c-10 7-17 11-30 11s-20-4-30-11Z"/><circle cx="50" cy="50" r="7"/></svg>;
}

export function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`action-btn ${props.className || ''}`}>{props.children}</button>;
}

export function Alert({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p role="alert" className={`notice ${notice.kind}`}>
    {notice.kind === 'error' ? <AlertCircle size={16} aria-hidden="true"/> : <CheckCircle2 size={16} aria-hidden="true"/>}
    <span>{notice.text}</span>
  </p>;
}

export function Spinner({ label = 'Memuat...' }: { label?: string }) {
  return <div className="loading-state" role="status"><span aria-hidden="true"/>{label}</div>;
}

export function Field({ label, hint, error, children, wide = false }: { label: string; hint?: string; error?: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? 'wide' : ''}><span>{label}</span>{hint && <small className="field-hint">{hint}</small>}{children}{error && <small className="field-error" role="alert">{error}</small>}</label>;
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`app-card ${className}`}>{children}</section>;
}
