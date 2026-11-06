import React from 'react'

/**
 * SectionHeader Component
 * Consistent header for sections, cards, and screen content with optional action element.
 */
export default function SectionHeader({
  title,
  description,
  action,
  className = '',
  level = 2, // 1 | 2 | 3
}) {
  const HeadingTag = level === 1 ? 'h1' : level === 3 ? 'h3' : 'h2'

  return (
    <div className={`wf-section-header ${className}`}>
      <div className="wf-section-header-text">
        <HeadingTag className="wf-section-title">{title}</HeadingTag>
        {description && <p className="wf-section-desc">{description}</p>}
      </div>
      {action && <div className="wf-section-action">{action}</div>}
    </div>
  )
}

