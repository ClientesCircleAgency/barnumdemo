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
          created_at: string
          email: string
          id: string
          name: string
          nif: string
          notes: string | null
          phone: string
          preferred_date: string
          preferred_time: string
          processed_at: string | null
          processed_by: string | null
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          nif: string
          notes?: string | null
          phone: string
          preferred_date: string
          preferred_time: string
          processed_at?: string | null
          processed_by?: string | null
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          nif?: string
          notes?: string | null
          phone?: string
          preferred_date?: string
          preferred_time?: string
          processed_at?: string | null
          processed_by?: string | null
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          consultation_type_id: string
          created_at: string
          date: string
          duration: number
          id: string
          notes: string | null
          patient_id: string
          professional_id: string
          room_id: string | null
          specialty_id: string
          status: Database["public"]["Enums"]["appointment_status"]
          time: string
          updated_at: string
        }
        Insert: {
          consultation_type_id: string
          created_at?: string
          date: string
          duration?: number
          id?: string
          notes?: string | null
          patient_id: string
          professional_id: string
          room_id?: string | null
          specialty_id: string
          status?: Database["public"]["Enums"]["appointment_status"]
          time: string
          updated_at?: string
        }
        Update: {
          consultation_type_id?: string
          created_at?: string
          date?: string
          duration?: number
          id?: string
          notes?: string | null
          patient_id?: string
          professional_id?: string
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
            foreignKeyName: "appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
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
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
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
        }
        Insert: {
          color?: string | null
          created_at?: string
          default_duration?: number
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          default_duration?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string
          status?: string
        }
        Relationships: []
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
      professionals: {
        Row: {
          avatar_url: string | null
          color: string
          created_at: string
          id: string
          name: string
          specialty_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          specialty_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          specialty_id?: string | null
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
      rooms: {
        Row: {
          created_at: string
          id: string
          name: string
          specialty_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          specialty_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          specialty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_specialty_id_fkey"
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
      waitlist: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          preferred_dates: string[] | null
          priority: Database["public"]["Enums"]["waitlist_priority"]
          professional_id: string | null
          reason: string | null
          sort_order: number
          specialty_id: string | null
          time_preference: Database["public"]["Enums"]["time_preference"]
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          preferred_dates?: string[] | null
          priority?: Database["public"]["Enums"]["waitlist_priority"]
          professional_id?: string | null
          reason?: string | null
          sort_order?: number
          specialty_id?: string | null
          time_preference?: Database["public"]["Enums"]["time_preference"]
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          preferred_dates?: string[] | null
          priority?: Database["public"]["Enums"]["waitlist_priority"]
          professional_id?: string | null
          reason?: string | null
          sort_order?: number
          specialty_id?: string | null
          time_preference?: Database["public"]["Enums"]["time_preference"]
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_workflows: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          message_payload: Json | null
          patient_id: string
          phone: string
          responded_at: string | null
          response: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
          workflow_type: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          message_payload?: Json | null
          patient_id: string
          phone: string
          responded_at?: string | null
          response?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          workflow_type: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          message_payload?: Json | null
          patient_id?: string
          phone?: string
          responded_at?: string | null
          response?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          workflow_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_workflows_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "user"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "waiting"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
        | "pre_confirmed"
      time_preference: "morning" | "afternoon" | "any"
      waitlist_priority: "low" | "medium" | "high"
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
      app_role: ["admin", "user"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "waiting",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
        "pre_confirmed",
      ],
      time_preference: ["morning", "afternoon", "any"],
      waitlist_priority: ["low", "medium", "high"],
    },
  },
} as const
