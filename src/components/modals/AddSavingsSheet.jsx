import { useState, useRef, useEffect } from 'react'
import { PiggyBank } from 'lucide-react'
import { formatAmount } from '../../domain/money'
import { Modal, Input, Button } from '../ui'

export default function AddSavingsSheet({ maxAmount, onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 300)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    else if (amt > maxAmount) e.amount = `Maximum: ₹${formatAmount(maxAmount)} (your available cash balance)`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) onSubmit({ amount: Number(amount) })
  }

  return (
    <Modal title="Add to Savings" icon={PiggyBank} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Input
          ref={amountRef}
          id="savings-amount"
          label={`Deposit Amount (₹)`}
          hint={`Available cash balance: ₹${formatAmount(maxAmount)}`}
          prefix="₹"
          type="number"
          inputMode="decimal"
          placeholder="e.g. 200"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
        />
        <Button variant="primary" size="lg" fullWidth type="submit">
          Save ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </Button>
      </form>
    </Modal>
  )
}
