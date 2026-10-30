import { describe, expect, it } from "vitest";
import {
  formatDuration,
  modeLabel,
  percent,
  scoreTone,
  studyTime,
} from "./format";

describe("percent", () => {
  it("rounds the score ratio", () => {
    expect(percent(8, 10)).toBe(80);
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
  });

  it("handles empty quizzes", () => {
    expect(percent(0, 0)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("formats seconds and minutes", () => {
    expect(formatDuration(500)).toBe("1s");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(134_000)).toBe("2m 14s");
  });

  it("never returns a negative duration", () => {
    expect(formatDuration(-5000)).toBe("0s");
  });
});

describe("labels and tones", () => {
  it("maps quiz modes", () => {
    expect(modeLabel("multiple_choice")).toBe("Multiple choice");
    expect(modeLabel("written")).toBe("Written");
    expect(modeLabel("mixed")).toBe("Mixed");
    expect(modeLabel("other")).toBe("other");
  });

  it("classifies scores", () => {
    expect(scoreTone(90)).toBe("good");
    expect(scoreTone(80)).toBe("good");
    expect(scoreTone(65)).toBe("ok");
    expect(scoreTone(49)).toBe("low");
  });
});

describe("studyTime", () => {
  it("estimates roughly two cards per minute", () => {
    expect(studyTime(0)).toBe("1 min");
    expect(studyTime(1)).toBe("1 min");
    expect(studyTime(10)).toBe("5 min");
    expect(studyTime(25)).toBe("13 min");
  });
});
