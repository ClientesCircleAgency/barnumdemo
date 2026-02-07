import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useClinic } from '@/context/ClinicContext';
import { toast } from 'sonner';
import type { ConsultationType } from '@/types/clinic';
import { Label } from '@/components/ui/label';

interface ManageConsultationTypesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageConsultationTypesModal({
  open,
  onOpenChange,
}: ManageConsultationTypesModalProps) {
  const { consultationTypes, specialties, addConsultationType, updateConsultationType, removeConsultationType } = useClinic();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', color: '#6366f1', specialtyId: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', color: '#6366f1', specialtyId: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleStartEdit = (type: ConsultationType) => {
    setEditingId(type.id);
    setEditForm({ name: type.name, color: type.color || '#6366f1', specialtyId: type.specialtyId || '' });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editForm.name.trim()) {
      toast.error('Preencha o nome');
      return;
    }
    if (!editForm.specialtyId) {
      toast.error('Selecione a especialidade');
      return;
    }
    updateConsultationType(editingId, {
      name: editForm.name.trim(),
      color: editForm.color || undefined,
      specialtyId: editForm.specialtyId,
    });
    toast.success('Tipo de consulta atualizado');
    setEditingId(null);
  };

  const handleAddNew = () => {
    if (!newForm.name.trim()) {
      toast.error('Preencha o nome');
      return;
    }
    if (!newForm.specialtyId) {
      toast.error('Selecione a especialidade');
      return;
    }
    addConsultationType({
      name: newForm.name.trim(),
      defaultDuration: 30, // kept for DB compatibility, not shown in UI
      color: newForm.color || undefined,
      specialtyId: newForm.specialtyId,
    });
    toast.success('Tipo de consulta adicionado');
    setNewForm({ name: '', color: '#6366f1', specialtyId: '' });
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    removeConsultationType(id);
    toast.success('Tipo de consulta removido');
    setDeleteConfirm(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerir Tipos de Consulta</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground -mt-2">
            A duração é definida pela secretária em cada pedido, não pelo tipo de consulta.
          </p>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {consultationTypes.map((type) => (
              <Card key={type.id}>
                <CardContent className="p-3">
                  {editingId === type.id ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder="Nome do tipo"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Especialidade *</Label>
                        <Select
                          value={editForm.specialtyId}
                          onValueChange={(v) => setEditForm({ ...editForm, specialtyId: v })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {specialties.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cor</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            value={editForm.color}
                            onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                            className="w-12 h-9 p-1 cursor-pointer"
                          />
                          <span className="text-xs text-muted-foreground">{editForm.color}</span>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: type.color || '#6366f1' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{type.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {specialties.find(s => s.id === type.specialtyId)?.name || 'Sem especialidade'}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleStartEdit(type)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteConfirm(type.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Adicionar novo */}
            {isAdding ? (
              <Card className="border-dashed">
                <CardContent className="p-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={newForm.name}
                      onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                      placeholder="Ex: Consulta Geral, Check-up..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Especialidade *</Label>
                    <Select
                      value={newForm.specialtyId}
                      onValueChange={(v) => setNewForm({ ...newForm, specialtyId: v })}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecione a especialidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {specialties.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cor</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={newForm.color}
                        onChange={(e) => setNewForm({ ...newForm, color: e.target.value })}
                        className="w-12 h-9 p-1 cursor-pointer"
                      />
                      <span className="text-xs text-muted-foreground">{newForm.color}</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleAddNew}>
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button variant="outline" className="w-full gap-2" onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4" />
                Adicionar Tipo
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de eliminação */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tipo de consulta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As consultas existentes não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
