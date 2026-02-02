
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { UserProfile, InterviewScorecard } from '../types';
import { encodeAudio, decodeAudio, decodeAudioData, evaluateInterview } from '../services/gemini';

interface InterviewSimulatorProps {
  profile: UserProfile;
}

const InterviewSimulator: React.FC<InterviewSimulatorProps> = ({ profile }) => {
  const [isActive, setIsActive] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [status, setStatus] = useState<'Idle' | 'Connecting' | 'Live' | 'Error'>('Idle');
  const [scorecard, setScorecard] = useState<InterviewScorecard | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const startSession = async () => {
    setStatus('Connecting');
    setScorecard(null);
    setTranscription([]);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setStatus('Live');
          setIsActive(true);
          const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
          
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = inputData[i] * 32768;
            }
            const pcmBlob = {
              data: encodeAudio(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000',
            };
            sessionPromise.then(session => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContextRef.current!.destination);
        },
        onmessage: async (message: any) => {
          if (message.serverContent?.outputTranscription) {
            setTranscription(prev => [...prev, `AI: ${message.serverContent.outputTranscription.text}`]);
          }
          if (message.serverContent?.inputTranscription) {
            setTranscription(prev => [...prev, `User: ${message.serverContent.inputTranscription.text}`]);
          }
          
          const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioData) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current!.currentTime);
            const buffer = await decodeAudioData(decodeAudio(audioData), outputAudioContextRef.current!, 24000, 1);
            const source = outputAudioContextRef.current!.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioContextRef.current!.destination);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
            source.onended = () => sourcesRef.current.delete(source);
          }
        },
        onclose: () => {
          setIsActive(false);
          setStatus('Idle');
          handleEvaluation();
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        },
        systemInstruction: `You are a challenging technical hiring manager for ${profile.fullName}.
        Target Roles: ${profile.preferences.targetRoles.join(', ')}.
        Start by introducing yourself and asking the first behavioral question.`,
        outputAudioTranscription: {},
        inputAudioTranscription: {}
      }
    });

    sessionRef.current = await sessionPromise;
  };

  const handleEvaluation = async () => {
    if (transcription.length < 4) return;
    setIsEvaluating(true);
    try {
      const evalData = await evaluateInterview(transcription, profile);
      setScorecard(evalData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEvaluating(false);
    }
  };

  const stopSession = () => {
    sessionRef.current?.close();
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">Neural Interview Chamber</h2>
            <p className="text-slate-400 text-sm max-w-md">Practice voice-native interactions with the hiring agent.</p>
          </div>

          <div className="relative flex justify-center">
             <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${isActive ? 'border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)]' : 'border-slate-800'}`}>
                <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-800'}`}>
                  <svg className={`w-10 h-10 ${isActive ? 'text-slate-900' : 'text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </div>
             </div>
          </div>

          <button 
            onClick={isActive ? stopSession : startSession}
            className={`px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
          >
            {isActive ? 'Abort Mission' : 'Enter Chamber'}
          </button>
        </div>
      </div>

      {scorecard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in-95">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
             <div className="text-5xl font-black text-slate-900 mb-2">{scorecard.overallScore}/100</div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Readiness Quotient</p>
             <div className="w-full h-1 bg-slate-100 rounded-full mt-6 overflow-hidden">
                <div className="h-full bg-indigo-600" style={{ width: `${scorecard.overallScore}%` }}></div>
             </div>
          </div>

          <div className="md:col-span-2 bg-indigo-900 p-8 rounded-[2rem] text-white shadow-xl space-y-6">
             <div className="grid grid-cols-2 gap-8">
                <div>
                   <h4 className="text-[9px] font-black uppercase text-indigo-400 mb-2 tracking-widest">Communication Tone</h4>
                   <p className="text-lg font-black">{scorecard.communicationTone}</p>
                </div>
                <div>
                   <h4 className="text-[9px] font-black uppercase text-indigo-400 mb-2 tracking-widest">Technical Accuracy</h4>
                   <p className="text-lg font-black text-emerald-400">{scorecard.technicalAccuracy}%</p>
                </div>
             </div>
             <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-8">
                <div>
                   <h4 className="text-[9px] font-black uppercase text-emerald-400 mb-3 tracking-widest">Strengths</h4>
                   <ul className="space-y-1">
                      {scorecard.keyStrengths.map((s, i) => <li key={i} className="text-[11px] font-medium">• {s}</li>)}
                   </ul>
                </div>
                <div>
                   <h4 className="text-[9px] font-black uppercase text-amber-400 mb-3 tracking-widest">Evolution Areas</h4>
                   <ul className="space-y-1">
                      {scorecard.improvementAreas.map((s, i) => <li key={i} className="text-[11px] font-medium opacity-80">• {s}</li>)}
                   </ul>
                </div>
             </div>
          </div>
        </div>
      )}

      {isEvaluating && (
        <div className="py-20 text-center space-y-4">
           <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Neural Evaluation in Progress...</p>
        </div>
      )}
    </div>
  );
};

export default InterviewSimulator;
