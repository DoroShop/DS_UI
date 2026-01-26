import "./style.css";
import "./styles/themes.css"; // Import global theme system
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";
import Swal from "sweetalert2";
import { useTheme } from "./composables/useTheme.js";
import "./utils/cartSync.js";

const app = createApp(App);
const { theme } = useTheme();

// Register global properties for SweetAlert
app.config.globalProperties.$swal = Swal;

app.use(createPinia());
app.use(router);

app.mount("#app");
