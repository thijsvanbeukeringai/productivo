import { AccreditationPortalClient } from './AccreditationPortalClient'
import { getAccreditationPortalData } from '@/lib/actions/accreditation.actions'

interface PageProps { params: Promise<{ token: string }> }

export default async function AccreditationPortalPage({ params }: PageProps) {
  const { token } = await params
  const data = await getAccreditationPortalData(token)

  if ('error' in data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-red-200 px-6 py-8 max-w-sm w-full text-center">
          <p className="text-red-600 font-medium mb-2">Ongeldige link</p>
          <p className="text-sm text-slate-500">{data.error}</p>
        </div>
      </div>
    )
  }

  return (
    <AccreditationPortalClient
      token={token}
      group={data.group as any}
      project={data.project}
      allDays={(data.allDays || []) as any}
      dayMeals={(data.dayMeals || {}) as any}
      zones={data.zones as any}
      itemTypes={(data.itemTypes || []) as any}
      usedPerItem={(data.usedPerItem || {}) as any}
      dayItems={(data.dayItems || {}) as any}
      initialPersons={data.persons as any}
      briefings={(data.briefings || []) as any}
    />
  )
}
