import React from 'react'
import { Loader2 } from 'lucide-react'

function renderIcon(Icon, size) {
  if (!Icon) return null
  if (React.isValidElement(Icon)) return Icon
  const Component = Icon
  return <Component size={size} />
}

/**
 * Button Component
 * Reusable action button with variants, sizes, loading state, and accessible semantics.
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'danger' | 'income' | 'warning'
  size = 'md',        // 'sm' | 'md' | 'lg'
  fullWidth = false,
  loading = false,
  disabled = false,
  icon: IconLeft,
  iconRight: IconRight,
  type = 'button',
  className = '',
  onClick,
  ...rest
}) {
  const isDisabled = disabled || loading
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16

  const classes = [
    'wf-btn',
    `wf-btn-${variant}`,
    `wf-btn-${size}`,
    fullWidth ? 'wf-btn-full' : '',
    loading ? 'wf-btn-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      onClick={isDisabled ? undefined : onClick}
      {...rest}
    >
      {loading ? (
        <Loader2 className="wf-btn-spinner" size={iconSize} />
      ) : IconLeft ? (
        <span className="wf-btn-icon-left">{renderIcon(IconLeft, iconSize)}</span>
      ) : null}

      <span className="wf-btn-content">{children}</span>

      {!loading && IconRight ? (
        <span className="wf-btn-icon-right">{renderIcon(IconRight, iconSize)}</span>
      ) : null}
    </button>
  )
}
