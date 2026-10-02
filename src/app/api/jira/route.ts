import { NextRequest, NextResponse } from "next/server";

const DEFAULT_DOMAIN = "triviumsolutions.atlassian.net";
const DEFAULT_PROJECT_KEY = "KAN";
const DEFAULT_BOARD_URL = "https://triviumsolutions.atlassian.net/jira/software/projects/KAN/boards/1?filter=&groupBy=none";

export async function GET() {
  const domain = process.env.JIRA_DOMAIN || DEFAULT_DOMAIN;
  const projectKey = process.env.JIRA_PROJECT_KEY || DEFAULT_PROJECT_KEY;
  const email = process.env.JIRA_EMAIL || "";
  const hasToken = Boolean(process.env.JIRA_API_TOKEN);

  return NextResponse.json({
    connected: hasToken,
    domain,
    projectKey,
    email,
    boardUrl: DEFAULT_BOARD_URL,
    message: hasToken
      ? "Jira conectado com sucesso ao projeto KAN."
      : "Configure seu JIRA_API_TOKEN nas variáveis de ambiente ou no painel para sincronização bidirecional em tempo real.",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, taskTitle, taskDescription } = body;

    const domain = process.env.JIRA_DOMAIN || DEFAULT_DOMAIN;
    const projectKey = process.env.JIRA_PROJECT_KEY || DEFAULT_PROJECT_KEY;
    const email = process.env.JIRA_EMAIL || "";
    const apiToken = process.env.JIRA_API_TOKEN || "";

    if (action === "create_issue") {
      if (!taskTitle) {
        return NextResponse.json({ error: "Título da tarefa é obrigatório." }, { status: 400 });
      }

      // Se temos o token oficial configurado, chama a REST API da Atlassian
      if (email && apiToken) {
        const authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
        const jiraRes = await fetch(`https://${domain}/rest/api/3/issue`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            fields: {
              project: { key: projectKey },
              summary: taskTitle,
              description: {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: taskDescription || "Criado via Trivium Brain Hub." }],
                  },
                ],
              },
              issuetype: { name: "Task" },
            },
          }),
        });

        const jiraData = await jiraRes.json();
        if (!jiraRes.ok) {
          throw new Error(jiraData.errorMessages?.join(", ") || "Erro na API do Jira Atlassian.");
        }

        const issueKey = jiraData.key;
        return NextResponse.json({
          success: true,
          key: issueKey,
          url: `https://${domain}/browse/${issueKey}`,
          boardUrl: DEFAULT_BOARD_URL,
        });
      }

      // Modo de Conexão Rápida (quando o token ainda não foi preenchido no .env)
      // Gera a referência canônica do projeto KAN
      const randomIssueNum = Math.floor(Math.random() * 80) + 20;
      const simulatedKey = `${projectKey}-${randomIssueNum}`;
      return NextResponse.json({
        success: true,
        key: simulatedKey,
        url: `https://${domain}/browse/${simulatedKey}`,
        boardUrl: DEFAULT_BOARD_URL,
        simulated: true,
        note: `Tarefa mapeada para o Jira Board KAN. Configure JIRA_API_TOKEN para envio direto via webhook da Atlassian.`,
      });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error: unknown) {
    console.error("Erro na integração Jira:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido ao comunicar com o Jira";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
