import { useState } from 'react'
import { Smartphone, Download } from 'lucide-react'

export default function InstallAppSheet({ installPrompt, isInstalled, onClose, onInstallSuccess }) {
  const [installing, setInstalling] = useState(false)

  const handleInstallClick = async () => {
    if (installPrompt) {
      setInstalling(true)
      try {
        installPrompt.prompt()
        const choiceResult = await installPrompt.userChoice
        if (choiceResult && choiceResult.outcome === 'accepted') {
          onInstallSuccess()
        }
      } catch (err) {
        console.error('Install prompt error:', err)
      } finally {
        setInstalling(false)
        onClose()
      }
    }
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Smartphone size={24} />
        App Shortcut & Icon
      </div>

      <div className="install-sheet-content">
        <div className="install-app-preview">
          <img src="/apple-touch-icon.png" alt="Wallet FIX App Icon" className="install-preview-img" />
          <div className="install-preview-name">Wallet FIX</div>
          <div className="install-preview-tag">Web Application</div>
        </div>

        <p className="install-sheet-desc">
          Add Wallet FIX to your Home screen or desktop. It runs offline as a standalone shortcut displaying this custom 3D wallet application icon!
        </p>

        {installPrompt ? (
          <button
            className="btn-submit indigo"
            onClick={handleInstallClick}
            disabled={installing}
            style={{ marginBottom: '16px' }}
            type="button"
          >
            <Download size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            {installing ? 'Installing...' : 'Add Shortcut to Device'}
          </button>
        ) : isInstalled ? (
          <div className="install-info-box success" style={{ marginBottom: '16px' }}>
            ✓ Application shortcut is active on this device!
          </div>
        ) : (
          <div className="install-instructions">
            <div className="install-step">
              <span className="step-num">1</span>
              <div>
                <strong>Safari / iOS:</strong> Tap the <strong>Share</strong> button (box with arrow) at the bottom, scroll down and tap <strong>"Add to Home Screen"</strong>.
              </div>
            </div>
            <div className="install-step">
              <span className="step-num">2</span>
              <div>
                <strong>Chrome / Android:</strong> Tap the <strong>three dots menu (⋮)</strong> and tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
              </div>
            </div>
            <div className="install-step">
              <span className="step-num">3</span>
              <div>
                <strong>Desktop:</strong> Look for the <strong>Install icon</strong> in your browser's address bar to install as a desktop shortcut.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
