import React from 'react'

/**
 * Card Component
 * Reusable surface container supporting default, flat, and interactive states.
 */
export default function Card({
  children,
  variant = 'default', // 'default' | 'flat' | 'interactive' | 'outline'
  padding = 'md',     // 'none' | 'sm' | 'md' | 'lg'
  as: Component = 'div',
  className = '',
  onClick,
  role,
  tabIndex,
  onKeyDown,
  ...rest
}) {
  const isInteractive = variant === 'interactive' || Boolean(onClick)
  const isButton = Component === 'button'

  const handleKeyDown = (e) => {
    if (onClick && !isButton && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick(e)
    }
    if (onKeyDown) onKeyDown(e)
  }

  const classes = [
    'wf-card',
    `wf-card-${variant}`,
    `wf-card-pad-${padding}`,
    isInteractive ? 'wf-card-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Component
      className={classes}
      onClick={onClick}
      role={isInteractive && !isButton ? role || 'button' : role}
      tabIndex={isInteractive && !isButton ? tabIndex ?? 0 : tabIndex}
      onKeyDown={isInteractive && !isButton ? handleKeyDown : onKeyDown}
      {...rest}
    >
      {children}
    </Component>
  )
}

