import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, leftIcon, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`glass-input ${leftIcon ? 'pl-12' : ''} ${error ? 'border-red-400/50 focus:border-red-400' : ''
                            } ${className}`}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-1.5 text-sm text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;
