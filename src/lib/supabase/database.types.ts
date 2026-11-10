
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alineacion": {
                  Row: {
                    "actualizado_en": string,"creado_en": string,"esquema": string,"esquema_elegido_a_mano": boolean,"esquema_modificado_en": string | null,"hincha_id": string,"id": string,"partido_id": string,"puestos": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"creado_en"?: string,"esquema": string,"esquema_elegido_a_mano"?: boolean,"esquema_modificado_en"?: string | null,"hincha_id"?: string,"id"?: string,"partido_id": string,"puestos"?: NonNullable<Json>
                  }
                  Update: {
                    "actualizado_en"?: string,"creado_en"?: string,"esquema"?: string,"esquema_elegido_a_mano"?: boolean,"esquema_modificado_en"?: string | null,"hincha_id"?: string,"id"?: string,"partido_id"?: string,"puestos"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "alineacion_hincha_id_fkey"
      columns: ["hincha_id"]
isOneToOne: false
      referencedRelation: "perfil"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alineacion_partido_id_fkey"
      columns: ["partido_id"]
isOneToOne: false
      referencedRelation: "partido"
      referencedColumns: ["id"]
    }
                  ]
                },"club": {
                  Row: {
                    "es_seleccion": boolean,"escudo_path": string | null,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "es_seleccion"?: boolean,"escudo_path"?: string | null,"id": string,"nombre": string
                  }
                  Update: {
                    "es_seleccion"?: boolean,"escudo_path"?: string | null,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"convocatoria": {
                  Row: {
                    "actualizado_en": string,"creado_en": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"creado_en"?: string,"id"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"creado_en"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"convocatoria_jugador": {
                  Row: {
                    "convocatoria_id": string,"jugador_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "convocatoria_id": string,"jugador_id": string
                  }
                  Update: {
                    "convocatoria_id"?: string,"jugador_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "convocatoria_jugador_convocatoria_id_fkey"
      columns: ["convocatoria_id"]
isOneToOne: false
      referencedRelation: "convocatoria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "convocatoria_jugador_jugador_id_fkey"
      columns: ["jugador_id"]
isOneToOne: false
      referencedRelation: "jugador"
      referencedColumns: ["id"]
    }
                  ]
                },"convocatoria_partido": {
                  Row: {
                    "convocatoria_id": string,"partido_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "convocatoria_id": string,"partido_id": string
                  }
                  Update: {
                    "convocatoria_id"?: string,"partido_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "convocatoria_partido_convocatoria_id_fkey"
      columns: ["convocatoria_id"]
isOneToOne: false
      referencedRelation: "convocatoria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "convocatoria_partido_partido_id_fkey"
      columns: ["partido_id"]
isOneToOne: true
      referencedRelation: "partido"
      referencedColumns: ["id"]
    }
                  ]
                },"evento_disponibilidad": {
                  Row: {
                    "club_id": string,"disponibilidad_anterior": Database["public"]['Enums']["disponibilidad"],"disponibilidad_nueva": Database["public"]['Enums']["disponibilidad"],"id": string,"jugador_id": string,"momento": string,"motivo": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"disponibilidad_anterior": Database["public"]['Enums']["disponibilidad"],"disponibilidad_nueva": Database["public"]['Enums']["disponibilidad"],"id"?: string,"jugador_id": string,"momento"?: string,"motivo"?: string | null
                  }
                  Update: {
                    "club_id"?: string,"disponibilidad_anterior"?: Database["public"]['Enums']["disponibilidad"],"disponibilidad_nueva"?: Database["public"]['Enums']["disponibilidad"],"id"?: string,"jugador_id"?: string,"momento"?: string,"motivo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "evento_disponibilidad_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "club"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evento_disponibilidad_jugador_id_fkey"
      columns: ["jugador_id"]
isOneToOne: false
      referencedRelation: "jugador"
      referencedColumns: ["id"]
    }
                  ]
                },"jugador": {
                  Row: {
                    "actualizado_en": string,"club_id": string,"creado_en": string,"disponibilidad": Database["public"]['Enums']["disponibilidad"],"en_plantel": boolean,"id": string,"motivo_disponibilidad": string | null,"nombre": string,"numero": number | null,"posicion_natural": Database["public"]['Enums']["posicion_natural"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"club_id": string,"creado_en"?: string,"disponibilidad"?: Database["public"]['Enums']["disponibilidad"],"en_plantel"?: boolean,"id"?: string,"motivo_disponibilidad"?: string | null,"nombre": string,"numero"?: number | null,"posicion_natural": Database["public"]['Enums']["posicion_natural"]
                  }
                  Update: {
                    "actualizado_en"?: string,"club_id"?: string,"creado_en"?: string,"disponibilidad"?: Database["public"]['Enums']["disponibilidad"],"en_plantel"?: boolean,"id"?: string,"motivo_disponibilidad"?: string | null,"nombre"?: string,"numero"?: number | null,"posicion_natural"?: Database["public"]['Enums']["posicion_natural"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "jugador_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "club"
      referencedColumns: ["id"]
    }
                  ]
                },"notificacion_enviada": {
                  Row: {
                    "enviado_en": string,"hincha_id": string,"referencia": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enviado_en"?: string,"hincha_id": string,"referencia": string,"tipo": string
                  }
                  Update: {
                    "enviado_en"?: string,"hincha_id"?: string,"referencia"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notificacion_enviada_hincha_id_fkey"
      columns: ["hincha_id"]
isOneToOne: false
      referencedRelation: "perfil"
      referencedColumns: ["id"]
    }
                  ]
                },"once_real": {
                  Row: {
                    "actualizado_en": string,"cargado_en": string,"jugadores": (string)[],"partido_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"cargado_en"?: string,"jugadores": (string)[],"partido_id": string
                  }
                  Update: {
                    "actualizado_en"?: string,"cargado_en"?: string,"jugadores"?: (string)[],"partido_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "once_real_partido_id_fkey"
      columns: ["partido_id"]
isOneToOne: true
      referencedRelation: "partido"
      referencedColumns: ["id"]
    }
                  ]
                },"partido": {
                  Row: {
                    "actualizado_en": string,"club_id": string,"creado_en": string,"estado": Database["public"]['Enums']["estado_partido"],"id": string,"inicio": string,"rival_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"club_id": string,"creado_en"?: string,"estado"?: Database["public"]['Enums']["estado_partido"],"id"?: string,"inicio": string,"rival_id": string
                  }
                  Update: {
                    "actualizado_en"?: string,"club_id"?: string,"creado_en"?: string,"estado"?: Database["public"]['Enums']["estado_partido"],"id"?: string,"inicio"?: string,"rival_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partido_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "club"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partido_rival_id_fkey"
      columns: ["rival_id"]
isOneToOne: false
      referencedRelation: "rival"
      referencedColumns: ["id"]
    }
                  ]
                },"perfil": {
                  Row: {
                    "actualizado_en": string,"club_favorito_id": string | null,"creado_en": string,"id": string,"rol": Database["public"]['Enums']["rol"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"club_favorito_id"?: string | null,"creado_en"?: string,"id": string,"rol"?: Database["public"]['Enums']["rol"]
                  }
                  Update: {
                    "actualizado_en"?: string,"club_favorito_id"?: string | null,"creado_en"?: string,"id"?: string,"rol"?: Database["public"]['Enums']["rol"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfil_club_favorito_id_fkey"
      columns: ["club_favorito_id"]
isOneToOne: false
      referencedRelation: "club"
      referencedColumns: ["id"]
    }
                  ]
                },"resultado_votacion": {
                  Row: {
                    "alineaciones_que_cuentan": number,"calculado_en": string,"cierre": string,"detalle": Json | null,"esquema": string | null,"estado": string,"once": Json | null,"partido_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alineaciones_que_cuentan"?: number,"calculado_en"?: string,"cierre": string,"detalle"?: Json | null,"esquema"?: string | null,"estado": string,"once"?: Json | null,"partido_id": string
                  }
                  Update: {
                    "alineaciones_que_cuentan"?: number,"calculado_en"?: string,"cierre"?: string,"detalle"?: Json | null,"esquema"?: string | null,"estado"?: string,"once"?: Json | null,"partido_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resultado_votacion_partido_id_fkey"
      columns: ["partido_id"]
isOneToOne: true
      referencedRelation: "partido"
      referencedColumns: ["id"]
    }
                  ]
                },"rival": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"club_id": string | null,"creado_en": string,"escudo_path": string | null,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"club_id"?: string | null,"creado_en"?: string,"escudo_path"?: string | null,"id"?: string,"nombre": string
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"club_id"?: string | null,"creado_en"?: string,"escudo_path"?: string | null,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rival_club_id_fkey"
      columns: ["club_id"]
isOneToOne: true
      referencedRelation: "club"
      referencedColumns: ["id"]
    }
                  ]
                },"suscripcion_push": {
                  Row: {
                    "auth": string,"creado_en": string,"endpoint": string,"hincha_id": string,"id": string,"p256dh": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"creado_en"?: string,"endpoint": string,"hincha_id"?: string,"id"?: string,"p256dh": string,"user_agent"?: string | null
                  }
                  Update: {
                    "auth"?: string,"creado_en"?: string,"endpoint"?: string,"hincha_id"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suscripcion_push_hincha_id_fkey"
      columns: ["hincha_id"]
isOneToOne: false
      referencedRelation: "perfil"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "alineacion_puestos_validos":
{ Args: { "esquema": string,"puestos": Json }; Returns: boolean
                           },
"buscar_hinchas":
{ Args: { "texto": string }; Returns: {
              "club_favorito_id": string,"creado_en": string,"email": string,"id": string,"rol": Database["public"]['Enums']["rol"]
            }[]
                           },
"cambiar_club_favorito":
{ Args: { "club": string,"hincha": string }; Returns: string
                           },
"desprogramar_crons":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"elegir_club_favorito":
{ Args: { "club": string }; Returns: string
                           },
"es_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"guardar_convocatoria":
{ Args: { "convocatoria": string,"jugadores": (string)[],"partidos": (string)[] }; Returns: string
                           },
"mi_club_favorito":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"partido_tiene_alineaciones":
{ Args: { "partido": string }; Returns: boolean
                           },
"programar_crons":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"puedo_votar_partido":
{ Args: { "partido": string }; Returns: boolean
                           },
"puestos_de_esquema":
{ Args: { "esquema": string }; Returns: (string)[]
                           },
"registrar_suscripcion_push":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: undefined
                           },
"tengo_perfil":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"tiene_resultado":
{ Args: { "partido": string }; Returns: boolean
                           },
"votacion_abierta":
{ Args: { "ahora"?: string,"partido": string }; Returns: boolean
                           },
"votacion_de_partido":
{ Args: { "ahora"?: string,"partido": string }; Returns: {
              "abre": string,"cierra": string,"estado": string,"partido_id": string
            }[]
                           },
"votaciones_por_cerrar":
{ Args: { "ahora"?: string }; Returns: {
              "abre": string,"cierra": string,"club_id": string,"estado": string,"partido_id": string
            }[]
                           }
          }
          Enums: {
            "disponibilidad": "disponible"|"lesionado"|"suspendido"|"no_disponible","estado_partido": "programado"|"cancelado","posicion_natural": "ARQ"|"DEF"|"MED"|"DEL","rol": "hincha"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "disponibilidad": ["disponible", "lesionado", "suspendido", "no_disponible"],"estado_partido": ["programado", "cancelado"],"posicion_natural": ["ARQ", "DEF", "MED", "DEL"],"rol": ["hincha", "admin"]
          }
        }
} as const
