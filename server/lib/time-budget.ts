/**
 * Simple time budget tracker for long-running tasks.
 * Allows tasks to check remaining time and stop gracefully before hard timeout.
 */
export class TimeBudget {
  private startMs: number;
  private totalMs: number;

  constructor(totalMs: number) {
    this.startMs = Date.now();
    this.totalMs = totalMs;
  }

  /** Milliseconds elapsed since creation. */
  elapsed(): number {
    return Date.now() - this.startMs;
  }

  /** Milliseconds remaining in the budget. */
  remaining(): number {
    return Math.max(0, this.totalMs - this.elapsed());
  }

  /** Returns true if at least `bufferMs` remains in the budget. */
  hasTime(bufferMs = 0): boolean {
    return this.remaining() > bufferMs;
  }

  /** Absolute deadline timestamp (ms since epoch). */
  deadlineMs(): number {
    return this.startMs + this.totalMs;
  }
}
