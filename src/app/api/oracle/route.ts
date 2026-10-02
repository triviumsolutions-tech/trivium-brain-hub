import { NextRequest, NextResponse } from "next/server";
import { generateContentWithFallback } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { question, contextData } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "Pergunta não fornecida." }, { status: 400 });
    }

    const prompt = `Você é o Oráculo Institucional da Trivium (Trivium Brain Hub).
Sua missão é responder perguntas estratégicas, técnicas e de gestão dos sócios e colaboradores baseando-se RIGOROSAMENTE no acervo e na verdade histórica da empresa fornecida no contexto abaixo.

CONTEXTO INSTITUCIONAL DA TRIVIUM (Projetos com Tarefas do Kanban, Ideias Aprovadas e Atas de Reunião):
${contextData || "Nenhum dado cadastrado ainda no hub."}

PERGUNTA DO USUÁRIO:
"${question}"

DIRETRIZES DE RESPOSTA:
1. Seja analítico, direto, profissional e inspirador como um Diretor/Sócio da Trivium.
2. Cite explicitamente quais projetos, ideias ou reuniões foram utilizados para embasar a resposta.
3. AUDITORIA E VALIDAÇÃO DE PROJETOS:
   - Se o usuário pedir para validar ou analisar um projeto específico, avalie seu status, departamento e dor principal.
   - Cruze com todas as ideias aprovadas vinculadas a esse projeto.
   - Analise as tarefas atuais do Kanban desse projeto (Backlog, Desenvolvimento, Finalizado).
   - Realize uma ANÁLISE DE GAPS: destaque quais ideias e dores aprovadas ainda NÃO possuem tarefas mapeadas no Kanban ou Jira (quadro KAN).
   - Sugira tarefas prioritárias e estruturadas para o time executar.
4. Se algo não estiver no contexto, deixe claro que ainda não foi registrado no Brain Hub e sugira como registrar.
5. Estruture a resposta com formatação Markdown rica (títulos, bullet points, tabelas quando útil).`;

    const { result, modelName } = await generateContentWithFallback(prompt);
    const answer = result.response.text();
    console.log(`[Oracle] Respondido com sucesso via ${modelName}`);

    return NextResponse.json({ answer });
  } catch (error: unknown) {
    console.error("Erro no Oráculo Trivium:", error);
    const message = error instanceof Error ? error.message : "Erro ao consultar o Oráculo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
