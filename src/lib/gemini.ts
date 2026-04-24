import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export const transcribeAudio = async (audioBase64: string, mimeType: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: audioBase64,
                mimeType: mimeType,
              },
            },
            {
              text: "قم بتفريغ هذا المقطع الصوتي باللهجة اليمنية. إذا كان هناك إعلان بيع أو شراء، لخصه. إذا كانت قصة، لخصها في سطر واحد.",
            },
          ],
        },
      ],
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    return null;
  }
};

export const categorizeTale = async (transcription: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `Categorize this Yemeni voice transcript into one of these: market, stories, farming, news, advice, other. Output ONLY the category name.\n\nTranscript: ${transcription}`,
            },
          ],
        },
      ],
    });

    return response.text?.trim().toLowerCase() || 'other';
  } catch (error) {
    console.error("Gemini Categorization Error:", error);
    return 'other';
  }
};

export const moderateContent = async (transcription: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `Does the following Arabic text contain highly inappropriate, hateful, or severely offensive language? Answer ONLY "true" if it is inappropriate, or "false" if it is safe. Text: "${transcription}"`,
            },
          ],
        },
      ],
    });

    return response.text?.trim().toLowerCase() === 'true';
  } catch (error) {
    console.error("Gemini Moderation Error:", error);
    return false;
  }
};
