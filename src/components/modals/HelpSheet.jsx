import { HelpCircle, ShieldCheck, PiggyBank, Landmark, Cloud, Smartphone } from 'lucide-react'

export default function HelpSheet({ onClose }) {
  const faqs = [
    {
      icon: ShieldCheck,
      q: 'How is my financial data protected?',
      a: 'Wallet FIX uses secure Firebase Authentication and per-user Cloud Firestore isolation. Your transactions, loans, and balances can only be accessed by your authenticated session.',
    },
    {
      icon: Cloud,
      q: 'Does Wallet FIX work offline?',
      a: 'Yes! All financial changes are immediately saved to your device. When you are offline, operations are safely queued and automatically synchronized once reconnected.',
    },
    {
      icon: Landmark,
      q: 'How do loans and repayments work?',
      a: 'You can track money you borrowed or lent to friends. When you make a repayment, available cash is deducted, debt is decreased, and a permanent ledger entry is recorded.',
    },
    {
      icon: PiggyBank,
      q: 'How does automated salary & savings work?',
      a: 'On your scheduled salary day, Wallet FIX automatically credits your configured salary and moves your chosen auto-save amount into your savings.',
    },
  ]

  return (
    <div className="bottom-sheet active" style={{ maxHeight: '85dvh' }}>
      <div className="sheet-handle" />
      <div className="sheet-title">
        <HelpCircle size={24} />
        Help & Support
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        {faqs.map((faq, idx) => {
          const Icon = faq.icon
          return (
            <div
              key={idx}
              style={{
                background: 'var(--bg)',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--text-primary)' }}>
                <Icon size={16} color="var(--accent)" />
                {faq.q}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {faq.a}
              </div>
            </div>
          )
        })}
      </div>

      <button className="btn-submit indigo" onClick={onClose} type="button">
        Close Help
      </button>
    </div>
  )
}
