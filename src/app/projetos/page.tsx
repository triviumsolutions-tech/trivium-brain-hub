export default function ProjetosPage() {
  return (
    <div className="p-10 max-w-7xl mx-auto h-full flex flex-col relative z-10">
      <header className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Projetos Trivium</h1>
        <p className="text-white/50">Todos os projetos em desenvolvimento.</p>
      </header>
      <div className="flex flex-col items-center justify-center h-[50vh] glass rounded-3xl border border-dashed border-white/20">
        <h3 className="text-xl font-semibold mb-2">Nenhum projeto cadastrado</h3>
        <p className="text-white/40 max-w-md text-center">Os projetos aparecerão aqui quando você começar a vincular ideias a eles pelo dashboard ou ao criar ideias manuais.</p>
      </div>
    </div>
  );
}
