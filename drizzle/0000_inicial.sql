CREATE TYPE "public"."estado_lote" AS ENUM('CUARENTENA', 'APROBADO', 'RECHAZADO', 'AGOTADO', 'CADUCADO');--> statement-breakpoint
CREATE TYPE "public"."estado_orden" AS ENUM('PENDIENTE', 'EN_PROCESO', 'DISPENSADO', 'COMPLETADA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('ADMIN', 'SUPERVISOR', 'OPERARIO', 'DESARROLLO', 'CALIDAD', 'ALMACEN', 'AUDITOR');--> statement-breakpoint
CREATE SEQUENCE "public"."orden_numero_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text NOT NULL,
	"detalles" text DEFAULT '{}' NOT NULL,
	"ip" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispensados" (
	"id" text PRIMARY KEY NOT NULL,
	"orden_id" text NOT NULL,
	"fase_id" text NOT NULL,
	"ingrediente_id" text NOT NULL,
	"lote_id" text NOT NULL,
	"operario_id" text NOT NULL,
	"material_nombre" text NOT NULL,
	"cantidad_target" numeric(14, 4) NOT NULL,
	"cantidad_real" numeric(14, 4) NOT NULL,
	"tolerancia_ok" boolean NOT NULL,
	"paso" integer NOT NULL,
	"firma_electronica" text,
	"supervisor_id" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispensados_real_positiva" CHECK ("dispensados"."cantidad_real" > 0)
);
--> statement-breakpoint
CREATE TABLE "fases" (
	"id" text PRIMARY KEY NOT NULL,
	"receta_id" text NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer NOT NULL,
	"instrucciones" text
);
--> statement-breakpoint
CREATE TABLE "firmas_fase" (
	"id" text PRIMARY KEY NOT NULL,
	"orden_id" text NOT NULL,
	"fase_id" text NOT NULL,
	"supervisor_id" text NOT NULL,
	"firma_electronica" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredientes" (
	"id" text PRIMARY KEY NOT NULL,
	"receta_id" text NOT NULL,
	"fase_id" text NOT NULL,
	"material_id" text NOT NULL,
	"orden" integer NOT NULL,
	"cantidad_target" numeric(14, 4) NOT NULL,
	"tolerancia_min" numeric(5, 2) DEFAULT -2 NOT NULL,
	"tolerancia_max" numeric(5, 2) DEFAULT 2 NOT NULL,
	"instrucciones" text,
	"peligroso" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ingredientes_target_positivo" CHECK ("ingredientes"."cantidad_target" > 0),
	CONSTRAINT "ingredientes_tolerancia_valida" CHECK ("ingredientes"."tolerancia_min" <= 0 AND "ingredientes"."tolerancia_max" >= 0)
);
--> statement-breakpoint
CREATE TABLE "intentos_acceso" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"clave" text NOT NULL,
	"exito" boolean NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lotes" (
	"id" text PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"material_id" text NOT NULL,
	"cantidad" numeric(14, 4) NOT NULL,
	"cantidad_inicial" numeric(14, 4) NOT NULL,
	"fecha_recepcion" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_caducidad" timestamp with time zone NOT NULL,
	"proveedor" text NOT NULL,
	"estado" "estado_lote" DEFAULT 'CUARENTENA' NOT NULL,
	"certificado" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lotes_numero_unique" UNIQUE("numero"),
	CONSTRAINT "lotes_cantidad_no_negativa" CHECK ("lotes"."cantidad" >= 0),
	CONSTRAINT "lotes_inicial_positiva" CHECK ("lotes"."cantidad_inicial" > 0)
);
--> statement-breakpoint
CREATE TABLE "materiales" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"unidad" text NOT NULL,
	"stock_minimo" numeric(14, 4) DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "materiales_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "ordenes_produccion" (
	"id" text PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"receta_id" text NOT NULL,
	"lote_producto" text NOT NULL,
	"cantidad" numeric(14, 4) DEFAULT 1 NOT NULL,
	"estado" "estado_orden" DEFAULT 'PENDIENTE' NOT NULL,
	"prioridad" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ordenes_produccion_numero_unique" UNIQUE("numero"),
	CONSTRAINT "ordenes_cantidad_positiva" CHECK ("ordenes_produccion"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE "recetas" (
	"id" text PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"descripcion" text,
	"rendimiento" numeric(14, 4) NOT NULL,
	"unidad_rendimiento" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recetas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"usuario_id" text NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sesiones_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" DEFAULT 'OPERARIO' NOT NULL,
	"badge" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email"),
	CONSTRAINT "usuarios_badge_unique" UNIQUE("badge")
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensados" ADD CONSTRAINT "dispensados_orden_id_ordenes_produccion_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_produccion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensados" ADD CONSTRAINT "dispensados_fase_id_fases_id_fk" FOREIGN KEY ("fase_id") REFERENCES "public"."fases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensados" ADD CONSTRAINT "dispensados_ingrediente_id_ingredientes_id_fk" FOREIGN KEY ("ingrediente_id") REFERENCES "public"."ingredientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensados" ADD CONSTRAINT "dispensados_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensados" ADD CONSTRAINT "dispensados_operario_id_usuarios_id_fk" FOREIGN KEY ("operario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispensados" ADD CONSTRAINT "dispensados_supervisor_id_usuarios_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fases" ADD CONSTRAINT "fases_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firmas_fase" ADD CONSTRAINT "firmas_fase_orden_id_ordenes_produccion_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_produccion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firmas_fase" ADD CONSTRAINT "firmas_fase_fase_id_fases_id_fk" FOREIGN KEY ("fase_id") REFERENCES "public"."fases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "firmas_fase" ADD CONSTRAINT "firmas_fase_supervisor_id_usuarios_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredientes" ADD CONSTRAINT "ingredientes_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredientes" ADD CONSTRAINT "ingredientes_fase_id_fases_id_fk" FOREIGN KEY ("fase_id") REFERENCES "public"."fases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredientes" ADD CONSTRAINT "ingredientes_material_id_materiales_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_material_id_materiales_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materiales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_timestamp_idx" ON "auditoria" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "auditoria_usuario_idx" ON "auditoria" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispensados_orden_ingrediente_uq" ON "dispensados" USING btree ("orden_id","ingrediente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fases_receta_orden_uq" ON "fases" USING btree ("receta_id","orden");--> statement-breakpoint
CREATE UNIQUE INDEX "firmas_orden_fase_uq" ON "firmas_fase" USING btree ("orden_id","fase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingredientes_receta_orden_uq" ON "ingredientes" USING btree ("receta_id","orden");--> statement-breakpoint
CREATE INDEX "intentos_clave_idx" ON "intentos_acceso" USING btree ("tipo","clave","timestamp");--> statement-breakpoint
CREATE INDEX "lotes_material_idx" ON "lotes" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones" USING btree ("usuario_id");