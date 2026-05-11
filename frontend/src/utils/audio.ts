class UIAudio {
  private ctx: AudioContext | null = null

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    // Resume context if suspended (browser policy)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  playClick() {
    this.init()
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gainNode = this.ctx.createGain()
    
    // soft click / tap sound
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.03)
    
    gainNode.gain.setValueAtTime(0.05, this.ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03)
    
    osc.connect(gainNode)
    gainNode.connect(this.ctx.destination)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.03)
  }

  playSuccess() {
    this.init()
    if (!this.ctx) return
    
    // Apple-like pleasant "ding" success sound
    const playNote = (freq: number, startTime: number, duration: number) => {
      if (!this.ctx) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.1, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }
    
    // Major third harmony for success
    const now = this.ctx.currentTime
    playNote(523.25, now, 0.4) // C5
    playNote(659.25, now + 0.1, 0.6) // E5
  }
}

export const uiAudio = new UIAudio()
