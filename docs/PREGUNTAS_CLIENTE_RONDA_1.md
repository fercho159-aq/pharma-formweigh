# Preguntas al cliente — Ronda 1

PharmaWeigh · preparado 2026-09-18 · Método MAW §1: *lo que no está decidido por el cliente no se inventa; se pregunta.*

Cómo usar este documento: se envía tal cual (o se recorre en llamada). **Cada respuesta se copia literal** a `PLAN.md §1`
con fecha y nombre de quien respondió. La ronda 2 se arma con lo que salga de aquí. Para cada pregunta se indica qué hace
el sistema **hoy**, para que el cliente solo tenga que decir "así está bien" o "cámbialo".

## A. Firma y segregación de funciones

1. ¿Puede firmar una fase la misma persona que la pesó? (p. ej. un supervisor que dispensa y luego firma).
   *Hoy:* el Operario nunca firma; Supervisor y Admin pueden pesar **y** firmar lo que pesaron.
2. ¿Quién debe poder firmar: Supervisor, Calidad, ambos? ¿Hay fases que exijan específicamente a Calidad?
   *Hoy:* firma cualquiera de Supervisor, Calidad o Admin.
3. ¿Se requiere una segunda firma (doble verificación) para materiales marcados como peligrosos o para principios activos?
   *Hoy:* una firma por fase, sin distinción.

## B. Pesaje

4. Un peso fuera de tolerancia, ¿se rechaza siempre o existe un flujo de **desviación autorizada** por Calidad?
   *Hoy:* se rechaza; no hay forma de registrarlo.
5. ¿Qué báscula(s) usan? Marca, modelo, salida (USB / RS-232 / Ethernet), resolución. ¿Quieren captura automática del peso?
   *Hoy:* el operario teclea el peso. ¿Se pesa con tara / por diferencia?
6. ¿Un ingrediente puede surtirse de **dos lotes** cuando uno no alcanza? *Hoy:* no, un lote por ingrediente.
7. ¿Un pesaje confirmado puede corregirse? ¿Quién autoriza y cómo debe quedar en bitácora? *Hoy:* no se corrige.
8. ¿Qué unidades manejan además de kg y L? ¿Cuántos decimales necesita cada tipo de material? *Hoy:* 4 decimales.

## C. Lotes de materia prima

9. ¿Quién aprueba y rechaza lotes? *Hoy (según sus manuales):* Calidad, Supervisor y Admin; Almacén solo recibe y retiene.
   ¿Debe poder el Supervisor, o solo Calidad?
10. La fecha de caducidad impresa, ¿es el **último día de uso** o el primer día en que ya no se usa?
    *Hoy (criterio conservador):* el lote deja de ser utilizable a las 00:00 del día de caducidad.
11. ¿FEFO obligatorio? (que el sistema exija usar primero el lote que caduca antes). *Hoy:* no lo exige.
12. ¿Hay **re-análisis** que extienda la vigencia? ¿Quién marca un lote como caducado? *Hoy:* nadie; se bloquea por fecha.
13. ¿El certificado de análisis (COA) debe adjuntarse o validarse? *Hoy:* solo se captura una referencia de texto.
14. Un lote rechazado, ¿puede reabrirse? *Hoy:* es definitivo.

## D. Órdenes y recetas

15. ¿Quién cierra una orden (`DISPENSADO → COMPLETADA`) y qué significa "completada" para ustedes?
16. ¿Quién puede **cancelar** una orden y qué pasa con el material ya pesado (¿regresa a inventario, se da de baja?).
    *Hoy:* no hay cancelación en pantalla.
17. Recetas: ¿cómo versionan y aprueban cambios? ¿Una receta ya usada en órdenes puede editarse?
    *Hoy:* no hay edición; se crea una receta nueva.
18. ¿Necesitan imprimir el registro del dispensado (hoja de lote / batch record)? ¿Con qué formato y firmas?

## E. Usuarios y acceso

19. Política de contraseñas: longitud, caducidad, historial. *Hoy:* mínimo 10 caracteres, sin caducidad.
20. Cierre de sesión por inactividad, ¿a los cuántos minutos? *Hoy:* la sesión dura 24 h fijas.
21. Bloqueo por intentos: *hoy* 5 fallos bloquean 15 minutos. ¿Correcto? ¿Quién debe poder desbloquear?
22. ¿Quién da de alta, da de baja y restablece contraseñas? *Hoy:* alta en pantalla (Admin); baja y restablecimiento por consola.
23. ¿Usarán gafete con código de barras para identificarse? *Hoy:* el gafete se imprime pero no inicia sesión.

## F. Regulatorio y datos

24. ¿Qué marco les aplica y qué exige su área de Calidad: NOM-059, NOM-164, 21 CFR Part 11, otro?
    ¿Requieren **validación del sistema** (CSV, IQ/OQ/PQ)? *Hoy:* el sistema **no está validado**; se cotiza aparte.
25. ¿Cuánto tiempo deben conservarse la bitácora y los registros de dispensado? ¿Necesitan exportarlos?
26. ¿De dónde sale el catálogo real de materiales, proveedores y recetas? ¿Hay ERP/LIMS/MES que sea la fuente de verdad?
27. ¿Cuántas estaciones de pesaje, cuántos usuarios y cuántas órdenes al mes? (dimensiona servidor y respaldos).
28. ¿Cómo debe llamarse el cliente y el producto en pantallas y documentos?

## G. Lo que NO entra en esta fase (confirmar)

29. Confirmar que quedan **fuera**: integración con báscula, integración con ERP, validación CSV, producto terminado /
    liberación de lote, etiquetado de producto. Si algo de esto es indispensable para arrancar, decirlo ahora.
