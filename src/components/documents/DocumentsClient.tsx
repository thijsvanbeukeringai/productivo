'use client'

import { useState, useRef, useTransition } from 'react'
import { uploadDocument, deleteDocument } from '@/lib/actions/document.actions'
import { DocumentChat } from './DocumentChat'
import { formatDate } from '@/lib/utils/format-timestamp'
import { useTranslations } from '@/lib/i18n/LanguageContext'

interface Doc {
  id: string
  name: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  created_at: string
  uploader_name: string | null
}

interface Props {
  projectId: string
  documents: Doc[]
  canEdit: boolean
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(mime: string | null) {
  if (mime?.includes('pdf')) return '📄'
  if (mime?.includes('word') || mime?.includes('document')) return '📝'
  if (mime?.includes('sheet') || mime?.includes('excel')) return '📊'
  if (mime?.includes('text')) return '📃'
  return '📁'
}

export function DocumentsClient({ projectId, documents, canEdit }: Props) {
  const T = useTranslations()
  const [chatDoc, setChatDoc] = useState<Doc | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [, startDelete] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')

    const fd = new FormData()
    fd.set('file', file)
    fd.set('project_id', projectId)
    const result = await uploadDocument(fd)
    if (result?.error) setUploadError(result.error)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDelete(doc: Doc) {
    if (!confirm(`"${doc.name}" verwijderen?`)) return
    startDelete(async () => { await deleteDocument(doc.id, projectId, doc.file_url) })
  }

  return (
    <>
      {/* Upload */}
      {canEdit && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{T.documents.upload}</p>
              <p className="text-xs text-slate-400 mt-0.5">PDF, Word, Excel of tekstbestanden</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {T.documents.uploading}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {T.documents.upload}
                </>
              )}
            </button>
          </div>
          {uploadError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{uploadError}</p>}
          <input ref={fileInputRef} type="file" className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv"
            onChange={handleUpload} />
        </div>
      )}

      {/* Documents list */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {documents.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">{T.documents.noDocuments}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <span className="text-2xl shrink-0">{fileIcon(doc.mime_type)}</span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{doc.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(doc.created_at)}
                    {doc.uploader_name && ` · ${doc.uploader_name}`}
                    {doc.file_size && ` · ${formatBytes(doc.file_size)}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Ask questions button */}
                  <button
                    onClick={() => setChatDoc(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Vragen stellen
                  </button>

                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title={T.documents.download}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>

                  {canEdit && (
                    <button onClick={() => handleDelete(doc)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title={T.documents.delete}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {chatDoc && (
        <DocumentChat document={chatDoc} onClose={() => setChatDoc(null)} />
      )}
    </>
  )
}
