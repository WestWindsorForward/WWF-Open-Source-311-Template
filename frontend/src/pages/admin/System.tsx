import { useMutation } from "@tanstack/react-query";
import client from "../../api/client";

export function SystemPage() {
  const mutation = useMutation({
    mutationFn: async () => client.post("/api/admin/system/update"),
    onSuccess: () => { alert("System update initiated. The server will restart shortly with the latest code."); },
    onError: (error) => { alert(`Update failed: ${(error as any)?.message ?? "Unknown error"}`); },
  });
  const handleUpdate = () => {
    const confirmed = window.confirm("Server will restart and pull the latest code from the repository. This may take a few minutes. Continue?");
    if (confirmed) mutation.mutate();
  };
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">System Maintenance</h1>
        <p className="text-sm text-slate-500">Manage system updates and maintenance operations.</p>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h4 className="font-medium text-slate-900">Software Update</h4>
          <p className="text-sm text-slate-600">Pull the latest code from the repository and rebuild the server.</p>
        </div>
        <button onClick={handleUpdate} disabled={mutation.isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? "Updating..." : "Update Now"}
        </button>
      </div>
    </div>
  );
}

