import React from 'react'

/**
 * Skeleton Component
 * Loading placeholder with animated shimmer pulse.
 */
export default function Skeleton({
  variant = 'rectangular', // 'text' | 'circular' | 'rectangular'
  width,
  height,
  count = 1,
  className = '',
  style = {},
  ...rest
}) {
  const inlineStyles = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...style,
  }

  const classes = [
    'wf-skeleton',
    `wf-skeleton-${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (count > 1) {
    return (
      <div className="wf-skeleton-stack" aria-hidden="true" role="status">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={classes}
            style={inlineStyles}
            {...rest}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={classes}
      style={inlineStyles}
      aria-hidden="true"
      role="status"
      {...rest}
    />
  )
}

