import { cookies } from 'next/headers'
import { getTranslations, DEFAULT_LANG, type Lang, type Translations } from './translations'

export async function getServerTranslations(): Promise<Translations> {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('ims-lang')?.value || DEFAULT_LANG) as Lang
  return getTranslations(lang)
}

export async function getServerLang(): Promise<Lang> {
  const cookieStore = await cookies()
  return (cookieStore.get('ims-lang')?.value || DEFAULT_LANG) as Lang
}
