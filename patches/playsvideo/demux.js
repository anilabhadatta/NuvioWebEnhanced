import { ALL_FORMATS, BlobSource, EncodedPacketSink, FilePathSource, Input, Source as MBSource, UrlSource, } from 'mediabunny';
import { getSubtitleTrackInfos } from './subtitle.js';
export async function demuxFile(filePath, options) {
    return demuxInput(new Input({ formats: ALL_FORMATS, source: new FilePathSource(filePath) }), options);
}
export async function demuxBlob(blob, options) {
    return demuxInput(new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) }), options);
}
export async function demuxUrl(url, options) {
    return demuxInput(new Input({ formats: ALL_FORMATS, source: new UrlSource(url) }), options);
}
class SourceAdapter extends MBSource {
    _inner;
    constructor(_inner) {
        super();
        this._inner = _inner;
    }
    _retrieveSize() {
        return this._inner._retrieveSize();
    }
    _read(start, end) {
        return this._inner._read(start, end);
    }
    _dispose() {
        this._inner._dispose();
    }
}
export async function demuxSource(source, options) {
    return demuxInput(new Input({ formats: ALL_FORMATS, source: new SourceAdapter(source) }), options);
}
async function demuxInput(input, options) {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
        throw new Error('No video track found');
    }
    let audioTrack = null;
    let audioTracks = [];
    let audioTracksInfo = [];
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
        audioTracks = await input.getAudioTracks();
        audioTracksInfo = audioTracks.map((t, idx) => ({
            index: idx,
            codec: getCodecForTrack(t),
            language: t.languageCode || 'und',
            name: t.name || '',
        }));

        let targetIndex = options?.audioTrackIndex;
        if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < audioTracks.length) {
            audioTrack = audioTracks[targetIndex];
        } else {
            const supportedTrack = audioTracks.find(t => {
                const codec = getCodecForTrack(t);
                return codec && codec !== 'truehd';
            });
            audioTrack = supportedTrack || audioTracks[0] || null;
        }
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
        selectedAudioTrackIndex: audioTrack ? audioTracksInfo.findIndex(t => t.index === audioTracks.indexOf(audioTrack)) : -1,
        audioTracks: audioTracksInfo,
        videoCodec,
        audioCodec: finalAudioTrack ? resolvedAudioCodec : null,
        videoDecoderConfig,
        audioDecoderConfig,
        videoSink,
        audioSink,
        subtitleTracks,
        dispose: () => input.dispose(),
    };
}
export async function getKeyframeIndex(videoSink, duration) {
    const keyframes = [];
    // getKeyPacket(0) returns null if the first keyframe has PTS > 0 (non-zero
    // initial offset). Fall back to getFirstPacket() which always works.
    let packet = await videoSink.getKeyPacket(0, { metadataOnly: true });
    if (!packet) {
        const first = await videoSink.getFirstPacket();
        if (first?.type === 'key')
            packet = first;
    }
    while (packet) {
        const ts = packet.timestamp;
        if (Number.isFinite(ts) && ts >= 0) {
            keyframes.push({ timestamp: ts, sequenceNumber: packet.sequenceNumber });
        }
        const next = await videoSink.getNextKeyPacket(packet, {
            metadataOnly: true,
        });
        if (!next || next.sequenceNumber === packet.sequenceNumber)
            break;
        packet = next;
    }
    return { duration, keyframes };
}
export async function collectPacketsInRange(sink, startSec, endSec, opts) {
    const packets = [];
    let packet = null;
    if (opts?.startFromKeyframe) {
        packet = await sink.getKeyPacket(startSec);
    }
    else {
        packet = await sink.getPacket(startSec);
    }
    if (!packet) {
        packet = await sink.getFirstPacket();
    }
    if (!packet)
        return packets;
    // Collect packets until we reach endSec
    while (packet) {
        if (packet.timestamp >= endSec)
            break;
        if (!packet.isMetadataOnly && packet.timestamp >= 0) {
            packets.push(packet);
        }
        const next = await sink.getNextPacket(packet);
        if (!next || next.sequenceNumber === packet.sequenceNumber)
            break;
        packet = next;
    }
    return packets;
}
//# sourceMappingURL=demux.js.map