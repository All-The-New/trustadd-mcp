import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreRail } from "@/components/score-rail";

describe("<ScoreRail />", () => {
  it("places chip at 0%", () => {
    render(<ScoreRail verdict="INSUFFICIENT" score={0} />);
    const chip = screen.getByTestId("score-rail").querySelector('[data-testid="trust-stamp-chip"]');
    expect(chip).toBeTruthy();
  });

  it("renders correct tier at 72", () => {
    render(<ScoreRail verdict="TRUSTED" score={72} />);
    expect(screen.getByTestId("trust-stamp-chip")).toHaveAttribute("data-tier", "TRUSTED");
  });

  it("renders VERIFIED at 92", () => {
    render(<ScoreRail verdict="VERIFIED" score={92} />);
    expect(screen.getByTestId("trust-stamp-chip")).toHaveAttribute("data-tier", "VERIFIED");
  });

  it("handles null score as INSUFFICIENT", () => {
    render(<ScoreRail verdict="UNKNOWN" score={null} />);
    expect(screen.getByTestId("trust-stamp-chip")).toHaveAttribute("data-tier", "INSUFFICIENT");
  });
});
