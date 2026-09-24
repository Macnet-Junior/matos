import { describe, expect, it } from "vitest";
import { buildChannelPackage, extractPressChannelSection } from "./press-packages";

const press = `# Press · Per-channel packs

## x
- Short: gated desk, not another calendar app.

## linkedin
- Narrative: Operators drown in almost-ships.

## newsletter
- Subject: Stop filing drafts
- Body: Walk the stages.
`;

describe("press channel packages", () => {
  it("extracts the approved Press section for a channel", () => {
    expect(extractPressChannelSection(press, "x")).toMatch(/gated desk/);
    expect(extractPressChannelSection(press, "linkedin")).toMatch(/Operators drown/);
    expect(extractPressChannelSection(press, "newsletter")).toMatch(/Stop filing drafts/);
    expect(extractPressChannelSection(press, "tiktok")).toBeNull();
  });

  it("builds a structured package from Press content", () => {
    const pkg = buildChannelPackage({
      channel: "x",
      pressBody: press,
      title: "ICP pain",
      topic: "ops",
      offerCta: "Open Desk",
    });
    expect(pkg?.channel).toBe("x");
    expect(pkg?.text).toMatch(/gated desk/);
    expect(pkg?.text).not.toMatch(/Scheduled pack/);
  });
});
