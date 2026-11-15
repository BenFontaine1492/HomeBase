import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { vuetify } from './plugins/vuetify'
import { logError } from './services/log.service'
import './assets/styles/main.css'

const app = createApp(App)

app.config.errorHandler = (error, _instance, info) => {
  console.error(`[HomeBase] Unhandled error (${info}):`, error)
  logError(`Unhandled error (${info})`, error)
}

window.addEventListener('error', (event) => {
  logError('Uncaught error', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection', event.reason)
})

app.use(router).use(vuetify).mount('#app')
