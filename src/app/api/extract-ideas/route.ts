import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const existingProjects = formData.get("existingProjects") as string || "";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo de áudio recebido." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

    const prompt = `Você é o Diretor de Tecnologia e Produto da Trivium, atuando como o Motor de Ingestão do Trivium Brain Hub.
Ouça este áudio de reunião/brainstorm detalhadamente.

Projetos existentes na empresa para possível associação de palavras-chave:
${existingProjects || "Trivium Brain Hub, Trivium Core, Geral"}

Sua missão obedece às seguintes regras arquiteturais estritas:
1. SEPARAÇÃO FORMAL: Separe o contexto histórico (Ata da Reunião) das tarefas/ideias acionáveis (Sugestões).
2. REGRA DE ASSOCIAÇÃO: Tente associar as ideias aos projetos existentes listados acima. Se for um assunto novo, use 'Brainstorm'. A IA NUNCA oficializa projetos sozinha; todas as ideias entrarão em quarentena para aprovação humana.
3. FORMATO JSON OBRIGATÓRIO: Retorne APENAS um JSON no seguinte formato:
{
  "meetingMinutes": "Texto detalhado da ata da reunião estruturada em: 1. Resumo Executivo; 2. Principais Discussões; 3. Decisões Tomadas; 4. Contexto Histórico e Próximas Datas.",
  "suggestions": [
    {
      "title": "Nome da Ideia/Feature",
      "project": "Nome do Projeto associado",
      "painPoint": "Definição clara da dor ou problema resolvido por esta ideia",
      "department": "Engenharia" ou "Marketing" ou "Produto" ou "Design" ou "Vendas" ou "Operações" ou "Geral",
      "actionItems": [
        "Ação prática 1",
        "Ação prática 2"
      ],
      "desc": "Análise técnica e aprofundada: 1. Escopo; 2. Regras de negócio; 3. Riscos técnicos; 4. Próximos passos sugeridos."
    }
  ]
}

IMPORTANTE: Retorne estritamente o objeto JSON válido, sem texto fora do JSON.`;

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
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("A resposta da IA não estava no formato JSON esperado.");
    }

    const parsedData = JSON.parse(jsonMatch[0]);
    const suggestions = Array.isArray(parsedData.suggestions) ? parsedData.suggestions : [];
    const meetingMinutes = parsedData.meetingMinutes || "Ata da reunião registrada.";

    // Retorna tanto formato novo estruturado quanto retrocompatibilidade com 'ideas'
    return NextResponse.json({
      meetingMinutes,
      suggestions,
      ideas: suggestions
    });

  } catch (error: unknown) {
    console.error("Erro na rota do Gemini:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
