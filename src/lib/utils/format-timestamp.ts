export function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Amsterdam',
  })
}

export function formatDate(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  })
}

export function formatDatetime(ts: string): string {
  return `${formatDate(ts)} ${formatTimestamp(ts)}`
}

export function getShiftDateLabel(shiftDate: string): string {
  const from = new Date(shiftDate + 'T07:00:00')
  const to = new Date(from)
  to.setDate(to.getDate() + 1)

  const fmtDay = (d: Date) => d.toLocaleDateString('nl-NL', {
    day: '2-digit', month: 'short', timeZone: 'Europe/Amsterdam'
  })
  return `${fmtDay(from)} 07:00 → ${fmtDay(to)} 07:00`
}
