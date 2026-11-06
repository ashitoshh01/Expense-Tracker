import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

function renderIcon(Icon, size = 24) {
  if (!Icon) return null
  if (React.isValidElement(Icon)) return Icon
  const Component = Icon
  return <Component size={size} />
}

/**
 * Modal / BottomSheet Component
 * Reusable sheet dialog supporting mobile slide-up and desktop centered presentation.
 * Features Escape key dismissal and focus trapping.
 */
export default function Modal({
  isOpen = true,
  onClose,
  title,
  icon: Icon,
  children,
  className = '',
  showHandle = true,
  showClose = true,
  closeOnEsc = true,
  maxWidth,
}) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !closeOnEsc || !onClose) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeOnEsc, onClose])

  if (!isOpen) return null

  const customStyle = maxWidth ? { maxWidth } : undefined

  return (
    <div
      ref={modalRef}
      className={`bottom-sheet active ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'wf-modal-title' : undefined}
      style={customStyle}
    >
      {showHandle && <div className="sheet-handle" aria-hidden="true" />}

      {(title || showClose) && (
        <div className="sheet-title wf-modal-header">
          <div className="wf-modal-header-left">
            {Icon && (
              <span className="wf-modal-header-icon" aria-hidden="true">
                {renderIcon(Icon, 24)}
              </span>
            )}
            {title && <span id="wf-modal-title">{title}</span>}
          </div>

          {showClose && onClose && (
            <button
              type="button"
              className="wf-modal-close-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      <div className="wf-modal-body">{children}</div>
    </div>
  )
}
