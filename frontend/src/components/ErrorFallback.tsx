export default function ErrorFallback() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">
        An unexpected error occurred while rendering this page. Please refresh the page. If the problem persists,
        try signing out and back in, or contact your administrator.
      </p>
    </div>
  );
}

