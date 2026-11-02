<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

interface User {
  id: number;
  nombre: string;
  email: string;
}

interface Store {
  id: number;
  storename: string;
  descripcion: string;
  owner: number;
  categoria?: string;
  zona?: string;
}

interface Product {
  id: number;
  tienda_id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
}

interface CatalogProduct extends Product {
  storeName: string;
  storeOwner: number;
  category?: string;
}

interface CartItem extends CatalogProduct {
  quantity: number;
}

interface ApiError {
  error?: string;
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const stores = ref<Store[]>([]);
const products = ref<CatalogProduct[]>([]);
const currentUser = ref<User | null>(null);
const cart = ref<CartItem[]>([]);
const route = useRoute();
const router = useRouter();
const selectedStore = computed(() => typeof route.params.storeId === 'string' ? route.params.storeId : 'all');
const selectedCategory = ref('Todos');
const searchQuery = ref('');
const isLoading = ref(true);
const isSaving = ref(false);
const authOpen = ref(false);
const registerMode = ref(false);
const storeFormOpen = ref(false);
const editingStoreId = ref<number | null>(null);
const openStoreMenuId = ref<number | null>(null);
const productFormOpen = ref(false);
const editingProductId = ref<number | null>(null);
const openProductMenuId = ref<number | null>(null);
const cartOpen = ref(false);
const checkoutOpen = computed(() => route.name === 'checkout');
const checkoutSuccess = ref(false);
const notice = ref('');
const errorMessage = ref('');
const authForm = ref({ nombre: '', email: '', password: '', domicilio: '' });
const storeForm = ref({ storename: '', descripcion: '', categoria: '', zona: '' });
const productForm = ref({ nombre: '', descripcion: '', precio: '', stock: '' });
const checkoutForm = ref({ nombre: '', apellido: '', direccion: '', codigoPostal: '' });

const predefinedCategories = [
  { name: 'Todos', icon: '✳' },
  { name: 'Gastronomía', icon: '⌁' },
  { name: 'Indumentaria', icon: '◇' },
  { name: 'Almacén', icon: '▤' },
  { name: 'Tecnología', icon: '▦' },
  { name: 'Juguetería', icon: '✿' },
  { name: 'Librería', icon: '▧' },
  { name: 'Regalos', icon: '✧' },
  { name: 'Chinerías', icon: '◇' },
  { name: 'Hogar', icon: '⌂' },
  { name: 'Belleza y cuidado personal', icon: '✦' },
  { name: 'Mascotas', icon: '♡' },
  { name: 'Deportes y aire libre', icon: '⚽' },
  { name: 'Ferretería y construcción', icon: '⚒' },
  { name: 'Salud y bienestar', icon: '✚' },
  { name: 'Otros', icon: '⋯' },
];
const categories = computed(() => {
  const additionalCategories = [...new Set(stores.value
    .map((store) => store.categoria?.trim())
    .filter((category): category is string => Boolean(category)))]
    .filter((name) => !predefinedCategories.some((category) => category.name === name))
    .map((name) => ({ name, icon: '◇' }));

  return [...predefinedCategories, ...additionalCategories];
});
const storeCategories = predefinedCategories.filter((category) => category.name !== 'Todos');

const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();

  return products.value.filter((product) => {
    const matchesStore = selectedStore.value === 'all'
      || product.tienda_id === Number(selectedStore.value);
    const matchesCategory = selectedCategory.value === 'Todos'
      || product.category === selectedCategory.value;
    const matchesQuery = !query
      || `${product.nombre} ${product.descripcion} ${product.storeName}`.toLocaleLowerCase().includes(query);

    return matchesStore && matchesCategory && matchesQuery;
  });
});

const filteredStores = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();

  return stores.value.filter((store) => {
    const matchesCategory = selectedCategory.value === 'Todos'
      || store.categoria === selectedCategory.value;
    const matchesQuery = !query
      || `${store.storename} ${store.descripcion} ${store.zona ?? ''}`.toLocaleLowerCase().includes(query);

    return matchesCategory && matchesQuery;
  });
});

const storesForDisplay = computed(() => [...filteredStores.value].sort((first, second) =>
  Number(second.owner === currentUser.value?.id) - Number(first.owner === currentUser.value?.id)));
const cartCount = computed(() => cart.value.reduce((sum, item) => sum + item.quantity, 0));
const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + item.precio * item.quantity, 0));
const checkoutReady = computed(() =>
  Boolean(checkoutForm.value.nombre.trim() && checkoutForm.value.apellido.trim()
    && checkoutForm.value.direccion.trim() && checkoutForm.value.codigoPostal.trim()));
const selectedStoreInfo = computed(() => stores.value.find((store) => store.id === Number(selectedStore.value)));
const selectedStoreName = computed(() => selectedStoreInfo.value?.storename);
const canManageSelectedStore = computed(() =>
  Boolean(currentUser.value && selectedStoreInfo.value?.owner === currentUser.value.id));
const productCountForStore = (storeId: number) =>
  products.value.filter((product) => product.tienda_id === storeId).length;
const openStore = (store: Store) => {
  openStoreMenuId.value = null;
  void router.push({ name: 'store', params: { storeId: store.id } });
  selectedCategory.value = 'Todos';
  searchQuery.value = '';
  errorMessage.value = '';
};
const returnToStores = () => {
  void router.push({ name: 'stores' });
  errorMessage.value = '';
};
const quantityInCart = (productId: number) =>
  cart.value.find((item) => item.id === productId)?.quantity ?? 0;
const isOwnProduct = (product: CatalogProduct) =>
  currentUser.value?.id === product.storeOwner;

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(price);

const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body && { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiError;
    throw new ApiRequestError(body.error ?? 'No se pudo completar la solicitud.', response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return await response.json() as T;
};

const loadCatalog = async (): Promise<boolean> => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    stores.value = await apiRequest<Store[]>('/tiendas');
    const productGroups = await Promise.all(stores.value.map(async (store) => {
      const storeProducts = await apiRequest<Product[]>(`/tiendas/${store.id}/productos`);
      return storeProducts.map((product) => ({
        ...product,
        storeName: store.storename,
        storeOwner: store.owner,
        category: store.categoria,
      }));
    }));
    const catalogProducts = productGroups.flat();
    products.value = catalogProducts;
    cart.value = cart.value.flatMap((item) => {
      const currentProduct = catalogProducts.find((product) => product.id === item.id);
      return currentProduct && !isOwnProduct(currentProduct)
        ? [{ ...currentProduct, quantity: item.quantity }]
        : [];
    });
    return true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo cargar el catálogo.';
    return false;
  } finally {
    isLoading.value = false;
  }
};

const loadSession = async () => {
  try {
    const session = await apiRequest<{ user: User }>('/auth/sesion');
    currentUser.value = session.user;
    cart.value = cart.value.filter((item) => !isOwnProduct(item));
  } catch (error) {
    currentUser.value = null;
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      errorMessage.value = error instanceof Error ? error.message : 'No se pudo consultar la sesión.';
    }
  }
};

const showNotice = (message: string) => {
  notice.value = message;
  window.setTimeout(() => {
    if (notice.value === message) notice.value = '';
  }, 3200);
};

const submitAuth = async () => {
  isSaving.value = true;
  errorMessage.value = '';
  const isRegistering = registerMode.value;

  try {
    let user: User;
    if (isRegistering) {
      if (authForm.value.password.length < 8) {
        errorMessage.value = 'La contraseña debe tener al menos 8 caracteres.';
        return;
      }

      user = await apiRequest<User>('/auth/registro', {
        method: 'POST',
        body: JSON.stringify(authForm.value),
      });
    } else {
      const session = await apiRequest<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: authForm.value.email,
          password: authForm.value.password,
        }),
      });
      user = session.user;
    }

    currentUser.value = user;
    cart.value = cart.value.filter((item) => !isOwnProduct(item));
    authOpen.value = false;
    authForm.value = { nombre: '', email: '', password: '', domicilio: '' };
    showNotice(isRegistering ? '¡Tu cuenta ya está lista!' : '¡Qué bueno verte de nuevo!');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
  } finally {
    isSaving.value = false;
  }
};

const signOut = async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
    currentUser.value = null;
    showNotice('Cerraste sesión correctamente.');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo cerrar la sesión.';
  }
};

const addToCart = (product: CatalogProduct) => {
  if (isOwnProduct(product)) {
    showNotice('No podés agregar productos de tu propia tienda.');
    return;
  }

  const existingItem = cart.value.find((item) => item.id === product.id);
  if (product.stock <= 0 || (existingItem && existingItem.quantity >= product.stock)) {
    showNotice('No quedan más unidades disponibles de este producto.');
    return;
  }

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.value.push({ ...product, quantity: 1 });
  }
  showNotice(`${product.nombre} se agregó al pedido`);
};

const updateQuantity = (productId: number, change: number) => {
  const item = cart.value.find((cartItem) => cartItem.id === productId);
  if (!item) return;

  if (change > 0 && item.quantity >= item.stock) {
    showNotice('No quedan más unidades disponibles de este producto.');
    return;
  }

  item.quantity += change;
  if (item.quantity <= 0) {
    cart.value = cart.value.filter((cartItem) => cartItem.id !== productId);
  }
};

const startCheckout = () => {
  cartOpen.value = false;
  checkoutSuccess.value = false;
  errorMessage.value = '';
  void router.push({ name: 'checkout' });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (cartCount.value && !currentUser.value) {
    authOpen.value = true;
    showNotice('Ingresá a tu cuenta para continuar con el pedido.');
    return;
  }
};

const returnToStore = () => {
  checkoutSuccess.value = false;
  errorMessage.value = '';
  void router.push({ name: 'stores' });
};

const submitCheckout = async () => {
  if (!currentUser.value) {
    openAuth();
    errorMessage.value = 'Iniciá sesión para continuar con el pago.';
    return;
  }

  if (!checkoutReady.value || !cartCount.value) return;

  isSaving.value = true;
  errorMessage.value = '';
  try {
    await apiRequest<{ message: string }>('/checkout', {
      method: 'POST',
      body: JSON.stringify({
        ...checkoutForm.value,
        items: cart.value.map((item) => ({ productId: item.id, quantity: item.quantity })),
      }),
    });
    cart.value = [];
    checkoutSuccess.value = true;
    checkoutForm.value = { nombre: '', apellido: '', direccion: '', codigoPostal: '' };
    await loadCatalog();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo completar el pago.';
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para continuar con el pago.';
    } else if (error instanceof ApiRequestError && error.status === 409) {
      await loadCatalog();
      errorMessage.value = message;
    } else {
      errorMessage.value = message;
    }
  } finally {
    isSaving.value = false;
  }
};

const saveStore = async () => {
  if (!currentUser.value) {
    storeFormOpen.value = false;
    openAuth();
    errorMessage.value = 'Iniciá sesión para publicar tu tienda.';
    return;
  }

  const storeName = storeForm.value.storename.trim();
  const description = storeForm.value.descripcion.trim();
  if (!storeName || !description || !storeForm.value.categoria) {
    errorMessage.value = 'Completá el nombre, la descripción y la categoría de tu tienda.';
    return;
  }

  isSaving.value = true;
  errorMessage.value = '';

  try {
    const store = editingStoreId.value
      ? await apiRequest<Store>(`/tiendas/${editingStoreId.value}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: storeName,
          descripcion: description,
          categoria: storeForm.value.categoria,
          ...(storeForm.value.zona.trim() && { zona: storeForm.value.zona.trim() }),
        }),
      })
      : await apiRequest<Store>('/tiendas', {
        method: 'POST',
        body: JSON.stringify({
          ...storeForm.value,
          storename: storeName,
          descripcion: description,
          owner: currentUser.value.id,
          visibilidad: 'publica',
        }),
      });
    const wasEditing = editingStoreId.value !== null;
    storeFormOpen.value = false;
    editingStoreId.value = null;
    storeForm.value = { storename: '', descripcion: '', categoria: '', zona: '' };
    if (!wasEditing) {
      void router.push({ name: 'store', params: { storeId: store.id } });
      selectedCategory.value = 'Todos';
    }
    const catalogLoaded = await loadCatalog();
    showNotice(catalogLoaded
      ? wasEditing ? 'Los cambios de tu tienda se guardaron.' : '¡Tu tienda ya está publicada!'
      : 'La tienda se guardó, pero no pudimos actualizar el catálogo. Volvé a cargar la página.');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      storeFormOpen.value = false;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para guardar los cambios de tu tienda.';
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'No se pudo guardar la tienda.';
  } finally {
    isSaving.value = false;
  }
};

const openStoreForm = async () => {
  errorMessage.value = '';
  editingStoreId.value = null;
  storeForm.value = { storename: '', descripcion: '', categoria: '', zona: '' };
  openStoreMenuId.value = null;

  if (!currentUser.value) {
    openAuth();
    errorMessage.value = 'Iniciá sesión para publicar tu tienda.';
    return;
  }

  try {
    const session = await apiRequest<{ user: User }>('/auth/sesion');
    currentUser.value = session.user;
    storeFormOpen.value = true;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para publicar tu tienda.';
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'No se pudo verificar tu sesión.';
  }
};

const editStore = async (store: Store) => {
  openStoreMenuId.value = null;
  errorMessage.value = '';

  if (!currentUser.value || store.owner !== currentUser.value.id) return;

  try {
    const session = await apiRequest<{ user: User }>('/auth/sesion');
    currentUser.value = session.user;
    if (store.owner !== session.user.id) {
      errorMessage.value = 'Solo el dueño puede editar esta tienda.';
      return;
    }

    editingStoreId.value = store.id;
    storeForm.value = {
      storename: store.storename,
      descripcion: store.descripcion,
      categoria: store.categoria ?? '',
      zona: store.zona ?? '',
    };
    storeFormOpen.value = true;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para editar tu tienda.';
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'No se pudo verificar tu sesión.';
  }
};

const removeStore = async (store: Store) => {
  openStoreMenuId.value = null;
  if (!currentUser.value || store.owner !== currentUser.value.id) return;
  if (!window.confirm(`¿Querés eliminar la tienda "${store.storename}" y sus productos?`)) return;

  isSaving.value = true;
  errorMessage.value = '';
  try {
    await apiRequest<void>(`/tiendas/${store.id}`, { method: 'DELETE' });
    if (selectedStore.value === String(store.id)) void router.push({ name: 'stores' });
    const catalogLoaded = await loadCatalog();
    showNotice(catalogLoaded
      ? 'La tienda y sus productos se eliminaron.'
      : 'La tienda se eliminó, pero no pudimos actualizar el catálogo. Volvé a cargar la página.');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para eliminar tu tienda.';
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'No se pudo eliminar la tienda.';
  } finally {
    isSaving.value = false;
  }
};

const toggleStoreMenu = (storeId: number) => {
  openStoreMenuId.value = openStoreMenuId.value === storeId ? null : storeId;
};

const openProductForm = async () => {
  const store = selectedStoreInfo.value;
  if (!store || !currentUser.value || store.owner !== currentUser.value.id) return;

  errorMessage.value = '';
  editingProductId.value = null;
  openProductMenuId.value = null;
  productForm.value = { nombre: '', descripcion: '', precio: '', stock: '' };
  try {
    const session = await apiRequest<{ user: User }>('/auth/sesion');
    currentUser.value = session.user;
    if (store.owner !== session.user.id) {
      errorMessage.value = 'Solo el dueño puede agregar productos a esta tienda.';
      return;
    }

    productFormOpen.value = true;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para agregar productos.';
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'No se pudo verificar tu sesión.';
  }
};

const editProduct = async (product: CatalogProduct) => {
  openProductMenuId.value = null;
  errorMessage.value = '';
  const store = selectedStoreInfo.value;
  if (!store || !currentUser.value || store.owner !== currentUser.value.id
    || product.tienda_id !== store.id) return;

  try {
    const session = await apiRequest<{ user: User }>('/auth/sesion');
    currentUser.value = session.user;
    if (store.owner !== session.user.id) {
      errorMessage.value = 'Solo el dueño puede modificar productos de esta tienda.';
      return;
    }

    editingProductId.value = product.id;
    productForm.value = {
      nombre: product.nombre,
      descripcion: product.descripcion,
      precio: String(product.precio),
      stock: String(product.stock),
    };
    productFormOpen.value = true;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para editar productos.';
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'No se pudo verificar tu sesión.';
  }
};

const removeProduct = async (product: CatalogProduct) => {
  openProductMenuId.value = null;
  const store = selectedStoreInfo.value;
  if (!store || !currentUser.value || store.owner !== currentUser.value.id
    || product.tienda_id !== store.id) return;
  if (!window.confirm(`¿Querés eliminar el producto "${product.nombre}"?`)) return;

  isSaving.value = true;
  errorMessage.value = '';
  try {
    await apiRequest<void>(`/productos/${product.id}`, { method: 'DELETE' });
    const catalogLoaded = await loadCatalog();
    showNotice(catalogLoaded
      ? 'El producto se eliminó.'
      : 'El producto se eliminó, pero no pudimos actualizar el catálogo. Volvé a cargar la página.');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para eliminar productos.';
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'No se pudo eliminar el producto.';
  } finally {
    isSaving.value = false;
  }
};

const toggleProductMenu = (productId: number) => {
  openProductMenuId.value = openProductMenuId.value === productId ? null : productId;
};

const saveProduct = async () => {
  const store = selectedStoreInfo.value;
  if (!store || !currentUser.value || store.owner !== currentUser.value.id) {
    errorMessage.value = 'Solo el dueño puede administrar productos de esta tienda.';
    return;
  }

  const nombre = productForm.value.nombre.trim();
  const descripcion = productForm.value.descripcion.trim();
  const precio = Number(productForm.value.precio);
  const stock = Number(productForm.value.stock);
  if (!nombre || !descripcion || productForm.value.precio === '' || !Number.isFinite(precio) || precio < 0
    || productForm.value.stock === '' || !Number.isInteger(stock) || stock < 0) {
    errorMessage.value = 'Completá los datos con un precio válido y un stock entero no negativo.';
    return;
  }

  isSaving.value = true;
  errorMessage.value = '';
  try {
    const wasEditing = editingProductId.value !== null;
    await apiRequest<Product>(
      wasEditing ? `/productos/${editingProductId.value}` : `/tiendas/${store.id}/productos`,
      {
        method: wasEditing ? 'PATCH' : 'POST',
        body: JSON.stringify({ nombre, descripcion, precio, stock }),
      },
    );
    productFormOpen.value = false;
    editingProductId.value = null;
    productForm.value = { nombre: '', descripcion: '', precio: '', stock: '' };
    selectedCategory.value = 'Todos';
    const catalogLoaded = await loadCatalog();
    showNotice(catalogLoaded
      ? wasEditing ? 'Los cambios del producto se guardaron.' : '¡El producto ya está publicado!'
      : 'El producto se guardó, pero no pudimos actualizar el catálogo. Volvé a cargar la página.');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      currentUser.value = null;
      productFormOpen.value = false;
      openAuth();
      errorMessage.value = 'Tu sesión venció. Iniciá sesión para guardar productos.';
      return;
    }

    errorMessage.value = error instanceof Error ? error.message : 'No se pudo guardar el producto.';
  } finally {
    isSaving.value = false;
  }
};

const openAuth = (register = false) => {
  registerMode.value = register;
  authOpen.value = true;
  errorMessage.value = '';
};

watch(() => route.name, (routeName) => {
  if (routeName !== 'checkout') {
    checkoutSuccess.value = false;
    errorMessage.value = '';
  }
});

onMounted(async () => {
  await Promise.all([loadCatalog(), loadSession()]);
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/tiendas" aria-label="Mercado Ya, inicio">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span>Mercado <span class="brand-accent">Ya</span></span>
      </RouterLink>

      <label class="search-box">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg>
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="selectedStoreInfo ? 'Buscar productos...' : 'Buscar tiendas...'"
        />
      </label>

      <div class="top-actions">
        <button v-if="currentUser" class="user-chip" type="button" @click="signOut">
          <span class="avatar">{{ currentUser.nombre.charAt(0).toUpperCase() }}</span>
          <span class="user-name">{{ currentUser.nombre.split(' ')[0] }}</span>
          <span class="logout-label">Salir</span>
        </button>
        <button v-else class="sign-in-button" type="button" @click="openAuth()">Ingresar</button>
        <button class="header-cart" type="button" aria-label="Ir al checkout" @click="startCheckout">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg>
          <span v-if="cartCount" class="cart-count">{{ cartCount }}</span>
        </button>
      </div>
    </header>

    <main v-if="!checkoutOpen">
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow"><span class="live-dot"></span> LO LOCAL, MÁS CERCA</span>
          <h1>Un mundo de cosas<br />buenas, <em>cerca tuyo.</em></h1>
          <p>Descubrí tiendas de tu barrio y encontrá eso que estabas buscando.</p>
          <div class="hero-meta">
            <span><span class="meta-icon">✳</span> Hecho cerca, elegido por vos</span>
            <span class="meta-divider"></span>
            <span>{{ stores.length }} {{ stores.length === 1 ? 'tienda local' : 'tiendas locales' }}</span>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="art-sun"></div>
          <div class="art-orbit orbit-one"></div>
          <div class="art-orbit orbit-two"></div>
          <div class="art-card art-card-back"><span>✿</span></div>
          <div class="art-card art-card-front"><span class="art-spark">✳</span><span>cosas<br />lindas<br /><b>por acá</b></span></div>
          <span class="art-star star-one">✦</span><span class="art-star star-two">✳</span>
          <span class="art-caption">COMPRÁ LOCAL<br />QUERÉ LO TUYO</span>
        </div>
      </section>

      <section class="discovery-section">
        <div class="section-heading">
          <div>
            <span class="section-kicker">{{ selectedStoreInfo ? 'EL CATÁLOGO DE TU TIENDA' : 'EL BARRIO TIENE MUCHO PARA DAR' }}</span>
            <h2>{{ selectedStoreInfo ? 'Productos de la tienda' : 'Tiendas cerca tuyo' }}<span class="heading-period">.</span></h2>
          </div>
          <button v-if="currentUser" class="outline-button" type="button" @click="openStoreForm">
            <span>＋</span> Abrir mi tienda
          </button>
          <button v-else class="outline-button" type="button" @click="openAuth(true)">
            ¿Tenés un negocio? <span>Sumalo acá ↗</span>
          </button>
        </div>

        <div class="category-filter">
          <span class="category-filter-icon" aria-hidden="true">⌕</span>
          <label for="category-filter">Rubro</label>
          <select id="category-filter" v-model="selectedCategory">
            <option v-for="category in categories" :key="category.name" :value="category.name">
              {{ category.icon }} {{ category.name }}
            </option>
          </select>
        </div>

        <section v-if="selectedStoreInfo" class="store-profile" aria-label="Información de la tienda">
          <div>
            <span class="section-kicker">{{ selectedStoreInfo.categoria || 'TIENDA LOCAL' }}</span>
            <h3>{{ selectedStoreInfo.storename }}</h3>
            <p>{{ selectedStoreInfo.descripcion }}</p>
            <span v-if="selectedStoreInfo.zona" class="store-location">⌖ {{ selectedStoreInfo.zona }}</span>
          </div>
          <div class="store-profile-actions">
            <button class="store-back-button" type="button" @click="returnToStores">← Volver a tiendas</button>
            <button
              v-if="canManageSelectedStore"
              class="primary-button"
              type="button"
              @click="openProductForm"
            >
              ＋ Crear producto
            </button>
          </div>
        </section>

        <div v-if="selectedStoreName" class="catalog-label">
          <span class="store-pin">⌖</span>
          <span>{{ selectedStoreName }}</span>
          <span class="catalog-dot">·</span>
          <span>{{ filteredProducts.length }} {{ filteredProducts.length === 1 ? 'producto' : 'productos' }}</span>
        </div>

        <div v-if="errorMessage" class="error-banner" role="alert">
          <span>{{ errorMessage }}</span>
          <button type="button" @click="loadCatalog">Reintentar</button>
        </div>

        <div v-else-if="isLoading" class="product-grid">
          <div v-for="skeleton in 4" :key="skeleton" class="product-skeleton">
            <div class="skeleton-copy"><i></i><i></i><i></i></div><div class="skeleton-image"></div>
          </div>
        </div>

        <div v-else-if="!selectedStoreInfo && storesForDisplay.length" class="store-grid">
          <article
            v-for="(store, index) in storesForDisplay"
            :key="store.id"
            class="store-card"
            :class="`store-card-${index % 5}`"
          >
            <button
              class="store-card-open"
              type="button"
              :aria-label="`Ver productos de ${store.storename}`"
              @click="openStore(store)"
            >
              <span class="store-card-art" aria-hidden="true">{{ ['✿', '◈', '☼', '❋', '✳'][index % 5] }}</span>
              <span class="store-card-content">
                <span class="store-card-category">{{ store.categoria || 'TIENDA LOCAL' }}</span>
                <strong>{{ store.storename }}</strong>
                <span class="store-card-description">{{ store.descripcion }}</span>
                <span class="store-card-meta">
                  <span v-if="store.zona">⌖ {{ store.zona }}</span>
                  <span>{{ productCountForStore(store.id) }} {{ productCountForStore(store.id) === 1 ? 'producto' : 'productos' }}</span>
                </span>
              </span>
              <span class="store-card-arrow" aria-hidden="true">↗</span>
            </button>
            <span v-if="currentUser && store.owner === currentUser.id" class="store-owner-badge">Tu tienda</span>
            <span v-if="currentUser && store.owner === currentUser.id" class="store-actions">
              <button
                class="store-options-button"
                type="button"
                :aria-label="`Opciones de ${store.storename}`"
                :aria-expanded="openStoreMenuId === store.id"
                :aria-controls="`store-menu-${store.id}`"
                @click.stop="toggleStoreMenu(store.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2.9Z"></path>
                </svg>
              </button>
              <div v-if="openStoreMenuId === store.id" :id="`store-menu-${store.id}`" class="store-options-menu">
                <button type="button" @click.stop="editStore(store)">Editar tienda</button>
                <button type="button" class="store-delete-option" :disabled="isSaving" @click.stop="removeStore(store)">
                  Eliminar tienda
                </button>
              </div>
            </span>
          </article>
        </div>

        <div v-else-if="selectedStoreInfo && filteredProducts.length" class="product-grid">
          <article
            v-for="(product, index) in filteredProducts"
            :key="product.id"
            class="product-card"
            :class="{ 'product-card-manageable': canManageSelectedStore }"
          >
            <div class="product-copy">
              <span class="product-store">{{ product.storeName }}</span>
              <h3>{{ product.nombre }}</h3>
              <p class="product-description">{{ product.descripcion }}</p>
              <div class="product-bottom">
                <strong class="product-price">{{ formatPrice(product.precio) }}</strong>
                <span v-if="product.stock <= 5" class="stock-note">Quedan {{ product.stock }}</span>
              </div>
            </div>
            <div class="product-image" :class="`product-image-${index % 5}`">
              <span class="product-art" aria-hidden="true">{{ ['✿', '◈', '☼', '❋', '✳'][index % 5] }}</span>
              <button
                v-if="!isOwnProduct(product)"
                class="add-button"
                type="button"
                :aria-label="`Agregar ${product.nombre} al pedido`"
                :disabled="product.stock <= 0 || quantityInCart(product.id) >= product.stock"
                @click="addToCart(product)"
              >+</button>
              <span v-else class="own-product-label">Tu tienda</span>
            </div>
            <span v-if="canManageSelectedStore && product.tienda_id === selectedStoreInfo.id" class="product-actions">
              <button
                class="store-options-button"
                type="button"
                :aria-label="`Opciones de ${product.nombre}`"
                :aria-expanded="openProductMenuId === product.id"
                :aria-controls="`product-menu-${product.id}`"
                @click="toggleProductMenu(product.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2.9Z"></path>
                </svg>
              </button>
              <div v-if="openProductMenuId === product.id" :id="`product-menu-${product.id}`" class="store-options-menu">
                <button type="button" @click="editProduct(product)">Editar producto</button>
                <button type="button" class="store-delete-option" :disabled="isSaving" @click="removeProduct(product)">
                  Eliminar producto
                </button>
              </div>
            </span>
          </article>
        </div>

        <div v-else class="empty-state">
          <div class="empty-illustration"><span>✿</span><i></i></div>
          <span class="section-kicker">{{ selectedStoreInfo ? 'PRONTO, ALGO NUEVO' : stores.length ? 'NO ENCONTRAMOS TIENDAS' : 'EMPEZAMOS POR LO LOCAL' }}</span>
          <h3>{{ selectedStoreInfo ? 'Todavía no hay productos por acá.' : stores.length ? 'No hay tiendas con esos datos.' : 'Tu barrio está por florecer.' }}</h3>
          <p>{{ selectedStoreInfo ? 'Esta tienda todavía no publicó productos.' : stores.length ? 'Probá con otra búsqueda o categoría.' : 'Cuando los comercios se sumen, los vas a encontrar acá.' }}</p>
          <button v-if="selectedStoreInfo && canManageSelectedStore" class="primary-button empty-cta" type="button" @click="openProductForm">Crear el primer producto <span>↗</span></button>
          <button v-if="currentUser && !selectedStoreInfo && stores.length === 0" class="primary-button empty-cta" type="button" @click="openStoreForm">Publicá tu tienda <span>↗</span></button>
          <button v-else-if="!currentUser && stores.length === 0" class="text-button empty-cta" type="button" @click="openAuth(true)">¿Tenés un negocio? Sumalo acá <span>↗</span></button>
          <button v-else-if="selectedStoreInfo" class="text-button empty-cta" type="button" @click="returnToStores">Volver a las tiendas</button>
        </div>
      </section>

      <footer class="footer">
        <RouterLink class="brand footer-brand" to="/tiendas"><span class="brand-mark"><span></span><span></span><span></span></span><span>Mercado <span class="brand-accent">Ya</span></span></RouterLink>
        <span>Lo local nos queda bien. <span class="footer-heart">♥</span></span>
        <span>BUENOS AIRES · ARGENTINA</span>
      </footer>
    </main>

    <main v-else class="checkout-page">
      <button class="text-button checkout-back" type="button" @click="returnToStore">
        ← Volver a la tienda
      </button>
      <section v-if="checkoutSuccess" class="checkout-result" role="status">
        <span class="checkout-result-icon">✓</span>
        <span class="section-kicker">PEDIDO CONFIRMADO</span>
        <h1>¡Gracias por tu compra!</h1>
        <p>Se ha realizado el pago correctamente, pronto le llegara una factura a su correo</p>
        <button class="primary-button" type="button" @click="returnToStore">Seguir explorando <span>→</span></button>
      </section>
      <section v-else-if="!cartCount" class="checkout-result">
        <span class="checkout-result-icon">🛍</span>
        <span class="section-kicker">TU PEDIDO</span>
        <h1>El carrito está vacío.</h1>
        <p>Explorá las tiendas del barrio y agregá productos para continuar.</p>
        <button class="primary-button" type="button" @click="returnToStore">Volver a la tienda <span>→</span></button>
      </section>
      <section v-else class="checkout-layout">
        <div class="checkout-heading">
          <span class="section-kicker">UN ÚLTIMO PASO</span>
          <h1>Finalizá tu pedido<span class="heading-period">.</span></h1>
          <p>Completá tus datos para confirmar la compra.</p>
        </div>
        <div class="checkout-columns">
          <form class="checkout-card dialog-form" @submit.prevent="submitCheckout">
            <h2>Datos de entrega</h2>
            <div class="form-row">
              <label>Nombre<input v-model.trim="checkoutForm.nombre" autocomplete="given-name" required /></label>
              <label>Apellido<input v-model.trim="checkoutForm.apellido" autocomplete="family-name" required /></label>
            </div>
            <label>Dirección<input v-model.trim="checkoutForm.direccion" autocomplete="street-address" required /></label>
            <label>Código postal<input v-model.trim="checkoutForm.codigoPostal" autocomplete="postal-code" required /></label>
            <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
            <button class="primary-button form-submit" type="submit" :disabled="!checkoutReady || isSaving">
              {{ isSaving ? 'Procesando pago…' : 'Pagar' }} <span>→</span>
            </button>
          </form>
          <aside class="checkout-card checkout-summary">
            <h2>Tu pedido</h2>
            <article v-for="item in cart" :key="item.id" class="checkout-line">
              <div class="checkout-line-copy">
                <strong>{{ item.nombre }} <span>× {{ item.quantity }}</span></strong>
                <small>{{ item.storeName }}</small>
              </div>
              <strong>{{ formatPrice(item.precio * item.quantity) }}</strong>
            </article>
            <div class="cart-subtotal"><span>Total</span><strong>{{ formatPrice(cartTotal) }}</strong></div>
          </aside>
        </div>
      </section>
    </main>

    <Transition name="slide-up">
      <div v-if="cartCount && !checkoutOpen" class="sticky-cart">
        <button class="cart-summary" type="button" @click="cartOpen = true">
          <span class="cart-icon-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg><b>{{ cartCount }}</b></span>
          <span class="cart-summary-copy"><strong>Tu pedido</strong><small>{{ cartCount }} {{ cartCount === 1 ? 'producto' : 'productos' }}</small></span>
          <strong class="cart-total">{{ formatPrice(cartTotal) }}</strong>
        </button>
        <button class="checkout-button" type="button" @click="startCheckout">Ir a pagar <span>→</span></button>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="authOpen" class="modal-backdrop" @click.self="authOpen = false">
        <section class="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button class="dialog-close" type="button" aria-label="Cerrar" @click="authOpen = false">×</button>
          <div class="dialog-mark"><span class="brand-mark"><span></span><span></span><span></span></span></div>
          <span class="section-kicker">{{ registerMode ? 'UNA CUENTA, MUCHAS POSIBILIDADES' : 'QUÉ BUENO TENERTE DE VUELTA' }}</span>
          <h2 id="auth-title">{{ registerMode ? 'Tu lugar está acá.' : 'Hola de nuevo.' }}</h2>
          <p class="dialog-intro">{{ registerMode ? 'Creá tu cuenta y empezá a descubrir.' : 'Ingresá para seguir explorando lo local.' }}</p>
          <form class="dialog-form" @submit.prevent="submitAuth">
            <label v-if="registerMode">Nombre y apellido<input v-model.trim="authForm.nombre" autocomplete="name" required /></label>
            <label>Email<input v-model.trim="authForm.email" type="email" autocomplete="email" required /></label>
            <label>Contraseña<input v-model="authForm.password" type="password" :autocomplete="registerMode ? 'new-password' : 'current-password'" required /></label>
            <label v-if="registerMode">Domicilio<input v-model.trim="authForm.domicilio" autocomplete="street-address" required /></label>
            <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
            <button class="primary-button form-submit" type="submit" :disabled="isSaving">
              {{ isSaving ? 'Un segundo…' : registerMode ? 'Crear mi cuenta' : 'Ingresar a mi cuenta' }} <span>→</span>
            </button>
          </form>
          <p class="dialog-switch">
            {{ registerMode ? '¿Ya tenés cuenta?' : '¿Primera vez por acá?' }}
            <button type="button" @click="registerMode = !registerMode; errorMessage = ''">{{ registerMode ? 'Ingresá' : 'Creá tu cuenta' }}</button>
          </p>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="storeFormOpen" class="modal-backdrop" @click.self="storeFormOpen = false">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="store-title">
          <button class="dialog-close" type="button" aria-label="Cerrar" @click="storeFormOpen = false">×</button>
          <span class="section-kicker">{{ editingStoreId ? 'ACTUALIZÁ TU NEGOCIO' : 'UN NEGOCIO LOCAL HACE LA DIFERENCIA' }}</span>
          <h2 id="store-title">{{ editingStoreId ? 'Editá tu tienda.' : 'Abrí las puertas.' }}</h2>
          <p class="dialog-intro">{{ editingStoreId ? 'Modificá los datos que aparecen en el catálogo.' : 'Contale al barrio qué hacés. Tu tienda va a quedar visible en el catálogo.' }}</p>
          <form class="dialog-form" @submit.prevent="saveStore">
            <label>Nombre de la tienda<input v-model.trim="storeForm.storename" required /></label>
            <label>Descripción<textarea v-model.trim="storeForm.descripcion" rows="2" required></textarea></label>
            <div class="form-row">
              <label>Categoría
                <select v-model="storeForm.categoria" required>
                  <option value="" disabled>Elegí una categoría</option>
                  <option v-for="category in storeCategories" :key="category.name" :value="category.name">
                    {{ category.name }}
                  </option>
                </select>
              </label>
              <label>Zona<input v-model.trim="storeForm.zona" placeholder="Ej. Palermo" /></label>
            </div>
            <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
            <button class="primary-button form-submit" type="submit" :disabled="isSaving">
              {{ isSaving ? 'Guardando…' : editingStoreId ? 'Guardar cambios' : 'Publicar mi tienda' }} <span>→</span>
            </button>
          </form>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="productFormOpen" class="modal-backdrop" @click.self="productFormOpen = false">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="product-title">
          <button class="dialog-close" type="button" aria-label="Cerrar" @click="productFormOpen = false">×</button>
          <span class="section-kicker">{{ selectedStoreInfo?.storename }}</span>
          <h2 id="product-title">{{ editingProductId ? 'Editá el producto.' : 'Sumá algo nuevo.' }}</h2>
          <p class="dialog-intro">{{ editingProductId ? 'Actualizá los datos, el precio o el stock.' : 'Publicá un producto para que tus clientes lo encuentren.' }}</p>
          <form class="dialog-form" @submit.prevent="saveProduct">
            <label>Nombre del producto<input v-model.trim="productForm.nombre" required /></label>
            <label>Descripción<textarea v-model.trim="productForm.descripcion" rows="2" required></textarea></label>
            <div class="form-row">
              <label>Precio<input v-model="productForm.precio" type="number" min="0" step="0.01" required /></label>
              <label>Stock<input v-model="productForm.stock" type="number" min="0" step="1" required /></label>
            </div>
            <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
            <button class="primary-button form-submit" type="submit" :disabled="isSaving">
              {{ isSaving ? 'Guardando…' : editingProductId ? 'Guardar cambios' : 'Publicar producto' }} <span>→</span>
            </button>
          </form>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="cartOpen" class="modal-backdrop cart-backdrop" @click.self="cartOpen = false">
        <section class="dialog cart-dialog" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <button class="dialog-close" type="button" aria-label="Cerrar" @click="cartOpen = false">×</button>
          <span class="section-kicker">TODO LO QUE ELEGISTE</span>
          <h2 id="cart-title">Tu pedido<span class="heading-period">.</span></h2>
          <div v-if="cart.length" class="cart-lines">
            <article v-for="item in cart" :key="item.id" class="cart-line">
              <div class="cart-line-art">✿</div>
              <div class="cart-line-copy"><strong>{{ item.nombre }}</strong><small>{{ item.storeName }}</small><span>{{ formatPrice(item.precio) }}</span></div>
              <div class="quantity-control">
                <button type="button" :aria-label="`Quitar una unidad de ${item.nombre}`" @click="updateQuantity(item.id, -1)">−</button>
                <span>{{ item.quantity }}</span>
                <button type="button" :aria-label="`Sumar una unidad de ${item.nombre}`" :disabled="item.quantity >= item.stock" @click="updateQuantity(item.id, 1)">+</button>
              </div>
            </article>
            <div class="cart-subtotal"><span>Subtotal</span><strong>{{ formatPrice(cartTotal) }}</strong></div>
            <button class="primary-button form-submit" type="button" @click="startCheckout">Ir a pagar <span>→</span></button>
          </div>
          <div v-else class="cart-empty">Todavía no agregaste productos.</div>
        </section>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="notice" class="toast-message" role="status"><span>✳</span>{{ notice }}</div>
    </Transition>
  </div>
</template>
