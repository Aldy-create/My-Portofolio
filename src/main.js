import './style.css'
import './threejs-override.js'
import { Game } from './Game/Game.js'

// Detect touch-first devices so the HUD can swap keyboard hints for tap controls.
const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
if(isTouchDevice)
    document.documentElement.classList.add('is-mode-touch')

window.game = new Game()
