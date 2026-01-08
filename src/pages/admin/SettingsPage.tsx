import { useState } from 'react';
import { Clock, Users, Settings2, Tag, Plus, MoreHorizontal, Save, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClinic } from '@/context/ClinicContext';
import { EditHoursModal } from '@/components/admin/EditHoursModal';
import { EditSettingsModal } from '@/components/admin/EditSettingsModal';
import { ManageProfessionalsModal } from '@/components/admin/ManageProfessionalsModal';
import { ManageConsultationTypesModal } from '@/components/admin/ManageConsultationTypesModal';
import { PageHeader } from '@/components/admin/PageHeader';

export default function SettingsPage() {
  const { professionals, consultationTypes } = useClinic();

  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [professionalsModalOpen, setProfessionalsModalOpen] = useState(false);
  const [typesModalOpen, setTypesModalOpen] = useState(false);

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

          {/* Tipos de Consulta */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 lg:p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <Tag className="h-4 w-4 lg:h-5 lg:w-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-sm lg:text-base text-foreground pt-1">Tipos</h3>
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
