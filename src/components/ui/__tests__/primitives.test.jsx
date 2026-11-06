import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  Card,
  Button,
  Badge,
  Input,
  SectionHeader,
  EmptyState,
  Skeleton,
  Modal,
} from '../index'

describe('UI Primitives Component Layer (Phase 2.2)', () => {
  describe('Card', () => {
    it('renders default variant and padding correctly', () => {
      const html = renderToString(<Card>Content</Card>)
      expect(html).toContain('wf-card')
      expect(html).toContain('wf-card-default')
      expect(html).toContain('wf-card-pad-md')
      expect(html).toContain('Content')
    })

    it('renders interactive variant with button semantics when onClick is provided', () => {
      const html = renderToString(
        <Card variant="interactive" onClick={() => {}}>
          Clickable
        </Card>
      )
      expect(html).toContain('wf-card-interactive')
      expect(html).toContain('role="button"')
      expect(html).toContain('tabindex="0"')
    })
  })

  describe('Button', () => {
    it('renders primary variant and md size by default', () => {
      const html = renderToString(<Button>Save</Button>)
      expect(html).toContain('wf-btn')
      expect(html).toContain('wf-btn-primary')
      expect(html).toContain('wf-btn-md')
      expect(html).toContain('Save')
    })

    it('renders danger variant and disabled state', () => {
      const html = renderToString(
        <Button variant="danger" disabled>
          Delete
        </Button>
      )
      expect(html).toContain('wf-btn-danger')
      expect(html).toContain('disabled=""')
    })

    it('renders loading spinner and sets aria-busy when loading', () => {
      const html = renderToString(<Button loading>Submit</Button>)
      expect(html).toContain('wf-btn-loading')
      expect(html).toContain('aria-busy="true"')
      expect(html).toContain('wf-btn-spinner')
    })
  })

  describe('Badge', () => {
    it('renders semantic variants', () => {
      const incomeHtml = renderToString(<Badge variant="income">Active</Badge>)
      expect(incomeHtml).toContain('wf-badge-income')
      expect(incomeHtml).toContain('Active')

      const warningHtml = renderToString(<Badge variant="warning" dot>Pending</Badge>)
      expect(warningHtml).toContain('wf-badge-warning')
      expect(warningHtml).toContain('wf-badge-dot')
    })
  })

  describe('Input', () => {
    it('renders label, input, and prefix correctly', () => {
      const html = renderToString(
        <Input id="amount" label="Amount" prefix="₹" placeholder="0" />
      )
      expect(html).toContain('for="amount"')
      expect(html).toContain('Amount')
      expect(html).toContain('wf-input-prefix')
      expect(html).toContain('₹')
    })

    it('renders error state and sets aria-invalid', () => {
      const html = renderToString(
        <Input id="amount" label="Amount" error="Amount is required" />
      )
      expect(html).toContain('wf-input-error')
      expect(html).toContain('aria-invalid="true"')
      expect(html).toContain('Amount is required')
      expect(html).toContain('role="alert"')
    })
  })

  describe('SectionHeader', () => {
    it('renders title, description, and action slot', () => {
      const html = renderToString(
        <SectionHeader
          title="Recent Activity"
          description="Your latest transactions"
          action={<Button size="sm">View All</Button>}
        />
      )
      expect(html).toContain('Recent Activity')
      expect(html).toContain('Your latest transactions')
      expect(html).toContain('View All')
      expect(html).toContain('wf-section-header')
    })
  })

  describe('EmptyState', () => {
    it('renders title and description', () => {
      const html = renderToString(
        <EmptyState
          title="No data found"
          description="Start by adding your first transaction"
        />
      )
      expect(html).toContain('wf-empty-state')
      expect(html).toContain('No data found')
      expect(html).toContain('Start by adding your first transaction')
    })
  })

  describe('Skeleton', () => {
    it('renders single and stacked skeleton loaders', () => {
      const singleHtml = renderToString(<Skeleton width={100} height={20} />)
      expect(singleHtml).toContain('wf-skeleton')

      const stackHtml = renderToString(<Skeleton count={3} />)
      expect(stackHtml).toContain('wf-skeleton-stack')
    })
  })

  describe('Modal', () => {
    it('renders dialog with title and close button when open', () => {
      const html = renderToString(
        <Modal isOpen={true} title="Settings Dialog">
          <div>Modal Body</div>
        </Modal>
      )
      expect(html).toContain('role="dialog"')
      expect(html).toContain('aria-modal="true"')
      expect(html).toContain('Settings Dialog')
      expect(html).toContain('Modal Body')
      expect(html).toContain('sheet-handle')
    })

    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <Modal isOpen={false} title="Hidden Dialog">
          <div>Hidden</div>
        </Modal>
      )
      expect(html).toBe('')
    })
  })
})

