import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo de áudio recebido." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

    const prompt =
      "Você é um transcritor de áudio de alta precisão. Transcreva exatamente o que foi falado no áudio em português do Brasil. Mantenha os termos técnicos, nomes de produtos ou empresas (ex: Trivium, Lectio, Jira, Kanban). Retorne ESTRITAMENTE o texto transcrito, sem aspas, sem introdução ou explicações.";

    const mimeType = file.type && file.type !== "application/octet-stream" 
      ? file.type 
      : "audio/webm";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
    ]);

    const transcript = result.response.text().trim();

    return NextResponse.json({ transcript });
  } catch (error: unknown) {
    console.error("Erro na transcrição de áudio via Gemini:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao transcrever áudio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
