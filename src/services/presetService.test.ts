import { describe, expect, it } from "vitest";
import { resolvePresetSections, PresetData, SectionData } from "./presetService";

describe("resolvePresetSections", () => {
  it("returns modern sections without modification", () => {
    const preset: PresetData = {
      instructions: "modern",
      sections: [
        {
          id: "custom",
          title: "Custom",
          list: "a, b",
          selections: ["a"],
          isRandomized: false,
        },
      ],
      defaults: {
        model: "gpt-4o-mini",
        seed: 0,
        batch: 1,
        concurrency: 1,
      },
    };

    const sections = resolvePresetSections(preset);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject<Partial<SectionData>>({
      id: "custom",
      title: "Custom",
      list: "a, b",
      isRandomized: false,
    });
    expect(sections[0].selections).toEqual(["a"]);
  });

  it("migrates legacy preset structures", () => {
    const preset: PresetData = {
      instructions: "legacy",
      sectionTitles: {
        section1: "Pre",
        section2: "Composition",
        section3: "Environment",
        section4: "Time of Day",
        section5: "Weather / Atmosphere",
        section6: "Lighting",
        section7: "Lens",
        section8: "Post",
      },
      lists: {
        pre: "one",
        composition: "two",
        environment: "three",
        time: "four",
        weather: "five",
        lighting: "six",
        lens: "seven",
        post: "eight",
      },
      defaults: {
        model: "gpt-4o-mini",
        seed: -1,
        batch: 1,
        concurrency: 4,
      },
    };

    const sections = resolvePresetSections(preset);
    expect(sections).toHaveLength(8);

    const titles = sections.map((section) => section.title);
    expect(titles).toEqual([
      "Pre",
      "Composition",
      "Environment",
      "Time of Day",
      "Weather / Atmosphere",
      "Lighting",
      "Lens",
      "Post",
    ]);

    expect(sections[0].list).toBe("one");
    expect(sections[7].list).toBe("eight");
    expect(sections[7].isRandomized).toBe(false);
  });
});
