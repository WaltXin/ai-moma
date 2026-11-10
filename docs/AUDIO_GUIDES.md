# Describing a work: the audio-guide standard

How to write, check, translate and voice the explanation a visitor hears when they open a
work. Follow it whether a person or a model writes the script. The code is in
`src/content/guides.ts` (scripts and sources), `scripts/voice-guides.mjs` (voicing) and
`src/components/audio-guide.tsx` (the player); `tests/guides.test.ts` checks the parts a
test can check.

## The goal

The visitor should **leave able to see something they couldn't see before**, not just know a
fact. So a script leads the eye, raises a question, then explains. That's how museums that
study learning write (see "Where this comes from" below).

## The core script

One spoken paragraph per work, in six beats, in this order:

| Beat | What it does | About |
|---|---|---|
| 1. **Look** | Opens on one concrete, surprising detail and says where it is ("the woman on the right… a monkey at her feet"). Never opens on the artist's biography. | 1–2 sentences |
| 2. **Wonder** | Asks one open question the visitor can answer by looking ("One small girl is running. Why only her?"). Don't answer it straight away; let them look. | 1 sentence |
| 3. **How** | How it was made, shown on this canvas: the technique, the colour, the composition, the movement's ideas as they appear here. Tell them to step closer or back if that's how to see it. | 3–4 sentences |
| 4. **Story** | One or two well-established facts that change how it looks: when, where, what the artist was after, how the work changed while being made. Not a biography. | 2–3 sentences |
| 5. **Meaning** | What it's about, and why it mattered then and after: who's in it, what was new, who had to answer it. | 1–2 sentences |
| 6. **Look again** | Ends on one or two things to look for now that they know more. | 1 sentence |

**Length:** 200–240 words in English (about 80–95 seconds), 200–290 words in French, and
380–520 characters in Chinese. Longer isn't better: visitors tire quickly, and depth belongs in a
separate, optional layer (see "Later layers").

### Writing for the ear

- Short sentences. Second person ("look", "you") is fine. Warm, curious, never academic or gushing.
- One paragraph: no lists, headings, markdown, emoji, parentheses, footnotes or links.
- Write numbers and words the way they should be spoken: "around 1916", not "c. 1916";
  "Saint", not "St.". No symbols (`& / % — ( ) #`); use commas and full stops.
- Directions are the visitor's: left and right as they face the work.
- Titles in English as on the label; foreign words short.

## Accuracy and sources

Every fact must trace back to a source, and every guide lists its sources in
`guideSources` in `src/content/guides.ts`. For a public-domain work, the first source is
always the holding museum's own record.

**Research in this order** (and stop when you have enough):

1. **Look at the work** (`public/art/<id>.jpg`, or the zoom copy). Beats 1, 2 and 6 come from
   looking, and must be true of the image.
2. **The holding museum's record**, from the same open APIs `pnpm art:fetch` uses:

   | Source | What's there | Licence | How to use it |
   |---|---|---|---|
   | Art Institute of Chicago (`aic`) | `description` (curator's text, most works), `short_description` | `description` **CC BY 4.0**; the rest CC0 | Adapt freely; credit "Art Institute of Chicago, CC BY 4.0" in the sources |
   | AIC audio-tour transcripts (`/mobile-sounds`) | Curator stops, verbal-description stops | Non-commercial educational use only | Read to learn what experts point at; **never copy** |
   | Cleveland Museum of Art (`cma`) | `description`, `did_you_know` | CC0 | Use freely |
   | National Gallery of Art (`nga`) | No descriptions; exhibition histories, bibliography (`objects_text_entries.csv`) | CC0 | Check facts (e.g. which exhibition it was first shown in) |
   | The Met (`met`) | No descriptive text in its API | — | Check facts on the object page |

3. **Wikidata** (CC0) for dates, places and people. Wikipedia (CC BY-SA) only to check facts,
   never to copy text: share-alike would bind our scripts to its licence.
4. **Smarthistory** (CC BY-NC-SA) and museum essays: read for understanding, link as further
   reading; never copy text.

**Rules:**

- Write in your own words. Short facts aren't copyrightable; sentences are.
- If a fact isn't in a source you've listed, leave it out. Never invent quotes, sizes,
  prices, provenance or anecdotes.
- Never contradict the label (title, artist, date, medium). A lithograph is a print, not a painting.
- Don't say where the original hangs today.

**Studio pieces** (drawn by code, `recipe` set) have no outside source. Read the recipe in
`src/lib/studio-art/styles.ts` and render it to look at it. Say once, plainly, that the piece
was drawn by code in the museum's Studio using the movement's techniques and is not a copy of
any real work. Then teach the technique: what to look at, and which real ideas of the
movement it shows. You may name the movement's real artists and works as context. The
movement's page in `src/content/movements/` is the source.

## Translations

Every guide has every language in `GUIDE_LANGS` (English, French, Simplified Chinese). Write
each one as a native museum guide would say it, with the same beats and the same facts.
Don't translate word for word.

- **French:** use established French titles where they exist, in « guillemets »; otherwise translate.
- **Chinese:** natural spoken Mandarin with Chinese punctuation. Use standard names (修拉, 莫奈,
  梵高, 塞尚, 蒙德里安, 康定斯基…) and established titles in 《》. Years as digits. "AI MoMA" stays as is.

## Voicing

`pnpm guides:voice` reads every new or changed script aloud once with Cartesia and saves
`public/guides/<lang>/<id>.mp3`. Visitors play the file; the walk never calls a voice service.

- One request at a time: the Cartesia account's few concurrent streams are shared with
  OrangeChat's live phone calls. Run big batches outside its evening rush (01:00–03:00 UTC).
- Voices: Marian (English), French Narrator Lady, Xia (Mandarin), on the pinned
  `sonic-3.6-2026-08-27`. Clips are loudness-matched, so switching language doesn't jump in volume.
- Cost is about one Cartesia credit per character: roughly 3,000 per work for all three languages.
- Listen to every new clip once before merging: names, numbers and titles are where voices slip.
- A recording is tied to the exact text it was made from. Edit a script and the old
  recording stops playing (the visitor gets the text) until you re-voice it.

## Before you merge

- [ ] Looked at the work; beats 1, 2 and 6 are true of the image.
- [ ] All six beats present, in order; English 200–240 words.
- [ ] Every fact is in a listed source; the holding museum's record comes first.
- [ ] No copied sentences; CC BY sources credited.
- [ ] French and Chinese written natively, with established titles.
- [ ] `pnpm guides:voice`, then listened to each clip.
- [ ] `pnpm check` passes.

## Worked example: *A Sunday on La Grande Jatte — 1884*

The recording in the walk was made before this standard. It has the Look, How, Story and
Look-again beats, but no open question and little on meaning. Here's the English it would
become, beat by beat:

1. **Look:** "Start with the woman on the right, in profile, a monkey on a leash at her feet.
   Seurat added that monkey late, when he came back to the canvas after two years; once you
   know, it looks almost staged." *(The added figures are in AIC's description.)*
2. **Wonder:** "Now look across the park… Yet almost no one moves. One small girl in orange is
   running. Why only her?"
3. **How:** "Look closer and the grass breaks into dots. Seurat set pure colours side by
   side… so your eye mixes them, and they flicker in a way mixed paint can't."
4. **Story:** "He showed it in 1886 at the last Impressionist exhibition…" *(AIC exhibition
   history.)*
5. **Meaning:** "…modern Parisians, posed as still as figures on an ancient frieze. After this,
   painters had to decide whether a picture was a glimpse or something built."
6. **Look again:** "Two last things to look for: the strange orange shapes poking in at the
   right edge, and the painted border of dots he added later."

Its sources are in `guideSources["aic-27992"]`.

## Later layers (not built yet)

The Art Institute of Chicago writes four descriptions of *La Grande Jatte*, each for one job: a
65-word label, a 200-word online text, a 2½-minute curator stop, and a 3½-minute verbal
description for blind visitors. The core script is our version of the curator stop. When
we add more, give each layer one job:

- **Label line** (on screen, about 50 words): what it is and why it matters.
- **Describe it to me** (accessibility): general to specific, left to right and front to back;
  what's there, how big, what colour, with no interpretation. Ends by pointing to the core script.
- **Go deeper:** a link to the museum's page or a Smarthistory essay.

## Where this comes from

- **Look first, then explain:** Visual Thinking Strategies, and Harvard Project Zero's See, Think,
  Wonder ([Project Zero](https://pz.harvard.edu/sites/default/files/See%20Think%20Wonder_0.pdf)).
  Visitors also want real art history, not questions alone
  ([University of Barcelona study at the Picasso Museum](https://diposit.ub.edu/dspace/bitstream/2445/221558/1/835889.pdf)).
- **Narration with the picture, and pointing at what's being said:** Mayer's multimedia
  learning, the signaling principle ([Cambridge Handbook](https://cambridge.org:443/core/books/cambridge-handbook-of-multimedia-learning/signaling-or-cueing-principle-in-multimedia-learning/E1DB12F23DEC7C6BABF198FB991523F4)).
  This is why guided looking (zooming to each detail as it's mentioned) is on the roadmap.
- **General to specific, and keeping description apart from interpretation:** verbal-description
  guidelines for blind visitors ([comparative review](https://www.mdpi.com/2313-433X/10/1/26/html)).
- **Short stops, depth optional:** museum practice; there's no rigorous study of the ideal
  length ([Barra Foundation](https://www.barrafoundation.org/stories/striking-a-balance/)).
- **A real museum's layers:** the Art Institute of Chicago's label, description and audio
  stops for *La Grande Jatte* ([artic.edu/artworks/27992](https://www.artic.edu/artworks/27992)).
