'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, markMessagesRead } from '@/lib/actions/chat.actions'
import { formatTimestamp } from '@/lib/utils/format-timestamp'

interface Message {
  id: string
  project_id: string
  sender_id: string
  receiver_id: string
  display_name_snapshot: string
  content: string
  created_at: string
  is_read: boolean
}

interface Member {
  user_id: string
  display_name: string
}

interface Toast {
  senderId: string
  senderName: string
  text: string
}

interface Props {
  projectId: string
  currentUserId: string
  currentDisplayName: string
  members: Member[]
}

export function ProjectChat({ projectId, currentUserId, currentDisplayName, members }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const [toasts, setToasts] = useState<Toast[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Ref so the realtime handler always sees current selected conversation
  const selectedMemberRef = useRef<Member | null>(null)
  const supabase = createClient()

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0)

  useEffect(() => {
    selectedMemberRef.current = selectedMember
  }, [selectedMember])

  // On mount: load persisted unread counts from DB
  useEffect(() => {
    supabase
      .from('project_messages')
      .select('sender_id')
      .eq('project_id', projectId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false)
      .then(({ data }) => {
        if (!data) return
        const counts: Record<string, number> = {}
        for (const row of data) {
          counts[row.sender_id] = (counts[row.sender_id] || 0) + 1
        }
        setUnreadMap(counts)
      })
  }, [projectId, currentUserId])

  // Load full conversation history when a member is selected
  useEffect(() => {
    if (!selectedMember) return
    supabase
      .from('project_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedMember.user_id}),` +
        `and(sender_id.eq.${selectedMember.user_id},receiver_id.eq.${currentUserId})`
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as Message[]) })
  }, [selectedMember])

  // Scroll to bottom when messages change or conversation opens
  useEffect(() => {
    if (selectedMember) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [messages, selectedMember])

  // Focus input when conversation opens
  useEffect(() => {
    if (selectedMember) setTimeout(() => inputRef.current?.focus(), 100)
  }, [selectedMember])

  // Realtime subscription — new incoming messages
  useEffect(() => {
    const channel = supabase
      .channel(`dm:${currentUserId}:${projectId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_messages',
        filter: `receiver_id=eq.${currentUserId}`,
      }, (payload) => {
        const msg = payload.new as Message
        if (msg.project_id !== projectId) return

        const current = selectedMemberRef.current
        const isOpenConvo = current?.user_id === msg.sender_id

        if (isOpenConvo) {
          // Already in this conversation — append and mark read immediately
          setMessages(prev => [...prev, msg])
          markMessagesRead(projectId, msg.sender_id, currentUserId)
        } else {
          // Different or no conversation open — increment unread + show toast
          setUnreadMap(prev => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }))
          setToasts(prev => {
            const filtered = prev.filter(t => t.senderId !== msg.sender_id)
            return [...filtered, {
              senderId: msg.sender_id,
              senderName: msg.display_name_snapshot,
              text: msg.content,
            }]
          })
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.senderId !== msg.sender_id))
          }, 7000)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [currentUserId, projectId])

  // When conversation is opened: mark all their messages as read
  useEffect(() => {
    if (!selectedMember) return
    setUnreadMap(prev => ({ ...prev, [selectedMember.user_id]: 0 }))
    markMessagesRead(projectId, selectedMember.user_id, currentUserId)
  }, [selectedMember])

  function openConversation(senderId: string) {
    const member = members.find(m => m.user_id === senderId)
    if (!member) return
    setSelectedMember(member)
    setOpen(true)
    setToasts(prev => prev.filter(t => t.senderId !== senderId))
  }

  async function handleSend() {
    if (!input.trim() || !selectedMember) return
    const content = input.trim()
    setInput('')
    const optimistic: Message = {
      id: crypto.randomUUID(),
      project_id: projectId,
      sender_id: currentUserId,
      receiver_id: selectedMember.user_id,
      display_name_snapshot: currentDisplayName,
      content,
      created_at: new Date().toISOString(),
      is_read: false,
    }
    setMessages(prev => [...prev, optimistic])
    await sendMessage(projectId, content, currentDisplayName, selectedMember.user_id)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
  }

  function handleClose() {
    setOpen(false)
    setSelectedMember(null)
  }

  return (
    <>
      {/* Toast notifications — stacked top-right */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.senderId}
            onClick={() => openConversation(t.senderId)}
            className="pointer-events-auto flex items-start gap-3 bg-slate-900 dark:bg-slate-700 text-white px-4 py-3 rounded-xl shadow-xl cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors max-w-xs"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {t.senderName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200">{t.senderName}</p>
              <p className="text-sm truncate mt-0.5">{t.text}</p>
              <p className="text-xs text-slate-400 mt-1">Tik om gesprek te openen</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setToasts(prev => prev.filter(x => x.senderId !== t.senderId)) }}
              className="text-slate-400 hover:text-white shrink-0 mt-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Chat popup */}
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
          style={{ height: 440 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
            {selectedMember ? (
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setSelectedMember(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
                  {selectedMember.display_name.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selectedMember.display_name}</span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Chat</span>
            )}
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 ml-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Member list */}
          {!selectedMember && (
            <div className="flex-1 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Geen andere leden in dit project.</p>
              ) : (
                members.map(member => (
                  <button
                    key={member.user_id}
                    onClick={() => openConversation(member.user_id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center shrink-0">
                      {member.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{member.display_name}</p>
                    </div>
                    {(unreadMap[member.user_id] || 0) > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                        {unreadMap[member.user_id] > 9 ? '9+' : unreadMap[member.user_id]}
                      </span>
                    )}
                    <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Conversation */}
          {selectedMember && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-xs text-slate-400 text-center pt-8">
                    Nog geen berichten met {selectedMember.display_name}
                  </p>
                )}
                {messages.map(msg => {
                  const isOwn = msg.sender_id === currentUserId
                  return (
                    <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-sm ${
                        isOwn
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5 px-1">
                        {formatTimestamp(msg.created_at)}
                      </span>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 shrink-0">
                <div className="flex gap-2 items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Bericht aan ${selectedMember.display_name}…`}
                    className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {totalUnread > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </div>
        )}
      </button>
    </>
  )
}
