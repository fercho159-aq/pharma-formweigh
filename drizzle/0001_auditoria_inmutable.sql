-- ADR-004: la bitácora de auditoría es solo-INSERT. Ni la aplicación ni un UPDATE/DELETE
-- manual pueden alterar un asiento; TRUNCATE también queda bloqueado.
CREATE OR REPLACE FUNCTION auditoria_bloquear_cambios() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría es inmutable: % no permitido', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER auditoria_sin_update_delete
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_bloquear_cambios();
--> statement-breakpoint
CREATE TRIGGER auditoria_sin_truncate
  BEFORE TRUNCATE ON auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_bloquear_cambios();
