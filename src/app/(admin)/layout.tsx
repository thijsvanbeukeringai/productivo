import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { logout } from '@/lib/actions/auth.actions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .limit(1)
    .single()

  if (!membership) redirect('/dashboard')

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Top bar */}
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 bg-red-600 rounded text-white font-bold tracking-wide">SUPER ADMIN</span>
          <span className="font-bold text-white">IMS Beheer</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-slate-300 hover:text-white transition-colors">
            ← Dashboard
          </a>
          <ThemeToggle />
          <form action={logout}>
            <button type="submit" className="text-sm text-slate-400 hover:text-red-400 transition-colors">
              Uitloggen
            </button>
          </form>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
