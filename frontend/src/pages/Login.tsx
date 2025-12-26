import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, User, Lock, AlertCircle } from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function Login() {
    const navigate = useNavigate();
    const { login, isAuthenticated, user } = useAuth();
    const { settings } = useSettings();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Redirect if already logged in
    React.useEffect(() => {
        if (isAuthenticated && user) {
            navigate(user.role === 'admin' ? '/admin' : '/staff');
        }
    }, [isAuthenticated, user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            // Navigation will happen via useEffect
        } catch (err) {
            setError((err as Error).message || 'Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <Card className="p-8">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        {settings?.logo_url ? (
                            <img src={settings.logo_url} alt="Logo" className="h-16 mx-auto mb-4" />
                        ) : (
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center glow-effect">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                        )}
                        <h1 className="text-2xl font-bold text-white">
                            {settings?.township_name || 'Township 311'}
                        </h1>
                        <p className="text-white/50 mt-2">Staff Access Portal</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300"
                            >
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm">{error}</span>
                            </motion.div>
                        )}

                        <Input
                            label="Username"
                            placeholder="Enter your username"
                            leftIcon={<User className="w-5 h-5" />}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                        />

                        <Input
                            label="Password"
                            type="password"
                            placeholder="Enter your password"
                            leftIcon={<Lock className="w-5 h-5" />}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full"
                            isLoading={isLoading}
                        >
                            Sign In
                        </Button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                        <p className="text-sm text-white/40">
                            Authorized users only. Unauthorized access is prohibited.
                        </p>
                        <Link
                            to="/"
                            className="inline-block mt-4 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                        >
                            ← Back to public portal
                        </Link>
                    </div>
                </Card>
            </motion.div>
        </div>
    );
}
