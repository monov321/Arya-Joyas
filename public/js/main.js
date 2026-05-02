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
  if (element) {
    if (value !== undefined && value !== null && value !== '') {
      element.textContent = value;
    } else {
      element.textContent = '';
    }
  }
}

function whatsappLink(settings, productName = '') {
  const number = (settings && settings.whatsappNumber) 
    ? settings.whatsappNumber.replace(/\D/g, '') 
    : '56979254260';
    
  const text = productName
    ? `Hola Arya, quiero consultar por ${productName}.`
    : 'Hola Arya, quiero consultar por sus joyas.';
    
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

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
  
  if (state.settings.topBarText) setText('#topBar', state.settings.topBarText);
  if (state.settings.heroSubtitle) setText('#heroSubtitle', state.settings.heroSubtitle);
  if (state.settings.heroTitle) setText('#heroTitle', state.settings.heroTitle);
  if (state.settings.heroText) setText('#heroText', state.settings.heroText);
  if (state.settings.aboutTitle) setText('#aboutTitle', state.settings.aboutTitle);
  if (state.settings.aboutText) setText('#aboutText', state.settings.aboutText);
  if (state.settings.ctaTitle) setText('#ctaTitle', state.settings.ctaTitle);
  if (state.settings.ctaText) setText('#ctaText', state.settings.ctaText);
  if (state.settings.email) setText('#footerEmail', state.settings.email);

  const whatsappHero = $('#whatsappHero');
  const whatsappCta = $('#whatsappCta');
  if (whatsappHero) whatsappHero.href = whatsappLink(state.settings);
  if (whatsappCta) whatsappCta.href = whatsappLink(state.settings);

  const instagram = $('#instagramLink');
  if (instagram && state.settings.instagramUrl) instagram.href = state.settings.instagramUrl;
}

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

function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  
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

  trapFocus(modal);
  (webpayButton.disabled ? $('#modalWhatsapp') : webpayButton)?.focus();
}

function closeProductModal() {
  const modal = $('#productModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  const collectionModal = $('#collectionModal');
  if (!collectionModal || !collectionModal.classList.contains('is-open')) {
    document.body.classList.remove('modal-open');
  }
  state.selectedProduct = null;
  setPaymentMessage('');
}

function redirectToWebpay({ url, token }) {
  if (!url || !token) return;
  
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

function createProductNode(product) {
  const template = $('#productCardTemplate');
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
  node.querySelector('.badge-category').textContent = product.featured ? 'Destacado' : (product.category || 'Arya');

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
  if (product.compareAtPrice) {
    compare.textContent = money.format(product.compareAtPrice);
  } else {
    compare.remove();
  }

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

  return node;
}

function renderProducts() {
  const grid = $('#productsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const products = state.products.filter(productMatchesFilter);

  if (!products.length) {
    grid.innerHTML = '<div class="loading-card">No hay productos visibles en esta categoría.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  products.forEach((product) => {
    fragment.appendChild(createProductNode(product));
  });
  grid.appendChild(fragment);
}

function renderCarousel() {
  const track = $('#carouselTrack');
  if (!track) return;
  track.innerHTML = '';

  if (!state.products.length) {
    track.innerHTML = '<div class="loading-card">No hay productos disponibles.</div>';
    return;
  }

  state.products.forEach((product) => {
    track.appendChild(createProductNode(product));
  });
}

function setupCarouselControls() {
  const track = $('#carouselTrack');
  const prev = $('.prev-btn');
  const next = $('.next-btn');

  if (!track || !prev || !next) return;

  const scrollAmount = 320;

  prev.addEventListener('click', () => {
    track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  });

  next.addEventListener('click', () => {
    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  });
}

let heroCarouselTimer = null;

function buildHeroCarousel(products) {
  const heroSection = document.getElementById('heroCarousel');
  const slidesEl = document.getElementById('heroSlides');
  const dotsEl = document.getElementById('heroDots');
  if (!slidesEl || !dotsEl || !heroSection) return;

  const pool = products.filter(p => p.imageUrl).slice(0, 8);
  if (!pool.length) return; 

  slidesEl.innerHTML = '';
  dotsEl.innerHTML = '';

  pool.forEach((product, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide' + (i === 0 ? ' is-active' : '');
    slide.style.backgroundImage = `url('${product.imageUrl}')`;
    slidesEl.appendChild(slide);

    const dot = document.createElement('span');
    dot.className = 'hero-dot' + (i === 0 ? ' is-active' : '');
    dotsEl.appendChild(dot);
  });

  let current = 0;
  const slides = slidesEl.querySelectorAll('.hero-slide');
  const dots = dotsEl.querySelectorAll('.hero-dot');

  function goTo(index) {
    if (slides.length === 0) return;
    slides[current].classList.remove('is-active');
    dots[current].classList.remove('is-active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('is-active');
    dots[current].classList.add('is-active');
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', (event) => {
      event.stopPropagation();
      if (heroCarouselTimer) clearInterval(heroCarouselTimer);
      goTo(i);
      heroCarouselTimer = setInterval(() => goTo(current + 1), 2700);
    });
  });

  heroSection.style.cursor = 'pointer';
  if (heroSection._heroClickHandler) {
    heroSection.removeEventListener('click', heroSection._heroClickHandler);
  }
  
  heroSection._heroClickHandler = (event) => {
    if (event.target.closest('button, a, .hero-dots')) return;
    if (pool[current]) {
      openProductModal(pool[current]);
    }
  };
  
  heroSection.addEventListener('click', heroSection._heroClickHandler);

  if (heroCarouselTimer) clearInterval(heroCarouselTimer);
  heroCarouselTimer = setInterval(() => goTo(current + 1), 2700);
}

async function loadSettings() {
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error('No se pudieron cargar los textos del sitio.');
  const json = await response.json();
  applySettings(json.data || json);
}

async function loadProducts() {
  const response = await fetch('/api/products?active=true');
  if (!response.ok) throw new Error('No se pudieron cargar los productos.');
  const json = await response.json();
  state.products = json.data || [];
  buildHeroCarousel(state.products);
  renderCarousel();
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
  document.querySelectorAll('[data-close-modal]').forEach((element) => {
    element.addEventListener('click', closeProductModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeProductModal();
  });

  document.addEventListener('click', (event) => {
    if (event.target.id === 'webpayButton' && !event.target.disabled) {
      startWebpayPayment();
    }
  });
}

function openCollectionModal() {
  const modal = $('#collectionModal');
  const grid = $('#collectionModalGrid');
  if (!modal || !grid) return;
  
  grid.innerHTML = '';
  
  if (!state.products.length) {
    grid.innerHTML = '<div class="loading-card">No hay productos disponibles actualmente.</div>';
  } else {
    const fragment = document.createDocumentFragment();
    state.products.forEach(product => {
      fragment.appendChild(createProductNode(product));
    });
    grid.appendChild(fragment);
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  trapFocus(modal);
}

function closeCollectionModal() {
  const modal = $('#collectionModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  const productModal = $('#productModal');
  if (!productModal || !productModal.classList.contains('is-open')) {
    document.body.classList.remove('modal-open');
  }
}

function setupColeccionLink() {
  const coleccionLink = document.querySelector('a[href="#coleccion"]');
  if (coleccionLink) {
    coleccionLink.addEventListener('click', (e) => {
      e.preventDefault();
      openCollectionModal();
    });
  }

  const closeBtn = $('#closeCollectionBtn');
  const closeBackdrop = $('#closeCollectionBackdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeCollectionModal);
  if (closeBackdrop) closeBackdrop.addEventListener('click', closeCollectionModal);
}

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]:not([href="#coleccion"]), button[data-scroll]').forEach(element => {
    element.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href') || this.getAttribute('data-scroll');
      if (targetId && targetId.startsWith('#')) {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          const headerOffset = 100;
          const elementPosition = targetElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });
}

async function init() {
  setupFilters();
  setupProductModal();
  setupSmoothScroll();
  setupCarouselControls();
  setupColeccionLink();
  try {
    await Promise.all([loadSettings(), loadProducts()]);
  } catch (error) {
    const grid = $('#productsGrid');
    if (grid) {
      grid.innerHTML = '<div class="loading-card">No se pudo conectar con el catálogo. Revisa que el servidor y MongoDB estén activos.</div>';
    }
    const track = $('#carouselTrack');
    if (track) {
      track.innerHTML = '<div class="loading-card">Error de conexión con la base de datos.</div>';
    }
  }
}

init();
