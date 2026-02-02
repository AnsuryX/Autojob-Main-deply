
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { UserProfile, InterviewScorecard, InterviewSession, TranscriptAnnotation } from '../types';
import { encodeAudio, decodeAudio, decodeAudioData, evaluateInterview } from '../services/gemini';
import { Icons } from '../constants';

interface InterviewSimulatorProps {
  profile: UserProfile;
  history: InterviewSession[];
  onSessionSave: (session: InterviewSession) => void;
}

const PERSONAS = [
  { id: 'kind_mentor', name: 'Kind Mentor', desc: 'Friendly, encouraging, and provides gentle corrections.', voice: 'Kore' },
  { id: 'ruthless_lead', name: 'Ruthless Lead', desc: 'Direct, focused on technical flaws, and interrupts poor answers.', voice: 'Fenrir' },
  { id: 'exec_stakeholder', name: 'Executive', desc: 'High-level, cares about business value and trade-offs.', voice: 'Puck' },
];

const InterviewSimulator: React.FC<InterviewSimulatorProps> = ({ profile, history, onSessionSave }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentPersona, setCurrentPersona] = useState(PERSONAS[0]);
  const [transcription, setTranscription] = useState<TranscriptAnnotation[]>([]);
  const [status, setStatus] = useState<'Idle' | 'Connecting' | 'Live' | 'Error'>('Idle');
  const [scorecard, setScorecard] = useState<InterviewScorecard | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const startSession = async () => {
    setStatus('Connecting');
    setScorecard(null);
    setSelectedSession(null);
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
             setTranscription(prev => [...prev, { text: message.serverContent.outputTranscription.text, speaker: 'AI' }]);
          }
          if (message.serverContent?.inputTranscription) {
             setTranscription(prev => [...prev, { text: message.serverContent.inputTranscription.text, speaker: 'User' }]);
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
          voiceConfig: { prebuiltVoiceConfig: { voiceName: currentPersona.voice } }
        },
        systemInstruction: `You are a ${currentPersona.name} interviewer. Style: ${currentPersona.desc}. 
        Targeting: ${profile.preferences.targetRoles.join(', ')}.
        Start by introducing yourself and asking the first question.`,
        outputAudioTranscription: {},
        inputAudioTranscription: {}
      }
    });

    sessionRef.current = await sessionPromise;
  };

  const handleEvaluation = async () => {
    if (transcription.length < 2) return;
    setIsEvaluating(true);
    try {
      const evalData = await evaluateInterview(transcription, profile);
      setScorecard(evalData);
      
      const newSession: InterviewSession = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        persona: currentPersona.name,
        scorecard: evalData
      };
      onSessionSave(newSession);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEvaluating(false);
    }
  };

  const stopSession = () => {
    sessionRef.current?.close();
  };

  const viewHistorySession = (session: InterviewSession) => {
    setScorecard(null);
    setSelectedSession(session);
  };

  const currentViewScorecard = scorecard || selectedSession?.scorecard;

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-20">
      {/* Sidebar: History & Config */}
      <div className="lg:w-80 space-y-6 shrink-0">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mission Config</h3>
           <div className="space-y-3">
              {PERSONAS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setCurrentPersona(p)}
                  disabled={isActive}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${currentPersona.id === p.id ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-500/5' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <p className="font-black text-slate-900 text-xs">{p.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight mt-1">{p.desc}</p>
                </button>
              ))}
           </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
           <div className="flex justify-between items-center">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telemetry History</h3>
             <span className="text-[9px] font-bold text-slate-400">{history.length} Session(s)</span>
           </div>
           <div className="space-y-2 overflow-y-auto max-h-80 pr-1 scrollbar-hide">
              {history.map(s => (
                <button
                  key={s.id}
                  onClick={() => viewHistorySession(s)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedSession?.id === s.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  <div className="flex justify-between items-start">
                     <p className="text-[10px] font-black text-slate-800">{s.persona}</p>
                     <span className="text-[9px] font-black text-indigo-600">{s.scorecard.overallScore}%</span>
                  </div>
                  <p className="text-[8px] text-slate-400 mt-1 font-mono uppercase">{new Date(s.timestamp).toLocaleDateString()}</p>
                </button>
              ))}
              {history.length === 0 && <p className="text-[9px] text-slate-400 text-center py-4">No telemetry logs found.</p>}
           </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 space-y-6">
        <div className="bg-slate-900 rounded-[2.5rem] p-10 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center text-center space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Neural Interview Chamber</h2>
              <p className="text-slate-400 text-sm max-w-md">Live Voice Synthesis Mode: <span className="text-indigo-400">{currentPersona.name}</span></p>
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
              className={`px-12 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
            >
              {isActive ? 'Terminate Mission' : 'Initiate Session'}
            </button>
          </div>
        </div>

        {currentViewScorecard && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
                 <div className="text-5xl font-black text-slate-900 mb-2">{currentViewScorecard.overallScore}/100</div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Readiness Score</p>
                 <div className="w-full h-1 bg-slate-100 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: `${currentViewScorecard.overallScore}%` }}></div>
                 </div>
              </div>

              <div className="md:col-span-2 bg-indigo-900 p-8 rounded-[2rem] text-white shadow-xl space-y-6">
                 <div className="grid grid-cols-2 gap-8">
                    <div>
                       <h4 className="text-[9px] font-black uppercase text-indigo-400 mb-2 tracking-widest">Tone Assessment</h4>
                       <p className="text-lg font-black">{currentViewScorecard.communicationTone}</p>
                    </div>
                    <div>
                       <h4 className="text-[9px] font-black uppercase text-indigo-400 mb-2 tracking-widest">Technical Precision</h4>
                       <p className="text-lg font-black text-emerald-400">{currentViewScorecard.technicalAccuracy}%</p>
                    </div>
                 </div>
                 <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-8">
                    <div>
                       <h4 className="text-[9px] font-black uppercase text-emerald-400 mb-3 tracking-widest">Impact Strengths</h4>
                       <ul className="space-y-1">
                          {currentViewScorecard.keyStrengths.map((s, i) => <li key={i} className="text-[11px] font-medium">• {s}</li>)}
                       </ul>
                    </div>
                    <div>
                       <h4 className="text-[9px] font-black uppercase text-amber-400 mb-3 tracking-widest">Evolution Gaps</h4>
                       <ul className="space-y-1">
                          {currentViewScorecard.improvementAreas.map((s, i) => <li key={i} className="text-[11px] font-medium opacity-80">• {s}</li>)}
                       </ul>
                    </div>
                 </div>
              </div>
            </div>

            {/* Neural Transcript Annotations */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
               <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neural Transcript Refactoring</h3>
                  <span className="text-[9px] font-bold text-slate-300">Click turn for AI breakdown</span>
               </div>
               <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                  {currentViewScorecard.annotations?.map((turn, i) => (
                    <div key={i} className={`flex flex-col gap-2 ${turn.speaker === 'AI' ? 'opacity-50' : ''}`}>
                       <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${turn.speaker === 'AI' ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white'}`}>
                             {turn.speaker === 'User' ? 'You' : 'Agent'}
                          </span>
                       </div>
                       <div className="relative group">
                          <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl">
                             {turn.text}
                          </p>
                          {turn.feedback && (
                            <div className={`mt-2 p-3 rounded-xl text-[10px] font-bold leading-tight border ${turn.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : turn.sentiment === 'negative' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                               <span className="uppercase text-[8px] font-black mr-2 opacity-60">AI Insight:</span>
                               {turn.feedback}
                            </div>
                          )}
                       </div>
                    </div>
                  ))}
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
    </div>
  );
};

export default InterviewSimulator;
