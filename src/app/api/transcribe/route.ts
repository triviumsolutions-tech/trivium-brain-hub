import { NextRequest, NextResponse } from "next/server";
import { generateContentWithFallback } from "@/lib/gemini";

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

    const prompt = `Você é um especialista em transcrição fonética e reconhecimento de voz de altíssima precisão em português do Brasil para a empresa Trivium.
Sua missão é transcrever exatamente o que a pessoa falou no áudio com máxima fidelidade acústica aos fonemas pronunciados.

Atenção especial ao contexto da empresa:
- Ideias e produtos: calculadora de churrasco, ferramentas de cálculo, simuladores, automações, SaaS, apps, produtos digitais.
- Termos técnicos e gestão: Trivium, Brain Hub, Lectio, Jira, Kanban, Firestore, backlog, sprint, reuniões, atas, tarefas.

DIRETRIZES CRÍTICAS:
1. Ouça com extrema atenção a cada palavra. Não substitua palavras cotidianas por jargões (por exemplo: se o usuário disser "calculadora de churrasco", NUNCA transcreva como "calculadora de taxas" ou algo genérico).
2. Mantenha os nomes e ideias exatamente como ditos pelo falante.
3. Retorne EXCLUSIVAMENTE o texto transcrito em português brasileiro, sem aspas, sem pontuação inventada e sem introduções ou explicações.`;

    const mimeType =
      file.type && file.type !== "application/octet-stream"
        ? file.type
        : "audio/webm";

    const { result, modelName } = await generateContentWithFallback([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
    ]);

    const transcript = result.response.text().trim();
    console.log(`[Audio Transcribe] Sucesso com modelo ${modelName}`);

    return NextResponse.json({ transcript });
  } catch (error: unknown) {
    console.error("Erro na transcrição de áudio via Gemini:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao transcrever áudio.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
