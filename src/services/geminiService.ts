import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface WordDetails {
  word: string;
  definition: string;
  partOfSpeech: string;
  phonetic: string;
}

export async function getWordDetails(word: string): Promise<WordDetails> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Translate the English word "${word}" to Vietnamese and provide its phonetic transcription and part of speech. Return the result in the specified JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          definition: { type: Type.STRING, description: "Vietnamese definition" },
          partOfSpeech: { type: Type.STRING, description: "e.g., noun, verb, adjective" },
          phonetic: { type: Type.STRING, description: "IPA phonetic transcription" }
        },
        required: ["word", "definition", "partOfSpeech", "phonetic"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text) as WordDetails;
}
