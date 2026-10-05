import { GoogleGenerativeAI, Part } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
export const genAI = new GoogleGenerativeAI(apiKey);

// Modelos ordenados por preferência, disponibilidade e velocidade
// Modelos Lite possuem pools dedicados de alta vazão que praticamente nunca sofrem 503
export const CANDIDATE_MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

export async function generateContentWithFallback(
  contents: string | Array<string | Part>,
  maxRetriesPerModel = 2
) {
  let lastError: unknown = null;

  for (const modelName of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(contents);
        return { result, modelName };
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const is503 =
          msg.includes("503") ||
          msg.includes("high demand") ||
          msg.includes("Service Unavailable");

        // Se for um pico momentâneo de demanda (503), faz um retry rápido antes de pular de modelo
        if (is503 && attempt < maxRetriesPerModel) {
          console.warn(
            `[Gemini 503 Spike] Modelo ${modelName} sob alta demanda. Re-tentando em 500ms (tentativa ${attempt}/${maxRetriesPerModel})...`
          );
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }

        console.warn(
          `[Gemini Fallback] Modelo ${modelName} falhou (${msg.slice(0, 120)}). Tentando próximo modelo da fila...`
        );
        break; // Avança para o próximo modelo da lista
      }
    }
  }

  throw lastError;
}
