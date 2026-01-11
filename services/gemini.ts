
import { GoogleGenAI, Type } from "@google/genai";
import { Job, UserProfile, MatchResult, DiscoveredJob, CoverLetterStyle, JobIntent, CommandResult, StrategyPlan, ResumeMutation, ResumeJson, ResumeTrack } from "../types.ts";

const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Please ensure it is configured in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

const STYLE_PROMPTS: Record<CoverLetterStyle, string> = {
  [CoverLetterStyle.ULTRA_CONCISE]: "Be brutally brief. 1-2 punchy sentences max. High signal, zero noise.",
  [CoverLetterStyle.RESULTS_DRIVEN]: "Focus entirely on metrics and ROI. Mention specific achievements that match the profile and job.",
  [CoverLetterStyle.FOUNDER_FRIENDLY]: "Use a high-agency, 'let's build' tone. Focus on grit, ownership, and mission alignment.",
  [CoverLetterStyle.TECHNICAL_DEEP_CUT]: "Get into the weeds of the tech stack. Mention specific frameworks and architecture choices.",
  [CoverLetterStyle.CHILL_PROFESSIONAL]: "Relaxed, modern tone. 'Hey team' vibes but still extremely competent."
};

export const interpretCommand = async (input: string): Promise<CommandResult> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Interpret natural language instructions into a structured JSON command. Input: "${input}"`,
      config: {
        systemInstruction: "You are the AutoJob Command Interpreter. Convert user intent into action: apply, pause, resume, filter, limit, status, or strategy.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            goal: { type: Type.STRING },
            reason: { type: Type.STRING }
          },
          required: ["action"]
        }
      }
    });
    return JSON.parse(response.text || '{"action":"blocked"}');
  } catch (error) {
    return { action: 'blocked', reason: "Failed to connect to Command Center." };
  }
};

export const extractJobData = async (input: string): Promise<Job> => {
  try {
    const ai = getAi();
    // Use search grounding to get the REAL context if it's just a URL
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Exhaustively analyze this job source. Use Google Search to verify the company and find the direct application URL/Career page if this link is gated: "${input}"`,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are a Job Intelligence Specialist. Extract precise title, company, location, technical requirements, and description. Identify if this is a high-signal role or a generic listing. Return JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            location: { type: Type.STRING },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: { type: Type.STRING },
            applyUrl: { type: Type.STRING },
            platform: { type: Type.STRING, enum: ['LinkedIn', 'Indeed', 'Wellfound', 'Other'] }
          },
          required: ["title", "company", "description"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      location: data.location || "Remote",
      applyUrl: data.applyUrl || (input.startsWith('http') ? input : "#"),
      scrapedAt: new Date().toISOString(),
      skills: data.skills || [],
      platform: data.platform || 'Other'
    };
  } catch (error) {
    console.error("Extraction error:", error);
    throw new Error("Target site rejected analysis. Use a direct career page link for better results.");
  }
};

export const calculateMatchScore = async (job: Job, profile: UserProfile): Promise<MatchResult> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Job Requirements: ${JSON.stringify(job.skills)}. JD Text: ${job.description}. Current Profile: ${JSON.stringify(profile.resumeTracks[0]?.content)}`,
    config: {
      systemInstruction: "Perform a brutal skill gap analysis. List exact keywords missing from the profile. Score 0-100.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
          missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["score", "reasoning", "missingSkills"]
      }
    }
  });
  return JSON.parse(response.text || '{"score":0, "reasoning": "Analysis failed", "missingSkills": []}');
};

export const generateCoverLetter = async (job: Job, profile: UserProfile, style: CoverLetterStyle): Promise<string> => {
  const ai = getAi();
  const stylePrompt = STYLE_PROMPTS[style];
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Target: ${job.title} at ${job.company}. Job Context: ${job.description}. Profile Highlights: ${JSON.stringify(profile.resumeTracks[0]?.content.summary)}. Style: ${stylePrompt}`,
    config: {
      systemInstruction: "Write a high-impact, short cover letter. Use the real company name. No placeholders. Focus on how you solve THEIR specific problems mentioned in the JD.",
    }
  });
  return response.text || "Neural generation failed.";
};

export const mutateResume = async (job: Job, profile: UserProfile): Promise<ResumeMutation> => {
  const startTime = Date.now();
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Rewrite this resume for: ${job.title} at ${job.company}. JD: ${job.description}. Base: ${JSON.stringify(profile.resumeTracks[0]?.content)}.`,
    config: {
      systemInstruction: "You are an ATS Optimization Agent. 1. Inject missing keywords from the JD into the 'skills' list. 2. Rewrite achievement bullets to use JD phrasing. 3. Maintain factual integrity—do not lie about years of experience. Return JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mutatedResume: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              experience: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    company: { type: Type.STRING },
                    role: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    achievements: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          },
          report: {
            type: Type.OBJECT,
            properties: {
              keywordsInjected: { type: Type.ARRAY, items: { type: Type.STRING } },
              atsScoreEstimate: { type: Type.NUMBER }
            }
          }
        },
        required: ["mutatedResume", "report"]
      }
    }
  });
  const data = JSON.parse(response.text || "{}");
  return {
    ...data,
    report: {
      ...data.report,
      timings: {
        mutationMs: Date.now() - startTime,
        analysisMs: Math.floor((Date.now() - startTime) * 0.2)
      }
    }
  };
};

export const searchJobs = async (preferences: any): Promise<DiscoveredJob[]> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Find REAL, active job listings matching these preferences: ${JSON.stringify(preferences)}. Only return roles posted recently.`,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: "Search the web (LinkedIn, Indeed, company career pages) for real job openings. Extract the actual URL, title, and company. Do not return placeholders.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            location: { type: Type.STRING },
            url: { type: Type.STRING },
            source: { type: Type.STRING }
          },
          required: ["title", "company", "url"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const createStrategyPlan = async (goal: string, profile: UserProfile): Promise<StrategyPlan> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Goal: "${goal}"`,
    config: {
      systemInstruction: "Create a technical job hunt strategy. Be precise about platform targets and daily goals.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          goal: { type: Type.STRING },
          dailyQuota: { type: Type.NUMBER },
          targetRoles: { type: Type.ARRAY, items: { type: Type.STRING } },
          intensity: { type: Type.STRING, enum: ['Aggressive', 'Balanced', 'Precision'] },
          explanation: { type: Type.STRING }
        }
      }
    }
  });
  const data = JSON.parse(response.text || "{}");
  return { ...data, status: 'ACTIVE', platforms: ['LinkedIn', 'Direct Career Pages'], lastUpdate: new Date().toISOString() };
};

export const parseResume = async (base64: string, mimeType: string): Promise<any> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ inlineData: { data: base64, mimeType } }, { text: "Extract full resume data into JSON structure." }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullName: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          resumeJson: { type: Type.OBJECT }
        }
      }
    }
  });
  return JSON.parse(response.text || "{}");
};
