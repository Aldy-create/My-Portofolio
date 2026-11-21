export class SoundEngine {
  constructor(game) {
    this.game = game
    this.enabled = true
    this.context = null
    this.button = document.createElement('button')
    this.button.className = 'world-audio-toggle'
    this.button.type = 'button'
    this.button.textContent = 'Audio: on'
    this.button.setAttribute('aria-label', 'Mute procedural world audio')
    this.button.addEventListener('click', () => this.toggle())
    document.body.append(this.button)
    this.unlock = () => this.start()
    window.addEventListener('pointerdown', this.unlock, { once: true })
    window.addEventListener('keydown', this.unlock, { once: true })
    this.game.inputs.events.on('interact', () => {})
    this.game.ticker.events.on('tick', () => this.update(), 18)
  }
  start() {
    if (this.context || !this.enabled) return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    this.context = new AudioContext()
    this.engineGain = this.context.createGain(); this.engineGain.gain.value = .018; this.engineGain.connect(this.context.destination)
    this.engineOsc = this.context.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 45; this.engineOsc.connect(this.engineGain); this.engineOsc.start()
    this.hydraulicGain = this.context.createGain(); this.hydraulicGain.gain.value = 0; this.hydraulicGain.connect(this.context.destination)
    this.hydraulicOsc = this.context.createOscillator(); this.hydraulicOsc.type = 'sine'; this.hydraulicOsc.frequency.value = 115; this.hydraulicOsc.connect(this.hydraulicGain); this.hydraulicOsc.start()
    this.button.textContent = 'Audio: on'
  }
  toggle() {
    this.enabled = !this.enabled
    this.button.textContent = this.enabled ? 'Audio: on' : 'Audio: off'
    this.button.setAttribute('aria-label', this.enabled ? 'Mute procedural world audio' : 'Enable procedural world audio')
    if (this.enabled) this.start()
    if (this.context) this.context.resume().catch(() => {})
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(this.enabled ? .018 : 0, this.context.currentTime, .04)
    if (this.hydraulicGain) this.hydraulicGain.gain.setTargetAtTime(0, this.context.currentTime, .04)
  }
  honk() {
    if (!this.enabled || !this.context) return
    const osc = this.context.createOscillator(), gain = this.context.createGain()
    osc.type = 'triangle'; osc.frequency.value = 320; gain.gain.value = .05
    osc.connect(gain); gain.connect(this.context.destination); osc.start()
    gain.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + .28); osc.stop(this.context.currentTime + .3)
  }
  impact(force = 8) {
    if (!this.enabled || !this.context || force < 4) return
    const osc = this.context.createOscillator(), gain = this.context.createGain()
    osc.type = 'square'; osc.frequency.value = 90 + Math.min(force, 30) * 7; gain.gain.value = Math.min(.045, .008 + force * .001)
    osc.connect(gain); gain.connect(this.context.destination); osc.start()
    gain.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + .12); osc.stop(this.context.currentTime + .13)
  }
  update() {
    if (!this.enabled || !this.context) return
    if (this.context.state === 'suspended') this.context.resume().catch(() => {})
    const vehicle = this.game.vehicleManager
    const speed = this.game.physicalVehicle?.speed || 0
    this.engineOsc.frequency.setTargetAtTime(38 + Math.min(speed, 22) * 5.6, this.context.currentTime, .08)
    const hydraulic = vehicle?.activeId === 'excavator' && vehicle.hydraulicActive ? .016 : 0
    this.hydraulicGain.gain.setTargetAtTime(hydraulic, this.context.currentTime, .12)
  }
}
