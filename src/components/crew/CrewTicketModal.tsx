'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface PlanningRow {
  id: string
  work_date: string
  status: string
}

interface Wristband {
  id: string
  name: string
  color: string
}

interface Props {
  memberId: string
  firstName: string
  lastName: string
  companyName: string
  projectName: string
  approvedDays: PlanningRow[]
  wristband: Wristband | null
  onClose: () => void
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function CrewTicketModal({
  memberId,
  firstName,
  lastName,
  companyName,
  projectName,
  approvedDays,
  wristband,
  onClose,
}: Props) {
  const T = useTranslations()

  const sortedDays = [...approvedDays].sort((a, b) => a.work_date.localeCompare(b.work_date))

  return (
    <>
      {/* Screen: modal overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 print:hidden"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
            <span className="text-sm font-semibold text-slate-700 dark:text-white">{T.crew.ticket}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
              >
                🖨 {T.crew.printTicket}
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Ticket preview */}
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 p-2 bg-white rounded-xl border border-slate-200">
                <QRCodeSVG value={memberId} size={100} level="M" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-xs text-slate-400 mb-0.5">{projectName}</p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {firstName} {lastName}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{companyName}</p>
                {wristband && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: wristband.color }}
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{wristband.name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-dashed border-slate-200 dark:border-slate-700" />
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {T.crew.approvedDates}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sortedDays.map(day => (
                  <span
                    key={day.id}
                    className="text-xs px-2 py-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 rounded-lg font-medium border border-green-200 dark:border-green-800"
                  >
                    {formatDay(day.work_date)}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center pt-1">
              ID: {memberId.slice(0, 8)}…
            </p>
          </div>
        </div>
      </div>

      {/* Print-only: full-page ticket */}
      <div id="crew-ticket-print" aria-hidden="true">
        <div className="ticket-header">
          <strong>{projectName}</strong>
        </div>

        <div className="ticket-qr">
          <QRCodeSVG value={memberId} size={200} level="H" />
        </div>

        <table className="ticket-table">
          <tbody>
            <tr>
              <td className="ticket-label">Naam</td>
              <td className="ticket-value">{firstName} {lastName}</td>
            </tr>
            <tr>
              <td className="ticket-label">Bedrijf</td>
              <td className="ticket-value">{companyName}</td>
            </tr>
            {wristband && (
              <tr>
                <td className="ticket-label">Polsbandje</td>
                <td className="ticket-value">
                  <span className="ticket-dot" style={{ backgroundColor: wristband.color }} />
                  {wristband.name}
                </td>
              </tr>
            )}
            <tr>
              <td className="ticket-label">Werkdagen</td>
              <td className="ticket-value">{sortedDays.map(d => formatDay(d.work_date)).join('  ·  ')}</td>
            </tr>
            <tr>
              <td className="ticket-label">ID</td>
              <td className="ticket-value ticket-id">{memberId}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <style>{`
        #crew-ticket-print {
          display: none;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #crew-ticket-print,
          #crew-ticket-print * {
            visibility: visible;
          }
          #crew-ticket-print {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 40px;
            font-family: Arial, sans-serif;
            color: #000;
            background: #fff;
          }
          .ticket-header {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 24px;
          }
          .ticket-qr {
            margin-bottom: 28px;
          }
          .ticket-table {
            border-collapse: collapse;
            width: 100%;
            max-width: 480px;
          }
          .ticket-table td {
            padding: 6px 0;
            vertical-align: top;
            font-size: 13px;
            line-height: 1.5;
          }
          .ticket-label {
            width: 120px;
            color: #666;
            padding-right: 16px;
          }
          .ticket-value {
            color: #000;
            font-weight: 500;
          }
          .ticket-id {
            font-size: 10px;
            font-weight: normal;
            color: #999;
            word-break: break-all;
          }
          .ticket-dot {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 6px;
            vertical-align: middle;
          }
        }
      `}</style>
    </>
  )
}
