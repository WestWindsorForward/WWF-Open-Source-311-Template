import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStaffRequests } from "../../api/hooks";
import client from "../../api/client";

export function RequestsPage() {
  const queryClient = useQueryClient();
  const requestsQuery = useStaffRequests();
  const deleteMutation = useMutation({
    mutationFn: async (requestId: string) => client.delete(`/api/admin/requests/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-requests"] });
      queryClient.invalidateQueries({ queryKey: ["recent-requests"], exact: false });
    },
  });
  const recent = (requestsQuery.data ?? []).slice(0, 8);
  const handleCopy = async (externalId: string) => {
    const shareUrl = `${window.location.origin}/?request=${externalId}`;
    try { await navigator.clipboard.writeText(shareUrl); } catch { window.prompt("Copy request link", shareUrl); }
  };
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Service Requests</h1>
        <p className="text-sm text-slate-500">Review recent submissions and manage duplicates.</p>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-slate-500">No requests have been submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {recent.map((request) => (
            <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">{request.description || "No description provided"}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{request.status}</p>
                  <p className="text-xs text-slate-500">#{request.external_id} · {request.service_code} · {new Date(request.created_at).toLocaleString()}</p>
                  {request.jurisdiction_warning && (<p className="text-xs text-amber-600">{request.jurisdiction_warning}</p>)}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => handleCopy(request.external_id)}>Copy resident link</button>
                  <button type="button" className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50" onClick={() => deleteMutation.mutate(request.id)} disabled={deleteMutation.isPending}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

