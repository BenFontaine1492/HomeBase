import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { vuetify } from './plugins/vuetify'
import './assets/styles/main.css'

const app = createApp(App)

app.config.errorHandler = (error, _instance, info) => {
  console.error(`[HomeBase] Unhandled error (${info}):`, error)
}

app.use(router).use(vuetify).mount('#app')
