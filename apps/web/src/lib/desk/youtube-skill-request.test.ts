import { describe, expect, it } from "vitest";
import { youtubeSkillRequestError, youtubeSkillSchema } from "@/lib/validation";

describe("youtube skill request errors", () => {
  it("says what is wrong instead of Validation failed", () => {
    const tooLongLink = youtubeSkillSchema.safeParse({
      jobId: "job-1",
      youtubeUrl: `https://www.youtube.com/watch?v=eWKY0OnPByg ${"x".repeat(2_100)}`,
    });
    expect(tooLongLink.success).toBe(false);
    if (tooLongLink.success) return;
    expect(youtubeSkillRequestError({ youtubeUrl: "x" }, tooLongLink.error)).toMatch(/too long/i);
    expect(youtubeSkillRequestError({ youtubeUrl: "x" }, tooLongLink.error)).not.toMatch(
      /validation failed/i,
    );

    const tooLongTranscript = youtubeSkillSchema.safeParse({
      jobId: "job-1",
      transcript: "word ".repeat(50_000),
    });
    expect(tooLongTranscript.success).toBe(false);
    if (tooLongTranscript.success) return;
    expect(youtubeSkillRequestError({ transcript: "word" }, tooLongTranscript.error)).toMatch(
      /transcript is too long/i,
    );

    const longTitle = youtubeSkillSchema.safeParse({
      jobId: "job-1",
      youtubeUrl: "https://www.youtube.com/watch?v=eWKY0OnPByg",
      title: "t".repeat(161),
    });
    expect(longTitle.success).toBe(false);
    if (longTitle.success) return;
    expect(youtubeSkillRequestError({ title: "t" }, longTitle.error)).toMatch(/title is too long/i);

    const missingJob = youtubeSkillSchema.safeParse({
      youtubeUrl: "https://www.youtube.com/watch?v=eWKY0OnPByg",
    });
    expect(missingJob.success).toBe(false);
    if (missingJob.success) return;
    expect(youtubeSkillRequestError({}, missingJob.error)).toMatch(/desk job/i);

    const unreadable = youtubeSkillSchema.safeParse(null);
    expect(unreadable.success).toBe(false);
    if (unreadable.success) return;
    expect(youtubeSkillRequestError(null, unreadable.error)).toMatch(/could not be read/i);
  });

  it("accepts a share-sheet paste that is longer than a bare URL", () => {
    const share = [
      "How a normal video becomes a skill",
      "https://www.youtube.com/watch?v=eWKY0OnPByg",
      "Public video. Paste the address, not the description.",
    ].join("\n");
    const parsed = youtubeSkillSchema.safeParse({
      jobId: "job-1",
      youtubeUrl: share,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.youtubeUrl).toContain("watch?v=eWKY0OnPByg");
  });
});
