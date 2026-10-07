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

El bundle activo `assets/index-ZYbI82sx.js` importa el módulo y le pasa React, los datos actuales, su actualizador, el mes y el espacio seleccionados. Al recompilar la aplicación base, se debe conservar esta integración. Los bundles anteriores se conservan sin modificar.

```bash
node --check assets/index-ZYbI82sx.js
node --check features/planner.mjs
node --test tests/*.test.mjs
```

Para una vista local, sirve el directorio padre y abre `/clara-gastos-demo/`; los recursos de la app utilizan esa ruta base.
