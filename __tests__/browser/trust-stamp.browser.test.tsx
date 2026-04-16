import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustStamp } from "@/components/trust-stamp";

describe("<TrustStamp />", () => {
  const cases = [
    { verdict: "VERIFIED" as const, score: 85, tier: "VERIFIED" },
    { verdict: "TRUSTED" as const, score: 72, tier: "TRUSTED" },
    { verdict: "BUILDING" as const, score: 45, tier: "BUILDING" },
    { verdict: "INSUFFICIENT" as const, score: 12, tier: "INSUFFICIENT" },
    { verdict: "FLAGGED" as const, score: 3, tier: "FLAGGED" },
  ];

  describe("hero variant", () => {
    for (const c of cases) {
      it(`renders tier ${c.tier}`, () => {
        render(<TrustStamp verdict={c.verdict} score={c.score} size="hero" />);
        const el = screen.getByTestId("trust-stamp-hero");
        expect(el).toHaveAttribute("data-tier", c.tier);
        expect(el).toHaveTextContent(String(c.score));
      });
    }

    it("null score renders as em-dash", () => {
      render(<TrustStamp verdict={"UNKNOWN"} score={null} size="hero" />);
      expect(screen.getByTestId("trust-stamp-hero")).toHaveTextContent("\u2014");
    });
  });

  describe("square variant", () => {
    it("renders tier name + score", () => {
      render(<TrustStamp verdict="TRUSTED" score={72} size="square" />);
      const el = screen.getByTestId("trust-stamp-square");
      expect(el).toHaveAttribute("data-tier", "TRUSTED");
      expect(el).toHaveTextContent("72");
      expect(el).toHaveTextContent("TRUSTED");
    });

    it("INSUFFICIENT tier uses short label fit", () => {
      render(<TrustStamp verdict="INSUFFICIENT" score={15} size="square" />);
      const el = screen.getByTestId("trust-stamp-square");
      expect(el).toHaveTextContent("INSUFF");
    });
  });

  describe("chip variant", () => {
    it("renders tier name + score", () => {
      render(<TrustStamp verdict="BUILDING" score={50} size="chip" />);
      expect(screen.getByTestId("trust-stamp-chip")).toHaveTextContent("50");
    });
  });

  describe("UNKNOWN fallback", () => {
    it("renders INSUFFICIENT tier for UNKNOWN verdict", () => {
      render(<TrustStamp verdict="UNKNOWN" score={null} size="hero" />);
      expect(screen.getByTestId("trust-stamp-hero")).toHaveAttribute("data-tier", "INSUFFICIENT");
    });
  });
});
