const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Patch Dynamic Import in wasm-ffmpeg.js
// ─────────────────────────────────────────────────────────────────────────────
const wasmFfmpegFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'adapters', 'wasm-ffmpeg.js');
if (fs.existsSync(wasmFfmpegFile)) {
  let content = fs.readFileSync(wasmFfmpegFile, 'utf8');
  let changed = false;

  // Patch webpackIgnore
  if (content.includes('/* webpackIgnore: true */ coreURL')) {
    console.log('playsvideo wasm-ffmpeg.js dynamic import is already patched.');
  } else {
    const regex = /\/\*\s*(?:@vite-ignore|webpackIgnore:\s*true,\s*turbopackIgnore:\s*true)\s*\*\/\s*coreURL/g;
    if (regex.test(content)) {
      content = content.replace(regex, '/* webpackIgnore: true */ coreURL');
      changed = true;
      console.log('Successfully patched playsvideo wasm-ffmpeg.js dynamic import.');
    } else {
      console.log('Target dynamic import pattern not found in wasm-ffmpeg.js.');
    }
  }

  // Patch AUDIO_TIER_CODECS to support truehd
  if (content.includes("'truehd'")) {
    console.log('playsvideo wasm-ffmpeg.js AUDIO_TIER_CODECS is already patched for truehd.');
  } else {
    const target = "const AUDIO_TIER_CODECS = new Set(['ac3', 'eac3', 'dts', 'mp3', 'flac', 'opus']);";
    const targetLf = "const AUDIO_TIER_CODECS = new Set([\n    'ac3',\n    'eac3',\n    'dts',\n    'mp3',\n    'flac',\n    'opus',\n]);";
    const targetCrLf = "const AUDIO_TIER_CODECS = new Set([\r\n    'ac3',\r\n    'eac3',\r\n    'dts',\r\n    'mp3',\r\n    'flac',\r\n    'opus',\r\n]);";
    const replacement = "const AUDIO_TIER_CODECS = new Set(['ac3', 'eac3', 'dts', 'truehd', 'mp3', 'flac', 'opus']);";

    if (content.includes(target)) {
      content = content.replace(target, replacement);
      changed = true;
      console.log('Successfully patched wasm-ffmpeg.js AUDIO_TIER_CODECS.');
    } else if (content.includes(targetLf)) {
      content = content.replace(targetLf, replacement);
      changed = true;
      console.log('Successfully patched wasm-ffmpeg.js AUDIO_TIER_CODECS (LF).');
    } else if (content.includes(targetCrLf)) {
      content = content.replace(targetCrLf, replacement);
      changed = true;
      console.log('Successfully patched wasm-ffmpeg.js AUDIO_TIER_CODECS (CRLF).');
    } else {
      console.warn('Could not find AUDIO_TIER_CODECS target in wasm-ffmpeg.js.');
    }
  }

  if (changed) {
    fs.writeFileSync(wasmFfmpegFile, content, 'utf8');
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. Patch INPUT_FORMAT in audio-transcode.js
// ─────────────────────────────────────────────────────────────────────────────
const transcodeFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'pipeline', 'audio-transcode.js');
if (fs.existsSync(transcodeFile)) {
  let content = fs.readFileSync(transcodeFile, 'utf8');
  if (content.includes("truehd: 'truehd'")) {
    console.log('playsvideo audio-transcode.js is already patched for truehd.');
  } else {
    const target = `const INPUT_FORMAT = {\r\n    ac3: 'ac3',\r\n    eac3: 'eac3',\r\n    dts: 'dts',\r\n    mp3: 'mp3',\r\n    flac: 'flac',\r\n    opus: 'ogg',\r\n};`;
    const targetLf = `const INPUT_FORMAT = {\n    ac3: \'ac3\',\n    eac3: \'eac3\',\n    dts: \'dts\',\n    mp3: \'mp3\',\n    flac: \'flac\',\n    opus: \'ogg\',\n};`;
    const replacement = `const INPUT_FORMAT = {\n    ac3: 'ac3',\n    eac3: 'eac3',\n    dts: 'dts',\n    truehd: 'truehd',\n    mp3: 'mp3',\n    flac: 'flac',\n    opus: 'ogg',\n};`;

    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(transcodeFile, content, 'utf8');
      console.log('Successfully patched playsvideo audio-transcode.js (CRLF).');
    } else if (content.includes(targetLf)) {
      content = content.replace(targetLf, replacement);
      fs.writeFileSync(transcodeFile, content, 'utf8');
      console.log('Successfully patched playsvideo audio-transcode.js (LF).');
    } else {
      console.warn('Could not find INPUT_FORMAT target in audio-transcode.js.');
    }
  }
} else {
  console.warn('playsvideo audio-transcode.js not found at:', transcodeFile);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Patch AUDIO_CODEC_MAP in codec-probe.js
// ─────────────────────────────────────────────────────────────────────────────
const codecProbeFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'pipeline', 'codec-probe.js');
if (fs.existsSync(codecProbeFile)) {
  let content = fs.readFileSync(codecProbeFile, 'utf8');
  if (content.includes("truehd: 'mlpa'")) {
    console.log('playsvideo codec-probe.js is already patched for truehd.');
  } else {
    const target = `const AUDIO_CODEC_MAP = {\r\n    aac: 'mp4a.40.2',\r\n    mp3: 'mp4a.69',\r\n    ac3: 'ac-3',\r\n    eac3: 'ec-3',\r\n    dts: 'dtsc',\r\n    flac: 'flac',\r\n    opus: 'opus',\r\n};`;
    const targetLf = `const AUDIO_CODEC_MAP = {\n    aac: \'mp4a.40.2\',\n    mp3: \'mp4a.69\',\n    ac3: \'ac-3\',\n    eac3: \'ec-3\',\n    dts: \'dtsc\',\n    flac: \'flac\',\n    opus: \'opus\',\n};`;
    const replacement = `const AUDIO_CODEC_MAP = {\n    aac: 'mp4a.40.2',\n    mp3: 'mp4a.69',\n    ac3: 'ac-3',\n    eac3: 'ec-3',\n    dts: 'dtsc',\n    truehd: 'mlpa',\n    flac: 'flac',\n    opus: 'opus',\n};`;

    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(codecProbeFile, content, 'utf8');
      console.log('Successfully patched playsvideo codec-probe.js (CRLF).');
    } else if (content.includes(targetLf)) {
      content = content.replace(targetLf, replacement);
      fs.writeFileSync(codecProbeFile, content, 'utf8');
      console.log('Successfully patched playsvideo codec-probe.js (LF).');
    } else {
      console.warn('Could not find AUDIO_CODEC_MAP target in codec-probe.js.');
    }
  }
} else {
  console.warn('playsvideo codec-probe.js not found at:', codecProbeFile);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Copy Patched demux.js (codec resolution, unsupported audio discarding & scoping fixes)
// ─────────────────────────────────────────────────────────────────────────────
const demuxFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'pipeline', 'demux.js');
const sourceDemux = path.join(__dirname, 'patches', 'playsvideo', 'demux.js');
if (fs.existsSync(sourceDemux)) {
  fs.copyFileSync(sourceDemux, demuxFile);
  console.log('Successfully copied patched demux.js.');
} else {
  console.warn('Patched source demux.js not found at:', sourceDemux);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Copy Patched engine.js (audio track selection, selectAudioTrack & dynamic reload)
// ─────────────────────────────────────────────────────────────────────────────
const engineFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'engine.js');
const sourceEngine = path.join(__dirname, 'patches', 'playsvideo', 'engine.js');
if (fs.existsSync(sourceEngine)) {
  fs.copyFileSync(sourceEngine, engineFile);
  console.log('Successfully copied patched engine.js.');
} else {
  console.warn('Patched source engine.js not found at:', sourceEngine);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Copy Patched engine.d.ts (type definitions for audio track methods & properties)
// ─────────────────────────────────────────────────────────────────────────────
const engineDtsFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'engine.d.ts');
const sourceEngineDts = path.join(__dirname, 'patches', 'playsvideo', 'engine.d.ts');
if (fs.existsSync(sourceEngineDts)) {
  fs.copyFileSync(sourceEngineDts, engineDtsFile);
  console.log('Successfully copied patched engine.d.ts.');
} else {
  console.warn('Patched source engine.d.ts not found at:', sourceEngineDts);
}
