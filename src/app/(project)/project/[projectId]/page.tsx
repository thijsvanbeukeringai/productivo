import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function ProjectRootPage({ params }: PageProps) {
  const { projectId } = await params
  redirect(`/project/${projectId}/logbook`)
}
