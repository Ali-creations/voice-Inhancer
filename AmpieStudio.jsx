import React, { useState, useEffect, useRef } from 'react';

export default function AmpieStudio() {
  // Navigation & View Toggling State Management
  const [activeTab, setActiveTab] = useState('enhancerView');
  const [status, setStatus] = useState('RADIOACTIVE');
  
  // Voice Enhancer Parameters
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [tonePreset, setTonePreset] = useState('balanced');
  const [noisePreset, setNoisePreset] = useState('35');
  const [noiseReduction, setNoiseReduction] = useState(35);
  const [voiceClarity, setVoiceClarity] = useState(50);
  const [bassWarmth, setBassWarmth] = useState(0);
  const [gainAmplification, setGainAmplification] = useState(6);

  // Text To Speech Parameters
  const [ttsText, setTtsText] = useState('');
  const [ttsLanguage, setTtsLanguage] = useState('en-US');
  const [ttsRate, setTtsRate] = useState(100);
  const [ttsPitch, setTtsPitch] = useState(100);
  const [ttsVolume, setTtsVolume] = useState(90);

  // Speech To Text State
  const [sttText, setSttText] = useState('');
  const [sttLanguage, setSttLanguage] = useState('en-US');
  const [sttStatus, setSttStatus] = useState('MIC OFF');

  // Animation Engine Canvas Initialization Hook
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let particles = [];
    let mouse = { x: null, y: null, active: false };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    class ElectricNode {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.radius = Math.random() * 2 + 1;
        const hues = ['#39FF14', '#00FFFF', '#D700FF', '#FFF21A'];
        this.color = hues[Math.floor(Math.random() * hues.length)];
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

        if (mouse.active) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.hypot(dx, dy);
          if (distance < 200) {
            this.x += (dx / distance) * 2;
            this.y += (dy / distance) * 2;
          }
        }
      }
    }

    const count = Math.floor((canvas.width * canvas.height) / 7000);
    for (let i = 0; i < count; i++) {
      particles.push(new ElectricNode());
    }

    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onMouseLeave = () => { mouse.active = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(18, 1, 36, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }

      // Link vector rendering
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          let dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(215, 0, 255, ${0.12 * (1 - dist / 110)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(renderLoop);
    };
    renderLoop();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#120124] text-[#FFF21A] font-mono selection:bg-[#D700FF] selection:text-white">
      {/* Dynamic Interaction Canvas Layer */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none mix-blend-screen" />
      <div className="fixed inset-0 z-1 pointer-events-none bg-radial-gradient" />

      <main className="relative max-w-[1200px] mx-auto px-6 py-10 z-10">
        {/* App Bar Header */}
        <header className="h-[70px] flex items-center justify-between bg-[#06000c] border-4 border-[#FFF21A] shadow-[8px_8px_0px_#D700FF] px-5 mb-10 transform -rotate-[0.5deg]">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">⚡</span>
            <div>
              <strong className="text-xl uppercase tracking-tight text-white">Ampie</strong>
              <small className="block text-[11px] text-[#39FF14] font-bold">X-STREAM DSP</small>
            </div>
          </div>
          <div className="border-2 border-[#39FF14] px-4 py-1 text-xs font-bold text-[#39FF14] shadow-[4px_4px_0px_#39FF14]">
            <i className="inline-block w-1.5 h-1.5 bg-[#39FF14] mr-2 rounded-full" />
            <span>{status}</span>
          </div>
        </header>

        {/* Dynamic Navigation System */}
        <nav className="flex gap-3 mb-8 flex-wrap">
          {[
            { id: 'enhancerView', label: 'Voice Enhancer' },
            { id: 'ttsView', label: 'Text To Speech' },
            { id: 'sttView', label: 'Speech To Text' },
            { id: 'referenceView', label: 'Voice Matrix' },
            { id: 'aboutView', label: 'Terminal' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-3 border-[#FFF21A] bg-[#06000c] text-[#FFF21A] px-5 py-3 text-sm font-bold uppercase shadow-[4px_4px_0px_#FFF21A] transition-all hover:bg-[#D700FF] hover:text-white pointer-events-auto ${
                activeTab === tab.id ? 'bg-[#39FF14] text-[#06000c] shadow-[0px_0px_0px_transparent] translate-x-1 translate-y-1' : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* 01. VOICE ENHANCER GRID */}
        {activeTab === 'enhancerView' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#06000c] border-4 border-[#FFF21A] p-8 shadow-[14px_14px_0px_#D700FF] hover:shadow-[18px_18px_0px_#00FFFF] transition-all duration-200">
              <div className="border-b border-[#3D0066] pb-4 mb-6 flex justify-between items-center">
                <div className="text-xl uppercase font-bold text-white"><span className="text-[#39FF14] mr-2">IN //</span>Audio Stream</div>
                <button disabled={!file} onClick={() => setFile(null)} className="border-2 border-[#FFF21A] text-[#FFF21A] w-9 h-9 font-black cursor-pointer disabled:opacity-30">↻</button>
              </div>

              {!file ? (
                <div className="h-[260px] border-3 border-dashed border-[#00FFFF] bg-black/40 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-[60px] h-[60px] border-3 border-[#D700FF] bg-black flex items-center justify-center mb-3">
                    <span className="text-[#00FFFF] text-xl">▲</span>
                  </div>
                  <h3 className="font-bold text-base text-white mb-1">Inject Core Recording</h3>
                  <p className="text-xs text-[#E294E7] mb-4">MP3, WAV, M4A or OGG · up to 100 MB</p>
                  <button onClick={() => fileInputRef.current.click()} className="border-3 border-[#FFF21A] bg-[#00FFFF] text-black font-bold uppercase px-5 py-3 text-xs shadow-[4px_4px_0px_#FFF21A] hover:bg-[#39FF14]">Choose Audio File</button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />
                  <div className="flex items-center w-full text-[#BC85E6] text-xs my-3 before:h-[2px] before:bg-[#3D0066] before:flex-1 after:h-[2px] after:bg-[#3D0066] after:flex-1"><span className="px-2.5">or</span></div>
                  <button onClick={() => setIsRecording(!isRecording)} className="bg-none border-none text-white font-bold flex items-center gap-2 cursor-pointer">
                    <span className={`w-2 h-2 rounded-full bg-red-600 ${isRecording ? 'animate-ping' : ''}`} />
                    <span>{isRecording ? 'RECORDING RUNNING...' : 'TAP TO CAPTURE MIC'}</span>
                  </button>
                </div>
              ) : (
                <div className="h-[260px] border-3 border-[#39FF14] bg-black/40 flex items-center justify-between p-6">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="text-3xl">♫</div>
                    <div className="min-w-0">
                      <strong className="block text-sm text-white truncate font-bold">{file.name}</strong>
                      <span className="block text-xs text-[#BC85E6] mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  </div>
                  <button onClick={() => setFile(null)} className="border-2 border-red-500 text-red-500 px-3 py-1 font-bold">×</button>
                </div>
              )}
            </div>

            <div className="bg-[#06000c] border-4 border-[#FFF21A] p-8 shadow-[14px_14px_0px_#00FFFF]">
              <div className="border-b border-[#3D0066] pb-4 mb-6 flex justify-between items-center">
                <div className="text-xl uppercase font-bold text-white"><span className="text-[#39FF14] mr-2">OUT //</span>Parameters</div>
                <span className="text-xs text-[#BC85E6]">GLITCH CORE DSP</span>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  {['balanced', 'warm', 'cold'].map((t) => (
                    <button key={t} onClick={() => setTonePreset(t)} className={`flex-1 min-h-[38px] border-2 border-[#3D0066] bg-white/5 text-[#BC85E6] font-bold text-xs uppercase ${tonePreset === t ? 'bg-[#D700FF] text-white border-[#FFF21A]' : ''}`}>{t}</button>
                  ))}
                </div>

                <div className="flex gap-2">
                  {['35', '55', '78'].map((n) => (
                    <button key={n} onClick={() => setNoisePreset(n)} className={`flex-1 min-h-[38px] border-2 border-[#3D0066] bg-white/5 text-[#BC85E6] font-bold text-xs uppercase ${noisePreset === n ? 'bg-[#D700FF] text-white border-[#FFF21A]' : ''}`}>{n}</button>
                  ))}
                </div>

                {[
                  { label: 'Noise Isolation', value: noiseReduction, setter: setNoiseReduction, suffix: '%' },
                  { label: 'Laser Clarity', value: voiceClarity, setter: setVoiceClarity, suffix: '%' },
                  { label: 'Sub Bass Boost', value: bassWarmth, setter: setBassWarmth, min: -8, max: 8, suffix: ' dB' },
                  { label: 'Volume Gain', value: gainAmplification, setter: setGainAmplification, max: 18, suffix: ' dB' }
                ].map((slider, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-white">
                      <span>{slider.label}</span>
                      <span>{slider.value}{slider.suffix}</span>
                    </div>
                    <input type="range" min={slider.min || 0} max={slider.max || 100} value={slider.value} onChange={(e) => slider.setter(+e.target.value)} className="w-full" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 02. RESTRUCTURED SPATIAL TEXT TO SPEECH VIEW */}
        {activeTab === 'ttsView' && (
          <section className="bg-[#06000c] border-4 border-[#FFF21A] p-8 shadow-[14px_14px_0px_#D700FF]">
            <div className="border-b border-[#3D0066] pb-4 mb-6 text-xl uppercase font-bold text-white"><span className="text-[#39FF14] mr-2">TTS //</span>Text Matrix</div>
            <textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder="Type or paste the raw layout content data..." className="w-full min-h-[160px] bg-black border-3 border-[#3D0066] text-white p-4 font-inherit outline-none focus:border-[#39FF14] mb-6" />
            <button onClick={() => setTtsText('')} className="border-3 border-black bg-transparent text-[#BC85E6] uppercase font-bold px-5 py-3 text-xs shadow-[4px_4px_0px_#000000] hover:border-[#FFF21A] hover:text-[#FFF21A]">KILL SPEECH</button>
          </section>
        )}

        {/* 03. SPEECH TO TEXT VIEW */}
        {activeTab === 'sttView' && (
          <section className="bg-[#06000c] border-4 border-[#FFF21A] p-8 shadow-[14px_14px_0px_#00FFFF]">
            <div className="border-b border-[#3D0066] pb-4 mb-6 flex justify-between items-center">
              <div className="text-xl uppercase font-bold text-white"><span className="text-[#39FF14] mr-2">STT //</span>Data Stream Transcription</div>
              <span className="text-xs text-[#39FF14] font-bold">{sttStatus}</span>
            </div>
            <textarea value={sttText} onChange={(e) => setSttText(e.target.value)} placeholder="System logs print metrics..." className="w-full min-h-[160px] bg-black border-3 border-[#3D0066] text-white p-4 font-inherit outline-none focus:border-[#39FF14]" />
          </section>
        )}

        {/* 04. VOICE REFERENCE VIEW */}
        {activeTab === 'referenceView' && (
          <section className="bg-[#06000c] border-4 border-[#FFF21A] p-8 shadow-[14px_14px_0px_#D700FF]">
            <div className="border-b border-[#3D0066] pb-4 mb-6 text-xl uppercase font-bold text-white"><span className="text-[#39FF14] mr-2">REF //</span>Vector Fingerprints</div>
            <p className="text-sm text-[#BC85E6]">Biometric soundwave parsing maps execute safely here.</p>
          </section>
        )}

        {/* 05. TERMINAL LAYER VIEW */}
        {activeTab === 'aboutView' && (
          <section className="bg-[#06000c] border-4 border-[#FFF21A] p-8 shadow-[14px_14px_0px_#00FFFF]">
            <div className="border-b border-[#3D0066] pb-4 mb-6 text-xl uppercase font-bold text-white"><span className="text-[#39FF14] mr-2">SYS //</span>Terminal Logs</div>
            <p className="text-sm text-white">Core status: 100% operational. DSP threads running safely inside local server matrices.</p>
          </section>
        )}
      </main>
      
      <footer className="text-center text-xs text-[#BC85E6] py-6 z-10 relative">
        DATA STAYS ISOLATED. OPERATING UNDER AMPIE RADICAL INTERACTION INTERFACES.
      </footer>
    </div>
  );
}