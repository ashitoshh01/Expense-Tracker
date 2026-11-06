import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import BarChart from '../BarChart'
import DonutChart from '../DonutChart'
import CashflowChart from '../CashflowChart'

describe('Component: Custom SVG Charts (charts.test.jsx)', () => {
  const sampleMonthlyData = [
    { yearMonth: '2026-06', label: 'Jun', income: 40000, expenses: 25000, netCashflow: 15000 },
    { yearMonth: '2026-07', label: 'Jul', income: 42000, expenses: 45000, netCashflow: -3000 },
    { yearMonth: '2026-08', label: 'Aug', income: 50000, expenses: 30000, netCashflow: 20000 },
  ]

  const sampleCategoryData = [
    { category: 'Outside Food', amount: 6500, percentage: 55, color: '#F59E0B' },
    { category: 'Shopping', amount: 3500, percentage: 30, color: '#EC4899' },
    { category: 'Travel', amount: 1800, percentage: 15, color: '#8B5CF6' },
  ]

  describe('BarChart', () => {
    it('renders valid SVG with accessibility tags and data bars in SSR', () => {
      const html = renderToString(<BarChart data={sampleMonthlyData} />)
      expect(html).toContain('<svg')
      expect(html).toContain('Monthly Income vs Expenses Bar Chart')
      expect(html).toContain('Jun')
      expect(html).toContain('Jul')
      expect(html).toContain('Aug')
      expect(html).toContain('rect')
    })

    it('renders empty-state message when data has zero income and expenses', () => {
      const emptyData = [
        { yearMonth: '2026-06', label: 'Jun', income: 0, expenses: 0, netCashflow: 0 },
      ]
      const html = renderToString(<BarChart data={emptyData} />)
      expect(html).toContain('No transactions recorded in this period')
    })

    it('masks monetary values when privacyMasked is true', () => {
      const html = renderToString(<BarChart data={sampleMonthlyData} privacyMasked />)
      expect(html).toContain('•••')
    })
  })

  describe('DonutChart', () => {
    it('renders SVG paths for category distribution slices', () => {
      const html = renderToString(<DonutChart data={sampleCategoryData} />)
      expect(html).toContain('<svg')
      expect(html).toContain('Category Spending Distribution Donut Chart')
      expect(html).toContain('path')
      expect(html).toContain('Total Spent')
    })

    it('handles single category full-circle case without crashing', () => {
      const singleCat = [{ category: 'Food', amount: 1000, percentage: 100, color: '#F59E0B' }]
      const html = renderToString(<DonutChart data={singleCat} />)
      expect(html).toContain('<svg')
      expect(html).toContain('circle')
    })

    it('renders graceful zero spend message when total spend is 0', () => {
      const html = renderToString(<DonutChart data={[]} />)
      expect(html).toContain('Zero Spend')
    })

    it('masks central monetary display when privacyMasked is true', () => {
      const html = renderToString(<DonutChart data={sampleCategoryData} privacyMasked />)
      expect(html).toContain('••••••')
    })
  })

  describe('CashflowChart', () => {
    it('renders zero baseline and surplus/deficit bars accurately', () => {
      const html = renderToString(<CashflowChart data={sampleMonthlyData} />)
      expect(html).toContain('<svg')
      expect(html).toContain('Monthly Net Cashflow Chart')
      expect(html).toContain('₹0') // Zero baseline label
      expect(html).toContain('Cashflow Surplus')
      expect(html).toContain('Cashflow Deficit')
    })

    it('renders zero cashflow text when all net cashflows are 0', () => {
      const zeroData = [
        { yearMonth: '2026-06', label: 'Jun', netCashflow: 0 },
      ]
      const html = renderToString(<CashflowChart data={zeroData} />)
      expect(html).toContain('Zero net cashflow recorded')
    })
  })
})

