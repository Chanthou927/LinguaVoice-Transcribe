import React, { useState, useRef, useCallback } from 'react';
import { Mic, Square, Loader2, Copy, RefreshCcw, AlertCircle } from 'lucide-react';
import { Language, AppState } from './types';
import { getMimeType, blobToBase64 } from './utils/audioUtils';
import { transcribeAudio } from './services/geminiService';
import Visualizer from './components/Visualizer';
import LanguageSelect from './components/LanguageSelect';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setErrorMsg(null);
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);
      
      const mimeType = getMimeType();
      const mediaRecorder = new MediaRecorder(audioStream, { mimeType });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleRecordingStop;

      mediaRecorder.start();
      setAppState(AppState.RECORDING);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setErrorMsg("Could not access microphone. Please allow permissions.");
      setAppState(AppState.ERROR);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Stop all tracks to release microphone
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setAppState(AppState.PROCESSING);
    }
  };

  const handleRecordingStop = async () => {
    try {
      const mimeType = getMimeType();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const base64 = await blobToBase64(blob);
      
      const text = await transcribeAudio(base64, mimeType, language);
      
      setTranscribedText(text);
      setAppState(AppState.COMPLETED);
    } catch (err) {
      console.error("Transcription error:", err);
      setErrorMsg("Failed to transcribe. Please try again.");
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setTranscribedText("");
    setErrorMsg(null);
    chunksRef.current = [];
  };

  const copyToClipboard = () => {
    if (transcribedText) {
      navigator.clipboard.writeText(transcribedText);
      // Could add a toast here
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8 font-sans">
      
      {/* Header */}
      <header className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Mic className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">LinguaVoice</h1>
        </div>
        <div className="text-xs font-medium px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-500 uppercase tracking-wide">
          Beta
        </div>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-2xl bg-white rounded-3xl shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100">
        
        {/* Controls & Visualizer Area */}
        <div className="p-6 sm:p-10 flex flex-col items-center border-b border-slate-100">
          
          <LanguageSelect 
            selected={language} 
            onSelect={setLanguage} 
            disabled={appState === AppState.RECORDING || appState === AppState.PROCESSING} 
          />

          <div className="w-full mb-8 relative">
             <Visualizer stream={stream} isRecording={appState === AppState.RECORDING} />
             {appState === AppState.RECORDING && (
               <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-50 text-red-500 px-2 py-1 rounded-lg text-xs font-bold animate-pulse">
                 <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                 REC
               </div>
             )}
          </div>

          <div className="flex items-center gap-6">
            {appState === AppState.IDLE || appState === AppState.COMPLETED || appState === AppState.ERROR ? (
              <button
                onClick={startRecording}
                className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 transition-all hover:scale-105 focus:ring-4 focus:ring-indigo-100"
              >
                <Mic size={32} />
                <span className="absolute -bottom-8 text-sm font-medium text-slate-400 group-hover:text-indigo-600 transition-colors">Record</span>
              </button>
            ) : null}

            {appState === AppState.RECORDING && (
              <button
                onClick={stopRecording}
                className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-200 transition-all hover:scale-105 focus:ring-4 focus:ring-red-100"
              >
                <Square size={32} fill="currentColor" />
                 <span className="absolute -bottom-8 text-sm font-medium text-slate-400 group-hover:text-red-500 transition-colors">Stop</span>
              </button>
            )}

            {appState === AppState.PROCESSING && (
              <div className="flex flex-col items-center">
                 <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-indigo-100 flex items-center justify-center">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                 </div>
                 <span className="mt-2 text-sm font-medium text-indigo-600 animate-pulse">Transcribing...</span>
              </div>
            )}
          </div>
          
           {errorMsg && (
            <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
              <AlertCircle size={18} />
              {errorMsg}
            </div>
          )}

        </div>

        {/* Result Area */}
        <div className="p-6 sm:p-10 bg-slate-50/50 min-h-[200px]">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Transcription</h3>
             {(appState === AppState.COMPLETED && transcribedText) && (
               <div className="flex gap-2">
                 <button 
                   onClick={copyToClipboard}
                   className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                   title="Copy text"
                 >
                   <Copy size={18} />
                 </button>
                 <button 
                   onClick={handleReset}
                   className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                   title="New recording"
                 >
                   <RefreshCcw size={18} />
                 </button>
               </div>
             )}
          </div>
          
          <div className={`
            w-full rounded-xl bg-white border border-slate-200 p-6 text-lg leading-relaxed text-slate-700 shadow-sm min-h-[150px]
            ${language === Language.KHMER ? 'font-khmer' : 'font-sans'}
          `}>
            {transcribedText ? (
              transcribedText
            ) : (
              <span className="text-slate-300 italic">
                {appState === AppState.PROCESSING 
                  ? "AI is processing your audio..." 
                  : appState === AppState.RECORDING 
                    ? "Listening..." 
                    : "Your transcription will appear here."}
              </span>
            )}
          </div>
        </div>
      </main>

      <footer className="mt-12 text-center text-slate-400 text-sm">
        <p>Powered by Gemini 2.5 Flash</p>
      </footer>
    </div>
  );
};

export default App;