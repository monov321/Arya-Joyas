const adminState = {
  products: [],
  settings: {}
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

function setMessage(selector, text, ok = true) {
  const element = $(selector);
  if (!element) return;
  element.textContent = text;
  element.style.color = ok ? '#2d7a55' : '#a33b50';
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw new Error(data.message || 'Ocurrió un error.');
  return data;
}

function showAdmin(authenticated) {
  $('#loginPanel').classList.toggle('is-hidden', authenticated);
  $('#adminPanel').classList.toggle('is-hidden', !authenticated);
}

async function checkAuth() {
  try {
    const response = await request('/api/admin/check');
    showAdmin(response.authenticated);
    if (response.authenticated) await loadAdminData();
  } catch (error) {
    console.error(error);
  }
}

function fillSettingsForm(settings) {
  const form = $('#settingsForm');
  Object.keys(settings || {}).forEach((key) => {
    if (form.elements[key]) form.elements[key].value = settings[key] || '';
  });
}

async function loadSettings() {
  try {
    const response = await request('/api/settings');
    adminState.settings = response.data || {};
    fillSettingsForm(adminState.settings);
  } catch (error) {
    console.error(error);
  }
}

function getProductPayload(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    name: data.name?.trim(),
    category: data.category?.trim() || 'Joyas',
    material: data.material?.trim() || '',
    price: Number(data.price || 0),
    compareAtPrice: data.compareAtPrice ? Number(data.compareAtPrice) : null,
    stock: Number(data.stock || 0),
    imageUrl: data.imageUrl?.trim() || '',
    order: Number(data.order || 0),
    description: data.description?.trim() || '',
    active: form.elements.active.checked,
    featured: form.elements.featured.checked
  };
}

function fillProductForm(product) {
  const form = $('#productForm');
  form.elements.id.value = product?._id || '';
  form.elements.name.value = product?.name || '';
  form.elements.category.value = product?.category || '';
  form.elements.material.value = product?.material || '';
  form.elements.price.value = product?.price || '';
  form.elements.compareAtPrice.value = product?.compareAtPrice || '';
  form.elements.stock.value = product?.stock ?? 0;
  form.elements.imageUrl.value = product?.imageUrl || '';
  form.elements.order.value = product?.order || 0;
  form.elements.description.value = product?.description || '';
  form.elements.active.checked = product ? Boolean(product.active) : true;
  form.elements.featured.checked = product ? Boolean(product.featured) : false;
  $('#productFormTitle').textContent = product ? `Editando: ${product.name}` : 'Nuevo producto';
  setMessage('#productMessage', '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function productStatusLabel(product) {
  if ((product.stock || 0) <= 0) return 'Sin stock';
  if ((product.stock || 0) <= 3) return `Stock bajo (${product.stock})`;
  return `Stock ${product.stock}`;
}

function renderAdminProducts() {
  const container = $('#adminProducts');
  const template = $('#adminProductTemplate');
  container.innerHTML = '';

  if (!Array.isArray(adminState.products) || !adminState.products.length) {
    container.innerHTML = '<div class="loading-card">Aún no hay productos o no se pudieron cargar.</div>';
    return;
  }

  adminState.products.forEach((product) => {
    const node = template.content.cloneNode(true);
    const img = node.querySelector('.admin-product-img');
    img.src = product.imageUrl || fallbackImage;
    img.alt = product.name;
    img.onerror = () => {
      img.src = fallbackImage;
    };

    node.querySelector('.admin-product-name').textContent = product.name;
    node.querySelector('.admin-product-detail').textContent = `${product.category || 'Joyas'} · ${money.format(product.price || 0)} · ${productStatusLabel(product)} · Orden ${product.order || 0}`;
    node.querySelector('.admin-product-status').textContent = [
      product.active ? 'Visible' : 'Oculto',
      product.featured ? 'Destacado' : 'Normal'
    ].join(' · ');

    node.querySelector('.edit-btn').addEventListener('click', () => fillProductForm(product));
    node.querySelector('.delete-btn').addEventListener('click', async () => {
      const ok = confirm(`¿Borrar ${product.name}? Esta acción no se puede deshacer.`);
      if (!ok) return;
      try {
        await request(`/api/products/${product._id}`, { method: 'DELETE' });
        setMessage('#productMessage', 'Producto borrado.');
        await loadProducts();
      } catch (error) {
        setMessage('#productMessage', error.message, false);
      }
    });

    container.appendChild(node);
  });
}

async function loadProducts() {
  try {
    const response = await request('/api/products');
    adminState.products = response.data || [];
    renderAdminProducts();
  } catch (error) {
    console.error(error);
    adminState.products = [];
    renderAdminProducts();
  }
}

async function loadAdminData() {
  await Promise.all([loadSettings(), loadProducts()]);
}

function setupEvents() {
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('#loginMessage', 'Entrando...');
    try {
      await request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: $('#adminPassword').value })
      });
      setMessage('#loginMessage', '');
      showAdmin(true);
      await loadAdminData();
    } catch (error) {
      setMessage('#loginMessage', error.message, false);
    }
  });

  $('#logoutButton').addEventListener('click', async () => {
    try {
      await request('/api/admin/logout', { method: 'POST' });
      showAdmin(false);
      $('#adminPassword').value = '';
    } catch (error) {
      console.error(error);
    }
  });

  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    setMessage('#settingsMessage', 'Guardando...');
    try {
      const response = await request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      adminState.settings = response.data || {};
      setMessage('#settingsMessage', 'Textos guardados correctamente.');
    } catch (error) {
      setMessage('#settingsMessage', error.message, false);
    }
  });

  $('#productForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.elements.id.value;
    const payload = getProductPayload(form);
    setMessage('#productMessage', 'Guardando...');

    try {
      if (id) {
        await request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('#productMessage', 'Producto actualizado.');
      } else {
        await request('/api/products', { method: 'POST', body: JSON.stringify(payload) });
        setMessage('#productMessage', 'Producto creado exitosamente.');
      }
      fillProductForm(null);
      await loadProducts();
    } catch (error) {
      setMessage('#productMessage', error.message, false);
    }
  });

  $('#resetProductForm').addEventListener('click', () => fillProductForm(null));
  $('#refreshProducts').addEventListener('click', loadProducts);
}

setupEvents();
checkAuth().catch((error) => {
  console.error(error);
  setMessage('#loginMessage', 'No se pudo revisar la sesión. Revisa que el servidor esté activo.', false);
});
