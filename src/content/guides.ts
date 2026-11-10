import type { GuideSource, Guides } from "@/lib/museum/guides";

/**
 * Audio-guide scripts: what to look at in a work, how it was made, and why it
 * matters, in every guide language. Written to the standard in
 * `docs/AUDIO_GUIDES.md`. `pnpm guides:voice` reads each one aloud
 * once (Cartesia) into `public/guides/<lang>/<id>.mp3`; visitors play the file,
 * so listening never calls a voice service.
 *
 * Written to be heard: short sentences, no abbreviations or symbols. Only
 * facts from the sources listed for each work in `guideSources`. Keyed by
 * artwork id.
 */
export const guides: Guides = {
  "aic-27992": {
    en: "Start with the woman on the right, in profile, and look down at her feet: a monkey on a leash. Seurat added that monkey late, when he came back to the canvas two years after starting it. Now look left, across a Sunday crowd in a park on the Seine. People sit, stroll, fish and doze, yet almost nobody moves. Only one small girl in orange, just left of the couple on the right, is running. Why only her? Step closer and the grass breaks into dots. Seurat did not mix colours on his palette. He set touches of pure colour side by side, orange against blue, yellow against violet, and left your eye to mix them from a distance. He had read the colour scientists, and believed colour mixed in the eye looks more brilliant. He made many sketches first, and the canvas is more than three metres wide. He showed it in 1886, at the last Impressionist exhibition. These are modern Parisians of every age and class, yet Seurat wanted them as still as the figures on an ancient Greek frieze. The Impressionists caught a passing moment. Here a moment is built, dot by dot, and painters such as Paul Signac took up the method. Before you go, find the blue dots hidden in the shade of the grass, and the border of dots he painted around the edge a few years later.",
    fr: "Commencez par la femme à droite, de profil, et regardez à ses pieds : un singe tenu en laisse. Seurat a ajouté ce singe tardivement, en reprenant la toile deux ans après l'avoir commencée. Regardez maintenant vers la gauche, une foule du dimanche dans un parc au bord de la Seine. On s'assoit, on se promène, on pêche, on somnole, et pourtant presque personne ne bouge. Seule une petite fille en orange, juste à gauche du couple de droite, est en train de courir. Pourquoi elle seule ? Approchez-vous : l'herbe se défait en petits points. Seurat ne mélangeait pas ses couleurs sur la palette. Il posait des touches de couleur pure côte à côte, l'orange contre le bleu, le jaune contre le violet, et laissait votre œil les mêler à distance. Il avait lu les savants de la couleur, et pensait qu'une couleur mélangée dans l'œil paraît plus éclatante. Il a fait de nombreuses esquisses avant de se lancer, et la toile mesure plus de trois mètres de large. Il l'a présentée en 1886, à la dernière exposition impressionniste. Ce sont des Parisiens modernes, de tous âges et de toutes conditions, mais Seurat les voulait aussi immobiles que les figures d'une frise grecque antique. Les impressionnistes saisissaient un instant qui passe. Ici, l'instant est construit, point par point, et des peintres comme Paul Signac ont repris la méthode. Avant de partir, cherchez les points bleus cachés dans l'ombre de l'herbe, et la bordure de points qu'il a peinte autour de la toile quelques années plus tard.",
    zh: "先看画面右边那位侧身站立的女士，再往她脚边看：她用绳子牵着一只小猴子。这只猴子是后来才加上的，修拉开始画这幅画两年后，又回到画布前，添上了它。现在把目光移向左边，这是塞纳河边一座公园里的星期天。人们坐着、散步、钓鱼、打盹，可几乎没有一个人在动。只有一个穿橙色衣服的小女孩，就在右边那对男女的左侧，正在奔跑。为什么只有她在跑？走近一点，草地会散开成一个个小色点。修拉不在调色板上调色，而是把纯色的小笔触并排点在画布上，橙色挨着蓝色，黄色挨着紫色，让你的眼睛在远处把它们混合起来。他读过色彩科学家的著作，相信在眼睛里混合的颜色会更加明亮。动笔之前，他画了许多素描和油画小稿，最后的画布宽三米多。1886年，这幅画在最后一届印象派画展上展出。画中是各个年龄、各个阶层的现代巴黎人，修拉却要让他们像古希腊浮雕上的人物一样静穆。印象派捕捉转瞬即逝的一刻，而这里的一刻，是一点一点搭建起来的。后来，西涅克等画家也接过了这种方法。离开之前，再找两样东西：草地阴影里藏着的蓝色小点，还有几年后他在画的四周加上的一圈色点边框。",
  },
};

/** Where each script's facts come from. For a public-domain work, the holding museum's record first. */
export const guideSources: Record<string, GuideSource[]> = {
  "aic-27992": [
    {
      label: "Art Institute of Chicago: A Sunday on La Grande Jatte — 1884 (description, dimensions, exhibition history)",
      url: "https://www.artic.edu/artworks/27992",
      licence: "Description CC BY 4.0; other data CC0",
    },
    {
      label: "Wikidata: the painting (shown at the 8th and last Impressionist exhibition, 1886)",
      url: "https://www.wikidata.org/wiki/Q1044742",
      licence: "CC0",
    },
    {
      label: "AI MoMA: Neo-Impressionism (Seurat's colour theory, Signac and the method)",
      url: "/learn/neo-impressionism",
    },
    {
      label: "AI MoMA: Impressionism (catching passing light)",
      url: "/learn/impressionism",
    },
  ],
};
