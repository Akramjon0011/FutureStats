
export interface PanelData {
  country: string;
  countryCode: string;
  flagEmoji: string;
  subject: string;
  statistic: string;
  description: string;
}

export interface GeneratedPrompt {
  id: number;
  content: string;
  panels: [PanelData, PanelData, PanelData];
}

export enum StylePreset {
  ConceptArt = 'Detailed Concept Art',
  DigitalPainting = 'Digital Painting',
  Cinematic = 'Cinematic Illustration',
  DarkFantasy = 'Dark Fantasy',
  Vivid = 'Vivid Realism',
  Classic = 'Classic Illustration',
  Sketch = 'Detailed Sketch',
  Mythical = 'Mythical/Ancient'
}

export interface GeneratorState {
  topic: string;
  style: StylePreset;
  isLoading: boolean;
  prompts: GeneratedPrompt[];
  error: string | null;
}
