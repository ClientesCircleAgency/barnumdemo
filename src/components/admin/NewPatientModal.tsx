import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useClinic } from '@/context/ClinicContext';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { patientFormSchema, type PatientFormData } from '@/lib/validations/patient';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface NewPatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatientCreated?: (patientId: string) => void;
}

export const NewPatientModal = React.forwardRef<HTMLDivElement, NewPatientModalProps>(
  function NewPatientModal({ open, onOpenChange, onPatientCreated }, ref) {
  const { addPatient, findPatientByNif } = useClinic();

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      nif: '',
      name: '',
      phone: '',
      email: '',
      birthDate: '',
      notes: '',
    },
  });

  const nifValue = form.watch('nif');
  const existingPatient = nifValue.length === 9 ? findPatientByNif(nifValue) : null;

  const handleSubmit = async (data: PatientFormData) => {
    // Check for duplicate NIF
    if (existingPatient) {
      form.setError('nif', {
        type: 'manual',
        message: `NIF já registado para: ${existingPatient.name}`,
      });
      return;
    }

    const newPatient = await addPatient({
      nif: data.nif,
      name: data.name.trim(),
      phone: data.phone,
      email: data.email?.trim() || undefined,
      birthDate: data.birthDate || undefined,
      notes: data.notes?.trim() || undefined,
    });

    toast.success('Paciente criado com sucesso');
    onPatientCreated?.(newPatient.id);
    form.reset();
    onOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Paciente</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            {/* NIF */}
            <FormField
              control={form.control}
              name="nif"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIF *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="123456789"
                      maxLength={9}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 9);
                        field.onChange(cleaned);
                      }}
                    />
                  </FormControl>
                  {existingPatient && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      NIF já registado para: {existingPatient.name}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do paciente" maxLength={100} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Telefone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="912 345 678"
                      type="tel"
                      maxLength={9}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 9);
                        field.onChange(cleaned);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="email@exemplo.com"
                      type="email"
                      maxLength={255}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Data de Nascimento */}
            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Observações */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notas sobre o paciente..."
                      rows={2}
                      maxLength={1000}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!!existingPatient || !form.formState.isValid}>
                Criar Paciente
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});
