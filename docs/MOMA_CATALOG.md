# What MoMA collects: a to-do list for AI MoMA

The real MoMA collects far more than paintings: prints, photographs, chairs, buildings, films,
videos, sound, performance, software and games. This page lists all of it, so contributors can
pick something and build it. Nothing here is implemented unless it is marked ✅.

**Status keys:** ✅ in AI MoMA · 🟡 partly · ⬜ open, pick it up

## Where these lists come from

- **Departments, forms and materials** are counted from MoMA's open collection data,
  [MuseumofModernArt/collection](https://github.com/MuseumofModernArt/collection)
  (`Artworks.csv`, 160,928 records, fetched 2026-11-05). The metadata is CC0.
- **Movements, techniques and vocabulary** come from the names in MoMA's
  [Art terms](https://www.moma.org/collection/terms/) glossary (358 terms, 2026-11-05).
  Each linked name goes to MoMA's definition. We list names only. MoMA wrote the
  definitions and owns them, so don't copy them into this repo. Write your own.

> **Copyright.** MoMA's data is CC0, but its **images are not**. Never download anything
> from the dataset's `ImageURL` column. Historic works still come in only through
> `pd("aic" | "cma", id)` and `pnpm art:fetch`. For anything still in copyright, hang an
> original Studio piece made with the movement's techniques (see `AGENTS.md`). The
> "Public domain?" column below is only a rough guide; `art:fetch` makes the final call.

---

## 1. MoMA's curatorial departments

| Department            | Records in open data | What it holds                                                                                                             | AI MoMA                                                        |
| --------------------- | -------------------: | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Drawings & Prints     |               82,212 | Prints, illustrated and artist's books, drawings, notebooks, multiples, periodicals                                       | 🟡 a few public-domain lithographs, woodcuts and etchings hang |
| Architecture & Design |               34,779 | Design objects, architecture drawings and models, the Mies van der Rohe and Frank Lloyd Wright archives                   | ⬜                                                             |
| Photography           |               33,811 | Photographs from daguerreotypes to inkjet                                                                                 | ⬜                                                             |
| Painting & Sculpture  |                4,097 | Paintings, sculpture, some installations                                                                                  | ✅ painting · ⬜ sculpture                                     |
| Media and Performance |                3,295 | Video, installation, performance, sound, software, websites                                                               | ⬜                                                             |
| Fluxus Collection     |                1,684 | Fluxus boxes, scores, audio, multiples, ephemera                                                                          | ⬜                                                             |
| Film                  |                1,019 | Posters, stills, works on paper and some films. MoMA's film archive itself is much larger and mostly not in the open data | ⬜                                                             |

## 2. Forms of art (MoMA's `Classification` field)

Every classification in the data, largest first, with how it could show up in our building.
Our current artwork sources are `image`, `lenticular`, `placeholder`, and `model3d`
(planned) in `src/lib/museum/types.ts`. Several forms below need a new source kind or viewer.

| Form                                                 | Records | AI MoMA | How it could be shown                                                                                    |
| ---------------------------------------------------- | ------: | ------- | -------------------------------------------------------------------------------------------------------- |
| Photograph                                           |  35,037 | ⬜      | `image` on the wall; a Photography floor. CMA has many CC0 19th-century photographs                      |
| Print                                                |  33,405 | 🟡      | `image`. A print-room viewer could compare editions and states                                           |
| Illustrated Book                                     |  28,316 | ⬜      | New `book` source (`pages[]`) with a page-turning viewer in a vitrine                                    |
| Mies van der Rohe Archive                            |  17,092 | ⬜      | Architecture drawings on walls. Still in copyright, so draw original plans in Mies-like grids            |
| Drawing                                              |  14,367 | 🟡      | `image`; a "Drawing room" with low light                                                                 |
| Design                                               |  12,043 | ⬜      | `model3d` objects on plinths (chairs, lamps, appliances)                                                 |
| Architecture                                         |   4,806 | ⬜      | Plans, elevations and sections on walls; models on tables; walk-in 1:1 rooms                             |
| Painting                                             |   2,458 | ✅      | `image` on the wall, close-up zoom                                                                       |
| Video                                                |   2,445 | ⬜      | New `video` source: screens and dark projection rooms in the walk                                        |
| Notebook                                             |   2,004 | ⬜      | `book` source                                                                                            |
| Sculpture                                            |   1,812 | ⬜      | `model3d` plus the planned `room3d` viewer; the Floor 5 terrace                                          |
| Multiple                                             |   1,190 | ⬜      | `model3d` or `image`, shown as an edition of identical copies                                            |
| Periodical                                           |     961 | ⬜      | `book` source; magazine racks                                                                            |
| Installation                                         |     928 | ⬜      | A whole room as one artwork: lights, sound, objects, built in the walk                                   |
| Frank Lloyd Wright Archive                           |     869 | ⬜      | Drawings. Wright died in 1959, so his work enters the public domain in 2030                              |
| Audio                                                |     795 | ⬜      | New `audio` source: listening booths and sound rooms. The walk already plays generative music            |
| (not assigned)                                       |     682 | n/a     | Mostly Fluxus and film material                                                                          |
| Ephemera                                             |     611 | ⬜      | Vitrine viewer: flyers, tickets, invitations                                                             |
| Work on Paper                                        |     379 | 🟡      | `image`                                                                                                  |
| Collage                                              |     190 | 🟡      | `image`; a Studio collage recipe                                                                         |
| Film                                                 |     153 | ⬜      | A cinema room. Pre-1930 films are often public domain (Lumière, Edison), but they need their own fetcher |
| Poster                                               |     100 | 🟡      | `image`; Studio Constructivist posters already hang                                                      |
| Portfolio                                            |      65 | ⬜      | `book` source                                                                                            |
| Performance                                          |      44 | ⬜      | Timed events in the walk; animated performers; visitors follow a score                                   |
| Media                                                |      41 | ⬜      | Depends on the piece                                                                                     |
| Textile                                              |      36 | ⬜      | `image` with cloth shading; hung loose rather than framed                                                |
| Digital                                              |      28 | ⬜      | New `interactive` source: a sandboxed canvas or iframe                                                   |
| Wallpaper                                            |      23 | ⬜      | A tiling texture applied to a gallery's walls                                                            |
| Correspondence, Document, News Clipping, Publication |      17 | ⬜      | Vitrine viewer                                                                                           |
| Graphic Design                                       |       4 | ⬜      | `image`; type specimens                                                                                  |
| Software                                             |       4 | ⬜      | `interactive` source                                                                                     |
| Film (object), Moving Image                          |       6 | ⬜      | Cinema room                                                                                              |
| Photo Album                                          |       3 | ⬜      | `book` source                                                                                            |
| Architectural Model                                  |       2 | ⬜      | `model3d`                                                                                                |
| Fashion                                              |       2 | ⬜      | `model3d` on mannequins                                                                                  |
| Website                                              |       2 | ⬜      | `interactive` source                                                                                     |
| Product Design, Furniture and Interiors              |       2 | ⬜      | `model3d`; a furnished period room                                                                       |

## 3. Movements, groups and moments

From MoMA's glossary. A row marked ✅ has its own room. 🟡 means it is covered inside
another room. "Public domain?" asks whether the core artists died more than 70 years ago:
**Yes**, **Some**, or **No** (No means Studio pieces only).

### Late 19th century to World War I

| Movement                                                                                                                                        | Era                      | AI MoMA          | Public domain? |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- | -------------- |
| [Arts and Crafts movement](https://www.moma.org/collection/terms/arts-and-crafts-movement)                                                      | 1860s–1910s, Britain     | ⬜               | Yes            |
| [Impressionism](https://www.moma.org/collection/terms/impressionism)                                                                            | 1860s–1880s, France      | ✅               | Yes            |
| [Neo-Impressionism](https://www.moma.org/collection/terms/neo-impressionism) / [Pointillism](https://www.moma.org/collection/terms/pointillism) | 1886–1900s               | ✅               | Yes            |
| [Post-Impressionism](https://www.moma.org/collection/terms/post-impressionism)                                                                  | 1880s–1900s              | ✅               | Yes            |
| [Symbolism](https://www.moma.org/collection/terms/symbolism)                                                                                    | 1880s–1910s              | ⬜               | Yes            |
| [Art Nouveau (New Art)](https://www.moma.org/collection/terms/art-nouveau-new-art)                                                              | 1890–1910                | ✅               | Yes            |
| [Pictorialism](https://www.moma.org/collection/terms/pictorialism) / [Photo-Secession](https://www.moma.org/collection/terms/photo-secession)   | 1890s–1910s, photography | ⬜               | Some           |
| [Fauvism](https://www.moma.org/collection/terms/fauvism)                                                                                        | 1905–1908                | ✅               | Some           |
| [Expressionism](https://www.moma.org/collection/terms/expressionism)                                                                            | 1905–1920s, Germany      | ✅               | Some           |
| [Die Brücke (The Bridge)](https://www.moma.org/collection/terms/die-brucke-the-bridge)                                                          | 1905–1913                | 🟡 Expressionism | Some           |
| [Der Blaue Reiter (The Blue Rider)](https://www.moma.org/collection/terms/der-blaue-reiter-the-blue-rider)                                      | 1911–1914                | 🟡 Expressionism | Some           |
| [Cubism](https://www.moma.org/collection/terms/cubism)                                                                                          | 1907–1920s               | ✅               | Some           |
| [Futurism](https://www.moma.org/collection/terms/futurism)                                                                                      | 1909–1916, Italy         | ✅               | Some           |
| [Orphism](https://www.moma.org/collection/terms/orphism)                                                                                        | 1912–1914, Paris         | ⬜               | Some           |
| [Rayonism](https://www.moma.org/collection/terms/rayonism)                                                                                      | 1912–1914, Russia        | ⬜               | No             |
| [Vorticism](https://www.moma.org/collection/terms/vorticism)                                                                                    | 1914–1915, Britain       | ⬜               | Some           |
| [Suprematism](https://www.moma.org/collection/terms/suprematism)                                                                                | 1915–1920s, Russia       | ✅               | Some           |

### Between the wars

| Movement                                                                                                                            | Era                                | AI MoMA           | Public domain? |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------- | -------------- |
| [Dada](https://www.moma.org/collection/terms/dada)                                                                                  | 1916–1924                          | ✅                | Some           |
| [Merz](https://www.moma.org/collection/terms/merz)                                                                                  | 1919–1948, Schwitters              | 🟡 Dada           | Yes            |
| [de Stijl](https://www.moma.org/collection/terms/de-stijl) / [Neo-Plasticism](https://www.moma.org/collection/terms/neo-plasticism) | 1917–1931                          | ✅                | Some           |
| [Constructivism](https://www.moma.org/collection/terms/constructivism)                                                              | 1915–1930s                         | ✅                | Some           |
| [Bauhaus](https://www.moma.org/collection/terms/bauhaus)                                                                            | 1919–1933                          | ✅                | Some           |
| [Return to order (rappel à l'ordre)](https://www.moma.org/collection/terms/return-to-order-rappel-a-lordre)                         | 1918–1930s                         | ⬜                | Some           |
| [Neue Sachlichkeit (New Objectivity)](https://www.moma.org/collection/terms/neue-sachlichkeit-new-objectivity)                      | 1920s, Germany                     | ⬜                | No             |
| [Surrealism](https://www.moma.org/collection/terms/surrealism)                                                                      | 1924–1940s                         | ✅                | Some           |
| [Mexican Muralism](https://www.moma.org/collection/terms/mexican-muralism)                                                          | 1920s–1950s                        | ⬜                | Some           |
| [Harlem Renaissance](https://www.moma.org/collection/terms/harlem-renaissance)                                                      | 1920s–1930s                        | ⬜                | No             |
| [Indigenism](https://www.moma.org/collection/terms/indigenism)                                                                      | 1920s–1940s, Latin America         | ⬜                | Some           |
| [Circle and Square](https://www.moma.org/collection/terms/circle-and-square)                                                        | 1929–1930, Paris                   | ⬜                | Some           |
| [Concrete art](https://www.moma.org/collection/terms/concrete-art)                                                                  | 1930–                              | ⬜                | Some           |
| [Geometric abstraction](https://www.moma.org/collection/terms/geometric-abstraction)                                                | 1910s–                             | 🟡 several rooms  | Some           |
| [International Style](https://www.moma.org/collection/terms/international-style)                                                    | 1920s–1930s, architecture          | ⬜                | No             |
| [Social Realism](https://www.moma.org/collection/terms/social-realism)                                                              | 1930s                              | ⬜                | No             |
| [Degenerate art](https://www.moma.org/collection/terms/degenerate-art)                                                              | 1937, a Nazi label, not a movement | ⬜ a history room | Some           |

### After World War II

| Movement                                                                                                                                                          | Era                         | AI MoMA                          | Public domain? |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------- | -------------- |
| [Abstract Expressionism](https://www.moma.org/collection/terms/abstract-expressionism) / [New York School](https://www.moma.org/collection/terms/new-york-school) | 1940s–1950s                 | ✅                               | No             |
| [Action painting](https://www.moma.org/collection/terms/action-painting) / [Color Field painting](https://www.moma.org/collection/terms/color-field-painting)     | 1940s–1960s                 | 🟡 Abstract Expressionism        | No             |
| [CoBrA](https://www.moma.org/collection/terms/cobra)                                                                                                              | 1948–1951                   | ⬜                               | No             |
| [Arte concreto (Brazilian Concrete art)](https://www.moma.org/collection/terms/brazilian-concrete-art-arte-concreto)                                              | 1950s, Brazil               | ⬜                               | No             |
| [Neo-concrete art](https://www.moma.org/collection/terms/neo-concrete-art)                                                                                        | 1959–1961, Brazil           | ⬜                               | No             |
| [Good Design](https://www.moma.org/collection/terms/good-design)                                                                                                  | 1950–1955, MoMA exhibitions | ⬜                               | No             |
| [Brutalist Architecture](https://www.moma.org/collection/terms/brutalist-architecture)                                                                            | 1950s–1970s                 | ⬜                               | No             |
| [Happenings](https://www.moma.org/collection/terms/happenings)                                                                                                    | late 1950s–1960s            | ⬜                               | No             |
| [Pop art](https://www.moma.org/collection/terms/pop-art)                                                                                                          | 1950s–1960s                 | ✅                               | No             |
| [Op art](https://www.moma.org/collection/terms/op-art) / [Kinetic art](https://www.moma.org/collection/terms/kinetic-art)                                         | 1950s–1960s                 | ✅                               | No             |
| [Fluxus](https://www.moma.org/collection/terms/fluxus)                                                                                                            | 1960s–1970s                 | ⬜                               | No             |
| [Minimalism](https://www.moma.org/collection/terms/minimalism)                                                                                                    | 1960s                       | ✅                               | No             |
| [Conceptual art](https://www.moma.org/collection/terms/conceptual-art)                                                                                            | 1960s–                      | ⬜                               | No             |
| [Metabolist architecture](https://www.moma.org/collection/terms/metabolist-architecture)                                                                          | 1960s, Japan                | ⬜                               | No             |
| [Mail art](https://www.moma.org/collection/terms/mail-art)                                                                                                        | 1960s–                      | ⬜                               | No             |
| [Black Arts movement](https://www.moma.org/collection/terms/black-arts-movement)                                                                                  | 1965–1975                   | ⬜                               | No             |
| [Arte Povera](https://www.moma.org/collection/terms/arte-povera)                                                                                                  | 1967–1970s, Italy           | ⬜                               | No             |
| [Radical Architecture](https://www.moma.org/collection/terms/radical-architecture)                                                                                | 1960s–1970s, Italy          | ⬜                               | No             |
| [Feminist art](https://www.moma.org/collection/terms/feminist-art)                                                                                                | late 1960s–                 | ⬜                               | No             |
| [Institutional critique](https://www.moma.org/collection/terms/institutional-critique)                                                                            | late 1960s–                 | ⬜                               | No             |
| [Earthwork](https://www.moma.org/collection/terms/earthwork) (Land Art)                                                                                           | late 1960s–1970s            | ⬜                               | No             |
| [Guerrilla television](https://www.moma.org/collection/terms/guerrilla-television)                                                                                | 1970s                       | ⬜                               | No             |
| [New Topographics](https://www.moma.org/collection/terms/new-topographics)                                                                                        | 1975, photography           | ⬜                               | No             |
| [Pictures Generation](https://www.moma.org/collection/terms/pictures-generation)                                                                                  | 1970s–1980s                 | ⬜                               | No             |
| [Postmodernism](https://www.moma.org/collection/terms/postmodernism)                                                                                              | 1970s–                      | ⬜                               | No             |
| [AIDS activism](https://www.moma.org/collection/terms/aids-activism)                                                                                              | 1980s–1990s                 | ⬜                               | No             |
| [Young British Artists](https://www.moma.org/collection/terms/young-british-artists)                                                                              | 1990s                       | ⬜                               | No             |
| [Relational aesthetics](https://www.moma.org/collection/terms/relational-aesthetics)                                                                              | 1990s                       | ⬜                               | No             |
| [Afrofuturism](https://www.moma.org/collection/terms/afrofuturism)                                                                                                | term coined 1993            | ⬜                               | No             |
| [Critical Design](https://www.moma.org/collection/terms/critical-design)                                                                                          | 1990s–                      | ⬜                               | No             |
| [Participatory art](https://www.moma.org/collection/terms/participatory-art)                                                                                      | 1960s–                      | ⬜ Community Gallery fits        | No             |
| [Generative art](https://www.moma.org/collection/terms/generative-art)                                                                                            | 1960s–                      | 🟡 Studio recipes are generative | No             |
| [On-chain art](https://www.moma.org/collection/terms/on-chain-art) / [Non-fungible token (NFT)](https://www.moma.org/collection/terms/non-fungible-token-nft)     | 2010s–                      | ⬜                               | No             |

### Groups, schools, places and programs

Good for tours, timelines and small focus rooms:
[Artist collective](https://www.moma.org/collection/terms/artist-collective),
[Black Mountain College](https://www.moma.org/collection/terms/black-mountain-college),
[Coenties Slip](https://www.moma.org/collection/terms/coenties-slip),
[Farm Security Administration (FSA)](https://www.moma.org/collection/terms/farm-security-administration-fsa),
[The Kamoinge Workshop](https://www.moma.org/collection/terms/the-kamoinge-workshop),
[Progressive Art Studio](https://www.moma.org/collection/terms/progressive-art-studio),
[South Side Community Arts Center](https://www.moma.org/collection/terms/south-side-community-arts-center),
[Spiral](https://www.moma.org/collection/terms/spiral),
[Works Progress Administration (WPA)](https://www.moma.org/collection/terms/works-progress-administration-wpa).

### Broad ideas and labels

Useful for learn pages and wall texts rather than rooms of their own:
Abstraction, Appropriation, Automatism, Avant-garde, Biomorphic, Classicism, Contemporary art,
Figurative, Folk art, Gestural, Manifesto, Modern art, Organic, Popular culture,
Primitive art (a historical term; use it critically), Propaganda, Self-taught artist.

### Movements MoMA collects that its glossary leaves out

These names come from general art history, not from MoMA's glossary. Check each against
[moma.org/collection](https://www.moma.org/collection/) before building a room:
Art Deco, Vienna Secession and Wiener Werkstätte, Purism, Metaphysical painting, Precisionism,
Art Brut, Tachisme and Lyrical Abstraction, Gutai, Nouveau Réalisme, Zero, Neo-Dada,
Hard-edge painting, Post-Minimalism and Process art, Light and Space, Video art,
Photorealism, Pattern and Decoration, Neo-Expressionism, Graffiti and street art,
Net art, Post-Internet art.

## 4. Techniques and materials, by medium

The number after a name is how many records mention it in `Medium` (a rough keyword count).
Movements list their methods in `techniques`, and the Studio recipes in
`src/lib/studio-art/styles.ts` imitate methods. This list is what's still out there to try.

**Painting:** Oil paint (2,386), Acrylic paint (1,157), Tempera (273), Gouache (2,904),
Watercolor (3,786), Enamel paint (194), Alkyd enamel paint, Fresco, Encaustic (24),
Spray paint (259), Impasto, Glaze, Stain, Allover painting, Monochrome, Plein Air, Palette knife,
Lining brush, Mural, Diptych, Triptych. Materials and conservation: Canvas, Cotton duck,
Commercially primed canvas, Unprimed canvas, Unsized canvas, Unstretched canvas,
Lining canvas, Tacking margins, Binder, Vehicle, Pigment, Linseed Oil, Lead white,
Calcium white, Animal skin glue, Varnish, Coating, Solvent, Viscosity,
Alligator skinning, Turpentine burn, Period frames, Raking light.

**Drawing:** Pencil (26,102), Ink (11,619), Charcoal (1,191), Graphite (946), Crayon (1,303),
Pastel (581), Colored pencil, Sketch, Calligraphy, Pictograph, Frottage, Decalcomania,
Exquisite corpse.

**Printmaking:** Lithography (17,127), Etching (9,757), Aquatint (5,322), Offset (5,201),
Drypoint (5,154), Engraving (4,146), Letterpress (4,093), Woodcut (3,222),
Screenprint (2,875), Silkscreen (586), Linoleum cut (964), Pochoir (688), Stencil (583),
Photolithograph (534), Monotype (238), Mezzotint (104), Intaglio, Relief print,
Chine collé, Embossing, Collotype, Photogravure, Diazotype, Photostat, Xerox transfer,
Ben-Day dots, Edition, Proof, Printer, Portfolio.

**Photography:** Gelatin silver print (22,140; developing-out paper and printing-out paper),
Albumen silver print (6,035), Chromogenic print (2,688), Inkjet print (1,603),
Platinum print (649), Dye transfer print (388), Salted paper print (230), Polaroid (126),
Gum bichromate (59), Daguerreotype (48), Cyanotype (32), Photogram (24), Ambrotype (19),
Tintype (14), Calotype, Palladium print, Rayograph, Cameraless photography,
Cartes-de-visite, Stereograph, Contact print, Double exposure, Exposure, Emulsion,
Cropping, Medium format camera, Photomontage, Photo essay, Photobook, Photojournalism,
Documentary photography, Street photography, Studio photography,
Commercial photography, Vernacular photography.

**Film and moving image:** 16mm (355), 35mm (97), Super 8 (14), Animation, Actuality,
Documentary film, Direct Cinema, B movie, Melodrama, Vaudeville, Short, Montage,
Intertitle, Film still, Wide shot, Special effect, Sound effects, Sound-on-disc,
Sound-on-film, Celluloid, Cinematographer, Filmmaker. Early machines, good for the
Perception Lab: Black Maria, Kinetograph, Kinetoscope, Cinématographe, Zoetrope,
Praxinoscope, Cyclorama, Pepper's Ghost, Hologram.

**Sculpture and objects:** Wood (3,272), Glass (1,295), Steel (1,155), Aluminum (653),
Bronze (313), Resin (214), Plaster (173), Wax (136), Ceramic (126), Fiberglass (106),
Marble (55), Neon (20), Cast, Patina, Relief, Assemblage, Combine, Readymade,
Found object, Mobile, Shadow box, Papier mâché, Multiple, Latticework, Lead, Urethane, Plastic.

**Collage and mixed media:** Collage (1,500), cut-and-pasted (2,361), Merz,
Photomontage, Artist's book, Zine, Comic, Postcards, Ephemera.

**Design and architecture:** Architectural drawing, Plan drawing, Elevation drawing,
Section drawing, Architectural model, Architectural fragment, Model, Prototype,
Prefabrication, Mass production, Industrial design, Product design, Graphic design,
Typography, Font, Interior design, Furniture and interiors, Textile, Skyscraper,
Built environment.

**Media, performance and digital:** Video (2,657), Sound (2,213), Digital (1,506),
Software (71), Audio, Soundscape, Performance, Media and performance art, Choreography,
Dance, Improvisation, Score, Ritual, Installation, Coding/programming, Data visualization,
Interactive design, Interface, Games, Website, Generative art, Blockchain, Metaverse, web3.

## 5. Subjects and themes

For exhibitions that cut across movements:
Cityscape, Landscape, Portrait, Self-portrait, Still life, Industrialization, Urbanization,
Migration and movement, The Great Migration, African diaspora, Diaspora,
Maps, borders, and networks, Investigating identity, Popular culture.

## 6. Looking vocabulary

For learn pages, guided looking and the Perception Lab:
Chroma, Hue, Saturation, Tint, Shade, Tone, Contrast, Opaque, Translucent, Transparent,
Primary and secondary colors, Munsell color system, Rods and cones, Form, Facture,
Figure/ground relationship, Perspective, Pictorial, Pictorial space, Velocity, Oeuvre,
Commission, Art critic.

---

## Good first picks

1. **A Photography floor.** About 34,000 MoMA photographs, and CMA has many CC0
   19th-century prints (albumen, salted paper, daguerreotype). It only needs the `image` source.
2. **A `book` source with a page-turning viewer.** Covers illustrated books, notebooks,
   periodicals, portfolios and photobooks, about 31,000 records in all.
3. **`model3d` and `room3d` viewers.** This unlocks Sculpture, Design, Architecture models,
   Multiples and Fashion.
4. **A `video` source and a dark projection room.** Covers Video, Film, and AI video generation later.
5. **Symbolism, Arts and Crafts, Pictorialism, Orphism.** Mostly public-domain movements with
   rooms still missing.
6. **Perception Lab stations** for the early optical machines: zoetrope, praxinoscope,
   stereograph, Pepper's Ghost.
