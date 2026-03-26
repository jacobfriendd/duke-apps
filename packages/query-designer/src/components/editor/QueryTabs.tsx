import { useState, useRef, useEffect } from 'react'
import { Plus, X, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { QueryRecord } from '@/types/query'

export interface QueryTabItem {
  id: string
  record: QueryRecord | null
  label: string
  dirty?: boolean
}

interface QueryTabsProps {
  tabs: QueryTabItem[]
  activeTabId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
}

export function QueryTabs({ tabs, activeTabId, onSelect, onCreate, onClose, onRename, onDuplicate }: QueryTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus()
      editRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  function commitRename() {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }

  function handleContextMenu(e: React.MouseEvent, tabId: string) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, tabId })
  }

  function startRename(tabId: string, currentName: string) {
    setEditingId(tabId)
    setEditName(currentName)
    setContextMenu(null)
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-slate-50/80 px-2 py-1" style={{ minHeight: 36 }}>
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={cn(
            'group relative flex max-w-[180px] items-center gap-1 rounded-md border px-2.5 py-1 text-xs cursor-pointer select-none transition-all',
            tab.id === activeTabId
              ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
              : 'border-transparent bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-700'
          )}
          onClick={() => onSelect(tab.id)}
          onDoubleClick={() => startRename(tab.id, tab.label)}
          onContextMenu={e => handleContextMenu(e, tab.id)}
        >
          <FileText className="h-3 w-3 shrink-0 text-slate-400" />

          {editingId === tab.id ? (
            <input
              ref={editRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation()
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setEditingId(null)
                  setEditName('')
                }
              }}
              onBlur={commitRename}
              onClick={e => e.stopPropagation()}
              className="h-5 w-24 border-none bg-transparent px-0 text-xs outline-none focus:ring-0"
            />
          ) : (
            <span className="truncate">{tab.label}</span>
          )}

          {tab.dirty && (
            <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" title="Unsaved changes" />
          )}

          {tabs.length > 1 && (
            <button
              className="ml-0.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
              onClick={e => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              title="Close tab"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}

      <button
        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-600"
        onClick={onCreate}
        title="New query"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
            onClick={() => {
              const tab = tabs.find(t => t.id === contextMenu.tabId)
              if (tab) startRename(tab.id, tab.label)
            }}
          >
            Rename
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
            onClick={() => {
              onDuplicate(contextMenu.tabId)
              setContextMenu(null)
            }}
          >
            Duplicate
          </button>
          <div className="my-1 h-px bg-slate-100" />
          <button
            className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
            onClick={() => {
              onClose(contextMenu.tabId)
              setContextMenu(null)
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
