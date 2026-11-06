import React, { useState } from 'react'
import { formatAmount } from '../../domain/money'

/**
 * Responsive Net Cashflow Chart (Surplus vs Deficit)
 * Renders positive values upwards and negative values downwards from a zero baseline.
 * Built with pure SVG, 100% React 19 and SSR compatible.
 *
 * @param {{
 *   data: Array<{ label: string, fullLabel?: string, netCashflow: number }>,
 *   height?: number,
 *   privacyMasked?: boolean,
 *   className?: string
 * }} props
 */
export default function CashflowChart({
  data = [],
  height = 200,
  privacyMasked = false,
  className = '',
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const width = 500
  const padLeft = 45
  const padRight = 15
  const padTop = 20
  const padBottom = 30

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  // Find max absolute cashflow for symmetric zero-baseline scaling
  let maxAbs = 1000
  for (const item of data) {
    const abs = Math.abs(Number(item.netCashflow) || 0)
    if (abs > maxAbs) maxAbs = abs
  }

  // Clean rounding
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxAbs)))
  const normalizedMax = Math.ceil(maxAbs / magnitude) * magnitude

  const zeroY = padTop + chartH / 2
  const halfH = chartH / 2

  const n = data.length || 1
  const slotW = chartW / n
  const barW = Math.min(slotW * 0.45, 24)

  const hasData = data.some((d) => d.netCashflow !== 0)

  return (
    <div className={`wf-chart-container ${className}`}>
      <div className="wf-chart-legend" aria-hidden="true">
        <div className="wf-chart-legend-item">
          <span className="wf-legend-dot income" />
          <span>Cashflow Surplus</span>
        </div>
        <div className="wf-chart-legend-item">
          <span className="wf-legend-dot expense" />
          <span>Cashflow Deficit</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="wf-svg-chart"
        role="img"
        aria-label="Monthly Net Cashflow Chart"
      >
        <title>Monthly Net Cashflow Trend</title>
        <desc>
          Cashflow chart showing monthly surplus (positive) and deficit (negative) around a zero baseline.
        </desc>

        {/* Positive Gridline */}
        <line
          x1={padLeft}
          y1={padTop}
          x2={width - padRight}
          y2={padTop}
          stroke="var(--wf-border, #E2E8F0)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <text
          x={padLeft - 6}
          y={padTop + 3}
          textAnchor="end"
          fontSize="10"
          fill="var(--wf-income-600, #16A34A)"
        >
          {privacyMasked ? '•••' : `+₹${normalizedMax >= 1000 ? `${Math.round(normalizedMax / 1000)}k` : normalizedMax}`}
        </text>

        {/* Zero Baseline */}
        <line
          x1={padLeft}
          y1={zeroY}
          x2={width - padRight}
          y2={zeroY}
          stroke="var(--wf-text-muted, #64748B)"
          strokeWidth="1.5"
        />
        <text
          x={padLeft - 6}
          y={zeroY + 3}
          textAnchor="end"
          fontSize="10"
          fontWeight="600"
          fill="var(--wf-text-muted, #64748B)"
        >
          ₹0
        </text>

        {/* Negative Gridline */}
        <line
          x1={padLeft}
          y1={padTop + chartH}
          x2={width - padRight}
          y2={padTop + chartH}
          stroke="var(--wf-border, #E2E8F0)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <text
          x={padLeft - 6}
          y={padTop + chartH + 3}
          textAnchor="end"
          fontSize="10"
          fill="var(--wf-expense-600, #DC2626)"
        >
          {privacyMasked ? '•••' : `-₹${normalizedMax >= 1000 ? `${Math.round(normalizedMax / 1000)}k` : normalizedMax}`}
        </text>

        {/* Cashflow Bars */}
        {data.map((item, idx) => {
          const val = Number(item.netCashflow) || 0
          const slotCenter = padLeft + idx * slotW + slotW / 2
          const x = slotCenter - barW / 2

          const isPositive = val >= 0
          const barH = normalizedMax > 0 ? (Math.abs(val) / normalizedMax) * halfH : 0
          const y = isPositive ? zeroY - barH : zeroY

          const isHovered = hoveredIdx === idx

          return (
            <g
              key={item.yearMonth || idx}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`${item.fullLabel || item.label}: Net Cashflow ${val >= 0 ? '+' : '-'}₹${formatAmount(Math.abs(val))}`}
              onPointerEnter={() => setHoveredIdx(idx)}
              onPointerLeave={() => setHoveredIdx(null)}
              onFocus={() => setHoveredIdx(idx)}
              onBlur={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {/* Touch & hover backdrop */}
              <rect
                x={padLeft + idx * slotW}
                y={padTop}
                width={slotW}
                height={chartH}
                fill="transparent"
              />

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

              {/* Cashflow Bar */}
              {val !== 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(barH, 2)}
                  fill={isPositive ? 'var(--wf-income-500, #22C55E)' : 'var(--wf-expense-500, #EF4444)'}
                  rx="3"
                  className="wf-bar"
                  opacity={hoveredIdx !== null && !isHovered ? 0.6 : 1}
                />
              )}

              {/* Month Label */}
              <text
                x={slotCenter}
                y={height - 8}
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

        {!hasData && (
          <text
            x={width / 2}
            y={zeroY - 14}
            textAnchor="middle"
            fontSize="12"
            fill="var(--wf-text-muted, #64748B)"
          >
            Zero net cashflow recorded
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
            <span className="wf-tooltip-label">Net Cashflow:</span>
            <span
              className={`wf-tooltip-val ${
                data[hoveredIdx].netCashflow >= 0 ? 'income' : 'expense'
              }`}
            >
              {privacyMasked
                ? '••••••'
                : `${data[hoveredIdx].netCashflow >= 0 ? '+' : '-'}₹${formatAmount(
                    Math.abs(data[hoveredIdx].netCashflow)
                  )}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

