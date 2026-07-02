const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Patch Dynamic Import in wasm-ffmpeg.js
// ─────────────────────────────────────────────────────────────────────────────
const wasmFfmpegFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'adapters', 'wasm-ffmpeg.js');
if (fs.existsSync(wasmFfmpegFile)) {
  let content = fs.readFileSync(wasmFfmpegFile, 'utf8');
  if (content.includes('/* webpackIgnore: true */ coreURL')) {
    console.log('playsvideo wasm-ffmpeg.js dynamic import is already patched.');
  } else {
    const regex = /\/\*\s*(?:@vite-ignore|webpackIgnore:\s*true,\s*turbopackIgnore:\s*true)\s*\*\/\s*coreURL/g;
    if (regex.test(content)) {
      content = content.replace(regex, '/* webpackIgnore: true */ coreURL');
      fs.writeFileSync(wasmFfmpegFile, content, 'utf8');
      console.log('Successfully patched playsvideo wasm-ffmpeg.js dynamic import.');
    } else {
      console.log('Target dynamic import pattern not found in wasm-ffmpeg.js.');
    }
  }
} else {
  console.warn('playsvideo wasm-ffmpeg.js not found at:', wasmFfmpegFile);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Patch Audio Chunk Metadata Fallback in worker.js and pipeline.js
// ─────────────────────────────────────────────────────────────────────────────
const fallbackCodeWorker = `    audioDecoderConfig = doTranscode
        ? makeAacDecoderConfig(demux.audioDecoderConfig)
        : demux.audioDecoderConfig;
    if (!audioDecoderConfig && demux.audioTrack) {
        const mapCodec = (codec) => {
            if (!codec) return 'mp4a.40.2';
            const c = codec.toLowerCase();
            if (c.startsWith('ac3') || c.startsWith('ac-3')) return 'ac-3';
            if (c.startsWith('eac3') || c.startsWith('ec-3')) return 'ec-3';
            if (c.startsWith('mp3')) return 'mp3';
            if (c.startsWith('opus')) return 'opus';
            if (c.startsWith('flac')) return 'flac';
            if (c.startsWith('vorbis')) return 'vorbis';
            if (c.startsWith('aac') || c.startsWith('mp4a')) return 'mp4a.40.2';
            return c;
        };
        audioDecoderConfig = {
            codec: mapCodec(demux.audioTrack.codec || demux.audioCodec),
            sampleRate: demux.audioTrack.sampleRate || 48000,
            numberOfChannels: demux.audioTrack.numberOfChannels || 2,
        };
    }`;

const fallbackCodePipeline = `        let audioDecoderConfig = demux.audioDecoderConfig;
        if (!audioDecoderConfig && demux.audioTrack) {
            const mapCodec = (codec) => {
                if (!codec) return 'mp4a.40.2';
                const c = codec.toLowerCase();
                if (c.startsWith('ac3') || c.startsWith('ac-3')) return 'ac-3';
                if (c.startsWith('eac3') || c.startsWith('ec-3')) return 'ec-3';
                if (c.startsWith('mp3')) return 'mp3';
                if (c.startsWith('opus')) return 'opus';
                if (c.startsWith('flac')) return 'flac';
                if (c.startsWith('vorbis')) return 'vorbis';
                if (c.startsWith('aac') || c.startsWith('mp4a')) return 'mp4a.40.2';
                return c;
            };
            audioDecoderConfig = {
                codec: mapCodec(demux.audioTrack.codec || demux.audioCodec),
                sampleRate: demux.audioTrack.sampleRate || 48000,
                numberOfChannels: demux.audioTrack.numberOfChannels || 2,
            };
        }`;

// Patch worker.js
const workerFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'worker.js');
if (fs.existsSync(workerFile)) {
  let content = fs.readFileSync(workerFile, 'utf8');
  if (content.includes('mapCodec')) {
    console.log('playsvideo worker.js is already patched for audio metadata fallback.');
  } else {
    const target = `    audioDecoderConfig = doTranscode\r\n        ? makeAacDecoderConfig(demux.audioDecoderConfig)\r\n        : demux.audioDecoderConfig;`;
    const targetLf = `    audioDecoderConfig = doTranscode\n        ? makeAacDecoderConfig(demux.audioDecoderConfig)\n        : demux.audioDecoderConfig;`;
    
    if (content.includes(target)) {
      content = content.replace(target, fallbackCodeWorker);
      fs.writeFileSync(workerFile, content, 'utf8');
      console.log('Successfully patched playsvideo worker.js (CRLF).');
    } else if (content.includes(targetLf)) {
      content = content.replace(targetLf, fallbackCodeWorker);
      fs.writeFileSync(workerFile, content, 'utf8');
      console.log('Successfully patched playsvideo worker.js (LF).');
    } else {
      console.warn('Could not find target audioDecoderConfig assignment in worker.js.');
    }
  }
} else {
  console.warn('playsvideo worker.js not found at:', workerFile);
}

// Patch pipeline.js
const pipelineFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'pipeline', 'pipeline.js');
if (fs.existsSync(pipelineFile)) {
  let content = fs.readFileSync(pipelineFile, 'utf8');
  if (content.includes('mapCodec')) {
    console.log('playsvideo pipeline.js is already patched for audio metadata fallback.');
  } else {
    const target = `        let audioDecoderConfig = demux.audioDecoderConfig;`;
    if (content.includes(target)) {
      content = content.replace(target, fallbackCodePipeline);
      fs.writeFileSync(pipelineFile, content, 'utf8');
      console.log('Successfully patched playsvideo pipeline.js.');
    } else {
      console.warn('Could not find target audioDecoderConfig declaration in pipeline.js.');
    }
  }
} else {
  console.warn('playsvideo pipeline.js not found at:', pipelineFile);
}
