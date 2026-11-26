/**
 * Copyright 2026 BitWise Media Group Ltd
 * SPDX-License-Identifier: MIT
 */

// The ktiro mark: a spine (the intent) that forks into two blind tracks
// (review ‖ security) and converges on one filled node (the outcome). Read
// as a pipeline, or as a k. Drawn on a 24-unit grid; index.html carries the
// same geometry as the favicon, so keep the two in step.

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="flex-none">
      <g fill="none" stroke="var(--k-line-3)" stroke-width="1.7" stroke-linecap="round">
        <path d="M5 3.5v17" />
        <path d="M5 12l7.5-5.5M5 12l7.5 5.5M12.5 6.5 19 12M12.5 17.5 19 12" />
      </g>
      <circle cx="12.5" cy="6.5" r="2.2" fill="var(--k-line-3)" />
      <circle cx="12.5" cy="17.5" r="2.2" fill="var(--k-line-3)" />
      <circle cx="19" cy="12" r="3.3" fill="var(--k-accent)" />
    </svg>
  );
}
