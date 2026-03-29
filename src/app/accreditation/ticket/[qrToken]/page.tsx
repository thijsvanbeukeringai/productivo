import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import QRCode from 'qrcode'

interface PageProps { params: Promise<{ qrToken: string }> }

const ROLE_LABELS: Record<string, string> = {
  crew: 'Crew', artist: 'Artiest', guest: 'Gast', supplier: 'Leverancier',
  press: 'Pers', vip: 'VIP', other: 'Overig',
}

const ROLE_COLORS: Record<string, string> = {
  crew: '#3b82f6', artist: '#a855f7', guest: '#22c55e',
  supplier: '#f97316', press: '#ec4899', vip: '#f59e0b', other: '#64748b',
}

export default async function TicketPage({ params }: PageProps) {
  const { qrToken } = await params
  const admin = createAdminClient()

  const { data: person } = await admin.from('accreditation_persons')
    .select(`
      id, first_name, last_name, role, status, qr_token,
      project_id, valid_days, approved_days,
      accreditation_person_zones(zone_id, accreditation_zones(name, color)),
      accreditation_person_items(id, item_type_id, quantity, accreditation_item_types(name))
    `)
    .eq('qr_token', qrToken)
    .single()

  if (!person) notFound()

  const { data: project } = await admin.from('projects')
    .select('name').eq('id', person.project_id).single()

  const qrDataUrl = await QRCode.toDataURL(qrToken, { width: 200, margin: 2 })

  const zones = (person.accreditation_person_zones as any[])
    .filter(pz => pz.accreditation_zones)
    .map(pz => pz.accreditation_zones as { name: string; color: string })

  const items = (person.accreditation_person_items as any[])
    .filter(pi => pi.quantity > 0 && pi.accreditation_item_types)
    .map(pi => ({ name: (pi.accreditation_item_types as { name: string }).name, quantity: pi.quantity as number }))

  const approvedDays = ((person as any).approved_days as string[] | null) || []
  const displayDays = approvedDays.length > 0 ? approvedDays : (((person as any).valid_days as string[] | null) || [])

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const roleColor = ROLE_COLORS[person.role] || ROLE_COLORS.other
  const roleLabel = ROLE_LABELS[person.role] || person.role

  return (
    <html lang="nl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Accreditatiebewijs – {person.first_name} {person.last_name}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
          .page { max-width: 480px; margin: 40px auto; padding: 0 16px 40px; }
          .card { background: white; border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); overflow: hidden; }
          .header { padding: 28px 28px 20px; border-bottom: 1px solid #e2e8f0; }
          .project-name { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 8px; }
          .person-name { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 10px; }
          .role-badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 13px; font-weight: 700; color: white; }
          .body { padding: 24px 28px; }
          .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; margin-bottom: 10px; }
          .zones { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
          .zone-pill { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: white; }
          .zone-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.6); }
          .items { list-style: none; margin-bottom: 20px; }
          .item-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
          .item-row:last-child { border-bottom: none; }
          .item-name { font-size: 14px; color: #334155; }
          .item-qty { font-size: 14px; font-weight: 700; color: #0f172a; }
          .qr-section { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px 0 4px; }
          .qr-img { width: 180px; height: 180px; border-radius: 12px; border: 1px solid #e2e8f0; }
          .qr-token { font-family: monospace; font-size: 11px; color: #94a3b8; }
          .footer { padding: 16px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
          .print-btn { padding: 8px 20px; background: #1e293b; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
          .print-btn:hover { background: #334155; }
          .no-zones { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
          .days { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
          .day-pill { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
          @media print {
            body { background: white; }
            .page { margin: 0; padding: 0; max-width: 100%; }
            .card { box-shadow: none; border: 1px solid #e2e8f0; }
            .footer { display: none; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          <div className="card">
            <div className="header">
              <p className="project-name">{project?.name || 'Event'}</p>
              <p className="person-name">{person.first_name} {person.last_name}</p>
              <span className="role-badge" style={{ backgroundColor: roleColor }}>{roleLabel}</span>
            </div>
            <div className="body">
              {zones.length > 0 && (
                <>
                  <p className="section-label">Toegangszones</p>
                  <div className="zones">
                    {zones.map((z, i) => (
                      <span key={i} className="zone-pill" style={{ backgroundColor: z.color }}>
                        <span className="zone-dot" />
                        {z.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {displayDays.length > 0 && (
                <>
                  <p className="section-label">{approvedDays.length > 0 ? 'Approved days' : 'Days'}</p>
                  <div className="days">
                    {displayDays.sort().map(d => (
                      <span key={d} className="day-pill">{formatDate(d)}</span>
                    ))}
                  </div>
                </>
              )}
              {items.length > 0 && (
                <>
                  <p className="section-label">Items</p>
                  <ul className="items">
                    {items.map((item, i) => (
                      <li key={i} className="item-row">
                        <span className="item-name">{item.name}</span>
                        <span className="item-qty">×{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="qr-section">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR code" className="qr-img" />
                <span className="qr-token">{qrToken}</span>
              </div>
            </div>
            <div className="footer">
              <span style={{ fontSize: 12, color: '#94a3b8' }}>IMS · Accreditatiebewijs</span>
              <button className="print-btn" id="print-btn">Afdrukken</button>
            </div>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: 'document.getElementById("print-btn").addEventListener("click",function(){window.print()})' }} />
      </body>
    </html>
  )
}
