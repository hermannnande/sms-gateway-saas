'use client'

type Template = {
  id: string
  name: string
  body: string
  created_at: string
}

export function TemplatesList({ templates }: { templates: Template[] }) {
  if (templates.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-16 text-center border-4 border-black/10 dark:border-white/10 animate-fade-in">
        <div className="text-7xl mb-6 animate-float">📝</div>
        <h3 className="text-2xl font-black mb-3">Aucun template</h3>
        <p className="text-muted-foreground mb-8 text-lg">
          Créez votre premier modèle de message réutilisable
        </p>
        <a
          href="/dashboard/templates/new"
          className="inline-block px-8 py-4 bg-gradient-accent text-white rounded-xl font-bold text-lg shadow-brutal-accent border-4 border-black hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200"
        >
          Créer mon premier template
        </a>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="glass-card rounded-2xl p-6 border-4 border-black/10 dark:border-white/10 hover-lift group animate-fade-in"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl group-hover:scale-110 transition-transform">📝</span>
              <h3 className="font-black text-xl group-hover:text-accent transition">{template.name}</h3>
            </div>
            <span className="px-3 py-1 bg-muted rounded-lg text-xs text-muted-foreground font-semibold">
              {new Date(template.created_at).toLocaleDateString('fr-FR')}
            </span>
          </div>
          <div className="bg-background/50 rounded-xl p-4 border-2 border-border">
            <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
              {template.body}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span>📊</span>
            <span className="font-semibold">{template.body.length}</span> caractères
          </div>
        </div>
      ))}
    </div>
  )
}


