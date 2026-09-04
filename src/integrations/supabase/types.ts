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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      centres: {
        Row: {
          id: string
          location: string
          name: string
        }
        Insert: {
          id?: string
          location: string
          name: string
        }
        Update: {
          id?: string
          location?: string
          name?: string
        }
        Relationships: []
      }
      commodities: {
        Row: {
          avg_service_time_minutes: number
          id: string
          name: string
        }
        Insert: {
          avg_service_time_minutes?: number
          id?: string
          name: string
        }
        Update: {
          avg_service_time_minutes?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          document_path: string | null
          id: string
          id_number: string | null
          id_type: string | null
          name: string
          phone: string | null
          phone_verified: boolean
          preferred_commodities: string[]
          verification_note: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          village: string | null
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          id: string
          id_number?: string | null
          id_type?: string | null
          name: string
          phone?: string | null
          phone_verified?: boolean
          preferred_commodities?: string[]
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          village?: string | null
        }
        Update: {
          created_at?: string
          document_path?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          name?: string
          phone?: string | null
          phone_verified?: boolean
          preferred_commodities?: string[]
          verification_note?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          village?: string | null
        }
        Relationships: []
      }
      slots: {
        Row: {
          centre_id: string
          id: string
          slot_date: string
          time_slot: string
        }
        Insert: {
          centre_id: string
          id?: string
          slot_date: string
          time_slot: string
        }
        Update: {
          centre_id?: string
          id?: string
          slot_date?: string
          time_slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          centre_id: string
          commodity_id: string
          created_at: string
          farmer_id: string
          id: string
          quantity: number
          slot_id: string
          status: Database["public"]["Enums"]["token_status"]
          token_date: string
          token_number: number
        }
        Insert: {
          centre_id: string
          commodity_id: string
          created_at?: string
          farmer_id: string
          id?: string
          quantity?: number
          slot_id: string
          status?: Database["public"]["Enums"]["token_status"]
          token_date: string
          token_number: number
        }
        Update: {
          centre_id?: string
          commodity_id?: string
          created_at?: string
          farmer_id?: string
          id?: string
          quantity?: number
          slot_id?: string
          status?: Database["public"]["Enums"]["token_status"]
          token_date?: string
          token_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tokens_centre_id_fkey"
            columns: ["centre_id"]
            isOneToOne: false
            referencedRelation: "centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_commodity_id_fkey"
            columns: ["commodity_id"]
            isOneToOne: false
            referencedRelation: "commodities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          price: number
          quantity: number
          served_at: string
          token_id: string
        }
        Insert: {
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price?: number
          quantity?: number
          served_at?: string
          token_id: string
        }
        Update: {
          id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price?: number
          quantity?: number
          served_at?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          centre_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          centre_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          centre_id?: string | null
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
      book_token: {
        Args: {
          _centre_id: string
          _commodity_id: string
          _quantity: number
          _slot_id: string
        }
        Returns: {
          centre_id: string
          commodity_id: string
          created_at: string
          farmer_id: string
          id: string
          quantity: number
          slot_id: string
          status: Database["public"]["Enums"]["token_status"]
          token_date: string
          token_number: number
        }
        SetofOptions: {
          from: "*"
          to: "tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "farmer" | "operator" | "admin"
      payment_status: "pending" | "paid"
      token_status: "booked" | "arrived" | "served" | "no_show"
      verification_status: "pending" | "verified" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["farmer", "operator", "admin"],
      payment_status: ["pending", "paid"],
      token_status: ["booked", "arrived", "served", "no_show"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const
