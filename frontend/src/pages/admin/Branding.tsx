import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../../api/client";
import { useResidentConfig } from "../../api/hooks";
import { useState } from "react";

type BrandingForm = {
  town_name: string;
  site_title: string;
  hero_text: string;
  primary_color: string;
  secondary_color: string;
};

export function BrandingPage() {
  const queryClient = useQueryClient();
  const { data, refetch } = useResidentConfig();
  const defaults = data?.branding ?? {};
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const { register, handleSubmit, reset } = useForm<BrandingForm>({
    defaultValues: {
      town_name: defaults.town_name ?? "",
      site_title: defaults.site_title ?? "",
      hero_text: defaults.hero_text ?? "",
      primary_color: defaults.primary_color ?? "#0f172a",
      secondary_color: defaults.secondary_color ?? "#38bdf8",
    },
  });
  const [saved, setSaved] = useState<{ branding?: boolean; logo?: boolean; favicon?: boolean }>({});

  const mutation = useMutation({
    mutationFn: async (payload: BrandingForm) => {
      await client.put("/api/admin/branding", payload);
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        await client.post("/api/admin/branding/assets/logo", fd);
        setSaved((s) => ({ ...s, logo: true }));
      }
      if (faviconFile) {
        const fd = new FormData();
        fd.append("file", faviconFile);
        await client.post("/api/admin/branding/assets/favicon", fd);
        setSaved((s) => ({ ...s, favicon: true }));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resident-config"] });
      await refetch();
      setSaved((s) => ({ ...s, branding: true }));
      setLogoFile(null);
      setFaviconFile(null);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    reset(values);
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-sm text-slate-500">Colors and hero copy shown on the resident portal.</p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-600">
          Town name
          <input className="mt-1 w-full rounded-xl border border-slate-300 p-2" {...register("town_name")} />
        </label>
        <label className="text-sm text-slate-600">
          Site title
          <input className="mt-1 w-full rounded-xl border border-slate-300 p-2" {...register("site_title")} />
        </label>
        <label className="text-sm text-slate-600 md:col-span-2">
          Hero text
          <input className="mt-1 w-full rounded-xl border border-slate-300 p-2" {...register("hero_text")} />
        </label>
        <label className="text-sm text-slate-600">
          Primary color
          <input className="mt-1 w-full rounded-xl border border-slate-300 p-2" {...register("primary_color")} />
        </label>
        <label className="text-sm text-slate-600">
          Secondary color
          <input className="mt-1 w-full rounded-xl border border-slate-300 p-2" {...register("secondary_color")} />
        </label>
        <label className="text-sm text-slate-600">
          Township logo
          <input
            type="file"
            accept="image/*"
            className="mt-1 w-full rounded-xl border border-dashed border-slate-300 p-2"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-slate-500">Appears in the site header and resident portal preview.</p>
        </label>
        <label className="text-sm text-slate-600">
          Browser favicon
          <input
            type="file"
            accept="image/png,image/x-icon,image/svg+xml"
            className="mt-1 w-full rounded-xl border border-dashed border-slate-300 p-2"
            onChange={(e) => setFaviconFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-slate-500">Use a square image (64px+) to update the tab icon.</p>
        </label>
        <div className="md:col-span-2 flex items-center justify-end gap-3">
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-50" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
          {(saved.branding || saved.logo || saved.favicon) && (
            <span role="status" className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              {saved.logo || saved.favicon ? "Assets saved" : "Branding saved"}
            </span>
          )}
        </div>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Logo</h3>
          {data?.branding?.logo_url ? (
            <div className="mt-3 flex items-center justify-between">
              <img src={data.branding.logo_url} alt="Logo" className="h-10 w-auto rounded-md border object-contain" height={40} decoding="async" fetchpriority="high" />
              <div className="flex items-center gap-2">
                <button className="rounded-md border border-slate-200 px-3 py-1 text-xs" onClick={() => setLogoFile(null)}>Replace</button>
                <button className="rounded-md border border-rose-200 px-3 py-1 text-xs text-rose-600" onClick={async () => { await client.delete("/api/admin/branding/assets/logo"); await refetch(); }}>Delete</button>
              </div>
            </div>
          ) : (
            <label className="text-sm text-slate-600 mt-2">
              Upload logo
              <input type="file" accept="image/*" className="mt-1 w-full rounded-xl border border-dashed border-slate-300 p-2" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Favicon</h3>
          {data?.branding?.favicon_url ? (
            <div className="mt-3 flex items-center justify-between">
              <img src={data.branding.favicon_url} alt="Favicon" className="h-8 w-8 rounded-md border object-contain" height={32} decoding="async" />
              <div className="flex items-center gap-2">
                <button className="rounded-md border border-slate-200 px-3 py-1 text-xs" onClick={() => setFaviconFile(null)}>Replace</button>
                <button className="rounded-md border border-rose-200 px-3 py-1 text-xs text-rose-600" onClick={async () => { await client.delete("/api/admin/branding/assets/favicon"); await refetch(); }}>Delete</button>
              </div>
            </div>
          ) : (
            <label className="text-sm text-slate-600 mt-2">
              Upload favicon
              <input type="file" accept="image/png,image/x-icon,image/svg+xml" className="mt-1 w-full rounded-xl border border-dashed border-slate-300 p-2" onChange={(e) => setFaviconFile(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
