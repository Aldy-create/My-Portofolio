import './style.css'
import './threejs-override.js'
import { Game } from './Game/Game.js'

// Detect touch-first devices (coarse pointer without hover) so desktop touchscreens stay in mouse/keyboard mode until touched.
const isTouchDevice = window.matchMedia('(pointer: coarse) and (hover: none)').matches
if(isTouchDevice)
    document.documentElement.classList.add('is-mode-touch')

window.game = new Game()
