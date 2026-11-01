# Upselling: que el cliente lleve más cuadernos

El bot usa 6 técnicas, todas configurables desde `.env`:

| # | Técnica | Dónde aparece | Ejemplo |
|---|---|---|---|
| 1 | **Precio por volumen** (mientras más llevas, menos pagas) | Primer mensaje | "Desde 3 → $12.00 c/u" |
| 2 | **Anclaje de precio**: cada opción muestra cuánto ahorra | Lista de cantidades | "3 cuadernos · $36.00 ($12.00 c/u) · ahorras $9.00" |
| 3 | **Opción recomendada** destacada (la que da envío gratis) | Lista de cantidades | "3 cuadernos ⭐ Recomendado" |
| 4 | **"¡Espera!" + uno más**: el siguiente cuaderno se presenta por lo que cuesta *de verdad* | Después de elegir cantidad (solo una vez) | "Si llevas 3 en vez de 2, el extra te sale en solo $9.00 (normal $15.00) 😱" |
| 5 | **Umbral de envío gratis** | Envío, resumen y botón | "Por solo $4.50 más te llevas otro cuaderno y el envío es GRATIS" + botón **➕ Llevar 3** |
| 6 | **Ángulo regalo**: "uno para ti y otro para regalar" | Lista y oferta | "🎁 Ideal para regalar o para compartir con tu bestie" |

Además:
- Cantidad libre de **1 a 20** (opción "Otra cantidad"). **Más de 20** → el chat pasa a ti como **pedido mayorista** y te llega una alerta.
- La oferta "¡Espera!" solo aparece cuando uno más es *de verdad* mejor negocio (sube de nivel de precio o desbloquea envío gratis), y solo una vez por cliente, para no cansar.
- En tu alerta de pago verás "⬆️ aceptó upsell" para medir cuánto funciona.

## Configurar los precios

```
PRICE_TIERS=1:15,2:13.5,3:12,5:11   # cantidad mínima : precio por cuaderno
FREE_SHIPPING_FROM=3                # envío gratis desde N cuadernos (0 = nunca)
MAX_QTY=20                          # más que esto = mayorista con una persona
```

⚠️ **Estos precios son ejemplos.** Antes de lanzar, revisa tu margen: con 3 cuadernos a $12 y envío gratis, tú pagas el envío LAAR. Calcula `precio − costo del cuaderno − (envío ÷ cantidad)` para cada nivel y ajusta.

**Regla de oro:** no inventes escasez ("¡quedan 2!") ni "el más vendido" si no es cierto. Los jóvenes lo detectan y pierde confianza. Si un día es verdad (stock limitado, edición especial), ahí sí úsalo.
