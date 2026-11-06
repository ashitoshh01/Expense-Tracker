import React, { useState } from 'react'
import { formatAmount } from '../../domain/money'

/**
 * Responsive Category Spending Donut Chart
 * Built with pure SVG paths, 100% React 19 and SSR compatible.
 *
 * @param {{
 *   data: Array<{ category: string, amount: number, percentage: number, color?: string }>,
 *   size?: number,
 *   privacyMasked?: boolean,
 *   className?: string
 * }} props
 */
export default function DonutChart({
  data = [],
  size = 240,
  privacyMasked = false,
  className = '',
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.42
  const innerR = size * 0.28

  const totalAmount = data.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const hasData = totalAmount > 0 && data.length > 0

  // Filter valid items with positive amounts
  const validItems = data.filter((item) => Number(item.amount) > 0)

  // Compute SVG arc slices
  let accumulatedAngle = -Math.PI / 2 // Start at 12 o'clock

  const slices = validItems.map((item, idx) => {
    const ratio = item.amount / totalAmount
    const angleSweep = ratio * 2 * Math.PI
    const startAngle = accumulatedAngle
    const endAngle = accumulatedAngle + angleSweep
    accumulatedAngle = endAngle

    const isLargeArc = angleSweep > Math.PI

    const x1Out = cx + outerR * Math.cos(startAngle)
    const y1Out = cy + outerR * Math.sin(startAngle)
    const x2Out = cx + outerR * Math.cos(endAngle)
    const y2Out = cy + outerR * Math.sin(endAngle)

    const x2In = cx + innerR * Math.cos(endAngle)
    const y2In = cy + innerR * Math.sin(endAngle)
    const x1In = cx + innerR * Math.cos(startAngle)
    const y1In = cy + innerR * Math.sin(startAngle)

    const pathData = [
      `M ${x1Out.toFixed(2)} ${y1Out.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${isLargeArc ? 1 : 0} 1 ${x2Out.toFixed(2)} ${y2Out.toFixed(2)}`,
      `L ${x2In.toFixed(2)} ${y2In.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${isLargeArc ? 1 : 0} 0 ${x1In.toFixed(2)} ${y1In.toFixed(2)}`,
      'Z',
    ].join(' ')

    return {
      ...item,
      pathData,
      color: item.color || '#6366F1',
    }
  })

  const activeItem = hoveredIdx !== null && validItems[hoveredIdx] ? validItems[hoveredIdx] : null

  return (
    <div className={`wf-donut-wrapper ${className}`}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="wf-donut-svg"
        role="img"
        aria-label="Category Spending Distribution Donut Chart"
      >
        <title>Category Spending Distribution</title>
        <desc>Donut chart visualizing relative share of spending by category.</desc>

        {/* Empty state ring */}
        {!hasData && (
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={(outerR + innerR) / 2}
              fill="none"
              stroke="var(--wf-border, #E2E8F0)"
              strokeWidth={outerR - innerR}
              strokeDasharray="4 4"
            />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill="var(--wf-text-muted, #64748B)"
            >
              Zero Spend
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              fontSize="10"
              fill="var(--wf-text-muted, #64748B)"
            >
              in selected period
            </text>
          </g>
        )}

        {/* Single slice special case (full 360 circle) */}
        {hasData && validItems.length === 1 && (
          <circle
            cx={cx}
            cy={cy}
            r={(outerR + innerR) / 2}
            fill="none"
            stroke={validItems[0].color || '#6366F1'}
            strokeWidth={outerR - innerR}
            role="graphics-symbol"
            aria-label={`${validItems[0].category}: 100%, ₹${formatAmount(validItems[0].amount)}`}
          />
        )}

        {/* Multi-slice Donut paths */}
        {hasData && validItems.length > 1 && (
          <g className="wf-donut-slices">
            {slices.map((slice, idx) => {
              const isHovered = hoveredIdx === idx
              return (
                <path
                  key={slice.category}
                  d={slice.pathData}
                  fill={slice.color}
                  stroke="var(--wf-surface, #FFFFFF)"
                  strokeWidth="2"
                  className="wf-donut-slice"
                  style={{
                    cursor: 'pointer',
                    transformOrigin: `${cx}px ${cy}px`,
                    transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                    transition: 'transform 0.15s ease, opacity 0.15s ease',
                    opacity: hoveredIdx !== null && !isHovered ? 0.65 : 1,
                  }}
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={`${slice.category}: ${slice.percentage}%, ₹${formatAmount(slice.amount)}`}
                  onPointerEnter={() => setHoveredIdx(idx)}
                  onPointerLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(idx)}
                  onBlur={() => setHoveredIdx(null)}
                />
              )
            })}
          </g>
        )}

        {/* Center Text (Total or Active Hovered Category) */}
        {hasData && (
          <g className="wf-donut-center" aria-hidden="true">
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--wf-text-muted, #64748B)"
            >
              {activeItem ? activeItem.category : 'Total Spent'}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fontSize="15"
              fontWeight="800"
              fill="var(--wf-text-primary, #0F172A)"
            >
              {privacyMasked
                ? '••••••'
                : activeItem
                ? `₹${formatAmount(activeItem.amount)}`
                : `₹${formatAmount(totalAmount)}`}
            </text>
            {activeItem && (
              <text
                x={cx}
                y={cy + 26}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={activeItem.color || 'var(--wf-brand-600, #4F46E5)'}
              >
                {`${activeItem.percentage}%`}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  )
}

