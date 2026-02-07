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
import { supabase, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { useClinic } from '@/context/ClinicContext';
import { toast } from 'sonner';
import {
  Collaborator,
  useUpdateCollaborator,
  useDeleteCollaborator,
} from '@/hooks/useCollaborators';
import { Trash2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface ManageCollaboratorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** If provided, opens in edit mode for this collaborator */
  editTarget?: Collaborator | null;
}

type Role = 'secretary' | 'doctor';

// ─── Component ────────────────────────────────────────────────
export function ManageCollaboratorsModal({
  open,
  onOpenChange,
  onSuccess,
  editTarget,
}: ManageCollaboratorsModalProps) {
  const { specialties } = useClinic();
  const updateMutation = useUpdateCollaborator();
  const deleteMutation = useDeleteCollaborator();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('secretary');
  const [color, setColor] = useState('#6366f1');
  const [specialtyId, setSpecialtyId] = useState('');

  const isEditMode = !!editTarget;

  // Populate color from editTarget when opening in edit mode
  const effectiveColor = isEditMode ? (color !== '#6366f1' ? color : (editTarget?.color || '#6366f1')) : color;

  const resetForm = () => {
    setEmail('');
    setRole('secretary');
    setColor('#6366f1');
    setSpecialtyId('');
    setShowDeleteConfirm(false);
  };

  // ─── INVITE (create new collaborator) ──────────────
  const handleInvite = async () => {
    if (!email) {
      toast.error('Email obrigatório');
      return;
    }
    if (role === 'doctor' && !specialtyId) {
      toast.error('Selecione a especialidade do médico');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão inválida.');

      const body: any = { email, role, color };
      if (role === 'doctor') {
        body.specialty_id = specialtyId;
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

      // Always send color
      params.color = effectiveColor;

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
      <DialogContent className="max-w-md">
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
                A conta será eliminada. Esta ação é irreversível.
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
                  value={isEditMode ? (editTarget?.role === 'admin' ? 'secretary' : (editTarget?.role as Role) || role) : role}
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

            {/* Specialty — only for doctors, only on create */}
            {role === 'doctor' && !isEditMode && (
              <div className="space-y-2">
                <Label>Especialidade *</Label>
                <Select
                  value={specialtyId}
                  onValueChange={setSpecialtyId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a especialidade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Color */}
            <div className="space-y-2">
              <Label>Cor na Agenda</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={isEditMode ? effectiveColor : color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-9 p-1 cursor-pointer"
                  disabled={isSubmitting}
                />
                <div
                  className="h-9 flex-1 rounded-lg border border-border"
                  style={{ backgroundColor: isEditMode ? effectiveColor : color }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Esta cor identifica o colaborador na agenda e no sistema.
              </p>
            </div>

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
