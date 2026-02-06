import { useState } from 'react';
import { Clock, Users, Settings2, Tag, Plus, MoreHorizontal, Save, SlidersHorizontal, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClinic } from '@/context/ClinicContext';
import { useAuth } from '@/hooks/useAuth';
import { EditHoursModal } from '@/components/admin/EditHoursModal';
import { EditSettingsModal } from '@/components/admin/EditSettingsModal';
import { ManageProfessionalsModal } from '@/components/admin/ManageProfessionalsModal';
import { ManageConsultationTypesModal } from '@/components/admin/ManageConsultationTypesModal';
import { PageHeader } from '@/components/admin/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function SettingsPage() {
  const { professionals, consultationTypes } = useClinic();
  const { toast } = useToast();
  const { isAdmin, userRole } = useAuth();

  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [professionalsModalOpen, setProfessionalsModalOpen] = useState(false);
  const [typesModalOpen, setTypesModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'doctor' | 'secretary'>('doctor');
  const [inviteLoading, setInviteLoading] = useState(false);

  const [workingHours, setWorkingHours] = useState([
    { day: 'Segunda', start: '09:00', end: '19:00', enabled: true },
    { day: 'Terça', start: '09:00', end: '19:00', enabled: true },
    { day: 'Quarta', start: '09:00', end: '19:00', enabled: true },
    { day: 'Quinta', start: '09:00', end: '19:00', enabled: true },
    { day: 'Sexta', start: '09:00', end: '18:00', enabled: true },
    { day: 'Sábado', start: '09:00', end: '13:00', enabled: true },
    { day: 'Domingo', start: '', end: '', enabled: false },
  ]);

  const [generalSettings, setGeneralSettings] = useState({
    defaultDuration: 30,
    bufferTime: 5,
    minAdvanceTime: 2,
    averageConsultationValue: 50,
  });

  const [rules, setRules] = useState({
    preventOverlap: true,
    smsReminders: true,
    suggestNextSlot: false,
  });

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!inviteEmail) {
      toast({
        title: 'Email obrigatório',
        description: 'Insira um email válido para convidar.',
        variant: 'destructive'
      });
      return;
    }

    setInviteLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('Sessão inválida. Faça login novamente.');
      }

      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole
        })
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Falha ao convidar utilizador.');
      }

      toast({
        title: 'Convite enviado',
        description: `Convite criado para ${inviteEmail} (${inviteRole}).`
      });

      setInviteEmail('');
    } catch (error) {
      toast({
        title: 'Erro ao convidar',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
        variant: 'destructive'
      });
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Definições"
        subtitle="Gerencie horários e equipa"
        actions={
          <Button size="sm" className="gap-2 bg-primary-gradient hover:opacity-90">
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Guardar</span>
          </Button>
        }
      />

      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          {/* Horário de Funcionamento */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 lg:p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm lg:text-base text-foreground pt-1">Horário</h3>
              </div>
              <div className="space-y-2.5">
                {workingHours.slice(0, 3).map((schedule) => (
                  <div key={schedule.day} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={schedule.enabled} 
                        onCheckedChange={(checked) => {
                          setWorkingHours(prev => prev.map(h => 
                            h.day === schedule.day ? { ...h, enabled: checked } : h
                          ));
                        }}
                        className="data-[state=checked]:bg-primary scale-90"
                      />
                      <span className={`text-sm ${schedule.enabled ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                        {schedule.day.slice(0, 3)}
                      </span>
                    </div>
                    {schedule.enabled ? (
                      <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        {schedule.start}-{schedule.end}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Fechado</span>
                    )}
                  </div>
                ))}
              </div>
              <Button 
                variant="link" 
                size="sm"
                className="mt-3 p-0 h-auto text-primary text-xs"
                onClick={() => setHoursModalOpen(true)}
              >
                Ver tudo
              </Button>
            </div>
          </div>

          {/* Regras Automáticas */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 lg:p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-sm lg:text-base text-foreground pt-1">Regras</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-foreground">Evitar sobreposição</span>
                  <Switch 
                    checked={rules.preventOverlap} 
                    onCheckedChange={(checked) => setRules(prev => ({ ...prev, preventOverlap: checked }))}
                    className="data-[state=checked]:bg-primary scale-90"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-foreground">Lembretes SMS</span>
                  <Switch 
                    checked={rules.smsReminders} 
                    onCheckedChange={(checked) => setRules(prev => ({ ...prev, smsReminders: checked }))}
                    className="data-[state=checked]:bg-primary scale-90"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs lg:text-sm text-foreground">Sugerir vaga</span>
                  <Switch 
                    checked={rules.suggestNextSlot} 
                    onCheckedChange={(checked) => setRules(prev => ({ ...prev, suggestNextSlot: checked }))}
                    className="data-[state=checked]:bg-primary scale-90"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          {/* Equipa Médica */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 lg:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-sm lg:text-base text-foreground">Equipa</h3>
                </div>
                <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setProfessionalsModalOpen(true)}>
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline">Novo</span>
                </Button>
              </div>
              <div className="space-y-2">
                {professionals.map((prof) => (
                  <div key={prof.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                        style={{ backgroundColor: prof.color }}
                      >
                        {prof.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{prof.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {prof.specialty}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gestão de Utilizadores - Admin Only */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 lg:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 lg:h-5 lg:w-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-sm lg:text-base text-foreground">Utilizadores</h3>
                </div>
                {!isAdmin && (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
              </div>
              {!isAdmin ? (
                <Alert>
                  <AlertDescription className="text-xs">
                    Apenas administradores podem convidar novos utilizadores.
                  </AlertDescription>
                </Alert>
              ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="utilizador@clinica.pt"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    disabled={inviteLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as 'doctor' | 'secretary')}
                  >
                    <SelectTrigger id="invite-role" className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Médico</SelectItem>
                      <SelectItem value="secretary">Secretária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={inviteLoading || !inviteEmail}>
                  {inviteLoading ? 'A enviar convite...' : 'Convidar utilizador'}
                </Button>
              </form>
              )}
            </div>
          </div>

          {/* Tipos de Consulta - Admin Only */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 lg:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                    <Tag className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm lg:text-base text-foreground">Tipos</h3>
                    {!isAdmin && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setTypesModalOpen(true)}>
                    <Plus className="h-3 w-3" />
                    <span className="hidden sm:inline">Novo</span>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {consultationTypes.map((type) => (
                  <div key={type.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                    <span className="text-xs lg:text-sm font-medium text-foreground truncate">{type.name}</span>
                    <span className="text-xs text-primary font-medium shrink-0 ml-2">{type.defaultDuration}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Parâmetros Gerais */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 lg:p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Settings2 className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm lg:text-base text-foreground pt-1">Parâmetros</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs lg:text-sm text-muted-foreground">Duração</label>
                  <Select 
                    value={String(generalSettings.defaultDuration)} 
                    onValueChange={(v) => setGeneralSettings(prev => ({ ...prev, defaultDuration: Number(v) }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs lg:text-sm text-muted-foreground">Buffer</label>
                  <Select 
                    value={String(generalSettings.bufferTime)} 
                    onValueChange={(v) => setGeneralSettings(prev => ({ ...prev, bufferTime: Number(v) }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 min</SelectItem>
                      <SelectItem value="5">5 min</SelectItem>
                      <SelectItem value="10">10 min</SelectItem>
                      <SelectItem value="15">15 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs lg:text-sm text-muted-foreground">Antecedência</label>
                  <Select 
                    value={String(generalSettings.minAdvanceTime)} 
                    onValueChange={(v) => setGeneralSettings(prev => ({ ...prev, minAdvanceTime: Number(v) }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1h</SelectItem>
                      <SelectItem value="2">2h</SelectItem>
                      <SelectItem value="4">4h</SelectItem>
                      <SelectItem value="24">24h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditHoursModal open={hoursModalOpen} onOpenChange={setHoursModalOpen} initialHours={workingHours} onSave={setWorkingHours} />
      <EditSettingsModal open={settingsModalOpen} onOpenChange={setSettingsModalOpen} initialSettings={generalSettings} onSave={setGeneralSettings} />
      <ManageProfessionalsModal open={professionalsModalOpen} onOpenChange={setProfessionalsModalOpen} />
      <ManageConsultationTypesModal open={typesModalOpen} onOpenChange={setTypesModalOpen} />
    </div>
  );
}
