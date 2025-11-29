import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDepartments } from "../../api/hooks";
import client from "../../api/client";
import type { Department } from "../../types";
import { useState } from "react";

type DepartmentFormState = {
  slug: string;
  name: string;
  description: string;
  contact_email: string;
  contact_phone: string;
};

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const departmentsQuery = useDepartments();
  const [form, setForm] = useState<DepartmentFormState>({ slug: "", name: "", description: "", contact_email: "", contact_phone: "" });
  const deleteMutation = useMutation({
    mutationFn: async (departmentId: string) => client.delete(`/api/admin/departments/${departmentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });
  const createMutation = useMutation({
    mutationFn: async (payload: DepartmentFormState) => client.post("/api/admin/departments", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setForm({ slug: "", name: "", description: "", contact_email: "", contact_phone: "" });
    },
  });
  const departments = departmentsQuery.data ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Department> | null>(null);
  const updateMutation = useMutation({
    mutationFn: async (dept: Department) => client.put(`/api/admin/departments/${dept.id}`, { name: dept.name, slug: dept.slug, description: dept.description, contact_email: dept.contact_email, contact_phone: dept.contact_phone }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["departments"] }),
  });
  const fields: Array<{ label: string; key: keyof typeof form; type?: string }> = [
    { label: "Name", key: "name" },
    { label: "Slug", key: "slug" },
    { label: "Description", key: "description" },
    { label: "Contact Email", key: "contact_email", type: "email" },
    { label: "Contact Phone", key: "contact_phone" },
  ];
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="text-sm text-slate-500">Create departments and manage directory.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map(({ label, key, type }) => (
          <label key={key} className="text-sm text-slate-600">
            {label}
            <input type={type ?? "text"} className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        <button className="rounded-xl bg-emerald-600 px-4 py-2 text-white disabled:opacity-50" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving…" : "Add Department"}
        </button>
      </div>
      {departments.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-100">
          {departments.map((dept: Department) => (
            <li key={dept.id} className="p-3 text-sm">
              {editingId === (dept.id as any) ? (
                <div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className="rounded-md border p-2" value={draft?.name ?? dept.name} onChange={(e) => setDraft({ ...(draft ?? {}), id: dept.id, name: e.target.value })} />
                    <input className="rounded-md border p-2" value={draft?.slug ?? dept.slug} onChange={(e) => setDraft({ ...(draft ?? {}), id: dept.id, slug: e.target.value })} />
                    <input className="rounded-md border p-2 md:col-span-2" value={draft?.description ?? dept.description ?? ""} onChange={(e) => setDraft({ ...(draft ?? {}), id: dept.id, description: e.target.value })} />
                    <input className="rounded-md border p-2" value={draft?.contact_email ?? dept.contact_email ?? ""} onChange={(e) => setDraft({ ...(draft ?? {}), id: dept.id, contact_email: e.target.value })} />
                    <input className="rounded-md border p-2" value={draft?.contact_phone ?? dept.contact_phone ?? ""} onChange={(e) => setDraft({ ...(draft ?? {}), id: dept.id, contact_phone: e.target.value })} />
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => { if (draft) updateMutation.mutate({ ...(dept as any), ...draft }); setEditingId(null); }} disabled={updateMutation.isPending}>Save</button>
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => { setEditingId(null); setDraft(null); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{dept.name}</p>
                    <p className="text-xs uppercase text-slate-500">{dept.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => { setEditingId(dept.id as any); setDraft({ ...dept }); }}>Edit</button>
                    <button type="button" className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" onClick={() => deleteMutation.mutate(dept.id)} disabled={deleteMutation.isPending}>Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
