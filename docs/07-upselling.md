# Upselling: simple y directo

Un solo momento de upsell, en la pregunta de cantidad. Sin preguntas extra.

```
¡Excelente elección! 🙌 ¿Cuántos quieres?

• 1 cuaderno: $15.00
• Pack de 3: $36.00 ($12.00 c/u) + envío GRATIS 🚚

[1 cuaderno]  [⭐ Pack de 3]  [Otra cantidad]
```

- El **pack** va justo al lado del cuaderno solo, con su precio por unidad y el envío gratis. Esa comparación es el upsell.
- **Otra cantidad** deja escribir cualquier número del 1 al 20. **Más de 20** pasa a ti como **pedido mayorista** (te llega una alerta).
- El resumen muestra "🎉 Ahorras $9.00" cuando llevan el pack.
- La otra forma de vender más es la **suscripción**: ver [08-suscripcion.md](08-suscripcion.md).

## Configurar

```
PRICE_TIERS=1:15,3:12     # cantidad mínima : precio por cuaderno. El 2º nivel es el "pack"
FREE_SHIPPING_FROM=3      # envío gratis desde N cuadernos (0 = nunca)
MAX_QTY=20                # más que esto = mayorista con una persona
```

⚠️ **Los precios son de ejemplo.** Con el pack a $12 c/u y envío gratis, el envío LAAR lo pagas tú. Revisa tu margen antes de lanzar.
