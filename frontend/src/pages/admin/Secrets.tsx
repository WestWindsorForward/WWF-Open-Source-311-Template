import { useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../../api/client";
import { useSecrets } from "../../api/hooks";
import type { SecretSummary } from "../../types";
import { useState } from "react";
import InfoBox from "../../components/InfoBox";

type SecretFormState = { provider: string; key: string; secret: string; notes: string };

export function SecretsPage() {
  const queryClient = useQueryClient();
  const secretsQuery = useSecrets();
  const [form, setForm] = useState<SecretFormState>({ provider: "", key: "", secret: "", notes: "" });
  const storeMutation = useMutation({
    mutationFn: async (payload: SecretFormState) => {
      const metadata = payload.notes.trim() ? { notes: payload.notes.trim() } : undefined;
      await client.post("/api/admin/secrets", { provider: payload.provider.trim(), key: payload.key.trim(), secret: payload.secret.trim(), metadata });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secrets"] });
      setForm({ provider: "", key: "", secret: "", notes: "" });
    },
  });
  const smtpMutation = useMutation({
    mutationFn: async (smtp: { host: string; port: string; username: string; password: string; from_email: string; ssl: boolean }) => {
      const metadata = { host: smtp.host.trim(), port: Number(smtp.port) || 587, username: smtp.username.trim(), from_email: smtp.from_email.trim(), ssl: Boolean(smtp.ssl) };
      await client.post("/api/admin/secrets", { provider: "smtp", key: smtp.host.trim(), secret: smtp.password, metadata });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["secrets"] }),
  });
  const smsMutation = useMutation({
    mutationFn: async (sms: { provider_name: string; api_base_url: string; api_token: string; auth_header?: string; from_number?: string }) => {
      const metadata = {
        provider_name: sms.provider_name.trim(),
        api_base_url: sms.api_base_url.trim(),
        auth_header: (sms.auth_header || "Authorization").trim(),
        from_number: (sms.from_number || "").trim(),
      };
      await client.post("/api/admin/secrets", { provider: "sms", key: sms.provider_name.trim(), secret: sms.api_token, metadata });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["secrets"] }),
  });
  const vertexMutation = useMutation({
    mutationFn: async (vertex: { service_account_json: string }) => {
      await client.post("/api/admin/secrets", { provider: "vertex-ai", key: "service-account", secret: vertex.service_account_json, metadata: {} });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["secrets"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (secretId: string) => client.delete(`/api/admin/secrets/${secretId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["secrets"] }),
  });
  const secrets = secretsQuery.data ?? [];
  const canSubmit = form.provider.trim() && form.key.trim() && form.secret.trim();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Secrets</h1>
        <p className="text-sm text-slate-500">Store provider secrets securely. Values are write-only and masked after submission.</p>
      </div>
      <InfoBox title="Required Providers">
        <ul className="list-disc pl-5">
          <li>Email: SMTP credentials (host, port, username, password, from). Save below.</li>
          <li>SMS: Twilio Account SID/Auth Token/Messaging Service SID. Save below.</li>
          <li>AI: Vertex AI service account JSON. Save below; set project/region/model in Runtime Config.</li>
          <li>Maps: Google Maps API key is configured under Runtime Config (not stored as a secret).</li>
        </ul>
      </InfoBox>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">Email (SMTP)</p>
          <label className="text-sm text-slate-600">SMTP host<input className="mt-1 w-full rounded-md border p-2" id="smtp_host" /></label>
          <label className="text-sm text-slate-600">Port<input className="mt-1 w-full rounded-md border p-2" id="smtp_port" defaultValue="587" /></label>
          <label className="text-sm text-slate-600">Username<input className="mt-1 w-full rounded-md border p-2" id="smtp_username" /></label>
          <label className="text-sm text-slate-600">Password<input type="password" className="mt-1 w-full rounded-md border p-2" id="smtp_password" /></label>
          <label className="text-sm text-slate-600">From email<input className="mt-1 w-full rounded-md border p-2" id="smtp_from" placeholder="311@yourtown.gov" /></label>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" id="smtp_ssl" />Use SSL/TLS</label>
          <div className="mt-2 text-right">
            <button className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white" onClick={() => {
              const host = (document.getElementById("smtp_host") as HTMLInputElement).value;
              const port = (document.getElementById("smtp_port") as HTMLInputElement).value;
              const username = (document.getElementById("smtp_username") as HTMLInputElement).value;
              const password = (document.getElementById("smtp_password") as HTMLInputElement).value;
              const from_email = (document.getElementById("smtp_from") as HTMLInputElement).value;
              const ssl = (document.getElementById("smtp_ssl") as HTMLInputElement).checked;
              smtpMutation.mutate({ host, port, username, password, from_email, ssl });
            }}>Save SMTP</button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">SMS Provider (Generic)</p>
          <InfoBox><p>Supports any SMS API. Provide provider name, base URL, authorization header name (default Authorization), API token, and optional default from number.</p></InfoBox>
          <label className="text-sm text-slate-600">Provider name<input className="mt-1 w-full rounded-md border p-2" id="sms_provider_name" placeholder="twilio | msg91 | custom" /></label>
          <label className="text-sm text-slate-600">API base URL<input className="mt-1 w-full rounded-md border p-2" id="sms_api_base" placeholder="https://api.example.com/v1/messages" /></label>
          <label className="text-sm text-slate-600">Auth header name<input className="mt-1 w-full rounded-md border p-2" id="sms_auth_header" defaultValue="Authorization" /></label>
          <label className="text-sm text-slate-600">API token<input type="password" className="mt-1 w-full rounded-md border p-2" id="sms_api_token" /></label>
          <label className="text-sm text-slate-600">From number (optional)<input className="mt-1 w-full rounded-md border p-2" id="sms_from" placeholder="+15551234567" /></label>
          <div className="mt-2 text-right">
            <button className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white" onClick={() => {
              const provider_name = (document.getElementById("sms_provider_name") as HTMLInputElement).value;
              const api_base_url = (document.getElementById("sms_api_base") as HTMLInputElement).value;
              const auth_header = (document.getElementById("sms_auth_header") as HTMLInputElement).value;
              const api_token = (document.getElementById("sms_api_token") as HTMLInputElement).value;
              const from_number = (document.getElementById("sms_from") as HTMLInputElement).value;
              smsMutation.mutate({ provider_name, api_base_url, api_token, auth_header, from_number });
            }}>Save SMS Provider</button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">AI (Vertex AI)</p>
          <label className="text-sm text-slate-600">Service account JSON<textarea className="mt-1 h-24 w-full rounded-md border p-2 font-mono text-xs" id="vertex_json" placeholder='{"type":"service_account","project_id":"..."}' /></label>
          <InfoBox><p>Set project, region, and model under Runtime Config. The JSON here is stored securely and not displayed after saving.</p></InfoBox>
          <div className="mt-2 text-right">
            <button className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white" onClick={() => {
              const service_account_json = (document.getElementById("vertex_json") as HTMLTextAreaElement).value;
              vertexMutation.mutate({ service_account_json });
            }}>Save Vertex AI</button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-600">Provider<input className="mt-1 w-full rounded-xl border border-slate-300 p-2" placeholder="vertex-ai" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></label>
        <label className="text-sm text-slate-600">Key / identifier<input className="mt-1 w-full rounded-xl border border-slate-300 p-2" placeholder="service-account@project.iam.gserviceaccount.com" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></label>
        <label className="text-sm text-slate-600">Secret value<input type="password" className="mt-1 w-full rounded-xl border border-slate-300 p-2" placeholder="Paste API key or JSON" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} /><span className="text-xs text-slate-400">We never display this again after saving.</span></label>
        <label className="text-sm text-slate-600">Notes<input className="mt-1 w-full rounded-xl border border-slate-300 p-2" placeholder="Used for outbound email" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3"><button className="rounded-xl bg-slate-900 px-6 py-2 font-semibold text-white disabled:opacity-50" onClick={() => storeMutation.mutate(form)} disabled={storeMutation.isPending || !canSubmit}>{storeMutation.isPending ? "Storing…" : "Store secret"}</button></div>
      <div className="rounded-xl border border-slate-200">
        {secrets.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No secrets stored yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {secrets.map((secret: SecretSummary) => {
              const notes = secret.metadata && typeof secret.metadata["notes"] === "string" ? (secret.metadata["notes"] as string) : undefined;
              return (
                <li key={secret.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
                  <div>
                    <p className="font-semibold text-slate-700">{secret.provider}</p>
                    <p className="text-xs text-slate-500">Stored {new Date(secret.created_at).toLocaleString()}{notes ? ` · ${notes}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">••••••</span>
                    <button type="button" className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" onClick={() => deleteMutation.mutate(secret.id)} disabled={deleteMutation.isPending}>Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
