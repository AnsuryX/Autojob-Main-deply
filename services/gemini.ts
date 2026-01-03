
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
  [CoverLetterStyle.RESULTS_DRIVEN]: "Focus entirely on metrics and ROI. Mention specific hypothetical achievements that match the profile and job.",
  [CoverLetterStyle.FOUNDER_FRIENDLY]: "Use a high-agency, 'let's build' tone. Focus on grit, ownership, and mission alignment.",
  [CoverLetterStyle.TECHNICAL_DEEP_CUT]: "Get into the weeds of the tech stack. Mention specific frameworks, architecture choices, and technical trade-offs.",
  [CoverLetterStyle.CHILL_PROFESSIONAL]: "Relaxed, modern tone. 'Hey team' vibes but still extremely competent. Avoid corporate jargon."
};

/**
 * Interprets natural language commands into structured actions.
 */
export const interpretCommand = async (input: string): Promise<CommandResult> => {
  try {
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
  } catch (error) {
    console.error("Command Interpretation Error:", error);
    return { action: 'blocked', reason: "Failed to connect to Command Center." };
  }
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
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Plan: ${JSON.stringify(plan)}. Logs: ${JSON.stringify(logs.slice(-5))}.`,
      config: { systemInstruction: "Generate a ruthless daily brief under 40 words." }
    });
    return response.text || "Strategy active.";
  } catch {
    return "Agent monitoring active.";
  }
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
      3. FACTUAL INTEGRITY: Never invent experience.
      4. ATS OPTIMIZATION: Use exact keyword matching where applicable.
    `,
    config: {
      systemInstruction: "You are the Senior Resume Mutation Engine. Maximize ATS score while ensuring 100% factual accuracy.",
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
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract detailed job information from: ${input}`,
      config: {
        systemInstruction: `Extract Title, Company, Location, Skills, Description, Platform, and Apply URL. Asses intent.`,
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
            platform: { type: Type.STRING, enum: ['LinkedIn', 'Indeed', 'Wellfound', 'Other'] },
            intent: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: Object.values(JobIntent) },
                confidence: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
              },
              required: ["type", "confidence", "reasoning"]
            }
          },
          required: ["title", "company", "description", "platform"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    let finalApplyUrl = data.applyUrl || (input.startsWith('http') ? input : "#");

    return {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      applyUrl: finalApplyUrl,
      scrapedAt: new Date().toISOString(),
      platform: data.platform || 'Other',
      skills: data.skills || [],
      intent: data.intent || { type: JobIntent.REAL_HIRE, confidence: 0.5, reasoning: "Auto-analyzed" }
    };
  } catch (error) {
    throw new Error("Failed to extract job data.");
  }
};

/**
 * Calculates a match score between a job and a user profile.
 */
export const calculateMatchScore = async (job: Job, profile: UserProfile): Promise<MatchResult> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Compare job: ${JSON.stringify(job)} with profile: ${JSON.stringify(profile)}`,
      config: {
        systemInstruction: "Calculate match score (0-100), reasoning, and missing skills.",
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
    return JSON.parse(response.text || '{"score": 0, "reasoning": "Fail", "missingSkills": []}');
  } catch {
    return { score: 0, reasoning: "Error", missingSkills: [] };
  }
};

/**
 * Automatically augments a resume track with a specific skill.
 */
export const augmentResumeWithSkill = async (track: ResumeTrack, skill: string, job: Job): Promise<ResumeJson> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Augment resume with skill: ${skill} for job context: ${job.title}`,
    config: {
      systemInstruction: "Update skills, summary, and add a synthetic project or experience entry for the skill.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { company: {type:Type.STRING}, role: {type:Type.STRING}, duration: {type:Type.STRING}, achievements: {type:Type.ARRAY, items:{type:Type.STRING}} } } },
          projects: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name:{type:Type.STRING}, description:{type:Type.STRING}, technologies:{type:Type.ARRAY, items:{type:Type.STRING}} } } }
        },
        required: ["summary", "skills", "experience", "projects"]
      }
    }
  });

  return JSON.parse(response.text || JSON.stringify(track.content));
};

/**
 * Generates a tailored cover letter.
 */
export const generateCoverLetter = async (job: Job, profile: UserProfile, style: CoverLetterStyle): Promise<string> => {
  const ai = getAi();
  const styleInstruction = STYLE_PROMPTS[style] || "";
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write cover letter for ${job.title} at ${job.company}. My profile: ${JSON.stringify(profile)}. Style: ${styleInstruction}`,
    config: {
      systemInstruction: "Write a compelling cover letter. No placeholders."
    }
  });
  return response.text || "";
};

/**
 * Searches for jobs based on user preferences.
 * Updated to return 12-15 listings for bulk applications.
 */
export const searchJobs = async (preferences: any): Promise<DiscoveredJob[]> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Search for job listings matching these preferences: ${JSON.stringify(preferences)}`,
      config: {
        systemInstruction: "Simulate a high-agency web crawler. Return exactly 12-15 relevant job listings from across the web.",
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
  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
};

/**
 * Generates potential interview questions.
 */
export const generateInterviewQuestions = async (job: Job, resume: ResumeJson): Promise<{questions: {question: string, context: string, suggestedAnswer: string}[]}> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Job: ${JSON.stringify(job)}. Resume: ${JSON.stringify(resume)}. Generate 5 interview questions.`,
    config: {
      systemInstruction: "Generate probable questions, context, and suggested strategic answers.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question:{type:Type.STRING}, context:{type:Type.STRING}, suggestedAnswer:{type:Type.STRING} }, required:["question","context","suggestedAnswer"] } }
        },
        required: ["questions"]
      }
    }
  });
  return JSON.parse(response.text || '{"questions": []}');
};
