import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Outlet />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Τοπικό UI σύνδεσης Supabase.
        </p>
      </main>
    </div>
  )
}
