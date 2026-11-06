import React, { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Percent,
  Calendar,
  Filter,
  Eye,
  EyeOff,
  BarChart3,
  PieChart,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Info,
  Target,
  Sparkles,
} from 'lucide-react'
import { formatAmount } from '../../domain/money'
import {
  DATE_PRESETS,
  DATE_PRESET_OPTIONS,
  resolveDateRange,
} from '../../domain/dateRange'
import {
  calculateAnalyticsOverview,
  calculateCategoryBreakdown,
  calculateMonthlyTrends,
  calculateIncomeBreakdown,
  calculateSafeDelta,
  generateFinancialInsights,
} from '../../domain/analytics'
import { BarChart, DonutChart, CashflowChart } from '../charts'
import { Card, Badge, SectionHeader, EmptyState, Button } from '../ui'

export default function AnalyticsScreen({
  transactions = [],
  state = {},
  onNavigate,
}) {
  const [selectedPreset, setSelectedPreset] = useState(DATE_PRESETS.THIS_MONTH)
  const [trendView, setTrendView] = useState('bars') // 'bars' | 'cashflow'

  // Persistent privacy masking matching Dashboard and Savings screens
  const [showBalance, setShowBalance] = useState(() => {
    try {
      return localStorage.getItem('wf_show_balance') !== 'false'
    } catch {
      return true
    }
  })

  const toggleShowBalance = () => {
    setShowBalance((prev) => {
      const next = !prev
      try {
        localStorage.setItem('wf_show_balance', String(next))
      } catch {}
      return next
    })
  }

  // Resolve current active date range and previous comparison baseline
  const activeRange = useMemo(
    () => resolveDateRange(selectedPreset, new Date()),
    [selectedPreset]
  )

  const prevRange = useMemo(() => {
    if (!activeRange.prevStartDate || !activeRange.prevEndDate) return null
    return {
      startDate: activeRange.prevStartDate,
      endDate: activeRange.prevEndDate,
    }
  }, [activeRange])

  // Overview metrics for current and previous period
  const overview = useMemo(
    () => calculateAnalyticsOverview(transactions, activeRange),
    [transactions, activeRange]
  )

  const prevOverview = useMemo(() => {
    if (!prevRange) return null
    return calculateAnalyticsOverview(transactions, prevRange)
  }, [transactions, prevRange])

  // Period comparison deltas
  const incomeDelta = useMemo(() => {
    if (!prevOverview) return null
    return calculateSafeDelta(overview.totalIncome, prevOverview.totalIncome)
  }, [overview.totalIncome, prevOverview])

  const expensesDelta = useMemo(() => {
    if (!prevOverview) return null
    return calculateSafeDelta(overview.totalExpenses, prevOverview.totalExpenses)
  }, [overview.totalExpenses, prevOverview])

  // Category spending breakdown
  const categorySpending = useMemo(
    () => calculateCategoryBreakdown(transactions, activeRange),
    [transactions, activeRange]
  )

  // 6-Month time series trends for bar / cashflow charts
  const monthlyTrends = useMemo(
    () => calculateMonthlyTrends(transactions, 6, new Date()),
    [transactions]
  )

  // Income source analysis
  const incomeComposition = useMemo(
    () => calculateIncomeBreakdown(transactions, activeRange, state),
    [transactions, activeRange, state]
  )

  // Deterministic factual insights
  const financialInsights = useMemo(
    () => generateFinancialInsights(overview, categorySpending, state, prevOverview),
    [overview, categorySpending, state, prevOverview]
  )

  const hasAnyTransactions = Array.isArray(transactions) && transactions.length > 0
  const hasRangeTransactions = overview.transactionCount > 0

  return (
    <div className="screen wf-analytics-screen">
      {/* ── Screen Header ── */}
      <header className="wf-analytics-header">
        <div className="wf-analytics-header-left">
          <div className="wf-analytics-title-row">
            <h1 className="wf-analytics-title">Analytics</h1>
            <button
              type="button"
              className="wf-hero-eye-btn"
              onClick={toggleShowBalance}
              aria-label={showBalance ? 'Hide amounts' : 'Show amounts'}
              title={showBalance ? 'Hide amounts' : 'Show amounts'}
            >
              {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showBalance ? 'Hide' : 'Show'}</span>
            </button>
          </div>
          <span className="wf-analytics-subtitle">
            Understand your income, spending patterns, and cashflow.
          </span>
        </div>
      </header>

      {/* ── Date Range Preset Selector ── */}
      <section className="wf-analytics-controls" aria-label="Select date range">
        <div className="wf-analytics-presets" role="tablist" aria-label="Date range presets">
          {DATE_PRESET_OPTIONS.map((opt) => {
            const isSelected = selectedPreset === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`wf-preset-pill ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedPreset(opt.id)}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </section>

      {!hasAnyTransactions ? (
        <EmptyState
          icon={BarChart3}
          title="No financial data recorded yet"
          description="Start tracking your expenses and income to view visual breakdowns and monthly trends."
          action={
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate?.('transactions')}
            >
              Go to Transactions
            </Button>
          }
        />
      ) : (
        <>
          {/* ── KPI Overview Grid (4 Cards) ── */}
          <section className="wf-analytics-overview-grid" aria-label="Key Performance Indicators">
            {/* Total Income */}
            <div className="wf-stat-card">
              <div className="wf-stat-top">
                <span className="wf-stat-label">Total Income</span>
                <div className="wf-stat-icon-wrap income" aria-hidden="true">
                  <ArrowDownLeft size={16} />
                </div>
              </div>
              <div className="wf-stat-value">
                {showBalance ? `₹${formatAmount(overview.totalIncome)}` : '••••••'}
              </div>
              <div className="wf-stat-sub">
                {incomeDelta && incomeDelta.hasBaseline ? (
                  <span className={incomeDelta.isPositive ? 'delta-positive' : 'delta-negative'}>
                    {incomeDelta.label} {activeRange.prevLabel}
                  </span>
                ) : (
                  <span>Earned in period</span>
                )}
              </div>
            </div>

            {/* Total Expenses */}
            <div className="wf-stat-card">
              <div className="wf-stat-top">
                <span className="wf-stat-label">Total Expenses</span>
                <div className="wf-stat-icon-wrap expense" aria-hidden="true">
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <div className="wf-stat-value">
                {showBalance ? `₹${formatAmount(overview.totalExpenses)}` : '••••••'}
              </div>
              <div className="wf-stat-sub">
                {expensesDelta && expensesDelta.hasBaseline ? (
                  <span className={expensesDelta.isPositive ? 'delta-warning' : 'delta-positive'}>
                    {expensesDelta.label} {activeRange.prevLabel}
                  </span>
                ) : (
                  <span>Spent in period</span>
                )}
              </div>
            </div>

            {/* Net Cashflow */}
            <div className="wf-stat-card">
              <div className="wf-stat-top">
                <span className="wf-stat-label">Net Cashflow</span>
                <div
                  className={`wf-stat-icon-wrap ${
                    overview.netCashflow >= 0 ? 'income' : 'expense'
                  }`}
                  aria-hidden="true"
                >
                  <DollarSign size={16} />
                </div>
              </div>
              <div
                className="wf-stat-value"
                style={{
                  color:
                    overview.netCashflow > 0
                      ? 'var(--wf-income-600)'
                      : overview.netCashflow < 0
                      ? 'var(--wf-expense-600)'
                      : 'var(--wf-text-primary)',
                }}
              >
                {showBalance
                  ? `${overview.netCashflow >= 0 ? '+' : '-'}₹${formatAmount(
                      Math.abs(overview.netCashflow)
                    )}`
                  : '••••••'}
              </div>
              <div className="wf-stat-sub">
                {overview.netCashflow > 0
                  ? 'Surplus cash retained'
                  : overview.netCashflow < 0
                  ? 'Deficit this period'
                  : 'Break-even'}
              </div>
            </div>

            {/* Savings Rate */}
            <div className="wf-stat-card">
              <div className="wf-stat-top">
                <span className="wf-stat-label">Savings Rate</span>
                <div className="wf-stat-icon-wrap savings" aria-hidden="true">
                  <Percent size={15} />
                </div>
              </div>
              <div className="wf-stat-value">{`${overview.savingsRate}%`}</div>
              <div className="wf-stat-sub">
                {showBalance
                  ? `₹${formatAmount(overview.savingsDeposited)} saved`
                  : '•••••• saved'}
              </div>
            </div>
          </section>

          {/* ── Visual Charts & Breakdown Split ── */}
          <div className="wf-analytics-split">
            {/* Left Column: Monthly Trends Chart */}
            <Card variant="default" padding="md" className="wf-analytics-chart-card">
              <div className="wf-card-header-duo">
                <SectionHeader
                  title="Monthly Cashflow Trends"
                  description="Recent 6-month historical trajectory"
                />
                <div className="wf-chart-tab-group" role="tablist" aria-label="Trend chart type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={trendView === 'bars'}
                    className={`wf-chart-tab ${trendView === 'bars' ? 'active' : ''}`}
                    onClick={() => setTrendView('bars')}
                  >
                    Income & Spent
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={trendView === 'cashflow'}
                    className={`wf-chart-tab ${trendView === 'cashflow' ? 'active' : ''}`}
                    onClick={() => setTrendView('cashflow')}
                  >
                    Net Cashflow
                  </button>
                </div>
              </div>

              {trendView === 'bars' ? (
                <BarChart
                  data={monthlyTrends}
                  privacyMasked={!showBalance}
                />
              ) : (
                <CashflowChart
                  data={monthlyTrends}
                  privacyMasked={!showBalance}
                />
              )}
            </Card>

            {/* Right Column: Spending Distribution (Donut + Ranked List) */}
            <Card variant="default" padding="md" className="wf-analytics-spending-card">
              <SectionHeader
                title="Spending by Category"
                description={`Expense breakdown for ${activeRange.label}`}
              />

              {categorySpending.length === 0 ? (
                <div className="wf-empty-mini">
                  <p>No consumption expenses recorded for {activeRange.label}.</p>
                </div>
              ) : (
                <div className="wf-spending-content">
                  <div className="wf-donut-slot">
                    <DonutChart
                      data={categorySpending}
                      privacyMasked={!showBalance}
                    />
                  </div>

                  <div className="wf-cat-ranked-list">
                    {categorySpending.map((cat) => {
                      const Icon = cat.icon
                      return (
                        <div key={cat.category} className="wf-cat-row">
                          <div className="wf-cat-row-top">
                            <div className="wf-cat-row-left">
                              <span
                                className="wf-cat-item-icon"
                                style={{
                                  background: `${cat.color}18`,
                                  color: cat.color,
                                }}
                              >
                                <Icon size={14} />
                              </span>
                              <span className="wf-cat-name">{cat.category}</span>
                            </div>
                            <div className="wf-cat-row-right">
                              <span className="wf-cat-val">
                                {showBalance ? `₹${formatAmount(cat.amount)}` : '••••••'}
                              </span>
                              <span className="wf-cat-share">{cat.percentage}%</span>
                            </div>
                          </div>

                          <div className="wf-cat-track" aria-hidden="true">
                            <div
                              className="wf-cat-bar"
                              style={{
                                width: `${cat.percentage}%`,
                                background: cat.color,
                              }}
                            />
                          </div>

                          <div className="wf-cat-meta-sub">
                            <span>{cat.count} {cat.count === 1 ? 'transaction' : 'transactions'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ── Income Composition & Deterministic Insights ── */}
          <div className="wf-analytics-split" style={{ marginTop: 'var(--wf-space-5)' }}>
            {/* Income Sources */}
            <Card variant="default" padding="md">
              <SectionHeader
                title="Income Composition"
                description="Earnings grouped by source and recurring status"
              />

              {incomeComposition.sources.length === 0 ? (
                <div className="wf-empty-mini">
                  <p>No earned income recorded for {activeRange.label}.</p>
                </div>
              ) : (
                <div className="wf-income-breakdown">
                  {/* Recurring vs Non-recurring progress summary */}
                  <div className="wf-income-summary-banner">
                    <div className="wf-income-stat-cell">
                      <span className="wf-stat-label">Recurring Income</span>
                      <strong className="wf-stat-strong income">
                        {showBalance
                          ? `₹${formatAmount(incomeComposition.recurringTotal)}`
                          : '••••••'}
                      </strong>
                    </div>
                    <div className="wf-income-stat-cell">
                      <span className="wf-stat-label">Variable Income</span>
                      <strong className="wf-stat-strong">
                        {showBalance
                          ? `₹${formatAmount(incomeComposition.nonRecurringTotal)}`
                          : '••••••'}
                      </strong>
                    </div>
                  </div>

                  <div className="wf-income-source-list">
                    {incomeComposition.sources.map((src) => {
                      const Icon = src.icon
                      return (
                        <div key={src.category} className="wf-income-source-item">
                          <div className="wf-income-source-left">
                            <span
                              className="wf-cat-item-icon"
                              style={{
                                background: `${src.color}18`,
                                color: src.color,
                              }}
                            >
                              <Icon size={14} />
                            </span>
                            <div>
                              <div className="wf-income-source-title">
                                <span>{src.category}</span>
                                {src.isRecurring && (
                                  <Badge variant="brand" size="sm">
                                    Recurring
                                  </Badge>
                                )}
                              </div>
                              <span className="wf-income-source-sub">
                                {src.count} {src.count === 1 ? 'credit' : 'credits'}
                              </span>
                            </div>
                          </div>

                          <div className="wf-income-source-right">
                            <span className="wf-income-source-amount income">
                              {showBalance ? `+₹${formatAmount(src.amount)}` : '••••••'}
                            </span>
                            <span className="wf-income-source-pct">
                              {src.percentage}% of total
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* Financial Insights */}
            <Card variant="default" padding="md">
              <SectionHeader
                title="Financial Insights"
                description="Deterministic insights from your ledger data"
              />

              <div className="wf-insights-list">
                {financialInsights.length === 0 ? (
                  <div className="wf-empty-mini">
                    <p>Continue logging transactions to unlock automated financial observations.</p>
                  </div>
                ) : (
                  financialInsights.map((insight) => {
                    const isPositive = insight.type === 'positive'
                    const isWarning = insight.type === 'warning'
                    const Icon = isPositive ? CheckCircle2 : isWarning ? AlertTriangle : Info

                    return (
                      <div
                        key={insight.id}
                        className={`wf-insight-item ${insight.type}`}
                      >
                        <div className="wf-insight-icon" aria-hidden="true">
                          <Icon size={18} />
                        </div>
                        <div className="wf-insight-body">
                          <div className="wf-insight-header">
                            <span className="wf-insight-title">{insight.title}</span>
                            {insight.metric && (
                              <Badge
                                variant={isPositive ? 'income' : isWarning ? 'warning' : 'neutral'}
                                size="sm"
                              >
                                {insight.metric}
                              </Badge>
                            )}
                          </div>
                          <p className="wf-insight-desc">{insight.description}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

