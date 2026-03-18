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
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          event_type: string
          id: string
          metadata: Json | null
          page_path: string | null
          session_id: string | null
          wix_user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          event_type: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          wix_user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          wix_user_id?: string | null
        }
        Relationships: []
      }
      chat_logs: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message_count: number
          messages: Json
          search_mode: string | null
          title: string
          updated_at: string
          wix_user_email: string | null
          wix_user_id: string | null
          wix_user_name: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message_count?: number
          messages?: Json
          search_mode?: string | null
          title?: string
          updated_at?: string
          wix_user_email?: string | null
          wix_user_id?: string | null
          wix_user_name?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message_count?: number
          messages?: Json
          search_mode?: string | null
          title?: string
          updated_at?: string
          wix_user_email?: string | null
          wix_user_id?: string | null
          wix_user_name?: string | null
        }
        Relationships: []
      }
      properties_2025: {
        Row: {
          availability: string | null
          bathrooms: number | null
          bedrooms: number | null
          build_size_sqm: number | null
          contract_type: string | null
          days_listed: number | null
          fsr: string | null
          id: string | null
          land_size_sqm: number | null
          location: string | null
          off_plan: string | null
          price_idr: number | null
          price_per_sqm_usd: number | null
          price_per_year_usd: number | null
          price_usd: number | null
          property_type: string | null
          region: string | null
          scrape_date: string | null
          sold_date: string | null
          uqid: number
          years: number | null
        }
        Insert: {
          availability?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          build_size_sqm?: number | null
          contract_type?: string | null
          days_listed?: number | null
          fsr?: string | null
          id?: string | null
          land_size_sqm?: number | null
          location?: string | null
          off_plan?: string | null
          price_idr?: number | null
          price_per_sqm_usd?: number | null
          price_per_year_usd?: number | null
          price_usd?: number | null
          property_type?: string | null
          region?: string | null
          scrape_date?: string | null
          sold_date?: string | null
          uqid: number
          years?: number | null
        }
        Update: {
          availability?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          build_size_sqm?: number | null
          contract_type?: string | null
          days_listed?: number | null
          fsr?: string | null
          id?: string | null
          land_size_sqm?: number | null
          location?: string | null
          off_plan?: string | null
          price_idr?: number | null
          price_per_sqm_usd?: number | null
          price_per_year_usd?: number | null
          price_usd?: number | null
          property_type?: string | null
          region?: string | null
          scrape_date?: string | null
          sold_date?: string | null
          uqid?: number
          years?: number | null
        }
        Relationships: []
      }
      rentals_2025: {
        Row: {
          beds: number | null
          count: number | null
          date: string | null
          id: number
          location: string | null
          mgmt: string | null
          monthly_usd: number | null
          occupancy: number | null
          rate_usd: number | null
          region: string | null
          total_usd: number | null
          type: string | null
        }
        Insert: {
          beds?: number | null
          count?: number | null
          date?: string | null
          id?: number
          location?: string | null
          mgmt?: string | null
          monthly_usd?: number | null
          occupancy?: number | null
          rate_usd?: number | null
          region?: string | null
          total_usd?: number | null
          type?: string | null
        }
        Update: {
          beds?: number | null
          count?: number | null
          date?: string | null
          id?: number
          location?: string | null
          mgmt?: string | null
          monthly_usd?: number | null
          occupancy?: number | null
          rate_usd?: number | null
          region?: string | null
          total_usd?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      execute_readonly_query: { Args: { query_text: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
