export interface CheckoutView {
  contratoId: string;
  producto: string;
  nombreCompleto: string;
  monto: number;
  yaPagado: boolean;
  rechazado: boolean;
  expires: string;
  token: string;
  nonce: string;
}

const escapeHtml = (s: string) =>
  (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const scriptJson = (value: string) => JSON.stringify(value).replace(/</g, '\\u003c');

export function renderCheckout(v: CheckoutView): string {
  const monto = v.monto.toFixed(2);
  const waNumero = (process.env.HUNTER_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const waLink = waNumero
    ? `https://wa.me/${waNumero}?text=${encodeURIComponent(`Ya pagué ${v.contratoId}`)}`
    : '#';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Pagar contrato ${escapeHtml(v.contratoId)} — Hunter</title>
<style nonce="${escapeHtml(v.nonce)}">
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; background: #f4f6f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px 0; color: #111; }
  .card { background: #fff; max-width: 380px; width: 92%; border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.08); padding: 28px 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #111; }
  .sub { color: #667; font-size: 13px; margin-bottom: 18px; }
  .row { display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
  .row span:first-child { color: #667; }
  .row { gap: 12px; }
  .row span:last-child { text-align: right; overflow-wrap: anywhere; }
  .total { font-size: 22px; font-weight: 700; color: #111; margin: 18px 0; text-align: center; }
  label { display: block; font-size: 12px; color: #667; margin: 12px 0 4px; }
  input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; }
  button { width: 100%; margin-top: 20px; background: #075e54; color: #fff; border: none; border-radius: 10px; padding: 13px; font-size: 15px; font-weight: 600; cursor: pointer; }
  button.reject { margin-top: 10px; background: #fff; color: #c62828; border: 1px solid #c62828; }
  button:disabled { opacity: .6; cursor: default; }
  .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 12px; padding: 4px 10px; border-radius: 20px; margin-bottom: 14px; }
  .ok { text-align: center; padding: 20px 0; }
  .ok .check { font-size: 44px; }
  .lock { text-align: center; font-size: 11px; color: #999; margin-top: 14px; }
  .wa { display:block; margin-top:18px; background:#25D366; color:#fff; text-decoration:none;
        border-radius:10px; padding:13px; font-size:15px; font-weight:600; text-align:center; }
  .aviso { background:#fff8e1; border:1px solid #ffe082; border-radius:8px; padding:12px;
           font-size:13px; color:#5d4037; margin-top:16px; text-align:left; }
</style>
</head>
<body>
<div class="card">
  ${
    v.yaPagado
      ? `<div class="ok"><div class="check">✅</div><h1>Pago ya procesado</h1>
         <div class="aviso">📱 <b>Escríbenos por WhatsApp</b> para confirmar tu pago y recibir tu factura.</div>
         <a class="wa" href="${waLink}">Escribir por WhatsApp</a></div>`
      : v.rechazado
      ? `<div class="ok"><div class="check">❌</div><h1>Pago rechazado</h1><p class="sub">Registramos que no completaste el pago. Puedes retomarlo desde WhatsApp.</p></div>`
      : `
  <span class="badge">🔒 Pago simulado — Hunter</span>
  <h1>Confirmar pago</h1>
  <p class="sub">Contrato ${escapeHtml(v.contratoId)}</p>
  <div class="row"><span>Cliente</span><span>${escapeHtml(v.nombreCompleto || '—')}</span></div>
  <div class="row"><span>Producto</span><span>${escapeHtml(v.producto)}</span></div>
  <div class="total">$${monto}</div>
  <form id="f">
    <label for="cardName">Nombre en la tarjeta</label>
    <input id="cardName" value="${escapeHtml(v.nombreCompleto || '')}" readonly />
    <label for="cardNumber">Número de tarjeta de prueba</label>
    <input id="cardNumber" value="4242 4242 4242 4242" readonly />
    <button type="submit" id="btn">Confirmar pago $${monto}</button>
    <button type="button" id="btnReject" class="reject">Rechazar pago</button>
  </form>
  <p class="lock">Esto es un checkout simulado para pruebas. No se procesa ningún cobro real.</p>
  <script nonce="${escapeHtml(v.nonce)}">
    const CONTRATO = ${scriptJson(v.contratoId)};
    const WA_LINK = ${scriptJson(waLink)};
    const EXPIRES = ${scriptJson(v.expires)};
    const TOKEN = ${scriptJson(v.token)};
    const btn = document.getElementById('btn');
    const btnReject = document.getElementById('btnReject');

    async function emitir(status) {
      btn.disabled = true; btnReject.disabled = true;
      const res = await fetch('/api/pagos/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrato_id: CONTRATO, status, expires: EXPIRES, token: TOKEN }),
      });
      if (!res.ok) throw new Error('fallo');
      return res.json();
    }

    document.getElementById('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.textContent = 'Procesando…';
      try {
        await emitir('approved');
        document.querySelector('.card').innerHTML =
          '<div class="ok"><div class="check">✅</div><h1>¡Pago exitoso!</h1>' +
          '<div class="aviso">📱 <b>Escríbenos por WhatsApp en 5-10 minutos</b> para confirmar ' +
          'tu pago y recibir tu factura.</div>' +
          '<a class="wa" href="' + WA_LINK + '">Escribir por WhatsApp</a></div>';
      } catch (err) {
        btn.disabled = false; btnReject.disabled = false; btn.textContent = 'Reintentar pago';
        alert('No se pudo confirmar el pago. Intenta de nuevo.');
      }
    });

    btnReject.addEventListener('click', async () => {
      btnReject.textContent = 'Rechazando…';
      try {
        await emitir('rejected');
        document.querySelector('.card').innerHTML =
          '<div class="ok"><div class="check">❌</div><h1>Pago rechazado</h1>' +
          '<p class="sub">Registramos que no completaste el pago. Puedes retomarlo cuando quieras desde WhatsApp.</p></div>';
      } catch (err) {
        btn.disabled = false; btnReject.disabled = false; btnReject.textContent = 'Rechazar pago';
        alert('No se pudo registrar el rechazo. Intenta de nuevo.');
      }
    });
  </script>`
  }
</div>
</body>
</html>`;
}

