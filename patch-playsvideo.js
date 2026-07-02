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
// 5. Patch demux.js for codec resolution & unknown audio discarding
// ─────────────────────────────────────────────────────────────────────────────
const demuxFile = path.join(__dirname, 'node_modules', 'playsvideo', 'dist', 'pipeline', 'demux.js');
if (fs.existsSync(demuxFile)) {
  let content = fs.readFileSync(demuxFile, 'utf8');
  if (content.includes('supportedTrack = audioTracks.find')) {
    console.log('playsvideo demux.js is already patched for codec resolution and supported track selection.');
  } else {
    const target = `    let audioTrack = null;\r\n    try {\r\n        audioTrack = await input.getPrimaryAudioTrack();\r\n    }\r\n    catch {\r\n        // No audio track — that's fine\r\n    }\r\n    const videoCodec = videoTrack.codec;\r\n    if (!videoCodec) {\r\n        throw new Error('Could not determine video codec');\r\n    }\r\n    const videoSink = new EncodedPacketSink(videoTrack);\r\n    const audioSink = audioTrack ? new EncodedPacketSink(audioTrack) : null;\r\n    const duration = Number(await videoTrack.computeDuration());\r\n    const videoDecoderConfig = await videoTrack.getDecoderConfig();\r\n    if (!videoDecoderConfig) {\r\n        throw new Error('Could not get video decoder config');\r\n    }\r\n    let audioDecoderConfig = null;\r\n    if (audioTrack) {\r\n        audioDecoderConfig = await audioTrack.getDecoderConfig();\r\n    }\r\n    const subtitleTracks = await getSubtitleTrackInfos(input);\r\n    return {\r\n        input,\r\n        duration,\r\n        videoTrack,\r\n        audioTrack,\r\n        videoCodec,\r\n        audioCodec: audioTrack?.codec ?? null,\r\n        videoDecoderConfig,\r\n        audioDecoderConfig,\r\n        videoSink,\r\n        audioSink,\r\n        subtitleTracks,\r\n        dispose: () => input.dispose(),\r\n    };`;

    const targetLf = `    let audioTrack = null;\n    try {\n        audioTrack = await input.getPrimaryAudioTrack();\n    }\n    catch {\n        // No audio track — that's fine\n    }\n    const videoCodec = videoTrack.codec;\n    if (!videoCodec) {\n        throw new Error('Could not determine video codec');\n    }\n    const videoSink = new EncodedPacketSink(videoTrack);\n    const audioSink = audioTrack ? new EncodedPacketSink(audioTrack) : null;\n    const duration = Number(await videoTrack.computeDuration());\n    const videoDecoderConfig = await videoTrack.getDecoderConfig();\n    if (!videoDecoderConfig) {\n        throw new Error('Could not get video decoder config');\n    }\n    let audioDecoderConfig = null;\n    if (audioTrack) {\n        audioDecoderConfig = await audioTrack.getDecoderConfig();\n    }\n    const subtitleTracks = await getSubtitleTrackInfos(input);\n    return {\n        input,\n        duration,\n        videoTrack,\n        audioTrack,\n        videoCodec,\n        audioCodec: audioTrack?.codec ?? null,\n        videoDecoderConfig,\n        audioDecoderConfig,\n        videoSink,\n        audioSink,\n        subtitleTracks,\n        dispose: () => input.dispose(),\n    };`;

    const replacement = `    let audioTrack = null;
    try {
        const getCodecForTrack = (track) => {
            let codec = track?.codec ?? null;
            if (track && !codec) {
                const internalId = track.internalCodecId;
                if (typeof internalId === 'string') {
                    const id = internalId.toUpperCase();
                    if (id.includes('AAC')) codec = 'aac';
                    else if (id.includes('AC3') || id.includes('AC-3')) codec = 'ac3';
                    else if (id.includes('EAC3') || id.includes('EC-3')) codec = 'eac3';
                    else if (id.includes('DTS')) codec = 'dts';
                    else if (id.includes('TRUEHD')) codec = 'truehd';
                    else if (id.includes('MP3') || id.includes('MPEG/L3')) codec = 'mp3';
                    else if (id.includes('OPUS')) codec = 'opus';
                    else if (id.includes('VORBIS')) codec = 'vorbis';
                    else if (id.includes('FLAC')) codec = 'flac';
                }
            }
            return codec;
        };
        const audioTracks = await input.getAudioTracks();
        const supportedTrack = audioTracks.find(t => {
            const codec = getCodecForTrack(t);
            return codec && codec !== 'truehd';
        });
        audioTrack = supportedTrack || audioTracks[0] || null;
    }
    catch {
        // No audio track — that's fine
    }
    const videoCodec = videoTrack.codec;
    if (!videoCodec) {
        throw new Error('Could not determine video codec');
    }
    let resolvedAudioCodec = audioTrack ? (audioTrack.codec ?? null) : null;
    if (audioTrack && !resolvedAudioCodec) {
        const internalId = audioTrack.internalCodecId;
        if (typeof internalId === 'string') {
            const id = internalId.toUpperCase();
            if (id.includes('AAC')) resolvedAudioCodec = 'aac';
            else if (id.includes('AC3') || id.includes('AC-3')) resolvedAudioCodec = 'ac3';
            else if (id.includes('EAC3') || id.includes('EC-3')) resolvedAudioCodec = 'eac3';
            else if (id.includes('DTS')) resolvedAudioCodec = 'dts';
            else if (id.includes('TRUEHD')) resolvedAudioCodec = 'truehd';
            else if (id.includes('MP3') || id.includes('MPEG/L3')) resolvedAudioCodec = 'mp3';
            else if (id.includes('OPUS')) resolvedAudioCodec = 'opus';
            else if (id.includes('VORBIS')) resolvedAudioCodec = 'vorbis';
            else if (id.includes('FLAC')) resolvedAudioCodec = 'flac';
        }
    }
    let finalAudioTrack = audioTrack;
    if (finalAudioTrack && (!resolvedAudioCodec || resolvedAudioCodec === 'truehd')) {
        console.warn('Audio track has an unknown or unsupported codec (truehd), discarding to prevent decoder crash');
        finalAudioTrack = null;
    }
    const videoSink = new EncodedPacketSink(videoTrack);
    const audioSink = finalAudioTrack ? new EncodedPacketSink(finalAudioTrack) : null;
    const duration = Number(await videoTrack.computeDuration());
    const videoDecoderConfig = await videoTrack.getDecoderConfig();
    if (!videoDecoderConfig) {
        throw new Error('Could not get video decoder config');
    }
    let audioDecoderConfig = null;
    if (finalAudioTrack) {
        audioDecoderConfig = await finalAudioTrack.getDecoderConfig();
    }
    const subtitleTracks = await getSubtitleTrackInfos(input);
    return {
        input,
        duration,
        videoTrack,
        audioTrack: finalAudioTrack,
        videoCodec,
        audioCodec: finalAudioTrack ? resolvedAudioCodec : null,
        videoDecoderConfig,
        audioDecoderConfig,
        videoSink,
        audioSink,
        subtitleTracks,
        dispose: () => input.dispose(),
    };`;

    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(demuxFile, content, 'utf8');
      console.log('Successfully patched playsvideo demux.js (CRLF).');
    } else if (content.includes(targetLf)) {
      content = content.replace(targetLf, replacement);
      fs.writeFileSync(demuxFile, content, 'utf8');
      console.log('Successfully patched playsvideo demux.js (LF).');
    } else {
      console.warn('Could not find demuxInput return block in demux.js.');
    }
  }
} else {
  console.warn('playsvideo demux.js not found at:', demuxFile);
}
