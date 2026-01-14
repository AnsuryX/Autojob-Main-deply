
import { GoogleGenAI, Type } from "@google/genai";
import { Job, UserProfile, MatchResult, DiscoveredJob, CoverLetterStyle, Gig, CommandResult, ResumeMutation } from "../types.ts";

const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Missing Gemini API Key.");
  return new GoogleGenAI({ apiKey });
};

export const interpretCommand = async (input: string): Promise<CommandResult> => {
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Interpret: "${input}"`,
      config: {
        systemInstruction: "Convert user intent to JSON. If they ask for freelance, projects, or gigs from Upwork/Fiverr, use action 'find_gigs'.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ['apply', 'find_gigs', 'status', 'strategy', 'blocked'] },
            goal: { type: Type.STRING }
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

export const searchFreelanceGigs = async (query: string): Promise<Gig[]> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Find active freelance projects/gigs on Upwork, Fiverr, or Toptal matching: "${query}"`,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: "Return a list of projects. For each, find the title, platform name, estimated budget (if visible), and direct project URL.",
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
          },
          required: ["title", "platform", "url"]
        }
      }
    }
  });
  const data = JSON.parse(response.text || "[]");
  return data.map((g: any) => ({ ...g, id: Math.random().toString(36).substr(2, 9) }));
};

export const generateProposal = async (gig: Gig, profile: UserProfile): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Project: ${gig.title}. Description: ${gig.description}. My Profile: ${JSON.stringify(profile.resumeTracks[0]?.content.summary)}`,
    config: {
      systemInstruction: "Write a short, high-conversion freelance proposal. Start with a question about their project. Focus on 'How I can help you finish this ASAP'. No fluff.",
    }
  });
  return response.text || "Proposal failed.";
};

// Existing functions kept for compatibility
export const extractJobData = async (input: string): Promise<Job> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze job: "${input}"`,
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
    contents: `Find jobs: ${JSON.stringify(preferences)}`,
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
            url: { type: Type.STRING }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const calculateMatchScore = async (job: any, profile: UserProfile): Promise<MatchResult> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Match Analysis for ${job.title}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { score: { type: Type.NUMBER }, reasoning: { type: Type.STRING }, missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } } }
      }
    }
  });
  return JSON.parse(response.text || '{"score":0}');
};

export const generateCoverLetter = async (job: any, profile: UserProfile, style: CoverLetterStyle): Promise<string> => {
  const ai = getAi();
  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Write CL for ${job.title}` });
  return response.text || "";
};

export const mutateResume = async (job: any, profile: UserProfile): Promise<ResumeMutation> => {
  const ai = getAi();
  const response = await ai.models.generateContent({ 
    model: 'gemini-3-pro-preview', 
    contents: `Mutate resume for ${job.title}`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};

export const parseResume = async (base64: string, mimeType: string): Promise<any> => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ inlineData: { data: base64, mimeType } }, { text: "Extract JSON" }],
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || "{}");
};
