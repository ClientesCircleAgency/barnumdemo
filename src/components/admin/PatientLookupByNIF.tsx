import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, User, Plus, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useClinic } from '@/context/ClinicContext';
import type { Patient } from '@/types/clinic';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { inlinePatientFormSchema, type InlinePatientFormData } from '@/lib/validations/patient';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface PatientLookupByNIFProps {
  onPatientSelect: (patient: Patient) => void;
  selectedPatient?: Patient | null;
  onClear?: () => void;
}

export function PatientLookupByNIF({ onPatientSelect, selectedPatient, onClear }: PatientLookupByNIFProps) {
  const { findPatientByNif, addPatient, getAppointmentsByPatient } = useClinic();
  const [nif, setNif] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<Patient | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const form = useForm<InlinePatientFormData>({
    resolver: zodResolver(inlinePatientFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      birthDate: '',
      notes: '',
    },
    mode: 'onChange',
  });

  // Validar NIF (9 dígitos)
  const isValidNif = (value: string) => /^\d{9}$/.test(value);

  // Pesquisar ao digitar NIF completo
  useEffect(() => {
    if (isValidNif(nif)) {
      setIsSearching(true);
      // Simular delay de pesquisa
      const timer = setTimeout(() => {
        const patient = findPatientByNif(nif);
        if (patient) {
          setSearchResult(patient);
          setNotFound(false);
        } else {
          setSearchResult(null);
          setNotFound(true);
        }
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResult(null);
      setNotFound(false);
      setShowCreateForm(false);
    }
  }, [nif, findPatientByNif]);

  const handleSelectPatient = (patient: Patient) => {
    onPatientSelect(patient);
    setNif('');
    setSearchResult(null);
    setNotFound(false);
  };

  const handleCreatePatient = async (data: InlinePatientFormData) => {
    const patient = await addPatient({
      nif,
      name: data.name.trim(),
      phone: data.phone,
      email: data.email?.trim() || undefined,
      birthDate: data.birthDate || undefined,
      notes: data.notes?.trim() || undefined,
    });

    onPatientSelect(patient);
    setNif('');
    form.reset();
    setShowCreateForm(false);
    setNotFound(false);
  };

  // Se já tem paciente selecionado, mostrar card
  if (selectedPatient) {
    const appointments = getAppointmentsByPatient(selectedPatient.id);
    const lastAppointment = appointments
      .filter((a) => a.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    return (
      <Card className="border-primary">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{selectedPatient.name}</p>
                <p className="text-sm text-muted-foreground">NIF: {selectedPatient.nif}</p>
                <p className="text-sm text-muted-foreground">{selectedPatient.phone}</p>
                {lastAppointment && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Última consulta: {format(new Date(lastAppointment.date), 'dd/MM/yyyy', { locale: pt })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              {onClear && (
                <Button variant="ghost" size="sm" onClick={onClear}>
                  Alterar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Input NIF */}
      <div className="space-y-2">
        <FormLabel htmlFor="nif">NIF do Paciente *</FormLabel>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="nif"
            placeholder="Inserir 9 dígitos do NIF"
            value={nif}
            onChange={(e) => setNif(e.target.value.replace(/\D/g, '').slice(0, 9))}
            className="pl-10"
            maxLength={9}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {nif.length > 0 && nif.length < 9 && (
          <p className="text-xs text-muted-foreground">{9 - nif.length} dígitos restantes</p>
        )}
      </div>

      {/* Resultado da pesquisa */}
      {searchResult && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">{searchResult.name}</p>
                  <p className="text-sm text-muted-foreground">{searchResult.phone}</p>
                  {searchResult.email && (
                    <p className="text-sm text-muted-foreground">{searchResult.email}</p>
                  )}
                </div>
              </div>
              <Button onClick={() => handleSelectPatient(searchResult)}>
                Selecionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paciente não encontrado */}
      {notFound && !showCreateForm && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Paciente não encontrado</p>
                <p className="text-sm text-muted-foreground">NIF {nif} não está registado</p>
              </div>
              <Button onClick={() => setShowCreateForm(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Paciente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário de novo paciente */}
      {showCreateForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Novo Paciente</h4>
              <Button variant="ghost" size="sm" onClick={() => {
                setShowCreateForm(false);
                form.reset();
              }}>
                Cancelar
              </Button>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreatePatient)} className="space-y-4">
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

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telemóvel *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="912345678"
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

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="email@exemplo.com" maxLength={255} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações (opcional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Notas internas sobre o paciente" maxLength={1000} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={!form.formState.isValid}
                  className="w-full"
                >
                  Criar e Continuar
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
