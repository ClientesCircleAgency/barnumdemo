import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Phone, Mail, Users, UserPlus, Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClinic } from '@/context/ClinicContext';
import { PageHeader } from '@/components/admin/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { EmptyState } from '@/components/admin/EmptyState';
import { NewPatientModal } from '@/components/admin/NewPatientModal';
import { AppointmentWizard } from '@/components/admin/AppointmentWizard';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Patient } from '@/types/clinic';

export default function PatientsPage() {
  const navigate = useNavigate();
  const { patients, appointments, getPatientById } = useClinic();
  const [search, setSearch] = useState('');
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const filteredPatients = patients.filter((p) => {
    const searchLower = search.toLowerCase();
    return p.name.toLowerCase().includes(searchLower) || p.nif.includes(search) || p.phone.includes(search);
  });

  // Estatísticas
  const newThisMonth = patients.filter((p) => {
    const created = new Date(p.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  const todayDate = new Date().toISOString().split('T')[0];
  const withAppointmentToday = new Set(
    appointments.filter((a) => a.date === todayDate).map((a) => a.patientId)
  ).size;

  const getPatientAppointments = (patientId: string) => {
    const patientApts = appointments
      .filter((a) => a.patientId === patientId)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    const today = todayDate;
    const past = patientApts.filter((a) => a.date < today || (a.date === today && a.status === 'completed'));
    const future = patientApts.filter((a) => a.date >= today && a.status !== 'completed' && a.status !== 'cancelled');
    return { last: past[past.length - 1], next: future[0] };
  };

  const handleNewAppointment = (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPatient(patient);
    setWizardOpen(true);
  };

  const handlePatientCreated = (patientId: string) => {
    navigate(`/admin/pacientes/${patientId}`);
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif italic text-foreground text-lg lg:text-2xl">Pacientes</h1>
        <p className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
          {patients.length} pacientes registados
        </p>
      </div>

      {/* Barra de pesquisa */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-card border-border rounded-xl text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2 h-10 shrink-0">
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
        </Button>
      </div>

      {/* Lista de Pacientes - Cards em mobile, tabela em desktop */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 lg:py-20">
            <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-muted flex items-center justify-center mb-3">
              <Users className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground text-sm lg:text-base mb-1">Base de Pacientes</h3>
            <p className="text-xs lg:text-sm text-muted-foreground text-center px-4">
              {search ? `Nenhum resultado para "${search}"` : 'Comece a digitar para encontrar fichas.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="lg:hidden divide-y divide-border">
              {filteredPatients.map((patient) => {
                const { last, next } = getPatientAppointments(patient.id);
                return (
                  <div
                    key={patient.id}
                    className="p-3 active:bg-accent/50 cursor-pointer"
                    onClick={() => navigate(`/admin/pacientes/${patient.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-foreground text-sm">{patient.name}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleNewAppointment(patient, e)}
                        className="h-7 w-7 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="font-mono">{patient.nif}</span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {patient.phone}
                      </span>
                    </div>
                    {next && (
                      <p className="text-xs text-primary mt-1.5">
                        Próx: {format(new Date(next.date), 'dd/MM', { locale: pt })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">NIF</TableHead>
                    <TableHead className="font-semibold">Contacto</TableHead>
                    <TableHead className="font-semibold">Última</TableHead>
                    <TableHead className="font-semibold">Próxima</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => {
                    const { last, next } = getPatientAppointments(patient.id);
                    return (
                      <TableRow
                        key={patient.id}
                        className="cursor-pointer hover:bg-accent/30 transition-colors"
                        onClick={() => navigate(`/admin/pacientes/${patient.id}`)}
                      >
                        <TableCell className="font-medium text-foreground">{patient.name}</TableCell>
                        <TableCell className="font-mono text-muted-foreground text-sm">{patient.nif}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {patient.phone}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {last ? format(new Date(last.date), 'dd/MM/yy', { locale: pt }) : '—'}
                        </TableCell>
                        <TableCell>
                          {next ? (
                            <span className="text-primary font-medium text-sm">
                              {format(new Date(next.date), 'dd/MM/yy', { locale: pt })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleNewAppointment(patient, e)}
                            className="gap-1 h-8"
                          >
                            <Plus className="h-3 w-3" />
                            Consulta
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <NewPatientModal open={newPatientOpen} onOpenChange={setNewPatientOpen} onPatientCreated={handlePatientCreated} />
      <AppointmentWizard open={wizardOpen} onOpenChange={setWizardOpen} preselectedPatient={selectedPatient} />
    </div>
  );
}
