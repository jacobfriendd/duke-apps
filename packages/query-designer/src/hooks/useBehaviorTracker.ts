import { useCallback, useEffect, useMemo, useRef } from 'react'
import { BehaviorTracker } from '@/lib/behavior-tracker'
import type { BehavioralData } from '@/lib/behavior-tracker'

/**
 * React hook that creates a BehaviorTracker instance, wires it to DOM
 * events (mouse, keyboard, scroll, focus/blur), and exposes action helpers
 * for the host component to call.
 *
 * All DOM listeners are passive and throttled — zero impact on UI perf.
 */
export function useBehaviorTracker() {
  const trackerRef = useRef<BehaviorTracker | null>(null)

  // Lazily initialise the tracker once
  if (!trackerRef.current) {
    trackerRef.current = new BehaviorTracker()
  }
  const tracker = trackerRef.current

  // ── DOM event wiring ───────────────────────────────────────────────────
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      tracker.recordMouseMove(e.clientX, e.clientY)
    }

    function handleClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null
      const target = describeElement(el)
      const text = el?.textContent?.trim() ?? ''
      tracker.recordClick(e.clientX, e.clientY, target, text, e.button)
    }

    function handleScroll() {
      tracker.recordScroll(document.documentElement.scrollTop || document.body.scrollTop)
    }

    function handleKeyDown(e: KeyboardEvent) {
      const mods: string[] = []
      if (e.ctrlKey) mods.push('ctrl')
      if (e.metaKey) mods.push('meta')
      if (e.shiftKey) mods.push('shift')
      if (e.altKey) mods.push('alt')
      tracker.recordKeyDown(e.key, mods)
    }

    function handleFocus() {
      tracker.recordFocus()
    }

    function handleBlur() {
      tracker.recordBlur()
    }

    // Attach listeners (passive where possible)
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('click', handleClick, { passive: true })
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    document.addEventListener('keydown', handleKeyDown, { passive: true })
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    // Also capture scroll on elements with overflow (delegation via capture phase)
    // The scroll event above with capture: true handles this.

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [tracker])

  // ── Action helpers (stable refs via useCallback) ───────────────────────

  const trackAction = useCallback(
    (action: string, metadata?: Record<string, unknown>) => {
      tracker.trackAction(action, metadata)
    },
    [tracker],
  )

  const trackDialogOpen = useCallback(
    (dialogName: string) => {
      tracker.trackDialogOpen(dialogName)
    },
    [tracker],
  )

  const trackDialogClose = useCallback(
    (dialogName: string, committed: boolean) => {
      tracker.trackDialogClose(dialogName, committed)
    },
    [tracker],
  )

  const trackTabSwitch = useCallback(
    (from: string, to: string) => {
      tracker.trackTabSwitch(from, to)
    },
    [tracker],
  )

  const trackError = useCallback(
    (errorType: string, message: string, context?: string) => {
      tracker.trackError(errorType, message, context)
    },
    [tracker],
  )

  const trackTaskStart = useCallback(
    (taskName: string) => {
      tracker.trackTaskStart(taskName)
    },
    [tracker],
  )

  const trackTaskComplete = useCallback(
    (taskName: string) => {
      tracker.trackTaskComplete(taskName)
    },
    [tracker],
  )

  const setQueryInfo = useCallback(
    (queryId: string, queryName: string) => {
      tracker.setQueryInfo(queryId, queryName)
    },
    [tracker],
  )

  const exportData = useCallback((): BehavioralData => {
    return tracker.export()
  }, [tracker])

  return useMemo(() => ({
    trackAction,
    trackDialogOpen,
    trackDialogClose,
    trackTabSwitch,
    trackError,
    trackTaskStart,
    trackTaskComplete,
    setQueryInfo,
    exportData,
  }), [trackAction, trackDialogOpen, trackDialogClose, trackTabSwitch, trackError, trackTaskStart, trackTaskComplete, setQueryInfo, exportData])
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a human-readable descriptor for a DOM element, suitable for
 * identifying click targets without leaking sensitive content.
 */
function describeElement(el: HTMLElement | null): string {
  if (!el) return 'unknown'

  const parts: string[] = []

  // Tag
  const tag = el.tagName.toLowerCase()
  parts.push(tag)

  // Role
  const role = el.getAttribute('role')
  if (role) parts.push(`[role="${role}"]`)

  // Data attributes useful for identification
  const action = el.getAttribute('data-action') ?? el.closest('[data-action]')?.getAttribute('data-action')
  if (action) parts.push(`[data-action="${action}"]`)

  const testId = el.getAttribute('data-testid')
  if (testId) parts.push(`[data-testid="${testId}"]`)

  // Title (often set on buttons)
  const title = el.getAttribute('title') ?? el.closest('button')?.getAttribute('title')
  if (title) parts.push(`[title="${title.slice(0, 40)}"]`)

  // Class names (abbreviated)
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(/\s+/).filter(c => !c.startsWith('h-') && !c.startsWith('w-') && !c.startsWith('px-') && !c.startsWith('py-') && !c.startsWith('text-')).slice(0, 3)
    if (classes.length) parts.push(`.${classes.join('.')}`)
  }

  return parts.join('')
}
