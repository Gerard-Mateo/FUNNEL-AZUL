# Suscripción: Club Azul y Plan Anual

Se ofrece **después** del "¡Lo quiero!", como el upsell (ver [07-upselling.md](07-upselling.md)). Siempre es con envío LAAR incluido.

| | Club Azul ⭐ | Plan Anual 💎 |
|---|---|---|
| Cómo paga | Antes de cada envío (un toque) | Una sola vez por el año |
| Precio (ejemplo) | $12 por cuaderno | $10 por cuaderno ($60 por 6) |
| Frecuencia | Cada 2 meses (o cada mes) | Igual |
| Unos días antes de cada envío | Al **cliente** le llega "¿La renovamos? [Pagar]" | A **ti** te llega "📦 Toca enviar" |
| Al cancelar | No se cobra más | Recibe lo que ya pagó y no se renueva |

## Lo que haces tú

| Cuándo | Qué haces |
|---|---|
| Llega un comprobante | `pagado AZ123`: el bot activa o renueva y calcula el próximo envío |
| Despachas un pedido o renovación | `guia AZ123 <número>` |
| Te llega "📦 Toca enviar" (Plan Anual) | Despachas y escribes `guia SUB123 <número>` |
| Ver suscripciones | `suscripciones` |
| Pedir el pago antes de tiempo | `recordar SUB123` |

Datos en `data/subscriptions.json` y `data/customers.json` (los datos guardados de clientes que vuelven).

## Paso obligatorio: crear 2 plantillas en WhatsApp (una sola vez)

WhatsApp no deja escribirle a un cliente si pasaron más de 24 h desde su último mensaje, salvo con **plantillas aprobadas**.

Entra a [business.facebook.com](https://business.facebook.com) → **WhatsApp Manager** → **Plantillas de mensajes** → **Crear plantilla**. Para ambas: categoría **Utilidad** e idioma **Español (es)**.

**1. `recordatorio_suscripcion`**
```
Hola {{1}} 💙 Tu suscripción de El Cuaderno Azul se renueva el {{2}}. Total: {{3}} (envío incluido). ¿La renovamos?
```
Ejemplos: `María`, `1 de diciembre`, `$12.00`. Botones de **respuesta rápida**: `Pagar` y `Cancelar suscripción`, en ese orden.

**2. `envio_en_camino`**
```
Hola {{1}} 📦 Tu cuaderno ya va en camino con LAAR. Guía: {{2}}. ¡Gracias! 💙
```
Ejemplos: `María`, `0012345`. Sin botones.

El bot usa la segunda solo cuando hace falta, es decir, cuando la guía sale más de 24 h después del último mensaje del cliente. Si cambias nombres o idioma, actualiza `TEMPLATE_RENEWAL`, `TEMPLATE_SHIPPING` y `TEMPLATE_LANG`. Cada mensaje de plantilla tiene un costo pequeño: revisa la tarifa de Meta para Ecuador.
