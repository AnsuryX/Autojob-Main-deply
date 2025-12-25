
import { GoogleGenAI, Type } from "@google/genai";
import { Job, UserProfile, MatchResult, DiscoveredJob, CoverLetterStyle, JobIntent, CommandResult, StrategyPlan, ResumeMutation } from "../types";

// Helper to get a fresh AI instance to ensure the most up-to-date API key is used
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const STYLE_PROMPTS: Record<CoverLetterStyle, string> = {
  [CoverLetterStyle.ULTRA_CONCISE]: "Be brutally brief. 1-2 punchy sentences max. High signal, zero noise.",
  [CoverLetterStyle.RESULTS_DRIVEN]: "Focus entirely on metrics and ROI. Mention specific hypothetical achievements that match the profile and job.",
  [CoverLetterStyle.FOUNDER_FRIENDLY]: "Use a high-agency, 'let's build' tone. Focus on grit, ownership, and mission alignment.",
  [CoverLetterStyle.TECHNICAL_DEEP_CUT]: "Get into the weeds of the tech stack. Mention specific frameworks, architecture choices, and technical trade-offs.",
  [CoverLetterStyle.CHILL_PROFESSIONAL]: "Relaxed, modern tone. 'Hey team' vibes but still extremely competent. Avoid corporate jargon."
};

/**
 * Interprets natural language commands into structured actions.
 */
export const interpretCommand = async (input: string): Promise<CommandResult> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Interpret natural language instructions into a structured JSON command.
    Input: "${input}"`,
    config: {
      systemInstruction: "You are the AutoJob Command Interpreter. Convert user intent into action: apply, pause, resume, filter, limit, status, or strategy.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          goal: { type: Type.STRING },
          filters: {
            type: Type.OBJECT,
            properties: {
              role: { type: Type.STRING },
              location: { type: Type.STRING },
              remote: { type: Type.BOOLEAN },
              company_type: { type: Type.STRING },
              posted_within: { type: Type.STRING }
            }
          },
          limits: {
            type: Type.OBJECT,
            properties: {
              max_applications: { type: Type.NUMBER }
            }
          },
          schedule: {
            type: Type.OBJECT,
            properties: {
              duration: { type: Type.STRING }
            }
          },
          reason: { type: Type.STRING }
        },
        required: ["action"]
      }
    }
  });

  return JSON.parse(response.text || '{"action":"blocked","reason":"Empty response"}');
};

/**
 * Creates an autonomous strategy plan based on user goals.
 */
export const createStrategyPlan = async (goal: string, profile: UserProfile): Promise<StrategyPlan> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create an executable Autonomous Strategy Plan. Goal: "${goal}"`,
    config: {
      systemInstruction: "You are the Autonomous Strategy Engine. Determine daily quota, target roles, and intensity (Aggressive, Balanced, Precision).",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          goal: { type: Type.STRING },
          dailyQuota: { type: Type.NUMBER },
          targetRoles: { type: Type.ARRAY, items: { type: Type.STRING } },
          platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
          intensity: { type: Type.STRING, enum: ['Aggressive', 'Balanced', 'Precision'] },
          explanation: { type: Type.STRING }
        },
        required: ["goal", "dailyQuota", "targetRoles", "platforms", "intensity", "explanation"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return { ...data, status: 'ACTIVE', lastUpdate: new Date().toISOString() };
};

/**
 * Generates a short status brief for the user.
 */
export const generateStrategyBrief = async (plan: StrategyPlan, logs: any[]): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Plan: ${JSON.stringify(plan)}. Logs: ${JSON.stringify(logs.slice(-5))}.`,
    config: { systemInstruction: "Generate a ruthless daily brief under 40 words." }
  });
  return response.text || "Strategy active.";
};

/**
 * Parses raw resume files into structured JSON.
 */
export const parseResume = async (fileBase64: string, mimeType: string): Promise<any> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ inlineData: { data: fileBase64, mimeType } }, { text: "Extract resume JSON including contact info." }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullName: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          linkedin: { type: Type.STRING },
          portfolio: { type: Type.STRING },
          resumeJson: {
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
              },
              projects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    technologies: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          }
        },
        required: ["fullName", "email", "resumeJson"]
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

/**
 * High-agency Resume Mutation Engine.
 * Follows strict role selection, linguistic mirroring, and factual integrity rules.
 */
export const mutateResume = async (job: Job, profile: UserProfile): Promise<ResumeMutation> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `
      JOB DESCRIPTION:
      Title: ${job.title}
      Company: ${job.company}
      Description: ${job.description}

      GOLDEN BASE RESUME TRACKS:
      ${JSON.stringify(profile.resumeTracks)}

      CORE INSTRUCTIONS:
      1. ROLE SELECTION: Analyze the JD and select the SINGLE most relevant base resume track.
      2. RESUME MUTATION: Rewrite bullet points, summaries, and skills to MIRROR the JD language while PRESERVING factual chronology.
      3. FACTUAL INTEGRITY: Never invent experience. If a skill is missing, infer ONLY if strongly adjacent.
      4. ATS OPTIMIZATION: Use simple, parseable headers. Use exact keyword matching where applicable.
      5. ITERATION: Internally refine until the match score is maximized without losing credibility.
    `,
    config: {
      systemInstruction: "You are the Senior Resume Mutation Engine. Maximize ATS score while ensuring 100% factual accuracy and recruiter credibility. Return a single optimized resume JSON and a report.",
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
              },
              projects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    technologies: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          },
          report: {
            type: Type.OBJECT,
            properties: {
              selectedTrackId: { type: Type.STRING },
              selectedTrackName: { type: Type.STRING },
              keywordsInjected: { type: Type.ARRAY, items: { type: Type.STRING } },
              mirroredPhrases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING },
                    mirrored: { type: Type.STRING }
                  }
                }
              },
              reorderingJustification: { type: Type.STRING },
              atsScoreEstimate: { type: Type.NUMBER },
              iterationCount: { type: Type.NUMBER }
            }
          }
        },
        required: ["mutatedResume", "report"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Mutation failure", e);
    const fallback = profile.resumeTracks[0]?.content;
    return {
      mutatedResume: fallback,
      report: { 
        selectedTrackId: profile.resumeTracks[0]?.id || "error", 
        selectedTrackName: profile.resumeTracks[0]?.name || "Error", 
        keywordsInjected: [], mirroredPhrases: [], reorderingJustification: "System fallback", 
        atsScoreEstimate: 50, iterationCount: 1 
      }
    };
  }
};

/**
 * Extracts structured job data from raw text or a URL.
 */
export const extractJobData = async (input: string): Promise<Job> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract job details from the following content: ${input}`,
    config: {
      systemInstruction: "You are an expert job scraper. Extract title, company, location, skills, and description. Also estimate job intent (Real Hire, Ghost Job, etc.).",
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
          intent: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            }
          }
        },
        required: ["title", "company", "description"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return {
    ...data,
    id: Math.random().toString(36).substr(2, 9),
    applyUrl: data.applyUrl || input,
    scrapedAt: new Date().toISOString(),
    platform: 'Other',
    skills: data.skills || []
  };
};

/**
 * Calculates a match score between a job and a user profile.
 */
export const calculateMatchScore = async (job: Job, profile: UserProfile): Promise<MatchResult> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Compare job: ${JSON.stringify(job)} with profile: ${JSON.stringify(profile)}`,
    config: {
      systemInstruction: "You are an AI career coach. Calculate a match score (0-100), explain reasoning, and list missing skills.",
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
  return JSON.parse(response.text || '{"score": 0, "reasoning": "Analysis failed", "missingSkills": []}');
};

/**
 * Generates a tailored cover letter based on a specific style.
 */
export const generateCoverLetter = async (job: Job, profile: UserProfile, style: CoverLetterStyle): Promise<string> => {
  const ai = getAi();
  const styleInstruction = STYLE_PROMPTS[style] || "";
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a cover letter for ${job.title} at ${job.company}. My profile: ${JSON.stringify(profile)}. Style requirement: ${styleInstruction}`,
    config: {
      systemInstruction: "You are an expert ghostwriter for top-tier candidates. Write a compelling, human-like cover letter. Do not use placeholders like [Date] or [Address]."
    }
  });
  return response.text || "";
};

/**
 * Searches for jobs based on user preferences.
 */
export const searchJobs = async (preferences: any): Promise<DiscoveredJob[]> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Search for job listings matching these preferences: ${JSON.stringify(preferences)}`,
    config: {
      systemInstruction: "Simulate a high-agency web crawler. Return a list of 5-8 highly relevant, realistic job listings with titles, companies, locations, and dummy URLs.",
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
          required: ["title", "company", "url", "source"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};
