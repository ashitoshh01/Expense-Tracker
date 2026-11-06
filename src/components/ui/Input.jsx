import React, { forwardRef, useId } from 'react'
import { AlertCircle } from 'lucide-react'

/**
 * Input Component
 * Accessible text/number input with label, prefix, suffix, helper text, and error states.
 */
const Input = forwardRef(function Input(
  {
    id: customId,
    label,
    optional = false,
    error,
    hint,
    prefix,
    suffix,
    type = 'text',
    className = '',
    inputClassName = '',
    disabled = false,
    ...rest
  },
  ref
) {
  const generatedId = useId()
  const inputId = customId || `wf-input-${generatedId}`
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ') || undefined

  return (
    <div className={`wf-field-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="wf-field-label">
          <span>{label}</span>
          {optional && <span className="wf-field-optional">(Optional)</span>}
        </label>
      )}

      <div
        className={`wf-input-wrap ${error ? 'wf-input-error' : ''} ${
          disabled ? 'wf-input-disabled' : ''
        }`}
      >
        {prefix && <span className="wf-input-prefix">{prefix}</span>}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`wf-input ${inputClassName}`}
          {...rest}
        />

        {suffix && <span className="wf-input-suffix">{suffix}</span>}
      </div>

      {error ? (
        <div id={errorId} className="wf-field-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : hint ? (
        <div id={hintId} className="wf-field-hint">
          {hint}
        </div>
      ) : null}
    </div>
  )
})

export default Input

