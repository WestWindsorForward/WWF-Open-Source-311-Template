import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, options, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    <select
                        ref={ref}
                        className={`glass-input appearance-none pr-10 cursor-pointer ${error ? 'border-red-400/50 focus:border-red-400' : ''
                            } ${className}`}
                        {...props}
                    >
                        {options.map((option) => (
                            <option key={option.value} value={option.value} className="bg-primary-950 text-white">
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
                </div>
                {error && (
                    <p className="mt-1.5 text-sm text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';

export default Select;
