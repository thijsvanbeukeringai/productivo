import { notFound } from 'next/navigation'
import { getCrewPortalData } from '@/lib/actions/crew.actions'
import { CrewPortalClient } from './CrewPortalClient'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function CrewPortalPage({ params }: PageProps) {
  const { token } = await params
  const result = await getCrewPortalData(token)

  if ('error' in result) notFound()

  return (
    <CrewPortalClient
      token={token}
      company={result.company}
      project={result.project}
      initialMembers={result.members as any}
      briefings={(result.briefings || []) as any}
      forms={(result.forms || []) as any}
    />
  )
}
