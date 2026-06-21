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
      listings: {
        Row: {
          id: string
          org_id: string
          unit_id: string
          listing_title: string
          listing_description: string | null
          highlights: string[] | null
          display_rent: number | null
          status: 'draft' | 'published' | 'unlisted'
          available_from: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          unit_id: string
          listing_title: string
          listing_description?: string | null
          highlights?: string[] | null
          display_rent?: number | null
          status?: 'draft' | 'published' | 'unlisted'
          available_from?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          unit_id?: string
          listing_title?: string
          listing_description?: string | null
          highlights?: string[] | null
          display_rent?: number | null
          status?: 'draft' | 'published' | 'unlisted'
          available_from?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          id: string
          org_id: string
          listing_id: string
          type: 'inquiry' | 'application'
          name: string
          email: string
          phone: string | null
          move_in_date: string | null
          budget: number | null
          note: string | null
          status: 'new' | 'contacted' | 'closed'
          created_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          listing_id: string
          type: 'inquiry' | 'application'
          name: string
          email: string
          phone?: string | null
          move_in_date?: string | null
          budget?: number | null
          note?: string | null
          status?: 'new' | 'contacted' | 'closed'
          created_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          listing_id?: string
          type?: 'inquiry' | 'application'
          name?: string
          email?: string
          phone?: string | null
          move_in_date?: string | null
          budget?: number | null
          note?: string | null
          status?: 'new' | 'contacted' | 'closed'
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          created_at: string | null
          deposit_amount: number
          document_path: string | null
          end_date: string
          id: string
          monthly_rent: number
          org_id: string
          proposed_rent: number | null
          renewal_status:
            | Database["public"]["Enums"]["renewal_status_enum"]
            | null
          rent_due_day: number
          start_date: string
          status: string
          tenant_id: string
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_amount: number
          document_path?: string | null
          end_date: string
          id?: string
          monthly_rent: number
          org_id: string
          proposed_rent?: number | null
          renewal_status?:
            | Database["public"]["Enums"]["renewal_status_enum"]
            | null
          rent_due_day?: number
          start_date: string
          status?: string
          tenant_id: string
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_amount?: number
          document_path?: string | null
          end_date?: string
          id?: string
          monthly_rent?: number
          org_id?: string
          proposed_rent?: number | null
          renewal_status?:
            | Database["public"]["Enums"]["renewal_status_enum"]
            | null
          rent_due_day?: number
          start_date?: string
          status?: string
          tenant_id?: string
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          logo_path: string | null
          name: string
          plan_type: string
          plan_unit_limit: number
          province: string
          setup_completed_at: string | null
          slug: string
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_path?: string | null
          name: string
          plan_type?: string
          plan_unit_limit?: number
          province: string
          setup_completed_at?: string | null
          slug: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          plan_type?: string
          plan_unit_limit?: number
          province?: string
          setup_completed_at?: string | null
          slug?: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          active: boolean
          created_at: string | null
          deactivated_at: string | null
          email: string
          first_name: string | null
          id: string
          invite_accepted_at: string | null
          invite_sent_at: string | null
          invite_token: string | null
          last_name: string | null
          org_id: string
          phone: string | null
          role: string[]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          deactivated_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          last_name?: string | null
          org_id: string
          phone?: string | null
          role: string[]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          deactivated_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          invite_accepted_at?: string | null
          invite_sent_at?: string | null
          invite_token?: string | null
          last_name?: string | null
          org_id?: string
          phone?: string | null
          role?: string[]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string | null
          id: string
          name: string
          org_id: string
          owner_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          org_id: string
          owner_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string
          owner_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          city: string
          created_at: string | null
          id: string
          org_id: string
          owner_id: string | null
          photo_paths: string[] | null
          portfolio_id: string | null
          postal_code: string | null
          property_type: Database["public"]["Enums"]["property_type_enum"]
          province: string
          street_address: string
          updated_at: string | null
        }
        Insert: {
          city: string
          created_at?: string | null
          id?: string
          org_id: string
          owner_id?: string | null
          photo_paths?: string[] | null
          portfolio_id?: string | null
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type_enum"]
          province: string
          street_address: string
          updated_at?: string | null
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: string
          org_id?: string
          owner_id?: string | null
          photo_paths?: string[] | null
          portfolio_id?: string | null
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type_enum"]
          province?: string
          street_address?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          amenities: string[] | null
          asking_rent: number | null
          bathrooms: number
          bedrooms: number
          created_at: string | null
          floor: number | null
          id: string
          org_id: string
          property_id: string | null
          sq_footage: number | null
          status: string
          unit_number: string | null
          updated_at: string | null
        }
        Insert: {
          amenities?: string[] | null
          asking_rent?: number | null
          bathrooms?: number
          bedrooms?: number
          created_at?: string | null
          floor?: number | null
          id?: string
          org_id: string
          property_id?: string | null
          sq_footage?: number | null
          status?: string
          unit_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amenities?: string[] | null
          asking_rent?: number | null
          bathrooms?: number
          bedrooms?: number
          created_at?: string | null
          floor?: number | null
          id?: string
          org_id?: string
          property_id?: string | null
          sq_footage?: number | null
          status?: string
          unit_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      org_id: { Args: never; Returns: string }
      person_id: { Args: never; Returns: string }
      tables_without_rls: {
        Args: never
        Returns: {
          tablename: string
        }[]
      }
      user_role: { Args: never; Returns: string }
    }
    Enums: {
      property_type_enum:
        | "house"
        | "duplex"
        | "apartment_building"
        | "condo"
        | "townhouse"
        | "other"
      renewal_status_enum: "pending" | "sent" | "accepted" | "declined"
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
      property_type_enum: [
        "house",
        "duplex",
        "apartment_building",
        "condo",
        "townhouse",
        "other",
      ],
      renewal_status_enum: ["pending", "sent", "accepted", "declined"],
    },
  },
} as const
