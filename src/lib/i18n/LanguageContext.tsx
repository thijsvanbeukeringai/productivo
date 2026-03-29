'use client'

import { createContext, useContext, useState } from 'react'
import { getTranslations, DEFAULT_LANG, type Lang, type Translations } from './translations'

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  T: Translations
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  T: getTranslations(DEFAULT_LANG),
})

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode
  initialLang: Lang
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  function setLang(newLang: Lang) {
    setLangState(newLang)
    // Persist in cookie so server components pick it up on next navigation
    if (typeof document !== 'undefined') {
      document.cookie = `ims-lang=${newLang}; path=/; max-age=31536000; SameSite=Lax`
    }
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, T: getTranslations(lang) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export function useTranslations(): Translations {
  return useContext(LanguageContext).T
}
