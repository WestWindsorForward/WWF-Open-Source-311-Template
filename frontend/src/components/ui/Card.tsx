import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    hover = false,
    onClick,
}) => {
    const baseStyles = 'glass-card p-6';

    if (hover || onClick) {
        return (
            <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={onClick ? { scale: 0.98 } : undefined}
                className={`${baseStyles} cursor-pointer ${className}`}
                onClick={onClick}
            >
                {children}
            </motion.div>
        );
    }

    return (
        <div className={`${baseStyles} ${className}`}>
            {children}
        </div>
    );
};

export default Card;
