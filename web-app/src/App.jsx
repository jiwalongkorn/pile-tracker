import { useState, useMemo, useEffect } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import * as XLSX from "xlsx";

// ============================================================
// ข้อมูล GRID คงเดิม (อ้างอิงตามแบบ ST-04 และ RFA-004)
// ============================================================
const ROWS_META = [
  { id: "A", type: "edge", dir: "LR" }, { id: "A'", type: "inter", dir: "RL" },
  { id: "B", type: "mid", dir: "LR" }, { id: "B'", type: "inter", dir: "RL" },
  { id: "C", type: "mid", dir: "LR" }, { id: "C'", type: "inter", dir: "RL" },
  { id: "D", type: "mid", dir: "LR" }, { id: "D'", type: "inter", dir: "RL" },
  { id: "E", type: "mid", dir: "LR" }, { id: "E'", type: "inter", dir: "RL" },
  { id: "F", type: "mid", dir: "LR" }, { id: "F'", type: "inter", dir: "RL" },
  { id: "G", type: "mid", dir: "LR" }, { id: "G'", type: "inter", dir: "RL" },
  { id: "H", type: "mid", dir: "LR" }, { id: "H'", type: "inter", dir: "RL" },
  { id: "I", type: "mid", dir: "LR" }, { id: "I'", type: "inter", dir: "RL" },
  { id: "J", type: "mid", dir: "LR" }, { id: "J'", type: "inter", dir: "RL" },
  { id: "K", type: "mid", dir: "LR" }, { id: "K'", type: "inter", dir: "RL" },
  { id: "L", type: "mid", dir: "LR" }, { id: "L'", type: "inter", dir: "RL" },
  { id: "M", type: "edge", dir: "LR" },
];

const COL_LABELS = [];
for (let c = 1; c <= 21; c++) {
  COL_LABELS.push(String(c));
  if (c < 21) COL_LABELS.push(`${c}.1`);
}

const GRID_DATA = {
  "A": [[1, 2], [3], [4, 5], [6], [7, 8], [9], [10, 11], [12], [13, 14], [15], [16, 17], [18], [19, 20], [21], [22, 23], [24], [25, 26], [27], [28, 29], [30], [31, 32], [33], [34, 35], [36], [37, 38], [39], [40, 41], [42], [43, 44], [45], [46, 47], [48], [49, 50], [51], [52, 53], [54], [55, 56], [57], [58, 59], [60], [61, 62]],
  "A'": [[103], [102], [101], [100], [99], [98], [97], [96], [95], [94], [93], [92], [91], [90], [89], [88], [87], [86], [85], [84], [83], [82], [81], [80], [79], [78], [77], [76], [75], [74], [73], [72], [71], [70], [69], [68], [67], [66], [65], [64], [63]],
  "B": [[104, 105], [106], [107], [108], [109], [110], [111], [112], [113], [114], [115], [116], [117], [118], [119], [120], [121, 122], [123], [124], [125], [126], [127], [128], [129], [130, 131], [132], [133], [134], [135], [136], [137], [138], [139], [140], [141], [142], [143], [144], [145], [146], [147, 148]],
  "B'": [[189], [188], [187], [186], [185], [184], [183], [182], [181], [180], [179], [178], [177], [176], [175], [174], [173], [172], [171], [170], [169], [168], [167], [166], [165], [164], [163], [162], [161], [160], [159], [158], [157], [156], [155], [154], [153], [152], [151], [150], [149]],
  "C": [[190, 191], [192], [193], [194], [195], [196], [197], [198], [199], [200], [201], [202], [203], [204], [205], [206], [207, 208], [209], [210], [211], [212], [213], [214], [215], [216, 217], [218], [219], [220], [221], [222], [223], [224], [225], [226], [227], [228], [229], [230], [231], [232], [233, 234]],
  "C'": [[275], [274], [273], [272], [271], [270], [269], [268], [267], [266], [265], [264], [263], [262], [261], [260], [259], [258], [257], [256], [255], [254], [253], [252], [251], [250], [249], [248], [247], [246], [245], [244], [243], [242], [241], [240], [239], [238], [237], [236], [235]],
  "D": [[276, 277], [278], [279], [280], [281], [282], [283], [284], [285], [286], [287], [288], [289], [290], [291], [292], [293, 294], [295], [296], [297], [298], [299], [300], [301], [302, 303], [304], [305], [306], [307], [308], [309], [310], [311], [312], [313], [314], [315], [316], [317], [318], [319, 320]],
  "D'": [[361], [360], [359], [358], [357], [356], [355], [354], [353], [352], [351], [350], [349], [348], [347], [346], [345], [344], [343], [342], [341], [340], [339], [338], [337], [336], [335], [334], [333], [332], [331], [330], [329], [328], [327], [326], [325], [324], [323], [322], [321]],
  "E": [[362, 363], [364], [365], [366], [367], [368], [369], [370], [371], [372], [373], [374], [375], [376], [377], [378], [379, 380], [381], [382], [383], [384], [385], [386], [387], [388, 389], [390], [391], [392], [393], [394], [395], [396], [397], [398], [399], [400], [401], [402], [403], [404], [405, 406]],
  "E'": [[447], [446], [445], [444], [443], [442], [441], [440], [439], [438], [437], [436], [435], [434], [433], [432], [431], [430], [429], [428], [427], [426], [425], [424], [423], [422], [421], [420], [419], [418], [417], [416], [415], [414], [413], [412], [411], [410], [409], [408], [407]],
  "F": [[448, 449], [450], [451], [452], [453], [454], [455], [456], [457], [458], [459], [460], [461], [462], [463], [464], [465, 466], [467], [468], [469], [470], [471], [472], [473], [474, 475], [476], [477], [478], [479], [480], [481], [482], [483], [484], [485], [486], [487], [488], [489], [490], [491, 492]],
  "F'": [[533], [532], [531], [530], [529], [528], [527], [526], [525], [524], [523], [522], [521], [520], [519], [518], [517], [516], [515], [514], [513], [512], [511], [510], [509], [508], [507], [506], [505], [504], [503], [502], [501], [500], [499], [498], [497], [496], [495], [494], [493]],
  "G": [[534, 535], [536], [537], [538], [539], [540], [541], [542], [543], [544], [545], [546], [547], [548], [549], [550], [551, 552], [553], [554], [555], [556], [557], [558], [559], [560, 561], [562], [563], [564], [565], [566], [567], [568], [569], [570], [571], [572], [573], [574], [575], [576], [577, 578]],
  "G'": [[619], [618], [617], [616], [615], [614], [613], [612], [611], [610], [609], [608], [607], [606], [605], [604], [603], [602], [601], [600], [599], [598], [597], [596], [595], [594], [593], [592], [591], [590], [589], [588], [587], [586], [585], [584], [583], [582], [581], [580], [579]],
  "H": [[620, 621], [622], [623], [624], [625], [626], [627], [628], [629], [630], [631], [632], [633], [634], [635], [636], [637, 638], [639], [640], [641], [642], [643], [644], [645], [646, 647], [648], [649], [650], [651], [652], [653], [654], [655], [656], [657], [658], [659], [660], [661], [662], [663, 664]],
  "H'": [[705], [704], [703], [702], [701], [700], [699], [698], [697], [696], [695], [694], [693], [692], [691], [690], [689], [688], [687], [686], [685], [684], [683], [682], [681], [680], [679], [678], [677], [676], [675], [674], [673], [672], [671], [670], [669], [668], [667], [666], [665]],
  "I": [[706, 707], [708], [709], [710], [711], [712], [713], [714], [715], [716], [717], [718], [719], [720], [721], [722], [723, 724], [725], [726], [727], [728], [729], [730], [731], [732, 733], [734], [735], [736], [737], [738], [739], [740], [741], [742], [743], [744], [745], [746], [747], [748], [749, 750]],
  "I'": [[791], [790], [789], [788], [787], [786], [785], [784], [783], [782], [781], [780], [779], [778], [777], [776], [775], [774], [773], [772], [771], [770], [769], [768], [767], [766], [765], [764], [763], [762], [761], [760], [759], [758], [757], [756], [755], [754], [753], [752], [751]],
  "J": [[792, 793], [794], [795], [796], [797], [798], [799], [800], [801], [802], [803], [804], [805], [806], [807], [808], [809, 810], [811], [812], [813], [814], [815], [816], [817], [818, 819], [820], [821], [822], [823], [824], [825], [826], [827], [828], [829], [830], [831], [832], [833], [834], [835, 836]],
  "J'": [[877], [876], [875], [874], [873], [872], [871], [870], [869], [868], [867], [866], [865], [864], [863], [862], [861], [860], [859], [858], [857], [856], [855], [854], [853], [852], [851], [850], [849], [848], [847], [846], [845], [844], [843], [842], [841], [840], [839], [838], [837]],
  "K": [[878, 879], [880], [881], [882], [883], [884], [885], [886], [887], [888], [889], [890], [891], [892], [893], [894], [895, 896], [897], [898], [899], [900], [901], [902], [903], [904, 905], [906], [907], [908], [909], [910], [911], [912], [913], [914], [915], [916], [917], [918], [919], [920], [921, 922]],
  "K'": [[963], [962], [961], [960], [959], [958], [957], [956], [955], [954], [953], [952], [951], [950], [949], [948], [947], [946], [945], [944], [943], [942], [941], [940], [939], [938], [937], [936], [935], [934], [933], [932], [931], [930], [929], [928], [927], [926], [925], [924], [923]],
  "L": [[964, 965], [966], [967], [968], [969], [970], [971], [972], [973], [974], [975], [976], [977], [978], [979], [980], [981, 982], [983], [984], [985], [986], [987], [988], [989], [990, 991], [992], [993], [994], [995], [996], [997], [998], [999], [1000], [1001], [1002], [1003], [1004], [1005], [1006], [1007, 1008]],
  "L'": [[1049], [1048], [1047], [1046], [1045], [1044], [1043], [1042], [1041], [1040], [1039], [1038], [1037], [1036], [1035], [1034], [1033], [1032], [1031], [1030], [1029], [1028], [1027], [1026], [1025], [1024], [1023], [1022], [1021], [1020], [1019], [1018], [1017], [1016], [1015], [1014], [1013], [1012], [1011], [1010], [1009]],
  "M": [[1050, 1051], [1052], [1053, 1054], [1055], [1056, 1057], [1058], [1059, 1060], [1061], [1062, 1063], [1064], [1065, 1066], [1067], [1068, 1069], [1070], [1071, 1072], [1073], [1074, 1075], [1076], [1077, 1078], [1079], [1080, 1081], [1082], [1083, 1084], [1085], [1086, 1087], [1088], [1089, 1090], [1091], [1092, 1093], [1094], [1095, 1096], [1097], [1098, 1099], [1100], [1101, 1102], [1103], [1104, 1105], [1106], [1107, 1108], [1109], [1110, 1111]],
};

const TOTAL = 1111;
const ST = { P: "p", D: "d", X: "x" };
const ST_TH = { p: "ยังไม่กด", d: "กดแล้ว", x: "มีปัญหา" };
const ST_BG = { p: "#141620", d: "#0b2117", x: "#210b0b" };
const ST_BD = { p: "#272c42", d: "#16703a", x: "#8c1c1c" };
const ST_DOT = { p: "#303654", d: "#22c55e", x: "#ef4444" };

// ── สีแยกประเภทปัญหา (4 สี) ──
const ISSUE_COLORS = {
  red:    { key: "red",    label: "เพลทเอียง/ไม่ได้ฉาก", dot: "#ef4444", bg: "#210b0b", bd: "#8c1c1c" },
  orange: { key: "orange", label: "เสาเข็มแตก/ชำรุด",     dot: "#f97316", bg: "#211505", bd: "#9a4a0c" },
  yellow: { key: "yellow", label: "ความลึกไม่ถึงเป้า",    dot: "#eab308", bg: "#211d05", bd: "#8a6d0a" },
  blue:   { key: "blue",   label: "อื่นๆ",               dot: "#3b82f6", bg: "#0b1121", bd: "#1e4a8c" },
};
const ISSUE_COLOR_KEYS = Object.keys(ISSUE_COLORS);
const DEFAULT_ISSUE_COLOR = "red";

// ข้อมูลเริ่มต้นให้ตรงกับหน้างานจริง (เอาช่องระยะส่งออกแล้ว)
function initPiles() {
  const m = {};
  for (let i = 1; i <= TOTAL; i++) {
    m[i] = {
      id: i, s: ST.P, issueColor: "",
      date: "", startTime: "", endTime: "",
      pileTip: "", pileTop: "", pressure: "", note: ""
    };
  }
  return m;
}

function findCellByPileId(targetId) {
  const numId = parseInt(targetId);
  for (const rowId of Object.keys(GRID_DATA)) {
    const row = GRID_DATA[rowId];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      if (row[colIdx].includes(numId)) return { rowId, colIdx, pileIds: row[colIdx] };
    }
  }
  return null;
}

export default function App() {
  const [piles, setPiles] = useState(initPiles());
  const [selPile, setSelPile] = useState(null);
  const [selCell, setSelCell] = useState(null);
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState("all");
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [cellIssueMenu, setCellIssueMenu] = useState(false);

  // ── ฟังก์ชันหาแถว/คอลัมน์ของเสาเข็ม ──
  const findRowColForPile = (pileId) => {
    const numId = parseInt(pileId);
    for (const rowId of Object.keys(GRID_DATA)) {
      const row = GRID_DATA[rowId];
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        if (row[colIdx].includes(numId)) return { row: rowId, col: COL_LABELS[colIdx] };
      }
    }
    return { row: "-", col: "-" };
  };

  // ── Export ข้อมูลเสาเข็มเป็น Excel ──
  const exportToExcel = () => {
    const statusMap = { p: "ยังไม่กด", d: "กดแล้ว", x: "มีปัญหา" };
    const rows = [];
    for (let i = 1; i <= TOTAL; i++) {
      const p = piles[i];
      const pos = findRowColForPile(i);
      const issueLabel = p.s === ST.X && p.issueColor ? (ISSUE_COLORS[p.issueColor]?.label || "") : "";
      rows.push({
        "เบอร์เสาเข็ม": i,
        "แถว": pos.row,
        "คอลัมน์": pos.col,
        "สถานะ": statusMap[p.s] || p.s,
        "ประเภทปัญหา": issueLabel,
        "วันที่": p.date || "",
        "เวลาเริ่ม": p.startTime || "",
        "เวลาจบ": p.endTime || "",
        "Pile Tip (ม.)": p.pileTip || "",
        "Pile Top (ม.)": p.pileTop || "",
        "Pressure": p.pressure || "",
        "หมายเหตุ": p.note || "",
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 }, { wch: 6 }, { wch: 8 }, { wch: 12 }, { wch: 22 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pile Data");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `PileTracker_${today}.xlsx`);
  };

  const docRef = doc(db, "projects", "pile-st04");

  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setPiles(prev => ({ ...prev, ...docSnap.data() }));
      } else {
        setDoc(docRef, initPiles());
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const vals = Object.values(piles);
    const done = vals.filter(p => p.s === ST.D).length;
    const issue = vals.filter(p => p.s === ST.X).length;
    return { done, issue, pending: TOTAL - done - issue, pct: ((done / TOTAL) * 100).toFixed(1) };
  }, [piles]);

  const openPile = (id) => {
    const p = piles[id];
    setSelPile(id);
    setSelCell(null);
    setForm({
      s: p.s,
      issueColor: p.issueColor || (p.s === ST.X ? DEFAULT_ISSUE_COLOR : ""),
      date: p.date || "",
      startTime: p.startTime || "",
      endTime: p.endTime || "",
      pileTip: p.pileTip || "",
      pileTop: p.pileTop || "",
      pressure: p.pressure || "",
      note: p.note || ""
    });
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchQ(val);
    if (!val) {
      setSelCell(null); setSelPile(null); return;
    }
    const foundCell = findCellByPileId(val);
    if (foundCell) {
      setSelCell(foundCell); openPile(val);
    }
  };

  const closePanel = () => {
    setSelCell(null);
    setSelPile(null);
    setSearchQ("");
  };

  const savePile = async () => {
    if (!selPile) return;
    const updatedPile = { ...piles[selPile], ...form, date: form.date || new Date().toISOString().slice(0, 10) };
    try {
      await updateDoc(docRef, { [selPile]: updatedPile });
      closePanel();
    } catch (error) {
      alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่");
    }
  };

  const markCell = async (ids, status, issueColor = "") => {
    const date = new Date().toISOString().slice(0, 10);
    const updates = {};
    ids.forEach(id => {
      updates[id] = { ...piles[id], s: status, date, issueColor: status === ST.X ? (issueColor || DEFAULT_ISSUE_COLOR) : "" };
    });
    try {
      await updateDoc(docRef, updates);
      setCellIssueMenu(false);
    } catch (error) { }
  };

  const f2IsHorizontal = (ci, rowType) => {
    if (ci === 0 || ci === 40) return true;
    if ((ci === 16 || ci === 24) && rowType === "mid") return true;
    return false;
  };

  const Dot = ({ id }) => {
    const p = piles[id];
    // filter: "all", "p", "d", "x", "x_red", "x_orange", "x_yellow", "x_blue"
    let dim = false;
    if (filter !== "all") {
      if (filter.startsWith("x_")) {
        const fc = filter.replace("x_", "");
        dim = !(p.s === ST.X && (p.issueColor || DEFAULT_ISSUE_COLOR) === fc);
      } else {
        dim = p.s !== filter;
      }
    }
    const isSel = selPile === id;
    const isSearched = searchQ && String(id) === searchQ;
    const sz = Math.round(12 * zoom);

    // ใช้สีตาม issueColor ถ้าสถานะ = มีปัญหา
    let dotColor = ST_DOT[p.s];
    let borderColor = p.s === ST.D ? "#16703a" : p.s === ST.X ? "#8c1c1c" : "#272c42";
    if (p.s === ST.X) {
      const ic = ISSUE_COLORS[p.issueColor] || ISSUE_COLORS[DEFAULT_ISSUE_COLOR];
      dotColor = ic.dot;
      borderColor = ic.bd;
    }

    return (
      <div
        title={`#${id}`}
        onClick={e => { e.stopPropagation(); openPile(id); }}
        style={{
          width: sz, height: sz, borderRadius: "50%", flexShrink: 0,
          background: dotColor,
          border: `1px solid ${isSel || isSearched ? "#fbbf24" : borderColor}`,
          boxShadow: isSearched ? `0 0 10px 4px #fbbf24` : isSel ? `0 0 0 2px #fbbf24` : p.s === ST.D ? "0 0 3px rgba(34,197,94,0.5)" : "none",
          opacity: dim ? 0.1 : 1,
          cursor: "pointer",
          transition: "transform .08s",
          zIndex: isSel || isSearched ? 10 : 1, position: "relative",
          animation: isSearched ? "glowPulse 1.5s infinite alternate" : "none"
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.7)"; e.currentTarget.style.zIndex = 8; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.zIndex = isSel ? 10 : 1; }}
      />
    );
  };

  const Cell = ({ rowId, colIdx, pileIds, rowType }) => {
    const isF2 = pileIds.length === 2;
    const horiz = f2IsHorizontal(colIdx, rowType);
    const isMainRow = rowType !== "inter";
    const isMainColumn = colIdx % 2 === 0;
    const isSel = selCell?.rowId === rowId && selCell?.colIdx === colIdx;

    const dotSz = Math.round(12 * zoom);
    const gap = Math.round(4 * zoom);
    const pad = Math.round(12 * zoom);

    const cellW = isF2 ? (horiz ? dotSz * 2 + gap + pad * 2 : dotSz + pad * 2) : dotSz + pad * 2;
    const cellH = isF2 ? (horiz ? dotSz + pad * 2 : dotSz * 2 + gap + pad * 2) : dotSz + pad * 2;

    return (
      <div
        title={`${rowId}-${COL_LABELS[colIdx]}: #${pileIds.join(", #")} ${isF2 ? (horiz ? "(F2,C1)" : "(F2,C2)") : ""}`}
        onClick={() => setSelCell(isSel ? null : { rowId, colIdx, pileIds })}
        style={{
          width: cellW, height: cellH, flexShrink: 0,
          display: "flex",
          alignItems: "center", justifyContent: "center",
          position: "relative", cursor: "pointer",
          background: isSel ? "rgba(251, 191, 36, 0.08)" : "transparent",
        }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 0, borderTop: isMainRow ? "1px solid #2a3045" : "1px dashed #141825", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 0, borderLeft: isMainColumn ? "1px solid #2a3045" : "1px dashed #141825", zIndex: 0 }} />

        <div style={{
          display: "flex", flexDirection: isF2 && !horiz ? "column" : "row", gap: isF2 ? gap : 0,
          background: "#080a10", padding: 3, borderRadius: 10, zIndex: 1
        }}>
          {pileIds.map(id => <Dot key={id} id={id} />)}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080a10", color: "#cdd1e0", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "'Sarabun',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #16703a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 15px" }} />
          กำลังซิงค์ข้อมูลเสาเข็ม...
        </div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isPanelOpen = selCell || selPile;

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", height: "100vh", background: "#080a10", color: "#cdd1e0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sarabun:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#0d0f18}
        ::-webkit-scrollbar-thumb{background:#1e2235;border-radius:3px}
        .pill{padding:6px 12px;border-radius:3px;border:1px solid #1e2235;background:transparent;color:#555d7a;cursor:pointer;font-size:12px;font-family:'IBM Plex Mono',monospace;transition:all .15s}
        .pill.on{background:#141825;color:#cdd1e0;border-color:#333c5a}
        .pill:hover{color:#cdd1e0}
        .inp{background:#080a10;border:1px solid #1e2235;border-radius:3px;color:#cdd1e0;padding:8px 10px;font-family:'IBM Plex Mono',monospace;font-size:16px;width:100%;outline:none}
        .inp:focus{border-color:#16703a}
        
        .main-content { flex: 1; display: flex; flex-direction: row; overflow: hidden; position: relative; }
        .controls-bar { border-bottom: 1px solid #111420; padding: 10px 16px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; flex-wrap: wrap; justify-content: space-between; }
        .backdrop { display: none; }
        .side-panel { width: 340px; border-left: 1px solid #111420; background: #060810; display: flex; flex-direction: column; flex-shrink: 0; z-index: 10; }
        .mobile-drag-handle { display: none; }
        
        @media (max-width: 768px) {
          .controls-bar { flex-direction: column; align-items: stretch; gap: 12px; }
          .stat-box { flex: 1; text-align: center; }
          .search-box { width: 100%; margin-left: 0 !important; margin-top: 8px; justify-content: space-between; }
          .backdrop { display: block; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); z-index: 998; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
          .backdrop.open { opacity: 1; pointer-events: auto; }
          .side-panel { position: absolute; bottom: 0; left: 0; right: 0; width: 100%; height: auto; max-height: 85vh; border-left: none; border-top: 1px solid #2a3045; border-radius: 20px 20px 0 0; box-shadow: 0 -10px 30px rgba(0,0,0,0.8); z-index: 999; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1); }
          .side-panel.open { transform: translateY(0); }
          .mobile-drag-handle { display: block; width: 40px; height: 5px; background: #333c5a; border-radius: 3px; margin: 12px auto 5px; }
        }

        @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes glowPulse{from{box-shadow:0 0 5px 2px #fbbf24;}to{box-shadow:0 0 15px 5px #fbbf24;}}
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#060810", borderBottom: "1px solid #111420", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#0b2117,#16703a)", borderRadius: 4, display: "grid", placeItems: "center", fontSize: 13 }}>⬛</div>
        <div>
          <div style={{ fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 16 }}>ติดตามการกดเสาเข็ม (Blueprint)</div>
          <div style={{ fontSize: 9, color: "#1e2235", letterSpacing: 3 }}>GRID A–M × 1–21 · F1/F2 · 1,111 PILES</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={exportToExcel}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 4,
              border: "1px solid #1e2235", background: "#0d0f18",
              color: "#8a94b5", cursor: "pointer",
              fontFamily: "'Sarabun',sans-serif", fontSize: 13, fontWeight: 600,
              transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#141825"; e.currentTarget.style.borderColor = "#16703a"; e.currentTarget.style.color = "#22c55e"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#0d0f18"; e.currentTarget.style.borderColor = "#1e2235"; e.currentTarget.style.color = "#8a94b5"; }}
          >
            📥 Export Excel
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14, color: "#22c55e", fontWeight: 600 }}>{stats.pct}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 9, color: "#1e2235" }}>LIVE</span>
          </div>
        </div>
      </div>

      <div className="controls-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", flexWrap: "wrap" }}>
          {[{ l: "ทั้งหมด", v: TOTAL, c: "#cdd1e0" }, { l: "กดแล้ว", v: stats.done, c: "#22c55e" }, { l: "ยังไม่กด", v: stats.pending, c: "#333c5a" }, { l: "มีปัญหา", v: stats.issue, c: "#ef4444" }].map(({ l, v, c }) => (
            <div key={l} className="stat-box" style={{ background: "#0d0f18", border: "1px solid #111420", borderRadius: 4, padding: "6px 14px", flexGrow: 1 }}>
              <div style={{ fontSize: 9, color: "#252c42", fontFamily: "'Sarabun',sans-serif" }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: c }}>{v.toLocaleString()}</div>
            </div>
          ))}
          <div className="search-box" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", background: "#0d0f18", padding: "8px 12px", borderRadius: 4, border: "1px solid #1e2235" }}>
            <span style={{ fontSize: 13, color: "#555d7a", fontFamily: "'Sarabun',sans-serif" }}>🔍 ค้นหาเบอร์:</span>
            <input
              className="inp" type="number" placeholder="เช่น 1" value={searchQ} onChange={handleSearch}
              style={{ width: 90, padding: "2px 6px", background: "transparent", border: "none", borderBottom: "1px solid #333c5a", borderRadius: 0 }}
            />
          </div>
        </div>
      </div>

      <div className="main-content">
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          <div style={{ display: "inline-block", minWidth: "max-content", paddingRight: "40px", paddingBottom: "40px" }}>
            {(() => {
              const dotSz = Math.round(12 * zoom);
              const gap3 = Math.round(4 * zoom);
              const pad = Math.round(12 * zoom);
              const cellW = (ci, rowType) => {
                const horiz = f2IsHorizontal(ci, rowType);
                return horiz ? (dotSz * 2 + gap3 + pad * 2) : (dotSz + pad * 2);
              };
              const LABEL_W = 40;
              const colSlotW = Array.from({ length: 41 }, (_, ci) => cellW(ci, "edge"));

              return (
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", marginLeft: LABEL_W, marginBottom: 8 }}>
                    {COL_LABELS.map((lbl, ci) => {
                      const isMain = ci % 2 === 0;
                      return (
                        <div key={ci} style={{
                          width: colSlotW[ci], flexShrink: 0, textAlign: "center",
                          fontSize: Math.max(10, Math.round(11 * zoom)),
                          color: isMain ? "#4a5580" : "#1e2338",
                          fontWeight: isMain ? 700 : 400,
                        }}>
                          {isMain ? lbl : ""}
                        </div>
                      );
                    })}
                  </div>

                  {ROWS_META.map((meta) => {
                    return (
                      <div key={meta.id} style={{ display: "flex", alignItems: "center" }}>
                        <div style={{
                          width: LABEL_W, flexShrink: 0,
                          fontSize: Math.max(11, Math.round(13 * zoom)),
                          fontWeight: meta.type !== "inter" ? 700 : 400,
                          color: meta.type !== "inter" ? "#5a6090" : "#1e2338",
                          textAlign: "right", paddingRight: 8,
                          fontFamily: "'IBM Plex Mono'",
                        }}>
                          {meta.id}
                        </div>
                        {GRID_DATA[meta.id].map((pileIds, ci) => (
                          <div key={ci} style={{ width: colSlotW[ci], flexShrink: 0, display: "flex", justifyContent: "center" }}>
                            <Cell rowId={meta.id} colIdx={ci} pileIds={pileIds} rowType={meta.type} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        <div className={`backdrop ${isPanelOpen ? 'open' : ''}`} onClick={closePanel}></div>

        <div className={`side-panel ${isPanelOpen ? 'open' : ''}`}>
          <div className="mobile-drag-handle" onClick={closePanel}></div>

          {selCell && !selPile && (
            <div style={{ padding: 16, borderBottom: "1px solid #111420", animation: "slideIn .15s ease" }}>
              <div style={{ fontSize: 10, color: "#1e2235", letterSpacing: 2, marginBottom: 5 }}>FOOTING SELECTED</div>
              <div style={{ fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 18, color: "#fbbf24", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>แถว {selCell.rowId} · Col {COL_LABELS[selCell.colIdx]}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {selCell.pileIds.map(id => {
                  const p = piles[id];
                  return (
                    <div key={id} onClick={() => openPile(id)} style={{ display: "flex", alignItems: "center", gap: 6, background: p.s === ST.X ? (ISSUE_COLORS[p.issueColor] || ISSUE_COLORS[DEFAULT_ISSUE_COLOR]).bg : ST_BG[p.s], border: `1px solid ${p.s === ST.X ? (ISSUE_COLORS[p.issueColor] || ISSUE_COLORS[DEFAULT_ISSUE_COLOR]).bd : ST_BD[p.s]}`, borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#cdd1e0" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.s === ST.X ? (ISSUE_COLORS[p.issueColor] || ISSUE_COLORS[DEFAULT_ISSUE_COLOR]).dot : ST_DOT[p.s] }} />
                      #{id}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => markCell(selCell.pileIds, ST.D)} style={{ flex: 1, padding: "10px 4px", fontSize: 13, borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", background: "#0b2117", border: "1px solid #16703a", color: "#22c55e" }}>✓ กดแล้ว</button>
                <button onClick={() => setCellIssueMenu(v => !v)} style={{ flex: 1, padding: "10px 4px", fontSize: 13, borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", background: "#210b0b", border: "1px solid #8c1c1c", color: "#ef4444" }}>! ปัญหา ▾</button>
                <button onClick={() => markCell(selCell.pileIds, ST.P)} style={{ flex: 1, padding: "10px 4px", fontSize: 13, borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", background: "#141620", border: "1px solid #272c42", color: "#555d7a" }}>↺ รีเซ็ต</button>
              </div>
              {cellIssueMenu && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, animation: "slideIn .15s ease" }}>
                  <div style={{ fontSize: 10, color: "#555d7a", marginBottom: 2, fontFamily: "'Sarabun',sans-serif" }}>เลือกประเภทปัญหา:</div>
                  {ISSUE_COLOR_KEYS.map(ck => {
                    const ic = ISSUE_COLORS[ck];
                    return (
                      <button key={ck} onClick={() => markCell(selCell.pileIds, ST.X, ck)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontSize: 13, background: ic.bg, border: `1px solid ${ic.bd}`, color: ic.dot }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: ic.dot, flexShrink: 0 }} />
                        {ic.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selPile && form && (
            <div style={{ padding: 16, flex: 1, overflow: "auto", animation: "slideIn .15s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#1e2235", letterSpacing: 2 }}>บันทึกข้อมูลหน้างาน</div>
                  <div style={{ fontFamily: "'Sarabun',sans-serif", fontSize: 22, fontWeight: 700, color: "#fbbf24" }}>เสาเข็ม #{selPile}</div>
                </div>
                <button onClick={closePanel} style={{ background: "none", border: "none", color: "#333c5a", cursor: "pointer", fontSize: 24, padding: "0 5px" }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>สถานะเสาเข็ม</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {Object.entries(ST_TH).map(([k, v]) => (
                      <button key={k} onClick={() => setForm(f => ({ ...f, s: k, issueColor: k === ST.X ? (f.issueColor || DEFAULT_ISSUE_COLOR) : "" }))} style={{ flex: 1, padding: "10px 4px", fontSize: 13, borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: form.s === k ? 700 : 400, background: form.s === k ? ST_BG[k] : "transparent", border: `1px solid ${form.s === k ? ST_BD[k] : "#1e2235"}`, color: form.s === k ? "#cdd1e0" : "#333c5a" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  {form.s === ST.X && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: "#555d7a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>เลือกประเภทปัญหา:</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {ISSUE_COLOR_KEYS.map(ck => {
                          const ic = ISSUE_COLORS[ck];
                          const active = form.issueColor === ck;
                          return (
                            <button key={ck} onClick={() => setForm(f => ({ ...f, issueColor: ck }))} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontSize: 12, fontWeight: active ? 700 : 400, background: active ? ic.bg : "transparent", border: `1px solid ${active ? ic.bd : "#1e2235"}`, color: active ? ic.dot : "#555d7a" }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: ic.dot, flexShrink: 0 }} />
                            {ic.label}
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>วันที่กด</div>
                    <input className="inp" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ fontSize: 14 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>เริ่มกด</div>
                      <input className="inp" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={{ padding: "8px 4px", fontSize: 13 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>กดจบ</div>
                      <input className="inp" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} style={{ padding: "8px 4px", fontSize: 13 }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>Pile Tip (ม.)</div>
                    <input className="inp" type="number" step="0.01" placeholder="17.40" value={form.pileTip} onChange={e => setForm(f => ({ ...f, pileTip: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>Pile Top (ม.)</div>
                    <input className="inp" type="number" step="0.01" placeholder="+4.60" value={form.pileTop} onChange={e => setForm(f => ({ ...f, pileTop: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>Pressure (Pressure)</div>
                  <input className="inp" type="number" placeholder="110" value={form.pressure} onChange={e => setForm(f => ({ ...f, pressure: e.target.value }))} />
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>หมายเหตุ</div>
                  <textarea className="inp" rows={2} placeholder="บันทึกปัญหา หรือข้อมูลเพิ่มเติม..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ resize: "vertical" }} />
                </div>

                {piles[selPile]?.date && (
                  <div style={{ background: "#0d0f18", borderRadius: 4, padding: 12, fontSize: 12, color: "#333c5a", border: "1px solid #111420", lineHeight: 1.8 }}>
                    <div style={{ color: "#16703a", fontFamily: "'Sarabun',sans-serif", fontSize: 12, marginBottom: 6, fontWeight: "bold" }}>บันทึกล่าสุด ☁️</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      <div>📅 วันที่: <span style={{ color: "#8a94b5" }}>{piles[selPile].date}</span></div>
                      <div>⏱️ เวลา: <span style={{ color: "#8a94b5" }}>{piles[selPile].startTime || "-"} ถึง {piles[selPile].endTime || "-"} น.</span></div>
                      <div>⏬ Tip: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{piles[selPile].pileTip || "-"}</span> ม.</div>
                      <div>⏫ Top: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{piles[selPile].pileTop || "-"}</span> ม.</div>
                      <div>🗜️ Press: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{piles[selPile].pressure || "-"}</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selPile && form ? (
            <div style={{ padding: 16, borderTop: "1px solid #111420", display: "flex", gap: 10, background: "#060810" }}>
              <button onClick={savePile} style={{ flex: 1, padding: "12px", borderRadius: 4, border: "1px solid #16703a", background: "#0b2117", color: "#22c55e", cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 15 }}>บันทึก ☁️</button>
              <button onClick={closePanel} style={{ padding: "12px 16px", borderRadius: 4, border: "1px solid #1e2235", background: "#0d0f18", color: "#555d7a", cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontSize: 14 }}>ยกเลิก</button>
            </div>
          ) : !selCell && (
            <div className="desktop-placeholder" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#151825", textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: .4 }}>👇</div>
              <div style={{ fontSize: 14, fontFamily: "'Sarabun',sans-serif", lineHeight: 1.9 }}>
                พิมพ์เบอร์เสาเข็มในช่องค้นหา<br />หรือคลิกบน Grid เพื่ออัปเดต
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}