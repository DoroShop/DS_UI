<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProductsStore } from '../stores/productStores'
import { FeatureSeller } from "../types/seller"

const router = useRouter();
const productStore = useProductsStore();
const featuredSeller = computed<FeatureSeller[]>(() => productStore.featuredSeller);

const viewVendor = (vendorId) => {
    router.push(`/view/vendor/${vendorId}`)
}

</script>
<template>
    <section class="featured-seller-container">
        <h3>Featured Seller</h3>
        <div class="content-container">
            <div v-for="(item, index) in featuredSeller" @click="viewVendor(item.userId)" :key="index" class="profile">
                <img :src="item.imageUrl || '../assets/fruit.png'" fetchpriority="low" loading="lazy" :alt="item.storeName" />
                <p>{{ item.storeName }}</p>
            </div>
        </div>
    </section>
</template>
<style scoped>
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
.featured-seller-container {
    animation: fadeIn 0.3s ease-out;
    width: 100%;
    height: fit-content;
    margin: 0px auto;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    gap: .7rem;
    overflow: hidden;

}

.featured-seller-container h3 {
    font-size: clamp(1rem, 3vw, 1.5rem);
    margin: 0 auto;
    width: 100%;
    max-width: 1200px;
}

.content-container {
    width: 100%;

    height: fit-content;
    display: flex;
    gap: 1rem;
    overflow: auto;
    margin: 0 auto;
}

.content-container:hover {
    scrollbar-width: thin;
}

.profile {
    height: fit-content;

    margin: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.profile img {
    width: clamp(4rem, 5vw, 5rem);
    aspect-ratio: 1;
    background-color: rebeccapurple;
    border-radius: 50rem;
    background-size: cover;
    background-position: center;    
    object-fit: cover;
    margin: 0;
    padding: 0;
    border: 2px solid var(--primary-color);
    box-shadow: 0 0 5px rgba(216, 216, 216, 0.473);
}

.profile p {
    font-size: clamp(var(--font-size-xs), 3vw, var(--font-size-lg));
    /* fallback if you don't have CSS vars */
    text-align: center;
    max-width: 7ch;
    /* allow a reasonable name length */
    overflow: hidden;
    /* required for ellipsis */
    white-space: nowrap;
    /* prevent wrapping */
    text-overflow: ellipsis;
    /* show ... when overflowing */
    margin: 0;
    padding-bottom: 5px;
}
</style>