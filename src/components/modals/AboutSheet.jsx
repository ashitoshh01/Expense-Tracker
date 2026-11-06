import { Info, CheckCircle } from 'lucide-react'
import { Modal, Card, Button } from '../ui'

export default function AboutSheet({ onClose }) {
  return (
    <Modal title="About Wallet FIX" icon={Info} onClose={onClose}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <img
          src="/apple-touch-icon.png"
          alt="Wallet FIX Logo"
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            marginBottom: 12,
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
          }}
        />
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--wf-text-primary)' }}>
          Wallet FIX
        </div>
        <div style={{ fontSize: 13, color: 'var(--wf-text-muted)' }}>
          Version 2.0.0 (Enterprise Financial Edition)
        </div>
      </div>

      <Card variant="flat" padding="md" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--wf-text-secondary)' }}>
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
      </Card>

      <Button variant="primary" size="lg" fullWidth onClick={onClose}>
        Got it
      </Button>
    </Modal>
  )
}
