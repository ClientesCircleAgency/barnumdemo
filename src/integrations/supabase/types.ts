export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
          suggested_slots: Json
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
          suggested_slots?: Json
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
          suggested_slots?: Json
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
          created_at: string
          date: string
          duration: number
          final_notes: string | null
          finalized_at: string | null
          id: string
          notes: string | null
          patient_id: string
          professional_id: string
          professional_name: string | null
          reason: string | null
          send_review: boolean
          room_id: string | null
          specialty_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          time: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          consultation_type_id?: string | null
          created_at?: string
          date: string
          duration?: number
          final_notes?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          professional_id: string
          professional_name?: string | null
          reason?: string | null
          send_review?: boolean
          room_id?: string | null
          specialty_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          consultation_type_id?: string | null
          created_at?: string
          date?: string
          duration?: number
          final_notes?: string | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          professional_id?: string
          professional_name?: string | null
          reason?: string | null
          send_review?: boolean
          room_id?: string | null
          specialty_id?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time?: string
          updated_at?: string
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
          name: string
          specialty_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          specialty_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          id?: string
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
          created_at: string
          full_name: string
          photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          photo_url?: string | null
          updated_at?: string
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
    },
  },
} as const
