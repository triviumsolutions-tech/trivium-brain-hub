export default function ConfiguracoesPage() {
  return (
    <div className="p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10 min-h-screen">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">Configurações</h1>
          <p className="text-white/50">Gerencie as preferências do seu painel e da Inteligência Artificial.</p>
        </div>
      </header>

      <div className="glass rounded-3xl p-8 flex flex-col gap-6 text-center opacity-70">
        <h2 className="text-xl font-medium">Em breve</h2>
        <p className="text-white/50">A tela de configurações da Trivium será liberada na próxima versão.</p>
      </div>
    </div>
  );
}
