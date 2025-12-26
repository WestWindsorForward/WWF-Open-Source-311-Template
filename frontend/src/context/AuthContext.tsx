import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthState } from '../types';
import { api } from '../services/api';

interface AuthContextType extends AuthState {
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        token: localStorage.getItem('token'),
        isAuthenticated: false,
        isLoading: true,
    });

    const fetchUser = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setState(s => ({ ...s, isLoading: false }));
            return;
        }

        api.setToken(token);
        try {
            const user = await api.getMe();
            setState({
                user,
                token,
                isAuthenticated: true,
                isLoading: false,
            });
        } catch {
            localStorage.removeItem('token');
            api.setToken(null);
            setState({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
            });
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = async (username: string, password: string) => {
        const { access_token } = await api.login(username, password);
        localStorage.setItem('token', access_token);
        api.setToken(access_token);

        const user = await api.getMe();
        setState({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
        });
    };

    const logout = () => {
        localStorage.removeItem('token');
        api.setToken(null);
        setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
        });
    };

    return (
        <AuthContext.Provider value={{ ...state, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
