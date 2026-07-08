import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, label, required, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const inputClass = `input ${error ? 'input-error' : ''} ${className}`.trim();

    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label 
            htmlFor={inputId} 
            className={`label ${required ? 'label-required' : ''}`}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputClass}
          required={required}
          {...props}
        />
        {error && (
          <p className="caption" style={{ color: 'var(--danger-foreground)', marginTop: 'var(--space-1)' }}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
