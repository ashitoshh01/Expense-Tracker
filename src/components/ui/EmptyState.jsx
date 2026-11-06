import React from 'react'

function renderIcon(Icon, size = 32) {
  if (!Icon) return null
  if (React.isValidElement(Icon)) return Icon
  const Component = Icon
  return <Component size={size} />
}

/**
 * EmptyState Component
 * Standardized empty / zero-data placeholder with icon, message, and call-to-action.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`wf-empty-state ${className}`}>
      {Icon && (
        <div className="wf-empty-state-icon" aria-hidden="true">
          {renderIcon(Icon, 32)}
        </div>
      )}
      {title && <h3 className="wf-empty-state-title">{title}</h3>}
      {description && <p className="wf-empty-state-desc">{description}</p>}
      {action && <div className="wf-empty-state-action">{action}</div>}
    </div>
  )
}
