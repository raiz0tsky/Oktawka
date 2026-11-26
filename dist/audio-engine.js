/* Native-first audio. Optional streaming libFLAC/WASM decoding; bounded PCM queue. */
(()=>{'use strict';
const bands=[20,25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000];
let library;
function loadDecoder(){return library||(library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/flac-decoder.min.js';script.charset='UTF-8';script.onload=()=>resolve(window['flac-decoder']);script.onerror=()=>{library=null;reject(Error('FLAC decoder could not load.'))};document.head.append(script)}))}
class Engine extends EventTarget{
 constructor(element){super();this.element=element;this.mode='native';this.preference='native';this.track=null;this.revision=0;this.nodes=new Set();this._volume=.8;this._muted=false;this.eqEnabled=false;this.eqGains=bands.map(()=>0);this.parametric=[{frequency:100,gain:0,Q:1},{frequency:1000,gain:0,Q:1},{frequency:8000,gain:0,Q:1}];this.preamp=-6;this._paused=true;this._duration=NaN;this.seekable=true;
 for(const type of ['play','pause','timeupdate','loadedmetadata','ended','error','durationchange','volumechange'])element.addEventListener(type,e=>{if(this.mode==='native')this.emit(type)});
 }
 emit(type){this['on'+type]?.(new Event(type));this.dispatchEvent(new Event(type))}
 get src(){return this.element.src}set src(url){this.stopWasm();this.mode='native';this.seekable=true;if(this.mediaSource)this.element.crossOrigin='anonymous';this.element.src=url}
 get currentTime(){return this.mode==='native'?this.element.currentTime:Math.max(0,(this.context?.currentTime||0)-(this.startedAt||0))}set currentTime(v){if(this.mode==='native')this.element.currentTime=v}
 get duration(){return this.mode==='native'?this.element.duration:this._duration}
 get paused(){return this.mode==='native'?this.element.paused:this._paused}
 get volume(){return this._volume}set volume(v){this._volume=Math.max(0,Math.min(1,v));this.element.volume=this.mediaSource?1:this._volume;this.applyVolume()}
 get muted(){return this._muted}set muted(v){this._muted=!!v;this.element.muted=this.mediaSource?false:!!v;this.applyVolume()}
 get loop(){return this.element.loop}set loop(v){this.element.loop=!!v}
 get preload(){return this.element.preload}set preload(v){this.element.preload=v}
 applyVolume(){if(this.output)this.output.gain.value=this._muted?0:this._volume}
 async graph(){if(!this.context||this.context.state==='closed'){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio is unavailable.');this.context=new C();this.output=this.context.createGain();this.output.connect(this.context.destination);this.applyVolume();this.dry=this.context.createGain();this.dry.connect(this.output);this.wet=this.context.createGain();this.pre=this.context.createGain();this.pre.connect(this.wet);let tail=this.wet;this.filters=bands.map(f=>{const node=this.context.createBiquadFilter();node.type='peaking';node.frequency.value=Math.min(f,this.context.sampleRate*.47);node.Q.value=4.318;tail.connect(node);tail=node;return node});this.paramFilters=this.parametric.map(()=>{const node=this.context.createBiquadFilter();node.type='peaking';tail.connect(node);tail=node;return node});tail.connect(this.output);this.updateEQ()}
 if(this.context.state==='suspended')await this.context.resume();return this.context;
 }
 updateEQ(){if(!this.context)return;this.dry.gain.value=this.eqEnabled?0:1;this.pre.gain.value=this.eqEnabled?Math.pow(10,this.preamp/20):0;this.filters.forEach((n,i)=>n.gain.value=this.eqGains[i]);this.paramFilters.forEach((n,i)=>{const p=this.parametric[i];n.frequency.value=Math.min(p.frequency,this.context.sampleRate*.47);n.gain.value=p.gain;n.Q.value=p.Q});this.emit('qualitychange')}
 async enableEQ(value){if(value){await this.graph();if(this.mode==='native'&&!this.mediaSource){this.mediaSource=this.context.createMediaElementSource(this.element);this.mediaSource.connect(this.dry);this.mediaSource.connect(this.pre);this.element.volume=1;this.element.muted=false}}
 this.eqEnabled=value;this.updateEQ();if(!value&&this.mode==='native'&&this.context?.state==='suspended')await this.context.resume();
 }
 async play(){const flac=this.track?.sourceCodec==='FLAC'||/\.flac(?:$|\?)/i.test(this.src);if(this.mode==='wasm'){this._paused=false;this.resumeWaiter?.();this.resumeWaiter=null;await this.context.resume();clearInterval(this.progress);this.progress=setInterval(()=>{if(!document.hidden)this.emit('timeupdate')},500);this.emit('play');return}
 if(this.preference==='wasm'&&flac)return this.startWasm();
 if(this.mediaSource)await this.graph();return this.element.play();
 }
 pause(){if(this.mode==='native'){this.element.pause();return}this._paused=true;clearInterval(this.progress);this.context?.suspend();this.emit('pause')}
 startWasm(){return new Promise((resolve,reject)=>{let ready=false;this.pendingReady=()=>{ready=true;resolve()};this.pumpWasm(()=>{ready=true;this.pendingReady=null;resolve()}).catch(error=>{if(!ready)reject(error)})})}
 async pumpWasm(onReady){this.element.pause();this.mode='wasm';this.seekable=false;this._paused=false;const version=++this.revision;this.abort=new AbortController();this._duration=this.track?.live?Infinity:NaN;let first=true,decodedAny=false;this.decodedSamples=0;
 try{const context=await this.graph();const lib=await loadDecoder();if(version!==this.revision)return;const decoder=new lib.FLACDecoderWebWorker();this.decoder=decoder;await decoder.ready;if(version!==this.revision){await decoder.free();return}
 const url=this.src;const response=await fetch(url,{signal:this.abort.signal,credentials:new URL(url,location.href).origin===location.origin?'same-origin':'omit'});if(!response.ok||!response.body)throw Error('Cannot fetch FLAC audio for decoding. The source must allow browser access.');const reader=response.body.getReader();this.reader=reader;this.startedAt=context.currentTime+.10;this.scheduledUntil=this.startedAt;this.emit('loadedmetadata');this.emit('play');
 const queue=async result=>{if(version!==this.revision)return;if((result.errors||result.U)?.length)throw Error('FLAC integrity error: damaged audio was rejected.');if(!result.samplesDecoded)return;decodedAny=true;const {channelData,samplesDecoded,sampleRate,bitDepth}=result;if(sampleRate<8000||sampleRate>384000||channelData.length>8||samplesDecoded/sampleRate>30)throw Error('Unsupported FLAC frame size or format.');
 if(!Number.isInteger(bitDepth)||bitDepth>24)throw Error('The compatibility path supports FLAC through 24-bit. Use native playback for this source.');
 if(first){first=false;this.track.quality={codec:'FLAC',lossless:true,bitDepth,sampleRate,channels:channelData.length,verified:true};this.track.lossless=true;this.emit('qualitychange')}
 const order=channelData.length===6?[0,2,1,5,3,4]:channelData.length===8?[0,2,1,7,5,6,3,4]:channelData.length===3?[0,2,1]:channelData.length===5?[0,2,1,3,4]:channelData.map((_,i)=>i);
 const buffer=context.createBuffer(channelData.length,samplesDecoded,sampleRate);order.forEach((from,to)=>{const input=channelData[from],pcm=new Float32Array(input.length),scale=2**(bitDepth-1),divisor=scale-1;for(let j=0;j<input.length;j++)pcm[j]=Math.round(input[j]*divisor)/scale;buffer.copyToChannel(pcm,to)});const node=context.createBufferSource();node.buffer=buffer;node.connect(this.dry);node.connect(this.pre);node.onended=()=>{node.disconnect();this.nodes.delete(node)};this.nodes.add(node);const at=Math.max(context.currentTime+.03,this.scheduledUntil);node.start(at);this.scheduledUntil=at+buffer.duration;this.decodedSamples+=samplesDecoded;onReady();
 while(version===this.revision&&(this._paused||this.scheduledUntil-context.currentTime>4)){if(this._paused)await new Promise(resolve=>this.resumeWaiter=resolve);else await new Promise(resolve=>setTimeout(resolve,80))}
 };
 this.progress=setInterval(()=>{if(!document.hidden)this.emit('timeupdate')},500);
 let scanned=0;while(version===this.revision){const {done,value}=await reader.read();if(done)break;for(let offset=0;offset<value.length;offset+=4096){await queue(await decoder.decode(value.subarray(offset,offset+4096)));if(version!==this.revision)return}scanned+=value.length;if(!decodedAny&&scanned>2*1024*1024)throw Error('No FLAC frames found in this stream.')}
 await queue(await decoder.flush());if(!decodedAny)throw Error('No decodable FLAC audio.');if(version!==this.revision)return;this._duration=this.decodedSamples/this.track.quality.sampleRate;this.emit('durationchange');await decoder.free();if(this.decoder===decoder)this.decoder=null;while(version===this.revision&&context.currentTime<this.scheduledUntil){if(this._paused)await new Promise(resolve=>this.resumeWaiter=resolve);else await new Promise(resolve=>setTimeout(resolve,100))}if(version!==this.revision)return;clearInterval(this.progress);this._paused=true;this.emit('ended');if(this.loop){this.stopWasm();await this.startWasm()}
 }catch(e){if(version!==this.revision)return;this.pendingReady=null;this.stopWasm();this._paused=true;this.lastError=e.message;this.emit('error');this.emit('pause');throw e}
 }
 stopWasm(){this.resumeWaiter?.();this.resumeWaiter=null;if(this.mode==='wasm')this.context?.suspend();this.pendingReady?.();this.pendingReady=null;this.revision++;this.abort?.abort();this.reader?.cancel().catch(()=>{});this.reader=null;this.abort=null;clearInterval(this.progress);for(const n of this.nodes){try{n.stop();n.disconnect()}catch{}}this.nodes.clear();this.decoder?.free().catch(()=>{});this.decoder=null;this._paused=true;this.lastError=null}
 get signalPath(){return {decoder:this.mode==='wasm'?'libFLAC · WASM worker':'Browser native decoder',eq:this.eqEnabled,outputRate:this.context?.sampleRate||null,channels:this.track?.quality?.channels||null,seekable:this.seekable}}
}
window.OktawkaEngine={create:element=>new Engine(element),bands};
})();
