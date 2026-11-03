import type { Exhibition } from "@/lib/museum/types";
import { pd } from "./public-domain";
import { studioPiece as studio } from "./studio-art";

/**
 * Exhibitions, one room each, with at least four works per curated room.
 * Historic works come from museum open-access collections through `pd()`
 * (public domain only). Where a movement's works are still under copyright,
 * the room hangs original Studio pieces drawn with code in its techniques
 * (`studio()`, see src/lib/studio-art). Community exhibitions will later
 * move to a database.
 */

export const exhibitions: Exhibition[] = [
  // ── Floor 2: Light & Color ──────────────────────────────────────────
  {
    slug: "impressions-of-light",
    title: "Impressions of Light",
    movement: "impressionism",
    description:
      "Haystacks at sunset, a wet Paris boulevard, a milliner's shop: modern life caught in passing light.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("aic", 64818), // Monet, Stacks of Wheat (End of Summer)
      pd("aic", 16568), // Monet, Water Lilies
      pd("aic", 20684), // Caillebotte, Paris Street; Rainy Day
      pd("aic", 14655), // Renoir, Two Sisters (On the Terrace)
      pd("aic", 14572), // Degas, The Millinery Shop
      pd("aic", 11723), // Morisot, Woman at Her Toilette
      pd("aic", 111442), // Cassatt, The Child's Bath
      pd("aic", 81551), // Pissarro, The Place du Havre, Paris
    ],
  },
  {
    slug: "points-of-color",
    title: "Points of Color",
    movement: "neo-impressionism",
    description:
      "Seurat's great Sunday afternoon and the painters who followed his dots. Walk up close, then step back.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("aic", 27992), // Seurat, A Sunday on La Grande Jatte — 1884
      pd("aic", 20199), // Seurat, Final Study for "Bathers at Asnières"
      pd("aic", 122130), // Signac, Les Andelys, Côte d'Aval
      pd("aic", 100476), // Cross, Beach at Cabasson
      pd("aic", 104912), // Signac, Chromatic Circle
      pd("cma", 130625), // Signac, Saint-Tropez: The Port
    ],
  },
  {
    slug: "color-and-structure",
    title: "Color and Structure",
    movement: "post-impressionism",
    description:
      "Four painters who took Impressionism somewhere new: Cézanne's solid apples, van Gogh's bedroom, Gauguin's myths and Lautrec's nightlife.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("aic", 28560), // van Gogh, The Bedroom
      pd("aic", 80607), // van Gogh, Self-Portrait
      pd("aic", 111436), // Cézanne, The Basket of Apples
      pd("aic", 16487), // Cézanne, The Bay of Marseille
      pd("aic", 19339), // Gauguin, Arlésiennes (Mistral)
      pd("aic", 27943), // Gauguin, Mahana no atua
      pd("aic", 61128), // Toulouse-Lautrec, At the Moulin Rouge
    ],
  },
  {
    slug: "living-line",
    title: "The Living Line",
    movement: "art-nouveau",
    description:
      "Mucha's posters and pattern plates, where flowers, hair and lettering become one curve.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("cma", 144595), // Mucha, Oriental Poppies
      pd("cma", 144597), // Mucha, Sweet Peas
      pd("cma", 147115), // Mucha, Lorenzaccio
      pd("cma", 148901), // Mucha, Ilsee, Princesse de Tripoli
    ],
  },

  // ── Floor 3: The Avant-Garde ────────────────────────────────────────
  {
    slug: "wild-color",
    title: "Wild Color",
    movement: "fauvism",
    description:
      "Color that shouts. Matisse's canvases sit beside Studio pieces made with Fauve technique.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("aic", 87045), // Matisse, Still Life with Geranium
      pd("aic", 64001), // Matisse, Apples
      studio("wild-color-1", "Harbor in Pure Color", "fauve-harbor"),
      studio("wild-color-2", "Portrait in Two Colors", "fauve-portrait"),
      studio("wild-color-3", "Hills at Collioure, Violet Sky", "fauve-landscape"),
    ],
  },
  {
    slug: "inner-visions",
    title: "Inner Visions",
    movement: "expressionism",
    description:
      "Anxiety, longing and the spiritual, from Munch's Scream to Kandinsky's leap toward abstraction.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("aic", 17229), // Munch, The Scream (lithograph)
      pd("aic", 154235), // Munch, The Girl by the Window
      pd("aic", 8991), // Kandinsky, Improvisation No. 30 (Cannons)
      pd("aic", 9021), // Marc, The Bewitched Mill
      pd("cma", 142792), // Kirchner, Wrestlers in a Circus
      pd("cma", 136595), // Marc, Tiger
    ],
  },
  {
    slug: "many-angles",
    title: "Many Angles at Once",
    movement: "cubism",
    description:
      "Still lifes and cafés taken apart and rebuilt from every side by the Cubists of Paris.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("cma", 715339), // Blanchard, Still Life
      pd("cma", 164630), // Marcoussis, Night Café
      pd("cma", 142692), // Gris, Marcelle la Blonde
      studio("many-angles-1", "Guitar, Four Viewpoints", "cubist"),
    ],
  },
  {
    slug: "speed-and-force",
    title: "Speed and Force",
    movement: "futurism",
    description:
      "Trying to paint motion itself: a study by Boccioni and Studio pieces made with Futurist techniques.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("cma", 146135), // Boccioni, Movement
      studio("speed-and-force-1", "Tram at Full Speed", "futurist-tram"),
      studio("speed-and-force-2", "Dynamism of a Bicycle Courier", "futurist-cyclist"),
      studio("speed-and-force-3", "Lines of Force over a Station", "futurist-station"),
    ],
  },

  // ── Floor 4: Between the Wars ───────────────────────────────────────
  {
    slug: "anti-art",
    title: "Anti-Art",
    movement: "dada",
    description:
      "Scraps, tickets and nonsense: Schwitters's Merz and the Dada habit of making art from chance.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("cma", 138684), // Schwitters, Little Dance
      pd("cma", 159216), // Schwitters, Merz 3 Portfolio: Plate 1
      studio("anti-art-1", "Chance Arrangement No. 3", "dada"),
      studio("anti-art-2", "Ticket to Nowhere", "dada"),
    ],
  },
  {
    slug: "lines-and-primaries",
    title: "Lines and Primaries",
    movement: "de-stijl",
    description: "Mondrian's path from a Dutch farmhouse to the pure grid.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("aic", 144467), // Mondrian, Farm near Duivendrecht
      pd("aic", 109819), // Mondrian, Lozenge Composition
      pd("cma", 143278), // Mondrian, Composition with Red, Yellow, and Blue
      pd("aic", 65821), // Mondrian, Composition (No. 1) Gray-Red
    ],
  },
  {
    slug: "square-and-wedge",
    title: "Square and Wedge",
    movement: "constructivism",
    description:
      "Pure geometry and art for a new society, in Studio pieces made with Suprematist and Constructivist techniques.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      studio("square-and-wedge-1", "Red Wedge, White Field", "constructivist-wedge"),
      studio("square-and-wedge-2", "Floating Planes", "constructivist-planes"),
      studio("square-and-wedge-3", "Poster for a Workers' Club", "constructivist-poster"),
      studio("square-and-wedge-4", "Red Circle over a Black Bar", "constructivist-circle"),
    ],
  },
  {
    slug: "school-of-making",
    title: "A School for Making",
    movement: "bauhaus",
    description:
      "Prints by Bauhaus teachers: Klee's walking lines and Schlemmer's geometric figures.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      pd("cma", 136592), // Klee, Tightrope Walker
      pd("cma", 151945), // Klee, Small World
      pd("cma", 144705), // Klee, Carnival in the Snow
      pd("cma", 161433), // Schlemmer, Play with Heads
    ],
  },
  {
    slug: "dream-logic",
    title: "Dream Logic",
    movement: "surrealism",
    description:
      "Studio pieces made with Surrealist techniques: dream images, chance textures, exquisite corpses.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      studio("dream-logic-1", "Clock Left in the Rain", "surreal-clock"),
      studio("dream-logic-2", "Staircase to the Sea", "surreal-stairs"),
      studio("dream-logic-3", "Exquisite Corpse for Three Prompts", "surreal-corpse"),
      studio("dream-logic-4", "A Door Standing in the Desert", "surreal-door"),
    ],
  },

  // ── Floor 5: After the War ──────────────────────────────────────────
  {
    slug: "gesture-and-field",
    title: "Gesture and Field",
    movement: "abstract-expressionism",
    description:
      "Poured, dripped and soaked: Studio pieces made with Abstract Expressionist techniques.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      studio("gesture-and-field-1", "Pour No. 1", "abex-pour"),
      studio("gesture-and-field-2", "Two Fields, Red over Brown", "abex-field-red"),
      studio("gesture-and-field-3", "Gesture in Black and White", "abex-gesture"),
      studio("gesture-and-field-4", "Blue Field, Open", "abex-field-blue"),
    ],
  },
  {
    slug: "what-you-see",
    title: "What You See",
    movement: "minimalism",
    description: "Repetition, grids and industrial calm, made in the Studio.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      studio("what-you-see-1", "Six Units, Aluminum Gray", "minimal-units"),
      studio("what-you-see-2", "Grid, Pencil on White", "minimal-grid"),
      studio("what-you-see-3", "Corner Light", "minimal-light"),
      studio("what-you-see-4", "Thirty-Six Plates", "minimal-floor"),
    ],
  },

  // ── Floor 6: Pop ────────────────────────────────────────────────────
  {
    slug: "everyday-icons",
    title: "Everyday Icons",
    movement: "pop-art",
    description:
      "Ordinary objects and faces, repeated, saturated and turned into icons by machines and their prompters.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      studio("everyday-icons-1", "Can, Four Ways", "pop-can"),
      studio("everyday-icons-2", "Selfie in Halftone", "pop-selfie"),
      studio("everyday-icons-3", "Notification Blonde", "pop-notification"),
      studio("everyday-icons-4", "Pop! (Push Alert)", "pop-burst"),
    ],
  },

  // ── Floor 7: Perception & Motion ────────────────────────────────────
  {
    slug: "angles-of-view",
    title: "Angles of View",
    movement: "op-art",
    description:
      "Pieces that change depending on where you stand. Walk past the Agamographs, or move your cursor or tilt your phone over them, and watch one image turn into another.",
    curator: "AI MoMA",
    kind: "curated",
    artworks: [
      studio("angles-of-view-1", "Two Skies", "agam-two-skies"),
      studio("angles-of-view-2", "Interference No. 1", "op-moire"),
      studio("angles-of-view-3", "Square, Then Circle", "agam-square-circle"),
      studio("angles-of-view-4", "Current", "op-waves"),
      studio("angles-of-view-5", "Three Rainbows", "agam-three-rainbows"),
      studio("angles-of-view-6", "Swelling Grid", "op-checker"),
    ],
  },

  // ── Floor 1: Community Gallery ──────────────────────────────────────
  {
    slug: "visitor-pop",
    title: "Visitor Pop",
    movement: "pop-art",
    description: "Pop portraits made by visitors in the Studio and submitted for exhibition.",
    curator: "Community",
    kind: "community",
    artworks: [],
  },
];
