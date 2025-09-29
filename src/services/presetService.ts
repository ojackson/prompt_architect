/**
 * Service for managing presets and API operations
 */

export interface SectionData {
  id: string;
  title: string;
  list: string;
  selections: string[];
  isRandomized: boolean;
}

export interface PresetData {
  instructions: string;
  // New format
  sections?: SectionData[];
  // Old format (for backward compatibility)
  sectionTitles?: Record<string, string>;
  lists?: Record<string, string>;
  defaults: {
    model: string;
    seed: number;
    batch: number;
    concurrency: number;
  };
}

type LegacySectionConfig = {
  sectionKey: string;
  legacyKey: string;
  fallbackTitle: string;
  isRandomized: boolean;
};

const LEGACY_SECTIONS: LegacySectionConfig[] = [
  { sectionKey: "section1", legacyKey: "pre", fallbackTitle: "Pre", isRandomized: true },
  { sectionKey: "section2", legacyKey: "composition", fallbackTitle: "Composition", isRandomized: true },
  { sectionKey: "section3", legacyKey: "environment", fallbackTitle: "Environment", isRandomized: true },
  { sectionKey: "section4", legacyKey: "time", fallbackTitle: "Time of Day", isRandomized: true },
  { sectionKey: "section5", legacyKey: "weather", fallbackTitle: "Weather / Atmosphere", isRandomized: true },
  { sectionKey: "section6", legacyKey: "lighting", fallbackTitle: "Lighting", isRandomized: true },
  { sectionKey: "section7", legacyKey: "lens", fallbackTitle: "Lens", isRandomized: true },
  { sectionKey: "section8", legacyKey: "post", fallbackTitle: "Post", isRandomized: false },
];

/**
 * Normalize preset sections, migrating legacy structures when necessary.
 */
export function resolvePresetSections(preset: PresetData): SectionData[] {
  if (Array.isArray(preset.sections) && preset.sections.length) {
    return preset.sections.map((section, index) => ({
      id: section.id || `section-${index + 1}`,
      title: section.title?.trim() || `Section ${index + 1}`,
      list: section.list || "",
      selections: Array.isArray(section.selections) ? section.selections : [],
      isRandomized: Boolean(section.isRandomized),
    }));
  }

  const titles = preset.sectionTitles ?? {};
  const lists = preset.lists ?? {};
  const normalizedLists = Object.entries(lists).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key.toLowerCase()] = value;
    }
    return acc;
  }, {});

  return LEGACY_SECTIONS.map((config) => {
    const configuredTitle = titles[config.sectionKey]?.trim();
    const title = configuredTitle || config.fallbackTitle;

    const candidateKeys = [
      config.legacyKey,
      config.legacyKey.toLowerCase(),
      config.legacyKey.toUpperCase(),
      title,
      title.toLowerCase(),
      title.toUpperCase(),
      config.sectionKey,
    ];

    const list = candidateKeys.reduce<string | undefined>((found, candidate) => {
      if (found) return found;
      if (!candidate) return undefined;
      const lookupKey = candidate.toLowerCase();
      return normalizedLists[lookupKey];
    }, undefined) || "";

    return {
      id: config.sectionKey,
      title,
      list,
      selections: [],
      isRandomized: config.isRandomized,
    };
  });
}

/**
 * Load a preset from the local presets folder
 */
export async function getPreset(name: string): Promise<PresetData | null> {
  try {
    const url = `/src/presets/${name}.json`;
    console.log(`Attempting to fetch preset: ${url}`);
    const response = await fetch(url);
    console.log(`Response status for ${name}:`, response.status, response.ok);
    if (!response.ok) {
      console.warn(`Preset ${name} not found, using defaults`);
      return null;
    }
    const data = await response.json();
    console.log(`Successfully loaded preset ${name}:`, data);
    return data;
  } catch (error) {
    console.warn(`Error loading preset ${name}:`, error);
    return null;
  }
}

/**
 * Get list of available presets
 */
export async function getAvailablePresets(): Promise<string[]> {
  try {
    const response = await fetch('/api/presets/list');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    if (!text) {
      throw new Error('Empty response from server');
    }
    
    const result = JSON.parse(text);
    return result.presets || [];
  } catch (error) {
    console.warn('Error loading available presets, using fallback:', error);
    return ["default", "HWS14", "ORJ", "Reptile"]; // fallback
  }
}

/**
 * Save a preset to disk
 */
export async function putPreset(name: string, data: PresetData): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Try API first
    const response = await fetch('/api/presets/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, data }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('Response text:', text);
    
    if (!text) {
      throw new Error('Empty response from server');
    }
    
    const result = JSON.parse(text);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save preset');
    }
    
    return result;
  } catch (error) {
    console.warn('API save failed, falling back to download:', error);
    
    // Fallback: Download the preset as a JSON file
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { 
      success: true, 
      message: `Preset ${name} downloaded as JSON file. Please save it to src/presets/ directory.` 
    };
  }
}

/**
 * Default preset data
 */
export const DEFAULT_PRESET: PresetData = {
  instructions: "You rewrite a structured scene spec into ONE cinematic paragraph (2–5 sentences) for an AI image generator.",
  sections: [
    { id: "default-1", title: "Pre", list: "Subject", selections: [], isRandomized: true },
    { id: "default-2", title: "Composition", list: "wide shot, medium shot, close-up", selections: [], isRandomized: true },
    { id: "default-3", title: "Environment", list: "location", selections: [], isRandomized: true },
    { id: "default-4", title: "Time of Day", list: "day, night", selections: [], isRandomized: true },
    { id: "default-5", title: "Weather / Atmosphere", list: "clear, cloudy", selections: [], isRandomized: true },
    { id: "default-6", title: "Lighting", list: "natural light, artificial light", selections: [], isRandomized: true },
    { id: "default-7", title: "Lens", list: "50mm f/1.8", selections: [], isRandomized: true },
    { id: "default-8", title: "Post", list: "standard processing", selections: [], isRandomized: false }
  ],
  defaults: {
    model: "gpt-4o-mini",
    seed: -1,
    batch: 1,
    concurrency: 4
  }
};
