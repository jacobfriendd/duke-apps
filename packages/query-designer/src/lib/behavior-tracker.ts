// ─── Behavioral Tracking Engine ──────────────────────────────────────────────
// Captures comprehensive user behavior data while interacting with the Query
// Designer.  All data is held in memory and exported on demand as JSON.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MouseSample {
  x: number
  y: number
  t: number   // ms since session start
  vx: number  // velocity x  (px/s)
  vy: number  // velocity y  (px/s)
}

export interface ClickEvent {
  x: number
  y: number
  t: number
  target: string
  targetText: string
  button: number
  isDoubleClick: boolean
}

export interface ScrollEvent {
  scrollTop: number
  t: number
  direction: 'up' | 'down'
  delta: number
}

export interface KeyEvent {
  key: string
  t: number
  isShortcut: boolean
  modifiers: string[]
}

export interface ActionEvent {
  action: string
  t: number
  duration?: number
  metadata?: Record<string, unknown>
}

export interface HesitationZone {
  x: number
  y: number
  startT: number
  endT: number
  duration: number
}

export interface RageClick {
  x: number
  y: number
  t: number
  clickCount: number
  target: string
}

export interface FocusEvent {
  type: 'focus' | 'blur'
  t: number
}

export interface DialogEvent {
  dialogName: string
  action: 'open' | 'close'
  t: number
  result?: 'committed' | 'cancelled'
}

export interface TabSwitchEvent {
  from: string
  to: string
  t: number
}

export interface ErrorEvent {
  errorType: string
  message: string
  t: number
  context?: string
}

export interface SessionMetadata {
  sessionId: string
  startTime: string
  userAgent: string
  screenWidth: number
  screenHeight: number
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  platform: string
  language: string
  queryId?: string
  queryName?: string
}

// ─── Analytics (computed at export time) ─────────────────────────────────────

export interface FeatureUsage {
  feature: string
  useCount: number
  firstUsedAt: number
  lastUsedAt: number
  avgDurationMs: number
  abandonedCount: number
}

export interface ConfusionSignal {
  feature: string
  score: number
  signals: string[]
  occurrences: number
}

export interface ActionSequence {
  from: string
  to: string
  count: number
  avgTimeBetweenMs: number
}

export interface BehavioralAnalytics {
  // Mouse
  totalMouseDistancePx: number
  avgMouseSpeedPxPerSec: number
  hesitationCount: number
  avgHesitationDurationMs: number
  mouseIdleTimeMs: number
  mouseSmoothness: number              // 0-100  (higher = smoother, less jerky)

  // Click
  totalClicks: number
  clicksPerMinute: number
  rageClickCount: number
  doubleClickCount: number
  uniqueElementsClicked: number
  deadClickCount: number               // clicks on non-interactive elements
  clickPrecisionScore: number           // 0-100

  // Scroll
  maxScrollDepth: number
  scrollDirectionChanges: number
  totalScrollDistancePx: number

  // Keyboard
  totalKeyPresses: number
  shortcutUsageCount: number
  undoCount: number
  redoCount: number
  backspaceRate: number
  typingBurstCount: number             // clusters of rapid typing

  // Feature
  featureUsage: FeatureUsage[]
  featureDiscoveryOrder: string[]
  unusedFeatures: string[]

  // Confusion
  confusionSignals: ConfusionSignal[]
  overallConfusionScore: number        // 0-100

  // Workflow
  actionSequences: ActionSequence[]
  avgTimeBetweenActionsMs: number
  longestPause: { durationMs: number; afterAction: string; t: number }

  // Task completion
  tasksAttempted: string[]
  tasksCompleted: string[]
  avgTaskDurationMs: Record<string, number>

  // Session
  activeTimePercentage: number
  focusLossCount: number
  errorCount: number
  errorRecoveryRate: number

  // Engagement & efficiency
  engagementScore: number              // 0-100
  efficiencyScore: number              // 0-100
  cognitiveLoadEstimate: 'low' | 'medium' | 'high' | 'overloaded'
}

export interface BehavioralData {
  metadata: SessionMetadata
  durationMs: number
  activeDurationMs: number

  // Raw events
  mousePath: MouseSample[]
  clicks: ClickEvent[]
  scrollEvents: ScrollEvent[]
  keyEvents: KeyEvent[]
  actions: ActionEvent[]
  hesitations: HesitationZone[]
  rageClicks: RageClick[]
  focusEvents: FocusEvent[]
  dialogEvents: DialogEvent[]
  tabSwitches: TabSwitchEvent[]
  errors: ErrorEvent[]

  // Computed
  analytics: BehavioralAnalytics
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MOUSE_SAMPLE_INTERVAL = 80        // ms between mouse position samples
const HESITATION_THRESHOLD_PX = 6       // movement below this = hesitation
const HESITATION_MIN_DURATION = 600     // ms to count as hesitation
const RAGE_CLICK_WINDOW = 1000          // ms window for rage click detection
const RAGE_CLICK_MIN = 3               // clicks within window to count
const RAGE_CLICK_RADIUS = 50            // px radius for same-area detection
const MAX_MOUSE_SAMPLES = 100_000
const MAX_KEY_EVENTS = 50_000
const IDLE_THRESHOLD = 3000             // ms without movement = idle

const ALL_FEATURES = [
  'choose_source', 'add_column', 'remove_column', 'reorder_columns',
  'add_filter', 'edit_filter', 'remove_filter', 'change_logic_operator',
  'add_join', 'edit_join', 'remove_join', 'suggested_join',
  'add_sort', 'remove_sort', 'set_limit',
  'add_subquery', 'remove_subquery',
  'add_formula', 'add_aggregate',
  'run_preview', 'copy_sql', 'export_sql',
  'undo', 'redo',
  'edit_sql_directly', 'apply_sql_edit', 'cancel_sql_edit',
  'toggle_ai', 'use_nl_bar',
  'rename_query',
]

// ─── Tracker Class ───────────────────────────────────────────────────────────

export class BehaviorTracker {
  private sessionStart: number
  private metadata: SessionMetadata

  // Raw event buffers
  private mousePath: MouseSample[] = []
  private clicks: ClickEvent[] = []
  private scrollEvents: ScrollEvent[] = []
  private keyEvents: KeyEvent[] = []
  private actions: ActionEvent[] = []
  private hesitations: HesitationZone[] = []
  private rageClicks: RageClick[] = []
  private focusEvents: FocusEvent[] = []
  private dialogEvents: DialogEvent[] = []
  private tabSwitches: TabSwitchEvent[] = []
  private errors: ErrorEvent[] = []

  // Internal tracking state
  private lastMouseX = 0
  private lastMouseY = 0
  private lastMouseT = 0
  private lastSampleT = 0
  private hesitationStart: { x: number; y: number; t: number } | null = null
  private recentClicks: Array<{ x: number; y: number; t: number; target: string }> = []
  private lastScrollTop = 0
  private focusedSince: number
  private totalFocusedMs = 0
  private isFocused = true
  private openDialogs = new Map<string, number>()  // dialogName → openTime
  private featureFirstUse = new Map<string, number>()
  private taskStarts = new Map<string, number>()
  private taskDurations = new Map<string, number[]>()
  private lastClickT = 0
  private lastClickTarget = ''

  constructor() {
    this.sessionStart = performance.now()
    this.focusedSince = this.sessionStart
    this.metadata = {
      sessionId: this.generateSessionId(),
      startTime: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      platform: navigator.platform,
      language: navigator.language,
    }
  }

  private generateSessionId(): string {
    return `ses_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  private elapsed(): number {
    return performance.now() - this.sessionStart
  }

  // ── Mouse ────────────────────────────────────────────────────────────────

  recordMouseMove(x: number, y: number): void {
    const now = this.elapsed()

    // Throttle sampling
    if (now - this.lastSampleT < MOUSE_SAMPLE_INTERVAL) return

    const dt = (now - this.lastMouseT) / 1000 || 0.001
    const vx = dt > 0 ? (x - this.lastMouseX) / dt : 0
    const vy = dt > 0 ? (y - this.lastMouseY) / dt : 0

    if (this.mousePath.length < MAX_MOUSE_SAMPLES) {
      this.mousePath.push({
        x: Math.round(x),
        y: Math.round(y),
        t: Math.round(now),
        vx: Math.round(vx),
        vy: Math.round(vy),
      })
    }

    // Hesitation detection
    const dx = x - this.lastMouseX
    const dy = y - this.lastMouseY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < HESITATION_THRESHOLD_PX) {
      if (!this.hesitationStart) {
        this.hesitationStart = { x, y, t: now }
      }
    } else {
      if (this.hesitationStart) {
        const duration = now - this.hesitationStart.t
        if (duration >= HESITATION_MIN_DURATION) {
          this.hesitations.push({
            x: Math.round(this.hesitationStart.x),
            y: Math.round(this.hesitationStart.y),
            startT: Math.round(this.hesitationStart.t),
            endT: Math.round(now),
            duration: Math.round(duration),
          })
        }
        this.hesitationStart = null
      }
    }

    this.lastMouseX = x
    this.lastMouseY = y
    this.lastMouseT = now
    this.lastSampleT = now
  }

  // ── Clicks ───────────────────────────────────────────────────────────────

  recordClick(x: number, y: number, target: string, targetText: string, button: number): void {
    const now = this.elapsed()
    const isDoubleClick = (
      now - this.lastClickT < 400 &&
      this.lastClickTarget === target
    )

    this.clicks.push({
      x: Math.round(x),
      y: Math.round(y),
      t: Math.round(now),
      target,
      targetText: targetText.slice(0, 80),
      button,
      isDoubleClick,
    })

    this.lastClickT = now
    this.lastClickTarget = target

    // Rage click detection
    this.recentClicks.push({ x, y, t: now, target })
    // Prune old clicks outside window
    this.recentClicks = this.recentClicks.filter(c => now - c.t < RAGE_CLICK_WINDOW)

    // Check for rage clicks in the same area
    const nearby = this.recentClicks.filter(c => {
      const d = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2)
      return d < RAGE_CLICK_RADIUS
    })

    if (nearby.length >= RAGE_CLICK_MIN) {
      // Only record if we haven't already recorded one for this burst
      const lastRage = this.rageClicks[this.rageClicks.length - 1]
      if (!lastRage || now - lastRage.t > RAGE_CLICK_WINDOW) {
        this.rageClicks.push({
          x: Math.round(x),
          y: Math.round(y),
          t: Math.round(now),
          clickCount: nearby.length,
          target,
        })
      }
    }
  }

  // ── Scroll ───────────────────────────────────────────────────────────────

  recordScroll(scrollTop: number): void {
    const now = this.elapsed()
    const direction = scrollTop > this.lastScrollTop ? 'down' : 'up'
    const delta = Math.abs(scrollTop - this.lastScrollTop)

    if (delta > 2) {  // ignore tiny scroll jitter
      this.scrollEvents.push({
        scrollTop: Math.round(scrollTop),
        t: Math.round(now),
        direction,
        delta: Math.round(delta),
      })
    }

    this.lastScrollTop = scrollTop
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────

  recordKeyDown(key: string, modifiers: string[]): void {
    if (this.keyEvents.length >= MAX_KEY_EVENTS) return

    const isShortcut = modifiers.length > 0 && key.length === 1
    this.keyEvents.push({
      key: key.length > 1 ? key : '•',  // mask actual characters for privacy
      t: Math.round(this.elapsed()),
      isShortcut,
      modifiers,
    })
  }

  // ── Focus / Blur ─────────────────────────────────────────────────────────

  recordFocus(): void {
    const now = this.elapsed()
    this.isFocused = true
    this.focusedSince = now
    this.focusEvents.push({ type: 'focus', t: Math.round(now) })
  }

  recordBlur(): void {
    const now = this.elapsed()
    if (this.isFocused) {
      this.totalFocusedMs += now - this.focusedSince
    }
    this.isFocused = false
    this.focusEvents.push({ type: 'blur', t: Math.round(now) })
  }

  // ── High-level actions ───────────────────────────────────────────────────

  trackAction(action: string, metadata?: Record<string, unknown>): void {
    const now = this.elapsed()
    this.actions.push({
      action,
      t: Math.round(now),
      metadata,
    })

    // Track feature first use
    if (!this.featureFirstUse.has(action)) {
      this.featureFirstUse.set(action, now)
    }
  }

  trackDialogOpen(dialogName: string): void {
    const now = this.elapsed()
    this.openDialogs.set(dialogName, now)
    this.dialogEvents.push({
      dialogName,
      action: 'open',
      t: Math.round(now),
    })
  }

  trackDialogClose(dialogName: string, committed: boolean): void {
    const now = this.elapsed()
    const openTime = this.openDialogs.get(dialogName)
    const duration = openTime != null ? now - openTime : undefined
    this.openDialogs.delete(dialogName)

    this.dialogEvents.push({
      dialogName,
      action: 'close',
      t: Math.round(now),
      result: committed ? 'committed' : 'cancelled',
    })

    // Record as action with duration
    if (duration != null) {
      this.actions.push({
        action: `dialog_${dialogName}_${committed ? 'committed' : 'cancelled'}`,
        t: Math.round(now),
        duration: Math.round(duration),
      })
    }
  }

  trackTabSwitch(from: string, to: string): void {
    this.tabSwitches.push({
      from,
      to,
      t: Math.round(this.elapsed()),
    })
  }

  trackError(errorType: string, message: string, context?: string): void {
    this.errors.push({
      errorType,
      message: message.slice(0, 200),
      t: Math.round(this.elapsed()),
      context,
    })
  }

  trackTaskStart(taskName: string): void {
    this.taskStarts.set(taskName, this.elapsed())
  }

  trackTaskComplete(taskName: string): void {
    const start = this.taskStarts.get(taskName)
    if (start != null) {
      const duration = this.elapsed() - start
      const durations = this.taskDurations.get(taskName) ?? []
      durations.push(duration)
      this.taskDurations.set(taskName, durations)
      this.taskStarts.delete(taskName)
    }
  }

  setQueryInfo(queryId: string, queryName: string): void {
    this.metadata.queryId = queryId
    this.metadata.queryName = queryName
  }

  // ── Export ───────────────────────────────────────────────────────────────

  export(): BehavioralData {
    // Finalize focus time
    const now = this.elapsed()
    let activeDurationMs = this.totalFocusedMs
    if (this.isFocused) {
      activeDurationMs += now - this.focusedSince
    }

    // Flush any pending hesitation
    if (this.hesitationStart) {
      const duration = now - this.hesitationStart.t
      if (duration >= HESITATION_MIN_DURATION) {
        this.hesitations.push({
          x: Math.round(this.hesitationStart.x),
          y: Math.round(this.hesitationStart.y),
          startT: Math.round(this.hesitationStart.t),
          endT: Math.round(now),
          duration: Math.round(duration),
        })
      }
    }

    return {
      metadata: { ...this.metadata },
      durationMs: Math.round(now),
      activeDurationMs: Math.round(activeDurationMs),
      mousePath: [...this.mousePath],
      clicks: [...this.clicks],
      scrollEvents: [...this.scrollEvents],
      keyEvents: [...this.keyEvents],
      actions: [...this.actions],
      hesitations: [...this.hesitations],
      rageClicks: [...this.rageClicks],
      focusEvents: [...this.focusEvents],
      dialogEvents: [...this.dialogEvents],
      tabSwitches: [...this.tabSwitches],
      errors: [...this.errors],
      analytics: this.computeAnalytics(now, activeDurationMs),
    }
  }

  // ── Analytics computation ────────────────────────────────────────────────

  private computeAnalytics(sessionDurationMs: number, activeDurationMs: number): BehavioralAnalytics {
    const durationMin = sessionDurationMs / 60_000 || 1

    return {
      // Mouse
      ...this.computeMouseAnalytics(sessionDurationMs),
      // Click
      ...this.computeClickAnalytics(durationMin),
      // Scroll
      ...this.computeScrollAnalytics(),
      // Keyboard
      ...this.computeKeyboardAnalytics(),
      // Feature
      ...this.computeFeatureAnalytics(),
      // Confusion
      ...this.computeConfusionAnalytics(),
      // Workflow
      ...this.computeWorkflowAnalytics(),
      // Task
      ...this.computeTaskAnalytics(),
      // Session
      activeTimePercentage: sessionDurationMs > 0
        ? Math.round((activeDurationMs / sessionDurationMs) * 100)
        : 100,
      focusLossCount: this.focusEvents.filter(e => e.type === 'blur').length,
      errorCount: this.errors.length,
      errorRecoveryRate: this.computeErrorRecoveryRate(),
      // Engagement & efficiency
      engagementScore: this.computeEngagementScore(sessionDurationMs, activeDurationMs),
      efficiencyScore: this.computeEfficiencyScore(),
      cognitiveLoadEstimate: this.estimateCognitiveLoad(),
    }
  }

  private computeMouseAnalytics(sessionDurationMs: number) {
    let totalDist = 0
    let totalAngleChange = 0
    let angleCount = 0
    let idleMs = 0
    let lastActiveT = this.mousePath[0]?.t ?? 0

    for (let i = 1; i < this.mousePath.length; i++) {
      const prev = this.mousePath[i - 1]
      const curr = this.mousePath[i]
      const dx = curr.x - prev.x
      const dy = curr.y - prev.y
      totalDist += Math.sqrt(dx * dx + dy * dy)

      // Idle detection
      const gap = curr.t - prev.t
      if (gap > IDLE_THRESHOLD) {
        idleMs += gap - MOUSE_SAMPLE_INTERVAL
      }
      lastActiveT = curr.t

      // Smoothness: measure angle changes between consecutive segments
      if (i >= 2) {
        const prev2 = this.mousePath[i - 2]
        const dx1 = prev.x - prev2.x
        const dy1 = prev.y - prev2.y
        const dx2 = curr.x - prev.x
        const dy2 = curr.y - prev.y
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
        if (len1 > 2 && len2 > 2) {
          const cos = Math.max(-1, Math.min(1, (dx1 * dx2 + dy1 * dy2) / (len1 * len2)))
          totalAngleChange += Math.acos(cos)
          angleCount++
        }
      }
    }

    // Smoothness: less angular change per segment = smoother
    const avgAngle = angleCount > 0 ? totalAngleChange / angleCount : 0
    // Map from [0, PI] to [100, 0]
    const smoothness = Math.round(Math.max(0, Math.min(100, 100 - (avgAngle / Math.PI) * 100)))

    const durationSec = sessionDurationMs / 1000 || 1
    const hesitationDurations = this.hesitations.map(h => h.duration)
    const avgHesitation = hesitationDurations.length > 0
      ? hesitationDurations.reduce((a, b) => a + b, 0) / hesitationDurations.length
      : 0

    // Add remaining idle time from end of session
    if (this.mousePath.length > 0) {
      const lastSample = this.mousePath[this.mousePath.length - 1].t
      if (sessionDurationMs - lastSample > IDLE_THRESHOLD) {
        idleMs += sessionDurationMs - lastSample - MOUSE_SAMPLE_INTERVAL
      }
    }

    return {
      totalMouseDistancePx: Math.round(totalDist),
      avgMouseSpeedPxPerSec: Math.round(totalDist / durationSec),
      hesitationCount: this.hesitations.length,
      avgHesitationDurationMs: Math.round(avgHesitation),
      mouseIdleTimeMs: Math.round(Math.max(0, idleMs)),
      mouseSmoothness: smoothness,
    }
  }

  private computeClickAnalytics(durationMin: number) {
    const uniqueTargets = new Set(this.clicks.map(c => c.target))

    // Dead clicks: clicks on non-interactive elements
    const interactiveSelectors = ['button', 'a', 'input', 'select', 'textarea', '[role="button"]', '[role="tab"]', '[role="option"]', '[data-action]']
    const deadClicks = this.clicks.filter(c => {
      const t = c.target.toLowerCase()
      return !interactiveSelectors.some(s => t.includes(s))
    })

    // Click precision: how centered are clicks on their targets
    // Approximation: lower mouse velocity at click time = more precise
    const clickVelocities = this.clicks.map(click => {
      const nearestSample = this.mousePath.find(s => Math.abs(s.t - click.t) < 200)
      if (!nearestSample) return 100
      return Math.sqrt(nearestSample.vx ** 2 + nearestSample.vy ** 2)
    })
    const avgVelocityAtClick = clickVelocities.length > 0
      ? clickVelocities.reduce((a, b) => a + b, 0) / clickVelocities.length
      : 0
    // Map velocity to precision: low velocity = high precision
    const precision = Math.round(Math.max(0, Math.min(100, 100 - Math.min(avgVelocityAtClick / 10, 100))))

    return {
      totalClicks: this.clicks.length,
      clicksPerMinute: Math.round((this.clicks.length / durationMin) * 10) / 10,
      rageClickCount: this.rageClicks.length,
      doubleClickCount: this.clicks.filter(c => c.isDoubleClick).length,
      uniqueElementsClicked: uniqueTargets.size,
      deadClickCount: deadClicks.length,
      clickPrecisionScore: precision,
    }
  }

  private computeScrollAnalytics() {
    let directionChanges = 0
    let totalDist = 0
    let maxDepth = 0
    let prevDirection: string | null = null

    for (const ev of this.scrollEvents) {
      totalDist += ev.delta
      if (ev.scrollTop > maxDepth) maxDepth = ev.scrollTop
      if (prevDirection && ev.direction !== prevDirection) {
        directionChanges++
      }
      prevDirection = ev.direction
    }

    return {
      maxScrollDepth: Math.round(maxDepth),
      scrollDirectionChanges: directionChanges,
      totalScrollDistancePx: Math.round(totalDist),
    }
  }

  private computeKeyboardAnalytics() {
    const undos = this.actions.filter(a => a.action === 'undo').length
    const redos = this.actions.filter(a => a.action === 'redo').length
    const shortcuts = this.keyEvents.filter(k => k.isShortcut).length
    const backspaces = this.keyEvents.filter(k => k.key === 'Backspace').length
    const backspaceRate = this.keyEvents.length > 0
      ? Math.round((backspaces / this.keyEvents.length) * 100 * 10) / 10
      : 0

    // Typing bursts: clusters of key events within 200ms of each other
    let burstCount = 0
    let inBurst = false
    for (let i = 1; i < this.keyEvents.length; i++) {
      const gap = this.keyEvents[i].t - this.keyEvents[i - 1].t
      if (gap < 200) {
        if (!inBurst) {
          burstCount++
          inBurst = true
        }
      } else {
        inBurst = false
      }
    }

    return {
      totalKeyPresses: this.keyEvents.length,
      shortcutUsageCount: shortcuts,
      undoCount: undos,
      redoCount: redos,
      backspaceRate,
      typingBurstCount: burstCount,
    }
  }

  private computeFeatureAnalytics() {
    const usageMap = new Map<string, { count: number; durations: number[]; abandoned: number }>()

    // Count action occurrences
    for (const a of this.actions) {
      const base = a.action.replace(/^dialog_/, '').replace(/_(committed|cancelled)$/, '')
      const entry = usageMap.get(base) ?? { count: 0, durations: [], abandoned: 0 }
      entry.count++
      if (a.duration != null) entry.durations.push(a.duration)
      if (a.action.endsWith('_cancelled')) entry.abandoned++
      usageMap.set(base, entry)
    }

    const featureUsage: FeatureUsage[] = [...usageMap.entries()].map(([feature, data]) => {
      const actionTimes = this.actions
        .filter(a => a.action === feature || a.action.startsWith(`dialog_${feature}`))
        .map(a => a.t)
      const avgDur = data.durations.length > 0
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
        : 0
      return {
        feature,
        useCount: data.count,
        firstUsedAt: Math.min(...actionTimes),
        lastUsedAt: Math.max(...actionTimes),
        avgDurationMs: Math.round(avgDur),
        abandonedCount: data.abandoned,
      }
    })

    // Discovery order from first-use timestamps
    const featureDiscoveryOrder = [...this.featureFirstUse.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([feature]) => feature)

    const usedFeatures = new Set(this.actions.map(a => a.action))
    const unusedFeatures = ALL_FEATURES.filter(f => !usedFeatures.has(f))

    return {
      featureUsage,
      featureDiscoveryOrder,
      unusedFeatures,
    }
  }

  private computeConfusionAnalytics(): { confusionSignals: ConfusionSignal[]; overallConfusionScore: number } {
    const signals: ConfusionSignal[] = []

    // 1. Rage clicks as confusion
    if (this.rageClicks.length > 0) {
      const targets = new Map<string, number>()
      for (const rc of this.rageClicks) {
        targets.set(rc.target, (targets.get(rc.target) ?? 0) + 1)
      }
      for (const [target, count] of targets) {
        signals.push({
          feature: target,
          score: Math.min(100, count * 30),
          signals: ['rage_clicks'],
          occurrences: count,
        })
      }
    }

    // 2. High undo/redo = confusion
    const undos = this.actions.filter(a => a.action === 'undo').length
    const redos = this.actions.filter(a => a.action === 'redo').length
    if (undos + redos > 5) {
      signals.push({
        feature: 'general_editing',
        score: Math.min(100, (undos + redos) * 8),
        signals: ['frequent_undo_redo'],
        occurrences: undos + redos,
      })
    }

    // 3. Dialog cancellations = couldn't figure it out
    const dialogCancels = this.dialogEvents.filter(e => e.result === 'cancelled')
    const dialogGrouped = new Map<string, number>()
    for (const dc of dialogCancels) {
      dialogGrouped.set(dc.dialogName, (dialogGrouped.get(dc.dialogName) ?? 0) + 1)
    }
    for (const [name, count] of dialogGrouped) {
      if (count >= 2) {
        signals.push({
          feature: name,
          score: Math.min(100, count * 25),
          signals: ['repeated_dialog_cancellations'],
          occurrences: count,
        })
      }
    }

    // 4. Rapid tab switching = searching for something
    let rapidSwitches = 0
    for (let i = 1; i < this.tabSwitches.length; i++) {
      if (this.tabSwitches[i].t - this.tabSwitches[i - 1].t < 2000) {
        rapidSwitches++
      }
    }
    if (rapidSwitches > 3) {
      signals.push({
        feature: 'ribbon_navigation',
        score: Math.min(100, rapidSwitches * 15),
        signals: ['rapid_tab_switching'],
        occurrences: rapidSwitches,
      })
    }

    // 5. Repeated identical actions = trying the same thing expecting different results
    const actionPairs: string[] = []
    for (let i = 1; i < this.actions.length; i++) {
      if (this.actions[i].action === this.actions[i - 1].action) {
        actionPairs.push(this.actions[i].action)
      }
    }
    const repeatedActions = new Map<string, number>()
    for (const a of actionPairs) {
      repeatedActions.set(a, (repeatedActions.get(a) ?? 0) + 1)
    }
    for (const [action, count] of repeatedActions) {
      if (count >= 2) {
        signals.push({
          feature: action,
          score: Math.min(100, count * 20),
          signals: ['repeated_identical_actions'],
          occurrences: count,
        })
      }
    }

    // 6. Long hesitations near interactive elements
    if (this.hesitations.length > 5) {
      const longHesitations = this.hesitations.filter(h => h.duration > 2000)
      if (longHesitations.length > 2) {
        signals.push({
          feature: 'ui_navigation',
          score: Math.min(100, longHesitations.length * 15),
          signals: ['prolonged_hesitation'],
          occurrences: longHesitations.length,
        })
      }
    }

    // Overall confusion score: weighted average of individual signals
    const overallConfusionScore = signals.length > 0
      ? Math.round(Math.min(100, signals.reduce((sum, s) => sum + s.score, 0) / Math.max(signals.length, 3)))
      : 0

    return { confusionSignals: signals, overallConfusionScore }
  }

  private computeWorkflowAnalytics() {
    // Action sequences: what follows what
    const seqMap = new Map<string, { count: number; times: number[] }>()
    for (let i = 1; i < this.actions.length; i++) {
      const from = this.actions[i - 1].action
      const to = this.actions[i].action
      const key = `${from}→${to}`
      const entry = seqMap.get(key) ?? { count: 0, times: [] }
      entry.count++
      entry.times.push(this.actions[i].t - this.actions[i - 1].t)
      seqMap.set(key, entry)
    }

    const actionSequences: ActionSequence[] = [...seqMap.entries()]
      .map(([key, data]) => {
        const [from, to] = key.split('→')
        const avgTime = data.times.reduce((a, b) => a + b, 0) / data.times.length
        return { from, to, count: data.count, avgTimeBetweenMs: Math.round(avgTime) }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)  // top 50 sequences

    // Average time between all actions
    const gaps: number[] = []
    for (let i = 1; i < this.actions.length; i++) {
      gaps.push(this.actions[i].t - this.actions[i - 1].t)
    }
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0

    // Longest pause
    let longestPause = { durationMs: 0, afterAction: '', t: 0 }
    for (let i = 1; i < this.actions.length; i++) {
      const gap = this.actions[i].t - this.actions[i - 1].t
      if (gap > longestPause.durationMs) {
        longestPause = {
          durationMs: Math.round(gap),
          afterAction: this.actions[i - 1].action,
          t: Math.round(this.actions[i - 1].t),
        }
      }
    }

    return {
      actionSequences,
      avgTimeBetweenActionsMs: Math.round(avgGap),
      longestPause,
    }
  }

  private computeTaskAnalytics() {
    const tasksAttempted = [...new Set([...this.taskStarts.keys(), ...this.taskDurations.keys()])]
    const tasksCompleted = [...this.taskDurations.keys()]
    const avgTaskDurationMs: Record<string, number> = {}
    for (const [task, durations] of this.taskDurations) {
      avgTaskDurationMs[task] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    }

    return {
      tasksAttempted,
      tasksCompleted,
      avgTaskDurationMs,
    }
  }

  private computeErrorRecoveryRate(): number {
    if (this.errors.length === 0) return 100
    // For each error, check if the user performed a successful action within 30s
    let recovered = 0
    for (const error of this.errors) {
      const nextAction = this.actions.find(a => a.t > error.t && a.t < error.t + 30000)
      if (nextAction) recovered++
    }
    return Math.round((recovered / this.errors.length) * 100)
  }

  private computeEngagementScore(sessionDurationMs: number, activeDurationMs: number): number {
    // Factors: active time %, actions per minute, feature diversity, low idle
    const activeRatio = sessionDurationMs > 0 ? activeDurationMs / sessionDurationMs : 1
    const actionsPerMin = this.actions.length / (sessionDurationMs / 60000 || 1)
    const featureDiversity = this.featureFirstUse.size / Math.max(ALL_FEATURES.length, 1)
    const idleRatio = this.computeMouseAnalytics(sessionDurationMs).mouseIdleTimeMs / (sessionDurationMs || 1)

    const score = (
      activeRatio * 30 +
      Math.min(actionsPerMin / 5, 1) * 25 +
      featureDiversity * 25 +
      (1 - idleRatio) * 20
    )

    return Math.round(Math.max(0, Math.min(100, score)))
  }

  private computeEfficiencyScore(): number {
    // Lower undo rate, fewer cancelled dialogs, fewer rage clicks = higher efficiency
    const totalActions = this.actions.length || 1
    const undos = this.actions.filter(a => a.action === 'undo').length
    const cancels = this.dialogEvents.filter(e => e.result === 'cancelled').length
    const rages = this.rageClicks.length

    const wastedRatio = (undos + cancels + rages * 2) / totalActions
    return Math.round(Math.max(0, Math.min(100, 100 - wastedRatio * 100)))
  }

  private estimateCognitiveLoad(): 'low' | 'medium' | 'high' | 'overloaded' {
    const confusion = this.computeConfusionAnalytics().overallConfusionScore
    const hesitationRate = this.hesitations.length / (this.actions.length || 1)
    const undoRate = this.actions.filter(a => a.action === 'undo').length / (this.actions.length || 1)

    const load = confusion * 0.4 + Math.min(hesitationRate * 50, 30) + undoRate * 30
    if (load < 15) return 'low'
    if (load < 40) return 'medium'
    if (load < 70) return 'high'
    return 'overloaded'
  }
}
