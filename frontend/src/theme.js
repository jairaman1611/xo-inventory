/* ── Cotton Candy · iOS-inspired pastel + vibrant ─────────────────────────── */
export const T = {
  /* backgrounds */
  bg:        "#FFF0F7",
  surface:   "#FFF5FA",
  card:      "#FFFFFF",
  cardHi:    "#FFF0F9",
  glass:     "rgba(255,255,255,0.72)",

  /* borders */
  border:    "rgba(255,55,95,0.13)",
  borderB:   "rgba(255,55,95,0.28)",

  /* brand */
  primary:   "#FF375F",    /* iOS rose */
  primarySoft:"#FFD6E7",
  accent:    "#636EFA",    /* periwinkle */
  accentSoft:"#E0E2FF",
  green:     "#30D158",    /* iOS green */
  greenSoft: "#D4F5E0",
  amber:     "#FF9F0A",    /* iOS amber */
  amberSoft: "#FFEACC",
  purple:    "#BF5AF2",    /* iOS purple */
  purpleSoft:"#EDE0FF",
  teal:      "#5AC8FA",    /* iOS sky */
  tealSoft:  "#D4F0FF",
  red:       "#FF3B30",
  redSoft:   "#FFD6D4",

  /* text */
  text:      "#3D001A",
  textMid:   "#8C5070",
  textDim:   "#C4A0B5",

  /* gradients */
  gradNav:   "linear-gradient(135deg, #FF375F 0%, #FF6B9D 100%)",
  gradPrimary:"linear-gradient(135deg, #FF375F 0%, #FF6B9D 50%, #FF9F0A 100%)",
  gradAccent:"linear-gradient(135deg, #636EFA 0%, #A78BFA 100%)",
  gradCard:  "linear-gradient(145deg, #FFFFFF 0%, #FFF5FA 100%)",
  gradGreen: "linear-gradient(135deg, #30D158 0%, #34C759 100%)",
  gradAmber: "linear-gradient(135deg, #FF9F0A 0%, #FFD60A 100%)",

  /* chart colours */
  chart: ["#FF375F","#636EFA","#30D158","#FF9F0A","#BF5AF2","#5AC8FA","#FF6B9D","#A78BFA"],
};

export const STATUS = {
  Running:   T.green,
  Halted:    T.red,
  Paused:    T.amber,
  Suspended: T.purple,
  Migrating: T.teal,
  Online:    T.green,
  Offline:   T.red,
  Unknown:   T.textDim,
};

export const STATUS_SOFT = {
  Running:   T.greenSoft,
  Halted:    T.redSoft,
  Paused:    T.amberSoft,
  Suspended: T.purpleSoft,
  Migrating: T.tealSoft,
  Online:    T.greenSoft,
  Offline:   T.redSoft,
  Unknown:   "#f5f5f5",
};
