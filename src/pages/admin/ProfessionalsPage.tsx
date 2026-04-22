import { useEffect, useMemo, useState } from 'react';
import {
  CalendarOff,
  Clock,
  AlertTriangle,
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
  { day: 'Terça', start: '09:00', end: '19:00', enabled: true },
  { day: 'Quarta', start: '09:00', end: '19:00', enabled: true },
  { day: 'Quinta', start: '09:00', end: '19:00', enabled: true },
  { day: 'Sexta', start: '09:00', end: '18:00', enabled: true },
  { day: 'Sábado', start: '09:00', end: '13:00', enabled: false },
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
  { key: 'can_manage_settings', label: 'Definições operacionais' },
];

function asWorkingHours(value: Json | null | undefined): WorkingDay[] {
  return Array.isArray(value) && value.length > 0
    ? value as unknown as WorkingDay[]
    : DEFAULT_WORKING_HOURS;
}

function asTimeOff(value: Json | null | undefined): TimeOffItem[] {
  return Array.isArray(value) ? value as unknown as TimeOffItem[] : [];
}

function asExtraPermissions(value: Json | null | undefined): ExtraPermissions {
  return { ...DEFAULT_EXTRA_PERMISSIONS, ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}) };
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
      current.includes(typeId)
        ? current.filter((id) => id !== typeId)
        : [...current, typeId]
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
      toast.error('Escolha pelo menos uma especialidade para o médico.');
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
        professional: role === 'doctor'
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

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Profissionais"
        subtitle="Gerir médicos, secretárias, serviços, horários e ausências"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setTypesModalOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Tipos
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-primary-gradient hover:opacity-90"
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

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-primary/10 bg-card p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-1">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Equipa</h2>
          </div>

          {isUnexpectedSupabaseProject && (
            <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Supabase incorreto
              </div>
              Este frontend está ligado ao projeto {supabaseProjectRef}, mas Barnun usa {BARNUN_SUPABASE_PROJECT_REF}.
            </div>
          )}

          {loadingCollaborators ? (
            <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              A carregar...
            </div>
          ) : collaboratorsLoadFailed ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-4 text-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Não foi possível carregar os colaboradores.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {collaboratorsError instanceof Error ? collaboratorsError.message : 'Erro desconhecido na listagem.'}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
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
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                      active ? 'border-primary/50 bg-primary/5' : 'border-border bg-background hover:border-primary/30'
                    )}
                  >
                    <Avatar className="h-10 w-10 border border-border">
                      {photoUrl && <AvatarImage src={photoUrl} alt={collab.professional_name || collab.email} />}
                      <AvatarFallback
                        className="text-xs font-semibold text-white"
                        style={{ backgroundColor: collab.color || collab.professional_color || '#6366f1' }}
                      >
                        {initialsFor(collab)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {collab.professional_name || collab.email.split('@')[0]}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{collab.email}</p>
                    </div>
                    <Badge variant={collab.role === 'doctor' ? 'outline' : 'secondary'} className="text-xs">
                      {collab.role === 'doctor' ? 'Médico' : 'Secretária'}
                    </Badge>
                  </button>
                );
              })}
              {staff.length === 0 && (
                <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                  Não existem contas com função médico ou secretária nesta base de dados.
                </div>
              )}
            </div>
          )}
        </section>

        {selected && !collaboratorsLoadFailed ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome visível</Label>
                    <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
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
                          className="gap-2"
                        >
                          {item === 'doctor' ? <Stethoscope className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                          {item === 'doctor' ? 'Médico' : 'Secretária'}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cor</Label>
                    <div className="flex items-center gap-3">
                      <Input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-14 p-1" />
                      <div className="h-10 flex-1 rounded-lg border" style={{ backgroundColor: color }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingCollaborator(selected);
                      setCollaboratorsModalOpen(true);
                    }}
                  >
                    Editar conta
                  </Button>
                  <Button onClick={saveSelected} disabled={savingProfile} className="gap-2">
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Horários</h3>
                </div>
                <div className="space-y-2">
                  {workingHours.map((day, index) => (
                    <div key={day.day} className="flex items-center gap-3 rounded-xl border bg-background p-3">
                      <Switch
                        checked={day.enabled}
                        onCheckedChange={(checked) =>
                          setWorkingHours((current) => current.map((item, i) => i === index ? { ...item, enabled: checked } : item))
                        }
                      />
                      <span className="w-20 text-sm font-medium">{day.day}</span>
                      {day.enabled ? (
                        <div className="flex flex-1 items-center gap-2">
                          <Input
                            type="time"
                            value={day.start}
                            onChange={(event) =>
                              setWorkingHours((current) => current.map((item, i) => i === index ? { ...item, start: event.target.value } : item))
                            }
                            className="h-9"
                          />
                          <Input
                            type="time"
                            value={day.end}
                            onChange={(event) =>
                              setWorkingHours((current) => current.map((item, i) => i === index ? { ...item, end: event.target.value } : item))
                            }
                            className="h-9"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Folga</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Férias e folgas</h3>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={addTimeOff}>
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {timeOff.length === 0 && (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Sem ausências registadas.</p>
                  )}
                  {timeOff.map((item, index) => (
                    <div key={item.id} className="grid gap-2 rounded-xl border bg-background p-3 md:grid-cols-[1fr_1fr_1.4fr_auto]">
                      <Input
                        type="date"
                        value={item.start}
                        onChange={(event) => setTimeOff((current) => current.map((row, i) => i === index ? { ...row, start: event.target.value } : row))}
                      />
                      <Input
                        type="date"
                        value={item.end}
                        onChange={(event) => setTimeOff((current) => current.map((row, i) => i === index ? { ...row, end: event.target.value } : row))}
                      />
                      <Input
                        value={item.note}
                        placeholder="Motivo"
                        onChange={(event) => setTimeOff((current) => current.map((row, i) => i === index ? { ...row, note: event.target.value } : row))}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setTimeOff((current) => current.filter((row) => row.id !== item.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Especialidades e tipos de consulta</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    {specialties.map((specialty) => (
                      <label key={specialty.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-background p-3">
                        <Checkbox checked={activeSpecialtyIds.includes(specialty.id)} onCheckedChange={() => toggleSpecialty(specialty.id)} />
                        <span className="text-sm font-medium">{specialty.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
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
                            'flex min-h-12 items-center gap-3 rounded-xl border p-3 text-left text-sm transition-all',
                            active && specialtyActive ? 'border-primary/50 bg-primary/5' : 'bg-background hover:border-primary/30',
                            !specialtyActive && 'cursor-not-allowed opacity-45'
                          )}
                        >
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color || '#6366f1' }} />
                          <span className="min-w-0 flex-1 truncate">{type.name}</span>
                          <Badge variant={active && specialtyActive ? 'default' : 'secondary'}>{active && specialtyActive ? 'Ativo' : 'Off'}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Funções extra</h3>
                  </div>
                  <div className="grid gap-2">
                    {EXTRA_PERMISSION_LABELS.map((permission) => (
                      <label key={permission.key} className="flex cursor-pointer items-center justify-between rounded-xl border bg-background p-3">
                        <span className="text-sm font-medium">{permission.label}</span>
                        <Switch
                          checked={extraPermissions[permission.key]}
                          onCheckedChange={(checked) => setExtraPermissions((current) => ({ ...current, [permission.key]: checked }))}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Especialidades globais</h3>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleAddSpecialty} disabled={!newSpecialtyName.trim()}>
                      Adicionar
                    </Button>
                  </div>
                  <div className="mb-3 flex gap-2">
                    <Input value={newSpecialtyName} onChange={(event) => setNewSpecialtyName(event.target.value)} placeholder="Nova especialidade" />
                  </div>
                  <div className="space-y-2">
                    {specialties.map((specialty) => (
                      <div key={specialty.id} className="flex items-center gap-2 rounded-xl border bg-background p-2">
                        {editingSpecialtyId === specialty.id ? (
                          <>
                            <Input value={editingSpecialtyName} onChange={(event) => setEditingSpecialtyName(event.target.value)} />
                            <Button size="sm" onClick={handleSaveSpecialty}>Guardar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingSpecialtyId(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-medium">{specialty.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingSpecialtyId(specialty.id);
                                setEditingSpecialtyName(specialty.name);
                              }}
                            >
                              Editar
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteSpecialty(specialty.id)}>
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
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            Ainda não existem médicos ou secretárias.
          </div>
        )}
      </div>

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
