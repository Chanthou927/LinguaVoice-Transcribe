import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ stream, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !isRecording || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize Audio Context
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const audioCtx = audioContextRef.current;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    analyserRef.current = analyser;
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      
      requestRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArrayRef.current!);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Style
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#6366f1'); // Indigo 500
      gradient.addColorStop(1, '#a855f7'); // Purple 500
      ctx.fillStyle = gradient;

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      // Draw symmetrical bars
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArrayRef.current![i] / 2; // Scale down
        
        // Rounded rect equivalent
        ctx.beginPath();
        // Center vertically
        const y = (canvas.height - barHeight) / 2;
        
        ctx.roundRect(x, y, barWidth - 2, barHeight, 5);
        ctx.fill();

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        // We don't close the context here to reuse it, or we can close it.
        // For this component lifecycle, let's just disconnect nodes.
        source.disconnect();
        analyser.disconnect();
      }
    };
  }, [stream, isRecording]);

  // Clear canvas when not recording
  useEffect(() => {
    if (!isRecording && canvasRef.current) {
       const canvas = canvasRef.current;
       const ctx = canvas.getContext('2d');
       if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [isRecording]);

  return (
    <div className="w-full h-32 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-inner relative flex items-center justify-center">
       {!isRecording && (
         <span className="text-slate-400 text-sm">Audio waves will appear here...</span>
       )}
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={128} 
        className="w-full h-full absolute top-0 left-0"
      />
    </div>
  );
};

export default Visualizer;