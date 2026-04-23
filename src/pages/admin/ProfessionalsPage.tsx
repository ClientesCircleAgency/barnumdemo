import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarOff,
  ChevronRight,
  Clock,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageHeader } from '@/components/admin/PageHeader';
import { ManageCollaboratorsModal } from '@/components/admin/ManageCollaboratorsModal';
import { ManageConsultationTypesModal } from '@/components/admin/ManageConsultationTypesModal';
import { useCollaborators, type Collaborator, useUpdateCollaborator } from '@/hooks/useCollaborators';
import { useConsultationTypes } from '@/hooks/useConsultationTypes';
import {
  useAddSpecialty,
  useDeleteSpecialty,
  useSpecialties,
  useUpdateSpecialty,
} from '@/hooks/useSpecialties';
import { useSetProfessionalSpecialties } from '@/hooks/useProfessionalSpecialties';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

type StaffRole = 'secretary' | 'doctor';

interface WorkingDay {
  day: string;
  start: string;
  end: string;
  enabled: boolean;
}

interface TimeOffItem {
  id: string;
  type: 'vacation' | 'day_off' | 'holiday';
  start: string;
  end: string;
  note: string;
}

interface ExtraPermissions {
  can_manage_requests: boolean;
  can_manage_messages: boolean;
  can_manage_waiting_room: boolean;
  can_manage_settings: boolean;
}

const DEFAULT_WORKING_HOURS: WorkingDay[] = [
  { day: 'Segunda', start: '09:00', end: '19:00', enabled: true },
  { day: 'Terca', start: '09:00', end: '19:00', enabled: true },
  { day: 'Quarta', start: '09:00', end: '19:00', enabled: true },
  { day: 'Quinta', start: '09:00', end: '19:00', enabled: true },
  { day: 'Sexta', start: '09:00', end: '18:00', enabled: true },
  { day: 'Sabado', start: '09:00', end: '13:00', enabled: false },
  { day: 'Domingo', start: '', end: '', enabled: false },
];

const DEFAULT_EXTRA_PERMISSIONS: ExtraPermissions = {
  can_manage_requests: true,
  can_manage_messages: true,
  can_manage_waiting_room: true,
  can_manage_settings: false,
};

const BARNUN_SUPABASE_PROJECT_REF = 'oziejxqmghwmtjufstfp';

const EXTRA_PERMISSION_LABELS: Array<{ key: keyof ExtraPermissions; label: string }> = [
  { key: 'can_manage_requests', label: 'Pedidos' },
  { key: 'can_manage_messages', label: 'Mensagens' },
  { key: 'can_manage_waiting_room', label: 'Sala de espera' },
  { key: 'can_manage_settings', label: 'Definicoes operacionais' },
];

function asWorkingHours(value: Json | null | undefined): WorkingDay[] {
  return Array.isArray(value) && value.length > 0
    ? (value as unknown as WorkingDay[])
    : DEFAULT_WORKING_HOURS;
}

function asTimeOff(value: Json | null | undefined): TimeOffItem[] {
  return Array.isArray(value) ? (value as unknown as TimeOffItem[]) : [];
}

function asExtraPermissions(value: Json | null | undefined): ExtraPermissions {
  return {
    ...DEFAULT_EXTRA_PERMISSIONS,
    ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
  };
}

function initialsFor(collaborator: Collaborator) {
  const label = collaborator.professional_name || collaborator.email;
  return label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function countEnabledDays(days: WorkingDay[]) {
  return days.filter((day) => day.enabled).length;
}

function roleLabel(role: StaffRole) {
  return role === 'doctor' ? 'Medico' : 'Secretaria';
}

export default function ProfessionalsPage() {
  const {
    data: collaborators = [],
    error: collaboratorsError,
    isError: collaboratorsLoadFailed,
    isLoading: loadingCollaborators,
    refetch,
  } = useCollaborators();
  const { data: specialties = [] } = useSpecialties();
  const { data: consultationTypes = [] } = useConsultationTypes();
  const updateCollaborator = useUpdateCollaborator();
  const setProfessionalSpecialties = useSetProfessionalSpecialties();
  const addSpecialty = useAddSpecialty();
  const updateSpecialty = useUpdateSpecialty();
  const deleteSpecialty = useDeleteSpecialty();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collaboratorsModalOpen, setCollaboratorsModalOpen] = useState(false);
  const [typesModalOpen, setTypesModalOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [editingSpecialtyId, setEditingSpecialtyId] = useState<string | null>(null);
  const [editingSpecialtyName, setEditingSpecialtyName] = useState('');

  const supabaseProjectRef = useMemo(() => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      return url ? new URL(url).hostname.split('.')[0] : null;
    } catch {
      return null;
    }
  }, []);

  const isUnexpectedSupabaseProject =
    Boolean(supabaseProjectRef) && supabaseProjectRef !== BARNUN_SUPABASE_PROJECT_REF;

  const staff = useMemo(
    () => collaborators.filter((collab) => collab.role === 'doctor' || collab.role === 'secretary'),
    [collaborators]
  );

  const selected = staff.find((collab) => collab.user_id === selectedId) || staff[0] || null;

  const [role, setRole] = useState<StaffRole>('secretary');
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [activeSpecialtyIds, setActiveSpecialtyIds] = useState<string[]>([]);
  const [activeConsultationTypeIds, setActiveConsultationTypeIds] = useState<string[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingDay[]>(DEFAULT_WORKING_HOURS);
  const [timeOff, setTimeOff] = useState<TimeOffItem[]>([]);
  const [extraPermissions, setExtraPermissions] = useState<ExtraPermissions>(DEFAULT_EXTRA_PERMISSIONS);

  useEffect(() => {
    if (!selected) return;

    setSelectedId(selected.user_id);
    setRole(selected.role as StaffRole);
    setDisplayName(selected.professional_name || selected.email.split('@')[0]);
    setColor(selected.color || selected.professional_color || '#6366f1');
    setActiveSpecialtyIds(
      selected.active_specialty_ids?.length
        ? selected.active_specialty_ids
        : selected.professional_specialty_id
          ? [selected.professional_specialty_id]
          : specialties.map((specialty) => specialty.id)
    );
    setActiveConsultationTypeIds(
      selected.active_consultation_type_ids?.length
        ? selected.active_consultation_type_ids
        : consultationTypes.map((type) => type.id)
    );
    setWorkingHours(asWorkingHours(selected.working_hours));
    setTimeOff(asTimeOff(selected.time_off));
    setExtraPermissions(asExtraPermissions(selected.extra_permissions));
  }, [selected?.user_id, specialties, consultationTypes]);

  const toggleSpecialty = (specialtyId: string) => {
    setActiveSpecialtyIds((current) => {
      const next = current.includes(specialtyId)
        ? current.filter((id) => id !== specialtyId)
        : [...current, specialtyId];

      setActiveConsultationTypeIds((typeIds) =>
        typeIds.filter((typeId) => {
          const type = consultationTypes.find((item) => item.id === typeId);
          return !type?.specialty_id || next.includes(type.specialty_id);
        })
      );

      return next;
    });
  };

  const toggleConsultationType = (typeId: string) => {
    setActiveConsultationTypeIds((current) =>
      current.includes(typeId) ? current.filter((id) => id !== typeId) : [...current, typeId]
    );
  };

  const addTimeOff = () => {
    const today = new Date().toISOString().split('T')[0];
    setTimeOff((current) => [
      ...current,
      { id: crypto.randomUUID(), type: 'day_off', start: today, end: today, note: '' },
    ]);
  };

  const saveSelected = async () => {
    if (!selected) return;
    if (role === 'doctor' && activeSpecialtyIds.length === 0) {
      toast.error('Escolha pelo menos uma especialidade para o medico.');
      return;
    }
    if (activeConsultationTypeIds.length === 0) {
      toast.error('Escolha pelo menos um tipo de consulta ativo.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateCollaborator.mutateAsync({
        user_id: selected.user_id,
        role,
        color,
        profile: {
          full_name: displayName.trim() || selected.email.split('@')[0],
          color,
          active_specialty_ids: activeSpecialtyIds,
          active_consultation_type_ids: activeConsultationTypeIds,
          working_hours: workingHours as unknown as Json,
          time_off: timeOff as unknown as Json,
          extra_permissions: extraPermissions as unknown as Json,
        },
        professional:
          role === 'doctor'
            ? {
                action: 'update',
                name: displayName.trim() || selected.email.split('@')[0],
                specialty_id: activeSpecialtyIds[0],
                color,
              }
            : selected.role === 'doctor'
              ? { action: 'unlink' }
              : null,
      });

      if (role === 'doctor' && selected.professional_id) {
        await setProfessionalSpecialties.mutateAsync({
          professionalId: selected.professional_id,
          specialtyIds: activeSpecialtyIds,
        });
      }

      toast.success('Profissional atualizado');
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao guardar profissional');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddSpecialty = async () => {
    if (!newSpecialtyName.trim()) return;
    try {
      await addSpecialty.mutateAsync({ name: newSpecialtyName.trim() });
      setNewSpecialtyName('');
      toast.success('Especialidade adicionada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar especialidade');
    }
  };

  const handleSaveSpecialty = async () => {
    if (!editingSpecialtyId || !editingSpecialtyName.trim()) return;
    try {
      await updateSpecialty.mutateAsync({ id: editingSpecialtyId, data: { name: editingSpecialtyName.trim() } });
      setEditingSpecialtyId(null);
      setEditingSpecialtyName('');
      toast.success('Especialidade atualizada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar especialidade');
    }
  };

  const handleDeleteSpecialty = async (id: string) => {
    if (!window.confirm('Remover esta especialidade?')) return;
    try {
      await deleteSpecialty.mutateAsync(id);
      toast.success('Especialidade removida');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover especialidade');
    }
  };

  const selectedName = displayName.trim() || selected?.professional_name || selected?.email.split('@')[0] || 'Sem nome';
  const primarySpecialtyName =
    specialties.find((specialty) => specialty.id === activeSpecialtyIds[0])?.name || 'Sem especialidade principal';
  const enabledWorkingDays = countEnabledDays(workingHours);
  const enabledExtraPermissions = Object.values(extraPermissions).filter(Boolean).length;

  return (
    <div className="space-y-4 pb-28 lg:space-y-6 lg:pb-0">
      <PageHeader
        title="Profissionais"
        subtitle="Uma gestao da equipa muito mais direta, visual e pensada para uso diario em formato mobile."
        badge={
          <Badge className="rounded-full border-0 bg-foreground text-[11px] font-semibold text-background shadow-sm">
            Mobile staff
          </Badge>
        }
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-11 gap-2 rounded-2xl"
              onClick={() => setTypesModalOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
              Tipos
            </Button>
            <Button
              size="sm"
              className="h-11 gap-2 rounded-2xl bg-primary-gradient hover:opacity-90"
              onClick={() => {
                setEditingCollaborator(null);
                setCollaboratorsModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Convidar
            </Button>
          </div>
        }
      />

      {selected && !collaboratorsLoadFailed && (
        <section className="overflow-hidden rounded-[2rem] border border-primary/10 bg-[radial-gradient(circle_at_top_left,rgba(191,145,54,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.84))] p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-16 w-16 border-4 border-white/80 shadow-sm">
                {(selected.photo_url || selected.professional_avatar_url) && (
                  <AvatarImage src={selected.photo_url || selected.professional_avatar_url || ''} alt={selectedName} />
                )}
                <AvatarFallback
                  className="text-base font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {initialsFor(selected)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/20 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary"
                  >
                    {roleLabel(role)}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                    {primarySpecialtyName}
                  </Badge>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{selectedName}</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">{selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Horario</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{enabledWorkingDays} dias</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Consultas</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{activeConsultationTypeIds.length} ativas</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ausencias</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{timeOff.length}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Permissoes</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{enabledExtraPermissions}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-[2rem] border border-primary/10 bg-card/95 p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Equipa</h2>
            </div>
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
              {staff.length} contas
            </Badge>
          </div>

          {isUnexpectedSupabaseProject && (
            <div className="mb-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Supabase incorreto
              </div>
              Este frontend esta ligado ao projeto {supabaseProjectRef}, mas Barnun usa {BARNUN_SUPABASE_PROJECT_REF}.
            </div>
          )}

          {loadingCollaborators ? (
            <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              A carregar...
            </div>
          ) : collaboratorsLoadFailed ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-4 text-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Nao foi possivel carregar os colaboradores.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {collaboratorsError instanceof Error ? collaboratorsError.message : 'Erro desconhecido na listagem.'}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-2 rounded-2xl" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map((collab) => {
                const photoUrl = collab.photo_url || collab.professional_avatar_url;
                const active = selected?.user_id === collab.user_id;

                return (
                  <button
                    key={collab.user_id}
                    type="button"
                    onClick={() => setSelectedId(collab.user_id)}
                    className={cn(
                      'group w-full rounded-[1.6rem] border p-3.5 text-left transition-all xl:flex xl:items-center xl:gap-3 xl:rounded-2xl',
                      active
                        ? 'border-primary/50 bg-primary/5 shadow-[0_18px_40px_-28px_rgba(191,145,54,0.75)]'
                        : 'border-border bg-background hover:border-primary/30 hover:bg-primary/[0.03]'
                    )}
                  >
                    <div className="flex items-start gap-3 xl:flex-1 xl:items-center">
                      <Avatar className="h-12 w-12 border border-border shadow-sm">
                        {photoUrl && <AvatarImage src={photoUrl} alt={collab.professional_name || collab.email} />}
                        <AvatarFallback
                          className="text-xs font-semibold text-white"
                          style={{ backgroundColor: collab.color || collab.professional_color || '#6366f1' }}
                        >
                          {initialsFor(collab)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {collab.professional_name || collab.email.split('@')[0]}
                          </p>
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform xl:hidden',
                              active && 'translate-x-0.5 text-primary'
                            )}
                          />
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{collab.email}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <Badge
                            variant={collab.role === 'doctor' ? 'outline' : 'secondary'}
                            className="rounded-full text-[11px]"
                          >
                            {collab.role === 'doctor' ? 'Medico' : 'Secretaria'}
                          </Badge>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {collab.active_consultation_type_ids?.length || 0} tipos
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {staff.length === 0 && (
                <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed px-4 text-center text-sm text-muted-foreground">
                  Nao existem contas com funcao medico ou secretaria nesta base de dados.
                </div>
              )}
            </div>
          )}
        </section>

        {selected && !collaboratorsLoadFailed ? (
          <section className="space-y-4">
            <div className="rounded-[2rem] border border-primary/10 bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Perfil e identidade</h3>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome visivel</Label>
                    <Input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      className="h-12 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['secretary', 'doctor'] as StaffRole[]).map((item) => (
                        <Button
                          key={item}
                          type="button"
                          variant={role === item ? 'default' : 'outline'}
                          onClick={() => setRole(item)}
                          className="h-12 gap-2 rounded-2xl"
                        >
                          {item === 'doctor' ? <Stethoscope className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                          {item === 'doctor' ? 'Medico' : 'Secretaria'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Cor</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        className="h-12 w-16 rounded-2xl p-1"
                      />
                      <div className="h-12 flex-1 rounded-2xl border border-border/70" style={{ backgroundColor: color }} />
                    </div>
                  </div>
                </div>

                <div className="hidden items-start gap-2 sm:flex">
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl"
                    onClick={() => {
                      setEditingCollaborator(selected);
                      setCollaboratorsModalOpen(true);
                    }}
                  >
                    Editar conta
                  </Button>
                  <Button onClick={saveSelected} disabled={savingProfile} className="h-11 gap-2 rounded-2xl">
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              <div className="rounded-[2rem] border border-primary/10 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Horario semanal</h3>
                </div>
                <div className="space-y-2">
                  {workingHours.map((day, index) => (
                    <div key={day.day} className="rounded-[1.5rem] border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{day.day}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {day.enabled ? `${day.start || '--:--'} - ${day.end || '--:--'}` : 'Folga'}
                          </p>
                        </div>
                        <Switch
                          checked={day.enabled}
                          onCheckedChange={(checked) =>
                            setWorkingHours((current) =>
                              current.map((item, i) => (i === index ? { ...item, enabled: checked } : item))
                            )
                          }
                        />
                      </div>

                      {day.enabled ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Input
                            type="time"
                            value={day.start}
                            onChange={(event) =>
                              setWorkingHours((current) =>
                                current.map((item, i) => (i === index ? { ...item, start: event.target.value } : item))
                              )
                            }
                            className="h-11 rounded-2xl"
                          />
                          <Input
                            type="time"
                            value={day.end}
                            onChange={(event) =>
                              setWorkingHours((current) =>
                                current.map((item, i) => (i === index ? { ...item, end: event.target.value } : item))
                              )
                            }
                            className="h-11 rounded-2xl"
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-primary/10 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Ferias e folgas</h3>
                  </div>
                  <Button variant="outline" size="sm" className="h-10 gap-2 rounded-2xl" onClick={addTimeOff}>
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {timeOff.length === 0 && (
                    <p className="rounded-[1.5rem] border border-dashed p-4 text-sm text-muted-foreground">
                      Sem ausencias registadas.
                    </p>
                  )}
                  {timeOff.map((item, index) => (
                    <div key={item.id} className="grid gap-2 rounded-[1.5rem] border bg-background p-3 md:grid-cols-[1fr_1fr_1.4fr_auto]">
                      <Input
                        type="date"
                        value={item.start}
                        className="h-11 rounded-2xl"
                        onChange={(event) =>
                          setTimeOff((current) =>
                            current.map((row, i) => (i === index ? { ...row, start: event.target.value } : row))
                          )
                        }
                      />
                      <Input
                        type="date"
                        value={item.end}
                        className="h-11 rounded-2xl"
                        onChange={(event) =>
                          setTimeOff((current) =>
                            current.map((row, i) => (i === index ? { ...row, end: event.target.value } : row))
                          )
                        }
                      />
                      <Input
                        value={item.note}
                        placeholder="Motivo"
                        className="h-11 rounded-2xl"
                        onChange={(event) =>
                          setTimeOff((current) =>
                            current.map((row, i) => (i === index ? { ...row, note: event.target.value } : row))
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-2xl text-destructive"
                        onClick={() => setTimeOff((current) => current.filter((row) => row.id !== item.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              <div className="rounded-[2rem] border border-primary/10 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Especialidades e tipos de consulta</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    {specialties.map((specialty) => (
                      <label key={specialty.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[1.5rem] border bg-background p-3">
                        <Checkbox checked={activeSpecialtyIds.includes(specialty.id)} onCheckedChange={() => toggleSpecialty(specialty.id)} />
                        <span className="text-sm font-medium">{specialty.name}</span>
                      </label>
                    ))}
                  </div>

                  <div className="grid gap-2">
                    {consultationTypes.map((type) => {
                      const specialtyActive = !type.specialty_id || activeSpecialtyIds.includes(type.specialty_id);
                      const active = activeConsultationTypeIds.includes(type.id);

                      return (
                        <button
                          key={type.id}
                          type="button"
                          disabled={!specialtyActive}
                          onClick={() => toggleConsultationType(type.id)}
                          className={cn(
                            'flex min-h-14 items-center gap-3 rounded-[1.5rem] border p-3 text-left text-sm transition-all',
                            active && specialtyActive ? 'border-primary/50 bg-primary/5' : 'bg-background hover:border-primary/30',
                            !specialtyActive && 'cursor-not-allowed opacity-45'
                          )}
                        >
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color || '#6366f1' }} />
                          <span className="min-w-0 flex-1 truncate">{type.name}</span>
                          <Badge variant={active && specialtyActive ? 'default' : 'secondary'}>
                            {active && specialtyActive ? 'Ativo' : 'Off'}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[2rem] border border-primary/10 bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Funcoes extra</h3>
                  </div>
                  <div className="grid gap-2">
                    {EXTRA_PERMISSION_LABELS.map((permission) => (
                      <label key={permission.key} className="flex min-h-14 cursor-pointer items-center justify-between rounded-[1.5rem] border bg-background p-3">
                        <span className="text-sm font-medium">{permission.label}</span>
                        <Switch
                          checked={extraPermissions[permission.key]}
                          onCheckedChange={(checked) =>
                            setExtraPermissions((current) => ({ ...current, [permission.key]: checked }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-primary/10 bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Especialidades globais</h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-2xl"
                      onClick={handleAddSpecialty}
                      disabled={!newSpecialtyName.trim()}
                    >
                      Adicionar
                    </Button>
                  </div>
                  <div className="mb-3 flex gap-2">
                    <Input
                      value={newSpecialtyName}
                      onChange={(event) => setNewSpecialtyName(event.target.value)}
                      placeholder="Nova especialidade"
                      className="h-11 rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    {specialties.map((specialty) => (
                      <div key={specialty.id} className="flex items-center gap-2 rounded-[1.35rem] border bg-background p-2.5">
                        {editingSpecialtyId === specialty.id ? (
                          <>
                            <Input
                              value={editingSpecialtyName}
                              onChange={(event) => setEditingSpecialtyName(event.target.value)}
                              className="h-10 rounded-2xl"
                            />
                            <Button size="sm" className="rounded-2xl" onClick={handleSaveSpecialty}>
                              Guardar
                            </Button>
                            <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => setEditingSpecialtyId(null)}>
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-medium">{specialty.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-2xl"
                              onClick={() => {
                                setEditingSpecialtyId(specialty.id);
                                setEditingSpecialtyName(specialty.name);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-2xl text-destructive"
                              onClick={() => handleDeleteSpecialty(specialty.id)}
                            >
                              Remover
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-[2rem] border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Ainda nao existem medicos ou secretarias.
          </div>
        )}
      </div>

      {selected && !collaboratorsLoadFailed && (
        <div className="fixed inset-x-0 bottom-20 z-30 px-4 sm:hidden">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-[1.8rem] border border-primary/10 bg-background/95 p-2 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.65)] backdrop-blur">
            <Button
              variant="outline"
              className="h-12 flex-1 rounded-2xl"
              onClick={() => {
                setEditingCollaborator(selected);
                setCollaboratorsModalOpen(true);
              }}
            >
              Editar conta
            </Button>
            <Button
              onClick={saveSelected}
              disabled={savingProfile}
              className="h-12 flex-[1.25] gap-2 rounded-2xl bg-primary-gradient hover:opacity-90"
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </div>
      )}

      <ManageCollaboratorsModal
        open={collaboratorsModalOpen}
        onOpenChange={(open) => {
          setCollaboratorsModalOpen(open);
          if (!open) setEditingCollaborator(null);
        }}
        editTarget={editingCollaborator}
        onSuccess={() => refetch()}
      />
      <ManageConsultationTypesModal open={typesModalOpen} onOpenChange={setTypesModalOpen} />
    </div>
  );
}
