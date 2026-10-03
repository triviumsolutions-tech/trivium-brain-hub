import { GoogleGenerativeAI, Part } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
export const genAI = new GoogleGenerativeAI(apiKey);

// Modelos ordenados por preferência e disponibilidade
// Caso o modelo primário sofra picos de demanda (503), o próximo assume imediatamente
export const CANDIDATE_MODELS = [
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
];

export async function generateContentWithFallback(
  contents: string | Array<string | Part>
) {
  let lastError: unknown = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contents);
      return { result, modelName };
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[Gemini Fallback] Modelo ${modelName} falhou (${msg}). Tentando próximo modelo da fila...`
      );
    }
  }

  throw lastError;
}
