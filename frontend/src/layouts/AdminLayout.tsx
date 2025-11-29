import { NavLink, Outlet } from "react-router-dom";
import { useBrandingStore } from "../store/branding";
import { useQueryClient } from "@tanstack/react-query";
import client from "../api/client";

const nav = [
  { to: "/admin/overview", label: "Overview" },
  { to: "/admin/branding", label: "Branding" },
  { to: "/admin/departments", label: "Departments" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/boundaries", label: "Boundaries" },
  { to: "/admin/staff", label: "Staff" },
  { to: "/admin/requests", label: "Requests" },
  { to: "/admin/runtime", label: "Runtime" },
  { to: "/admin/secrets", label: "Secrets" },
  { to: "/admin/system", label: "System" },
];

export default function AdminLayout() {
  const branding = useBrandingStore((s) => s.branding);
  const queryClient = useQueryClient();

  const prefetchers: Record<string, () => void> = {
    "/admin/overview": () => {
      queryClient.prefetchQuery({ queryKey: ["resident-config"], queryFn: async () => (await client.get("/api/resident/config")).data, staleTime: 120_000 });
    },
    "/admin/branding": () => {
      queryClient.prefetchQuery({ queryKey: ["resident-config"], queryFn: async () => (await client.get("/api/resident/config")).data, staleTime: 120_000 });
      // Preload chunk
      import("../pages/admin/Branding");
    },
    "/admin/departments": () => {
      queryClient.prefetchQuery({ queryKey: ["departments"], queryFn: async () => (await client.get("/api/admin/departments")).data, staleTime: 120_000 });
      import("../pages/admin/Departments");
    },
    "/admin/categories": () => {
      queryClient.prefetchQuery({ queryKey: ["admin-categories"], queryFn: async () => (await client.get("/api/admin/categories")).data, staleTime: 120_000 });
      import("../pages/admin/Categories");
    },
    "/admin/boundaries": () => {
      queryClient.prefetchQuery({ queryKey: ["geo-boundaries"], queryFn: async () => (await client.get("/api/admin/geo-boundary")).data, staleTime: 120_000 });
      import("../pages/admin/Boundaries");
    },
    "/admin/staff": () => {
      queryClient.prefetchQuery({ queryKey: ["staff-directory"], queryFn: async () => (await client.get("/api/admin/staff")).data, staleTime: 120_000 });
      import("../pages/admin/Staff");
    },
    "/admin/requests": () => {
      queryClient.prefetchQuery({ queryKey: ["staff-requests"], queryFn: async () => (await client.get("/api/staff/requests")).data, staleTime: 60_000 });
      import("../pages/admin/Requests");
    },
    "/admin/runtime": () => {
      queryClient.prefetchQuery({ queryKey: ["runtime-config"], queryFn: async () => (await client.get("/api/admin/runtime-config")).data, staleTime: 120_000 });
      import("../pages/admin/RuntimeConfig");
    },
    "/admin/secrets": () => {
      queryClient.prefetchQuery({ queryKey: ["secrets"], queryFn: async () => (await client.get("/api/admin/secrets")).data, staleTime: 120_000 });
      import("../pages/admin/Secrets");
    },
    "/admin/system": () => {
      import("../pages/admin/System");
    },
  };
  return (
    <div className="min-h-[70vh] rounded-2xl border border-slate-200 bg-white shadow">
      <div className="grid grid-cols-12">
        <aside className="col-span-12 border-b border-slate-100 md:col-span-3 md:border-r">
          <div className="flex items-center gap-3 p-4">
            {branding.logo_url && (
              <img src={branding.logo_url} alt="logo" className="h-10 w-10 rounded-full border border-slate-200 object-cover" />
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{branding.town_name ?? "Township 311"}</p>
              <h2 className="text-sm font-semibold text-slate-800">Admin</h2>
            </div>
          </div>
          <nav className="space-y-1 p-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`
                }
                onMouseEnter={() => prefetchers[item.to]?.()}
                onFocus={() => prefetchers[item.to]?.()}
                onTouchStart={() => prefetchers[item.to]?.()}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section className="col-span-12 p-4 md:col-span-9">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
