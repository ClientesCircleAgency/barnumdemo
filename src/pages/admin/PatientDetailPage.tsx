import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Calendar, Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useClinic } from '@/context/ClinicContext';
import { AppointmentWizard } from '@/components/admin/AppointmentWizard';
import { appointmentStatusLabels } from '@/types/clinic';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPatientById, getAppointmentsByPatient, getProfessionalById, getConsultationTypeById } = useClinic();

  const [wizardOpen, setWizardOpen] = useState(false);

  const patient = getPatientById(id || '');
  const appointments = getAppointmentsByPatient(id || '').sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Paciente não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/admin/pacientes')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      waiting: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-orange-100 text-orange-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-purple-100 text-purple-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-4 lg:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/pacientes')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-serif italic text-foreground text-lg lg:text-2xl">{patient.name}</h1>
              <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-wide">
                NIF: {patient.nif}
              </p>
            </div>
          </div>
          <Button className="gap-2 bg-primary-gradient hover:opacity-90 shrink-0" onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Consulta</span>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle>Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>{patient.phone}</span></div>
            {patient.email && <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>{patient.email}</span></div>}
            {patient.birthDate && <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{format(new Date(patient.birthDate), 'dd/MM/yyyy', { locale: pt })}</span></div>}
            <Separator />
            <div><h4 className="text-sm font-medium text-muted-foreground mb-2">Registado em</h4><p>{format(new Date(patient.createdAt), "d 'de' MMMM 'de' yyyy", { locale: pt })}</p></div>
            {patient.tags && patient.tags.length > 0 && <div><h4 className="text-sm font-medium text-muted-foreground mb-2">Tags</h4><div className="flex flex-wrap gap-1">{patient.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div></div>}
            {patient.notes && <div><h4 className="text-sm font-medium text-muted-foreground mb-2">Observações</h4><p className="text-sm">{patient.notes}</p></div>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Histórico de Consultas ({appointments.length})</CardTitle></CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Sem histórico de consultas</p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4" />Agendar primeira consulta</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => {
                  const professional = getProfessionalById(apt.professionalId);
                  const consultationType = getConsultationTypeById(apt.consultationTypeId);
                  return (
                    <div key={apt.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="text-center min-w-20"><p className="text-lg font-bold">{format(new Date(apt.date), 'dd', { locale: pt })}</p><p className="text-xs text-muted-foreground uppercase">{format(new Date(apt.date), 'MMM yyyy', { locale: pt })}</p></div>
                      <div className="flex-1"><div className="flex items-center gap-2"><span className="font-medium">{apt.time}</span><span className="text-muted-foreground">•</span><span>{consultationType?.name || 'Consulta'}</span></div><p className="text-sm text-muted-foreground">{professional?.name}</p></div>
                      <Badge className={getStatusColor(apt.status)}>{appointmentStatusLabels[apt.status]}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AppointmentWizard open={wizardOpen} onOpenChange={setWizardOpen} preselectedPatient={patient} />
    </div>
  );
}
