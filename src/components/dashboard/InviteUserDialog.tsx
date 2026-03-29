'use client'

import { useState, useTransition } from 'react'
import { inviteCompanyUser } from '@/lib/actions/company.actions'

interface Props {
  companyId: string
}

export function InviteUserDialog({ companyId }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    formData.set('company_id', companyId)
    setError('')
    setSuccess('')
    startTransition(async () => {
      const result = await inviteCompanyUser(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(result?.existing ? 'Gebruiker toegevoegd.' : 'Uitnodiging verstuurd.')
        setTimeout(() => { setOpen(false); setSuccess('') }, 1500)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        + Gebruiker uitnodigen
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white">Gebruiker uitnodigen</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form action={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mailadres *</label>
                <input
                  name="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="naam@bedrijf.nl"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol *</label>
                <select
                  name="role"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="centralist">Centralist</option>
                  <option value="company_admin">Company Admin</option>
                </select>
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  Annuleren
                </button>
                <button type="submit"
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                  Uitnodigen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
