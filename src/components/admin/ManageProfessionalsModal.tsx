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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useClinic } from '@/context/ClinicContext';
import { useSetProfessionalSpecialties } from '@/hooks/useProfessionalSpecialties';
import { toast } from 'sonner';
import type { Professional } from '@/types/clinic';

interface ManageProfessionalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfessionalForm {
  name: string;
  specialtyIds: string[];
  color: string;
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

function SpecialtyCheckboxList({
  specialties,
  selectedIds,
  onChange,
}: {
  specialties: { id: string; name: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(s => s !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Especialidades</Label>
      <div className="grid gap-1.5 max-h-32 overflow-y-auto">
        {specialties.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-2 cursor-pointer text-sm py-0.5"
          >
            <Checkbox
              checked={selectedIds.includes(s.id)}
              onCheckedChange={() => toggle(s.id)}
            />
            {s.name}
          </label>
        ))}
      </div>
    </div>
  );
}

export function ManageProfessionalsModal({ open, onOpenChange }: ManageProfessionalsModalProps) {
  const { professionals, specialties, appointments, addProfessional, updateProfessional, removeProfessional } = useClinic();
  const setProfSpecialties = useSetProfessionalSpecialties();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProfessionalForm>({ name: '', specialtyIds: [], color: COLORS[0] });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState<ProfessionalForm>({ name: '', specialtyIds: [], color: COLORS[0] });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleStartEdit = (prof: Professional) => {
    setEditingId(prof.id);
    setEditForm({
      name: prof.name,
      specialtyIds: prof.specialtyIds.length > 0 ? [...prof.specialtyIds] : (prof.specialty ? [prof.specialty] : []),
      color: prof.color,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.name.trim() || editForm.specialtyIds.length === 0) {
      toast.error('Preencha o nome e selecione pelo menos uma especialidade');
      return;
    }

    try {
      // Update professional (primary specialty = first selected)
      updateProfessional(editingId, {
        name: editForm.name.trim(),
        specialty: editForm.specialtyIds[0],
        color: editForm.color,
      });

      // Update junction table
      await setProfSpecialties.mutateAsync({
        professionalId: editingId,
        specialtyIds: editForm.specialtyIds,
      });

      toast.success('Profissional atualizado');
      setEditingId(null);
    } catch {
      toast.error('Erro ao atualizar especialidades');
    }
  };

  const handleAddNew = async () => {
    if (!newForm.name.trim() || newForm.specialtyIds.length === 0) {
      toast.error('Preencha o nome e selecione pelo menos uma especialidade');
      return;
    }

    // addProfessional uses primary specialty (first selected)
    addProfessional({
      name: newForm.name.trim(),
      specialty: newForm.specialtyIds[0],
      specialtyIds: newForm.specialtyIds,
      color: newForm.color,
    });

    toast.success('Profissional adicionado');
    setNewForm({ name: '', specialtyIds: [], color: COLORS[0] });
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const hasActiveAppointments = appointments.some(
      (a) => a.professionalId === id && (a.status === 'confirmed' || a.status === 'waiting' || a.status === 'in_progress')
    );
    if (hasActiveAppointments) {
      toast.error('Não é possível remover um profissional com consultas activas (confirmadas, em espera ou em curso).');
      setDeleteConfirm(null);
      return;
    }
    removeProfessional(id);
    toast.success('Profissional removido');
    setDeleteConfirm(null);
  };

  const getSpecialtyNames = (prof: Professional): string => {
    const ids = prof.specialtyIds.length > 0 ? prof.specialtyIds : (prof.specialty ? [prof.specialty] : []);
    const names = ids.map(id => specialties.find(s => s.id === id)?.name).filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'N/A';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerir Profissionais</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
            {professionals.map((prof) => (
              <Card key={prof.id}>
                <CardContent className="p-3">
                  {editingId === prof.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Nome"
                      />
                      <SpecialtyCheckboxList
                        specialties={specialties}
                        selectedIds={editForm.specialtyIds}
                        onChange={(ids) => setEditForm({ ...editForm, specialtyIds: ids })}
                      />
                      <div className="flex gap-1">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`w-6 h-6 rounded-full border-2 ${editForm.color === c ? 'border-foreground' : 'border-transparent'
                              }`}
                            style={{ backgroundColor: c }}
                            onClick={() => setEditForm({ ...editForm, color: c })}
                          />
                        ))}
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
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: prof.color }}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{prof.name}</p>
                        <p className="text-sm text-muted-foreground">{getSpecialtyNames(prof)}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleStartEdit(prof)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteConfirm(prof.id)}
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
                  <Input
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="Nome do profissional"
                  />
                  <SpecialtyCheckboxList
                    specialties={specialties}
                    selectedIds={newForm.specialtyIds}
                    onChange={(ids) => setNewForm({ ...newForm, specialtyIds: ids })}
                  />
                  <div className="flex gap-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 ${newForm.color === c ? 'border-foreground' : 'border-transparent'
                          }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewForm({ ...newForm, color: c })}
                      />
                    ))}
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
                Adicionar Profissional
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
            <AlertDialogTitle>Remover profissional?</AlertDialogTitle>
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
