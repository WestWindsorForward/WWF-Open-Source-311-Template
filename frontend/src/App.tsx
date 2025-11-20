import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { logoutSession } from "./api/auth";
import { useAuthStore } from "./store/auth";

export default function App() {
  const navItems = [
    { to: "/", label: "Resident Portal" },
    { to: "/admin", label: "Township Settings" },
    { to: "/staff", label: "Staff Command Center" },
  ];
  const user = useAuthStore((state) => state.user);
  const tokens = useAuthStore((state) => state.tokens);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (tokens?.refreshToken) {
        await logoutSession(tokens.refreshToken);
      }
    } catch (error) {
      console.error("Failed to revoke refresh token", error);
    } finally {
      clearSession();
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white pb-16">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Township 311</p>
            <h1 className="text-xl font-semibold text-slate-900">Request Management</h1>
          </div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <nav className="flex gap-2 text-sm font-medium text-slate-600">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-4 py-2 transition ${
                      isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {user ? (
              <div className="flex items-center gap-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                <span>{user.display_name}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  {user.role}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-full bg-slate-900 px-3 py-1 text-white"
                >
                  Logout
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 max-w-6xl px-6">
        <Outlet />
      </main>
    </div>
  );
}
