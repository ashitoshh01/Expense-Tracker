import React, { useState } from 'react'
import { formatAmount } from '../../domain/money'

/**
 * Responsive Grouped Bar Chart (Income vs Expenses)
 * Built with pure SVG, 100% React 19 and SSR compatible.
 *
 * @param {{
 *   data: Array<{ label: string, fullLabel?: string, income: number, expenses: number }>,
 *   height?: number,
 *   privacyMasked?: boolean,
 *   className?: string
 * }} props
 */
export default function BarChart({
  data = [],
  height = 220,
  privacyMasked = false,
  className = '',
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const width = 500
  const padLeft = 45
  const padRight = 15
  const padTop = 25
  const padBottom = 35

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  // Find maximum value across income and expenses for Y-axis scaling
  let maxVal = 1000
  for (const item of data) {
    if (item.income > maxVal) maxVal = item.income
    if (item.expenses > maxVal) maxVal = item.expenses
  }
  // Round up to clean ceiling
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)))
  const normalizedMax = Math.ceil(maxVal / magnitude) * magnitude

  const n = data.length || 1
  const slotW = chartW / n
  const groupW = Math.min(slotW * 0.7, 36)
  const barW = (groupW - 4) / 2

  const hasData = data.some((d) => d.income > 0 || d.expenses > 0)

  // 3 horizontal reference gridlines
  const gridLevels = [0, normalizedMax / 2, normalizedMax]

  return (
    <div className={`wf-chart-container ${className}`}>
      <div className="wf-chart-legend" aria-hidden="true">
        <div className="wf-chart-legend-item">
          <span className="wf-legend-dot income" />
          <span>Income</span>
        </div>
        <div className="wf-chart-legend-item">
          <span className="wf-legend-dot expense" />
          <span>Expenses</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="wf-svg-chart"
        role="img"
        aria-label="Monthly Income vs Expenses Bar Chart"
      >
        <title>Monthly Income vs Expenses Trend</title>
        <desc>
          Grouped bar chart showing monthly income and expenses across recent months.
        </desc>

        {/* Y-Axis Gridlines & Labels */}
        {gridLevels.map((lvl, idx) => {
          const y = padTop + chartH - (lvl / normalizedMax) * chartH
          const formatted = lvl >= 100000 ? `${(lvl / 100000).toFixed(1)}L` : lvl >= 1000 ? `${Math.round(lvl / 1000)}k` : `${lvl}`
          return (
            <g key={idx} className="wf-grid-row">
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--wf-border, #E2E8F0)"
                strokeDasharray={idx > 0 ? '3 3' : 'none'}
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--wf-text-muted, #64748B)"
              >
                {privacyMasked ? '•••' : `₹${formatted}`}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const slotCenter = padLeft + idx * slotW + slotW / 2
          const xIncome = slotCenter - groupW / 2
          const xExpense = xIncome + barW + 4

          const incomeH = normalizedMax > 0 ? (item.income / normalizedMax) * chartH : 0
          const expenseH = normalizedMax > 0 ? (item.expenses / normalizedMax) * chartH : 0

          const yIncome = padTop + chartH - incomeH
          const yExpense = padTop + chartH - expenseH

          const isHovered = hoveredIdx === idx

          return (
            <g
              key={item.yearMonth || idx}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`${item.fullLabel || item.label}: Income ₹${formatAmount(item.income)}, Expenses ₹${formatAmount(item.expenses)}`}
              onPointerEnter={() => setHoveredIdx(idx)}
              onPointerLeave={() => setHoveredIdx(null)}
              onFocus={() => setHoveredIdx(idx)}
              onBlur={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {/* Invisible touch/hover target */}
              <rect
                x={padLeft + idx * slotW}
                y={padTop}
                width={slotW}
                height={chartH}
                fill="transparent"
              />

              {/* Hover Highlight Column */}
              {isHovered && (
                <rect
                  x={padLeft + idx * slotW + 2}
                  y={padTop}
                  width={slotW - 4}
                  height={chartH}
                  fill="var(--wf-brand-50, rgba(99, 102, 241, 0.08))"
                  rx="4"
                />
              )}

              {/* Income Bar */}
              {item.income > 0 && (
                <rect
                  x={xIncome}
                  y={yIncome}
                  width={barW}
                  height={Math.max(incomeH, 2)}
                  fill="var(--wf-income-500, #22C55E)"
                  rx="3"
                  className="wf-bar"
                  opacity={hoveredIdx !== null && !isHovered ? 0.6 : 1}
                />
              )}

              {/* Expense Bar */}
              {item.expenses > 0 && (
                <rect
                  x={xExpense}
                  y={yExpense}
                  width={barW}
                  height={Math.max(expenseH, 2)}
                  fill="var(--wf-expense-500, #EF4444)"
                  rx="3"
                  className="wf-bar"
                  opacity={hoveredIdx !== null && !isHovered ? 0.6 : 1}
                />
              )}

              {/* X-Axis Month Label */}
              <text
                x={slotCenter}
                y={height - 12}
                textAnchor="middle"
                fontSize="11"
                fontWeight={isHovered ? '700' : '500'}
                fill={isHovered ? 'var(--wf-brand-600, #4F46E5)' : 'var(--wf-text-secondary, #475569)'}
              >
                {item.label}
              </text>
            </g>
          )
        })}

        {/* Empty state overlay if zero activity */}
        {!hasData && (
          <text
            x={width / 2}
            y={padTop + chartH / 2}
            textAnchor="middle"
            fontSize="12"
            fill="var(--wf-text-muted, #64748B)"
          >
            No transactions recorded in this period
          </text>
        )}
      </svg>

      {/* Interactive Tooltip Summary */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="wf-chart-tooltip" role="tooltip" aria-live="polite">
          <span className="wf-tooltip-title">
            {data[hoveredIdx].fullLabel || data[hoveredIdx].label}
          </span>
          <div className="wf-tooltip-row">
            <span className="wf-tooltip-label">Income:</span>
            <span className="wf-tooltip-val income">
              {privacyMasked ? '••••••' : `+₹${formatAmount(data[hoveredIdx].income)}`}
            </span>
          </div>
          <div className="wf-tooltip-row">
            <span className="wf-tooltip-label">Expenses:</span>
            <span className="wf-tooltip-val expense">
              {privacyMasked ? '••••••' : `-₹${formatAmount(data[hoveredIdx].expenses)}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

