'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { MODULE_CONFIG, ALWAYS_VISIBLE, type ModuleKey } from '@/lib/utils/modules'
import { useTranslations } from '@/lib/i18n/LanguageContext'

const ICONS: Record<ModuleKey, React.ReactNode> = {
  map: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  logbook: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  guestlist: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  artist: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  machinery: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  forms: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  briefings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  accreditation: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

// Sub-navigation items for the Accreditation module
const ACC_SUB_ITEMS: Array<{ label: string; tab: string; href: string }> = [
  { label: 'Planning',     tab: 'persons',   href: '' },
  { label: 'Bedrijven',    tab: 'groups',    href: '?tab=groups' },
  { label: 'Bestellingen', tab: 'orders',    href: '?tab=orders' },
  { label: 'Briefings',    tab: 'briefings', href: '?tab=briefings' },
  { label: 'Configuratie', tab: 'setup',     href: '?tab=setup' },
  { label: 'Dashboard',    tab: 'dashboard', href: '?tab=dashboard' },
]

interface Props {
  projectId: string
  activeModules: string[]
  canAdmin: boolean
}

export function ProjectSidebar({ projectId, activeModules, canAdmin }: Props) {
  const [collapsed, setCollapsed] = useState(true)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const T = useTranslations()

  useEffect(() => {
    const saved = localStorage.getItem('ims-sidebar-collapsed')
    if (saved !== null) setCollapsed(saved === 'true')
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('ims-sidebar-collapsed', String(next))
  }

  const entries = Object.entries(MODULE_CONFIG) as [ModuleKey, (typeof MODULE_CONFIG)[ModuleKey]][]
  const effectiveModules = activeModules.length === 0 ? ['logbook', 'map', ...activeModules] : activeModules
  const visible = entries.filter(([key]) => {
    if (ALWAYS_VISIBLE.includes(key)) return true
    return effectiveModules.includes(key)
  })

  const accBase = `/project/${projectId}/accreditation`

  return (
    <aside className={`${collapsed ? 'w-12' : 'w-44'} bg-slate-900 flex flex-col shrink-0 transition-[width] duration-200`}>
      <nav className="flex-1 py-2 overflow-hidden">
        {visible.map(([key, cfg]) => {
          const href = `/project/${projectId}/${cfg.href}`
          const isActive = pathname === href || pathname.startsWith(href + '/')

          if (key === 'accreditation') {
            const currentTab = pathname.startsWith(accBase + '/checkin')
              ? 'checkin'
              : (searchParams.get('tab') || 'persons')

            return (
              <div key={key}>
                {/* Module link */}
                <Link
                  href={accBase}
                  title={collapsed ? cfg.label : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="shrink-0">{ICONS[key]}</span>
                  {!collapsed && (
                    <span className="text-xs font-medium overflow-hidden">
                      {T.modules[key as keyof typeof T.modules] ?? cfg.label}
                    </span>
                  )}
                </Link>

                {/* Sub-items — only when expanded + on an accreditation route */}
                {!collapsed && isActive && (
                  <div className="border-l border-slate-700 ml-6 my-0.5">
                    {ACC_SUB_ITEMS.map(item => {
                      const subHref = item.href === '/checkin'
                        ? `${accBase}/checkin`
                        : item.href
                          ? `${accBase}${item.href}`
                          : accBase
                      const subActive = currentTab === item.tab
                      return (
                        <Link
                          key={item.tab}
                          href={subHref}
                          className={`flex items-center px-3 py-1.5 text-xs transition-colors whitespace-nowrap ${
                            subActive
                              ? 'text-white font-medium'
                              : 'text-slate-500 hover:text-slate-200'
                          }`}
                        >
                          {subActive && (
                            <span className="w-1 h-1 rounded-full bg-white mr-2 shrink-0" />
                          )}
                          {!subActive && <span className="w-1 h-1 mr-2 shrink-0" />}
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={key}
              href={href}
              title={collapsed ? cfg.label : undefined}
              className={`flex items-center gap-3 px-3.5 py-2.5 transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="shrink-0">{ICONS[key]}</span>
              {!collapsed && (
                <span className="text-xs font-medium overflow-hidden">
                  {T.modules[key as keyof typeof T.modules] ?? cfg.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={toggle}
        className="p-3 text-slate-500 hover:text-white transition-colors flex justify-center border-t border-slate-800"
        title={collapsed ? T.sidebar.expand : T.sidebar.collapse}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {collapsed
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          }
        </svg>
      </button>
    </aside>
  )
}
