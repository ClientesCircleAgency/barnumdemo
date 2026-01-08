import { useState } from 'react';
import { Plus, Clock, ArrowRight, AlertTriangle, AlertCircle, CheckCircle, Trash2, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useClinic } from '@/context/ClinicContext';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState } from '@/components/admin/EmptyState';
import { AddToWaitlistModal } from '@/components/admin/AddToWaitlistModal';
import { SuggestSlotModal } from '@/components/admin/SuggestSlotModal';
import { AppointmentWizard } from '@/components/admin/AppointmentWizard';
import { waitlistPriorityLabels, timePreferenceLabels } from '@/types/clinic';
import type { WaitlistItem, Patient } from '@/types/clinic';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';

export default function WaitlistPage() {
  const { waitlist, getPatientById, getSpecialtyById, getProfessionalById, removeFromWaitlist } = useClinic();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WaitlistItem | null>(null);
  const [preselectedPatient, setPreselectedPatient] = useState<Patient | null>(null);
  const [preselectedDate, setPreselectedDate] = useState<Date | undefined>(undefined);
  const [search, setSearch] = useState('');

  const highPriority = waitlist.filter((w) => w.priority === 'high').length;
  const mediumPriority = waitlist.filter((w) => w.priority === 'medium').length;
  const lowPriority = waitlist.filter((w) => w.priority === 'low').length;

  const sortedWaitlist = [...waitlist]
    .filter((item) => {
      if (!search) return true;
      const patient = getPatientById(item.patientId);
      return patient?.name.toLowerCase().includes(search.toLowerCase()) || patient?.phone.includes(search);
    })
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const handleSuggestSlot = (item: WaitlistItem) => {
    setSelectedItem(item);
    setSuggestModalOpen(true);
  };

  const handleSelectSlot = (date: Date, time: string, professionalId: string) => {
    setSuggestModalOpen(false);
    if (selectedItem) {
      const patient = getPatientById(selectedItem.patientId);
      setPreselectedPatient(patient || null);
      setPreselectedDate(date);
      setWizardOpen(true);
    }
  };

  const handleConvert = (item: WaitlistItem) => {
    const patient = getPatientById(item.patientId);
    setPreselectedPatient(patient || null);
    setSelectedItem(item);
    setWizardOpen(true);
  };

  const handleWizardClose = (open: boolean) => {
    setWizardOpen(open);
    if (!open && selectedItem) {
      removeFromWaitlist(selectedItem.id);
      toast.success('Consulta criada e paciente removido da lista de espera');
      setSelectedItem(null);
      setPreselectedPatient(null);
      setPreselectedDate(undefined);
    }
  };

  const handleRemove = (id: string) => {
    removeFromWaitlist(id);
    toast.success('Paciente removido da lista de espera');
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Lista de Espera"
        subtitle={`${waitlist.length} pacientes aguardando vaga`}
        actions={
          <Button className="gap-2 bg-primary-gradient hover:opacity-90" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        }
      />

      {/* Cards de prioridade */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Urgente</p>
              <p className="text-2xl font-bold text-red-600">{highPriority}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atenção</p>
              <p className="text-2xl font-bold text-orange-600">{mediumPriority}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Normal</p>
              <p className="text-2xl font-bold text-blue-600">{lowPriority}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          <span>Atualizado agora</span>
        </div>
      </div>

      {/* Lista */}
      {sortedWaitlist.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl">
          <EmptyState
            icon={CheckCircle}
            title="Lista de Espera Limpa"
            description="Não há pacientes aguardando vaga no momento"
            actionLabel="Adicionar Paciente"
            onAction={() => setAddModalOpen(true)}
            iconClassName="text-green-500"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {sortedWaitlist.map((item) => {
            const patient = getPatientById(item.patientId);
            const specialty = item.specialtyId ? getSpecialtyById(item.specialtyId) : null;
            const professional = item.professionalId ? getProfessionalById(item.professionalId) : null;

            return (
              <div
                key={item.id}
                className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <Badge className={getPriorityStyles(item.priority)}>
                    {waitlistPriorityLabels[item.priority]}
                  </Badge>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{patient?.name || 'Paciente desconhecido'}</h3>
                    <p className="text-sm text-muted-foreground">{patient?.phone}</p>
                    <div className="flex flex-wrap gap-4 mt-3 text-sm">
                      {specialty && (
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">Especialidade:</strong> {specialty.name}
                        </span>
                      )}
                      {professional && (
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">Profissional:</strong> {professional.name}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">Horário:</strong> {timePreferenceLabels[item.timePreference]}
                      </span>
                    </div>
                    {item.reason && (
                      <p className="mt-3 text-sm bg-muted/50 p-3 rounded-xl text-muted-foreground">{item.reason}</p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Adicionado em {format(new Date(item.createdAt), "d 'de' MMMM", { locale: pt })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => handleSuggestSlot(item)}>
                      <Clock className="h-3 w-3" />
                      Sugerir
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => handleConvert(item)}>
                      Converter
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddToWaitlistModal open={addModalOpen} onOpenChange={setAddModalOpen} />
      <SuggestSlotModal open={suggestModalOpen} onOpenChange={setSuggestModalOpen} waitlistItem={selectedItem} onSelectSlot={handleSelectSlot} />
      <AppointmentWizard open={wizardOpen} onOpenChange={handleWizardClose} preselectedPatient={preselectedPatient} preselectedDate={preselectedDate} />
    </div>
  );
}
