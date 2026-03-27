import React, { createContext, useContext, useMemo } from 'react';
import { usePatients, useAddPatient, useUpdatePatient } from '@/hooks/usePatients';
import { useAppointments, useAddAppointment, useUpdateAppointment, useUpdateAppointmentStatus, useDeleteAppointment } from '@/hooks/useAppointments';
import { useProfessionals, useAddProfessional, useUpdateProfessional, useDeleteProfessional } from '@/hooks/useProfessionals';
import { useConsultationTypes, useAddConsultationType, useUpdateConsultationType, useDeleteConsultationType } from '@/hooks/useConsultationTypes';
import { useSpecialties } from '@/hooks/useSpecialties';
import { useProfessionalSpecialties, useSetProfessionalSpecialties, type ProfessionalSpecialtyRow } from '@/hooks/useProfessionalSpecialties';
import type { 
  Patient, 
  ClinicAppointment, 
  Professional, 
  ConsultationType, 
  Specialty,
  AppointmentStatus,
} from '@/types/clinic';

// Mapper functions: convert snake_case from DB to camelCase for components
function mapPatient(row: any): Patient {
  return {
    id: row.id,
    nif: row.nif,
    name: row.name,
    phone: row.phone,
    email: row.email || undefined,
    birthDate: row.birth_date || undefined,
    notes: row.notes || undefined,
    tags: row.tags || undefined,
    createdAt: row.created_at,
  };
}

function mapAppointment(row: any): ClinicAppointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    specialtyId: row.specialty_id,
    consultationTypeId: row.consultation_type_id,
    consultationTypeName: row.consultation_type_name || undefined,
    date: row.date,
    time: row.time,
    duration: row.duration,
    status: row.status,
    reason: row.reason || undefined,
    notes: row.notes || undefined,
    finalNotes: row.final_notes || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    sendReview: row.send_review ?? true,
    finalizedAt: row.finalized_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfessional(row: any, profSpecialties: ProfessionalSpecialtyRow[]): Professional {
  const specialtyIds = profSpecialties
    .filter(ps => ps.professional_id === row.id)
    .map(ps => ps.specialty_id);

  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty_id || '',
    specialtyIds: specialtyIds.length > 0 ? specialtyIds : (row.specialty_id ? [row.specialty_id] : []),
    color: row.color,
    avatar: row.avatar_url || undefined,
  };
}

function mapConsultationType(row: any): ConsultationType {
  return {
    id: row.id,
    name: row.name,
    defaultDuration: row.default_duration,
    color: row.color || undefined,
    specialtyId: row.specialty_id || undefined,
  };
}

function mapSpecialty(row: any): Specialty {
  return {
    id: row.id,
    name: row.name,
  };
}

interface ClinicContextType {
  // Dados
  patients: Patient[];
  appointments: ClinicAppointment[];
  professionals: Professional[];
  specialties: Specialty[];
  consultationTypes: ConsultationType[];
  
  // Loading states
  isLoading: boolean;

  // Ações - Pacientes
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt'>) => Promise<Patient>;
  updatePatient: (id: string, data: Partial<Patient>) => void;
  findPatientByNif: (nif: string) => Patient | undefined;
  getPatientById: (id: string) => Patient | undefined;

  // Ações - Consultas
  addAppointment: (appointment: Omit<ClinicAppointment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ClinicAppointment>;
  updateAppointment: (id: string, data: Partial<ClinicAppointment>) => void;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  deleteAppointment: (id: string) => void;
  getAppointmentsByDate: (date: string) => ClinicAppointment[];
  getAppointmentsByPatient: (patientId: string) => ClinicAppointment[];

  // Ações - Profissionais
  addProfessional: (professional: Omit<Professional, 'id'>) => Promise<void>;
  updateProfessional: (id: string, data: Partial<Professional>) => void;
  removeProfessional: (id: string) => void;

  // Ações - Tipos de Consulta
  addConsultationType: (type: Omit<ConsultationType, 'id'>) => void;
  updateConsultationType: (id: string, data: Partial<ConsultationType>) => void;
  removeConsultationType: (id: string) => void;

  // Helpers
  getProfessionalById: (id: string) => Professional | undefined;
  getSpecialtyById: (id: string) => Specialty | undefined;
  getConsultationTypeById: (id: string) => ConsultationType | undefined;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  // Fetch data from Supabase
  const { data: patientsData = [], isLoading: loadingPatients } = usePatients();
  const { data: appointmentsData = [], isLoading: loadingAppointments } = useAppointments();
  const { data: professionalsData = [], isLoading: loadingProfessionals } = useProfessionals();
  const { data: consultationTypesData = [], isLoading: loadingTypes } = useConsultationTypes();
  const { data: specialtiesData = [] } = useSpecialties();
  const { data: profSpecialtiesData = [] } = useProfessionalSpecialties();

  // Map to camelCase
  const patients = useMemo(() => patientsData.map(mapPatient), [patientsData]);
  const appointments = useMemo(() => appointmentsData.map(mapAppointment), [appointmentsData]);
  const professionals = useMemo(() => professionalsData.map(row => mapProfessional(row, profSpecialtiesData)), [professionalsData, profSpecialtiesData]);
  const consultationTypes = useMemo(() => consultationTypesData.map(mapConsultationType), [consultationTypesData]);
  const specialties = useMemo(() => specialtiesData.map(mapSpecialty), [specialtiesData]);

  // Mutations
  const addPatientMutation = useAddPatient();
  const updatePatientMutation = useUpdatePatient();
  
  const addAppointmentMutation = useAddAppointment();
  const updateAppointmentMutation = useUpdateAppointment();
  const updateAppointmentStatusMutation = useUpdateAppointmentStatus();
  const deleteAppointmentMutation = useDeleteAppointment();
  
  const addProfessionalMutation = useAddProfessional();
  const updateProfessionalMutation = useUpdateProfessional();
  const deleteProfessionalMutation = useDeleteProfessional();
  const setProfSpecialtiesMutation = useSetProfessionalSpecialties();
  
  const addConsultationTypeMutation = useAddConsultationType();
  const updateConsultationTypeMutation = useUpdateConsultationType();
  const deleteConsultationTypeMutation = useDeleteConsultationType();
  
  const isLoading = loadingPatients || loadingAppointments || loadingProfessionals || loadingTypes;

  const value = useMemo(() => ({
    // Data
    patients,
    appointments,
    professionals,
    specialties,
    consultationTypes,
    isLoading,

    // Patient actions
    addPatient: async (patientData: Omit<Patient, 'id' | 'createdAt'>) => {
      const result = await addPatientMutation.mutateAsync({
        nif: patientData.nif,
        name: patientData.name,
        phone: patientData.phone,
        email: patientData.email,
        birth_date: patientData.birthDate,
        notes: patientData.notes,
        tags: patientData.tags,
      });
      return mapPatient(result);
    },
    updatePatient: (id: string, data: Partial<Patient>) => {
      updatePatientMutation.mutate({ 
        id, 
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email,
          birth_date: data.birthDate,
          notes: data.notes,
          tags: data.tags,
        }
      });
    },
    findPatientByNif: (nif: string) => patients.find((p) => p.nif === nif),
    getPatientById: (id: string) => patients.find((p) => p.id === id),

    // Appointment actions
    addAppointment: async (appointmentData: Omit<ClinicAppointment, 'id' | 'createdAt' | 'updatedAt'>) => {
      const result = await addAppointmentMutation.mutateAsync({
        patient_id: appointmentData.patientId,
        professional_id: appointmentData.professionalId,
        specialty_id: appointmentData.specialtyId,
        consultation_type_id: appointmentData.consultationTypeId,
        date: appointmentData.date,
        time: appointmentData.time,
        duration: appointmentData.duration,
        status: appointmentData.status,
        notes: appointmentData.notes,
      });
      return mapAppointment(result);
    },
    updateAppointment: (id: string, data: Partial<ClinicAppointment>) => {
      updateAppointmentMutation.mutate({ 
        id, 
        data: {
          patient_id: data.patientId,
          professional_id: data.professionalId,
          specialty_id: data.specialtyId,
          consultation_type_id: data.consultationTypeId,
          date: data.date,
          time: data.time,
          duration: data.duration,
          status: data.status,
          reason: data.reason,
          notes: data.notes,
          final_notes: data.finalNotes,
          cancellation_reason: data.cancellationReason,
          send_review: data.sendReview,
          finalized_at: data.finalizedAt,
        }
      });
    },
    updateAppointmentStatus: (id: string, status: AppointmentStatus) => {
      updateAppointmentStatusMutation.mutate({ id, status });
    },
    deleteAppointment: (id: string) => {
      deleteAppointmentMutation.mutate(id);
    },
    getAppointmentsByDate: (date: string) => appointments.filter((a) => a.date === date),
    getAppointmentsByPatient: (patientId: string) => appointments.filter((a) => a.patientId === patientId),

    // Professional actions
    addProfessional: async (data: Omit<Professional, 'id'>) => {
      const created = await addProfessionalMutation.mutateAsync({
        name: data.name,
        specialty_id: data.specialty,
        color: data.color,
        avatar_url: data.avatar,
      });

      // Sync junction table if multiple specialties provided
      const ids = data.specialtyIds?.length ? data.specialtyIds : (data.specialty ? [data.specialty] : []);
      if (created?.id && ids.length > 0) {
        await setProfSpecialtiesMutation.mutateAsync({ professionalId: created.id, specialtyIds: ids });
      }
    },
    updateProfessional: (id: string, data: Partial<Professional>) => {
      updateProfessionalMutation.mutate({ 
        id, 
        data: {
          name: data.name,
          specialty_id: data.specialty,
          color: data.color,
          avatar_url: data.avatar,
        }
      });
    },
    removeProfessional: (id: string) => {
      deleteProfessionalMutation.mutate(id);
    },

    // Consultation type actions
    addConsultationType: (data: Omit<ConsultationType, 'id'>) => {
      addConsultationTypeMutation.mutate({
        name: data.name,
        default_duration: data.defaultDuration,
        color: data.color,
        specialty_id: data.specialtyId || null,
      });
    },
    updateConsultationType: (id: string, data: Partial<ConsultationType>) => {
      updateConsultationTypeMutation.mutate({ 
        id, 
        data: {
          name: data.name,
          default_duration: data.defaultDuration,
          color: data.color,
          specialty_id: data.specialtyId,
        }
      });
    },
    removeConsultationType: (id: string) => {
      deleteConsultationTypeMutation.mutate(id);
    },

    // Helpers
    getProfessionalById: (id: string) => professionals.find((p) => p.id === id),
    getSpecialtyById: (id: string) => specialties.find((s) => s.id === id),
    getConsultationTypeById: (id: string) => consultationTypes.find((c) => c.id === id),
  }), [
    patients,
    appointments,
    professionals,
    specialties,
    consultationTypes,
    isLoading,
    addPatientMutation,
    updatePatientMutation,
    addAppointmentMutation,
    updateAppointmentMutation,
    updateAppointmentStatusMutation,
    deleteAppointmentMutation,
    addProfessionalMutation,
    updateProfessionalMutation,
    deleteProfessionalMutation,
    setProfSpecialtiesMutation,
    addConsultationTypeMutation,
    updateConsultationTypeMutation,
    deleteConsultationTypeMutation,
  ]);

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (context === undefined) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
}
