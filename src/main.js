import './bridge'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

if (window.aion2Overlay) document.documentElement.classList.add('overlay')

createApp(App).mount('#app')
