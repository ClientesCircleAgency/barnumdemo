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
import { supabase, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Collaborator,
  useUpdateCollaborator,
  useDeleteCollaborator,
} from '@/hooks/useCollaborators';
import { Trash2, Pencil } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface ManageCollaboratorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** If provided, opens in edit mode for this collaborator */
  editTarget?: Collaborator | null;
}

type Role = 'secretary' | 'doctor';
type ProfessionalMode = 'create' | 'link';

// ─── Component ────────────────────────────────────────────────
export function ManageCollaboratorsModal({
  open,
  onOpenChange,
  onSuccess,
  editTarget,
}: ManageCollaboratorsModalProps) {
  const { professionals, specialties } = useClinic();
  const updateMutation = useUpdateCollaborator();
  const deleteMutation = useDeleteCollaborator();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('secretary');
  const [professionalMode, setProfessionalMode] = useState<ProfessionalMode>('link');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [newProfessionalName, setNewProfessionalName] = useState('');
  const [newProfessionalSpecialtyId, setNewProfessionalSpecialtyId] = useState<string>('');
  const [newProfessionalColor, setNewProfessionalColor] = useState('#6366f1');

  const isEditMode = !!editTarget;

  // Available professionals (not yet linked to a user, or linked to this user)
  const availableProfessionals = professionals.filter(
    (p) => !p.userId || (editTarget && p.userId === editTarget.user_id)
  );

  const resetForm = () => {
    setEmail('');
    setRole('secretary');
    setProfessionalMode('link');
    setSelectedProfessionalId('');
    setNewProfessionalName('');
    setNewProfessionalSpecialtyId('');
    setNewProfessionalColor('#6366f1');
    setShowDeleteConfirm(false);
  };

  // Populate form when editTarget changes
  const populateFromTarget = () => {
    if (editTarget) {
      setEmail(editTarget.email);
      setRole(editTarget.role === 'admin' ? 'secretary' : (editTarget.role as Role));
      if (editTarget.professional_id) {
        setProfessionalMode('link');
        setSelectedProfessionalId(editTarget.professional_id);
      }
    }
  };

  // ─── INVITE (create new collaborator) ──────────────
  const handleInvite = async () => {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão inválida.');

      const body: any = { email, role };
      if (role === 'doctor') {
        body.professional = { mode: professionalMode };
        if (professionalMode === 'link') {
          body.professional.id = selectedProfessionalId;
        } else {
          body.professional.name = newProfessionalName;
          body.professional.specialty_id = newProfessionalSpecialtyId || null;
          body.professional.color = newProfessionalColor;
        }
      }

      const { data, error } = await supabase.functions.invoke(
        'invite-collaborator',
        {
          body,
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'x-user-token': session.access_token,
          },
        }
      );

      if (error) {
        let errorMsg = 'Erro ao convidar colaborador';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const errBody = await error.context.json();
            errorMsg = errBody?.error || errorMsg;
          } else {
            errorMsg = error.message || errorMsg;
          }
        } catch {
          errorMsg = error.message || errorMsg;
        }
        throw new Error(errorMsg);
      }

      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');

      toast.success(
        `Convite enviado para ${email}. O utilizador receberá um email para criar a sua password.`
      );
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao convidar colaborador');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── UPDATE (edit existing collaborator) ──────────
  const handleUpdate = async () => {
    if (!editTarget) return;

    setIsSubmitting(true);
    try {
      const params: any = { user_id: editTarget.user_id };

      // Check if role changed
      if (role !== editTarget.role && editTarget.role !== 'admin') {
        params.role = role;
      }

      // Handle professional changes for doctor role
      if (role === 'doctor') {
        if (professionalMode === 'link' && selectedProfessionalId) {
          if (selectedProfessionalId !== editTarget.professional_id) {
            params.professional = { action: 'link', id: selectedProfessionalId };
          }
        }
      } else if (editTarget.role === 'doctor' && editTarget.professional_id) {
        // Changing from doctor to secretary — unlink professional
        params.professional = { action: 'unlink' };
      }

      await updateMutation.mutateAsync(params);
      toast.success('Colaborador atualizado com sucesso.');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar colaborador');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── DELETE ────────────────────────────────────────
  const handleDelete = async () => {
    if (!editTarget) return;

    setIsSubmitting(true);
    try {
      await deleteMutation.mutateAsync({ user_id: editTarget.user_id });
      toast.success(`Colaborador ${editTarget.email} removido com sucesso.`);
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover colaborador');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode) {
      handleUpdate();
    } else {
      handleInvite();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Colaborador' : 'Convidar Colaborador'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Editar as permissões de ${editTarget?.email}.`
              : 'Crie uma conta para médico ou secretária. O utilizador receberá um email de convite.'}
          </DialogDescription>
        </DialogHeader>

        {/* Delete confirmation */}
        {showDeleteConfirm ? (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm font-medium text-destructive">
                Tem a certeza que quer remover {editTarget?.email}?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A conta será eliminada e o profissional (se existir) ficará desvinculado.
                Esta ação é irreversível.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'A remover...' : 'Confirmar Remoção'}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="colaborador@clinica.pt"
                value={isEditMode ? editTarget?.email || '' : email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting || isEditMode}
              />
            </div>

            {/* Role — disable for admin targets */}
            <div className="space-y-2">
              <Label htmlFor="role">Tipo de Conta *</Label>
              {editTarget?.role === 'admin' ? (
                <p className="text-sm text-muted-foreground p-2 bg-muted rounded">
                  Administrador (não editável)
                </p>
              ) : (
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
              )}
            </div>

            {/* Professional Configuration (only for doctors) */}
            {role === 'doctor' && editTarget?.role !== 'admin' && (
              <div className="space-y-4 p-3 border border-border rounded-lg bg-muted/30">
                <p className="text-sm font-medium">Configuração de Profissional</p>

                {!isEditMode && (
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
                      <Label htmlFor="mode-create" className="font-normal cursor-pointer">
                        Criar novo profissional
                      </Label>
                    </div>
                  </RadioGroup>
                )}

                {/* Link mode */}
                {(professionalMode === 'link' || isEditMode) && (
                  <div className="space-y-2">
                    <Label htmlFor="professional-select">
                      {isEditMode ? 'Profissional Ligado' : 'Selecionar Profissional *'}
                    </Label>
                    {availableProfessionals.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Todos os profissionais já estão ligados a utilizadores.
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

                {/* Create mode (only for new invites) */}
                {!isEditMode && professionalMode === 'create' && (
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
            <div className="flex justify-between pt-2">
              {/* Delete button (edit mode only, not for admins) */}
              <div>
                {isEditMode && editTarget?.role !== 'admin' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remover
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || editTarget?.role === 'admin'}>
                  {isSubmitting
                    ? isEditMode
                      ? 'A guardar...'
                      : 'A convidar...'
                    : isEditMode
                      ? 'Guardar'
                      : 'Enviar Convite'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
