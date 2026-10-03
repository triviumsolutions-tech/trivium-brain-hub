import { NextRequest, NextResponse } from "next/server";
import { generateContentWithFallback } from "@/lib/gemini";
import { Part } from "@google/generative-ai";

interface ImageAttachment {
  name?: string;
  mimeType: string;
  data: string; // base64
}

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface SuggestedTask {
  title: string;
  description?: string;
  priority?: "alta" | "media" | "baixa";
}

export async function POST(req: NextRequest) {
  try {
    const { question, history, images, contextData } = await req.json();

    if (!question && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Por favor, digite uma pergunta, grave um áudio ou anexe uma imagem." },
        { status: 400 }
      );
    }

    const systemPrompt = `Você é a **Trivium AI** — a inteligência artificial executiva, estratégica e técnica central da Trivium Solutions (Trivium Brain Hub).
Sua missão é atuar como copiloto sênior dos fundadores e da equipe, analisando dados de projetos, ideias, tarefas de Kanban, atas de reuniões, métricas e arquiteturas visuais enviadas em imagens.

CONTEXTO INSTITUCIONAL DA TRIVIUM (Acervo Firestore em tempo real):
${contextData || "Nenhum dado cadastrado ainda no hub."}

DIRETRIZES DA TRIVIUM AI:
1. Responda em Português do Brasil com postura executiva e inspiradora (estilo Sócio Diretor de Tecnologia e Produto).
2. ANÁLISE MULTIMODAL DE IMAGENS:
   - Se o usuário anexou imagens (wireframes, diagramas de arquitetura, anotações de lousa, mockups, capturas de tela ou erros):
   - Analise com minúcia cada elemento visual, texto e fluxo desenhado.
   - Conecte o conteúdo da imagem com os projetos, ideias e tarefas cadastrados no Trivium Hub.
   - Aponte pontos fortes, fragilidades e recomende tarefas estruturadas para o Kanban.
3. AUDITORIA E VALIDAÇÃO DE PROJETOS & GAPS:
   - Se a pergunta for sobre um projeto ou ideia (ex: calculadora de churrasco, ferramentas de cálculo, sistemas internos, SaaS, automações):
   - Identifique a dor cadastrada, departamento e status atual.
   - Cruze com as tarefas mapeadas no Kanban (Backlog, Em Desenvolvimento, Finalizado).
   - Realize ANÁLISE DE GAPS: aponte o que foi pensado nas ideias mas ainda NÃO tem tarefa correspondente no Kanban.
4. MAPEAMENTO E CRIAÇÃO INTERATIVA DE TAREFAS PARA O KANBAN (Human-in-the-Loop):
   - Se o usuário pedir para mapear, sugerir, planejar, organizar ou criar tarefas para um projeto específico (ou perguntar o que falta fazer no Kanban de um projeto):
   - Apresente sua análise executiva com a lista detalhada das tarefas no texto.
   - OBRIGATORIAMENTE, no final da resposta, inclua um bloco JSON delimitado por \`\`\`json:tasks ... \`\`\` no seguinte formato exato:
   \`\`\`json:tasks
   {
     "projectName": "Nome Exato do Projeto",
     "tasks": [
       {
         "title": "Título claro e objetivo da tarefa",
         "description": "Contexto técnico, critérios de aceite e regras",
         "priority": "alta"
       }
     ]
   }
   \`\`\`
   (Onde "priority" deve ser "alta", "media" ou "baixa").
   - Se o usuário pedir para organizar, alterar prioridades ou remover tarefas de uma lista anterior, devolva o bloco \`\`\`json:tasks com a lista ajustada.
5. HISTÓRICO DA CONVERSA:
   - Mantenha continuidade contextual com as mensagens trocadas anteriormente nesta sessão.
6. FORMATAÇÃO E CLAREZA:
   - Estruture sua resposta com Markdown elegante (títulos claros, bullet points destacados, listas e tabelas se necessário).
   - Seja assertivo, direto ao ponto e agregue valor real de negócio e engenharia.`;

    const parts: Array<string | Part> = [systemPrompt];

    // Inclui histórico recente de mensagens para continuidade da conversa
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory: ChatHistoryItem[] = history.slice(-6);
      const historyText = recentHistory
        .map((m) => `${m.role === "user" ? "USUÁRIO" : "TRIVIUM AI"}: ${m.content}`)
        .join("\n\n");
      parts.push(`\nHISTÓRICO RECENTE DA CONVERSA:\n${historyText}\n`);
    }

    // Inclui imagens enviadas
    if (Array.isArray(images) && images.length > 0) {
      images.forEach((img: ImageAttachment) => {
        if (img.data && img.mimeType) {
          const cleanBase64 = img.data.replace(/^data:[^;]+;base64,/, "");
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: cleanBase64,
            },
          });
        }
      });
    }

    // Pergunta / instrução do usuário
    const userPrompt =
      question && question.trim().length > 0
        ? question.trim()
        : "Analise a imagem anexada em detalhes, cruzando com os projetos, ideias e diretrizes da Trivium.";
    parts.push(`\nPERGUNTA OU COMANDO DO USUÁRIO:\n"${userPrompt}"`);

    const { result, modelName } = await generateContentWithFallback(parts);
    const rawAnswer = result.response.text();
    console.log(`[Trivium AI] Respondido com sucesso via ${modelName}`);

    // Extração Multi-Estratégia de Tarefas do Kanban (JSON ou Markdown)
    let suggestedTasks: SuggestedTask[] | undefined;
    let targetProject: string | undefined;
    let cleanAnswer = rawAnswer;

    // Estratégia 1: Bloco específico ```json:tasks ... ```
    const taskMatch = rawAnswer.match(/```json:tasks\s*([\s\S]*?)\s*```/);
    if (taskMatch && taskMatch[1]) {
      try {
        const parsed = JSON.parse(taskMatch[1]);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          suggestedTasks = parsed.tasks;
          targetProject = parsed.projectName;
          cleanAnswer = rawAnswer.replace(/```json:tasks[\s\S]*?```/, "").trim();
        }
      } catch (err) {
        console.warn("Erro ao fazer parse de json:tasks:", err);
      }
    }

    // Estratégia 2: Bloco genérico ```json { ... "tasks": [...] } ```
    if (!suggestedTasks) {
      const genericJsonMatch = rawAnswer.match(/```json\s*(\{[\s\S]*?"tasks"[\s\S]*?\})\s*```/);
      if (genericJsonMatch && genericJsonMatch[1]) {
        try {
          const parsed = JSON.parse(genericJsonMatch[1]);
          if (parsed.tasks && Array.isArray(parsed.tasks)) {
            suggestedTasks = parsed.tasks;
            targetProject = parsed.projectName;
            cleanAnswer = rawAnswer.replace(/```json[\s\S]*?```/, "").trim();
          }
        } catch (err) {
          console.warn("Erro ao fazer parse de generic json:", err);
        }
      }
    }

    // Estratégia 3: Parse inteligente linha a linha de bullet points (ex: * **Task 1: [Backend] ...**)
    if (!suggestedTasks && /(?:Task|Tarefa)\s*\d*:/i.test(rawAnswer)) {
      const lines = rawAnswer.split("\n");
      const fallbackTasks: SuggestedTask[] = [];
      let currentTask: SuggestedTask | null = null;
      let currentDescLines: string[] = [];
      let currentSectionPriority: "alta" | "media" | "baixa" = "media";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detecta seções com indicação de prioridade (ex: ### Épico 1: ... (Prioridade: Alta))
        if (/^#+\s+.*(?:Prioridade:\s*([A-Za-zÀ-ÿ]+)|(MVP|Crítico|Crítica))/i.test(line)) {
          if (/alta|urgente|crítica|mvp/i.test(line)) {
            currentSectionPriority = "alta";
          } else if (/baixa/i.test(line)) {
            currentSectionPriority = "baixa";
          } else {
            currentSectionPriority = "media";
          }
        }

        const taskTitleMatch = line.match(/^[-*]\s+\*\*(?:Task|Tarefa)?\s*\d*[:.-]?\s*(.*?)\*\*/i);
        if (taskTitleMatch) {
          if (currentTask) {
            currentTask.description = currentDescLines.join("\n").trim();
            fallbackTasks.push(currentTask);
            currentDescLines = [];
          }
          const title = taskTitleMatch[1].trim();
          const priority: "alta" | "media" | "baixa" = /alta|urgente|crítica/i.test(title)
            ? "alta"
            : /baixa|futura|nice to have/i.test(title)
            ? "baixa"
            : currentSectionPriority;
          currentTask = { title, priority, description: "" };
          continue;
        }

        if (currentTask) {
          if (line.startsWith("*") || line.startsWith("-")) {
            const cleanDesc = line
              .replace(/^[-*]\s+/, "")
              .replace(/\*Descrição:\*\s*/i, "")
              .replace(/\*Critério de Aceite:\*\s*/i, "Critério de Aceite: ");
            if (cleanDesc) currentDescLines.push(cleanDesc);
          } else if (line.length > 0 && !line.startsWith("#") && !line.startsWith("---")) {
            currentDescLines.push(line);
          }
        }
      }

      if (currentTask) {
        currentTask.description = currentDescLines.join("\n").trim();
        fallbackTasks.push(currentTask);
      }

      if (fallbackTasks.length > 0) {
        suggestedTasks = fallbackTasks;
      }
    }

    // Identifica o nome do projeto se ainda não detectado
    if (suggestedTasks && !targetProject) {
      const projectMatch =
        rawAnswer.match(/(?:projeto|project)\s+\*\*([^*]+)\*\*/i) ||
        userPrompt.match(/(?:projeto|project)\s+([a-zA-Z0-9À-ÿ\s-]+?)(?:\s+e|\s+pra|\s+para|[?.!]|$)/i);
      if (projectMatch && projectMatch[1]) {
        targetProject = projectMatch[1].trim();
      } else {
        targetProject = "Lectio";
      }
    }

    return NextResponse.json({
      answer: cleanAnswer,
      suggestedTasks,
      targetProject,
      model: modelName,
    });
  } catch (error: unknown) {
    console.error("Erro na Trivium AI:", error);
    const message = error instanceof Error ? error.message : "Erro ao consultar a Trivium AI.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
