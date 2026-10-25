export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_additional_professionals: {
        Row: {
          appointment_id: string
          professional_id: string
          professional_name: string
        }
        Insert: {
          appointment_id: string
          professional_id: string
          professional_name: string
        }
        Update: {
          appointment_id?: string
          professional_id?: string
          professional_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_additional_professionals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_additional_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_notes: {
        Row: {
          appointment_id: string
          author_user_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          appointment_id: string
          author_user_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          appointment_id?: string
          author_user_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_requests: {
        Row: {
          accepted_slot: Json | null
          assigned_professional_id: string | null
          cancel_reason: string | null
          created_at: string
          email: string
          estimated_duration: number | null
          id: string
          name: string
          nif: string
          phone: string
          preferred_date: string
          preferred_time: string
          professional_name: string | null
          reason: string
          rejection_reason: string | null
          specialty_id: string
          specialty_name: string | null
          status: Database["public"]["Enums"]["request_status"]
          suggested_slots: Json | null
          suggestion_expires_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_slot?: Json | null
          assigned_professional_id?: string | null
          cancel_reason?: string | null
          created_at?: string
          email: string
          estimated_duration?: number | null
          id?: string
          name: string
          nif: string
          phone: string
          preferred_date: string
          preferred_time: string
          professional_name?: string | null
          reason: string
          rejection_reason?: string | null
          specialty_id: string
          specialty_name?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          suggested_slots?: Json | null
          suggestion_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_slot?: Json | null
          assigned_professional_id?: string | null
          cancel_reason?: string | null
          created_at?: string
          email?: string
          estimated_duration?: number | null
          id?: string
          name?: string
          nif?: string
          phone?: string
          preferred_date?: string
          preferred_time?: string
          professional_name?: string | null
          reason?: string
          rejection_reason?: string | null
          specialty_id?: string
          specialty_name?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          suggested_slots?: Json | null
          suggestion_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_assigned_professional_id_fkey"
            columns: ["assigned_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          consultation_type_id: string | null
          consultation_type_name: string | null
          created_at: string
          date: string
          duration: number
          final_notes: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_rescheduled: boolean
          notes: string | null
          patient_id: string
          patient_name: string | null
          patient_phone: string | null
          professional_id: string
          professional_name: string | null
          reason: string | null
          room_id: string | null
          send_review: boolean
          source_request_id: string | null
          specialty_id: string
          specialty_name: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          time: string
          updated_at: string
          version: number
        }
        Insert: {
          cancellation_reason?: string | null
          consultation_type_id?: string | null
          consultation_type_name?: string | null
          created_at?: string
          date: string
          duration?: number
          final_notes?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_rescheduled?: boolean
          notes?: string | null
          patient_id: string
          patient_name?: string | null
          patient_phone?: string | null
          professional_id: string
          professional_name?: string | null
          reason?: string | null
          room_id?: string | null
          send_review?: boolean
          source_request_id?: string | null
          specialty_id: string
          specialty_name?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          time: string
          updated_at?: string
          version?: number
        }
        Update: {
          cancellation_reason?: string | null
          consultation_type_id?: string | null
          consultation_type_name?: string | null
          created_at?: string
          date?: string
          duration?: number
          final_notes?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_rescheduled?: boolean
          notes?: string | null
          patient_id?: string
          patient_name?: string | null
          patient_phone?: string | null
          professional_id?: string
          professional_name?: string | null
          reason?: string | null
          room_id?: string | null
          send_review?: boolean
          source_request_id?: string | null
          specialty_id?: string
          specialty_name?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          time?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointments_consultation_type_id_fkey"
            columns: ["consultation_type_id"]
            isOneToOne: false
            referencedRelation: "consultation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "appointment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      consultation_types: {
        Row: {
          color: string | null
          created_at: string
          default_duration: number
          id: string
          name: string
          specialty_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_duration?: number
          id?: string
          name: string
          specialty_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          default_duration?: number
          id?: string
          name?: string
          specialty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_types_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          appointment_id: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          nif: string
          notes: string | null
          phone: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          nif: string
          notes?: string | null
          phone: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          nif?: string
          notes?: string | null
          phone?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      professional_specialties: {
        Row: {
          professional_id: string
          specialty_id: string
        }
        Insert: {
          professional_id: string
          specialty_id: string
        }
        Update: {
          professional_id?: string
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_specialties_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          avatar_url: string | null
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          specialty_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          specialty_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          specialty_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active_consultation_type_ids: string[]
          active_specialty_ids: string[]
          color: string | null
          created_at: string
          extra_permissions: Json
          full_name: string
          photo_url: string | null
          time_off: Json
          updated_at: string
          user_id: string
          working_hours: Json
        }
        Insert: {
          active_consultation_type_ids?: string[]
          active_specialty_ids?: string[]
          color?: string | null
          created_at?: string
          extra_permissions?: Json
          full_name: string
          photo_url?: string | null
          time_off?: Json
          updated_at?: string
          user_id: string
          working_hours?: Json
        }
        Update: {
          active_consultation_type_ids?: string[]
          active_specialty_ids?: string[]
          color?: string | null
          created_at?: string
          extra_permissions?: Json
          full_name?: string
          photo_url?: string | null
          time_off?: Json
          updated_at?: string
          user_id?: string
          working_hours?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_request_to_appointment: {
        Args: {
          p_accepted_date?: string
          p_accepted_time?: string
          p_consultation_type_id?: string
          p_duration?: number
          p_professional_id?: string
          p_request_id: string
        }
        Returns: string
      }
      convert_request_to_appointment_with_team: {
        Args: {
          p_accepted_date?: string
          p_accepted_time?: string
          p_additional_professional_ids?: string[]
          p_consultation_type_id?: string
          p_duration?: number
          p_professional_id?: string
          p_request_id: string
        }
        Returns: string
      }
      get_appointment_team_availability: {
        Args: {
          p_consultation_type_id: string
          p_date: string
          p_duration: number
          p_exclude_appointment_id?: string
          p_specialty_id: string
          p_time: string
        }
        Returns: {
          available: boolean
          professional_id: string
          reason: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_accepted_slot_value: {
        Args: { slot_value: Json }
        Returns: Json
      }
      normalize_portuguese_phone_value: {
        Args: { phone_value: string }
        Returns: string
      }
      save_appointment_team: {
        Args: {
          p_additional_professional_ids: string[]
          p_appointment: Json
          p_appointment_id: string
          p_expected_version: number
        }
        Returns: string
      }
      set_appointment_state: {
        Args: {
          p_appointment_id: string
          p_expected_version: number
          p_final_notes?: string
          p_send_review?: boolean
          p_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "secretary" | "doctor"
      appointment_status:
        | "confirmed"
        | "waiting"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      request_status:
        | "pending"
        | "pre_confirmed"
        | "suggested"
        | "converted"
        | "cancelled"
        | "expired"
        | "rejected"
      time_preference: "morning" | "afternoon" | "any"
      waitlist_priority: "low" | "medium" | "high"
      whatsapp_workflow_status:
        | "pending"
        | "sent"
        | "delivered"
        | "responded"
        | "expired"
        | "failed"
        | "cancelled"
      whatsapp_workflow_type:
        | "pre_confirmation_sent"
        | "confirmation_24h"
        | "reschedule_prompt"
        | "slot_suggestion"
        | "request_cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "secretary", "doctor"],
      appointment_status: [
        "confirmed",
        "waiting",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      request_status: [
        "pending",
        "pre_confirmed",
        "suggested",
        "converted",
        "cancelled",
        "expired",
        "rejected",
      ],
      time_preference: ["morning", "afternoon", "any"],
      waitlist_priority: ["low", "medium", "high"],
      whatsapp_workflow_status: [
        "pending",
        "sent",
        "delivered",
        "responded",
        "expired",
        "failed",
        "cancelled",
      ],
      whatsapp_workflow_type: [
        "pre_confirmation_sent",
        "confirmation_24h",
        "reschedule_prompt",
        "slot_suggestion",
        "request_cancelled",
      ],
    },
  },
} as const
