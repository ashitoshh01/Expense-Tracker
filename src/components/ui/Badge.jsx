import React from 'react'

function renderIcon(Icon, size) {
  if (!Icon) return null
  if (React.isValidElement(Icon)) return Icon
  const Component = Icon
  return <Component size={size} />
}

/**
 * Badge Component
 * Semantic status indicator for transaction types, sync status, and categories.
 */
export default function Badge({
  children,
  variant = 'neutral', // 'neutral' | 'brand' | 'income' | 'expense' | 'warning' | 'info'
  size = 'md',        // 'sm' | 'md'
  dot = false,
  icon: Icon,
  className = '',
  ...rest
}) {
  const iconSize = size === 'sm' ? 11 : 13

  const classes = [
    'wf-badge',
    `wf-badge-${variant}`,
    `wf-badge-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} {...rest}>
      {dot && <span className="wf-badge-dot" aria-hidden="true" />}
      {Icon && (
        <span className="wf-badge-icon" aria-hidden="true">
          {renderIcon(Icon, iconSize)}
        </span>
      )}
      <span className="wf-badge-text">{children}</span>
    </span>
  )
}
