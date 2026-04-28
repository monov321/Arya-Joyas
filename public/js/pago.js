const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
});

function $(selector) {
  return document.querySelector(selector);
}

function statusCopy(status) {
  const copy = {
    success: {
      title: 'Pago aprobado',
      text: 'Tu pago de prueba fue autorizado correctamente por Webpay.'
    },
    failed: {
      title: 'Pago rechazado',
      text: 'Webpay no autorizó este pago de prueba. Puedes intentar nuevamente desde el catálogo.'
    },
    cancelled: {
      title: 'Pago cancelado',
      text: 'El pago fue cancelado o expiró antes de completarse.'
    },
    error: {
      title: 'No se pudo confirmar el pago',
      text: 'Ocurrió un problema al confirmar la transacción con Webpay.'
    }
  };
  return copy[status] || copy.error;
}

function whatsappLink(settings, productName = '') {
  const number = (settings.whatsappNumber || '').replace(/\D/g, '');
  const text = productName
    ? `Hola Arya, acabo de pagar/consultar por ${productName}.`
    : 'Hola Arya, quiero consultar por mi compra.';
  if (!number) return '/#contacto';
  return `https://wa.me/+56979254260?text=${encodeURIComponent(text)}`;
}

async function loadSettings() {
  const response = await fetch('/api/settings');
  if (!response.ok) return {};
  return response.json();
}

async function loadOrder(buyOrder) {
  const response = await fetch(`/api/webpay/order/${encodeURIComponent(buyOrder)}`);
  if (!response.ok) throw new Error('No se pudo cargar la orden.');
  return response.json();
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status') || 'error';
  const buyOrder = params.get('order');
  const copy = statusCopy(status);
  const settings = await loadSettings();

  $('#paymentResultTitle').textContent = copy.title;
  $('#paymentResultText').textContent = copy.text;
  $('#paymentWhatsapp').href = whatsappLink(settings);

  if (!buyOrder) return;

  try {
    const order = await loadOrder(buyOrder);
    $('#paymentOrderBox').classList.remove('is-hidden');
    $('#paymentProductName').textContent = order.productSnapshot?.name || 'Producto Arya';
    $('#paymentQuantity').textContent = order.quantity || 1;
    $('#paymentAmount').textContent = money.format(order.amount || 0);
    $('#paymentBuyOrder').textContent = order.buyOrder;
    $('#paymentWhatsapp').href = whatsappLink(settings, order.productSnapshot?.name);
  } catch (error) {
    console.error(error);
  }
}

init();
