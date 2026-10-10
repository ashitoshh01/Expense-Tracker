/**
 * Categories registry for Wallet FIX.
 *
 * Provides typed, maintainable categories with icons and color tokens.
 */

import {
  CircleDollarSign,
  ShoppingCart,
  Utensils,
  Plane,
  Building2,
  Heart,
  GraduationCap,
  Landmark,
  PiggyBank,
  MoreHorizontal,
  CreditCard,
  Tag,
  Wallet,
} from 'lucide-react'

export const DEFAULT_SPEND_CATEGORIES = [
  'Outside Food',
  'Shopping',
  'Groceries',
  'Travel',
  'Bills & Utilities',
  'Health',
  'Education',
  'Material from me/friend',
  'Other',
]

export const ALL_CATEGORIES = [
  { id: 'Salary', name: 'Salary', icon: CircleDollarSign, type: 'income', color: '#10B981' },
  { id: 'Freelance', name: 'Freelance', icon: Wallet, type: 'income', color: '#059669' },
  { id: 'Investment', name: 'Investment', icon: Building2, type: 'income', color: '#2563EB' },
  { id: 'Outside Food', name: 'Outside Food', icon: Utensils, type: 'expense', color: '#F59E0B' },
  { id: 'Shopping', name: 'Shopping', icon: ShoppingCart, type: 'expense', color: '#EC4899' },
  { id: 'Travel', name: 'Travel', icon: Plane, type: 'expense', color: '#8B5CF6' },
  { id: 'Bills & Utilities', name: 'Bills & Utilities', icon: CreditCard, type: 'expense', color: '#EF4444' },
  { id: 'Health', name: 'Health', icon: Heart, type: 'expense', color: '#F43F5E' },
  { id: 'Education', name: 'Education', icon: GraduationCap, type: 'expense', color: '#3B82F6' },
  { id: 'Loan', name: 'Loan', icon: Landmark, type: 'loan', color: '#6366F1' },
  { id: 'Savings', name: 'Savings', icon: PiggyBank, type: 'transfer', color: '#10B981' },
  { id: 'Material from me/friend', name: 'Material from me/friend', icon: Tag, type: 'expense', color: '#64748B' },
  { id: 'Give friend money', name: 'Give friend money', icon: Landmark, type: 'expense', color: '#6366F1' },
  { id: 'Other', name: 'Other', icon: MoreHorizontal, type: 'expense', color: '#94A3B8' },
]

/**
 * Get category metadata by category name or fallback.
 * @param {string} name
 */
export function getCategoryMeta(name) {
  const found = ALL_CATEGORIES.find((c) => c.name.toLowerCase() === (name || '').toLowerCase())
  if (found) return found
  return {
    id: name || 'Other',
    name: name || 'Other',
    icon: MoreHorizontal,
    type: 'expense',
    color: '#94A3B8',
  }
}

/**
 * Get category icon component by category name.
 * @param {string} name
 */
export function getCategoryIcon(name) {
  return getCategoryMeta(name).icon
}
