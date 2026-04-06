import { useCallback, useRef, useState } from 'react'
import { Upload, CheckCircle2, X } from 'lucide-react'

interface Props {
  sessionData: unknown | null
  onSessionData: (data: unknown | null) => void
}

export function SessionDataUpload({ sessionData, onSessionData }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    setError(null)
    if (!file.name.endsWith('.json')) {
      setError('Please upload a .json file')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        onSessionData(parsed)
      } catch {
        setError('Could not parse JSON file')
      }
    }
    reader.readAsText(file)
  }, [onSessionData])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  if (sessionData) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">Session data attached</span>
        </div>
        <button
          type="button"
          onClick={() => onSessionData(null)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        Attach session data <span className="text-muted-foreground font-normal">(optional)</span>
      </label>
      <p className="text-xs text-muted-foreground mb-3">
        In the Query Designer, click <strong>Export Session Data</strong> on the Home tab to download a JSON file, then upload it here. This helps us understand how you interacted with the tool.
      </p>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-muted/30 hover:bg-primary/5 transition-colors px-4 py-6 flex flex-col items-center gap-2 text-center"
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Drop your session data file here, or <span className="text-primary font-medium">browse</span>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
