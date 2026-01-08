import React, { createContext, useContext, useMemo } from 'react';
import { usePatients, useAddPatient, useUpdatePatient } from '@/hooks/usePatients';
import { useAppointments, useAddAppointment, useUpdateAppointment, useUpdateAppointmentStatus, useDeleteAppointment } from '@/hooks/useAppointments';
import { useProfessionals, useAddProfessional, useUpdateProfessional, useDeleteProfessional } from '@/hooks/useProfessionals';
import { useConsultationTypes, useAddConsultationType, useUpdateConsultationType, useDeleteConsultationType } from '@/hooks/useConsultationTypes';
import { useWaitlist, useAddToWaitlist, useUpdateWaitlistItem, useRemoveFromWaitlist } from '@/hooks/useWaitlist';
import { useSpecialties } from '@/hooks/useSpecialties';
import { useRooms } from '@/hooks/useRooms';
import type { 
  Patient, 
  ClinicAppointment, 
  Professional, 
  ConsultationType, 
  WaitlistItem, 
  Specialty,
  Room,
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
    date: row.date,
    time: row.time,
    duration: row.duration,
    status: row.status,
    notes: row.notes || undefined,
    roomId: row.room_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfessional(row: any): Professional {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty_id || '',
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
  };
}

function mapWaitlistItem(row: any): WaitlistItem {
  return {
    id: row.id,
    patientId: row.patient_id,
    specialtyId: row.specialty_id || undefined,
    professionalId: row.professional_id || undefined,
    timePreference: row.time_preference,
    preferredDates: row.preferred_dates || undefined,
    priority: row.priority,
    sortOrder: row.sort_order,
    reason: row.reason || undefined,
    createdAt: row.created_at,
  };
}

function mapSpecialty(row: any): Specialty {
  return {
    id: row.id,
    name: row.name,
  };
}

function mapRoom(row: any): Room {
  return {
    id: row.id,
    name: row.name,
    specialtyId: row.specialty_id || undefined,
  };
}

interface ClinicContextType {
  // Dados
  patients: Patient[];
  appointments: ClinicAppointment[];
  professionals: Professional[];
  specialties: Specialty[];
  consultationTypes: ConsultationType[];
  waitlist: WaitlistItem[];
  rooms: Room[];
  
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

  // Ações - Lista de Espera
  addToWaitlist: (item: Omit<WaitlistItem, 'id' | 'createdAt'>) => void;
  removeFromWaitlist: (id: string) => void;
  updateWaitlistItem: (id: string, data: Partial<WaitlistItem>) => void;

  // Ações - Profissionais
  addProfessional: (professional: Omit<Professional, 'id'>) => void;
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
  const { data: waitlistData = [], isLoading: loadingWaitlist } = useWaitlist();
  const { data: specialtiesData = [] } = useSpecialties();
  const { data: roomsData = [] } = useRooms();

  // Map to camelCase
  const patients = useMemo(() => patientsData.map(mapPatient), [patientsData]);
  const appointments = useMemo(() => appointmentsData.map(mapAppointment), [appointmentsData]);
  const professionals = useMemo(() => professionalsData.map(mapProfessional), [professionalsData]);
  const consultationTypes = useMemo(() => consultationTypesData.map(mapConsultationType), [consultationTypesData]);
  const waitlist = useMemo(() => waitlistData.map(mapWaitlistItem), [waitlistData]);
  const specialties = useMemo(() => specialtiesData.map(mapSpecialty), [specialtiesData]);
  const rooms = useMemo(() => roomsData.map(mapRoom), [roomsData]);

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
  
  const addConsultationTypeMutation = useAddConsultationType();
  const updateConsultationTypeMutation = useUpdateConsultationType();
  const deleteConsultationTypeMutation = useDeleteConsultationType();
  
  const addToWaitlistMutation = useAddToWaitlist();
  const updateWaitlistMutation = useUpdateWaitlistItem();
  const removeFromWaitlistMutation = useRemoveFromWaitlist();

  const isLoading = loadingPatients || loadingAppointments || loadingProfessionals || loadingTypes || loadingWaitlist;

  const value = useMemo(() => ({
    // Data
    patients,
    appointments,
    professionals,
    specialties,
    consultationTypes,
    waitlist,
    rooms,
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
        room_id: appointmentData.roomId,
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
          notes: data.notes,
          room_id: data.roomId,
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

    // Waitlist actions
    addToWaitlist: (itemData: Omit<WaitlistItem, 'id' | 'createdAt'>) => {
      addToWaitlistMutation.mutate({
        patient_id: itemData.patientId,
        specialty_id: itemData.specialtyId,
        professional_id: itemData.professionalId,
        time_preference: itemData.timePreference,
        preferred_dates: itemData.preferredDates,
        priority: itemData.priority,
        sort_order: itemData.sortOrder || 0,
        reason: itemData.reason,
      });
    },
    removeFromWaitlist: (id: string) => {
      removeFromWaitlistMutation.mutate(id);
    },
    updateWaitlistItem: (id: string, data: Partial<WaitlistItem>) => {
      updateWaitlistMutation.mutate({ 
        id, 
        data: {
          patient_id: data.patientId,
          specialty_id: data.specialtyId,
          professional_id: data.professionalId,
          time_preference: data.timePreference,
          preferred_dates: data.preferredDates,
          priority: data.priority,
          sort_order: data.sortOrder,
          reason: data.reason,
        }
      });
    },

    // Professional actions
    addProfessional: (data: Omit<Professional, 'id'>) => {
      addProfessionalMutation.mutate({
        name: data.name,
        specialty_id: data.specialty,
        color: data.color,
        avatar_url: data.avatar,
      });
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
      });
    },
    updateConsultationType: (id: string, data: Partial<ConsultationType>) => {
      updateConsultationTypeMutation.mutate({ 
        id, 
        data: {
          name: data.name,
          default_duration: data.defaultDuration,
          color: data.color,
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
    waitlist,
    rooms,
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
    addConsultationTypeMutation,
    updateConsultationTypeMutation,
    deleteConsultationTypeMutation,
    addToWaitlistMutation,
    updateWaitlistMutation,
    removeFromWaitlistMutation,
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
