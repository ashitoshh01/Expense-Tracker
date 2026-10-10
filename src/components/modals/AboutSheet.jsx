import { Info, Shield, CheckCircle, ExternalLink } from 'lucide-react'

export default function AboutSheet({ onClose }) {
  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Info size={24} />
        About Wallet FIX
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <img
          src="/apple-touch-icon.png"
          alt="Wallet FIX Logo"
          style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 12, boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)' }}
        />
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Wallet FIX</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Version 2.0.0 (Enterprise Financial Edition)</div>
      </div>

      <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)', marginBottom: 20 }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <CheckCircle size={15} color="#10B981" />
            <strong>Zero-Loss Accounting:</strong> Minor-unit paise integer precision.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <CheckCircle size={15} color="#10B981" />
            <strong>Isolated Security:</strong> Dedicated UID-based Firebase storage.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <CheckCircle size={15} color="#10B981" />
            <strong>Offline Resilience:</strong> Service worker caching & durable sync queue.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={15} color="#10B981" />
            <strong>Auditable Ledger:</strong> Safe reversals and partial loan repayments.
          </div>
        </div>
      </div>

      <button className="btn-submit indigo" onClick={onClose} type="button">
        Got it
      </button>
    </div>
  )
}
