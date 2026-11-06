# 02: Catálogo de Esquemas y Tabla de Equivalencias

**What to build:** Definición estática de los Esquemas 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2 y 4-1-4-1, cada uno con 11 Puestos. Cada Puesto tiene un identificador estable, una etiqueta, coordenadas en la cancha y una marca de "es arquero". Incluye un Esquema por defecto (solo para mostrar) y la Tabla de Equivalencias escrita a mano, que para cada par de Esquemas asocia cada Puesto de origen con un Puesto de destino (ver ADR-0001 y `CONTEXT.md`). Es lógica pura, sin UI ni base de datos.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Cada Esquema tiene exactamente 11 Puestos y exactamente 1 Puesto de arquero
- [ ] La Tabla de Equivalencias cubre todos los pares (origen, destino) y todos los Puestos de origen
- [ ] El arquero siempre se asocia con el arquero
- [ ] La equivalencia de un Esquema consigo mismo es la identidad
- [ ] Hay un test que falla si se agrega un Esquema sin completar sus equivalencias
- [ ] Las asociaciones son razonables futbolísticamente (lado y línea), y se agrega un comentario donde la elección sea discutible
