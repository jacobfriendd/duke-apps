import { useCallback, useState } from 'react'
import { QueryList } from './components/QueryList'
import { QueryEditor } from './components/editor/QueryEditor'
import type { QueryRecord } from './types/query'

type View = 'list' | 'editor'

export default function App() {
  const [view, setView] = useState<View>('list')
  const [activeRecord, setActiveRecord] = useState<QueryRecord | null>(null)

  const openEditor = useCallback((record: QueryRecord | null) => {
    setActiveRecord(record)
    setView('editor')
  }, [])

  const handleBack = useCallback(() => {
    setView('list')
  }, [])

  if (view === 'editor') {
    return (
      <QueryEditor
        record={activeRecord}
        onBack={handleBack}
        onSaved={setActiveRecord}
      />
    )
  }

  return (
    <QueryList onOpen={record => openEditor(record)} />
  )
}
