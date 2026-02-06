import { useState, useEffect } from 'react';
import { Clock, Users, Settings2, Tag, Plus, Save, SlidersHorizontal, ShieldAlert, UserCircle, Stethoscope, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClinic } from '@/context/ClinicContext';
import { useAuth } from '@/hooks/useAuth';
import { useCollaborators, Collaborator } from '@/hooks/useCollaborators';
import { useSettings, useUpdateSetting } from '@/hooks/useSettings';
import { EditHoursModal } from '@/components/admin/EditHoursModal';
import { EditSettingsModal } from '@/components/admin/EditSettingsModal';
import { ManageCollaboratorsModal } from '@/components/admin/ManageCollaboratorsModal';
import { ManageConsultationTypesModal } from '@/components/admin/ManageConsultationTypesModal';
import { PageHeader } from '@/components/admin/PageHeader';
import { toast } from 'sonner';

const DEFAULT_HOURS = [
  { day: 'Segunda', start: '09:00', end: '19:00', enabled: true },
  { day: 'Terça', start: '09:00', end: '19:00', enabled: true },
  { day: 'Quarta', start: '09:00', end: '19:00', enabled: true },
  { day: 'Quinta', start: '09:00', end: '19:00', enabled: true },
  { day: 'Sexta', start: '09:00', end: '18:00', enabled: true },
  { day: 'Sábado', start: '09:00', end: '13:00', enabled: true },
  { day: 'Domingo', start: '', end: '', enabled: false },
];

const DEFAULT_SETTINGS = {
  defaultDuration: 30,
  bufferTime: 5,
  minAdvanceTime: 2,
  averageConsultationValue: 50,
};

const DEFAULT_RULES = {
  preventOverlap: true,
  smsReminders: true,
  suggestNextSlot: false,
};

export default function SettingsPage() {
  // #region agent log
  console.error('[DBG-H3] SettingsPage MOUNT — component started rendering');
  fetch('http://127.0.0.1:7242/ingest/db4a717c-c15f-476b-beb5-b5461f60195e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SettingsPage.tsx:mount',message:'SettingsPage MOUNT',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion

  const { consultationTypes } = useClinic();
  const { isAdmin, userRole } = useAuth();
  const { data: collaborators = [], isLoading: loadingCollaborators, refetch: refetchCollaborators } = useCollaborators();
  const { data: dbSettings = {} } = useSettings();
  const updateSetting = useUpdateSetting();

  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [collaboratorsModalOpen, setCollaboratorsModalOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [typesModalOpen, setTypesModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [workingHours, setWorkingHours] = useState(DEFAULT_HOURS);
  const [generalSettings, setGeneralSettings] = useState(DEFAULT_SETTINGS);
  const [rules, setRules] = useState(DEFAULT_RULES);

  // #region agent log
  console.error('[DBG-H5] SettingsPage dbSettings shape:', JSON.stringify(dbSettings).slice(0, 200));
  console.error('[DBG-H5] SettingsPage generalSettings:', JSON.stringify(generalSettings));
  // #endregion

  // Load settings from DB on mount — with shape validation
  useEffect(() => {
    if (dbSettings.working_hours) {
      try {
        const wh = dbSettings.working_hours;
        // DB may have saved as object {Monday:{...}} instead of array [{day:'Segunda',...}]
        // Only use if it's actually an array with the expected shape
        if (Array.isArray(wh) && wh.length > 0 && typeof wh[0]?.day === 'string') {
          setWorkingHours(wh as typeof DEFAULT_HOURS);
        } else {
          // #region agent log
          console.error('[DBG-FIX] working_hours from DB is NOT a valid array, keeping defaults. Got:', typeof wh, Array.isArray(wh));
          // #endregion
        }
      } catch { /* keep defaults */ }
    }
    if (dbSettings.general_settings) {
      try {
        const gs = dbSettings.general_settings;
        if (gs && typeof gs === 'object' && !Array.isArray(gs) && 'bufferTime' in (gs as any)) {
          setGeneralSettings(gs as typeof DEFAULT_SETTINGS);
        } else {
          // #region agent log
          console.error('[DBG-FIX] general_settings from DB has unexpected shape, keeping defaults');
          // #endregion
        }
      } catch { /* keep defaults */ }
    }
    if (dbSettings.rules) {
      try {
        const r = dbSettings.rules;
        if (r && typeof r === 'object' && !Array.isArray(r) && 'preventOverlap' in (r as any)) {
          setRules(r as typeof DEFAULT_RULES);
        } else {
          // #region agent log
          console.error('[DBG-FIX] rules from DB has unexpected shape, keeping defaults');
          // #endregion
        }
      } catch { /* keep defaults */ }
    }
  }, [dbSettings]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: 'working_hours', value: workingHours as any }),
        updateSetting.mutateAsync({ key: 'general_settings', value: generalSettings as any }),
        updateSetting.mutateAsync({ key: 'rules', value: rules as any }),
      ]);
      toast.success('Definições guardadas com sucesso');
    } catch {
      toast.error('Erro ao guardar definições');
    } finally {
      setIsSaving(false);
    }
  };


  // #region agent log
  console.error('[DBG-H3] SettingsPage RENDER — reached return statement successfully');
  fetch('http://127.0.0.1:7242/ingest/db4a717c-c15f-476b-beb5-b5461f60195e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SettingsPage.tsx:render',message:'SettingsPage RENDER reached return',data:{consultationTypesCount:consultationTypes?.length,collaboratorsCount:collaborators?.length,isAdmin,userRole},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Definições"
        subtitle="Gerencie horários e equipa"
        actions={
          <Button 
            size="sm" 
            className="gap-2 bg-primary-gradient hover:opacity-90"
            onClick={handleSaveAll}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{isSaving ? 'A guardar...' : 'Guardar'}</span>
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
          {/* Colaboradores - Admin Only */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 lg:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 lg:h-5 lg:w-5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-sm lg:text-base text-foreground">Colaboradores</h3>
                </div>
                {!isAdmin ? (
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Admin
                  </Badge>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 h-7 text-xs" 
                    onClick={() => setCollaboratorsModalOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    <span>Convidar</span>
                  </Button>
                )}
              </div>
              
              {loadingCollaborators ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : collaborators.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum colaborador criado ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {collaborators.map((collab) => {
                    const isSecretary = collab.role === 'secretary';
                    const isDoctor = collab.role === 'doctor';
                    const isAdminUser = collab.role === 'admin';

                    const initials = collab.professional_name
                      ? collab.professional_name.split(' ').map((n) => n[0]).join('').slice(0, 2)
                      : collab.email.substring(0, 2).toUpperCase();

                    const displayName = collab.professional_name || collab.email.split('@')[0];
                    const displaySubtitle = isSecretary 
                      ? 'Secretária' 
                      : isAdminUser
                      ? 'Administrador'
                      : collab.professional_specialty || 'Médico';

                    const bgColor = collab.professional_color || (isSecretary ? '#10b981' : isAdminUser ? '#8b5cf6' : '#6366f1');

                    return (
                      <div key={collab.user_id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                            style={{ backgroundColor: bgColor }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {displaySubtitle}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isAdminUser && (
                            <Badge variant="default" className="text-xs">Admin</Badge>
                          )}
                          {isSecretary && (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <UserCircle className="h-3 w-3" />
                              Secretária
                            </Badge>
                          )}
                          {isDoctor && (
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                              <Stethoscope className="h-3 w-3" />
                              Médico
                            </Badge>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingCollaborator(collab);
                                setCollaboratorsModalOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  <h3 className="font-semibold text-sm lg:text-base text-foreground">Tipos</h3>
                </div>
                {(isAdmin || userRole === 'secretary') && (
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setTypesModalOpen(true)}>
                    <Plus className="h-3 w-3" />
                    <span>Novo</span>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {consultationTypes.map((type) => (
                  <div key={type.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: type.color || '#6366f1' }}
                    />
                    <span className="text-xs lg:text-sm font-medium text-foreground truncate">{type.name}</span>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      <ManageCollaboratorsModal 
        open={collaboratorsModalOpen} 
        onOpenChange={(val) => {
          setCollaboratorsModalOpen(val);
          if (!val) setEditingCollaborator(null);
        }}
        onSuccess={() => refetchCollaborators()}
        editTarget={editingCollaborator}
      />
      <ManageConsultationTypesModal open={typesModalOpen} onOpenChange={setTypesModalOpen} />
    </div>
  );
}
