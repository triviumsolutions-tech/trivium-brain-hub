import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializa o SDK usando a chave de ambiente que será configurada na Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo de áudio recebido." }, { status: 400 });
    }

    // Para arquivos menores (MVP), convertemos para Base64 e enviamos via inlineData.
    // Para vídeos enormes na Vercel, futuramente usaremos a GoogleAIFileManager API.
    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Você é um analista de engenharia de software da Trivium. 
    Ouça este áudio de reunião de brainstorm. Extraia APENAS as ideias, features ou soluções propostas.
    Sua resposta deve ser estritamente uma Array JSON. Nenhuma palavra fora do JSON.
    Exemplo do formato exigido:
    [
      { "title": "Dashboard Gamificado", "project": "Marketing", "desc": "Contexto da ideia falada no áudio." }
    ]`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: file.type, 
          data: base64Audio
        }
      }
    ]);

    const responseText = result.response.text();
    
    // Limpa a formatação markdown (```json ... ```) se o Gemini tiver adicionado
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("A resposta da IA não estava no formato JSON esperado.");
    
    const ideas = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ ideas });

  } catch (error: any) {
    console.error("Erro na rota do Gemini:", error);
    return NextResponse.json({ error: error.message || "Erro desconhecido" }, { status: 500 });
  }
}
