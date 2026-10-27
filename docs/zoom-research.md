# What makes Zoom's webinar experience work, and what we took from it

The goal was to learn from Zoom's behaviour, not copy its look. Zoom isn't loved for its design. People trust it
because it is predictable: devices work, audio is never a mystery, and the host always knows what the room is doing.
These are the patterns behind that, and what this app now does with each.

## 1. Reliability patterns (the most important)

| Zoom pattern | Why it matters | What we built |
|---|---|---|
| **Pre-join audio/video check** ("Test speaker & microphone", video preview before joining) | Most "I can't hear you" moments are a wrong device chosen before the session started | `prejoin.tsx`. The host sees their camera, a live mic meter and camera/mic/speaker pickers. Everyone gets a "Test speakers" chime |
| **Join click unlocks audio** | Browsers block autoplay audio until the user interacts with the page | The attendee's **Join webinar** button *is* that interaction, so the host's audio plays at once. A fallback "Tap to turn on sound" button covers the rest |
| **Instant mute/unmute** | Re-opening the mic on every unmute is slow and can trigger a permission prompt | Mute keeps the mic open and only stops publishing (`use-local-media.ts`) |
| **Device hot-swap** | Headphones get plugged in mid-session | The ˄ chevron next to Mic/Video switches devices live. If a device is unplugged, the app falls back to the default and shows a message |
| **Auto-reconnect** | Wi-Fi blips shouldn't end the session | Agora's own reconnect, plus a full rejoin with backoff after a fatal drop or token expiry (`use-broadcast.ts`). The top bar shows "Reconnecting…" |
| **Adaptive quality** | One attendee on mobile data shouldn't freeze | The host sends a second, low-resolution stream (dual stream). Attendees drop to it automatically when their bandwidth dips |
| **Network indicator** | Lets people tell "my network" apart from "their stream" | Signal bars in the top bar: uplink for the host, downlink for attendees |
| **Content + speaker at once** | Presenters lose rapport when their face disappears behind slides | Screen share goes out on a separate connection, so attendees see the slides *and* the presenter's camera together (draggable picture-in-picture) |
| **Screen share tuned for text** | Slides stutter or blur when encoded like video | `contentHint = "detail"`, 15 fps and a 0.4–2 Mbps bitrate for sharp text, with optional tab audio for videos inside slides |

## 2. Host micro-interactions

| Zoom pattern | What we built |
|---|---|
| "You are muted" when you talk while muted | A toast after about 1 second of speech into a muted mic, with an **Unmute** button. It shows at most once every 20 s |
| Hold Space to talk | Push-to-talk: hold **Space** while muted |
| Keyboard shortcuts | M mic, V video, S share, R record, H hand, C/Q/P/U panels, 1–8 reactions, Esc close, ? help |
| Raised-hand alerts | A toast for each new hand with a **Lower** action. The People button shows a count |
| Q&A: answered / live answer | Mark questions answered, which moves them to an Answered tab. **Show on stage** puts a question on everyone's screen as a caption |
| Polls launched to everyone | A new poll pops onto every attendee's stage, so nobody has to find a side panel. Results animate live |
| Remove participant | People → ••• → Remove. Their registration is rejected, so they can't rejoin |
| Recording indicator | A **REC** badge for everyone while the host records (transparency, as in Zoom) |
| Waiting room | Attendees who join early see a countdown until the host presses **Go live**. The host's camera stays private until then |

## 3. Attendee micro-interactions

- **Auto-hiding controls:** the top bar and dock fade out after 3.5 s of no movement while watching, like Zoom's
  full-screen mode, and come back on any mouse move or tap.
- **Volume slider** for the host's audio.
- **Reactions** with keyboard shortcuts, batched on the wire (one message per person every 1.5 s at most) so a
  100-person room reacting together stays smooth.
- **Unread badges** on Chat and Q&A, and a dot on Polls when there's a poll you haven't answered.

## 4. Deliberately not copied (yet)

These are Zoom features worth doing next, roughly in order of value:

1. **Promote attendee to speaker** (Zoom's "Allow to talk"). Needs a second publisher role and token, plus a
   speaker grid on stage.
2. **Breakout rooms**: less relevant for one-to-many webinars.
3. **Live captions / transcript**: possible with the browser's speech API on the host side, sent over Realtime.
4. **Practice session**: a "rehearsal" mode where panelists join before attendees (partly covered by Preview mode).
5. **Background blur**: Agora has a virtual-background extension. It adds about 2 MB and CPU cost.
6. **Cloud recording**: see the README. Local recording was chosen first.
