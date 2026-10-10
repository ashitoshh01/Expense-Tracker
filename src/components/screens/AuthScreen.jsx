import { useState } from 'react'
import {
  Wallet,
  ShieldCheck,
  Zap,
  TrendingUp,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  CalendarCheck,
} from 'lucide-react'
import { signInWithGoogle, signInAsGuest } from '../../services/auth'

export default function AuthScreen({ onSignInSuccess }) {
  const [loading, setLoading] = useState(null) // 'google' | 'guest' | null
  const [error, setError] = useState('')

  const handleGoogleSignIn = async () => {
    setError('')
    setLoading('google')
    try {
      const user = await signInWithGoogle()
      if (user && onSignInSuccess) {
        onSignInSuccess(user)
      }
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google sign-in failed. Please try again.')
      }
    } finally {
      setLoading(null)
    }
  }

  const handleGuestSignIn = async () => {
    setError('')
    setLoading('guest')
    try {
      const user = await signInAsGuest()
      if (user && onSignInSuccess) {
        onSignInSuccess(user)
      }
    } catch (err) {
      setError(err.message || 'Guest session initialization failed.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="auth-container" style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px 20px',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #09090b 60%, #000000 100%)',
      color: '#f8fafc',
      fontFamily: 'inherit',
    }}>
      <div style={{
        maxWidth: 440,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        {/* Brand Icon Header */}
        <div style={{
          position: 'relative',
          marginBottom: 24,
        }}>
          <div style={{
            position: 'absolute',
            inset: -12,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(236, 72, 153, 0.3))',
            borderRadius: '50%',
            filter: 'blur(20px)',
            opacity: 0.8,
          }} />
          <div style={{
            position: 'relative',
            width: 76,
            height: 76,
            borderRadius: 24,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(79, 70, 229, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}>
            <Wallet size={38} color="#ffffff" strokeWidth={2.2} />
          </div>
        </div>

        {/* Title & Tagline */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          margin: '0 0 8px 0',
          background: 'linear-gradient(to right, #ffffff, #c7d2fe)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Wallet FIX
        </h1>
        <p style={{
          fontSize: '0.95rem',
          color: '#94a3b8',
          margin: '0 0 28px 0',
          lineHeight: 1.5,
          maxWidth: 340,
        }}>
          Your intelligent financial control center with automated salary credits, strict precision, and isolated cloud sync.
        </p>

        {/* Feature Highlights Card */}
        <div style={{
          width: '100%',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 18,
          padding: '16px 18px',
          marginBottom: 28,
          backdropFilter: 'blur(12px)',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
              flexShrink: 0,
            }}>
              <CalendarCheck size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#e2e8f0' }}>Automated Recurring Incomes</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Scheduled monthly salary & income credits on exact dates</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              flexShrink: 0,
            }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#e2e8f0' }}>Bank-Grade Math Precision</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Paise integer math with zero floating-point rounding errors</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fbbf24',
              flexShrink: 0,
            }}>
              <Lock size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#e2e8f0' }}>UID-Scoped Privacy</div>
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Encrypted Firestore isolation per authenticated identity</div>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{
            width: '100%',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 20,
            color: '#f87171',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={Boolean(loading)}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 14,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.2s ease',
              opacity: loading && loading !== 'google' ? 0.6 : 1,
            }}
          >
            {loading === 'google' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{loading === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          {/* Continue as Guest */}
          <button
            onClick={handleGuestSignIn}
            disabled={Boolean(loading)}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 14,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#e2e8f0',
              fontSize: '0.92rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.2s ease',
              opacity: loading && loading !== 'guest' ? 0.6 : 1,
            }}
          >
            {loading === 'guest' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ShieldCheck size={18} color="#94a3b8" />
            )}
            <span>{loading === 'guest' ? 'Preparing Session...' : 'Continue as Guest (Local Session)'}</span>
          </button>
        </div>

        <p style={{
          fontSize: '0.75rem',
          color: '#64748b',
          marginTop: 20,
          lineHeight: 1.5,
        }}>
          Guest accounts can be securely linked to a Google account at any time in Settings without losing any local transactions or financial data.
        </p>
      </div>
    </div>
  )
}
