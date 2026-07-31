#!/usr/bin/env python3
"""Pre-render Bear Bakery character voice previews.

Google Gemini-TTS:
  export GOOGLE_CLOUD_TTS_API_KEY="..."
  python3 tools/generate_dialogue_tts.py --provider gemini

Google Cloud Text-to-Speech / Vertex:
  python3 tools/generate_dialogue_tts.py --provider google

Google Chirp 3 HD (service-account compatible):
  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
  python3 tools/generate_dialogue_tts.py --provider chirp

Free local macOS preview fallback:
  python3 tools/generate_dialogue_tts.py --provider macos

The API key is read only from the environment and is never written to disk.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
VOICE_DIR = ROOT / "assets" / "audio" / "voices"
PROFILES_PATH = VOICE_DIR / "voice_profiles.json"
MANIFEST_PATH = VOICE_DIR / "manifest.json"


EMOJI_PATTERN = re.compile(
    "[\U0001f000-\U0001faff\u2600-\u27bf\u2190-\u21ff\ufe0f\u200d]"
)


def assert_speakable(clip_id: str, text: str) -> None:
    """Fail loudly rather than shipping a clip that verbalizes an emoji."""
    found = EMOJI_PATTERN.findall(text)
    if found:
        raise SystemExit(
            f"Refusing to synthesize {clip_id}: text contains {''.join(found)!r}. "
            "Fill dialogue tokens with fillDialogueSpoken()."
        )


def load_profiles() -> dict:
    with PROFILES_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_dialogue_previews() -> dict:
    """Build the spoken text for every clip we need to render.

    Two rules keep audio honest:
      * greet/chat pick a line with no {order} token, so they can never name
        the wrong treat regardless of what the customer rolls.
      * order renders once per recipe the species can actually order, so the
        spoken treat always matches gameplay.

    fillDialogueSpoken also keeps emoji out: a voice reading "🍪 Cookie"
    says the treat name twice.
    """
    script = r"""
import { DIALOGUE, fillDialogueSpoken, orderLineFor } from './src/data/dialogue.js';
import { SPECIES } from './src/data/species.js';
import { RECIPES } from './src/data/recipes.js';

/** Prefer a line that never mentions the order, so it stays always-true. */
function orderAgnostic(lines, index) {
  const clean = lines.filter((line) => !line.includes('{order}'));
  const pool = clean.length ? clean : lines;
  return pool[index % pool.length];
}

const result = {};
for (const [id, species] of Object.entries(SPECIES)) {
  const bank = DIALOGUE[id];
  const name = species.label;
  const orderIds = (species.likesRecipes && species.likesRecipes.length)
    ? species.likesRecipes
    : [species.prefers];
  const seen = new Set();
  const orders = [];
  orderIds.forEach((recipeId) => {
    const recipe = RECIPES[recipeId];
    if (!recipe || seen.has(recipeId)) return;
    seen.add(recipeId);
    // The joke is written for this exact treat.
    orders.push({
      recipeId,
      text: fillDialogueSpoken(orderLineFor(id, recipe), { name, order: recipe }),
    });
  });
  result[id] = {
    greet: fillDialogueSpoken(orderAgnostic(bank.greet, 4), { name }),
    chat: fillDialogueSpoken(orderAgnostic(bank.chat, 7), { name }),
    orders,
  };
}
console.log(JSON.stringify(result));
"""
    output = subprocess.check_output(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        text=True,
    )
    return json.loads(output)


def load_google_api_key() -> Optional[str]:
    key = os.environ.get("GOOGLE_CLOUD_TTS_API_KEY") or os.environ.get(
        "GOOGLE_API_KEY"
    )
    if key:
        return key
    if shutil.which("security"):
        result = subprocess.run(
            [
                "security",
                "find-generic-password",
                "-a",
                os.environ.get("USER", ""),
                "-s",
                "BearBakeryGoogleTTS",
                "-w",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return result.stdout.strip() or None
    return None


def synthesize_google(profile: dict, defaults: dict, api_key: str) -> bytes:
    model = os.environ.get("GOOGLE_CLOUD_TTS_MODEL", defaults["model"])
    location = os.environ.get("GOOGLE_CLOUD_TTS_REGION", "global")
    host = (
        "texttospeech.googleapis.com"
        if location == "global"
        else f"{location}-texttospeech.googleapis.com"
    )
    endpoint = f"https://{host}/v1/text:synthesize"
    payload = {
        "input": {
            "text": profile["text"],
            "prompt": profile["prompt"],
        },
        "voice": {
            "languageCode": profile.get(
                "languageCode", defaults.get("languageCode", "en-US")
            ),
            "name": profile["voice"],
            "modelName": model,
        },
        "audioConfig": {
            "audioEncoding": "MP3",
        },
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Google TTS HTTP {error.code}: {detail[:600]}") from None
    if not body.get("audioContent"):
        raise RuntimeError("Google TTS response did not contain audioContent")
    return base64.b64decode(body["audioContent"])


def synthesize_chirp(profile: dict, defaults: dict) -> bytes:
    try:
        from google.cloud import texttospeech
    except ImportError as error:
        raise RuntimeError(
            "Install google-cloud-texttospeech to use the Chirp provider"
        ) from error

    language = profile.get(
        "languageCode", defaults.get("languageCode", "en-US")
    )
    voice_name = f"{language}-Chirp3-HD-{profile['voice']}"
    speaking_rate = max(0.75, min(1.25, profile.get("rate", 175) / 175))
    client = texttospeech.TextToSpeechClient()
    response = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=profile["text"]),
        voice=texttospeech.VoiceSelectionParams(
            language_code=language,
            name=voice_name,
        ),
        audio_config=texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=speaking_rate,
        ),
    )
    return response.audio_content


def pcm_to_mp3(pcm: bytes, sample_rate: int = 24000) -> bytes:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("Gemini PCM conversion requires ffmpeg")
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "s16le",
            "-ar",
            str(sample_rate),
            "-ac",
            "1",
            "-i",
            "pipe:0",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-f",
            "mp3",
            "pipe:1",
        ],
        input=pcm,
        capture_output=True,
        check=True,
    )
    return result.stdout


def apply_sound_design(audio: bytes, audio_filter: Optional[str]) -> bytes:
    if not audio_filter:
        return audio
    if not shutil.which("ffmpeg"):
        raise RuntimeError("Character sound design requires ffmpeg")
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-af",
            audio_filter,
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-f",
            "mp3",
            "pipe:1",
        ],
        input=audio,
        capture_output=True,
        check=True,
    )
    return result.stdout


def synthesize_gemini(profile: dict, defaults: dict, api_key: str) -> bytes:
    model = os.environ.get(
        "GEMINI_TTS_MODEL",
        defaults.get("geminiApiModel", "gemini-2.5-flash-preview-tts"),
    )
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    prompt = (
        f"{profile['prompt']} Speak only the exact quoted dialogue, with no "
        f"introduction or commentary.\n\nDialogue: \"{profile['text']}\""
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": profile["voice"]}
                }
            },
        },
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini TTS HTTP {error.code}: {detail[:600]}") from None

    try:
        inline = body["candidates"][0]["content"]["parts"][0]["inlineData"]
        audio = base64.b64decode(inline["data"])
        mime = inline.get("mimeType", "")
    except (KeyError, IndexError, ValueError) as error:
        raise RuntimeError(f"Gemini response did not contain audio: {body}") from error

    if "wav" in mime or audio.startswith(b"RIFF"):
        with tempfile.TemporaryDirectory(prefix="bearbakery-gemini-") as temp:
            source = Path(temp) / "voice.wav"
            target = Path(temp) / "voice.mp3"
            source.write_bytes(audio)
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(source),
                    "-codec:a",
                    "libmp3lame",
                    "-b:a",
                    "128k",
                    str(target),
                ],
                check=True,
            )
            return target.read_bytes()

    sample_rate = 24000
    if "rate=" in mime:
        try:
            sample_rate = int(mime.split("rate=", 1)[1].split(";", 1)[0])
        except ValueError:
            pass
    return pcm_to_mp3(audio, sample_rate)


def synthesize_macos(profile: dict) -> bytes:
    if not shutil.which("say") or not shutil.which("ffmpeg"):
        raise RuntimeError("macOS fallback requires both say and ffmpeg")
    with tempfile.TemporaryDirectory(prefix="bearbakery-tts-") as temp:
        aiff = Path(temp) / "voice.aiff"
        mp3 = Path(temp) / "voice.mp3"
        subprocess.run(
            [
                "say",
                "-v",
                profile["fallbackVoice"],
                "-r",
                str(profile.get("rate", 175)),
                "-o",
                str(aiff),
                profile["text"],
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(aiff),
                "-codec:a",
                "libmp3lame",
                "-b:a",
                "128k",
                "-ar",
                "44100",
                str(mp3),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        return mp3.read_bytes()


def valid_mp3(data: bytes) -> bool:
    return len(data) > 1024 and (
        data.startswith(b"ID3") or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--provider",
        choices=("auto", "gemini", "google", "chirp", "macos"),
        default="auto",
        help="auto uses Gemini API when a key is configured, otherwise macOS local voices",
    )
    parser.add_argument(
        "--only",
        nargs="*",
        default=[],
        help="optional species IDs to regenerate",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="replace clips that already exist",
    )
    parser.add_argument(
        "--no-effects",
        action="store_true",
        help="render raw provider audio with no post-processing or DSP",
    )
    parser.add_argument(
        "--multiple",
        action="store_true",
        help="render profile, greeting, order, and chat clips per character",
    )
    args = parser.parse_args()

    config = load_profiles()
    api_key = load_google_api_key()
    provider = args.provider
    if provider == "auto":
        provider = "gemini" if api_key else "macos"
    if provider in ("gemini", "google") and not api_key:
        print(
            "Google credentials are not configured. Set "
            "GOOGLE_CLOUD_TTS_API_KEY or save BearBakeryGoogleTTS in macOS "
            "Keychain; do not commit or paste the key."
        )
        return 2

    requested = set(args.only)
    profiles = [
        profile
        for profile in config["profiles"]
        if not requested or profile["id"] in requested
    ]
    if requested:
        missing_ids = requested - {profile["id"] for profile in profiles}
        if missing_ids:
            raise SystemExit(f"Unknown voice IDs: {', '.join(sorted(missing_ids))}")

    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "provider": provider,
        "model": (
            config.get("geminiApiModel")
            if provider == "gemini"
            else config["model"]
            if provider == "google"
            else "Google Chirp 3 HD"
            if provider == "chirp"
            else "macOS system voices"
        ),
        "generatedAt": int(time.time()),
        "clips": [],
    }

    failures = []
    service_disabled = False
    dialogue_previews = load_dialogue_previews() if args.multiple else {}
    for profile in profiles:
        # (bucket, text, recipeId) — recipeId is set only for order clips.
        variants = [("profile", profile["text"], None)]
        if args.multiple:
            preview = dialogue_previews.get(profile["id"], {})
            variants.append(("greet", preview.get("greet", profile["text"]), None))
            variants.append(("chat", preview.get("chat", profile["text"]), None))
            for entry in preview.get("orders", []):
                variants.append(("order", entry["text"], entry["recipeId"]))

        for bucket, text, recipe_id in variants:
            if not args.multiple:
                clip_id = profile["id"]
            elif recipe_id:
                clip_id = f"{profile['id']}_{bucket}_{recipe_id}"
            else:
                clip_id = f"{profile['id']}_{bucket}"
            output_name = (
                f"{profile['id']}_preview.mp3"
                if args.multiple and bucket == "profile"
                else f"{clip_id}.mp3"
            )
            output = VOICE_DIR / output_name
            assert_speakable(clip_id, text)
            active_profile = {**profile, "text": text}
            if output.exists() and not args.overwrite:
                data = output.read_bytes()
                status = "kept"
            else:
                print(
                    f"Generating {profile['label']} "
                    f"({profile['id']} / {bucket})..."
                )
                try:
                    data = (
                        synthesize_google(active_profile, config, api_key)
                        if provider == "google"
                        else synthesize_gemini(active_profile, config, api_key)
                        if provider == "gemini"
                        else synthesize_chirp(active_profile, config)
                        if provider == "chirp"
                        else synthesize_macos(active_profile)
                    )
                    if not args.no_effects:
                        data = apply_sound_design(
                            data, profile.get("audioFilter")
                        )
                    if not valid_mp3(data):
                        raise RuntimeError("generated data is not a valid MP3")
                    output.write_bytes(data)
                    status = "generated"
                except Exception as error:
                    failures.append((clip_id, str(error)))
                    print(f"  FAILED: {error}")
                    if (
                        "SERVICE_DISABLED" in str(error)
                        or "has not been used" in str(error)
                        or "API_KEY_SERVICE_BLOCKED" in str(error)
                    ):
                        service_disabled = True
                        print(
                            "Stopping batch because the required Google API is blocked."
                        )
                        break
                    continue

            manifest["clips"].append(
                {
                    "id": clip_id,
                    "speciesId": profile["id"],
                    "bucket": bucket,
                    "recipeId": recipe_id,
                    "label": profile["label"],
                    "voice": (
                        profile["voice"]
                        if provider in ("gemini", "google", "chirp")
                        else profile["fallbackVoice"]
                    ),
                    "style": profile["prompt"],
                    "soundDesign": (
                        "Natural Google voice — no DSP"
                        if args.no_effects
                        else profile.get("soundDesign", "")
                    ),
                    "effectSignature": (
                        "" if args.no_effects else profile.get("audioFilter", "")
                    ),
                    "languageCode": profile.get(
                        "languageCode", config.get("languageCode", "en-US")
                    ),
                    "speakingRate": (
                        round(
                            max(
                                0.75,
                                min(1.25, profile.get("rate", 175) / 175),
                            ),
                            2,
                        )
                        if provider == "chirp"
                        else None
                    ),
                    "text": text,
                    "src": f"assets/audio/voices/{output.name}",
                    "bytes": len(data),
                    "status": status,
                }
            )
        if service_disabled:
            break

    # Never replace a working manifest with an empty failed batch, and never
    # let a partial run (--only) drop clips it simply did not touch.
    if manifest["clips"]:
        if requested and MANIFEST_PATH.exists():
            try:
                previous = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                previous = {"clips": []}
            fresh = {clip["id"] for clip in manifest["clips"]}
            untouched = [
                clip
                for clip in previous.get("clips", [])
                if clip.get("id") not in fresh
                and clip.get("speciesId") not in requested
            ]
            manifest["clips"] = untouched + manifest["clips"]
            manifest["clips"].sort(key=lambda clip: (clip.get("speciesId", ""), clip.get("id", "")))
        with MANIFEST_PATH.open("w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2, ensure_ascii=False)
            handle.write("\n")

    print(
        f"{'Wrote' if manifest['clips'] else 'Generated'} "
        f"{len(manifest['clips'])} clips"
        + (
            f" and {MANIFEST_PATH.relative_to(ROOT)} using {provider}."
            if manifest["clips"]
            else "; existing manifest preserved."
        )
    )
    if failures:
        print(f"{len(failures)} failures:")
        for species_id, detail in failures:
            print(f"  {species_id}: {detail[:300]}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
