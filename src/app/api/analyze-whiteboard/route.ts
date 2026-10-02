import { NextRequest, NextResponse } from "next/server";
import { generateContentWithFallback } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { projectName, projectDescription, whiteboardData } = await req.json();

    const prompt = `Você é um Arquiteto de Software e Tech Lead da Trivium.
Você está inspecionando o Quadro Branco técnico do projeto "${projectName}".
Descrição do Projeto: ${projectDescription || "Sem descrição prévia."}

Dados estruturados do Whiteboard (traços, anotações, elementos):
${typeof whiteboardData === "string" ? whiteboardData.slice(0, 3000) : JSON.stringify(whiteboardData || {}).slice(0, 3000)}

Sua tarefa é analisar o diagrama/fluxograma/brainstorm desenhado neste quadro branco e derivar tarefas táticas essenciais para a esteira de desenvolvimento do Kanban da equipe.

Retorne APENAS uma Array JSON contendo entre 3 e 6 tarefas acionáveis, no seguinte formato:
[
  {
    "title": "Título claro e técnico da tarefa (ex: Desenvolver schema do banco para o módulo X)",
    "description": "Detalhamento técnico do que precisa ser implementado baseado no quadro branco",
    "priority": "alta" ou "media" ou "baixa"
  }
]

Retorne estritamente o JSON válido sem formatação markdown fora dos colchetes.`;

    const { result, modelName } = await generateContentWithFallback(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("A IA não retornou o formato JSON esperado para as tarefas.");
    }

    const tasks = JSON.parse(jsonMatch[0]);
    console.log(`[Whiteboard] Lousa analisada via ${modelName}`);

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    console.error("Erro na análise do Whiteboard:", error);
    const message = error instanceof Error ? error.message : "Erro ao analisar o quadro branco";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
