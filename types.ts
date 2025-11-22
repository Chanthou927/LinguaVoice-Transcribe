export enum Language {
  ENGLISH = 'English',
  KHMER = 'Khmer',
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface TranscriptionResult {
  text: string;
  language: Language;
  timestamp: number;
}