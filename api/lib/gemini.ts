import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

export const wordDetailsResponseSchema = z.object({
  word: z.string(),
  definition: z.string(),
  partOfSpeech: z.string(),
  phonetic: z.string()
});

export type ServerWordDetails = z.infer<typeof wordDetailsResponseSchema>;

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set on the server");
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

export async function fetchWordDetailsFromGemini(word: string): Promise<ServerWordDetails> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
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
  if (!text) {
    throw new Error("Empty response from AI model");
  }

  const parsed: unknown = JSON.parse(text);
  return wordDetailsResponseSchema.parse(parsed);
}
