import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useClinic } from '@/context/ClinicContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManageCollaboratorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Role = 'secretary' | 'doctor';
type ProfessionalMode = 'create' | 'link';

export function ManageCollaboratorsModal({
  open,
  onOpenChange,
  onSuccess,
}: ManageCollaboratorsModalProps) {
  const { professionals, specialties } = useClinic();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('secretary');
  const [professionalMode, setProfessionalMode] = useState<ProfessionalMode>('link');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [newProfessionalName, setNewProfessionalName] = useState('');
  const [newProfessionalSpecialtyId, setNewProfessionalSpecialtyId] = useState<string>('');
  const [newProfessionalColor, setNewProfessionalColor] = useState('#6366f1');

  // Available professionals (not yet linked to a user)
  const availableProfessionals = professionals.filter(p => !p.userId);

  const resetForm = () => {
    setEmail('');
    setRole('secretary');
    setProfessionalMode('link');
    setSelectedProfessionalId('');
    setNewProfessionalName('');
    setNewProfessionalSpecialtyId('');
    setNewProfessionalColor('#6366f1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Email obrigatório');
      return;
    }

    if (role === 'doctor') {
      if (professionalMode === 'link' && !selectedProfessionalId) {
        toast.error('Selecione um profissional para ligar');
        return;
      }
      if (professionalMode === 'create' && !newProfessionalName) {
        toast.error('Nome do profissional obrigatório');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Get current session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Sessão inválida. Faça login novamente.');
      }

      // Prepare request body
      const body: any = {
        email,
        role,
      };

      if (role === 'doctor') {
        body.professional = {
          mode: professionalMode,
        };

        if (professionalMode === 'link') {
          body.professional.id = selectedProfessionalId;
        } else if (professionalMode === 'create') {
          body.professional.name = newProfessionalName;
          body.professional.specialty_id = newProfessionalSpecialtyId || null;
          body.professional.color = newProfessionalColor;
        }
      }

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke(
        'invite-collaborator',
        {
          body,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro ao convidar colaborador');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro desconhecido');
      }

      toast.success(
        `Convite enviado para ${email}. O utilizador receberá um email para criar a sua password.`
      );

      resetForm();
      onOpenChange(false);

      // Trigger refetch of collaborators list
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error inviting collaborator:', error);
      toast.error(
        error instanceof Error ? error.message : 'Erro ao convidar colaborador'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar Colaborador</DialogTitle>
          <DialogDescription>
            Crie uma conta para médico ou secretária. O utilizador receberá um email
            de convite.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="colaborador@clinica.pt"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Tipo de Conta *</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as Role)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="secretary">Secretária</SelectItem>
                <SelectItem value="doctor">Médico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Professional Configuration (only for doctors) */}
          {role === 'doctor' && (
            <div className="space-y-4 p-3 border border-border rounded-lg bg-muted/30">
              <p className="text-sm font-medium">Configuração de Profissional</p>

              <RadioGroup
                value={professionalMode}
                onValueChange={(value) =>
                  setProfessionalMode(value as ProfessionalMode)
                }
                disabled={isSubmitting}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="link" id="mode-link" />
                  <Label htmlFor="mode-link" className="font-normal cursor-pointer">
                    Ligar a profissional existente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="create" id="mode-create" />
                  <Label
                    htmlFor="mode-create"
                    className="font-normal cursor-pointer"
                  >
                    Criar novo profissional
                  </Label>
                </div>
              </RadioGroup>

              {professionalMode === 'link' && (
                <div className="space-y-2">
                  <Label htmlFor="professional-select">
                    Selecionar Profissional *
                  </Label>
                  {availableProfessionals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Todos os profissionais já estão ligados a utilizadores.
                      Escolha "Criar novo profissional" ou desassocie um profissional
                      primeiro.
                    </p>
                  ) : (
                    <Select
                      value={selectedProfessionalId}
                      onValueChange={setSelectedProfessionalId}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="professional-select">
                        <SelectValue placeholder="Escolha um profissional..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProfessionals.map((prof) => (
                          <SelectItem key={prof.id} value={prof.id}>
                            {prof.name} - {prof.specialty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {professionalMode === 'create' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="prof-name">Nome do Profissional *</Label>
                    <Input
                      id="prof-name"
                      placeholder="Dr. João Silva"
                      value={newProfessionalName}
                      onChange={(e) => setNewProfessionalName(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prof-specialty">Especialidade (opcional)</Label>
                    <Select
                      value={newProfessionalSpecialtyId}
                      onValueChange={setNewProfessionalSpecialtyId}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="prof-specialty">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem especialidade</SelectItem>
                        {specialties.map((spec) => (
                          <SelectItem key={spec.id} value={spec.id}>
                            {spec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prof-color">Cor (opcional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="prof-color"
                        type="color"
                        value={newProfessionalColor}
                        onChange={(e) => setNewProfessionalColor(e.target.value)}
                        className="w-16 h-9 cursor-pointer"
                        disabled={isSubmitting}
                      />
                      <span className="text-sm text-muted-foreground">
                        {newProfessionalColor}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'A convidar...' : 'Enviar Convite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
