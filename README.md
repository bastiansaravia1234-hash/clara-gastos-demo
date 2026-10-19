# Clara · Tus finanzas, más claras

Aplicación local para cuentas, movimientos, gastos compartidos, metas, reportes y planificación mensual. Se publica en GitHub Pages bajo `/clara-gastos-demo/`.

## Planificador mensual

- Presupuesto independiente por mes y espacio: Vista general, Personal, Hogar o Pyme.
- Reserva de ahorro y saldo disponible después de los pagos pendientes.
- Estimación de margen diario limitada por el presupuesto y el saldo actual.
- Vencimientos únicos o mensuales; el día 31 se ajusta al último día de cada mes.
- Registro de pagos como gastos, con protección frente a doble registro del mismo vencimiento.
- Quitar y deshacer recordatorios sin borrar movimientos ya registrados.

Todo se guarda en el mismo objeto `clara-finanzas-v1` y se incluye en el respaldo JSON de Configuración. Las versiones anteriores de datos siguen siendo compatibles. No hay sincronización entre dispositivos ni cobros automáticos. Un pago ya registrado manualmente no debe registrarse otra vez desde el planificador. Los aportes de las metas son seguimiento y no descuentan dinero de cuentas; la reserva del planificador tampoco modifica metas.

## Código y comprobación

El repositorio original contiene los archivos compilados de la app React; no incluye su proyecto fuente ni archivos de dependencias. La nueva funcionalidad se mantiene como módulos editables:

- `features/planner-model.mjs`: cálculos y cambios inmutables de datos.
- `features/planner.mjs`: interfaz React sin pasos de compilación.
- `features/planner.css`: estilos adaptados a teléfono y escritorio.
- `tests/planner.test.mjs`: cálculos, fechas, registros duplicados y respaldo.

El bundle activo `assets/index-planner-6a865c66.js` importa el módulo y le pasa React, los datos actuales, su actualizador, el mes y el espacio seleccionados. Al recompilar la aplicación base, se debe conservar esta integración. Los bundles anteriores se conservan sin modificar.

```bash
node --check assets/index-planner-6a865c66.js
node --check features/planner.mjs
node --test tests/*.test.mjs
```

Para una vista local, sirve el directorio padre y abre `/clara-gastos-demo/`; los recursos de la app utilizan esa ruta base.

## Carga privada de movimientos

Los enlaces con fragmento `#importar=` permiten revisar e incorporar una carga manual antes de abrir la app. El formato JSON validado incluye `version`, un `id` estable de carga, `account` (`name`, `opening`) y `transactions` (`title`, `amount`, `kind`, `category`, `date`, `note`). Los registros personales se transportan en el fragmento privado del enlace y no se publican en este repositorio ni se envían como ruta al servidor.

La pantalla muestra saldo inicial, movimientos y saldo estimado. Por defecto agrega una cuenta sin cambiar registros existentes. Si hay datos de ejemplo, ofrece reemplazarlos explícitamente y conserva un respaldo local previo bajo `clara-respaldo-importacion-<id>`. Una carga ya aplicada no se duplica aunque se haya editado después. No modifica ni sincroniza ninguna cuenta bancaria. El fragmento se retira del enlace después de cargar o cancelar.

El arranque ahora pasa por `features/start.mjs`, que importa el mismo bundle existente después de la revisión. Los cálculos y cambios están en `features/import-data.mjs`.

También se puede abrir `importar.html` y seleccionar un archivo JSON privado, sin incluir los datos en un enlace. El archivo se lee localmente y pasa por la misma validación y revisión.

## Edición y diseño para iPhone

La entrada activa usa `features/start-v2.mjs` y `assets/index-rose-v2.js`. El bundle conserva el resto de la aplicación e integra `features/movements-v2.mjs`, mantenido como fuente editable junto con `features/movement-model.mjs`. La pantalla Movimientos permite editar categoría, ingreso/gasto, descripción, monto, cuenta, fecha y nota sin duplicar el registro.

El estilo rosado translúcido se define en `features/glass-v2.css`, con alternativa opaca, áreas seguras y reducción de movimiento. El manifiesto y los íconos permiten agregar Clara a la pantalla de inicio de iPhone. No hay conexión bancaria, sincronización entre dispositivos ni garantía de lanzamiento sin conexión.

El importador admite `ownerName`, `account.bank` y `replacesImportId`: una corrección conserva la cuenta, sustituye exclusivamente los movimientos de la carga previa y guarda un respaldo antes de escribir. Conserva registros manuales posteriores. Los datos de cartolas permanecen fuera del repositorio público.
