<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

interface InventoryProduct {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
}

interface InventoryStore {
  id: number;
  nombre: string;
  categoria: string | null;
  productCount: number;
  totalUnits: number;
  outOfStockCount: number;
  inventoryValue: number;
  products: InventoryProduct[];
}

interface InventoryReport {
  summary: {
    storeCount: number;
    productCount: number;
    totalUnits: number;
    outOfStockCount: number;
    inventoryValue: number;
  };
  stores: InventoryStore[];
}

interface ApiError {
  error?: string;
}

const report = ref<InventoryReport | null>(null);
const selectedStoreId = ref('all');
const searchQuery = ref('');
const isLoading = ref(true);
const errorMessage = ref('');

const visibleStores = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return (report.value?.stores ?? [])
    .filter((store) => selectedStoreId.value === 'all' || store.id === Number(selectedStoreId.value))
    .map((store) => ({
      ...store,
      products: store.products.filter((product) =>
        !query || `${product.nombre} ${store.nombre}`.toLocaleLowerCase().includes(query)),
    }))
    .filter((store) => store.products.length || (!query && store.productCount === 0));
});

const formatPrice = (price: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(price);

const loadReport = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await fetch('/api/v1/reportes/inventario', { credentials: 'same-origin' });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as ApiError;
      if (response.status === 401) {
        throw new Error('Iniciá sesión para ver el reporte. Volvé a tiendas e ingresá a tu cuenta.');
      }
      throw new Error(body.error ?? 'No se pudo cargar el reporte.');
    }
    report.value = await response.json() as InventoryReport;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No se pudo cargar el reporte.';
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadReport);
</script>

<template>
  <div class="app-shell report-page">
    <header class="topbar">
      <RouterLink class="brand" to="/tiendas" aria-label="Mercado Ya, volver a tiendas">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span>Mercado <span class="brand-accent">Ya</span></span>
      </RouterLink>
      <RouterLink class="outline-button" to="/tiendas">← Volver a tiendas</RouterLink>
    </header>

    <main>
      <section class="report-heading">
        <span class="section-kicker">TU NEGOCIO, EN NÚMEROS</span>
        <h1>Reporte de inventario<span class="heading-period">.</span></h1>
        <p>Un resumen del catálogo y el stock de tus tiendas.</p>
      </section>

      <div v-if="errorMessage" class="error-banner" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" @click="loadReport">Reintentar</button>
      </div>

      <template v-else-if="report">
        <section class="report-metrics" aria-label="Resumen del inventario">
          <article class="report-metric">
            <span>Tiendas propias</span>
            <strong>{{ report.summary.storeCount }}</strong>
          </article>
          <article class="report-metric">
            <span>Productos publicados</span>
            <strong>{{ report.summary.productCount }}</strong>
          </article>
          <article class="report-metric">
            <span>Unidades disponibles</span>
            <strong>{{ report.summary.totalUnits }}</strong>
          </article>
          <article class="report-metric report-metric-warning">
            <span>Productos agotados</span>
            <strong>{{ report.summary.outOfStockCount }}</strong>
          </article>
          <article class="report-metric report-metric-value">
            <span>Valor estimado del stock</span>
            <strong>{{ formatPrice(report.summary.inventoryValue) }}</strong>
          </article>
        </section>
        <p class="report-disclaimer">
          El valor estimado se calcula como precio actual × unidades en stock; no representa ventas ni ingresos.
        </p>

        <section class="report-inventory">
          <div class="report-toolbar">
            <div>
              <span class="section-kicker">DETALLE</span>
              <h2>Stock por tienda</h2>
            </div>
            <div class="report-filters">
              <label>
                <span class="sr-only">Filtrar por tienda</span>
                <select v-model="selectedStoreId">
                  <option value="all">Todas mis tiendas</option>
                  <option v-for="store in report.stores" :key="store.id" :value="String(store.id)">
                    {{ store.nombre }}
                  </option>
                </select>
              </label>
              <label>
                <span class="sr-only">Buscar producto o tienda</span>
                <input v-model="searchQuery" type="search" placeholder="Buscar en el inventario" />
              </label>
            </div>
          </div>

          <div v-if="isLoading" class="report-empty">Cargando inventario…</div>
          <div v-else-if="!visibleStores.length" class="report-empty">
            No hay productos que coincidan con esos filtros.
          </div>
          <div v-else class="report-store-list">
            <article v-for="store in visibleStores" :key="store.id" class="report-store">
              <header class="report-store-heading">
                <div>
                  <span class="section-kicker">{{ store.categoria || 'TIENDA LOCAL' }}</span>
                  <h3>{{ store.nombre }}</h3>
                </div>
                <div class="report-store-totals">
                  <span>{{ store.outOfStockCount }} agotados</span>
                  <span>{{ store.totalUnits }} unidades</span>
                  <span>{{ formatPrice(store.inventoryValue) }} estimado</span>
                </div>
              </header>
              <div v-if="store.products.length" class="report-table-wrap">
                <table class="report-table">
                  <thead>
                    <tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="product in store.products" :key="product.id">
                      <td>{{ product.nombre }}</td>
                      <td>{{ formatPrice(product.precio) }}</td>
                      <td>{{ product.stock }}</td>
                      <td>
                        <span :class="['stock-status', product.stock === 0 ? 'stock-status-empty' : '']">
                          {{ product.stock === 0 ? 'Agotado' : 'Disponible' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="report-store-empty">Todavía no hay productos publicados en esta tienda.</p>
            </article>
          </div>
        </section>
      </template>
      <div v-else-if="isLoading" class="report-empty">Cargando inventario…</div>
    </main>
  </div>
</template>
