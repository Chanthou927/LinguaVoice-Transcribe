import { GoogleGenAI } from "@google/genai";
import { Language } from "../types";

/**
 * Transcribes audio using Gemini 2.5 Flash.
 * @param base64Audio Raw base64 string of the audio.
 * @param mimeType The MIME type of the audio (e.g., 'audio/webm').
 * @param language The target language for transcription.
 */
export const transcribeAudio = async (
  base64Audio: string,
  mimeType: string,
  language: Language
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Specific system instructions to ensure clean output without conversational filler.
  const systemInstruction = `You are an expert transcriber. 
  Your task is to transcribe the provided audio file accurately into ${language}.
  - Return ONLY the transcribed text.
  - Do not include timestamps, speaker labels, or conversational filler (like "Here is the transcription").
  - If the audio is silent or unintelligible, return "[Unintelligible]".
  - Respect proper punctuation and grammar for ${language}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // Low temperature for deterministic output
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
          {
            text: `Transcribe this audio into ${language}.`
          }
        ],
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};