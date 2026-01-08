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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';
import type { Professional } from '@/types/clinic';

interface ManageProfessionalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function ManageProfessionalsModal({ open, onOpenChange }: ManageProfessionalsModalProps) {
  const { professionals, specialties, addProfessional, updateProfessional, removeProfessional } = useClinic();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', specialty: '', color: COLORS[0] });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', specialty: '', color: COLORS[0] });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleStartEdit = (prof: Professional) => {
    setEditingId(prof.id);
    setEditForm({ name: prof.name, specialty: prof.specialty, color: prof.color });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editForm.name.trim() || !editForm.specialty.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    updateProfessional(editingId, {
      name: editForm.name.trim(),
      specialty: editForm.specialty.trim(),
      color: editForm.color,
    });
    toast.success('Profissional atualizado');
    setEditingId(null);
  };

  const handleAddNew = () => {
    if (!newForm.name.trim() || !newForm.specialty.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    addProfessional({
      name: newForm.name.trim(),
      specialty: newForm.specialty.trim(),
      color: newForm.color,
    });
    toast.success('Profissional adicionado');
    setNewForm({ name: '', specialty: '', color: COLORS[0] });
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    removeProfessional(id);
    toast.success('Profissional removido');
    setDeleteConfirm(null);
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
                      <Select
                        value={editForm.specialty}
                        onValueChange={(v) => setEditForm({ ...editForm, specialty: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Especialidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {specialties.map((s) => (
                            <SelectItem key={s.id} value={s.name}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`w-6 h-6 rounded-full border-2 ${
                              editForm.color === c ? 'border-foreground' : 'border-transparent'
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
                        <p className="text-sm text-muted-foreground">{prof.specialty}</p>
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
                  <Select
                    value={newForm.specialty}
                    onValueChange={(v) => setNewForm({ ...newForm, specialty: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Especialidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 ${
                          newForm.color === c ? 'border-foreground' : 'border-transparent'
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
