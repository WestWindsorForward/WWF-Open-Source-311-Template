import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50';

    const variantStyles = {
        primary: 'glass-button',
        secondary: 'bg-white/10 hover:bg-white/20 border border-white/20 text-white',
        ghost: 'bg-transparent hover:bg-white/10 text-white/80 hover:text-white',
        danger: 'bg-red-500/80 hover:bg-red-500 border border-red-400/30 text-white',
    };

    const sizeStyles = {
        sm: 'px-3 py-1.5 text-sm min-h-[36px]',
        md: 'px-5 py-2.5 text-sm min-h-[44px]',
        lg: 'px-6 py-3 text-base min-h-[52px]',
    };

    return (
        <motion.button
            whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
            whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
            className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className} ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            ) : leftIcon ? (
                <span className="mr-2">{leftIcon}</span>
            ) : null}
            {children}
            {rightIcon && <span className="ml-2">{rightIcon}</span>}
        </motion.button>
    );
};

export default Button;
