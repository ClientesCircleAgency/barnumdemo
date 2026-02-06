import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Check, X, Clock, Sparkles, Smile, Search, Calendar, Phone, Mail, User, MessageCircle, CalendarPlus } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useAppointmentRequests, useUpdateAppointmentRequestStatus, type AppointmentRequest } from '@/hooks/useAppointmentRequests';
import { useContactMessages, useUpdateContactMessageStatus, type ContactMessage } from '@/hooks/useContactMessages';
import { usePatients, useAddPatient } from '@/hooks/usePatients';
import { useAddAppointment, useAppointments } from '@/hooks/useAppointments';

import { useSpecialties } from '@/hooks/useSpecialties';
import { useConsultationTypes } from '@/hooks/useConsultationTypes';
import { useProfessionals } from '@/hooks/useProfessionals';
import { SuggestAlternativesModal } from '@/components/admin/SuggestAlternativesModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getAvailableProfessionalIds } from '@/utils/availability';

export default function RequestsPage() {
  const { data: requests = [], isLoading: loadingRequests } = useAppointmentRequests();
  const { data: messages = [], isLoading: loadingMessages } = useContactMessages();
  const { data: patients = [] } = usePatients();
  const { data: specialties = [] } = useSpecialties();
  const { data: consultationTypes = [] } = useConsultationTypes();
  const { data: professionals = [] } = useProfessionals();
  const { data: allAppointments = [] } = useAppointments();

  const updateRequestStatus = useUpdateAppointmentRequestStatus();
  const updateMessageStatus = useUpdateContactMessageStatus();
  const addPatient = useAddPatient();
  const addAppointment = useAddAppointment();


  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<AppointmentRequest | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [showAlternativesModal, setShowAlternativesModal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [manualDurationMinutes, setManualDurationMinutes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (selectedRequest) {
      // Try to pre-select a professional if one matches the specialty
      const relevantProf = professionals.find(p => p.specialty_id === selectedRequest.specialty_id);
      setSelectedProfessionalId(relevantProf?.id || '');
      setManualDurationMinutes('');
      setRejectionReason('');
    } else {
      setSelectedProfessionalId('');
      setManualDurationMinutes('');
      setRejectionReason('');
    }
  }, [selectedRequest, professionals]);

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');
  const newMessages = messages.filter(m => m.status === 'new');

  const filteredRequests = pendingRequests.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.nif.includes(searchQuery) ||
    r.phone.includes(searchQuery)
  );

  // Compute available professionals based on manual duration
  const duration = parseInt(manualDurationMinutes, 10);
  const isDurationValid = !isNaN(duration) && duration >= 5 && duration <= 1440;
  
  const availableProfessionalIds = isDurationValid && selectedRequest
    ? getAvailableProfessionalIds(
        {
          date: selectedRequest.preferred_date,
          startTime: selectedRequest.preferred_time,
          durationMinutes: duration,
        },
        professionals,
        allAppointments
      )
    : [];

  const hasAvailableDoctors = availableProfessionalIds.length > 0;

  // Convert request to confirmed appointment
  const handleConvertToAppointment = async () => {
    if (!selectedRequest) return;
    if (!selectedProfessionalId) {
      toast.error('Por favor selecione um profissional');
      return;
    }
    if (!isDurationValid) {
      toast.error('Por favor defina uma duração válida (5-1440 minutos)');
      return;
    }

    setIsConverting(true);
    try {
      // 1. Find or create patient
      let patient = patients.find(p => p.nif === selectedRequest.nif);

      if (!patient) {
        const newPatient = await addPatient.mutateAsync({
          nif: selectedRequest.nif,
          name: selectedRequest.name,
          phone: selectedRequest.phone,
          email: selectedRequest.email,
        });
        patient = newPatient;
      }

      // 2. Determine consultation type and professional
      const consultationType = consultationTypes[0]; // Use first available as fallback

      const professional = professionals.find(p => p.id === selectedProfessionalId);

      if (!consultationType || !professional) {
        toast.error('Configuração incompleta. Verifique profissionais e tipos de consulta.');
        return;
      }

      // 3. Create confirmed appointment with MANUAL duration
      await addAppointment.mutateAsync({
        patient_id: patient.id,
        professional_id: professional.id,
        specialty_id: selectedRequest.specialty_id,
        consultation_type_id: consultationType.id,
        date: selectedRequest.preferred_date,
        time: selectedRequest.preferred_time,
        duration: duration, // Use manual duration, not consultation type default
        status: 'confirmed',
        notes: `Convertido de pedido online. NIF: ${selectedRequest.nif} | Motivo: ${selectedRequest.reason}`,
      });

      // 4. Update request status
      await updateRequestStatus.mutateAsync({ id: selectedRequest.id, status: 'converted' });

      toast.success('Consulta confirmada criada com sucesso.');
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error converting request:', error);
      toast.error('Erro ao converter pedido');
    } finally {
      setIsConverting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      toast.error('Por favor indique o motivo da rejeição');
      return;
    }

    try {
      // TODO: Save rejection_reason when migration 20260131121545 is applied to production
      // For now, we only update status (rejection_reason column doesn't exist in production)
      await updateRequestStatus.mutateAsync({ id: selectedRequest.id, status: 'rejected' });
      toast.success('Pedido rejeitado');
      setSelectedRequest(null);
      setShowRejectionDialog(false);
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Erro ao rejeitar pedido: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleMarkMessageRead = async (id: string) => {
    try {
      await updateMessageStatus.mutateAsync({ id, status: 'read' });
    } catch {
      toast.error('Erro ao atualizar mensagem');
    }
  };

  const handleArchiveMessage = async (id: string) => {
    try {
      await updateMessageStatus.mutateAsync({ id, status: 'archived' });
      toast.success('Mensagem arquivada');
      setSelectedMessage(null);
    } catch {
      toast.error('Erro ao arquivar mensagem');
    }
  };

  const handleSendWhatsApp = (message: string, phone: string) => {
    // Format phone for WhatsApp (remove spaces, add country code if needed)
    const formattedPhone = phone.replace(/\s/g, '').replace(/^0/, '351');
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, '_blank');
    toast.success('WhatsApp aberto com mensagem');
  };

  const handleSuggestAlternatives = () => {
    setShowAlternativesModal(true);
  };

  const getStatusBadge = (status: AppointmentRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Rejeitado</Badge>;
      case 'converted':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Convertido</Badge>;
      default:
        return null;
    }
  };

  if (loadingRequests || loadingMessages) {
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
        subtitle={`${pendingRequests.length} pedidos pendentes • ${newMessages.length} mensagens novas`}
      />

      <Tabs defaultValue="appointments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="appointments" className="gap-2">
            <Calendar className="w-4 h-4" />
            Marcações
            {pendingRequests.length > 0 && (
              <Badge className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 py-0">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <Mail className="w-4 h-4" />
            Mensagens
            {newMessages.length > 0 && (
              <Badge className="ml-1 bg-destructive text-destructive-foreground text-xs px-1.5 py-0">
                {newMessages.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Appointment Requests */}
        <TabsContent value="appointments" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, NIF ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Pending Requests */}
          {filteredRequests.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum pedido de marcação pendente</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredRequests.map((request) => (
                <Card
                  key={request.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        // Find specialty name to determine icon/color
                        specialties.find(s => s.id === request.specialty_id)?.name.toLowerCase().includes('rejuv')
                          ? "bg-primary/10" : "bg-purple-100"
                      )}>
                        {specialties.find(s => s.id === request.specialty_id)?.name.toLowerCase().includes('rejuv') ? (
                          <Sparkles className="h-5 w-5 text-primary" />
                        ) : (
                          <Smile className="h-5 w-5 text-purple-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{request.name}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>NIF: {request.nif}</span>
                          <span>•</span>
                          <span>{format(new Date(request.preferred_date), "d MMM", { locale: pt })} às {request.preferred_time}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(request.status)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(request.created_at), "d MMM", { locale: pt })}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Processed Requests */}
          {processedRequests.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Processados ({processedRequests.length})</h3>
              <div className="grid gap-2 opacity-60">
                {processedRequests.slice(0, 5).map((request) => (
                  <Card key={request.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{request.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(request.preferred_date), "d MMM", { locale: pt })}
                        </span>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Contact Messages */}
        <TabsContent value="messages" className="space-y-4">
          {messages.length === 0 ? (
            <Card className="p-8 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma mensagem recebida</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {messages.filter(m => m.status !== 'archived').map((message) => (
                <Card
                  key={message.id}
                  className={cn(
                    "p-4 hover:shadow-md transition-shadow cursor-pointer",
                    message.status === 'new' && "border-l-4 border-l-primary"
                  )}
                  onClick={() => {
                    setSelectedMessage(message);
                    if (message.status === 'new') {
                      handleMarkMessageRead(message.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{message.name}</p>
                        {message.status === 'new' && (
                          <Badge className="bg-primary text-primary-foreground text-xs">Nova</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{message.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(message.created_at), "d MMM HH:mm", { locale: pt })}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Request Detail Modal */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido de Marcação</DialogTitle>
            <DialogDescription>
              Reveja os detalhes e escolha uma ação
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
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
                <div>
                  <p className="font-semibold text-lg">{selectedRequest.name}</p>
                  <p className="text-sm text-muted-foreground">
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
                  <span>
                    {format(new Date(selectedRequest.preferred_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt })} às {selectedRequest.preferred_time}
                  </span>
                </div>
              </div>

              {/* CONSULTATION REASON */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">Motivo da Consulta</Label>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  {selectedRequest.reason}
                </p>
              </div>

              {/* MANUAL DURATION INPUT (REQUIRED) */}
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Duração da Consulta (minutos) <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
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
                        .filter(prof => availableProfessionalIds.includes(prof.id))
                        .map((professional) => (
                          <SelectItem key={professional.id} value={professional.id}>
                            {professional.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Recebido: {format(new Date(selectedRequest.created_at), "d MMM yyyy 'às' HH:mm", { locale: pt })}
              </div>

              {/* CONDITIONAL ACTION BUTTONS */}
              {selectedRequest.status === 'pending' && isDurationValid && (
                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  {/* If doctors available: show Schedule + Reject */}
                  {hasAvailableDoctors && (
                    <div className="flex gap-2 w-full">
                      <Button
                        className="flex-1 gap-2"
                        onClick={handleConvertToAppointment}
                        disabled={isConverting || !selectedProfessionalId}
                      >
                        <CalendarPlus className="w-4 h-4" />
                        {isConverting ? 'A converter...' : 'Agendar Consulta'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setShowRejectionDialog(true)}
                        disabled={updateRequestStatus.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  )}

                  {/* If NO doctors available: show Suggest Alternatives + Reject */}
                  {!hasAvailableDoctors && (
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-green-500 text-green-600 hover:bg-green-50"
                        onClick={handleSuggestAlternatives}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Sugerir Alternativas
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setShowRejectionDialog(true)}
                        disabled={updateRequestStatus.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </DialogFooter>
              )}

              {/* Show instruction if duration not yet set */}
              {selectedRequest.status === 'pending' && !isDurationValid && (
                <div className="text-sm text-center text-muted-foreground pt-2 pb-1">
                  Defina a duração da consulta para ver os profissionais disponíveis
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Pedido</DialogTitle>
            <DialogDescription>
              Por favor indique o motivo da rejeição (obrigatório)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da Rejeição <span className="text-destructive">*</span></Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Não atendemos essa especialidade, não há disponibilidade nas próximas semanas, etc."
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectionDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || updateRequestStatus.isPending}
            >
              {updateRequestStatus.isPending ? 'A rejeitar...' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Detail Modal */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mensagem</DialogTitle>
            <DialogDescription>
              Mensagem de contacto recebida
            </DialogDescription>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-lg">{selectedMessage.name}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <a href={`mailto:${selectedMessage.email}`} className="hover:text-primary">
                    {selectedMessage.email}
                  </a>
                  <a href={`tel:${selectedMessage.phone}`} className="hover:text-primary">
                    {selectedMessage.phone}
                  </a>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-foreground whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>

              <div className="text-xs text-muted-foreground">
                Recebido: {format(new Date(selectedMessage.created_at), "d MMM yyyy 'às' HH:mm", { locale: pt })}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleArchiveMessage(selectedMessage.id)}
                  disabled={updateMessageStatus.isPending}
                >
                  Arquivar
                </Button>
                <Button asChild>
                  <a href={`mailto:${selectedMessage.email}`}>
                    <Mail className="w-4 h-4 mr-1" />
                    Responder
                  </a>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suggest Alternatives Modal */}
      <SuggestAlternativesModal
        open={showAlternativesModal}
        onOpenChange={setShowAlternativesModal}
        request={selectedRequest}
        onSendWhatsApp={handleSendWhatsApp}
      />
    </div>
  );
}
