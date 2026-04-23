import { useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Mail,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClinic } from '@/context/ClinicContext';
import { NewPatientModal } from '@/components/admin/NewPatientModal';
import { AppointmentWizard } from '@/components/admin/AppointmentWizard';
import { cn } from '@/lib/utils';
import { format, isSameMonth, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { ClinicAppointment, Patient } from '@/types/clinic';

type PatientFilter = 'all' | 'today' | 'upcoming' | 'inactive';

const patientsInsightBackground =
  'linear-gradient(115deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0.86) 45%, rgba(255, 255, 255, 0.18) 100%), url("https://images.pexels.com/photos/5524021/pexels-photo-5524021.jpeg?auto=compress&cs=tinysrgb&w=900")';

interface PatientTimeline {
  all: ClinicAppointment[];
  past: ClinicAppointment[];
  future: ClinicAppointment[];
  last?: ClinicAppointment;
  next?: ClinicAppointment;
}

const filterLabels: Record<PatientFilter, string> = {
  all: 'Todos',
  today: 'Hoje',
  upcoming: 'Com próxima',
  inactive: 'Sem próxima',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatDate(date?: string) {
  if (!date) return '—';
  return format(parseISO(date), 'dd MMM yyyy', { locale: pt });
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const { patients, appointments } = useClinic();
  const [search, setSearch] = useState('');
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<PatientFilter>('all');

  const todayDate = format(new Date(), 'yyyy-MM-dd');

  const patientTimelines = useMemo(() => {
    const map = new Map<string, PatientTimeline>();

    for (const patient of patients) {
      const patientAppointments = appointments
        .filter((appointment) => appointment.patientId === patient.id)
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      const past = patientAppointments.filter(
        (appointment) => appointment.date < todayDate || appointment.status === 'completed',
      );
      const future = patientAppointments.filter(
        (appointment) => appointment.date >= todayDate && !['completed', 'cancelled', 'no_show'].includes(appointment.status),
      );

      map.set(patient.id, {
        all: patientAppointments,
        past,
        future,
        last: past[past.length - 1],
        next: future[0],
      });
    }

    return map;
  }, [appointments, patients, todayDate]);

  const stats = useMemo(() => {
    const newThisMonth = patients.filter((patient) => isSameMonth(parseISO(patient.createdAt), new Date())).length;
    const withAppointmentToday = new Set(
      appointments.filter((appointment) => appointment.date === todayDate).map((appointment) => appointment.patientId),
    ).size;
    const withFutureAppointment = patients.filter((patient) => patientTimelines.get(patient.id)?.next).length;
    const withoutFutureAppointment = Math.max(patients.length - withFutureAppointment, 0);

    return {
      total: patients.length,
      newThisMonth,
      withAppointmentToday,
      withFutureAppointment,
      withoutFutureAppointment,
    };
  }, [appointments, patientTimelines, patients, todayDate]);

  const filteredPatients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return patients
      .filter((patient) => {
        const timeline = patientTimelines.get(patient.id);

        if (activeTab === 'today' && timeline?.next?.date !== todayDate) return false;
        if (activeTab === 'upcoming' && !timeline?.next) return false;
        if (activeTab === 'inactive' && timeline?.next) return false;

        if (!normalizedSearch) return true;

        return (
          patient.name.toLowerCase().includes(normalizedSearch)
          || patient.nif.includes(search)
          || patient.phone.includes(search)
          || patient.email?.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => {
        const aNext = patientTimelines.get(a.id)?.next?.date ?? '9999-12-31';
        const bNext = patientTimelines.get(b.id)?.next?.date ?? '9999-12-31';
        return aNext.localeCompare(bNext) || a.name.localeCompare(b.name);
      });
  }, [activeTab, patientTimelines, patients, search, todayDate]);

  const handleNewAppointment = (patient: Patient, event: MouseEvent) => {
    event.stopPropagation();
    setSelectedPatient(patient);
    setWizardOpen(true);
  };

  const handlePatientCreated = (patientId: string) => {
    navigate(`/admin/pacientes/${patientId}`);
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-3 sm:px-6">
        <section className="overflow-hidden rounded-[2rem] border border-primary/10 bg-card shadow-[0_24px_80px_rgba(146,94,18,0.10)]">
          <div className="border-b border-primary/10 bg-gradient-to-r from-primary/10 via-secondary/70 to-card px-5 py-6 sm:px-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                    Patient Intelligence
                  </Badge>
                  <span className="text-sm text-primary-dark">Base clínica em tempo real</span>
                </div>
                <h1 className="break-words font-display text-[1.7rem] font-semibold tracking-tight text-foreground sm:text-4xl">
                  Pacientes
                </h1>
                <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-muted-foreground sm:text-base">
                  Uma visão mais completa da relação com cada paciente: contacto, histórico, próxima consulta e estado de acompanhamento.
                </p>
              </div>

              <Button
                onClick={() => setNewPatientOpen(true)}
                className="h-12 rounded-2xl bg-primary-gradient px-5 shadow-lg shadow-primary/20 hover:opacity-90"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Paciente
              </Button>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="border-b border-primary/10 bg-gradient-to-b from-primary/8 via-secondary/60 to-card p-5 lg:border-b-0 lg:border-r">
              <div
                className="mb-6 overflow-hidden rounded-[1.5rem] bg-white bg-cover p-5 text-slate-950 shadow-[0_20px_45px_rgba(146,94,18,0.14)]"
                style={{
                  backgroundImage: patientsInsightBackground,
                  backgroundPosition: '56% 24%',
                }}
              >
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary-dark shadow-sm backdrop-blur">
                  <Users className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-slate-700">Base de pacientes</p>
                <p className="mt-1 text-3xl font-semibold sm:text-4xl">{stats.total}</p>
                <p className="mt-3 break-words text-sm leading-6 text-slate-700">
                  {stats.withFutureAppointment} com consulta futura, {stats.withoutFutureAppointment} para reativar.
                </p>
              </div>

              <div className="space-y-3">
                <InsightPill icon={Calendar} label="Hoje na clínica" value={stats.withAppointmentToday} />
                <InsightPill icon={UserPlus} label="Novos este mês" value={stats.newThisMonth} />
                <InsightPill icon={Clock} label="Com próxima consulta" value={stats.withFutureAppointment} />
              </div>
            </aside>

            <main className="space-y-6 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PatientMetric title="Total" value={stats.total} caption="Pacientes registados" />
                <PatientMetric title="Hoje" value={stats.withAppointmentToday} caption="Com consulta marcada" />
                <PatientMetric title="Acompanhamento" value={stats.withFutureAppointment} caption="Com próxima consulta" />
                <PatientMetric title="Reativar" value={stats.withoutFutureAppointment} caption="Sem próxima consulta" />
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por nome, NIF, telefone ou email..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-12 rounded-2xl border-primary/10 bg-secondary/50 pl-11 text-base"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PatientFilter)}>
                    <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-secondary p-1 sm:flex sm:w-auto">
                      {(Object.keys(filterLabels) as PatientFilter[]).map((filter) => (
                        <TabsTrigger
                          key={filter}
                          value={filter}
                          className="h-10 rounded-xl px-3 data-[state=active]:bg-primary-gradient data-[state=active]:text-primary-foreground"
                        >
                          {filterLabels[filter]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <Button variant="outline" className="h-12 rounded-2xl border-primary/15 bg-card sm:min-w-[110px]">
                    <Filter className="mr-2 h-4 w-4" />
                    Filtros
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.75rem] border border-primary/10 bg-card">
                <div className="border-b border-primary/10 bg-gradient-to-r from-card via-secondary/35 to-card px-5 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <div className="mb-2 flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        <Users className="h-3.5 w-3.5" />
                        Mapa inteligente
                      </div>
                      <h2 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Mapa de Pacientes</h2>
                      <p className="text-sm text-muted-foreground">
                        {filteredPatients.length} resultado{filteredPatients.length !== 1 ? 's' : ''} no filtro atual.
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/5 text-primary">
                      Clique numa ficha para abrir o histórico
                    </Badge>
                  </div>
                </div>

                {filteredPatients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Sem pacientes encontrados</h3>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Ajuste a pesquisa ou mude o filtro para ver mais fichas.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 bg-secondary/25 p-3 sm:p-4 xl:grid-cols-2">
                    {filteredPatients.map((patient) => (
                      <PatientRow
                        key={patient.id}
                        patient={patient}
                        timeline={patientTimelines.get(patient.id)}
                        onOpen={() => navigate(`/admin/pacientes/${patient.id}`)}
                        onNewAppointment={handleNewAppointment}
                      />
                    ))}
                  </div>
                )}
              </div>
            </main>
          </div>
        </section>

        <NewPatientModal open={newPatientOpen} onOpenChange={setNewPatientOpen} onPatientCreated={handlePatientCreated} />
        <AppointmentWizard open={wizardOpen} onOpenChange={setWizardOpen} preselectedPatient={selectedPatient} />
      </div>
    </div>
  );
}

function InsightPill({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-primary/10 bg-card/80 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <span className="font-mono text-lg font-semibold text-primary-dark">{value}</span>
    </div>
  );
}

function PatientMetric({ title, value, caption }: { title: string; value: number; caption: string }) {
  return (
    <div className="rounded-[1.35rem] border border-primary/10 bg-secondary/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
    </div>
  );
}

function PatientRow({
  patient,
  timeline,
  onOpen,
  onNewAppointment,
}: {
  patient: Patient;
  timeline?: PatientTimeline;
  onOpen: () => void;
  onNewAppointment: (patient: Patient, event: MouseEvent) => void;
}) {
  const totalAppointments = timeline?.all.length ?? 0;
  const completedAppointments = timeline?.all.filter((appointment) => appointment.status === 'completed').length ?? 0;
  const progress = totalAppointments > 0 ? Math.round((completedAppointments / totalAppointments) * 100) : 0;
  const statusTone = timeline?.next ? 'active' : totalAppointments > 0 ? 'reactivate' : 'new';
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };
  const status = timeline?.next ? 'Acompanhamento ativo' : totalAppointments > 0 ? 'Sem próxima consulta' : 'Novo paciente';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="group relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-primary/10 bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary-light to-transparent opacity-80" />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-sm font-bold text-primary-dark ring-4 ring-primary/5">
            {getInitials(patient.name)}
            <span
              className={cn(
                'absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card',
                statusTone === 'active' && 'bg-emerald-500',
                statusTone === 'reactivate' && 'bg-amber-500',
                statusTone === 'new' && 'bg-primary',
              )}
            >
              {statusTone === 'active' && <CheckCircle2 className="h-3 w-3 text-white" />}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{patient.name}</p>
              <Badge
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium',
                  statusTone === 'active' && 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10',
                  statusTone === 'reactivate' && 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/10',
                  statusTone === 'new' && 'bg-primary/10 text-primary hover:bg-primary/10',
                )}
              >
                {status}
              </Badge>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">NIF {patient.nif}</p>
          </div>
        </div>
        <ArrowUpRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-primary/10 bg-secondary/45 px-3">
          <Phone className="h-4 w-4 text-primary" />
          <span className="truncate">{patient.phone || 'Sem telefone'}</span>
        </div>
        <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-primary/10 bg-secondary/45 px-3">
          <Mail className="h-4 w-4 text-primary" />
          <span className="truncate">{patient.email || 'Sem email'}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <TimelineBadge icon={Clock} label="Última" value={formatDate(timeline?.last?.date)} />
        <TimelineBadge
          icon={Calendar}
          label="Próxima"
          value={timeline?.next ? `${formatDate(timeline.next.date)} · ${timeline.next.time.slice(0, 5)}` : 'Por marcar'}
          highlighted={Boolean(timeline?.next)}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Histórico</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary-gradient" style={{ width: `${Math.max(progress, totalAppointments > 0 ? 8 : 0)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {totalAppointments} consulta{totalAppointments !== 1 ? 's' : ''} connosco
          </p>
        </div>

        <div className="rounded-2xl bg-primary/10 px-3 py-2 text-left text-primary-dark sm:text-right">
          <p className="text-2xl font-semibold leading-none">{totalAppointments}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            consulta{totalAppointments !== 1 ? 's' : ''}
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={(event) => onNewAppointment(patient, event)}
          className="h-10 w-full rounded-xl border-primary/20 bg-card text-primary hover:bg-primary/10 sm:w-auto"
        >
          <Plus className="mr-1 h-4 w-4" />
          Consulta
        </Button>
      </div>
    </div>
  );
}

function TimelineBadge({
  icon: Icon,
  label,
  value,
  highlighted = false,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div className={cn('rounded-2xl border px-3 py-2', highlighted ? 'border-primary/20 bg-primary/8' : 'border-primary/10 bg-secondary/45')}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn('text-sm font-medium', highlighted ? 'text-primary-dark' : 'text-foreground')}>{value}</p>
    </div>
  );
}
