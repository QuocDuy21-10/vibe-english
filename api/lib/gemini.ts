import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { serverWordUsageSchema, type ServerWordUsage, type WordUsageRequestItem } from "./wordUsages.js";

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

export const batchWordDetailsResponseSchema = z.array(wordDetailsResponseSchema);

export async function fetchBatchWordDetailsFromGemini(
  words: string[]
): Promise<ServerWordDetails[]> {
  if (!words || words.length === 0) {
    return [];
  }

  const client = getGeminiClient();
  const wordListStr = words.map((w, idx) => `${idx + 1}. ${w}`).join("\n");
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Translate the following English words into Vietnamese and provide their phonetic transcriptions (IPA) and parts of speech (e.g., noun, verb, adjective, adverb).
Return a JSON array containing one object for each requested word with keys "word", "definition", "partOfSpeech", and "phonetic".

Words to translate:
${wordListStr}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
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
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from AI model");
  }

  const parsed: unknown = JSON.parse(text);
  return batchWordDetailsResponseSchema.parse(parsed);
}

export async function fetchWordUsagesFromGemini(items: WordUsageRequestItem[]): Promise<ServerWordUsage[]> {
  if (items.length === 0) return [];

  const client = getGeminiClient();
  const list = items
    .map((item, idx) => `${idx + 1}. "${item.word}" (${item.partOfSpeech || "unknown"}) — nghĩa: ${item.definition}`)
    .join("\n");
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `You help a Vietnamese learner use English vocabulary in context.
For each word below, use the given part of speech and Vietnamese meaning, and return:
- "examples": exactly 3 natural, everyday English sentences (max 20 words each). "translation" is the Vietnamese translation. "answer" is the word exactly as it appears in that sentence (inflected form allowed, e.g. "deployed").
- "collocations": 3 to 5 common collocations containing the word. "meaning" is the Vietnamese meaning.
Return a JSON array with one object per word, keeping "word" exactly as given.

Words:
${list}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sentence: { type: Type.STRING },
                  translation: { type: Type.STRING, description: "Vietnamese translation" },
                  answer: { type: Type.STRING, description: "The word exactly as written in the sentence" }
                },
                required: ["sentence", "translation", "answer"]
              }
            },
            collocations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phrase: { type: Type.STRING },
                  meaning: { type: Type.STRING, description: "Vietnamese meaning" }
                },
                required: ["phrase", "meaning"]
              }
            }
          },
          required: ["word", "examples", "collocations"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from AI model");
  }

  const parsed: unknown = JSON.parse(text);
  return z.array(serverWordUsageSchema).parse(parsed);
}
