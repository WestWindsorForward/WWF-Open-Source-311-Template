import { useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../../api/client";
import { useAdminCategories, useDepartments } from "../../api/hooks";
import type { AdminCategory, Department } from "../../types";
import { useState } from "react";

type CategoryFormState = { slug: string; name: string; description: string; default_department_slug: string };

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const categoriesQuery = useAdminCategories();
  const departmentsQuery = useDepartments();
  const [form, setForm] = useState<CategoryFormState>({ slug: "", name: "", description: "", default_department_slug: "" });
  const createMutation = useMutation({
    mutationFn: async (payload: CategoryFormState) => client.post("/api/admin/categories", { ...payload, default_priority: "medium" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setForm({ slug: "", name: "", description: "", default_department_slug: "" });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (categoryId: number) => client.delete(`/api/admin/categories/${categoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });
  const categories = categoriesQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const updateMutation = useMutation({
    mutationFn: async (category: AdminCategory) => client.put(`/api/admin/categories/${category.id}`, { name: category.name, slug: category.slug, description: category.description, default_department_slug: (category as any).default_department_slug ?? undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-slate-500">Link categories to departments for routing.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-600">
          Category slug
          <input className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </label>
        <label className="text-sm text-slate-600">
          Display name
          <input className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="text-sm text-slate-600 md:col-span-2">
          Description
          <textarea className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="text-sm text-slate-600 md:col-span-2">
          Owning department
          <select className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.default_department_slug} onChange={(e) => setForm({ ...form, default_department_slug: e.target.value })}>
            <option value="">Unassigned</option>
            {departments.map((dept: Department) => (
              <option key={dept.id} value={dept.slug}>{dept.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-end gap-3">
        <button className="rounded-xl bg-emerald-600 px-4 py-2 text-white disabled:opacity-50" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving…" : "Add Category"}
        </button>
      </div>
      {categories.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {categories.map((category: AdminCategory) => (
            <li key={category.id} className="p-3 text-sm">
              <div className="grid gap-2 md:grid-cols-2">
                <input className="rounded-md border p-2" value={category.name} onChange={(e) => (category.name = e.target.value)} />
                <input className="rounded-md border p-2" value={category.slug} onChange={(e) => (category.slug = e.target.value)} />
                <textarea className="rounded-md border p-2 md:col-span-2" value={category.description ?? ""} onChange={(e) => (category.description = e.target.value)} />
                <label className="text-sm text-slate-600 md:col-span-2">
                  Owning department
                  <select className="mt-1 w-full rounded-md border p-2" value={(category as any).default_department_slug ?? ""} onChange={(e) => ((category as any).default_department_slug = e.target.value)}>
                    <option value="">Unassigned</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.slug}>{dept.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-2 flex items-center justify-end gap-2">
                <button className="rounded-full border border-slate-200 px-3 py-1 text-xs" onClick={() => updateMutation.mutate({ ...category })} disabled={updateMutation.isPending}>Save</button>
                <button type="button" className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" onClick={() => deleteMutation.mutate(category.id)} disabled={deleteMutation.isPending}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
