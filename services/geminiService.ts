import { StylePreset } from "../types";

/**
 * Layered Architecture Layer: Call server-side Express API instead of direct browser SDK invocation.
 * This ensures API secrets are strictly hidden from the client browser.
 */
export const generateInfographicPrompts = async (
  topic: string, 
  style: StylePreset,
  predictionYear?: string,
  sortingOrder?: string,
  aspectRatio?: string
): Promise<any[]> => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ topic, style, predictionYear, sortingOrder, aspectRatio })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Server returns an error status.');
    }

    const data = await response.json();
    return data.prompts || [];
  } catch (err: any) {
    console.error("Client fetch error: ", err);
    throw new Error(err.message || "Taqqoslash ssenariysi tayyorlashda tarmoq yoki server xatosi yuz berdi.");
  }
};
