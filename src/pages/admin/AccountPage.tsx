import { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Lock,
  Palette,
  Save,
  Loader2,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Stethoscope,
  ClipboardList,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/admin/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSpecialties } from '@/hooks/useSpecialties';
import { useConsultationTypes } from '@/hooks/useConsultationTypes';
import { useProfessionalSpecialties } from '@/hooks/useProfessionalSpecialties';

export default function AccountPage() {
  const { user, userRole } = useAuth();
  const { data: specialties = [], isLoading: loadingSpecialties } = useSpecialties();
  const { data: consultationTypes = [], isLoading: loadingConsultationTypes } = useConsultationTypes();
  const { data: professionalSpecialties = [] } = useProfessionalSpecialties();

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<string[]>([]);
  const [selectedConsultationTypeIds, setSelectedConsultationTypeIds] = useState<string[]>([]);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Loading states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  // Load current data
  useEffect(() => {
    if (!user) return;
    setEmail(user.email || '');

    // Load profile name
    supabase
      .from('user_profiles')
      .select('full_name, color, active_specialty_ids, active_consultation_type_ids')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setFullName(data.full_name);
        if (data?.color) setColor(data.color);
        setSelectedSpecialtyIds(data?.active_specialty_ids || []);
        setSelectedConsultationTypeIds(data?.active_consultation_type_ids || []);
        setAvailabilityLoaded(true);
      });

    // Load professional color (for doctors)
    supabase
      .from('professionals')
      .select('id, color')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfessionalId(data.id);
          setColor(data.color || '#6366f1');
        }
      });
  }, [user]);

  useEffect(() => {
    if (!availabilityLoaded || specialties.length === 0 || consultationTypes.length === 0) return;

    const currentSpecialtyIds = selectedSpecialtyIds.length > 0
      ? selectedSpecialtyIds
      : professionalId
        ? professionalSpecialties
            .filter((row) => row.professional_id === professionalId)
            .map((row) => row.specialty_id)
        : specialties.map((specialty) => specialty.id);

    const nextSpecialtyIds = currentSpecialtyIds.length > 0
      ? currentSpecialtyIds
      : specialties.map((specialty) => specialty.id);

    if (selectedSpecialtyIds.length === 0) {
      setSelectedSpecialtyIds(nextSpecialtyIds);
    }

    if (selectedConsultationTypeIds.length === 0) {
      setSelectedConsultationTypeIds(
        consultationTypes
          .filter((type) => !type.specialty_id || nextSpecialtyIds.includes(type.specialty_id))
          .map((type) => type.id)
      );
    }
  }, [
    availabilityLoaded,
    consultationTypes,
    professionalId,
    professionalSpecialties,
    selectedConsultationTypeIds,
    selectedSpecialtyIds,
    specialties,
  ]);

  const handleSaveName = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ user_id: user.id, full_name: fullName.trim() }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Nome atualizado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar nome');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email inválido');
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success('Email de confirmação enviado para o novo endereço');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar email');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('A password deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As passwords não coincidem');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password atualizada com sucesso');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveColor = async () => {
    if (!professionalId) return;
    setSavingColor(true);
    try {
      const { error: professionalError } = await supabase
        .from('professionals')
        .update({ color })
        .eq('id', professionalId);

      if (professionalError) throw professionalError;

      if (user?.id) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({ user_id: user.id, color }, { onConflict: 'user_id' });

        if (profileError) throw profileError;
      }

      toast.success('Cor atualizada');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar cor');
    } finally {
      setSavingColor(false);
    }
  };

  const toggleSpecialty = (specialtyId: string) => {
    setSelectedSpecialtyIds((current) => {
      const isActive = current.includes(specialtyId);
      const next = isActive
        ? current.filter((id) => id !== specialtyId)
        : [...current, specialtyId];

      if (isActive) {
        setSelectedConsultationTypeIds((typeIds) =>
          typeIds.filter((typeId) => {
            const type = consultationTypes.find((item) => item.id === typeId);
            return type?.specialty_id !== specialtyId;
          })
        );
      }

      return next;
    });
  };

  const toggleConsultationType = (typeId: string) => {
    setSelectedConsultationTypeIds((current) =>
      current.includes(typeId)
        ? current.filter((id) => id !== typeId)
        : [...current, typeId]
    );
  };

  const handleSelectAllServices = () => {
    const specialtyIds = specialties.map((specialty) => specialty.id);
    setSelectedSpecialtyIds(specialtyIds);
    setSelectedConsultationTypeIds(consultationTypes.map((type) => type.id));
  };

  const handleSaveAvailability = async () => {
    if (!user) return;
    if (selectedSpecialtyIds.length === 0) {
      toast.error('Escolha pelo menos uma especialidade ativa.');
      return;
    }
    if (selectedConsultationTypeIds.length === 0) {
      toast.error('Escolha pelo menos um tipo de consulta ativo.');
      return;
    }

    setSavingAvailability(true);
    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          full_name: fullName.trim() || user.email || 'Utilizador',
          color,
          active_specialty_ids: selectedSpecialtyIds,
          active_consultation_type_ids: selectedConsultationTypeIds,
        }, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      if (professionalId) {
        const { error: deleteError } = await supabase
          .from('professional_specialties')
          .delete()
          .eq('professional_id', professionalId);

        if (deleteError) throw deleteError;

        const rows = selectedSpecialtyIds.map((specialtyId) => ({
          professional_id: professionalId,
          specialty_id: specialtyId,
        }));

        const { error: insertError } = await supabase
          .from('professional_specialties')
          .insert(rows);

        if (insertError) throw insertError;
      }

      toast.success('Preferências atualizadas');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar preferências');
    } finally {
      setSavingAvailability(false);
    }
  };

  const selectedTypeCount = selectedConsultationTypeIds.length;
  const serviceOptionsLoading = loadingSpecialties || loadingConsultationTypes || !availabilityLoaded;

  const roleLabelMap: Record<string, string> = {
    admin: 'Administrador',
    secretary: 'Secretária',
    doctor: 'Médico',
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Minha Conta"
        subtitle="Gerir dados pessoais e segurança"
      />

      <div className="max-w-5xl space-y-4">
        {/* Role badge */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">{roleLabelMap[userRole || ''] || 'Sem role'}</p>
            </div>
          </div>
        </div>

        {/* Service preferences */}
        <div className="relative overflow-hidden bg-card border border-border rounded-2xl p-4 lg:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-400 to-sky-400" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Serviços ativos para mim</h3>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Escolha as especialidades e tipos de consulta onde quer aparecer ativo. Nos médicos,
                as especialidades também controlam a disponibilidade para marcações e sugestões.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">
                {selectedSpecialtyIds.length}/{specialties.length} especialidades
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {selectedTypeCount}/{consultationTypes.length} tipos
              </Badge>
            </div>
          </div>

          {serviceOptionsLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              A carregar preferências...
            </div>
          ) : (
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Especialidades</Label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {specialties.map((specialty) => {
                    const active = selectedSpecialtyIds.includes(specialty.id);
                    return (
                      <div
                        key={specialty.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSpecialty(specialty.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleSpecialty(specialty.id);
                          }
                        }}
                        className={cn(
                          'group flex items-center justify-between rounded-xl border p-4 text-left transition-all',
                          active
                            ? 'border-primary/50 bg-primary/5 shadow-sm'
                            : 'border-border bg-background hover:border-primary/30 hover:bg-muted/40'
                        )}
                      >
                        <div>
                          <p className="font-medium text-foreground">{specialty.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {active ? 'Ativa no meu perfil' : 'Inativa para mim'}
                          </p>
                        </div>
                        <Switch
                          checked={active}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={() => toggleSpecialty(specialty.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Tipos de consulta</Label>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={handleSelectAllServices}>
                    Ativar tudo
                  </Button>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {consultationTypes.map((type) => {
                    const specialtyActive = !type.specialty_id || selectedSpecialtyIds.includes(type.specialty_id);
                    const active = selectedConsultationTypeIds.includes(type.id);
                    const specialtyName = specialties.find((specialty) => specialty.id === type.specialty_id)?.name;

                    return (
                      <button
                        key={type.id}
                        type="button"
                        disabled={!specialtyActive}
                        onClick={() => toggleConsultationType(type.id)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                          active && specialtyActive
                            ? 'border-emerald-400/60 bg-emerald-50'
                            : 'border-border bg-background hover:bg-muted/40',
                          !specialtyActive && 'cursor-not-allowed opacity-45'
                        )}
                      >
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: type.color || '#10b981' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{type.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {specialtyName || 'Sem especialidade'} · {type.default_duration} min
                          </p>
                        </div>
                        {active && specialtyActive && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Dica: desligar uma especialidade também remove os tipos de consulta dessa área.
                </p>
                <Button
                  size="sm"
                  onClick={handleSaveAvailability}
                  disabled={savingAvailability}
                  className="gap-2"
                >
                  {savingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar serviços
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Name */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5 max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Nome</h3>
          </div>
          <div className="flex gap-2">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="O seu nome completo"
              className="flex-1"
            />
            <Button size="sm" onClick={handleSaveName} disabled={savingProfile || !fullName.trim()}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Email */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5 max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Email</h3>
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.pt"
              className="flex-1"
            />
            <Button size="sm" onClick={handleSaveEmail} disabled={savingEmail || email === user?.email}>
              {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Será enviado um email de confirmação para o novo endereço.
          </p>
        </div>

        {/* Password */}
        <div className="bg-card border border-border rounded-xl p-4 lg:p-5 max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Alterar Password</h3>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova password"
            />
            <Button
              size="sm"
              onClick={handleSavePassword}
              disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
              className="w-full"
            >
              {savingPassword ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />A guardar...</>
              ) : (
                'Atualizar password'
              )}
            </Button>
          </div>
        </div>

        {/* Color — only if user has a linked professional (doctors) */}
        {professionalId && (
          <div className="bg-card border border-border rounded-xl p-4 lg:p-5 max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Cor na Agenda</h3>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <div
                className="h-9 flex-1 rounded-lg border border-border"
                style={{ backgroundColor: color }}
              />
              <Button size="sm" onClick={handleSaveColor} disabled={savingColor}>
                {savingColor ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Esta cor é usada para identificar as suas consultas na agenda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
