export type IdeaStatus =
  | "Rascunho"
  | "Em Refinamento"
  | "Aprovada"
  | "Estacionada"
  | "Sugestão da IA";

export type ProjectStatus =
  | "Backlog"
  | "Desenvolvimento"
  | "Pausado"
  | "Finalizado";

export type DepartmentTag =
  | "Engenharia"
  | "Marketing"
  | "Produto"
  | "Design"
  | "Vendas"
  | "Operações"
  | "Geral";

export interface Idea {
  id?: string;
  title: string;
  project: string;
  status: IdeaStatus;
  statusColor?: string;
  desc: string;
  notes?: string;
  drawing?: string;
  createdAt?: string;

  // Funil e Quarentena (Human-in-the-loop)
  isQuarantined?: boolean;
  inbox?: boolean;

  // Checkpoint de promoção
  painPoint?: string;
  department?: DepartmentTag;
  tags?: string[];
  actionItems?: string[];

  // Promoção para Projeto
  promotedToProject?: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  priority?: "baixa" | "media" | "alta";
  assignedTo?: string;
  createdAt?: string;
  jiraKey?: string;
  jiraUrl?: string;
}

export interface Project {
  id?: string;
  name: string;
  status: ProjectStatus;
  department?: DepartmentTag;
  painPoint?: string;
  origin_idea_id?: string;
  origin_meeting_id?: string;
  drawing?: string;
  tasks?: KanbanTask[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingDoc {
  id?: string;
  title: string;
  meetingMinutes?: string;
  actionItems?: string[];
  relatedProject?: string;
  createdAt?: string;
  scheduledAt?: string;
  attendees?: string[];
  meetUrl?: string;
  status?: "Agendada" | "Concluída" | "Cancelada";
}

export interface JiraConfig {
  domain: string;
  projectKey: string;
  email?: string;
  apiToken?: string;
  boardUrl?: string;
}

export interface AuditLog {
  id?: string;
  action: string;
  target: string;
  user: string;
  timestamp: string;
  details?: string;
}
