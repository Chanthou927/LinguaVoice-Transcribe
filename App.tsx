import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Copy, RefreshCcw, AlertCircle, Pause, Play, Info, Download, Check, Edit2, X, Settings } from 'lucide-react';
import { Language, AppState } from './types';
import { getMimeType, blobToBase64 } from './utils/audioUtils';
import { LiveTranscriptionService } from './services/geminiService';
import Visualizer from './components/Visualizer';
import LanguageSelect from './components/LanguageSelect';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [maxDuration, setMaxDuration] = useState<number>(300); // Default 5 minutes

  // Refs for services and state
  const liveServiceRef = useRef<LiveTranscriptionService | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  
  // Keep track of text in ref to avoid closure staleness in callbacks if needed, 
  // though functional updates setTranscribedText(prev => ...) are preferred.
  
  // Timer Logic
  useEffect(() => {
    if (appState === AppState.RECORDING) {
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (appState === AppState.PAUSED) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    } else if (appState === AppState.IDLE) {
      setRecordingTime(0);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [appState]);

  // Auto-stop when max duration is reached
  useEffect(() => {
    if (appState === AppState.RECORDING && recordingTime >= maxDuration) {
      stopRecording();
    }
  }, [recordingTime, maxDuration, appState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setErrorMsg(null);
      setTranscribedText(""); // Clear previous
      
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);
      
      // Initialize Live Service
      const service = new LiveTranscriptionService();
      liveServiceRef.current = service;

      setAppState(AppState.PROCESSING); // Brief loading state while connecting

      await service.start(
        audioStream, 
        language, 
        (textChunk) => {
          // Live API sends text chunks as they are processed.
          // Simple accumulation:
          setTranscribedText(prev => prev + textChunk);
        },
        (error) => {
          console.error(error);
          setErrorMsg(error.message);
          stopRecording(); // Safety stop
          setAppState(AppState.ERROR);
        }
      );

      setAppState(AppState.RECORDING);
    } catch (err) {
      console.error("Error accessing microphone or connecting:", err);
      setErrorMsg("Could not start recording. Check permissions or connection.");
      setAppState(AppState.ERROR);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const pauseRecording = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.pause();
      setAppState(AppState.PAUSED);
    }
  };

  const resumeRecording = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.resume();
      setAppState(AppState.RECORDING);
    }
  };

  const stopRecording = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.stop();
      liveServiceRef.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    setAppState(AppState.COMPLETED);
  };

  const cancelRecording = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.stop();
      liveServiceRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    handleReset();
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setTranscribedText("");
    setErrorMsg(null);
    setRecordingTime(0);
    if (liveServiceRef.current) {
      liveServiceRef.current.stop();
      liveServiceRef.current = null;
    }
  };

  const copyToClipboard = () => {
    if (transcribedText) {
      navigator.clipboard.writeText(transcribedText);
    }
  };

  const downloadText = () => {
    const element = document.createElement("a");
    const file = new Blob([transcribedText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `transcription-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8 font-sans text-slate-900">
      
      {/* Header */}
      <header className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Mic className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-none">LinguaVoice</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Real-time AI Transcription</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(true)}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100"
            aria-label="Settings"
            disabled={appState === AppState.RECORDING || appState === AppState.PAUSED}
          >
            <Settings size={24} />
          </button>
          <button 
            onClick={() => setShowPrivacy(true)}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100"
            aria-label="Privacy Info"
          >
            <Info size={24} />
          </button>
        </div>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-2xl bg-white rounded-3xl shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100 relative">
        
        {/* Settings Modal */}
        {showSettings && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-8 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
            <Settings className="text-indigo-600 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings</h2>
            
            <div className="w-full max-w-xs mb-8">
              <div className="flex justify-between items-end mb-4">
                <label className="text-sm font-medium text-slate-600">
                  Max Recording Duration
                </label>
                <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-md text-sm">
                  {Math.floor(maxDuration / 60)} min
                </span>
              </div>
              
              <input 
                type="range" 
                min="60" 
                max="600" 
                step="60" 
                value={maxDuration} 
                onChange={(e) => setMaxDuration(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                <span>1m</span>
                <span>5m</span>
                <span>10m</span>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Save & Close
            </button>
          </div>
        )}

        {/* Privacy Modal */}
        {showPrivacy && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-8 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
            <Info className="text-indigo-600 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Privacy & Data</h2>
            <p className="text-slate-600 mb-6 max-w-md">
              Your audio is streamed directly to Google's Gemini Live API for real-time transcription. 
              We do not store your voice recordings or transcriptions on our servers.
              <br/><br/>
              This app requires a valid API key with access to Gemini 2.5 Flash.
            </p>
            <button 
              onClick={() => setShowPrivacy(false)}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Got it
            </button>
          </div>
        )}

        {/* Controls Area */}
        <div className="p-6 sm:p-10 flex flex-col items-center border-b border-slate-100 relative">
          
          <LanguageSelect 
            selected={language} 
            onSelect={setLanguage} 
            disabled={appState !== AppState.IDLE && appState !== AppState.COMPLETED && appState !== AppState.ERROR} 
          />

          {/* Status Indicator */}
          <div className="h-8 mb-2 flex items-center justify-center">
            {appState === AppState.RECORDING && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold animate-pulse">
                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                LIVE RECORDING {formatTime(recordingTime)} / {formatTime(maxDuration)}
              </div>
            )}
            {appState === AppState.PAUSED && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold">
                <Pause size={10} fill="currentColor" />
                PAUSED {formatTime(recordingTime)}
              </div>
            )}
            {appState === AppState.PROCESSING && (
               <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">
                 <Loader2 size={12} className="animate-spin" />
                 CONNECTING...
               </div>
            )}
          </div>

          <div className="w-full mb-8 relative">
             <Visualizer 
               stream={stream} 
               isRecording={appState === AppState.RECORDING || appState === AppState.PAUSED} 
               isPaused={appState === AppState.PAUSED}
             />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-6 w-full">
            
            {/* IDLE State */}
            {(appState === AppState.IDLE || appState === AppState.COMPLETED || appState === AppState.ERROR) && (
              <button
                onClick={startRecording}
                className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 transition-all hover:scale-105 focus:ring-4 focus:ring-indigo-100 active:scale-95"
                aria-label="Start Recording"
              >
                <Mic size={32} />
                <span className="absolute -bottom-8 text-sm font-medium text-slate-400 group-hover:text-indigo-600 transition-colors">Record</span>
                {/* Pulse Ring */}
                <span className="absolute inset-0 rounded-full border-2 border-indigo-600 opacity-0 group-hover:animate-ping"></span>
              </button>
            )}

            {/* Recording Controls */}
            {(appState === AppState.RECORDING || appState === AppState.PAUSED || appState === AppState.PROCESSING) && (
              <>
                {/* Pause/Resume (Only active when strictly recording/paused) */}
                <button
                  onClick={appState === AppState.RECORDING ? pauseRecording : resumeRecording}
                  disabled={appState === AppState.PROCESSING}
                  className={`flex items-center justify-center w-12 h-12 rounded-full border transition-all shadow-sm hover:shadow-md
                    ${appState === AppState.PROCESSING 
                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}`}
                  title={appState === AppState.RECORDING ? "Pause" : "Resume"}
                >
                  {appState === AppState.RECORDING ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>

                {/* Stop Button */}
                <button
                  onClick={stopRecording}
                  className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-xl shadow-red-200 transition-all hover:scale-105 focus:ring-4 focus:ring-red-100"
                  aria-label="Stop Recording"
                >
                  <Square size={32} fill="currentColor" />
                   <span className="absolute -bottom-8 text-sm font-medium text-slate-400 group-hover:text-red-500 transition-colors">Stop</span>
                </button>

                {/* Cancel Button */}
                <button
                   onClick={cancelRecording}
                   className="flex items-center justify-center w-12 h-12 rounded-full bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm hover:shadow-md"
                   title="Cancel"
                >
                  <X size={20} />
                </button>
              </>
            )}
          </div>
          
           {errorMsg && (
            <div className="mt-6 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm border border-red-100 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} />
              {errorMsg}
            </div>
          )}

        </div>

        {/* Result Area */}
        <div className="p-6 sm:p-10 bg-slate-50/50 min-h-[240px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Live Transcription</h3>
                {(appState === AppState.RECORDING || appState === AppState.PROCESSING) && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                )}
             </div>
             {(transcribedText) && (
               <div className="flex gap-2">
                 <button 
                   onClick={downloadText}
                   className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                   title="Download text"
                 >
                   <Download size={18} />
                 </button>
                 <button 
                   onClick={copyToClipboard}
                   className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                   title="Copy to clipboard"
                 >
                   <Copy size={18} />
                 </button>
                 <div className="w-px h-6 bg-slate-200 mx-1"></div>
                 <button 
                   onClick={handleReset}
                   className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                   title="Clear"
                 >
                   <RefreshCcw size={18} />
                 </button>
               </div>
             )}
          </div>
          
          <div className="flex-grow relative">
             {(appState === AppState.RECORDING || appState === AppState.PAUSED || appState === AppState.COMPLETED || transcribedText) ? (
                <textarea 
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  className={`
                    w-full h-full min-h-[150px] p-4 rounded-xl bg-white border border-slate-200 text-lg leading-relaxed text-slate-700 shadow-sm resize-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all
                    ${language === Language.KHMER ? 'font-khmer' : 'font-sans'}
                  `}
                  placeholder="Transcription will appear here as you speak..."
                  readOnly={appState === AppState.RECORDING || appState === AppState.PROCESSING}
                />
             ) : (
               <div className="w-full h-full min-h-[150px] rounded-xl bg-slate-100/50 border border-dashed border-slate-300 flex items-center justify-center p-6 text-center">
                  <span className="text-slate-400 italic">
                    {appState === AppState.PROCESSING 
                      ? "Connecting to Gemini..." 
                      : "Press record to start real-time transcription."}
                  </span>
               </div>
             )}
          </div>
        </div>
      </main>

      <footer className="mt-12 text-center">
        <p className="text-slate-400 text-sm mb-2">Powered by Gemini 2.5 Flash Live API</p>
      </footer>
    </div>
  );
};

export default App;
