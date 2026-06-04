import { InputHTMLAttributes, forwardRef } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input
      ref={ref}
      {...props}
      className={`input-field ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
    />
    {error && <span className="text-xs text-red-600">{error}</span>}
  </div>
));

Input.displayName = 'Input';
