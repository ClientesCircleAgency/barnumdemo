import { useState } from 'react';
import { X, ChevronRight, Stethoscope, Award } from 'lucide-react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { teamMembers } from '@/data/team';
import { TeamMember } from '@/types';

export function TeamSection() {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  return (
    <section id="equipa" className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
      {/* Decoração de Fundo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-64 h-64 bg-primary/10 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-accent/30 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div
          ref={ref}
          className={`transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              A Nossa Equipa
            </span>
            <h2 className="mt-4 text-4xl font-bold text-foreground tracking-tight">
              Conheça os especialistas que <span className="text-primary">cuidam de si.</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Profissionais dedicados, tecnologia de ponta e um atendimento que faz a diferença na sua saúde.
            </p>
          </div>

          {/* Grelha de Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {teamMembers.map((member, index) => (
              <div
                key={member.id}
                className={`group bg-card rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-border overflow-hidden flex flex-col items-center text-center p-6 relative cursor-pointer ${
                  isVisible ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => setSelectedMember(member)}
              >
                {/* Overlay de Hover colorido */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="relative mb-6">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background shadow-lg group-hover:scale-105 transition-transform duration-300">
                    <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full shadow-md transform translate-y-1/4 translate-x-1/4">
                    <Stethoscope size={16} />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-foreground mb-1">{member.name}</h3>
                <p className="text-primary font-medium text-sm mb-3">{member.role}</p>

                <div className="inline-block bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground font-medium mb-4">
                  {member.specialty}
                </div>

                <p className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-2">
                  {member.shortBio}
                </p>

                <button className="mt-auto flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                  Ver Perfil <ChevronRight size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal / Dialog */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedMember(null)}
          ></div>

          <div className="bg-card rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden relative z-10 flex flex-col md:flex-row animate-scale-in">
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 p-2 bg-background/80 hover:bg-muted rounded-full transition-colors z-20"
            >
              <X size={20} className="text-muted-foreground" />
            </button>

            {/* Lado Esquerdo - Foto */}
            <div className="md:w-2/5 h-64 md:h-auto relative">
              <img
                src={selectedMember.image}
                alt={selectedMember.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent md:hidden"></div>
              <div className="absolute bottom-4 left-4 text-primary-foreground md:hidden">
                <h3 className="text-xl font-bold">{selectedMember.name}</h3>
                <p className="opacity-90 text-sm">{selectedMember.role}</p>
              </div>
            </div>

            {/* Lado Direito - Conteúdo */}
            <div className="md:w-3/5 p-8 md:p-10 text-left">
              <div className="hidden md:block mb-6">
                <span className="text-primary font-bold tracking-wide text-sm uppercase">{selectedMember.specialty}</span>
                <h3 className="text-3xl font-bold text-foreground mt-1">{selectedMember.name}</h3>
                <p className="text-muted-foreground text-lg">{selectedMember.role}</p>
              </div>

              <div className="text-muted-foreground mb-8">
                <p className="leading-relaxed">
                  {selectedMember.bio}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Award className="text-primary" size={18} />
                  <span>Certificação de Excelência</span>
                </div>
                <a
                  href="#marcacao"
                  onClick={() => setSelectedMember(null)}
                  className="sm:ml-auto bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-full text-sm font-medium transition-colors shadow-lg"
                >
                  Marcar Consulta
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
