import { describe, it, expect } from 'vitest'
import {
  normalizeState,
  DEFAULT_SETTINGS,
  addRecurringIncome,
  updateRecurringIncome,
  deleteRecurringIncome,
  processRecurringIncomesAutomation,
} from '../accounting'

describe('Automated Recurring Incomes & Zero Hardcoded Defaults Suite', () => {
  it('guarantees DEFAULT_SETTINGS has 0 amounts and no hardcoded automated credits', () => {
    expect(DEFAULT_SETTINGS.salaryAmount).toBe(0)
    expect(DEFAULT_SETTINGS.autoSaveAmount).toBe(0)
    expect(DEFAULT_SETTINGS.autoSaveEnabled).toBe(false)
    expect(DEFAULT_SETTINGS.recurringIncomes).toEqual([])

    const state = normalizeState({})
    expect(state.settings.salaryAmount).toBe(0)
    expect(state.settings.autoSaveAmount).toBe(0)
    expect(state.settings.autoSaveEnabled).toBe(false)
    expect(state.settings.recurringIncomes).toEqual([])

    // Running automation on fresh state must do NOTHING: zero credit, zero auto-save
    const result = processRecurringIncomesAutomation(state, { now: new Date('2026-10-10') })
    expect(result.processed).toBe(false)
    expect(result.state.balance).toBe(0)
    expect(result.state.savings).toBe(0)
    expect(result.state.transactions).toHaveLength(0)
  })

  it('supports adding, updating, and deleting recurring income sources', () => {
    let state = normalizeState({})

    // 1. Add primary salary
    state = addRecurringIncome(state, {
      name: 'Primary Salary',
      category: 'Salary',
      amount: 60000,
      creditDay: 5,
      autoSaveAmount: 12000,
    })
    expect(state.settings.recurringIncomes).toHaveLength(1)
    const inc1 = state.settings.recurringIncomes[0]
    expect(inc1.name).toBe('Primary Salary')
    expect(inc1.amount).toBe(60000)
    expect(inc1.creditDay).toBe(5)
    expect(inc1.autoSaveAmount).toBe(12000)
    expect(inc1.enabled).toBe(true)

    // 2. Add freelance income
    state = addRecurringIncome(state, {
      name: 'Freelance Retainer',
      category: 'Freelance',
      amount: 25000,
      creditDay: 15,
      autoSaveAmount: 5000,
    })
    expect(state.settings.recurringIncomes).toHaveLength(2)

    // 3. Update primary salary amount
    state = updateRecurringIncome(state, inc1.id, { amount: 65000, autoSaveAmount: 15000 })
    const updatedInc1 = state.settings.recurringIncomes.find((i) => i.id === inc1.id)
    expect(updatedInc1.amount).toBe(65000)
    expect(updatedInc1.autoSaveAmount).toBe(15000)

    // 4. Delete freelance income
    const inc2 = state.settings.recurringIncomes.find((i) => i.name === 'Freelance Retainer')
    state = deleteRecurringIncome(state, inc2.id)
    expect(state.settings.recurringIncomes).toHaveLength(1)
    expect(state.settings.recurringIncomes[0].id).toBe(inc1.id)
  })

  it('automatically credits configured income on its scheduled day and transfers auto-save to savings', () => {
    let state = normalizeState({ balance: 5000, savings: 2000 })

    state = addRecurringIncome(state, {
      name: 'Tech Corp Salary',
      category: 'Salary',
      amount: 50000,
      creditDay: 5,
      autoSaveAmount: 10000,
    })

    // Before credit day (e.g. Day 3): no credit
    const beforeRun = processRecurringIncomesAutomation(state, { now: new Date('2026-10-03T10:00:00Z') })
    expect(beforeRun.processed).toBe(false)
    expect(beforeRun.state.balance).toBe(5000)
    expect(beforeRun.state.savings).toBe(2000)

    // On credit day (Day 5): credits net ₹40,000 cash and ₹10,000 savings
    const onDayRun = processRecurringIncomesAutomation(state, { now: new Date('2026-10-05T10:00:00Z') })
    expect(onDayRun.processed).toBe(true)
    expect(onDayRun.creditedSources).toHaveLength(1)
    expect(onDayRun.creditedSources[0].name).toBe('Tech Corp Salary')
    expect(onDayRun.state.balance).toBe(45000) // 5000 + 40000 net
    expect(onDayRun.state.savings).toBe(12000) // 2000 + 10000
    expect(onDayRun.state.transactions).toHaveLength(2) // 1 income + 1 savings deposit

    // Second run within the same month (Day 10): idempotent, does NOT credit twice
    const secondRun = processRecurringIncomesAutomation(onDayRun.state, { now: new Date('2026-10-10T10:00:00Z') })
    expect(secondRun.processed).toBe(false)
    expect(secondRun.state.balance).toBe(45000)
    expect(secondRun.state.savings).toBe(12000)
    expect(secondRun.state.transactions).toHaveLength(2)
  })

  it('correctly staggers multiple income sources with different credit days', () => {
    let state = normalizeState({ balance: 0, savings: 0 })

    // Salary credits on day 1
    state = addRecurringIncome(state, {
      name: 'Salary',
      category: 'Salary',
      amount: 40000,
      creditDay: 1,
      autoSaveAmount: 0,
    })

    // Rental credits on day 15 with ₹5,000 auto-save
    state = addRecurringIncome(state, {
      name: 'Rental Property',
      category: 'Rental',
      amount: 20000,
      creditDay: 15,
      autoSaveAmount: 5000,
    })

    // On Day 5: Only Salary should credit
    const day5Run = processRecurringIncomesAutomation(state, { now: new Date('2026-10-05T10:00:00Z') })
    expect(day5Run.processed).toBe(true)
    expect(day5Run.creditedSources).toHaveLength(1)
    expect(day5Run.creditedSources[0].name).toBe('Salary')
    expect(day5Run.state.balance).toBe(40000)
    expect(day5Run.state.savings).toBe(0)

    // On Day 16: Rental should now credit, without re-crediting Salary
    const day16Run = processRecurringIncomesAutomation(day5Run.state, { now: new Date('2026-10-16T10:00:00Z') })
    expect(day16Run.processed).toBe(true)
    expect(day16Run.creditedSources).toHaveLength(1)
    expect(day16Run.creditedSources[0].name).toBe('Rental Property')
    expect(day16Run.state.balance).toBe(55000) // 40000 + 15000 net
    expect(day16Run.state.savings).toBe(5000)
  })
})
