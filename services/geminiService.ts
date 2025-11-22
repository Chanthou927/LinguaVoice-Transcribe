import { GoogleGenAI, Modality } from "@google/genai";
import { Language } from "../types";
import { base64Encode, floatTo16BitPCM } from "../utils/audioUtils";

/**
 * Transcribes audio using Gemini 2.5 Flash (File-based/Offline).
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
  
  const systemInstruction = `You are an expert transcriber. 
  Your task is to transcribe the provided audio file accurately into ${language}.
  - Return ONLY the transcribed text.
  - Do not include timestamps, speaker labels, or conversational filler.
  - If the audio is silent or unintelligible, return "[Unintelligible]".
  - Respect proper punctuation and grammar for ${language}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
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

/**
 * Real-time transcription service using Gemini Live API.
 */
export class LiveTranscriptionService {
  private client: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isProcessing = false;
  
  constructor() {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async start(
    stream: MediaStream, 
    language: Language, 
    onText: (text: string) => void,
    onError: (err: Error) => void
  ) {
    try {
      // Initialize Audio Context for 16kHz PCM
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });

      // Connect to Gemini Live API
      this.sessionPromise = this.client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], // Required by Live API
          inputAudioTranscription: { model: "google_speech_v2" }, // Enable input transcription
          systemInstruction: `You are a helpful transcriber. 
          Your task is to listen to the user's speech in ${language} and transcribe it.
          Do not respond with spoken audio. Remain silent and just listen.`,
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Connected");
            this.startAudioProcessing(stream);
          },
          onmessage: (msg) => {
            // Handle transcription updates
            if (msg.serverContent?.inputTranscription?.text) {
              onText(msg.serverContent.inputTranscription.text);
            }
            // We ignore modelTurn audio as we want a silent transcriber
          },
          onerror: (err) => {
            console.error("Gemini Live API Error:", err);
            onError(new Error("Connection to Gemini interrupted."));
          },
          onclose: () => {
            console.log("Gemini Live Session Closed");
          },
        }
      });

      // Wait for connection
      await this.sessionPromise;
      this.isProcessing = true;

    } catch (error: any) {
      onError(error);
    }
  }
  
  private startAudioProcessing(stream: MediaStream) {
    if (!this.audioContext || !this.sessionPromise) return;

    this.source = this.audioContext.createMediaStreamSource(stream);
    // Create script processor (bufferSize, inputChannels, outputChannels)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (!this.isProcessing) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = floatTo16BitPCM(inputData);
      const base64 = base64Encode(pcm16);
      
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({
          media: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64
          }
        });
      });
    };
    
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  pause() {
    this.isProcessing = false;
  }

  resume() {
    this.isProcessing = true;
  }

  stop() {
    this.isProcessing = false;
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close());
      this.sessionPromise = null;
    }
  }
}
