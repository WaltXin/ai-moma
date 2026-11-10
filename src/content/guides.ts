import type { Guides } from "@/lib/museum/guides";

/**
 * Audio-guide scripts: what to look at in a work, how it was made, and why it
 * matters, in every guide language. `pnpm guides:voice` reads each one aloud
 * once (Cartesia) into `public/guides/<lang>/<id>.mp3`; visitors play the file,
 * so listening never calls a voice service.
 *
 * Written to be heard: short sentences, no abbreviations or symbols. Only
 * well-established facts. Keyed by artwork id.
 */
export const guides: Guides = {
  "aic-27992": {
    en: "Start with the woman on the right, in profile, holding a parasol. Look down at her feet: she has a monkey on a leash. Now let your eye travel left, across a Sunday crowd on an island in the Seine, at the edge of Paris. People sit, stroll, fish and nap, yet hardly anyone moves. They stand like figures on an ancient frieze, and in the middle a little girl in white looks straight back at you. Step closer and the grass breaks apart into thousands of small dots. Georges Seurat did not mix his colours on the palette. He placed touches of pure colour side by side, orange beside blue, yellow beside violet, and trusted your eye to blend them from a distance. He had studied the science of colour, and he wanted painting to be as precise as an experiment. He was in his mid-twenties, and the canvas is nearly three metres wide. He spent two years on it, making dozens of drawings and oil sketches of the island. When it was shown at the last Impressionist exhibition in 1886, it looked like a manifesto for a new way of painting. A few years later he added the border of dots around the edge. Walk up close, then step back, and watch the dots turn back into a summer afternoon.",
    fr: "Commencez par la femme à droite, de profil, son ombrelle à la main. Regardez à ses pieds : elle tient un singe en laisse. Laissez ensuite votre regard glisser vers la gauche, à travers la foule d'un dimanche sur une île de la Seine, aux portes de Paris. On s'assoit, on se promène, on pêche, on somnole, et pourtant presque personne ne bouge. Les personnages se tiennent comme sur une frise antique, et au centre, une petite fille en blanc vous regarde droit dans les yeux. Approchez-vous : l'herbe se défait en milliers de petits points. Georges Seurat ne mélangeait pas ses couleurs sur la palette. Il posait des touches de couleur pure côte à côte, l'orange près du bleu, le jaune près du violet, et laissait votre œil les fondre à distance. Il avait étudié la science des couleurs et voulait une peinture aussi rigoureuse qu'une expérience. Il avait environ vingt-cinq ans, et la toile mesure près de trois mètres de large. Il y a consacré deux ans, avec des dizaines de dessins et d'esquisses à l'huile faits sur l'île. Présentée en 1886 à la dernière exposition impressionniste, « Un dimanche après-midi à l'Île de la Grande Jatte » fit l'effet d'un manifeste. Quelques années plus tard, il ajouta la bordure de points tout autour. Approchez-vous, puis reculez, et regardez les points redevenir un après-midi d'été.",
    zh: "先看画面右边，那位撑着阳伞、侧身站立的女士。再往她脚边看，她用绳子牵着一只小猴子。然后让目光慢慢向左移动，这是巴黎城边、塞纳河中一座小岛上的星期天。人们坐着、散步、钓鱼、打盹，可几乎没有一个人在动。他们像古代浮雕上的人物一样静止，而画面正中，一个穿白衣的小女孩正直直地望着你。走近一点看，草地会散开成成千上万个小色点。修拉不在调色板上调色，而是把纯色的小点并排点在画布上，橙色挨着蓝色，黄色挨着紫色，让你的眼睛在远处把它们混合起来。他研究过色彩科学，希望绘画能像实验一样精确。这就是点彩画法。画这幅画时，修拉只有二十多岁，画布将近三米宽。他花了两年时间，在岛上画了几十张素描和油画小稿。1886年，《大碗岛的星期天下午》在最后一届印象派画展上展出，像一份新绘画的宣言。几年后，他又在画的四周加上了一圈色点边框。请先走近看，再退后几步，看那些色点重新变回一个夏日的午后。",
  },
};
