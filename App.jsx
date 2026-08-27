import React, { useState, useEffect, useRef } from 'react';

// Web Audio API generator to provide native ambient sounds without needing heavy files
class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.nodes = {};
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  start(type) {
    this.init();
    if (this.nodes[type]) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    if (type === 'rain' || type === 'white') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= type === 'rain' ? 3.5 : 0.5; 
      }
    } else {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.sin(i * 0.005) * Math.random() * 0.2;
      }
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = type === 'rain' ? 800 : 1200;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    whiteNoise.start();
    this.nodes[type] = { source: whiteNoise, gain: gainNode };
  }

  stop(type) {
    if (this.nodes[type]) {
      try {
        this.nodes[type].source.stop();
      } catch (e) {}
      delete this.nodes[type];
    }
  }

  triggerChime() {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }
}

const audioEngine = new AmbientSoundEngine();

export default function App() {
  const MODES = {
    pomodoro: { name: 'Focus Session', time: 25 * 60, accent: 'from-emerald-400 to-teal-500' },
    short: { name: 'Short Break', time: 5 * 60, accent: 'from-sky-400 to-indigo-500' },
    long: { name: 'Long Break', time: 15 * 60, accent: 'from-purple-400 to-pink-500' }
  };

  const [activeMode, setActiveMode] = useState('pomodoro');
  const [timeLeft, setTimeLeft] = useState(MODES.pomodoro.time);
  const [isRunning, setIsRunning] = useState(false);
  const [forest, setForest] = useState(() => {
    const saved = localStorage.getItem('zenforest_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeSounds, setActiveSounds] = useState({ rain: false, white: false, ocean: false });

  const timerRef = useRef(null);
  const totalDuration = MODES[activeMode].time;
  const progressPercentage = ((totalDuration - timeLeft) / totalDuration) * 100;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSessionCompletion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, activeMode]);

  useEffect(() => {
    localStorage.setItem('zenforest_history', JSON.stringify(forest));
  }, [forest]);

  const handleModeChange = (modeKey) => {
    setIsRunning(false);
    setActiveMode(modeKey);
    setTimeLeft(MODES[modeKey].time);
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    if (activeMode === 'pomodoro' && timeLeft < totalDuration && timeLeft > 0) {
      if (confirm("Abandon your focus? Your current tree will wither.")) {
        addTreeToForest(false);
        setTimeLeft(MODES[activeMode].time);
      }
    } else {
      setTimeLeft(MODES[activeMode].time);
    }
  };

  const handleSessionCompletion = () => {
    setIsRunning(false);
    audioEngine.triggerChime();
    
    if (activeMode === 'pomodoro') {
      addTreeToForest(true);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification("Session Finished", {
        body: activeMode === 'pomodoro' ? "Excellent work! Your tree has been successfully added to your garden." : "Break is over. Ready to dive back in?",
        icon: "/icons/icon-192.png"
      });
    }

    if (activeMode === 'pomodoro') {
      handleModeChange('short');
    } else {
      handleModeChange('pomodoro');
    }
  };

  const addTreeToForest = (isHealthy) => {
    const treeTypes = ['🌲', '🌳', '🌴', '🌿', '🍁'];
    const randomTree = treeTypes[Math.floor(Math.random() * treeTypes.length)];
    const newEntry = {
      id: Date.now(),
      type: isHealthy ? randomTree : '🍂',
      status: isHealthy ? 'healthy' : 'withered',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setForest([newEntry, ...forest]);
  };

  const toggleSound = (soundType) => {
    const nextState = !activeSounds[soundType];
    setActiveSounds(prev => ({ ...prev, [soundType]: nextState }));
    if (nextState) {
      audioEngine.start(soundType);
    } else {
      audioEngine.stop(soundType);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 md:p-12 relative overflow-hidden bg-gradient-to-b from-[#0F172A] to-[#0B0F19]">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse-slow" />

      <header className="w-full max-w-5xl flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl tracking-wider uppercase font-light text-emerald-400/90 font-sans">Zen</span>
          <span className="font-serif italic text-2xl text-slate-200">Forest</span>
        </div>
        <div className="text-xs text-slate-400/80 bg-slate-900/40 border border-slate-800/60 rounded-full px-4 py-1.5 backdrop-blur-md">
          PWA Premium Focus Environment
        </div>
      </header>

      <main className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto z-10">
        <div className="lg:col-span-3 order-3 lg:order-1 flex flex-col gap-4 w-full">
          <div className="bg-slate-900/30 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-4 font-medium">Ambient Mixers</h3>
            <div className="flex flex-col gap-3">
              {[
                { id: 'rain', label: 'Soothing Rain', icon: '🌧️' },
                { id: 'white', label: 'Deep White Noise', icon: '💨' },
                { id: 'ocean', label: 'Ethereal Waves', icon: '🌊' }
              ].map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => toggleSound(sound.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all duration-300 ${
                    activeSounds[sound.id]
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-md shadow-emerald-900/10'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:border-slate-700/80'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-base">{sound.icon}</span>
                    <span className="font-light tracking-wide">{sound.label}</span>
                  </span>
                  <div className={`w-2 h-2 rounded-full transition-all duration-500 ${activeSounds[sound.id] ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 order-1 lg:order-2 flex flex-col items-center justify-center w-full">
          <div className="flex items-center gap-1 bg-slate-900/50 p-1.5 rounded-full border border-slate-800/40 mb-8 backdrop-blur-md">
            {Object.keys(MODES).map((modeKey) => (
              <button
                key={modeKey}
                onClick={() => handleModeChange(modeKey)}
                className={`px-4 py-1.5 rounded-full text-xs transition-all duration-300 tracking-wide font-light ${
                  activeMode === modeKey
                    ? 'bg-slate-800 text-slate-100 font-medium shadow-inner'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {modeKey === 'pomodoro' ? 'Focus' : modeKey === 'short' ? 'Short' : 'Long'}
              </button>
            ))}
          </div>

