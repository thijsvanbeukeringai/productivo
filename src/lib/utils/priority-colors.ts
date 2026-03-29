import type { LogPriority } from '@/types/app.types'

export const priorityConfig: Record<LogPriority, {
  label: string
  bg: string
  text: string
  border: string
  row: string
  cardBody: string
  cardBorder: string
  idBadge: string
}> = {
  info: {
    label: 'Info',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    row: 'border-l-4 border-l-blue-400',
    cardBody: 'bg-blue-50 dark:bg-blue-950/20',
    cardBorder: 'border-blue-200 dark:border-blue-800',
    idBadge: 'bg-blue-600',
  },
  low: {
    label: 'Laag',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    row: 'border-l-4 border-l-green-400',
    cardBody: 'bg-green-50 dark:bg-green-950/20',
    cardBorder: 'border-green-200 dark:border-green-800',
    idBadge: 'bg-green-600',
  },
  mid: {
    label: 'Midden',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    row: 'border-l-4 border-l-amber-400',
    cardBody: 'bg-amber-50 dark:bg-amber-950/20',
    cardBorder: 'border-amber-200 dark:border-amber-800',
    idBadge: 'bg-orange-500',
  },
  high: {
    label: 'Hoog',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    row: 'border-l-4 border-l-red-500',
    cardBody: 'bg-red-50 dark:bg-red-950/20',
    cardBorder: 'border-red-200 dark:border-red-800',
    idBadge: 'bg-red-600',
  },
}

export const areaStatusConfig = {
  open: { label: 'Open', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  regulated: { label: 'Gereguleerd', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  closed: { label: 'Gesloten', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
}

export const enforcementConfig = {
  ejection: { label: 'Uitzetting', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  arrest:   { label: 'Aanhouding', color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  refusal:  { label: 'Weigering',  color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ban:      { label: 'Ontzegging', color: 'text-gray-600',   bg: 'bg-gray-50 dark:bg-gray-900/20' },
}

export const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Bedrijf Admin',
  centralist: 'Centralist',
  planner: 'Planner',
  runner: 'Runner',
}
