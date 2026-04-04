export type ModuleKey = 'logbook' | 'map' | 'guestlist' | 'artist' | 'machinery' | 'briefings' | 'forms' | 'accreditation' | 'settings'

export interface ModuleConfig {
  label: string
  href: string
}

export const MODULE_CONFIG: Record<ModuleKey, ModuleConfig> = {
  logbook:   { label: 'Logboek',     href: 'logbook' },
  map:       { label: 'Kaart',       href: 'map' },
  guestlist: { label: 'Gastenlijst', href: 'guestlist' },
  artist:    { label: 'Artiesten',   href: 'artist' },
  machinery: { label: 'Materieel',   href: 'machinery' },
  briefings: { label: 'Briefings',   href: 'briefings' },
  forms:         { label: 'Formulieren',  href: 'forms' },
  accreditation: { label: 'Accreditatie', href: 'accreditation' },
  settings:      { label: 'Instellingen', href: 'settings' },
}

// Always visible regardless of active_modules (settings cannot be disabled)
export const ALWAYS_VISIBLE: ModuleKey[] = ['settings', 'map']

// Modules that can be toggled on/off per project by super admin
export const TOGGLEABLE_MODULES: ModuleKey[] = ['logbook', 'map', 'guestlist', 'artist', 'machinery', 'briefings', 'forms', 'accreditation']
