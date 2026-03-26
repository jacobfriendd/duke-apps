import { useCallback, useState } from 'react'
import { QueryList } from './components/QueryList'
import { QueryEditor } from './components/editor/QueryEditor'
import { QueryTabs, type QueryTabItem } from './components/editor/QueryTabs'
import type { QueryRecord } from './types/query'
import { generateId } from './lib/utils'

type View = 'list' | 'editor'

function makeTab(record: QueryRecord | null): QueryTabItem {
  return {
    id: record?.id ? `q-${record.id}` : generateId(),
    record,
    label: record?.name ?? 'Untitled Query',
  }
}

export default function App() {
  const [view, setView] = useState<View>('list')
  const [tabs, setTabs] = useState<QueryTabItem[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')

  const openEditor = useCallback((record: QueryRecord | null) => {
    // Check if this record is already open
    if (record?.id) {
      const existing = tabs.find(t => t.record?.id === record.id)
      if (existing) {
        setActiveTabId(existing.id)
        setView('editor')
        return
      }
    }

    const tab = makeTab(record)
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
    setView('editor')
  }, [tabs])

  const handleTabSelect = useCallback((id: string) => {
    setActiveTabId(id)
  }, [])

  const handleTabCreate = useCallback(() => {
    const tab = makeTab(null)
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }, [])

  const handleTabClose = useCallback((id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (next.length === 0) {
        setView('list')
        return []
      }
      if (id === activeTabId) {
        const closedIdx = prev.findIndex(t => t.id === id)
        const newActive = next[Math.min(closedIdx, next.length - 1)]
        setActiveTabId(newActive.id)
      }
      return next
    })
  }, [activeTabId])

  const handleTabRename = useCallback((id: string, name: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, label: name } : t))
  }, [])

  const handleTabDuplicate = useCallback((id: string) => {
    const source = tabs.find(t => t.id === id)
    if (!source) return
    const tab = makeTab(source.record)
    tab.label = `${source.label} (copy)`
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }, [tabs])

  const handleSaved = useCallback((tabId: string, record: QueryRecord) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, record, label: record.name, dirty: false } : t
    ))
  }, [])

  const handleBack = useCallback(() => {
    setView('list')
  }, [])

  if (view === 'editor' && tabs.length > 0) {
    const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]

    return (
      <div className="flex h-full flex-col overflow-hidden">
        <QueryTabs
          tabs={tabs}
          activeTabId={activeTab.id}
          onSelect={handleTabSelect}
          onCreate={handleTabCreate}
          onClose={handleTabClose}
          onRename={handleTabRename}
          onDuplicate={handleTabDuplicate}
        />
        <div className="flex-1 overflow-hidden">
          <QueryEditor
            key={activeTab.id}
            record={activeTab.record}
            onBack={handleBack}
            onSaved={record => handleSaved(activeTab.id, record)}
          />
        </div>
      </div>
    )
  }

  return (
    <QueryList onOpen={record => openEditor(record)} />
  )
}
