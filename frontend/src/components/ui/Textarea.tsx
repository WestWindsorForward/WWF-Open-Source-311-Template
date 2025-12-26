import React, { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    className={`glass-input min-h-[120px] resize-none ${error ? 'border-red-400/50 focus:border-red-400' : ''
                        } ${className}`}
                    {...props}
                />
                {error && (
                    <p className="mt-1.5 text-sm text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';

export default Textarea;
