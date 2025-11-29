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
            <li key={dept.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium">{dept.name}</p>
                <p className="text-xs uppercase text-slate-500">{dept.slug}</p>
              </div>
              <button type="button" className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" onClick={() => deleteMutation.mutate(dept.id)} disabled={deleteMutation.isPending}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

