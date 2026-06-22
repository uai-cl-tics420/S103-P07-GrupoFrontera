CREATE TABLE "activity_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" varchar(50) NOT NULL,
	"fecha" text NOT NULL,
	"hora_inicio" text,
	"hora_fin" text
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "cupos_por_dia" integer;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "is_tendencia" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "is_popular" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "disponible" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_reservations" ADD COLUMN "reserved_date" text;--> statement-breakpoint
ALTER TABLE "user_reservations" ADD COLUMN "reserved_time" text;--> statement-breakpoint
ALTER TABLE "activity_schedules" ADD CONSTRAINT "activity_schedules_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;