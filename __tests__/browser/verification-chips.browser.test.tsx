import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  VerificationChips,
  computeVisibleCount,
  VERIFICATION_PRIORITY,
  type EarnedVerification,
} from "@/components/verification-chips";

// jsdom always returns 0 for offsetWidth. Stub it so the ResizeObserver-driven
// measurement pass sees a wide container and narrow chips → all chips fit.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    // Container div (data-testid="verification-chips") → 800px wide
    if (this.dataset?.testid === "verification-chips") return 800;
    // Hidden measurement chips → 40px each
    if (this.dataset?.chip !== undefined) return 40;
    return 0;
  });
});

describe("computeVisibleCount", () => {
  it("returns 0,0 for empty", () => {
    expect(computeVisibleCount([], 500, 5, 52)).toEqual({ visible: 0, droppedCount: 0 });
  });
  it("fits all when total <= available", () => {
    expect(computeVisibleCount([50, 60, 70], 500, 5, 52)).toEqual({ visible: 3, droppedCount: 0 });
  });
  it("drops last few when overflow", () => {
    const result = computeVisibleCount([100, 100, 100, 100, 100], 260, 5, 52);
    expect(result.visible).toBeLessThan(5);
    expect(result.droppedCount).toBeGreaterThan(0);
  });
});

describe("<VerificationChips />", () => {
  function mkEarned(names: string[]): EarnedVerification[] {
    return VERIFICATION_PRIORITY.map(p => ({ name: p.name, earned: names.includes(p.name) }));
  }

  it("renders earned chips in priority order", () => {
    render(
      <VerificationChips
        verifications={mkEarned(["First Transaction", "x402 Enabled", "GitHub Connected"])}
      />,
    );
    const chips = screen.getAllByTestId(/^chip-(?!overflow)/);
    expect(chips[0]).toHaveTextContent("1st Tx");
    expect(chips[1]).toHaveTextContent("x402");
    expect(chips[2]).toHaveTextContent("GitHub");
  });

  it("renders zero chips when none earned", () => {
    render(<VerificationChips verifications={mkEarned([])} />);
    expect(screen.queryAllByTestId(/^chip-(?!overflow)/).length).toBe(0);
  });

  it("renders all 9 chips when all earned and enough width", () => {
    render(
      <VerificationChips
        verifications={mkEarned(VERIFICATION_PRIORITY.map(p => p.name))}
      />,
    );
    const chips = screen.getAllByTestId(/^chip-(?!overflow)/);
    expect(chips.length).toBe(9);
  });
});
