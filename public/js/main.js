const state = {
  products: [],
  settings: {},
  activeFilter: 'all',
  selectedProduct: null
};

const cartState = {
  items: [],
  isOpen: false,
  total: 0
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
  webpayButton.textContent = stockCount <= 0 ? 'Producto agotado' : 'Añadir al carrito';

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

function loadCart() {
  const saved = localStorage.getItem('arya_cart');
  if (saved) {
    try {
      cartState.items = JSON.parse(saved);
    } catch (e) {
      cartState.items = [];
    }
  }
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('arya_cart', JSON.stringify(cartState.items));
  updateCartUI();
}

function formatMoney(amount) {
  return '$' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function openCart() {
  const drawer = document.getElementById('cartDrawer');
  if (drawer) {
    drawer.classList.add('is-open');
    document.body.classList.add('modal-open');
    cartState.isOpen = true;
  }
}

function closeCart() {
  const drawer = document.getElementById('cartDrawer');
  if (drawer) {
    drawer.classList.remove('is-open');
    const productModal = $('#productModal');
    const collectionModal = $('#collectionModal');
    if ((!productModal || !productModal.classList.contains('is-open')) && 
        (!collectionModal || !collectionModal.classList.contains('is-open'))) {
      document.body.classList.remove('modal-open');
    }
    cartState.isOpen = false;
  }
}

function addToCart(product, quantity = 1) {
  const productId = product.id || product._id;
  const existing = cartState.items.find(item => item.id === productId);
  
  if (existing) {
    existing.quantity += quantity;
  } else {
    cartState.items.push({
      id: productId,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      quantity: quantity
    });
  }
  
  saveCart();
  openCart();
}

function removeFromCart(id) {
  cartState.items = cartState.items.filter(item => item.id !== id);
  saveCart();
}

function updateQuantity(id, delta) {
  const item = cartState.items.find(i => i.id === id);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      removeFromCart(id);
    } else {
      saveCart();
    }
  }
}

function updateCartUI() {
  const container = document.getElementById('cartItemsContainer');
  const badge = document.getElementById('cartBadge');
  const headerCount = document.getElementById('cartHeaderCount');
  const totalEl = document.getElementById('cartTotalAmount');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');

  if (!container || !badge || !headerCount || !totalEl || !checkoutBtn) return;

  let totalItems = 0;
  let totalPrice = 0;

  cartState.items.forEach(item => {
    totalItems += item.quantity;
    totalPrice += item.price * item.quantity;
  });

  if (totalItems > 0) {
    badge.textContent = totalItems;
    badge.classList.remove('is-hidden');
    badge.classList.remove('pop');
    void badge.offsetWidth;
    badge.classList.add('pop');
  } else {
    badge.classList.add('is-hidden');
  }

  headerCount.textContent = `${totalItems} items`;
  totalEl.textContent = formatMoney(totalPrice);

  if (cartState.items.length === 0) {
    container.innerHTML = `<div class="cart-empty"><svg viewBox="0 0 24 24"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg><p>Tu carrito está vacío</p></div>`;
    checkoutBtn.disabled = true;
  } else {
    checkoutBtn.disabled = false;
    container.innerHTML = cartState.items.map(item => `
      <div class="cart-item">
        <img class="cart-item-img" src="${item.imageUrl || '/assets/logo.png'}" alt="${item.name}">
        <div class="cart-item-info">
          <p class="cart-item-name">${item.name}</p>
          <p class="cart-item-category">${item.category || ''}</p>
          <p class="cart-item-price">${formatMoney(item.price)}</p>
        </div>
        <div class="cart-item-controls">
          <div class="qty-control">
            <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
            <span class="qty-value">${item.quantity}</span>
            <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  }
}

async function processCartCheckout() {
  const btn = document.getElementById('cartCheckoutBtn');
  const msg = document.getElementById('cartPaymentMsg');
  
  if (cartState.items.length === 0) return;
  
  btn.disabled = true;
  btn.textContent = 'Procesando...';
  msg.textContent = '';
  msg.style.color = 'inherit';

  try {
    const response = await fetch('/api/webpay/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart: cartState.items })
    });
    
    const data = await response.json();
    
    if (data.success && data.url && data.token) {
      const form = document.createElement('form');
      form.action = data.url;
      form.method = 'POST';
      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token_ws';
      tokenInput.value = data.token;
      form.appendChild(tokenInput);
      document.body.appendChild(form);
      form.submit();
    } else {
      msg.textContent = data.message || 'Error al iniciar pago.';
      msg.style.color = '#a33b50';
      btn.disabled = false;
      btn.textContent = 'Ir a Pagar';
    }
  } catch (error) {
    msg.textContent = 'Error de conexión con el servidor.';
    msg.style.color = '#a33b50';
    btn.disabled = false;
    btn.textContent = 'Ir a Pagar';
  }
}

function handleModalAddToCart() {
  if (!state.selectedProduct) return;
  
  const rawQty = Number($('#modalProductQuantity')?.value || 1);
  const stockCount = safeStock(state.selectedProduct);
  const quantity = Math.max(1, Math.min(stockCount, rawQty, 10));

  if (stockCount <= 0) {
    setPaymentMessage('Este producto no tiene stock disponible.', false);
    return;
  }

  addToCart(state.selectedProduct, quantity);
  closeProductModal();
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
  detailButton.addEventListener('click', (e) => {
    e.stopPropagation();
    openProductModal(product);
  });
  detailButton.textContent = isOut ? 'Ver detalle' : 'Ver información';

  const cartButton = node.querySelector('.add-to-cart-quick');
  if (cartButton) {
    if (isOut) {
      cartButton.disabled = true;
      cartButton.textContent = 'Agotado';
    } else {
      cartButton.addEventListener('click', (e) => {
        e.stopPropagation();
        addToCart(product, 1);
        cartButton.textContent = 'Añadido';
        cartButton.classList.add('added');
        setTimeout(() => {
          cartButton.textContent = 'Al carrito';
          cartButton.classList.remove('added');
        }, 2000);
      });
    }
  }

  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Ver información de ${product.name}`);
  card.addEventListener('click', (event) => {
    if (event.target.closest('button, a')) return;
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
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error HTTP: ${response.status} - ${errorText.substring(0, 50)}`);
  }
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
      handleModalAddToCart();
    }
  });
}

function setupCartControls() {
  loadCart();
  const openBtn = document.getElementById('openCartBtn');
  const closeBtn = document.getElementById('closeCartBtn');
  const backdrop = document.getElementById('cartBackdrop');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  
  if (openBtn) openBtn.addEventListener('click', openCart);
  if (closeBtn) closeBtn.addEventListener('click', closeCart);
  if (backdrop) backdrop.addEventListener('click', closeCart);
  if (checkoutBtn) checkoutBtn.addEventListener('click', processCartCheckout);
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
  const cartDrawer = $('#cartDrawer');
  if ((!productModal || !productModal.classList.contains('is-open')) && 
      (!cartDrawer || !cartDrawer.classList.contains('is-open'))) {
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
  setupCartControls();
  setupSmoothScroll();
  setupCarouselControls();
  setupColeccionLink();
  try {
    await Promise.all([loadSettings(), loadProducts()]);
  } catch (error) {
    const grid = $('#productsGrid');
    if (grid) {
      grid.innerHTML = '<div class="loading-card">No se pudo conectar con el catálogo. Asegúrate de que el backend y la base de datos estén corriendo correctamente.</div>';
    }
    const track = $('#carouselTrack');
    if (track) {
      track.innerHTML = '<div class="loading-card">Error de conexión con la base de datos.</div>';
    }
    console.error("Detalle del error de inicialización:", error);
  }
}

init();
