# Suscripción: un cuaderno nuevo cada 1 o 2 meses

## Cómo funciona para el cliente

1. En el primer mensaje toca **📅 Suscripción** y elige **cada mes** o **cada 2 meses**.
2. Da su nombre, cédula, ciudad y dirección (siempre es envío con LAAR, envío incluido en el precio).
3. Paga el primer envío con DeUna o transferencia y manda el comprobante.
4. **3 días antes de cada envío** le llega un recordatorio automático por WhatsApp:
   > Hola María 💙 Tu próximo cuaderno de la suscripción sale el 1 de diciembre. Total: $13.00 (envío incluido). ¿Lo pagamos?
   > [Pagar envío] [Cancelar suscripción]
5. Toca **Pagar envío**, paga y manda el comprobante, igual que una compra normal.
6. Puede cancelar cuando quiera escribiendo **cancelar** o con el botón del recordatorio.

> En Ecuador, DeUna y las transferencias no permiten cobrar automáticamente cada mes, por eso el cliente aprueba cada pago con un toque. Si más adelante quieres cobro automático con tarjeta, se puede integrar con una pasarela (Kushki, Payphone…).

## Lo que haces tú

| Cuándo | Qué haces |
|---|---|
| Llega un comprobante (primer pago o renovación) | `pagado AZ123`: el bot activa o renueva la suscripción y calcula el próximo envío |
| Despachas | `guia AZ123 <número>` como siempre |
| Quieres ver quiénes están suscritos | `suscripciones` |
| Quieres mandar el recordatorio antes | `recordar SUB123` |
| Alguien cancela | Te llega una alerta ❌ |

Los datos están en `data/subscriptions.json` (estado, frecuencia, próximo envío).

## Configurar

```
SUB_PRICE=13.00            # precio por envío, envío LAAR incluido
SUB_REMINDER_DAYS=3        # el recordatorio sale N días antes
SUB_REMINDER_TEMPLATE=recordatorio_suscripcion
SUB_TEMPLATE_LANG=es
```

⚠️ $13 es un ejemplo: con envío incluido, revisa que te deje margen.

## Paso obligatorio: crear la plantilla en WhatsApp (una sola vez)

WhatsApp no deja que un negocio escriba primero a un cliente si pasaron más de 24 h desde su último mensaje, salvo con una **plantilla aprobada**. El recordatorio usa una.

1. Entra a [business.facebook.com](https://business.facebook.com) → **WhatsApp Manager** → **Plantillas de mensajes** → **Crear plantilla**.
2. Categoría: **Utilidad**. Nombre: `recordatorio_suscripcion`. Idioma: **Español (es)**.
3. Cuerpo (copia exacto, con las variables):
   ```
   Hola {{1}} 💙 Tu próximo cuaderno de la suscripción sale el {{2}}. Total: {{3}} (envío incluido). ¿Lo pagamos?
   ```
   Ejemplos para la revisión: `María`, `1 de diciembre`, `$13.00`.
4. Botones → **Respuesta rápida**: `Pagar envío` y `Cancelar suscripción` (en ese orden).
5. Enviar a revisión. Normalmente se aprueba en minutos u horas.

Si cambias el nombre o el idioma, actualiza `SUB_REMINDER_TEMPLATE` / `SUB_TEMPLATE_LANG`. Los mensajes de plantilla de utilidad tienen un costo pequeño por mensaje: revisa la tarifa actual de Meta para Ecuador.
