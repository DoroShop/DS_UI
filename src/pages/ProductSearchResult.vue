<script setup>
import { useRoute } from 'vue-router';
import { onMounted } from 'vue';
import { useProductsStore } from '../stores/productStores';
import ProductCard from '../components/ProductCard.vue';
import Loading from '../components/Loading.vue';
import MiniHeader from '../components/MiniHeader.vue';
const productStore = useProductsStore();


const route = useRoute();
const query = route.query.q;

onMounted(async () => {
    await productStore.fetchSearchProducts(query, true)
    console.log("query", productStore.query)
})
</script>
<template>
    <section class="result-container">
        <MiniHeader></MiniHeader>
        <main class="product-content">
            <h3 v-if="productStore.searchResultProducts.length > 0">Products found for "{{ query }}"</h3>
            <h3 v-if="productStore.searchResultProducts.length <= 0">No products found for "{{ query }}"</h3>
            <ProductCard v-if="!productStore.isLoading" typesOfProductList="SearchResultProducts"></ProductCard>
            <Loading v-if="productStore.isLoading"></Loading>
        </main>

    </section>
</template>
<style scoped>
.result-container {
    height: 100dvh;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    max-height: 100dvh;
    box-shadow: 0 0 5px rgba(214, 214, 214, 0.397);
    display: flex;
    flex-direction: column;
    overflow: auto;
}

.header {
    width: 100%;
    padding: 10px 13px;
    background-color: var(--primary-color);
    color: white;
}


h3 {
    padding: 10px;
    color: grey;
    font-weight: 500;
    font-size: clamp(18px, 3vw, 24px);
    width: 100%;
    text-align: center;
}

.product-content {
    padding: 0 10px;
    padding-bottom: 2rem;
    overflow: scroll;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 100%;
    height: 100%;

}
</style>