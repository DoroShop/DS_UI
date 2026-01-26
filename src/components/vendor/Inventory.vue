<script setup lang="ts">
import { ref, computed } from 'vue'

interface Product {
  id: string
  name: string
  category: string
  stock: number
  minStock: number
  price: number
  image: string
  lastRestocked: string
}

const products = ref<Product[]>([
  {
    id: '1',
    name: 'Bluetooth Headphones',
    category: 'Electronics',
    stock: 25,
    minStock: 10,
    price: 2199,
    image: 'https://images.pexels.com/photos/3945667/pexels-photo-3945667.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastRestocked: '2025-01-10'
  },
  {
    id: '2',
    name: 'Wireless Mouse',
    category: 'Electronics',
    stock: 50,
    minStock: 15,
    price: 799,
    image: 'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastRestocked: '2025-01-08'
  },
  {
    id: '3',
    name: 'Laptop Stand',
    category: 'Accessories',
    stock: 4,
    minStock: 5,
    price: 3299,
    image: 'https://images.pexels.com/photos/18105/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=100',
    lastRestocked: '2025-01-05'
  },
  {
    id: '4',
    name: 'USB-C Cable',
    category: 'Electronics',
    stock: 100,
    minStock: 20,
    price: 299,
    image: 'https://images.pexels.com/photos/163100/circuit-circuit-board-resistor-computer-163100.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastRestocked: '2025-01-12'
  },
  {
    id: '5',
    name: 'Phone Case',
    category: 'Accessories',
    stock: 3,
    minStock: 5,
    price: 599,
    image: 'https://images.pexels.com/photos/325153/pexels-photo-325153.jpeg?auto=compress&cs=tinysrgb&w=100',
    lastRestocked: '2025-01-01'
  }
])

const filterType = ref('all')
const selectedCategory = ref('all')
const showRestockModal = ref(false)
const restockingProduct = ref<Product | null>(null)
const restockQuantity = ref(0)

const categories = computed(() => {
  const cats = ['all', ...new Set(products.value.map(p => p.category))]
  return cats
})

const filteredProducts = computed(() => {
  let filtered = products.value

  // Filter by category
  if (selectedCategory.value !== 'all') {
    filtered = filtered.filter(p => p.category === selectedCategory.value)
  }

  // Filter by stock level
  if (filterType.value === 'low-stock') {
    filtered = filtered.filter(p => p.stock <= p.minStock)
  } else if (filterType.value === 'out-of-stock') {
    filtered = filtered.filter(p => p.stock === 0)
  }

  return filtered
})

const lowStockCount = computed(() => {
  return products.value.filter(p => p.stock <= p.minStock).length
})

const outOfStockCount = computed(() => {
  return products.value.filter(p => p.stock === 0).length
})

const totalValue = computed(() => {
  return products.value.reduce((total, product) => total + (product.stock * product.price), 0)
})

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getStockStatus = (product: Product) => {
  if (product.stock === 0) return 'out-of-stock'
  if (product.stock <= product.minStock) return 'low-stock'
  return 'in-stock'
}

const getStockStatusColor = (product: Product) => {
  const status = getStockStatus(product)
  const colors = {
    'out-of-stock': 'var(--error-color)',
    'low-stock': 'var(--warning-color)',
    'in-stock': 'var(--success-color)'
  }
  return colors[status]
}

const getStockStatusText = (product: Product) => {
  const status = getStockStatus(product)
  const texts = {
    'out-of-stock': 'Out of Stock',
    'low-stock': 'Low Stock',
    'in-stock': 'In Stock'
  }
  return texts[status]
}

const openRestockModal = (product: Product) => {
  restockingProduct.value = product
  restockQuantity.value = 0
  showRestockModal.value = true
}

const closeRestockModal = () => {
  showRestockModal.value = false
  restockingProduct.value = null
  restockQuantity.value = 0
}

const restockProduct = () => {
  if (restockingProduct.value && restockQuantity.value > 0) {
    restockingProduct.value.stock += restockQuantity.value
    restockingProduct.value.lastRestocked = new Date().toISOString().split('T')[0]
    closeRestockModal()
  }
}
</script>

<template>
  <div class="inventory">
    <div class="page-header">
      <h1>Inventory</h1>
      <div class="inventory-stats">
        <span class="stat-item">
          <span class="stat-label">Total Value:</span>
          <span class="stat-value">{{ formatCurrency(totalValue) }}</span>
        </span>
      </div>
    </div>

    <!-- Alert Cards -->
    <div class="alert-cards">
      <div v-if="lowStockCount > 0" class="alert-card warning">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <h3>Low Stock Alert</h3>
          <p>{{ lowStockCount }} product(s) running low on stock</p>
        </div>
      </div>
      
      <div v-if="outOfStockCount > 0" class="alert-card error">
        <div class="alert-icon">🚨</div>
        <div class="alert-content">
          <h3>Out of Stock</h3>
          <p>{{ outOfStockCount }} product(s) are out of stock</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label for="category">Category:</label>
        <select id="category" v-model="selectedCategory" class="filter-select">
          <option v-for="category in categories" :key="category" :value="category">
            {{ category === 'all' ? 'All Categories' : category }}
          </option>
        </select>
      </div>
      
      <div class="filter-group">
        <label for="stock-filter">Stock Level:</label>
        <select id="stock-filter" v-model="filterType" class="filter-select">
          <option value="all">All Products</option>
          <option value="low-stock">Low Stock</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>
    </div>

    <!-- Inventory Table -->
    <div class="inventory-table">
      <div class="table-header">
        <div class="table-row header-row">
          <div class="table-cell">Product</div>
          <div class="table-cell">Category</div>
          <div class="table-cell">Stock</div>
          <div class="table-cell">Status</div>
          <div class="table-cell">Value</div>
          <div class="table-cell">Last Restocked</div>
          <div class="table-cell">Actions</div>
        </div>
      </div>
      
      <div class="table-body">
        <div v-for="product in filteredProducts" :key="product.id" class="table-row">
          <div class="table-cell product-cell">
            <img :src="product.image" :alt="product.name" class="product-image">
            <div class="product-info">
              <div class="product-name">{{ product.name }}</div>
              <div class="product-price">{{ formatCurrency(product.price) }}</div>
            </div>
          </div>
          <div class="table-cell">{{ product.category }}</div>
          <div class="table-cell stock-cell">
            <span class="stock-number">{{ product.stock }}</span>
            <span class="min-stock">Min: {{ product.minStock }}</span>
          </div>
          <div class="table-cell">
            <span class="stock-status" :style="{ color: getStockStatusColor(product) }">
              {{ getStockStatusText(product) }}
            </span>
          </div>
          <div class="table-cell">{{ formatCurrency(product.stock * product.price) }}</div>
          <div class="table-cell">{{ formatDate(product.lastRestocked) }}</div>
          <div class="table-cell">
            <button @click="openRestockModal(product)" class="btn btn-primary">
              Restock
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Restock Modal -->
    <div v-if="showRestockModal" class="modal-overlay" @click="closeRestockModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Restock Product</h2>
          <button @click="closeRestockModal" class="close-btn">×</button>
        </div>
        
        <div class="modal-body">
          <div v-if="restockingProduct" class="restock-product">
            <img :src="restockingProduct.image" :alt="restockingProduct.name" class="restock-image">
            <div class="restock-info">
              <h3>{{ restockingProduct.name }}</h3>
              <p>Current Stock: {{ restockingProduct.stock }}</p>
              <p>Minimum Stock: {{ restockingProduct.minStock }}</p>
            </div>
          </div>
          
          <div class="form-group">
            <label for="restock-quantity">Quantity to Add:</label>
            <input 
              type="number" 
              id="restock-quantity" 
              v-model="restockQuantity" 
              min="1"
              class="form-input"
            >
          </div>
          
          <div v-if="restockingProduct && restockQuantity > 0" class="restock-summary">
            <p>New Stock Level: {{ restockingProduct.stock + restockQuantity }}</p>
            <p>Total Value: {{ formatCurrency((restockingProduct.stock + restockQuantity) * restockingProduct.price) }}</p>
          </div>
        </div>
        
        <div class="modal-actions">
          <button @click="restockProduct" :disabled="restockQuantity <= 0" class="btn btn-primary">
            Restock
          </button>
          <button @click="closeRestockModal" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inventory {
  padding: 1rem 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 2rem;
}

.inventory-stats {
  display: flex;
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--primary-color);
}

.alert-cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.alert-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-radius: 8px;
  gap: 1rem;
}

.alert-card.warning {
  background-color: var(--warning-light);
  border: 1px solid var(--warning-color);
}

.alert-card.error {
  background-color: var(--error-light);
  border: 1px solid var(--error-color);
}

.alert-icon {
  font-size: 1.5rem;
}

.alert-content h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
}

.alert-content p {
  margin: 0;
  font-size: 0.875rem;
  opacity: 0.9;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.875rem;
  background-color: var(--bg-white);
}

.inventory-table {
  background: var(--bg-white);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.table-header {
  background-color: var(--bg-gray);
  border-bottom: 1px solid var(--border-color);
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 1fr;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
}

.table-row:not(.header-row) {
  border-bottom: 1px solid var(--border-color);
}

.table-row:last-child {
  border-bottom: none;
}

.header-row {
  font-weight: 600;
  color: var(--text-primary);
}

.table-cell {
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.product-image {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

.product-info {
  flex: 1;
}

.product-name {
  font-weight: 500;
  color: var(--text-primary);
}

.product-price {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.stock-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stock-number {
  font-weight: 600;
  color: var(--text-primary);
}

.min-stock {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.stock-status {
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: var(--bg-gray);
  font-size: 0.75rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--primary-dark);
}

.btn-primary:disabled {
  background-color: var(--bg-gray);
  color: var(--text-secondary);
  cursor: not-allowed;
}

.btn-secondary {
  background-color: var(--bg-gray);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background-color: var(--border-color);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-white);
  border-radius: 8px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.modal-body {
  padding: 1.5rem;
}

.restock-product {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: var(--bg-gray);
  border-radius: 6px;
}

.restock-image {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
}

.restock-info h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.restock-info p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 1rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.restock-summary {
  padding: 1rem;
  background-color: var(--primary-light);
  border-radius: 6px;
  margin-top: 1rem;
}

.restock-summary p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .table-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .table-cell {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .table-cell:before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .product-cell {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .product-cell:before {
    display: none;
  }
  
  .header-row {
    display: none;
  }
  
  .alert-cards {
    flex-direction: column;
  }
  
  .filters {
    flex-direction: column;
  }
  
  .inventory-stats {
    flex-direction: column;
    align-items: flex-end;
  }
}
</style>