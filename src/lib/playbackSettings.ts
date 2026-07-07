import { supabase } from "./supabase";
import { getActiveProfileId } from "./profiles";

export interface PlaybackSettings {
  preferredAudioLanguage: string;
  secondaryAudioLanguage: string;
  preferredSubtitleLanguage: string;
  secondarySubtitleLanguage: string;
  useForcedSubtitles: boolean;
  showOnlyPreferredLanguages: boolean;
  addonSubtitleStartup: string;

  subtitleSize: number;
  verticalOffset: number;
  subtitleBold: boolean;
  subtitleTextColor: string;
  subtitleBackgroundColor: string;
  subtitleOutline: boolean;

  skipIntroEnabled: boolean;
  animeSkipEnabled: boolean;
}

export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  preferredAudioLanguage: "en",
  secondaryAudioLanguage: "none",
  preferredSubtitleLanguage: "en",
  secondarySubtitleLanguage: "none",
  useForcedSubtitles: false,
  showOnlyPreferredLanguages: false,
  addonSubtitleStartup: "Preferred only",

  subtitleSize: 12,
  verticalOffset: 20,
  subtitleBold: false,
  subtitleTextColor: "#FFFFFFFF",
  subtitleBackgroundColor: "#00000000",
  subtitleOutline: false,

  skipIntroEnabled: true,
  animeSkipEnabled: false,
};

export function getLocalPlaybackSettings(): PlaybackSettings {
  if (typeof window === "undefined") return DEFAULT_PLAYBACK_SETTINGS;
  const cached = localStorage.getItem(`nuvio_playback_settings_${getActiveProfileId()}`);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch { /* ok */ }
  }
  return DEFAULT_PLAYBACK_SETTINGS;
}

export async function pullPlaybackSettings(): Promise<PlaybackSettings> {
  if (typeof window === "undefined") return DEFAULT_PLAYBACK_SETTINGS;
  const profileId = getActiveProfileId();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return getLocalPlaybackSettings();

    const { data, error } = await supabase.rpc("sync_pull_profile_settings_blob", {
      p_platform: "mobile",
      p_profile_id: profileId,
    });

    if (error || !data) return getLocalPlaybackSettings();
    
    const blob = Array.isArray(data) ? data[0]?.settings_json : (data as any)?.settings_json;
    if (!blob || !blob.features || !blob.features.player_settings) return getLocalPlaybackSettings();

    const ps = blob.features.player_settings;
    const getValue = (key: string, fallback: any) => ps[key]?.value !== undefined ? ps[key].value : fallback;

    const finalSettings = {
      ...DEFAULT_PLAYBACK_SETTINGS,
      preferredAudioLanguage: getValue("preferred_audio_language", DEFAULT_PLAYBACK_SETTINGS.preferredAudioLanguage),
      secondaryAudioLanguage: getValue("secondary_preferred_audio_language", DEFAULT_PLAYBACK_SETTINGS.secondaryAudioLanguage),
      preferredSubtitleLanguage: getValue("preferred_subtitle_language", DEFAULT_PLAYBACK_SETTINGS.preferredSubtitleLanguage),
      secondarySubtitleLanguage: getValue("secondary_preferred_subtitle_language", DEFAULT_PLAYBACK_SETTINGS.secondarySubtitleLanguage),
      useForcedSubtitles: getValue("subtitle_use_forced_subtitles", DEFAULT_PLAYBACK_SETTINGS.useForcedSubtitles),
      showOnlyPreferredLanguages: getValue("subtitle_show_only_preferred_languages", DEFAULT_PLAYBACK_SETTINGS.showOnlyPreferredLanguages),
      addonSubtitleStartup: getValue("addon_subtitle_startup_mode", DEFAULT_PLAYBACK_SETTINGS.addonSubtitleStartup),

      subtitleSize: getValue("subtitle_font_size_sp", DEFAULT_PLAYBACK_SETTINGS.subtitleSize),
      verticalOffset: getValue("subtitle_bottom_offset", DEFAULT_PLAYBACK_SETTINGS.verticalOffset),
      subtitleBold: getValue("subtitle_bold", DEFAULT_PLAYBACK_SETTINGS.subtitleBold),
      subtitleTextColor: getValue("subtitle_text_color", DEFAULT_PLAYBACK_SETTINGS.subtitleTextColor),
      subtitleBackgroundColor: getValue("subtitle_background_color", DEFAULT_PLAYBACK_SETTINGS.subtitleBackgroundColor),
      subtitleOutline: getValue("subtitle_outline_enabled", DEFAULT_PLAYBACK_SETTINGS.subtitleOutline),

      skipIntroEnabled: getValue("skip_intro_enabled", DEFAULT_PLAYBACK_SETTINGS.skipIntroEnabled),
      animeSkipEnabled: getValue("anime_skip_enabled", DEFAULT_PLAYBACK_SETTINGS.animeSkipEnabled),
    };
    
    localStorage.setItem(`nuvio_playback_settings_${profileId}`, JSON.stringify(finalSettings));
    return finalSettings;
  } catch (e) {
    console.error("pullPlaybackSettings error", e);
    return getLocalPlaybackSettings();
  }
}

export async function pushPlaybackSettings(settings: PlaybackSettings): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const profileId = getActiveProfileId();
  try {
    localStorage.setItem(`nuvio_playback_settings_${profileId}`, JSON.stringify(settings));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    let clientId = localStorage.getItem("nuvio_sync_client_id");
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem("nuvio_sync_client_id", clientId);
    }

    // Fetch existing blob to not overwrite other mobile settings (theme, etc)
    const { data: pullData, error: pullError } = await supabase.rpc("sync_pull_profile_settings_blob", {
      p_platform: "mobile",
      p_profile_id: profileId,
    });
    
    let currentBlob: any = { version: 3, features: { player_settings: {} } };
    if (!pullError && pullData) {
      const b = Array.isArray(pullData) ? pullData[0]?.settings_json : (pullData as any)?.settings_json;
      if (b && typeof b === 'object') {
        currentBlob = b;
      }
    }
    
    if (!currentBlob.features) currentBlob.features = {};
    if (!currentBlob.features.player_settings) currentBlob.features.player_settings = {};
    
    const ps = currentBlob.features.player_settings;
    const encodeString = (val: string) => ({ type: "string", value: val });
    const encodeBoolean = (val: boolean) => ({ type: "boolean", value: val });
    const encodeInt = (val: number) => ({ type: "int", value: val });

    ps["preferred_audio_language"] = encodeString(settings.preferredAudioLanguage);
    ps["secondary_preferred_audio_language"] = encodeString(settings.secondaryAudioLanguage);
    ps["preferred_subtitle_language"] = encodeString(settings.preferredSubtitleLanguage);
    ps["secondary_preferred_subtitle_language"] = encodeString(settings.secondarySubtitleLanguage);
    ps["subtitle_use_forced_subtitles"] = encodeBoolean(settings.useForcedSubtitles);
    ps["subtitle_show_only_preferred_languages"] = encodeBoolean(settings.showOnlyPreferredLanguages);
    ps["addon_subtitle_startup_mode"] = encodeString(settings.addonSubtitleStartup);

    ps["subtitle_font_size_sp"] = encodeInt(settings.subtitleSize);
    ps["subtitle_bottom_offset"] = encodeInt(settings.verticalOffset);
    ps["subtitle_bold"] = encodeBoolean(settings.subtitleBold);
    ps["subtitle_text_color"] = encodeString(settings.subtitleTextColor);
    ps["subtitle_background_color"] = encodeString(settings.subtitleBackgroundColor);
    ps["subtitle_outline_enabled"] = encodeBoolean(settings.subtitleOutline);

    ps["skip_intro_enabled"] = encodeBoolean(settings.skipIntroEnabled);
    ps["anime_skip_enabled"] = encodeBoolean(settings.animeSkipEnabled);

    const { error } = await supabase.rpc("sync_push_profile_settings_blob", {
      p_platform: "mobile",
      p_profile_id: profileId,
      p_settings_json: currentBlob,
      p_origin_client_id: clientId,
    });

    if (error) {
      console.error("pushPlaybackSettings failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("pushPlaybackSettings error", e);
    return false;
  }
}
