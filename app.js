const $ = (s) => document.querySelector(s);
const els = {
  file: $('#fileInput'), choose: $('#chooseBtn'), drop: $('#dropzone'), strip: $('#fileStrip'), fileName: $('#fileName'), fileDetails: $('#fileDetails'),
  remove: $('#removeBtn'), reset: $('#resetBtn'), record: $('#recordBtn'), process: $('#processBtn'), result: $('#resultCard'),
  play: $('#playBtn'), seek: $('#seek'), current: $('#currentTime'), duration: $('#duration'), download: $('#downloadBtn'), compare: $('#compareBtn'),
  canvas: $('#waveform'), toast: $('#toast'), status: $('#statusPill'), processingTime: $('#processingTime')
};
let decodeContext = new (window.AudioContext || window.webkitAudioContext)();
let originalBuffer = null, processedBuffer = null, audio = new Audio(), originalUrl = '', processedUrl = '', mediaRecorder = null, chunks = [], recordingStream = null;

const formatTime = (s = 0) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const toast = (text) => { els.toast.textContent = text; els.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2400); };
const setStatus = (text, working = false) => { els.status.querySelector('span').textContent = text; els.status.querySelector('i').style.animation = working ? 'pulse 1s infinite' : ''; };

[['noise','noiseOut','%'],['clarity','clarityOut','%']].forEach(([id, out, unit]) => {
  const input = $(`#${id}`), output = $(`#${out}`);
  input.addEventListener('input', () => output.value = `${input.value}${unit}`);
});
$('#gain').addEventListener('input', e => $('#gainOut').value = `${e.target.value >= 0 ? '+' : ''}${e.target.value} dB`);
$('#bass').addEventListener('input', e => $('#bassOut').value = `${e.target.value >= 0 ? '+' : ''}${e.target.value} dB`);
$('#volume').addEventListener('input', e => $('#volumeOut').value = `${e.target.value}%`);
$('#pitch').addEventListener('input', e => $('#pitchOut').value = `${e.target.value > 0 ? '+' : ''}${e.target.value} st`);
$('#speed').addEventListener('input', e => $('#speedOut').value = `${(+e.target.value / 100).toFixed(2)}×`);

document.querySelectorAll('.tone-preset').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tone-preset').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  const presets = { balanced: [0, 50], warm: [3, 38], cold: [-2, 72] };
  const [bass, clarity] = presets[button.dataset.tone];
  $('#bass').value = bass; $('#clarity').value = clarity;
  $('#bassOut').value = `${bass >= 0 ? '+' : ''}${bass} dB`;
  $('#clarityOut').value = `${clarity}%`;
}));
document.querySelectorAll('.noise-preset').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.noise-preset').forEach(item => item.classList.remove('active'));
  button.classList.add('active'); $('#noise').value = button.dataset.noise;
  $('#noiseOut').value = `${button.dataset.noise}%`;
}));
els.choose.onclick = () => els.file.click();
els.file.onchange = () => els.file.files[0] && loadFile(els.file.files[0]);
['dragenter','dragover'].forEach(e => els.drop.addEventListener(e, ev => { ev.preventDefault(); els.drop.classList.add('dragover'); }));
['dragleave','drop'].forEach(e => els.drop.addEventListener(e, ev => { ev.preventDefault(); els.drop.classList.remove('dragover'); }));
els.drop.addEventListener('drop', ev => { const file = ev.dataTransfer.files[0]; if (file) loadFile(file); });

async function loadFile(file) {
  if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)) return toast('Please choose an audio file');
  if (file.size > 100 * 1024 * 1024) return toast('File must be under 100 MB');
  setStatus('Decoding…', true);
  try {
    const data = await file.arrayBuffer();
    originalBuffer = await decodeContext.decodeAudioData(data.slice(0));
    showSource(file.name, originalBuffer);
    setStatus('Ready');
  } catch (e) { console.error(e); toast('This audio format could not be decoded'); setStatus('Ready'); }
}

function showSource(name, buffer) {
  els.drop.classList.add('hidden'); els.strip.classList.remove('hidden'); els.fileName.textContent = name;
  els.fileDetails.textContent = `${formatTime(buffer.duration)} · ${buffer.sampleRate / 1000} kHz · ${buffer.numberOfChannels === 1 ? 'Mono' : 'Stereo'}`;
  els.process.disabled = false; els.reset.disabled = false;
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  originalUrl = ''; drawWaveform(originalBuffer);
  processedBuffer = null; els.result.classList.add('hidden');
}

els.remove.onclick = els.reset.onclick = resetAll;
function resetAll() {
  stopAudio(); originalBuffer = null; processedBuffer = null; els.file.value = ''; els.strip.classList.add('hidden'); els.drop.classList.remove('hidden');
  els.process.disabled = true; els.reset.disabled = true; els.result.classList.add('hidden');
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  if (processedUrl) URL.revokeObjectURL(processedUrl);
  originalUrl = ''; processedUrl = ''; setStatus('Ready');
}

els.record.onclick = async () => {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('Microphone recording is unavailable in this browser');
  if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); return; }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    chunks = []; mediaRecorder = new MediaRecorder(recordingStream);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = async () => { recordingStream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: mediaRecorder.mimeType }); loadBlob(blob, 'Microphone recording.webm'); els.record.classList.remove('recording'); els.record.lastElementChild.textContent = 'Record with microphone'; };
    mediaRecorder.start(); els.record.classList.add('recording'); els.record.lastElementChild.textContent = 'Stop recording'; setStatus('Recording');
  } catch (e) { toast('Microphone access is unavailable'); console.error(e); }
};
async function loadBlob(blob, name) { const file = new File([blob], name, { type: blob.type }); await loadFile(file); }

els.process.onclick = processAudio;
async function processAudio() {
  if (!originalBuffer) return;
  els.process.disabled = true; els.process.innerHTML = '<span>◌</span> Surgical spectral cleanup…'; setStatus('Spectral cleanup', true);
  const started = performance.now();
  try {
    await new Promise(r => setTimeout(r, 30));
    processedBuffer = await cleanAudio(originalBuffer);
    els.result.classList.remove('hidden'); els.processingTime.textContent = `Finished in ${((performance.now()-started)/1000).toFixed(1)}s`;
    createPlayback(processedBuffer); drawWaveform(processedBuffer); els.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast('Voice cleaned successfully'); setStatus('Complete');
  } catch (e) { console.error(e); toast('Processing failed. Try a shorter recording.'); setStatus('Ready'); }
  els.process.disabled = false; els.process.innerHTML = '<span>✦</span> Clean my voice';
}

async function cleanAudio(source) {
  const rate = source.sampleRate;
  const channels = source.numberOfChannels;
  const spectrallyCleaned = spectralDenoise(source, +$('#noise').value / 100);
  const cleaned = adaptiveDenoise(spectrallyCleaned, +$('#noise').value / 100);
  const gated = gateBuffer(cleaned, +$('#noise').value / 100);
  const offline = new OfflineAudioContext(channels, gated.length, rate);
  const input = offline.createBuffer(channels, gated.length, rate);
  for (let c = 0; c < channels; c++) input.copyToChannel(gated.getChannelData(c), c);
  const sourceNode = offline.createBufferSource(); sourceNode.buffer = input;
  const highpass = offline.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 70 + (+$('#noise').value * 0.12);
  const lowpass = offline.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 15500;
  const clarity = +$('#clarity').value / 100;
  const presence = offline.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = clarity > .5 ? 3200 : 2400; presence.Q.value = .9; presence.gain.value = clarity * 6;
  const warmth = offline.createBiquadFilter(); warmth.type = 'lowshelf'; warmth.frequency.value = 220; warmth.gain.value = (+$('#bass').value) - (clarity * 1.5);
  const selectedTone = document.querySelector('.tone-preset.active')?.dataset.tone || 'balanced';
  const air = offline.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 5200;
  air.gain.value = selectedTone === 'cold' ? 3.5 : selectedTone === 'warm' ? -2.5 : 0.5;
  const deesser = offline.createBiquadFilter(); deesser.type = 'peaking'; deesser.frequency.value = 6500; deesser.Q.value = 2; deesser.gain.value = -clarity * 2.2;
  const compressor = offline.createDynamicsCompressor(); compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 3; compressor.attack.value = .012; compressor.release.value = .22;
  const limiter = offline.createDynamicsCompressor(); limiter.threshold.value = -1; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = .003; limiter.release.value = .08;
  sourceNode.connect(highpass); highpass.connect(lowpass); lowpass.connect(warmth); warmth.connect(presence); presence.connect(air); air.connect(deesser); deesser.connect(compressor); compressor.connect(limiter); limiter.connect(offline.destination);
  sourceNode.start(); let rendered = await offline.startRendering();
  const userGain = Math.pow(10, +$('#gain').value / 20);
  const outputLevel = +$('#volume').value / 100;
  let peak = 0;
  for (let c = 0; c < channels; c++) for (let i = 0; i < rendered.length; i++) peak = Math.max(peak, Math.abs(rendered.getChannelData(c)[i]));
  peak = peak || 1;
  const scale = Math.min(userGain * outputLevel, .96 / peak);
  for (let c = 0; c < channels; c++) { const data = rendered.getChannelData(c); for (let i = 0; i < data.length; i++) { let v = data[i] * scale; data[i] = Math.tanh(v * 1.5) * .96; } }
  return resampleVoice(rendered, +$('#pitch').value, +$('#speed').value / 100);
}

function resampleVoice(source, semitones, speed) {
  if (semitones === 0 && speed === 1) return source;
  const pitchRatio = Math.pow(2, semitones / 12);
  const ratio = pitchRatio * speed;
  const outputLength = Math.max(1, Math.floor(source.length / ratio));
  const output = decodeContext.createBuffer(source.numberOfChannels, outputLength, source.sampleRate);
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const result = output.getChannelData(channel);
    for (let i = 0; i < outputLength; i++) {
      const readPosition = i * ratio;
      const start = Math.floor(readPosition);
      if (start >= input.length) break;
      const fraction = readPosition - start;
      const next = Math.min(start + 1, input.length - 1);
      result[i] = input[start] + (input[next] - input[start]) * fraction;
    }
  }
  return output;
}

function spectralDenoise(source, amount) {
  if (amount <= 0.01 || source.length < 256) return source;
  const output = decodeContext.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  const preferredFrameSize = source.length > 8192 ? 1024 : 512;
  const frameSize = Math.min(preferredFrameSize, source.length < 512 ? 256 : preferredFrameSize);
  const hop = frameSize / 4;
  const noiseFrames = Math.max(2, Math.min(12, Math.ceil(source.sampleRate * 0.4 / hop)));

  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const result = output.getChannelData(channel);
    const weight = new Float32Array(source.length);
    const real = new Float32Array(frameSize);
    const imag = new Float32Array(frameSize);
    const noiseProfile = new Float32Array(frameSize / 2 + 1);
    const frameCount = Math.max(1, Math.floor((source.length - frameSize) / hop) + 1);
    const frameEnergy = [];
    for (let frame = 0; frame < frameCount; frame++) {
      const start = frame * hop;
      let energy = 0;
      for (let n = 0; n < frameSize; n += 2) { const value = input[start + n] || 0; energy += value * value; }
      frameEnergy.push({ frame, energy });
    }
    frameEnergy.sort((a, b) => a.energy - b.energy);
    const profileFrames = frameEnergy.slice(0, Math.min(noiseFrames, frameEnergy.length)).map(item => item.frame);
    const profileCount = profileFrames.length;

    for (const frame of profileFrames) {
      const start = frame * hop;
      for (let n = 0; n < frameSize; n++) real[n] = (input[start + n] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * n / (frameSize - 1)));
      imag.fill(0); fft(real, imag, false);
      for (let k = 0; k < noiseProfile.length; k++) {
        const magnitude = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
        noiseProfile[k] += magnitude * magnitude;
      }
    }
    for (let k = 0; k < noiseProfile.length; k++) noiseProfile[k] = Math.sqrt(noiseProfile[k] / profileCount);

    for (let start = 0; start + frameSize <= source.length; start += hop) {
      for (let n = 0; n < frameSize; n++) real[n] = input[start + n] * (0.5 - 0.5 * Math.cos(2 * Math.PI * n / (frameSize - 1)));
      imag.fill(0); fft(real, imag, false);
      for (let k = 0; k <= frameSize / 2; k++) {
        const magnitude = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
        const phase = Math.atan2(imag[k], real[k]);
        const overSubtract = 1 + amount * 1.7;
        const floor = 1 + amount * 4;
        const residual = Math.max(magnitude * 0.015, magnitude - noiseProfile[k] * overSubtract);
        const mask = magnitude > noiseProfile[k] * floor ? Math.pow(residual / Math.max(magnitude, 0.000001), 1.15) : residual / Math.max(magnitude, 0.000001);
        const level = magnitude * Math.max(0, Math.min(1, mask));
        real[k] = level * Math.cos(phase); imag[k] = level * Math.sin(phase);
        if (k > 0 && k < frameSize / 2) { real[frameSize-k] = real[k]; imag[frameSize-k] = -imag[k]; }
      }
      fft(real, imag, true);
      for (let n = 0; n < frameSize; n++) {
        const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / (frameSize - 1));
        result[start+n] += real[n] * window / 1.6;
        weight[start+n] += window * window / 1.6;
      }
    }
    for (let i = 0; i < source.length; i++) result[i] = weight[i] > 0.08 ? result[i] / weight[i] : input[i] * 0.05;
  }
  return output;
}

function fft(real, imag, inverse) {
  const size = real.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const t = real[i]; real[i] = real[j]; real[j] = t; const q = imag[i]; imag[i] = imag[j]; imag[j] = q; }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / length;
    const wLengthCos = Math.cos(angle), wLengthSin = Math.sin(angle);
    for (let i = 0; i < size; i += length) {
      let wCos = 1, wSin = 0;
      for (let j = 0; j < length / 2; j++) {
        const a = i + j, b = a + length / 2;
        const tReal = real[b] * wCos - imag[b] * wSin;
        const tImag = real[b] * wSin + imag[b] * wCos;
        real[b] = real[a] - tReal; imag[b] = imag[a] - tImag;
        real[a] += tReal; imag[a] += tImag;
        const nextCos = wCos * wLengthCos - wSin * wLengthSin;
        wSin = wCos * wLengthSin + wSin * wLengthCos; wCos = nextCos;
      }
    }
  }
  if (inverse) for (let i = 0; i < size; i++) { real[i] /= size; imag[i] /= size; }
}

function adaptiveDenoise(source, amount) {
  const output = decodeContext.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  const sampleWindow = Math.max(1, Math.round(source.sampleRate * 0.004));
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const result = output.getChannelData(channel);
    const noiseSeconds = Math.min(0.35, source.duration / 4);
    const noiseSamples = Math.round(source.sampleRate * noiseSeconds);
    let noiseFloor = 0;
    let measured = 0;
    for (let i = 0; i < noiseSamples; i++) { noiseFloor += input[i] * input[i]; measured++; }
    noiseFloor = Math.sqrt(noiseFloor / Math.max(1, measured));
    let previous = 0;
    for (let i = 0; i < source.length; i++) {
      const begin = Math.max(0, i - sampleWindow);
      const end = Math.min(source.length, i + sampleWindow);
      let energy = 0;
      let count = 0;
      for (let j = begin; j < end; j += 2) { energy += input[j] * input[j]; count++; }
      const rms = Math.sqrt(energy / Math.max(1, count));
      const floorThreshold = noiseFloor * (1.8 + amount * 2.6);
      let attenuation = rms > floorThreshold ? 1 - (amount * 0.10) : 0.05 + (1 - amount) * 0.55;
      const transient = Math.abs(input[i] - previous);
      if (transient > Math.max(0.35, rms * 4)) attenuation *= 0.35;
      const value = input[i] * attenuation;
      result[i] = value;
      previous = input[i];
      if (i < noiseSamples) noiseFloor = noiseFloor * 0.9995 + rms * 0.0005;
    }
  }
  return output;
}

function gateBuffer(source, amount) {
  const channels = source.numberOfChannels, length = source.length, rate = source.sampleRate;
  const mono = new Float32Array(length); for (let i = 0; i < length; i++) for (let c = 0; c < channels; c++) mono[i] += source.getChannelData(c)[i] / channels;
  const frame = Math.max(256, Math.round(rate * .01)); const levels = [];
  for (let i = 0; i < length; i += frame) { let sum = 0, n = Math.min(frame, length-i); for (let j=0;j<n;j++) sum += mono[i+j]*mono[i+j]; levels.push(Math.sqrt(sum/n)); }
  levels.sort((a,b) => a-b); const noiseFloor = levels[Math.floor(levels.length * .18)] || 0;
  const threshold = Math.max(noiseFloor * (1.6 + amount * .9), .0025) * (1 - amount * .45);
  const gate = new Float32Array(length); let env = 0;
  const attack = Math.max(1, Math.floor(rate * .008)), release = Math.max(1, Math.floor(rate * .09));
  for (let i=0;i<length;i+=frame) {
    let sum=0,n=Math.min(frame,length-i); for(let j=0;j<n;j++) sum+=mono[i+j]*mono[i+j]; const level=Math.sqrt(sum/n);
    const target=level > threshold ? 1 : 0;
    const coef=target > env ? 1/attack : 1/release;
    for(let j=0;j<n;j++){ env += (target-env)*coef; gate[i+j]=env*(0.78+amount*0.22); }
  }
  const out = decodeContext.createBuffer(channels, length, rate);
  for(let c=0;c<channels;c++){ const input=source.getChannelData(c), data=out.getChannelData(c); for(let i=0;i<length;i++) data[i]=input[i]*gate[i]; }
  return out;
}

function createPlayback(buffer) {
  stopAudio(); if (processedUrl) URL.revokeObjectURL(processedUrl);
  processedUrl = URL.createObjectURL(encodeWav(buffer)); audio = new Audio(processedUrl);
  audio.onended = () => els.play.textContent = '▶'; audio.ontimeupdate = () => { els.current.textContent = formatTime(audio.currentTime); els.seek.value = audio.duration ? audio.currentTime/audio.duration*1000 : 0; };
  audio.onloadedmetadata = () => els.duration.textContent = formatTime(audio.duration);
}
els.play.onclick = () => { if (!audio.src) return; if (audio.paused) { audio.play(); els.play.textContent = 'Ⅱ'; } else { audio.pause(); els.play.textContent = '▶'; } };
els.seek.oninput = () => { if(audio.duration) audio.currentTime = audio.duration * els.seek.value / 1000; };
els.compare.onclick = () => {
  if (!originalBuffer) return;
  stopAudio(); if (originalUrl) URL.revokeObjectURL(originalUrl);
  originalUrl = URL.createObjectURL(encodeWav(originalBuffer)); audio = new Audio(originalUrl);
  els.compare.textContent='Hear before'; audio.play(); els.compare.textContent='Playing original'; audio.onended=()=>els.compare.textContent='Hear before';
};
function stopAudio(){ if(audio){audio.pause();els.play.textContent='▶';} }
els.download.onclick = () => { if(!processedBuffer) return; const url=URL.createObjectURL(encodeWav(processedBuffer)); const a=document.createElement('a'); a.href=url; a.download=`${els.fileName.textContent.replace(/\.[^.]+$/, '') || 'voice'}-clean.wav`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };

function encodeWav(buffer) {
  const channels=buffer.numberOfChannels, rate=buffer.sampleRate, bytes=buffer.length*channels*2; const ab=new ArrayBuffer(44+bytes), view=new DataView(ab);
  const str=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i))};
  str(0,'RIFF'); view.setUint32(4,36+bytes,true); str(8,'WAVE'); str(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,channels,true); view.setUint32(24,rate,true); view.setUint32(28,rate*channels*2,true); view.setUint16(32,channels*2,true); view.setUint16(34,16,true); str(36,'data'); view.setUint32(40,bytes,true);
  let offset=44; for(let i=0;i<buffer.length;i++) for(let c=0;c<channels;c++){let s=Math.max(-1,Math.min(1,buffer.getChannelData(c)[i])); view.setInt16(offset,s<0?s*0x8000:s*0x7fff,true);offset+=2;}
  return new Blob([view],{type:'audio/wav'});
}

function drawWaveform(buffer) {
  const canvas=els.canvas, ctx=canvas.getContext('2d'), dpr=devicePixelRatio||1; canvas.width=canvas.clientWidth*dpr; canvas.height=canvas.clientHeight*dpr; ctx.scale(dpr,dpr);
  const w=canvas.clientWidth,h=canvas.clientHeight,data=buffer.getChannelData(0), bars=Math.floor(w/5); ctx.clearRect(0,0,w,h);
  for(let i=0;i<bars;i++){const start=Math.floor(i*data.length/bars),end=Math.floor((i+1)*data.length/bars);let peak=0;for(let j=start;j<end;j+=4)peak=Math.max(peak,Math.abs(data[j]));const bh=Math.max(2,peak*h*.78);const x=i*5;ctx.fillStyle= i%3===0?'#55d7c7':'#747fca';ctx.globalAlpha=.7;ctx.fillRect(x,(h-bh)/2,2,bh);} ctx.globalAlpha=1;
}
window.addEventListener('resize',()=>processedBuffer&&drawWaveform(processedBuffer));
document.querySelectorAll('.studio-tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.studio-tab').forEach(item => item.classList.remove('active'));
  tab.classList.add('active');
  document.querySelectorAll('.tool-view').forEach(view => view.classList.remove('active'));
  document.querySelector(`#${tab.dataset.view}View`)?.classList.add('active');
  if (tab.dataset.view === 'tts') loadSystemVoices();
}));

function voiceLanguageMatches(voice, requestedLanguage) {
  const base = requestedLanguage.toLowerCase().split('-')[0];
  return (voice.lang || '').toLowerCase().startsWith(base);
}

function loadSystemVoices() {
  const select = $('#ttsVoice');
  if (!select || !('speechSynthesis' in window)) return;
  const requestedLanguage = $('#ttsLanguage')?.value || 'en-US';
  const voices = speechSynthesis.getVoices();
  const compatible = voices.filter(voice => voiceLanguageMatches(voice, requestedLanguage));
  select.innerHTML = '';

  const available = compatible.length ? compatible : voices;
  available.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voices.indexOf(voice).toString();
    option.textContent = `${voice.name} (${voice.lang})${compatible.length ? '' : ' — language fallback'}`;
    select.appendChild(option);
  });

  if (!voices.length) {
    const option = document.createElement('option'); option.textContent = 'Browser default voice'; option.value = '-1'; select.appendChild(option);
  }
  const selectedVoice = voices[+select.value];
  $('#ttsVoiceName').value = selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : 'Browser default voice';
  if (!compatible.length && voices.length) {
    $('#ttsVoiceName').value += ' — fallback';
    $('#ttsNote').textContent = `No ${requestedLanguage} voice is installed. The browser will use a fallback voice and Urdu/non-English pronunciation may be inaccurate.`;
  } else if (compatible.length) {
    $('#ttsNote').textContent = `${compatible.length} voice${compatible.length === 1 ? '' : 's'} available for ${requestedLanguage}.`;
  } else {
    $('#ttsNote').textContent = 'No system voices were reported yet. Reload after installing browser or operating-system voices.';
  }
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = loadSystemVoices;

$('#ttsRate').addEventListener('input', e => $('#ttsRateOut').value = `${(+e.target.value / 100).toFixed(2)}×`);
$('#ttsPitch').addEventListener('input', e => $('#ttsPitchOut').value = `${(+e.target.value / 100).toFixed(2)}`);
$('#ttsVolume').addEventListener('input', e => $('#ttsVolumeOut').value = `${e.target.value}%`);
$('#ttsLanguage').addEventListener('change', loadSystemVoices);
$('#ttsVoice').addEventListener('change', e => $('#ttsVoiceName').value = e.target.selectedOptions[0]?.textContent || 'System voice');
$('#ttsSpeak').addEventListener('click', () => {
  const text = $('#ttsText').value.trim();
  if (!text) return toast('Enter text to speak');
  if (!('speechSynthesis' in window)) return toast('Text-to-speech is unavailable in this browser');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const index = +$('#ttsVoice').value;
  const language = $('#ttsLanguage').value;
  if (voices[index]) utterance.voice = voices[index];
  utterance.lang = language;
  utterance.rate = +$('#ttsRate').value / 100;
  utterance.pitch = +$('#ttsPitch').value / 100;
  utterance.volume = +$('#ttsVolume').value / 100;
  utterance.onerror = event => {
    const reason = event.error === 'voice-unavailable' ? 'No installed voice supports this language. Install a matching Windows voice, then reload.' : `Browser speech error: ${event.error}`;
    toast(reason); $('#ttsVoiceName').value = reason;
  };
  utterance.onend = () => $('#ttsVoiceName').value = $('#ttsVoice').selectedOptions[0]?.textContent || 'Browser default voice';
  speechSynthesis.speak(utterance);
});
$('#ttsStop').addEventListener('click', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); });

let recognition = null, listening = false;
let recognizedTranscript = '';
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
$('#sttStart').addEventListener('click', () => {
  if (listening) { recognition?.stop(); return; }
  if (!Recognition) { $('#sttNote').textContent = 'Speech recognition is not supported by this browser. Try the latest Chrome or Edge on HTTPS.'; return toast('Speech recognition is unavailable'); }
  recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = $('#sttLanguage').value;
  recognizedTranscript = $('#sttText').value ? $('#sttText').value.trim() + ' ' : '';
  recognition.onstart = () => { listening = true; $('#sttStatus').textContent = 'LISTENING'; $('#sttStart').textContent = 'Stop listening'; $('#sttNote').textContent = 'Listening… Speak clearly in the selected language.'; };
  recognition.onresult = event => {
    let sessionFinal = '', interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) sessionFinal += transcript + ' '; else interimText += transcript;
    }
    if (sessionFinal) recognizedTranscript += sessionFinal;
    $('#sttText').value = (recognizedTranscript + interimText).trimStart();
  };
  recognition.onerror = event => {
    const messages = {
      'not-allowed': 'Microphone permission was denied. Allow microphone access, then try again.',
      'audio-capture': 'No microphone was found or it is busy in another app.',
      'network': 'Speech recognition needs a working network connection in this browser.',
      'language-not-supported': 'This browser does not support the selected language. Try an English language or install browser language support.'
    };
    $('#sttNote').textContent = messages[event.error] || `Recognition error: ${event.error}`;
    $('#sttStatus').textContent = 'ERROR';
  };
  recognition.onend = () => { listening = false; $('#sttStatus').textContent = 'MIC OFF'; $('#sttStart').textContent = 'Start listening'; };
  try { recognition.start(); }
  catch (error) {
    listening = false;
    $('#sttStatus').textContent = 'ERROR';
    $('#sttStart').textContent = 'Start listening';
    $('#sttNote').textContent = `Could not start recognition: ${error.message || error}`;
  }
});
$('#sttCopy').addEventListener('click', async () => {
  if (!$('#sttText').value) return toast('Transcript is empty');
  try {
    await navigator.clipboard.writeText($('#sttText').value); toast('Transcript copied');
  } catch (_) {
    $('#sttText').focus(); $('#sttText').select();
    toast('Clipboard blocked — transcript selected for manual copy');
  }
});

let suggestedReferencePreset = 'balanced';
$('#analyzeReference').addEventListener('click', async () => {
  const file = $('#referenceFile').files[0];
  if (!file) return toast('Choose a voice sample first');
  try {
    const buffer = await decodeContext.decodeAudioData(await file.arrayBuffer());
    const analysis = analyzeVoiceCharacteristics(buffer);
    $('#pitchEstimate').textContent = analysis.pitch ? `${Math.round(analysis.pitch)} Hz` : 'Not detected';
    $('#characterEstimate').textContent = analysis.character;
    $('#brightnessEstimate').textContent = analysis.brightness;
    $('#loudnessEstimate').textContent = `${analysis.loudness.toFixed(1)} dBFS`;
    $('#referenceResults').classList.remove('hidden'); $('#applyReference').classList.remove('hidden');
    suggestedReferencePreset = analysis.suggestion;
    toast('Voice characteristics analyzed');
  } catch (error) { console.error(error); toast('Could not analyze this audio file'); }
});
$('#applyReference').addEventListener('click', () => {
  document.querySelectorAll('.tone-preset').forEach(item => item.classList.toggle('active', item.dataset.tone === suggestedReferencePreset));
  const presets = { balanced: [0,50], warm:[3,38], cold:[-2,72] };
  const [bass, clarity] = presets[suggestedReferencePreset]; $('#bass').value=bass; $('#clarity').value=clarity;
  $('#bassOut').value=`${bass >= 0 ? '+' : ''}${bass} dB`; $('#clarityOut').value=`${clarity}%`;
  document.querySelector('[data-view="enhancer"]').click(); toast('Suggested tone applied');
});

function analyzeVoiceCharacteristics(buffer) {
  const sampleRate = buffer.sampleRate, data = buffer.getChannelData(0);
  let sumSquares = 0, crossings = 0, highEnergy = 0, totalEnergy = 0;
  const step = Math.max(1, Math.floor(sampleRate / 8000));
  let previous = data[0] || 0;
  for (let i = 0; i < data.length; i += step) {
    const value = data[i] || 0; sumSquares += value * value; totalEnergy++;
    if ((previous <= 0 && value > 0) || (previous > 0 && value <= 0)) crossings++;
    if (Math.abs(value - previous) > 0.02) highEnergy++;
    previous = value;
  }
  const rms = Math.sqrt(sumSquares / Math.max(1,totalEnergy));
  const estimatedFrequency = crossings * sampleRate / step / (2 * Math.max(1,data.length / step));
  const pitch = estimatedFrequency > 70 && estimatedFrequency < 500 ? estimatedFrequency : null;
  const brightnessRatio = highEnergy / Math.max(1,totalEnergy);
  const brightness = brightnessRatio > 0.32 ? 'Bright' : brightnessRatio > 0.16 ? 'Neutral' : 'Dark';
  const character = brightness === 'Dark' ? 'Warm / low range' : brightness === 'Bright' ? 'Bright / clear' : 'Balanced';
  return { pitch, brightness, character, loudness: 20*Math.log10(Math.max(rms, 0.000001)), suggestion: brightness === 'Dark' ? 'warm' : brightness === 'Bright' ? 'cold' : 'balanced' };
}

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
