import { errorMessage } from '@/lib/errors';
import { useState, useEffect, useRef, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Clock, Sparkles, Smile, Calendar, Phone, Mail, User, MessageCircle, CalendarPlus } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAppointmentRequests, useConvertRequestToAppointment, useUpdateAppointmentRequestSuggestions, type AppointmentRequest } from '@/hooks/useAppointmentRequests';
import { useAppointments } from '@/hooks/useAppointments';
import { useSpecialties } from '@/hooks/useSpecialties';
import { useConsultationTypes } from '@/hooks/useConsultationTypes';
import { useProfessionals } from '@/hooks/useProfessionals';
import { useProfessionalSpecialties } from '@/hooks/useProfessionalSpecialties';
import { useProfessionalServicePreferences } from '@/hooks/useProfessionalServicePreferences';
import { SuggestAlternativesModal } from '@/components/admin/SuggestAlternativesModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getAvailableProfessionalIds } from '@/utils/availability';
import { RequestsBoard } from '@/components/admin/RequestsBoard';
import { getRequestStage, getRequestStatusLabel, requestStageStyles } from '@/utils/requestStages';
import { professionalSupportsService } from '@/utils/professionalServicePreferences';
import { AppointmentProfessionalsField } from '@/components/admin/AppointmentProfessionalsField';
import { useAppointmentTeamAvailability } from '@/hooks/useAppointmentTeamAvailability';

export default function RequestsPage() {
  const { data: requests = [], isLoading: loadingRequests, isError, refetch } = useAppointmentRequests();
  const { data: specialties = [] } = useSpecialties();
  const { data: consultationTypes = [] } = useConsultationTypes();
  const { data: professionals = [] } = useProfessionals();
  const { data: profSpecialties = [] } = useProfessionalSpecialties();
  const { data: servicePreferences = [] } = useProfessionalServicePreferences();
  const { data: allAppointments = [] } = useAppointments();

  const convertRequest = useConvertRequestToAppointment();
  const updateSuggestions = useUpdateAppointmentRequestSuggestions();


  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const selectedRequest = requests.find(request => request.id === selectedRequestId) || null;
  const setSelectedRequest = (request: AppointmentRequest | null) => setSelectedRequestId(request?.id || null);
  const [showAlternativesModal, setShowAlternativesModal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [additionalProfessionalIds,setAdditionalProfessionalIds] = useState<string[]>([]);
  useEffect(() => { setAdditionalProfessionalIds([]); }, [selectedRequestId]);
  const [selectedConsultationTypeId, setSelectedConsultationTypeId] = useState<string>('');
  const [manualDurationMinutes, setManualDurationMinutes] = useState<string>('');

  // Consultation types filtered by the request's specialty
  const filteredConsultationTypes = selectedRequest
    ? consultationTypes.filter(ct => ct.specialty_id === selectedRequest.specialty_id)
    : [];

  const initializedRequestId = useRef<string | null>(null);

  // Initialize only when opening a different request; polling must preserve edits.
  useEffect(() => {
    const nextId = selectedRequest?.id ?? null;
    if (initializedRequestId.current === nextId) return;
    initializedRequestId.current = nextId;
    if (selectedRequest) {
      const relevantProf = professionals.find(p => {
        const pSpecIds = profSpecialties.filter(ps => ps.professional_id === p.id).map(ps => ps.specialty_id);
        const allIds = pSpecIds.length > 0 ? pSpecIds : (p.specialty_id ? [p.specialty_id] : []);
        return allIds.includes(selectedRequest.specialty_id)
          && professionalSupportsService(p, servicePreferences, selectedRequest.specialty_id);
      });
      setSelectedProfessionalId(relevantProf?.id || '');
      setSelectedConsultationTypeId('');
      setManualDurationMinutes('');
    } else {
      setSelectedProfessionalId('');
      setSelectedConsultationTypeId('');
      setManualDurationMinutes('');
    }
  }, [selectedRequest, professionals, profSpecialties, servicePreferences]);

  const pendingRequests = requests.filter(r => getRequestStage(r.status) === 'pending');
  const suggestedRequests = requests.filter(r => getRequestStage(r.status) === 'suggested');
  const canConfirm = selectedRequest?.status === 'pending' || selectedRequest?.status === 'pre_confirmed';
  const selectedSlot = selectedRequest?.accepted_slot || null;

  // Compute available professionals based on manual duration
  const duration = parseInt(manualDurationMinutes, 10);
  const isDurationValid = !isNaN(duration) && duration >= 5 && duration <= 1440;
  const teamAvailability = useAppointmentTeamAvailability({ specialtyId: selectedRequest?.specialty_id, consultationTypeId: selectedConsultationTypeId,
    date: selectedSlot?.date || selectedRequest?.preferred_date, time: selectedSlot?.time || selectedRequest?.preferred_time,
    duration, enabled: !!selectedRequest && isDurationValid });
  const teamIds = (teamAvailability.data ?? []).filter(p => p.available).map(p => p.professional_id);
  const invalidTeam = teamAvailability.isFetching || teamAvailability.isError || !teamAvailability.data ||
    [selectedProfessionalId,...additionalProfessionalIds].some(id => !teamIds.includes(id)) || additionalProfessionalIds.includes(selectedProfessionalId);
  
  // Filter professionals by the request's specialty (using junction table)
  const specialtyProfessionals = useMemo(() => selectedRequest
    ? professionals.filter(p => {
        const profSpecIds = profSpecialties
          .filter(ps => ps.professional_id === p.id)
          .map(ps => ps.specialty_id);
        // Fallback to legacy specialty_id if junction table is empty for this professional
        const allSpecIds = profSpecIds.length > 0 ? profSpecIds : (p.specialty_id ? [p.specialty_id] : []);
        return allSpecIds.includes(selectedRequest.specialty_id)
          && professionalSupportsService(
            p,
            servicePreferences,
            selectedRequest.specialty_id,
            selectedConsultationTypeId || undefined,
          );
      })
    : [], [selectedRequest, professionals, profSpecialties, servicePreferences, selectedConsultationTypeId]);

  useEffect(() => {
    if (!selectedProfessionalId) return;
    if (!specialtyProfessionals.some((professional) => professional.id === selectedProfessionalId)) {
      setSelectedProfessionalId(specialtyProfessionals[0]?.id || '');
    }
  }, [selectedProfessionalId, specialtyProfessionals]);

  const availableProfessionalIds = isDurationValid && selectedRequest
    ? getAvailableProfessionalIds(
        {
          date: selectedSlot?.date || selectedRequest.preferred_date,
          startTime: selectedSlot?.time || selectedRequest.preferred_time,
          durationMinutes: duration,
        },
        specialtyProfessionals,
        allAppointments
      )
    : [];

  const hasAvailableDoctors = availableProfessionalIds.length > 0;

  // Convert request to confirmed appointment via RPC
  const handleConvertToAppointment = async () => {
    if (!selectedRequest || !canConfirm) return;
    if (!selectedConsultationTypeId) {
      toast.error('Por favor selecione o tipo de consulta');
      return;
    }
    if (!selectedProfessionalId) {
      toast.error('Por favor selecione um profissional');
      return;
    }
    if (!isDurationValid) {
      toast.error('Por favor defina uma duração válida (5-1440 minutos)');
      return;
    }

    if (invalidTeam) { toast.error('Confirme a disponibilidade de todos os profissionais.'); return; }
    setIsConverting(true);
    try {
      await convertRequest.mutateAsync({
        request_id: selectedRequest.id,
        professional_id: selectedProfessionalId,
        additional_professional_ids: additionalProfessionalIds,
        consultation_type_id: selectedConsultationTypeId,
        duration,
      });

      toast.success('Consulta confirmada criada com sucesso.');
      setSelectedRequest(null);
    } catch (error: unknown) {
      const msg = errorMessage(error, 'Erro desconhecido');
      toast.error(`Erro ao converter pedido: ${msg}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleSuggestAlternatives = () => {
    setShowAlternativesModal(true);
  };

  const getStatusBadge = (status: AppointmentRequest['status']) => (
    <Badge variant="outline" className={requestStageStyles[getRequestStage(status)]}>{getRequestStatusLabel(status)}</Badge>
  );

  if (loadingRequests) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Pedidos"
        subtitle={`${pendingRequests.length} pendentes · ${suggestedRequests.length} à espera de resposta`}
      />

      {isError ? (
        <div role="alert" className="rounded-2xl border p-6">
          <p>Não foi possível carregar os pedidos.</p>
          <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      ) : <RequestsBoard requests={requests} onSelect={setSelectedRequest} />}

      {/* Request Detail Modal */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-[1.6rem] sm:rounded-[1.8rem]">
          <DialogHeader>
            <DialogTitle>Pedido de Marcação</DialogTitle>
            <DialogDescription>
              Reveja os detalhes e escolha uma ação
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  specialties.find(s => s.id === selectedRequest.specialty_id)?.name.toLowerCase().includes('rejuv')
                    ? "bg-primary/10" : "bg-purple-100"
                )}>
                  {specialties.find(s => s.id === selectedRequest.specialty_id)?.name.toLowerCase().includes('rejuv') ? (
                    <Sparkles className="h-6 w-6 text-primary" />
                  ) : (
                    <Smile className="h-6 w-6 text-purple-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="break-words font-semibold text-lg">{selectedRequest.name}</p>
                  <p className="break-words text-sm text-muted-foreground">
                    {specialties.find(s => s.id === selectedRequest.specialty_id)?.name || 'Especialidade desconhecida'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>NIF: {selectedRequest.nif}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${selectedRequest.phone}`} className="text-primary hover:underline">
                    {selectedRequest.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${selectedRequest.email}`} className="text-primary hover:underline">
                    {selectedRequest.email}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="break-words">
                    {format(parseISO(selectedRequest.preferred_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })} às {selectedRequest.preferred_time}
                  </span>
                </div>
              </div>

              {getStatusBadge(selectedRequest.status)}
              {selectedRequest.status === 'suggested' && (
                <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <p className="font-medium">Horários sugeridos · à espera de resposta do paciente</p>
                  {selectedRequest.suggested_slots.map((slot, index) => (
                    <p key={index}>{format(parseISO(slot.date), 'dd/MM/yyyy', { locale: pt })} às {slot.time.slice(0, 5)}</p>
                  ))}
                  {selectedRequest.suggestion_expires_at && <p className="text-xs">Validade: {format(parseISO(selectedRequest.suggestion_expires_at), 'dd/MM/yyyy HH:mm', { locale: pt })}</p>}
                  <p>Este pedido só passa a processado após a confirmação da consulta.</p>
                </div>
              )}
              {selectedSlot?.date && selectedSlot?.time && <p className="rounded-xl bg-secondary p-3 text-sm">Horário aceite: {format(parseISO(selectedSlot.date), 'dd/MM/yyyy', { locale: pt })} às {selectedSlot.time.slice(0, 5)}</p>}
              {selectedRequest.rejection_reason && <p className="text-sm text-muted-foreground">Motivo: {selectedRequest.rejection_reason}</p>}

              {/* CONSULTATION REASON */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">Motivo da Consulta</Label>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {selectedRequest.reason}
                </p>
              </div>

              {canConfirm && <>
              {/* CONSULTATION TYPE SELECTION (REQUIRED) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Tipo de Consulta <span className="text-destructive">*</span>
                </Label>
                {filteredConsultationTypes.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2 bg-muted rounded">
                    Nenhum tipo de consulta para esta especialidade. Crie um nas Configurações.
                  </p>
                ) : (
                  <Select
                    value={selectedConsultationTypeId}
                    onValueChange={setSelectedConsultationTypeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de consulta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredConsultationTypes.map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ct.color || '#6366f1' }} />
                            {ct.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* MANUAL DURATION INPUT (REQUIRED) */}
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Duração da Consulta (minutos) <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    id="duration"
                    type="number"
                    min="5"
                    max="1440"
                    value={manualDurationMinutes}
                    onChange={(e) => setManualDurationMinutes(e.target.value)}
                    placeholder="Ex: 30"
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setManualDurationMinutes((prev) => String(Math.max(5, parseInt(prev || '0', 10) + 15)))}
                    >
                      +15
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setManualDurationMinutes((prev) => String(Math.max(5, parseInt(prev || '0', 10) + 30)))}
                    >
                      +30
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setManualDurationMinutes((prev) => String(Math.max(5, parseInt(prev || '0', 10) + 60)))}
                    >
                      +60
                    </Button>
                  </div>
                </div>
                {!isDurationValid && manualDurationMinutes && (
                  <p className="text-xs text-destructive">Duração deve estar entre 5 e 1440 minutos</p>
                )}
              </div>

              {/* PROFESSIONAL SELECTION (only shown after valid duration) */}
              {isDurationValid && (
                <div className="space-y-2">
                  <Label>
                    Selecionar Profissional 
                    {availableProfessionalIds.length > 0 ? (
                      <span className="text-xs text-green-600 ml-2">({availableProfessionalIds.length} disponível{availableProfessionalIds.length > 1 ? 'is' : ''})</span>
                    ) : (
                      <span className="text-xs text-orange-600 ml-2">(Nenhum disponível neste horário)</span>
                    )}
                  </Label>
                  <Select 
                    value={selectedProfessionalId} 
                    onValueChange={setSelectedProfessionalId}
                    disabled={availableProfessionalIds.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals
                        .filter(prof => (availableProfessionalIds.includes(prof.id) && teamIds.includes(prof.id)) || prof.id===selectedProfessionalId)
                        .map((professional) => (
                          <SelectItem key={professional.id} value={professional.id}>
                            {professional.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <AppointmentProfessionalsField primaryProfessionalId={selectedProfessionalId} value={additionalProfessionalIds} onChange={setAdditionalProfessionalIds}
                professionals={professionals} availableIds={teamIds} disabled={teamAvailability.isFetching || teamAvailability.isError} />
              {teamAvailability.isError && <p role="alert" className="text-sm text-destructive">Não foi possível verificar a disponibilidade. Tente novamente.</p>}
              </>}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Recebido: {format(new Date(selectedRequest.created_at), "d MMM yyyy 'às' HH:mm", { locale: pt })}
              </div>

              {/* ACTION BUTTONS */}
              {canConfirm && isDurationValid && (
                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <div className="flex flex-col gap-2 w-full">
                    {hasAvailableDoctors && (
                      <Button
                        className="w-full gap-2"
                        onClick={handleConvertToAppointment}
                        disabled={isConverting || !selectedProfessionalId || !selectedConsultationTypeId || invalidTeam}
                      >
                        <CalendarPlus className="w-4 h-4" />
                        {isConverting ? 'A confirmar...' : 'Confirmar e agendar consulta'}
                      </Button>
                    )}

                    <div className="flex flex-col gap-2 w-full sm:flex-row">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-green-500 text-green-600 hover:bg-green-50"
                        onClick={handleSuggestAlternatives}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Sugerir Alternativas
                      </Button>
                    </div>
                  </div>
                </DialogFooter>
              )}

              {/* Show instruction if duration not yet set */}
              {canConfirm && !isDurationValid && (
                <div className="space-y-2 pt-2 pb-1">
                  <div className="text-sm text-center text-muted-foreground">
                    Defina a duração da consulta para ver os profissionais disponíveis
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-green-500 text-green-600"
                    disabled
                  >
                    <MessageCircle className="w-4 h-4" />
                    Sugerir Alternativas
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suggest Alternatives Modal */}
      <SuggestAlternativesModal
        open={showAlternativesModal}
        onOpenChange={setShowAlternativesModal}
        source={selectedRequest && isDurationValid ? {
          appointment_id: selectedRequest.id,
          name: selectedRequest.name,
          specialty_id: selectedRequest.specialty_id,
          preferred_date: selectedRequest.preferred_date,
          preferred_time: selectedRequest.preferred_time,
          duration_minutes: duration,
          consultation_type_id: selectedConsultationTypeId || undefined,
        } : null}
        onSubmit={async (slots) => {
          if (!selectedRequest) return;
          await updateSuggestions.mutateAsync({
            id: selectedRequest.id,
            suggested_slots: slots,
            suggestion_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
          toast.success('Horários sugeridos. A aguardar resposta do paciente.');
          setShowAlternativesModal(false);
          setSelectedRequest(null);
        }}
      />
    </div>
  );
}
