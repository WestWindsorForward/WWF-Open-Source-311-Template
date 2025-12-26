import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Menu,
    X,
    Palette,
    Users,
    Grid3X3,
    Key,
    Puzzle,
    LogOut,
    Save,
    Trash2,
    Plus,
    RefreshCw,
    Sparkles,
    Check,
    AlertTriangle,
} from 'lucide-react';
import { Button, Card, Modal, Input, Select, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';
import { User, ServiceDefinition, SystemSettings, SystemSecret, Department } from '../types';

type Tab = 'branding' | 'users' | 'services' | 'secrets' | 'modules';

export default function AdminConsole() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { settings, refreshSettings } = useSettings();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentTab, setCurrentTab] = useState<Tab>('branding');
    const [isLoading, setIsLoading] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // Branding state
    const [brandingForm, setBrandingForm] = useState<Partial<SystemSettings>>({});

    // Users state
    const [users, setUsers] = useState<User[]>([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'staff' as 'staff' | 'admin',
    });

    // Services state
    const [services, setServices] = useState<ServiceDefinition[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [newService, setNewService] = useState({
        service_code: '',
        service_name: '',
        description: '',
        icon: 'AlertCircle',
    });

    // Secrets state
    const [secrets, setSecrets] = useState<SystemSecret[]>([]);
    const [secretValues, setSecretValues] = useState<Record<string, string>>({});

    // Modules state
    const [modules, setModules] = useState({ ai_analysis: false, sms_alerts: false });

    // Update in progress
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateMessage, setUpdateMessage] = useState<string | null>(null);

    useEffect(() => {
        if (settings) {
            setBrandingForm({
                township_name: settings.township_name,
                logo_url: settings.logo_url || '',
                favicon_url: settings.favicon_url || '',
                hero_text: settings.hero_text,
                primary_color: settings.primary_color,
            });
            setModules(settings.modules);
        }
    }, [settings]);

    useEffect(() => {
        loadTabData();
    }, [currentTab]);

    const loadTabData = async () => {
        setIsLoading(true);
        try {
            switch (currentTab) {
                case 'users':
                    const usersData = await api.getUsers();
                    setUsers(usersData);
                    break;
                case 'services':
                    const [servicesData, deptsData] = await Promise.all([
                        api.getServices(),
                        api.getDepartments(),
                    ]);
                    setServices(servicesData);
                    setDepartments(deptsData);
                    break;
                case 'secrets':
                    const secretsData = await api.getSecrets();
                    setSecrets(secretsData);
                    break;
            }
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveBranding = async () => {
        setIsLoading(true);
        try {
            await api.updateSettings(brandingForm);
            await refreshSettings();
            setSaveMessage('Branding saved successfully');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
            console.error('Failed to save branding:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createUser(newUser);
            setShowUserModal(false);
            setNewUser({ username: '', email: '', full_name: '', password: '', role: 'staff' });
            loadTabData();
        } catch (err) {
            console.error('Failed to create user:', err);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.deleteUser(userId);
            loadTabData();
        } catch (err) {
            console.error('Failed to delete user:', err);
        }
    };

    const handleCreateService = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createService(newService);
            setShowServiceModal(false);
            setNewService({ service_code: '', service_name: '', description: '', icon: 'AlertCircle' });
            loadTabData();
        } catch (err) {
            console.error('Failed to create service:', err);
        }
    };

    const handleDeleteService = async (serviceId: number) => {
        if (!confirm('Are you sure you want to delete this service?')) return;
        try {
            await api.deleteService(serviceId);
            loadTabData();
        } catch (err) {
            console.error('Failed to delete service:', err);
        }
    };

    const handleUpdateSecret = async (keyName: string) => {
        const value = secretValues[keyName];
        if (!value) return;
        try {
            await api.updateSecret(keyName, value);
            setSecretValues((prev) => ({ ...prev, [keyName]: '' }));
            loadTabData();
        } catch (err) {
            console.error('Failed to update secret:', err);
        }
    };

    const handleSaveModules = async () => {
        setIsLoading(true);
        try {
            await api.updateSettings({ modules });
            await refreshSettings();
            setSaveMessage('Modules saved successfully');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
            console.error('Failed to save modules:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSystemUpdate = async () => {
        if (!confirm('This will pull updates from GitHub and rebuild the system. Continue?')) return;
        setIsUpdating(true);
        setUpdateMessage('Pulling updates...');
        try {
            const result = await api.updateSystem();
            setUpdateMessage(result.message);
        } catch (err) {
            setUpdateMessage('Update failed: ' + (err as Error).message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const tabs = [
        { id: 'branding', icon: Palette, label: 'Branding' },
        { id: 'users', icon: Users, label: 'Users' },
        { id: 'services', icon: Grid3X3, label: 'Service Categories' },
        { id: 'secrets', icon: Key, label: 'API Keys' },
        { id: 'modules', icon: Puzzle, label: 'Modules' },
    ];

    return (
        <div className="min-h-screen flex">
            {/* Mobile sidebar backdrop */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-50 w-72 glass-sidebar transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-white">Admin Console</h2>
                                    <p className="text-xs text-white/50">{settings?.township_name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="lg:hidden p-2 hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-5 h-5 text-white/60" />
                            </button>
                        </div>
                    </div>

                    {/* Menu */}
                    <nav className="flex-1 p-4 space-y-2">
                        <p className="text-xs font-medium text-white/40 uppercase tracking-wider px-3 mb-3">
                            Configuration
                        </p>
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setCurrentTab(tab.id as Tab);
                                    setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${currentTab === tab.id
                                        ? 'bg-primary-500/20 text-white'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        ))}

                        {/* System Update Button */}
                        <div className="pt-6">
                            <p className="text-xs font-medium text-white/40 uppercase tracking-wider px-3 mb-3">
                                System
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full"
                                leftIcon={<RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />}
                                onClick={handleSystemUpdate}
                                disabled={isUpdating}
                            >
                                {isUpdating ? 'Updating...' : 'Pull Updates'}
                            </Button>
                            {updateMessage && (
                                <p className="mt-2 text-xs text-center text-white/60">{updateMessage}</p>
                            )}
                        </div>
                    </nav>

                    {/* User Footer */}
                    <div className="p-4 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center text-white font-medium">
                                    A
                                </div>
                                <div>
                                    <p className="font-medium text-white text-sm">{user?.full_name || 'Administrator'}</p>
                                    <p className="text-xs text-amber-400">Admin</p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <LogOut className="w-5 h-5 text-white/60" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="lg:hidden glass-sidebar p-4 flex items-center justify-between sticky top-0 z-30">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded-lg">
                        <Menu className="w-6 h-6 text-white" />
                    </button>
                    <h1 className="font-semibold text-white">Admin Console</h1>
                    <div className="w-10" />
                </header>

                {/* Content */}
                <div className="flex-1 p-6 overflow-auto">
                    <div className="max-w-4xl mx-auto">
                        {/* Save message */}
                        <AnimatePresence>
                            {saveMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300"
                                >
                                    <Check className="w-5 h-5" />
                                    {saveMessage}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Branding Tab */}
                        {currentTab === 'branding' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-2xl font-bold text-white">Branding Settings</h1>
                                    <Button leftIcon={<Save className="w-4 h-4" />} onClick={handleSaveBranding} isLoading={isLoading}>
                                        Save Changes
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card>
                                        <div className="space-y-4">
                                            <Input
                                                label="Municipality Name"
                                                value={brandingForm.township_name || ''}
                                                onChange={(e) => setBrandingForm((p) => ({ ...p, township_name: e.target.value }))}
                                            />
                                            <Input
                                                label="Hero Text"
                                                value={brandingForm.hero_text || ''}
                                                onChange={(e) => setBrandingForm((p) => ({ ...p, hero_text: e.target.value }))}
                                            />
                                            <Input
                                                label="Logo URL"
                                                value={brandingForm.logo_url || ''}
                                                onChange={(e) => setBrandingForm((p) => ({ ...p, logo_url: e.target.value }))}
                                            />
                                            <Input
                                                label="Favicon URL"
                                                value={brandingForm.favicon_url || ''}
                                                onChange={(e) => setBrandingForm((p) => ({ ...p, favicon_url: e.target.value }))}
                                            />
                                            <div>
                                                <label className="block text-sm font-medium text-white/70 mb-2">
                                                    Primary Color
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="color"
                                                        value={brandingForm.primary_color || '#6366f1'}
                                                        onChange={(e) => setBrandingForm((p) => ({ ...p, primary_color: e.target.value }))}
                                                        className="w-12 h-12 rounded-lg cursor-pointer bg-transparent"
                                                    />
                                                    <Input
                                                        value={brandingForm.primary_color || '#6366f1'}
                                                        onChange={(e) => setBrandingForm((p) => ({ ...p, primary_color: e.target.value }))}
                                                        className="flex-1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card>
                                        <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>
                                        <div className="p-4 rounded-xl bg-black/20 space-y-4">
                                            {brandingForm.logo_url ? (
                                                <img src={brandingForm.logo_url} alt="Logo preview" className="h-16" />
                                            ) : (
                                                <div
                                                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                                    style={{ background: `linear-gradient(135deg, ${brandingForm.primary_color}, ${brandingForm.primary_color}dd)` }}
                                                >
                                                    <Sparkles className="w-8 h-8 text-white" />
                                                </div>
                                            )}
                                            <h2 className="text-xl font-bold text-white">{brandingForm.township_name}</h2>
                                            <p className="text-white/60">{brandingForm.hero_text}</p>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )}

                        {/* Users Tab */}
                        {currentTab === 'users' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-2xl font-bold text-white">User Management</h1>
                                    <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowUserModal(true)}>
                                        Add User
                                    </Button>
                                </div>

                                <Card className="p-0 overflow-hidden">
                                    <table className="w-full">
                                        <thead className="border-b border-white/10">
                                            <tr>
                                                <th className="text-left p-4 text-white/60 font-medium">User</th>
                                                <th className="text-left p-4 text-white/60 font-medium">Email</th>
                                                <th className="text-left p-4 text-white/60 font-medium">Role</th>
                                                <th className="text-right p-4 text-white/60 font-medium">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {users.map((u) => (
                                                <tr key={u.id} className="hover:bg-white/5">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-primary-500/30 flex items-center justify-center text-white font-medium">
                                                                {u.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-white">{u.username}</p>
                                                                <p className="text-sm text-white/50">{u.full_name}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-white/70">{u.email}</td>
                                                    <td className="p-4">
                                                        <Badge variant={u.role === 'admin' ? 'warning' : 'info'}>
                                                            {u.role}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteUser(u.id)}
                                                            disabled={u.id === user?.id}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Card>
                            </div>
                        )}

                        {/* Services Tab */}
                        {currentTab === 'services' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-2xl font-bold text-white">Service Categories</h1>
                                    <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowServiceModal(true)}>
                                        Add Category
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {services.map((service) => (
                                        <Card key={service.id} className="relative group">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center text-primary-300">
                                                    <Grid3X3 className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-white">{service.service_name}</h3>
                                                    <p className="text-sm text-white/50 mt-1">{service.description}</p>
                                                    <p className="text-xs text-white/30 mt-2 font-mono">{service.service_code}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteService(service.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Secrets Tab */}
                        {currentTab === 'secrets' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-2xl font-bold text-white">API Keys & Secrets</h1>
                                </div>

                                <div className="space-y-4">
                                    {secrets.map((secret) => (
                                        <Card key={secret.id}>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-white font-mono text-sm">
                                                            {secret.key_name}
                                                        </h3>
                                                        <Badge variant={secret.is_configured ? 'success' : 'danger'}>
                                                            {secret.is_configured ? 'Configured' : 'Not Set'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-white/50 mt-1">{secret.description}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="password"
                                                        placeholder="Enter new value..."
                                                        value={secretValues[secret.key_name] || ''}
                                                        onChange={(e) =>
                                                            setSecretValues((p) => ({ ...p, [secret.key_name]: e.target.value }))
                                                        }
                                                        className="w-48"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleUpdateSecret(secret.key_name)}
                                                        disabled={!secretValues[secret.key_name]}
                                                    >
                                                        Update
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Modules Tab */}
                        {currentTab === 'modules' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h1 className="text-2xl font-bold text-white">Feature Modules</h1>
                                    <Button leftIcon={<Save className="w-4 h-4" />} onClick={handleSaveModules} isLoading={isLoading}>
                                        Save Changes
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <Card>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                    <Sparkles className="w-6 h-6 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-white">AI Analysis</h3>
                                                    <p className="text-sm text-white/50">Enable Vertex AI triage for submissions</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setModules((p) => ({ ...p, ai_analysis: !p.ai_analysis }))}
                                                className={`w-14 h-8 rounded-full transition-colors ${modules.ai_analysis ? 'bg-primary-500' : 'bg-white/20'
                                                    }`}
                                            >
                                                <div
                                                    className={`w-6 h-6 rounded-full bg-white transition-transform ${modules.ai_analysis ? 'translate-x-7' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </Card>

                                    <Card>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                                    <AlertTriangle className="w-6 h-6 text-green-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-white">SMS Alerts</h3>
                                                    <p className="text-sm text-white/50">Enable SMS notifications via Twilio</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setModules((p) => ({ ...p, sms_alerts: !p.sms_alerts }))}
                                                className={`w-14 h-8 rounded-full transition-colors ${modules.sms_alerts ? 'bg-primary-500' : 'bg-white/20'
                                                    }`}
                                            >
                                                <div
                                                    className={`w-6 h-6 rounded-full bg-white transition-transform ${modules.sms_alerts ? 'translate-x-7' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title="Add New User">
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <Input
                        label="Username"
                        value={newUser.username}
                        onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                        required
                    />
                    <Input
                        label="Full Name"
                        value={newUser.full_name}
                        onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))}
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                        required
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                        required
                    />
                    <Select
                        label="Role"
                        options={[
                            { value: 'staff', label: 'Staff' },
                            { value: 'admin', label: 'Admin' },
                        ]}
                        value={newUser.role}
                        onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as 'staff' | 'admin' }))}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowUserModal(false)}>Cancel</Button>
                        <Button type="submit">Create User</Button>
                    </div>
                </form>
            </Modal>

            {/* Add Service Modal */}
            <Modal isOpen={showServiceModal} onClose={() => setShowServiceModal(false)} title="Add Service Category">
                <form onSubmit={handleCreateService} className="space-y-4">
                    <Input
                        label="Service Name"
                        value={newService.service_name}
                        onChange={(e) => setNewService((p) => ({ ...p, service_name: e.target.value }))}
                        required
                    />
                    <Input
                        label="Service Code"
                        placeholder="POTHOLE, STREETLIGHT, etc."
                        value={newService.service_code}
                        onChange={(e) => setNewService((p) => ({ ...p, service_code: e.target.value.toUpperCase() }))}
                        required
                    />
                    <Input
                        label="Description"
                        value={newService.description}
                        onChange={(e) => setNewService((p) => ({ ...p, description: e.target.value }))}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowServiceModal(false)}>Cancel</Button>
                        <Button type="submit">Create Category</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
