"use client";

import {
  BookOpen,
  Zap,
  Mic,
  Calendar,
  Layers,
  Sparkles,
  PenTool,
  CheckCircle2,
  ExternalLink,
  Keyboard,
  Compass,
  ArrowRight,
  Shield,
  Lightbulb,
  Kanban,
} from "lucide-react";
import Link from "next/link";

export default function ComoUsarPage() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto h-full flex flex-col relative z-10 min-h-screen text-white">
      {/* Top Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-[0_0_25px_rgba(147,51,234,0.4)]">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Manual & Guia de Uso</h1>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Trivium OS
              </span>
            </div>
            <p className="text-white/50 text-sm mt-1">
              Como extrair o máximo do Trivium Brain Hub: atalhos de teclado, fluxos de trabalho e cases práticos.
            </p>
          </div>
        </div>
      </header>

      {/* Grid de Atalhos de Teclado (Power User) */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Keyboard size={18} className="text-purple-400" />
          <h2 className="text-xl font-bold">Atalhos de Teclado (Power User)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ShortcutCard
            keys={["Q"]}
            title="Quick Add Universal"
            desc="Captura ultra-rápida de ideias em qualquer tela do Hub."
            badge="Global"
          />
          <ShortcutCard
            keys={["P"]}
            title="Caneta Livre"
            desc="Desenho de traços livres e setas no Quadro Branco."
            badge="Lousa"
          />
          <ShortcutCard
            keys={["R"]}
            title="Bloco / Retângulo"
            desc="Cria caixas de arquitetura e módulos com cantos arredondados."
            badge="Lousa"
          />
          <ShortcutCard
            keys={["T"]}
            title="Texto Formatado"
            desc="Insere textos livres com controle de tamanho (P, M, G, GG) e cores."
            badge="Lousa"
          />
          <ShortcutCard
            keys={["S"]}
            title="Post-it / Nota Adesiva"
            desc="Adiciona notas adesivas coloridas estilo post-it com sombra realista."
            badge="Lousa"
          />
          <ShortcutCard
            keys={["E"]}
            title="Borracha"
            desc="Apaga elementos e traços desenhados no quadro."
            badge="Lousa"
          />
          <ShortcutCard
            keys={["Espaço", "+ Arraste"]}
            title="Mover Câmera (Pan)"
            desc="Navegação livre pelo canvas infinito da Lousa e do Grafo."
            badge="Câmera"
          />
          <ShortcutCard
            keys={["Ctrl", "Z"]}
            title="Desfazer / Refazer"
            desc="Histórico completo de alterações na Lousa (Ctrl+Y para refazer)."
            badge="Histórico"
          />
        </div>
      </section>

      {/* Cases Práticos de Uso */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Compass size={18} className="text-blue-400" />
          <h2 className="text-xl font-bold">Cases Práticos: Como Usar no Dia a Dia</h2>
        </div>

        <div className="space-y-4">
          {/* Case 1: Insight Rápido */}
          <CaseCard
            step="01"
            title="Tive um insight no meio do dia"
            tag="Atrito Zero"
            color="amber"
            icon={<Zap size={20} className="text-amber-400" />}
            situation="Você está ocupado programando ou em uma ligação e lembrou de uma melhoria vital para um produto."
            howTo="Pressione a tecla 'Q' em qualquer página do Hub. Digite apenas o título da ideia e aperte Enter. Ela cai instantaneamente na Caixa de Entrada para ser detalhada depois sem interromper seu foco."
            actionLink={{ label: "Abrir Dashboard", href: "/" }}
          />

          {/* Case 2: Gravação de Reunião */}
          <CaseCard
            step="02"
            title="Acabamos de realizar uma reunião de Brainstorm"
            tag="Ouvido da Empresa"
            color="purple"
            icon={<Mic size={20} className="text-purple-400" />}
            situation="A equipe conversou por 30 minutos alinhando funcionalidades, levantando problemas e definindo próximos passos."
            howTo="Na Home, arraste o arquivo de áudio da gravação para a área 'Ouvido da Empresa'. A IA (Gemini) processará o áudio e separará a Ata Institucional dos Action Items. As ideias geradas caem na aba 'Quarentena' para você aprovar antes de entrarem no funil."
            actionLink={{ label: "Ir para Ingestão de Áudio", href: "/" }}
          />

          {/* Case 3: Promoção a Projeto */}
          <CaseCard
            step="03"
            title="A ideia amadureceu e vai virar um Projeto Oficial"
            tag="Máquina de Estados"
            color="blue"
            icon={<Layers size={20} className="text-blue-400" />}
            situation="Uma ideia aprovada na Caixa de Entrada foi validada e precisa virar um projeto com quadro Kanban e arquitetura."
            howTo="Abra o modal da ideia, valide a Dor do Cliente e escolha o Departamento responsável. Em seguida, clique em 'Checkpoint: Promover a Projeto'. O sistema cria o Projeto oficial com rastreabilidade da semente original e inicializa o Kanban."
            actionLink={{ label: "Ver Projetos", href: "/projetos" }}
          />

          {/* Case 4: Lousa e Extração de Tarefas */}
          <CaseCard
            step="04"
            title="Planejamento de Arquitetura na Lousa"
            tag="IA Tática"
            color="emerald"
            icon={<PenTool size={20} className="text-emerald-400" />}
            situation="Antes de codar, a equipe técnica quer desenhar a arquitetura de micro-serviços, tabelas do banco e telas."
            howTo="Entre no projeto e clique em 'Lousa do Projeto'. Use as ferramentas de Bloco ('R'), Texto ('T'), Post-it ('S') e Caneta ('P'). Quando terminar o diagrama, clique no botão 'IA: Extrair da Lousa'. O Gemini analisará o quadro e criará as tarefas correspondentes direto no Kanban!"
            actionLink={{ label: "Abrir Projetos", href: "/projetos" }}
          />

          {/* Case 5: Sincronização com Jira */}
          <CaseCard
            step="05"
            title="Envio de Tarefas para o Jira Oficial (triviumsolutions)"
            tag="Atlassian KAN"
            color="sky"
            icon={<ExternalLink size={20} className="text-sky-400" />}
            situation="Você quer que as tarefas planejadas no Brain Hub sejam refletidas no Jira Board oficial da Trivium."
            howTo="No Kanban do projeto, clique no botão '+ Jira KAN' no cartão de qualquer tarefa. O sistema gerará o ticket correspondente no projeto KAN do Jira e criará um badge azul direto para o link da tarefa na Atlassian."
            actionLink={{ label: "Configurar Integração Jira", href: "/configuracoes" }}
          />

          {/* Case 6: Agendamento no Google Agenda */}
          <CaseCard
            step="06"
            title="Marcar reunião de alinhamento com a equipe"
            tag="Google Agenda"
            color="indigo"
            icon={<Calendar size={20} className="text-indigo-400" />}
            situation="Você precisa agendar uma reunião rápida de 30 minutos com os sócios sobre uma ideia ou entrega de projeto."
            howTo="Clique no botão 'Agendar Reunião' (disponível na Home, no modal de ideias ou no cabeçalho do projeto). Defina data, hora e e-mails dos convidados. O sistema gera a sala do Google Meet, salva a reunião no Hub e abre a Google Agenda com tudo pronto para enviar."
            actionLink={{ label: "Agendar na Home", href: "/" }}
          />

          {/* Case 7: Trivium AI Consultiva, Visão e Voz */}
          <CaseCard
            step="07"
            title="Consultar a Trivium AI por Voz, Texto ou Imagens"
            tag="Multimodal • Voz • Visão • RAG"
            color="violet"
            icon={<Sparkles size={20} className="text-violet-400" />}
            situation="Você quer auditar projetos, checar tarefas pendentes, analisar prints de arquiteturas ou conversar em áudio sobre o futuro da empresa."
            howTo="Abra 'Trivium AI' no menu lateral. Você pode digitar, falar em voz alta pelo Microfone ou anexar/colar prints (Ctrl+V) de diagramas e telas. A Trivium AI cruza todo o acervo de projetos, ideias e atas em tempo real e responde em áudio e texto!"
            actionLink={{ label: "Abrir a Trivium AI", href: "/trivium-ai" }}
          />
        </div>
      </section>

      {/* Governança e Ciclos de Vida */}
      <section className="glass rounded-3xl p-8 border border-white/10 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
            <Shield size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Governança, Ciclos de Vida e Quarentena</h3>
            <p className="text-xs text-white/50">Regras arquiteturais que mantêm o banco da Trivium limpo e organizado</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <h4 className="font-bold text-sm text-purple-300 mb-2 flex items-center gap-1.5">
              <Lightbulb size={15} /> Ciclo de Vida da Ideia
            </h4>
            <ul className="space-y-1.5 text-white/70">
              <li><strong className="text-white">Rascunho:</strong> Ideia bruta em Caixa de Entrada.</li>
              <li><strong className="text-white">Em Refinamento:</strong> Discussão técnica em andamento.</li>
              <li><strong className="text-white">Aprovada:</strong> Validada pela diretoria; pronta para virar projeto.</li>
              <li><strong className="text-white">Estacionada:</strong> Ideia arquivada temporariamente.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <h4 className="font-bold text-sm text-blue-300 mb-2 flex items-center gap-1.5">
              <Kanban size={15} /> Ciclo de Vida do Projeto
            </h4>
            <ul className="space-y-1.5 text-white/70">
              <li><strong className="text-white">Backlog:</strong> Projeto formalizado aguardando início.</li>
              <li><strong className="text-white">Desenvolvimento:</strong> Time ativo no Kanban e Lousa.</li>
              <li><strong className="text-white">Pausado:</strong> Desenvolvimento temporariamente suspenso.</li>
              <li><strong className="text-amber-300">Finalizado (Freeze):</strong> A lousa é congelada como arquivo histórico imutável.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
            <h4 className="font-bold text-sm text-emerald-300 mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={15} /> Por que existe a Quarentena?
            </h4>
            <p className="text-white/70">
              Para garantir que transcrições de reuniões não gerem poluição no banco. A IA sugere os itens, mas apenas um humano pode aprovar a transição para o funil oficial (regra Human-in-the-loop).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ShortcutCard({
  keys,
  title,
  desc,
  badge,
}: {
  keys: string[];
  title: string;
  desc: string;
  badge: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 border border-white/10 flex flex-col justify-between hover:border-purple-500/40 transition-all group">
      <div>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-1">
            {keys.map((k, i) => (
              <kbd
                key={i}
                className="px-2 py-1 bg-black/60 border border-white/20 rounded-lg text-xs font-mono font-bold text-purple-300 shadow"
              >
                {k}
              </kbd>
            ))}
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/5">
            {badge}
          </span>
        </div>
        <h4 className="text-xs font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
          {title}
        </h4>
        <p className="text-[11px] text-white/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function CaseCard({
  step,
  title,
  tag,
  icon,
  situation,
  howTo,
  actionLink,
}: {
  step: string;
  title: string;
  tag: string;
  color: string;
  icon: React.ReactNode;
  situation: string;
  howTo: string;
  actionLink?: { label: string; href: string };
}) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row items-start gap-5">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-bold text-white/40">{step}.</span>
          <h3 className="font-bold text-sm text-white">{title}</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
            {tag}
          </span>
        </div>

        <p className="text-xs text-white/60">
          <strong className="text-white/80">Cenário:</strong> {situation}
        </p>

        <p className="text-xs text-white/80 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
          <strong className="text-purple-300">Como fazer:</strong> {howTo}
        </p>

        {actionLink && (
          <div className="pt-1">
            <Link
              href={actionLink.href}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              <span>{actionLink.label}</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
