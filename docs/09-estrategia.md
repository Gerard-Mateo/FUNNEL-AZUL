# Estrategia del funnel: qué investigué y cómo lo apliqué

Objetivo: que el cliente llegue **lo más rápido posible** a sus datos y al pago, con **un solo upsell** bien puesto: la suscripción.

## El flujo final

| Paso | El cliente ve | Toques |
|---|---|---|
| 1 | Foto + precio + "envío o retiro gratis" | **[¡Lo quiero!]** |
| 2 | **El upsell**: Solo este / ⭐ Club / 💎 Anual | 1 toque |
| 3 | "Ciudad y dirección en un mensaje" (o **[Retiro]**) | escribe 1 mensaje |
| 4 | "¿A nombre de *María Pérez*?" (nombre de su WhatsApp) | **[✅ Sí]** |
| 5 | Cédula (solo envío) | escribe 1 mensaje |
| 6 | Resumen | **[✅ Confirmar y pagar]** |
| 7 | QR de DeUna directo | manda la captura |

**Antes:** 10 pasos y 2 momentos de upsell. **Ahora:** 7 pasos para un cliente nuevo y **5 para uno que vuelve**: el bot recuerda su nombre, cédula y dirección y solo pregunta "¿a la misma dirección?".

## Lo que encontré y cómo lo usé

### 1. Ofrecer el upgrade justo después del "sí"
Cuando alguien ya dijo que sí a algo pequeño, tiende a seguir diciendo que sí (compromiso y consistencia, Cialdini; "pie en la puerta", Freedman & Fraser 1966).
**Aplicado:** el primer mensaje no habla de suscripción. Solo pide el "¡Lo quiero!". El Club aparece **inmediatamente después**, antes de pedir datos, cuando el interés está más alto. Aparece **una sola vez**.

### 2. Tres opciones, la que quieres vender en el medio
Con 3 opciones la gente evita los extremos y elige la del medio: es el *efecto compromiso* (Simonson 1989; Simonson & Tversky 1992). Una opción más cara también sirve de *ancla* y hace ver razonable la del medio (Huber, Payne & Puto 1982; el famoso caso de suscripción de *The Economist* que cuenta Ariely).
**Aplicado:** `Solo este · $15` / `⭐ Club · $12 c/u` / `💎 Anual · $60`. El Club, tu objetivo, va en el medio y con ⭐. El Anual es el ancla y además la mejor oferta real.

### 3. Pocas opciones y fáciles de comparar
El famoso estudio de las mermeladas (Iyengar & Lepper 2000) dice que muchas opciones paralizan. Los meta-análisis muestran que eso **no siempre** pasa (Scheibehenne et al. 2010). Sí pasa cuando las opciones son **difíciles de comparar** (Chernev et al. 2015).
**Aplicado:** 3 botones, con el mismo formato y el precio en cada botón, para comparar de un vistazo. Quité el "pack de 3", la lista de cantidades y la segunda pregunta de upsell. "¿Quieres varios?" quedó en una línea chiquita: escribes el número y listo.

### 4. "GRATIS" pesa más que su valor en dinero
El *efecto precio cero* (Shampanier, Mazar & Ariely 2007): un descuento a $0 se siente desproporcionadamente mejor. En el caso del envío, la gente prefirió envío gratis a un descuento mayor en el producto.
**Aplicado:** el beneficio estrella del Club y del Anual es **envío GRATIS**, no un porcentaje.

### 5. El ahorro se ve grande sumado y el precio se ve chico por unidad
La forma de presentar el tiempo cambia cómo se percibe un monto. Los costos se ven menores por periodo pequeño (Gourville 1998, "pennies-a-day") y los montos grandes impresionan más acumulados (Gourville 2003).
**Aplicado:** el precio se muestra **por cuaderno** ($12 c/u, $10 c/u). El ahorro del Anual se muestra **acumulado** ("Ahorras $57 en el año").

### 6. Sin sorpresas en el costo
Los costos extra inesperados, sobre todo el envío, son de las primeras causas de abandono del checkout.
**Aplicado:** el envío ($4.50) aparece desde el primer mensaje y en la opción "Solo este".

### 7. Cada paso extra pierde gente
**Aplicado:**
- **Dirección y ciudad en un solo mensaje**, con un ejemplo.
- **El retiro en tienda es un botón dentro del paso de dirección**; ya no es una pregunta aparte.
- **El nombre se toma del perfil de WhatsApp**: un toque si parece un nombre real ("María Pérez"). Si es "✨ Mari ✨", se pregunta normal.
- **Clientes que vuelven**: "¿A la misma dirección?" y se saltan nombre y cédula.
- **Pago:** el QR de DeUna va directo. Transferencia queda a un toque. Ya no se pregunta "¿cómo quieres pagar?".
- **Resumen:** "Confirmar y pagar" en un solo botón.

### 8. Quitar el miedo al compromiso
**Aplicado:** "cancelas cuando quieras" en el Club. En el Anual, si cancela, igual recibe lo que ya pagó.

### 9. Ética (y buena reputación)
Los defaults son poderosísimos (Johnson & Goldstein 2003). Por eso **no** pre-inscribimos a nadie en la suscripción: el cliente siempre elige. Tampoco hay escasez falsa ni "el más vendido" inventado. Los jóvenes lo detectan y te cuesta la confianza.

## Por qué el Plan Anual te conviene a ti también
DeUna y las transferencias **no permiten cobro automático**. En el Club, cada mes el cliente tiene que pagar de nuevo, y en cada pago alguien se puede caer. El Anual es **un solo pago**: recibes el dinero por adelantado y no hay renovaciones mensuales que se pierdan. Por eso es el que más descuento tiene.

## Qué medir (en `data/orders.json`)
- **% que elige Club o Anual** (`plan`) sobre el total de ventas. No hay una cifra universal: mide tu punto de partida las primeras 2 semanas y de ahí intenta subirlo (por ejemplo, con más descuento en el Club).
- **% de chats que llegan a pagar.** Si mucha gente se queda en el paso 2, prueba quitar el Anual (2 opciones) y compara.
- **Qué anuncio vende más** (`adId`).
- **Cambia una sola cosa a la vez** y compara una semana contra otra.

## Siguiente nivel (cuando haya volumen)
**WhatsApp Flows**: un formulario nativo dentro de WhatsApp (nombre + cédula + dirección en una sola pantalla). Elimina 2 pasos más. Requiere crear el formulario en WhatsApp Manager; se puede agregar al bot después.

## Fuentes
- Compromiso y efecto decoy: [The Decision Lab / resúmenes](https://www.getmonetizely.com/articles/the-compromise-effect-why-do-consumers-gravitate-toward-the-middle-option), [Sketchplanations – decoy](https://www.sketchplanations.com/the-decoy-price)
- Precio cero: [Shampanier, Mazar & Ariely 2007](https://fds.duke.edu/db/aas/Economics/faculty/dan.ariely/publications/265998), [The Decision Lab](https://thedecisionlab.com/reference-guide/psychology/zero-price-effect), [The Hustle](https://thehustle.co/originals/why-free-stuff-makes-us-irrational)
- Pennies-a-day: [Gourville 1998](https://econpapers.repec.org/RePEc:oup:jconrs:v:24:y:1998:i:4:p:395-408), [Gourville 2003](https://link.springer.com/article/10.1023/A:1025467002310)
- Sobrecarga de opciones: [Scheibehenne et al. 2010](https://abcwest.cogs.indiana.edu/pmwiki/pdf/scheibehenne.options.2010.pdf), [A Better Test of Choice Overload](https://arxiv.org/pdf/2212.03931)
- Defaults: [Johnson & Goldstein](https://www.dangoldstein.com/papers/JohnsonGoldstein_Defaults_Transplantation2004.pdf)
- WhatsApp Flows: [Meta – Flows webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/flowswebhooks)
