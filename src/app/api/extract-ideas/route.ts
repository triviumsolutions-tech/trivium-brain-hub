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

    const prompt = `Você é um Engenheiro de Software Sênior e Diretor de Produto da Trivium. 
    Ouça este áudio detalhadamente. Extraia os projetos, ideias ou features discutidos.
    Sua resposta deve ser estritamente uma Array JSON, onde CADA ideia tem o seguinte formato:
    {
      "title": "Nome da Ideia/Feature",
      "project": "Nome do Projeto (se não tiver, coloque 'Brainstorm')",
      "desc": "Aqui você DEVE escrever uma análise PROFUNDA e rica em detalhes sobre o que foi dito. Estruture o texto com os seguintes tópicos (use quebras de linha \\n\\n): 1. Resumo Executivo (Qual a dor e a solução). 2. Requisitos Técnicos e Regras de Negócio (O que precisa ser feito). 3. Casos de Uso (Como será usado). 4. Riscos e Pontos de Atenção (O que pode dar errado). 5. Próximos Passos Sugeridos. Seja extremamente descritivo, consultivo e analítico, usando um tom profissional da área de TI."
    }
    IMPORTANTE: Retorne APENAS a Array JSON válida. Nenhuma outra palavra fora do JSON.`;

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
