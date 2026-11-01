// Thin client for the WhatsApp Cloud API (Meta Graph API).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

export function createWhatsApp({ whatsappToken, phoneNumberId, graphVersion }) {
  const base = `https://graph.facebook.com/${graphVersion}`;
  const auth = { Authorization: `Bearer ${whatsappToken}` };

  async function call(pathname, body) {
    const res = await fetch(`${base}/${pathname}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  // Download a media file a customer sent and re-upload it so we can send it to the owner.
  async function reupload(mediaId) {
    const meta = await fetch(`${base}/${mediaId}`, { headers: auth }).then((r) => r.json());
    const file = await fetch(meta.url, { headers: auth });
    if (!file.ok) throw new Error(`Media download failed: ${file.status}`);
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', meta.mime_type);
    form.append('file', new Blob([await file.arrayBuffer()], { type: meta.mime_type }), 'comprobante');
    const res = await fetch(`${base}/${phoneNumberId}/media`, { method: 'POST', headers: auth, body: form });
    if (!res.ok) throw new Error(`Media upload failed: ${res.status} ${await res.text()}`);
    return { id: (await res.json()).id, mime: meta.mime_type };
  }

  function toPayload(to, msg) {
    const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
    switch (msg.type) {
      case 'text':
        return { ...base, type: 'text', text: { body: msg.text, preview_url: true } };
      case 'image':
        return { ...base, type: 'image', image: { link: msg.link, caption: msg.caption } };
      case 'buttons':
        return {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'button',
            ...(msg.headerImage ? { header: { type: 'image', image: { link: msg.headerImage } } } : {}),
            body: { text: msg.text },
            action: {
              buttons: msg.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
            },
          },
        };
      // Approved template (needed to write first, outside the 24-hour window).
      // Body variables {{1}}, {{2}}... = msg.params; quick-reply buttons carry msg.buttons[i].id as payload.
      case 'template':
        return {
          ...base,
          type: 'template',
          template: {
            name: msg.name,
            language: { code: msg.lang },
            components: [
              { type: 'body', parameters: msg.params.map((p) => ({ type: 'text', text: String(p) })) },
              ...msg.buttons.map((b, i) => ({
                type: 'button',
                sub_type: 'quick_reply',
                index: String(i),
                parameters: [{ type: 'payload', payload: b.id }],
              })),
            ],
          },
        };
      case 'list':
        return {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: msg.text },
            action: {
              button: msg.button,
              sections: [
                {
                  title: 'Opciones',
                  rows: msg.rows.map((r) => ({ id: r.id, title: r.title, description: r.description })),
                },
              ],
            },
          },
        };
      default:
        throw new Error(`Unknown message type ${msg.type}`);
    }
  }

  return {
    async send(to, msg) {
      if (msg.type === 'forward_image') {
        const { id, mime } = await reupload(msg.mediaId);
        const kind = mime?.startsWith('image/') ? 'image' : 'document';
        return call(`${phoneNumberId}/messages`, {
          messaging_product: 'whatsapp',
          to,
          type: kind,
          [kind]: { id, caption: msg.caption, ...(kind === 'document' ? { filename: 'comprobante.pdf' } : {}) },
        });
      }
      return call(`${phoneNumberId}/messages`, toPayload(to, msg));
    },
    markRead: (messageId) =>
      call(`${phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
  };
}

// Turn a raw webhook message into the simple shape the flow understands.
export function parseIncoming(m, contacts = []) {
  const incoming = {
    id: m.id,
    from: m.from,
    referral: m.referral,
    // The customer's WhatsApp profile name (offered as a one-tap answer for "¿a nombre de quién?")
    profileName: contacts.find((c) => c.wa_id === m.from)?.profile?.name,
  };
  switch (m.type) {
    case 'text':
      incoming.text = m.text.body;
      break;
    case 'interactive':
      incoming.buttonId = m.interactive.button_reply?.id ?? m.interactive.list_reply?.id;
      incoming.text = m.interactive.button_reply?.title ?? m.interactive.list_reply?.title;
      break;
    case 'button': // quick-reply on a template message
      incoming.buttonId = m.button.payload;
      incoming.text = m.button.text;
      break;
    case 'image':
      incoming.imageId = m.image.id;
      incoming.text = m.image.caption;
      break;
    case 'document': // some people send the receipt as a PDF
      if (m.document.mime_type?.startsWith('image/') || m.document.mime_type === 'application/pdf') {
        incoming.imageId = m.document.id;
      }
      break;
    default:
      incoming.text = '';
  }
  return incoming;
}
