const state = {
  products: [],
  settings: {},
  activeFilter: 'all',
  selectedProduct: null
};

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
});

const fallbackImage = '/assets/logo.png';

function $(selector) {
  return document.querySelector(selector);
}

function setText(selector, value) {
  const element = $(selector);
  if (element && value) element.textContent = value;
}

function whatsappLink(settings, productName = '') {
  const number = (settings.whatsappNumber || '').replace(/\D/g, '') || '56979254260';
  const text = productName
    ? `Hola Arya, quiero consultar por ${productName}.`
    : 'Hola Arya, quiero consultar por sus joyas.';
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

// FIX 3: stock con fallback seguro contra undefined/NaN
function safeStock(product) {
  return Number(product.stock ?? 0) || 0;
}

function stockCopy(product) {
  const stock = safeStock(product);
  if (stock <= 0) return { label: 'Agotado', className: 'is-out' };
  if (stock <= 3) return { label: `Últimas ${stock} unidades`, className: 'is-low' };
  return { label: `${stock} disponibles`, className: '' };
}

function stockLine(product) {
  const stock = safeStock(product);
  if (stock <= 0) return 'Sin stock';
  if (stock === 1) return '1 unidad disponible';
  return `${stock} unidades disponibles`;
}

function applySettings(settings) {
  state.settings = settings || {};
  setText('#topBar', settings.topBarText);
  setText('#heroSubtitle', settings.heroSubtitle);
  setText('#heroTitle', settings.heroTitle);
  setText('#heroText', settings.heroText);
  setText('#aboutTitle', settings.aboutTitle);
  setText('#aboutText', settings.aboutText);
  setText('#ctaTitle', settings.ctaTitle);
  setText('#ctaText', settings.ctaText);
  setText('#footerEmail', settings.email);

  const heroImage = $('#heroImage');
  if (heroImage && settings.heroImageUrl) heroImage.src = settings.heroImageUrl;

  const whatsappHero = $('#whatsappHero');
  const whatsappCta = $('#whatsappCta');
  if (whatsappHero) whatsappHero.href = whatsappLink(settings);
  if (whatsappCta) whatsappCta.href = whatsappLink(settings);

  const instagram = $('#instagramLink');
  if (instagram && settings.instagramUrl) instagram.href = settings.instagramUrl;
}

// FIX 4: comparación de categoría normalizada (sin importar mayúsculas/minúsculas)
function productMatchesFilter(product) {
  if (state.activeFilter === 'all') return true;
  return (product.category || '').toLowerCase() === state.activeFilter.toLowerCase();
}

function setPaymentMessage(text, ok = true) {
  const element = $('#paymentMessage');
  if (!element) return;
  element.textContent = text;
  element.style.color = ok ? '#2d7a55' : '#a33b50';
}

// FIX 5: focus trap dentro del modal
function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  modal.addEventListener('keydown', function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    // limpiar listener al cerrar
    if (!modal.classList.contains('is-open')) {
      modal.removeEventListener('keydown', handler);
    }
  });
}

function openProductModal(product) {
  state.selectedProduct = product;
  const modal = $('#productModal');
  if (!modal) return;

  const image = $('#modalProductImage');
  image.src = product.imageUrl || fallbackImage;
  image.alt = product.name;
  image.onerror = () => {
    image.src = fallbackImage;
  };

  const stock = stockCopy(product);
  const stockCount = safeStock(product);
  const quantityInput = $('#modalProductQuantity');
  const webpayButton = $('#webpayButton');
  const stockBadge = $('#modalStockBadge');

  $('#modalProductCategory').textContent = product.category || 'Arya Joyas';
  $('#modalProductName').textContent = product.name;
  $('#modalProductDescription').textContent = product.description || 'Producto Arya disponible para consultar.';
  $('#modalProductMaterial').textContent = product.material || 'Consultar';
  $('#modalProductPrice').textContent = money.format(product.price || 0);
  $('#modalProductStock').textContent = stockLine(product);
  $('#modalWhatsapp').href = whatsappLink(state.settings, product.name);

  stockBadge.textContent = stock.label;
  stockBadge.className = `badge-stock ${stock.className}`.trim();

  quantityInput.value = 1;
  quantityInput.max = Math.max(1, Math.min(10, stockCount));
  quantityInput.disabled = stockCount <= 0;

  webpayButton.disabled = stockCount <= 0;
  webpayButton.textContent = stockCount <= 0 ? 'Producto agotado' : 'Pagar con Webpay test';

  setPaymentMessage('');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  // FIX 5: activar focus trap y mover foco al elemento correcto
  trapFocus(modal);
  (webpayButton.disabled ? $('#modalWhatsapp') : webpayButton)?.focus();
}

function closeProductModal() {
  const modal = $('#productModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  state.selectedProduct = null;
  setPaymentMessage('');
}

function redirectToWebpay({ url, token }) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'token_ws';
  input.value = token;

  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

async function startWebpayPayment() {
  if (!state.selectedProduct) return;
  const button = $('#webpayButton');
  const stockCount = safeStock(state.selectedProduct);
  const rawQty = Number($('#modalProductQuantity')?.value || 1);
  const quantity = Math.max(1, Math.min(stockCount, rawQty, 10));

  if (stockCount <= 0) {
    setPaymentMessage('Este producto no tiene stock disponible.', false);
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Conectando con Webpay...';
  setPaymentMessage('Creando transacción de prueba en Webpay...');

  try {
    const response = await fetch('/api/webpay/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: state.selectedProduct._id, quantity })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo iniciar el pago.');
    setPaymentMessage('Redirigiendo a Webpay test...');
    redirectToWebpay(data);
  } catch (error) {
    setPaymentMessage(error.message, false);
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderProducts() {
  const grid = $('#productsGrid');
  const template = $('#productCardTemplate');
  grid.innerHTML = '';

  const products = state.products.filter(productMatchesFilter);

  if (!products.length) {
    grid.innerHTML = '<div class="loading-card">No hay productos visibles en esta categoría.</div>';
    return;
  }

  products.forEach((product) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector('.product-card');
    const image = node.querySelector('.product-image');
    const stock = stockCopy(product);
    const stockCount = safeStock(product);
    const isOut = stockCount <= 0;

    image.src = product.imageUrl || fallbackImage;
    image.alt = product.name;
    image.onerror = () => {
      image.src = fallbackImage;
    };

    card.classList.toggle('is-sold-out', isOut);
    node.querySelector('.badge-category').textContent = product.featured ? 'Destacado' : product.category || 'Arya';

    const badgeStock = node.querySelector('.badge-stock');
    badgeStock.textContent = stock.label;
    badgeStock.className = `badge-stock ${stock.className}`.trim();

    node.querySelector('.product-category').textContent = product.category || 'Joyas';
    node.querySelector('.product-material').textContent = product.material || '';
    node.querySelector('.product-name').textContent = product.name;
    node.querySelector('.product-description').textContent = product.description || 'Producto Arya disponible para consultar.';
    node.querySelector('.price').textContent = money.format(product.price || 0);
    node.querySelector('.stock-label').textContent = stockLine(product);

    const compare = node.querySelector('.compare-price');
    if (product.compareAtPrice) compare.textContent = money.format(product.compareAtPrice);
    else compare.remove();

    const detailButton = node.querySelector('.product-detail-btn');
    detailButton.addEventListener('click', () => openProductModal(product));
    detailButton.textContent = isOut ? 'Ver detalle' : 'Ver información';

    const whatsappButton = node.querySelector('.whatsapp-product');
    whatsappButton.href = whatsappLink(state.settings, product.name);

    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Ver información de ${product.name}`);
    card.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      openProductModal(product);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openProductModal(product);
      }
    });

    grid.appendChild(node);
  });
}

async function loadSettings() {
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error('No se pudieron cargar los textos del sitio.');
  applySettings(await response.json());
}

async function loadProducts() {
  const response = await fetch('/api/products?active=true');
  if (!response.ok) throw new Error('No se pudieron cargar los productos.');
  state.products = await response.json();
  renderProducts();
}

function setupFilters() {
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      state.activeFilter = button.dataset.filter;
      renderProducts();
    });
  });
}

function setupProductModal() {
  // cerrar con backdrop y botón X
  document.querySelectorAll('[data-close-modal]').forEach((element) => {
    element.addEventListener('click', closeProductModal);
  });

  // cerrar con Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeProductModal();
  });

  // FIX 2: delegación de evento en lugar de buscar el botón directo
  // así funciona aunque el modal no esté visible al momento del setup
  document.addEventListener('click', (event) => {
    if (event.target.id === 'webpayButton' && !event.target.disabled) {
      startWebpayPayment();
    }
  });
}

async function init() {
  setupFilters();
  setupProductModal();
  try {
    await Promise.all([loadSettings(), loadProducts()]);
  } catch (error) {
    console.error(error);
    const grid = $('#productsGrid');
    if (grid) {
      grid.innerHTML = '<div class="loading-card">No se pudo conectar con el catálogo. Revisa que el servidor y MongoDB estén activos.</div>';
    }
  }
}

init();