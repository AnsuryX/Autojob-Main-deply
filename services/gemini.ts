
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Job, UserProfile, CareerRoadmap, MarketInsights, DiscoveredJob, ResumeJson, Gig, CommandResult, OutreachDraft, InterviewScorecard, TranscriptAnnotation } from "../types.ts";

const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Missing Gemini API Key.");
  return new GoogleGenAI({ apiKey });
};

export const generateOutreach = async (job: Job, profile: UserProfile): Promise<OutreachDraft[]> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate two ultra-short, personalized outreach messages for this job: ${job.title} at ${job.company}.
    Target: 1 LinkedIn message (max 250 chars) and 1 Email. 
    Use user context: ${profile.resumeTracks[0]?.content.summary}.
    Highlight a shared skill or value based on the job desc: ${job.description}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            platform: { type: Type.STRING, enum: ['LinkedIn', 'Email'] },
            recipientRole: { type: Type.STRING },
            message: { type: Type.STRING }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const evaluateInterview = async (transcript: TranscriptAnnotation[], profile: UserProfile): Promise<InterviewScorecard> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Evaluate this interview transcript: ${JSON.stringify(transcript)}.
    Candidate profile: ${JSON.stringify(profile.resumeTracks[0]?.content)}.
    Evaluate technical accuracy, communication tone, and keywords.
    For each user turn in the transcript, provide "feedback" (max 15 words) and a "sentiment".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          technicalAccuracy: { type: Type.NUMBER },
          communicationTone: { type: Type.STRING },
          keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          improvementAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
          annotations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                speaker: { type: Type.STRING },
                feedback: { type: Type.STRING },
                sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const getMarketInsights = async (role: string): Promise<MarketInsights> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze the current job market for: "${role}". 
    Focus on salary benchmarks, tech stack trends, and recent hiring news.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          salaryRange: { type: Type.STRING },
          demandTrend: { type: Type.STRING, enum: ['High', 'Stable', 'Decreasing'] },
          topSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          recentNews: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                url: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const rawData = JSON.parse(response.text || "{}");
  const citations = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  return { ...rawData, citations };
};

export const generateCareerRoadmap = async (profile: UserProfile): Promise<CareerRoadmap> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Generate a 6-month career growth roadmap based on this profile: ${JSON.stringify(profile)}. 
    Use search to find required skills for reaching their "targetRoles" in the current market.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          currentMarketValue: { type: Type.STRING },
          targetMarketValue: { type: Type.STRING },
          gapAnalysis: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                period: { type: Type.STRING },
                goal: { type: Type.STRING },
                actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                skillGain: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const encodeAudio = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const decodeAudio = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const alignResumeWithProfile = async (track: ResumeJson, profile: UserProfile): Promise<ResumeJson> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Synchronize this resume track with the user's global profile goals.
    
    User Identity: ${profile.fullName}
    Target Roles: ${profile.preferences?.targetRoles?.join(', ')}
    Target Locations: ${profile.preferences?.locations?.join(', ')}
    
    Current Track Content: ${JSON.stringify(track)}
    
    TASK:
    1. Rewrite the "summary" to be a powerful mission statement that bridges the user's experience with their Target Roles.
    2. Ensure the "skills" list includes high-impact keywords relevant to the Target Roles.
    3. Maintain the integrity of existing experience and projects.
    
    Output ONLY valid JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
    }
  });
  return JSON.parse(response.text || JSON.stringify(track));
};

export const suggestAtsKeywords = async (track: ResumeJson, targetRoles: string[]): Promise<string[]> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this resume track and these target roles: ${targetRoles.join(', ')}. 
    Suggest 8-10 high-impact technical keywords or skills that are currently missing but are crucial for passing ATS for these roles.
    Output only the list of skills as a JSON array of strings.
    
    Current Resume Track: ${JSON.stringify(track)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};

export const enhanceResumeContent = async (content: ResumeJson): Promise<ResumeJson> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Rewrite and enhance this resume for maximum impact. 
    STRICT RULES:
    1. Output ONLY valid JSON matching the schema.
    2. DO NOT include meta-commentary like "Original input preserved", "Note on Experience", or reasoning.
    3. Professional Title & Company names must be clean (e.g., "Senior Frontend Engineer" at "Google", not a paragraph).
    4. Achievements must be concise, data-driven bullet points (STAR method).
    5. Remove any repetitive, jibbery, or low-quality filler text.
    6. Ensure every field is strictly professional and ready for printing.
    
    Current Content: ${JSON.stringify(content)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                institution: { type: Type.STRING },
                degree: { type: Type.STRING },
                duration: { type: Type.STRING }
              }
            }
          },
          languages: { type: Type.ARRAY, items: { type: Type.STRING } },
          certifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                issuer: { type: Type.STRING },
                date: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || JSON.stringify(content));
};

export const addRelevantExperienceViaAI = async (prompt: string, currentResume: ResumeJson): Promise<ResumeJson> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Integrate a new entry based on: "${prompt}". 
    STRICT RULES:
    1. Output ONLY valid JSON.
    2. ABSOLUTELY NO reasoning, meta-text, or "I have added this project" notes inside the JSON fields.
    3. If adding a role: title and company must be clean. 
    4. Achievements must be 2-3 impactful, concise bullets.
    5. Remove any jibbery or repetitive technical notes.
    
    Current Resume: ${JSON.stringify(currentResume)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
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
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                institution: { type: Type.STRING },
                degree: { type: Type.STRING },
                duration: { type: Type.STRING }
              }
            }
          },
          languages: { type: Type.ARRAY, items: { type: Type.STRING } },
          certifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                issuer: { type: Type.STRING },
                date: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || JSON.stringify(currentResume));
};

export const searchJobsPro = async (query: string): Promise<DiscoveredJob[]> => {
  const SERP_API_KEY = (window as any).process?.env?.SERP_API_KEY;
  if (!SERP_API_KEY) {
    return searchJobs({ targetRoles: [query] });
  }

  try {
    const proxy = "https://corsproxy.io/?";
    const url = `${proxy}${encodeURIComponent(`https://serpapi.com/search.json?engine=google_jobs&q=${query}&api_key=${SERP_API_KEY}`)}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.jobs_results || data.jobs_results.length === 0) {
      return searchJobs({ targetRoles: [query] });
    }

    return data.jobs_results.map((job: any) => ({
      title: job.title,
      company: job.company_name,
      location: job.location,
      url: job.related_links?.[0]?.link || job.share_link || "#",
      source: job.via || "Google Jobs",
      salary: job.salary || "Not specified",
      thumbnail: job.thumbnail,
      description: job.description,
      postedAt: job.detected_extensions?.posted_at || job.extensions?.find((e: string) => e.includes('ago')) || "Recent"
    }));
  } catch (error) {
    console.error("SerpAPI Search failed:", error);
    return searchJobs({ targetRoles: [query] });
  }
};

export const searchFreelanceGigs = async (query: string): Promise<Gig[]> => {
  const SERP_API_KEY = (window as any).process?.env?.SERP_API_KEY;
  if (SERP_API_KEY) {
    try {
      const proxy = "https://corsproxy.io/?";
      const url = `${proxy}${encodeURIComponent(`https://serpapi.com/search.json?q=${query}+freelance+gigs&api_key=${SERP_API_KEY}`)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.organic_results) {
        return data.organic_results
          .filter((r: any) => r.link.includes('upwork.com') || r.link.includes('fiverr.com') || r.link.includes('toptal.com'))
          .map((r: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            title: r.title,
            platform: r.link.includes('upwork') ? 'Upwork' : r.link.includes('fiverr') ? 'Fiverr' : 'Other',
            description: r.snippet,
            url: r.link,
            thumbnail: r.thumbnail
          }));
      }
    } catch (e) {
      console.error("Freelance Pro Search failed:", e);
    }
  }

  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Find real, active freelance projects for: "${query}"`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            platform: { type: Type.STRING },
            budget: { type: Type.STRING },
            description: { type: Type.STRING },
            url: { type: Type.STRING }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const interpretCommand = async (input: string): Promise<CommandResult> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Interpret user intent from: "${input}"
      
      CONTEXT: You are a professional career agent.
      
      ACTIONS:
      - 'search_jobs': Use when user asks for employment roles or searching for work.
      - 'update_profile': Use when user mentions changing name, email, phone, or job preferences (target roles, locations, salary).
      - 'improve_resume': Use when user wants to enhance, rewrite, or add something to their resume.
      - 'find_gigs': Use for freelance or project-based work searches.
      - 'apply': Use if user provides a URL and wants to start applying.
      - 'switch_tab': Use for navigating the UI (to discover, resume_lab, freelance, profile, history, roadmap, interview).
      - 'start_interview': Use when user wants to practice for a job or role.
      
      Output ONLY valid JSON matching the CommandResult interface.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ['apply', 'search_jobs', 'update_profile', 'improve_resume', 'status', 'strategy', 'find_gigs', 'blocked', 'switch_tab', 'start_interview'] },
            goal: { type: Type.STRING, description: "Raw goal text" },
            params: {
              type: Type.OBJECT,
              properties: {
                profile_updates: { 
                  type: Type.OBJECT,
                  properties: {
                    fullName: { type: Type.STRING },
                    email: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    linkedin: { type: Type.STRING },
                    portfolio: { type: Type.STRING }
                  }
                },
                preferences_updates: {
                  type: Type.OBJECT,
                  properties: {
                    targetRoles: { type: Type.ARRAY, items: { type: Type.STRING } },
                    minSalary: { type: Type.STRING },
                    locations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    remoteOnly: { type: Type.BOOLEAN }
                  }
                },
                improvement_prompt: { type: Type.STRING, description: "Instruction for resume change" },
                target_tab: { type: Type.STRING, enum: ['discover', 'resume_lab', 'freelance', 'profile', 'history', 'roadmap', 'interview'] },
                query: { type: Type.STRING, description: "The search query" }
              }
            }
          },
          required: ["action"]
        }
      }
    });
    return JSON.parse(response.text || '{"action":"blocked"}');
  } catch (error) {
    return { action: 'blocked' };
  }
};

export const generateProposal = async (gig: any, profile: UserProfile): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write proposal for: ${gig.title}. Description: ${gig.description}. My Context: ${profile.resumeTracks[0]?.content.summary}`,
    config: {
      systemInstruction: "Write a short, professional freelance bid. Highlight relevant project experience and end with an available time for a call.",
    }
  });
  return response.text || "Proposal failed.";
};

export const extractJobData = async (input: string): Promise<Job> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Extract real structured details from this live job posting: "${input}". 
    Use search tools to confirm the company and requirements if the link text is sparse.`,
    config: {
      tools: [{ googleSearch: {} }],
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
          platform: { type: Type.STRING }
        }
      }
    }
  });
  const data = JSON.parse(response.text || "{}");
  return { ...data, id: Math.random().toString(36).substr(2, 9), scrapedAt: new Date().toISOString() };
};

export const searchJobs = async (preferences: any): Promise<DiscoveredJob[]> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `CRITICAL: Find and verify 5-7 active, non-expired job listings for: ${JSON.stringify(preferences.targetRoles)}.
    
    INSTRUCTIONS:
    1. Use Google Search to find real listings on LinkedIn, Indeed, Greenhouse, Lever, or company career pages.
    2. Extract the actual application URL (not a generic home page).
    3. Determine the 'postedAt' date (e.g., '2 days ago') to ensure they are fresh.
    4. Provide a brief description and the source name.
    
    STRICTLY NO SIMULATED DATA. Every entry must be a real job you found on the live web.`,
    config: {
      tools: [{ googleSearch: {} }],
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
            source: { type: Type.STRING },
            description: { type: Type.STRING },
            postedAt: { type: Type.STRING }
          }
        }
      }
    }
  });
  
  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Search Grounding Parse Error:", e);
    return [];
  }
};

export const calculateMatchScore = async (job: any, profile: UserProfile): Promise<any> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Compare Job: ${JSON.stringify(job)} with Profile: ${JSON.stringify(profile.resumeTracks[0]?.content)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { 
          score: { type: Type.NUMBER }, 
          reasoning: { type: Type.STRING }, 
          missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } } 
        }
      }
    }
  });
  return JSON.parse(response.text || '{"score":0}');
};

export const generateCoverLetter = async (job: any, profile: UserProfile, style: any): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateContent({ 
    model: 'gemini-3-flash-preview', 
    contents: `Write a ${style} cover letter for ${job.title} at ${job.company}. Source Context: ${job.description}` 
  });
  return response.text || "";
};

export const mutateResume = async (job: any, profile: UserProfile): Promise<any> => {
  const ai = getAi();
  const response = await ai.models.generateContent({ 
    model: 'gemini-3-pro-preview', 
    contents: `Update my resume summary and achievements to perfectly match ${job.title}. Focus on these requirements: ${job.description}`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};

export const parseResume = async (base64: string, mimeType: string): Promise<any> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ inlineData: { data: base64, mimeType } }, { text: "Extract Name, Email, Phone, and structured Resume JSON." }] },
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};
