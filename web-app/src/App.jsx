import { useState, useMemo, useEffect, useRef } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import * as XLSX from "xlsx";

// ── Gemini API key (เก็บใน Firestore เพื่อใช้ร่วมกันทุกเครื่อง) ──
const GEMINI_KEY_STORAGE = "gemini_api_key"; // localStorage fallback

// ── Image compression + OCR utilities ──
function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    };
    img.src = URL.createObjectURL(file);
  });
}

function fileToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(blob);
  });
}

async function uploadPilePhoto(blob, pileId, scriptUrl) {
  if (!scriptUrl) return null;
  const base64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(blob);
  });
  const resp = await fetch(scriptUrl, {
    method: "POST",
    body: JSON.stringify({ image: base64, filename: `pile_${pileId}.jpg` }),
  });
  if (!resp.ok) throw new Error(`Upload failed: HTTP ${resp.status}`);
  const data = await resp.json();
  return data.url;
}

async function extractPileDataFromPhoto(file, apiKey) {
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า Gemini API Key — กดปุ่ม ⚙️ ที่มุมขวาบนเพื่อใส่ key");

  const compressed = await compressImage(file, 1200, 0.8);
  const base64 = await fileToBase64(compressed);

  const prompt = `Read the handwritten whiteboard in this construction site photo.
Extract the following fields. Return ONLY a valid JSON object, no explanation, no markdown.

Expected fields:
- pileNo: The pile number (number after "Pile No" or "เข็มที่")
- date: Date in YYYY-MM-DD format (convert Thai Buddhist year: if year is 2 digits like "69" it means BE 2569 = CE 2026, so "21-3-69" → "2026-03-21")
- startTime: Start time in HH:MM format (from "เริ่มกด")
- endTime: End time in HH:MM format (from "กดจบ")
- pileTip: Pile tip depth as string (from "PileTip", e.g. "-16.70")
- pileTop: Pile top elevation as string (from "PileTop", e.g. "+5.30")
- pressure: Pressure value as string (from "Pressure", e.g. "110")
- gridLine: Grid line reference (from "Grid line")

If a field is not visible or unreadable, set its value to null.
Return ONLY valid JSON.`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: base64 } },
            { text: prompt }
          ]
        }]
      })
    }
  );
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  const jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(jsonStr);
}

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

// ── ตรวจจับประเภทฐานราก ──
function getFoundationType(pileIds, rowType) {
  if (pileIds.length === 2) return "F2";
  if (rowType === "inter") return "F-Drop";
  return "F1";
}
function getRemSpacing(remCase) {
  return remCase === "F-Drop" ? 1.20 : 1.00;
}

// ── สีเข็มแก้ไข ──
const REM_DOT_COLOR = "#a855f7";
const REM_DOT_BD = "#7c3aed";

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

// ── หา remGroup จาก pileId ──
function findRemGroupForPile(remGroups, pileId) {
  const key = `RG-${pileId}`;
  return remGroups[key] || null;
}

// ── หา remGroup จาก cell (ตรวจทุก pile ใน cell) ──
function findRemGroupsForCell(remGroups, pileIds) {
  const groups = [];
  for (const pid of pileIds) {
    const key = `RG-${pid}`;
    if (remGroups[key]) groups.push(remGroups[key]);
  }
  return groups;
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

  // ── Remediation state ──
  const [remPiles, setRemPiles] = useState({});
  const [remGroups, setRemGroups] = useState({});
  const [remDialog, setRemDialog] = useState(null);
  const [selRemPile, setSelRemPile] = useState(null); // selected remediation pile ID

  // ── Photo + OCR state ──
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const scanInputRef = useRef(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [driveUrlInput, setDriveUrlInput] = useState("");
  const [geminiKey, setGeminiKeyState] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || "");
  const [driveScriptUrl, setDriveScriptUrl] = useState("");

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

    // ── Sheet เสาเข็มแก้ไข ──
    const remEntries = Object.values(remPiles);
    if (remEntries.length > 0) {
      const remRows = remEntries.map(rp => {
        const group = Object.values(remGroups).find(g => g.remPileIds.includes(rp.id));
        return {
          "เบอร์เสาเข็ม": rp.id,
          "เข็มเดิมที่เฟล": rp.parentPileId,
          "ประเภทฐานราก": rp.remCase,
          "ทิศทาง": group?.direction === "horizontal" ? "ซ้าย-ขวา" : "บน-ล่าง",
          "ระยะห่าง (ม.)": getRemSpacing(rp.remCase),
          "สถานะ": statusMap[rp.s] || rp.s,
          "วันที่": rp.date || "",
          "เวลาเริ่ม": rp.startTime || "",
          "เวลาจบ": rp.endTime || "",
          "Pile Tip (ม.)": rp.pileTip || "",
          "Pile Top (ม.)": rp.pileTop || "",
          "Pressure": rp.pressure || "",
          "หมายเหตุ": rp.note || "",
        };
      });
      const ws2 = XLSX.utils.json_to_sheet(remRows);
      ws2["!cols"] = [
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
        { wch: 14 }, { wch: 12 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, "เสาเข็มแก้ไข");
    }

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `PileTracker_${today}.xlsx`);
  };

  const docRef = doc(db, "projects", "pile-st04");

  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const { _remPiles, _remGroups, ...pileData } = data;
        setPiles(prev => ({ ...prev, ...pileData }));
        if (_remPiles) setRemPiles(_remPiles);
        if (_remGroups) setRemGroups(_remGroups);
      } else {
        setDoc(docRef, initPiles());
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── โหลด Gemini API key จาก Firestore (ใช้ร่วมกันทุกเครื่อง) ──
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "gemini"), (snap) => {
      const key = snap.exists() ? (snap.data().apiKey || "") : "";
      setGeminiKeyState(key);
      if (key) localStorage.setItem(GEMINI_KEY_STORAGE, key); // cache locally
    });
    return () => unsub();
  }, []);

  // ── โหลด Google Drive Script URL จาก Firestore ──
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "drive"), (snap) => {
      setDriveScriptUrl(snap.exists() ? (snap.data().scriptUrl || "") : "");
    });
    return () => unsub();
  }, []);

  const saveDriveScriptUrl = async (url) => {
    const trimmed = url.trim();
    setDriveScriptUrl(trimmed);
    await setDoc(doc(db, "settings", "drive"), { scriptUrl: trimmed });
  };

  const saveGeminiKey = async (key) => {
    const trimmed = key.trim();
    setGeminiKeyState(trimmed);
    if (trimmed) {
      await setDoc(doc(db, "settings", "gemini"), { apiKey: trimmed });
      localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    } else {
      await setDoc(doc(db, "settings", "gemini"), { apiKey: "" });
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  };

  const stats = useMemo(() => {
    const vals = Object.values(piles);
    const remVals = Object.values(remPiles);
    const doneRegular = vals.filter(p => p.s === ST.D).length;
    const doneRem = remVals.filter(p => p.s === ST.D).length;
    const done = doneRegular + doneRem;
    const issueRegular = vals.filter(p => p.s === ST.X).length;
    const issueRem = remVals.filter(p => p.s === ST.X).length;
    const issue = issueRegular + issueRem;
    const total = TOTAL + remVals.length;
    return { done, issue, pending: TOTAL - doneRegular - issueRegular, pct: ((done / total) * 100).toFixed(1) };
  }, [piles, remPiles]);

  const remStats = useMemo(() => {
    const vals = Object.values(remPiles);
    const total = vals.length;
    const done = vals.filter(p => p.s === ST.D).length;
    return { total, done, pending: total - done };
  }, [remPiles]);

  const openPile = (id) => {
    const p = piles[id];
    setSelPile(id);
    setSelRemPile(null);
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

  const openRemPile = (remId) => {
    const rp = remPiles[remId];
    if (!rp) return;
    setSelRemPile(remId);
    setSelPile(null);
    setSelCell(null);
    setForm({
      s: rp.s || ST.P,
      issueColor: rp.issueColor || "",
      date: rp.date || "",
      startTime: rp.startTime || "",
      endTime: rp.endTime || "",
      pileTip: rp.pileTip || "",
      pileTop: rp.pileTop || "",
      pressure: rp.pressure || "",
      note: rp.note || ""
    });
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchQ(val);
    if (!val) {
      setSelCell(null); setSelPile(null); setSelRemPile(null); return;
    }
    const foundCell = findCellByPileId(val);
    if (foundCell) {
      setSelCell(foundCell); openPile(val);
    }
  };

  const closePanel = () => {
    setSelCell(null);
    setSelPile(null);
    setSelRemPile(null);
    setSearchQ("");
    setRemDialog(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setOcrResult(null);
  };

  // ── Photo + OCR handlers ──
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setOcrResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-select same file
  };

  const handleOcrRead = async () => {
    if (!photoFile) return;
    setOcrLoading(true);
    try {
      const result = await extractPileDataFromPhoto(photoFile, geminiKey);
      setOcrResult(result);
    } catch (err) {
      console.error("OCR error:", err);
      alert("ไม่สามารถอ่านข้อมูลจากรูปได้\n\nอาจต้องเปิด Firebase AI (Gemini API) ใน Firebase Console ก่อน\n\nError: " + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const applyOcrToForm = () => {
    if (!ocrResult) return;
    setForm(f => ({
      ...f,
      s: ST.D,
      date: ocrResult.date || f.date,
      startTime: ocrResult.startTime || f.startTime,
      endTime: ocrResult.endTime || f.endTime,
      pileTip: ocrResult.pileTip || f.pileTip,
      pileTop: ocrResult.pileTop || f.pileTop,
      pressure: ocrResult.pressure || f.pressure,
    }));
    setOcrResult(null);
  };

  // Scan-first workflow: ถ่ายรูปก่อน → AI อ่าน Pile No → เปิด form
  const handleScanPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setOcrLoading(true);
    try {
      const result = await extractPileDataFromPhoto(file, geminiKey);
      const pileNo = result.pileNo ? parseInt(result.pileNo) : null;
      if (pileNo && piles[pileNo]) {
        const foundCell = findCellByPileId(String(pileNo));
        if (foundCell) setSelCell(foundCell);
        openPile(pileNo);
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target.result);
        reader.readAsDataURL(file);
        // Apply OCR data to form
        setForm(f => ({
          ...f,
          s: ST.D,
          date: result.date || f.date,
          startTime: result.startTime || f.startTime,
          endTime: result.endTime || f.endTime,
          pileTip: result.pileTip || f.pileTip,
          pileTop: result.pileTop || f.pileTop,
          pressure: result.pressure || f.pressure,
        }));
      } else {
        alert("ไม่พบเสาเข็มหมายเลข " + (result.pileNo || "?") + " ในระบบ\nกรุณาเลือกเข็มเองแล้วถ่ายรูปอีกครั้ง");
      }
    } catch (err) {
      console.error("Scan error:", err);
      alert("ไม่สามารถอ่านข้อมูลจากรูปได้\n\nError: " + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const savePile = async () => {
    const pileId = selRemPile || selPile;
    if (!pileId) return;

    // บันทึกข้อมูลก่อน (ไม่รอรูป)
    const dateVal = form.date || new Date().toISOString().slice(0, 10);
    try {
      if (selRemPile) {
        const updatedRp = { ...remPiles[selRemPile], ...form, date: dateVal };
        await updateDoc(docRef, { _remPiles: { ...remPiles, [selRemPile]: updatedRp } });
      } else {
        const updatedPile = { ...piles[selPile], ...form, date: dateVal };
        await updateDoc(docRef, { [selPile]: updatedPile });
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่\n\n" + error.message);
      return;
    }

    // อัพโหลดรูปทีหลัง (ไม่บล็อกการบันทึก)
    const pendingPhoto = photoFile;
    const isRem = !!selRemPile;
    closePanel();

    if (pendingPhoto) {
      try {
        const compressed = await compressImage(pendingPhoto, 1200, 0.7);
        const photoUrl = await uploadPilePhoto(compressed, pileId, driveScriptUrl);
        // อัพเดท photoUrl หลังอัพรูปสำเร็จ
        if (isRem) {
          const freshRem = { ...(remPiles[pileId] || {}), photoUrl };
          await updateDoc(docRef, { _remPiles: { ...remPiles, [pileId]: freshRem } });
        } else {
          await updateDoc(docRef, { [pileId]: { ...(piles[pileId] || {}), photoUrl } });
        }
      } catch (err) {
        console.error("Photo upload error:", err);
        // ข้อมูลบันทึกแล้ว แค่รูปอัพไม่ได้
      }
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

  // ── เพิ่มเสาเข็มแก้ไข ──
  const applyRemediation = async () => {
    if (!remDialog) return;
    const { pileId, remCase, direction, id1, id2 } = remDialog;
    const trimId1 = String(id1).trim();
    const trimId2 = String(id2).trim();

    if (!trimId1 || !trimId2) { alert("กรุณาระบุ Pile ID ทั้ง 2 ต้น"); return; }
    if (trimId1 === trimId2) { alert("Pile ID ทั้ง 2 ต้นต้องไม่ซ้ำกัน"); return; }

    // validate ไม่ซ้ำ
    const existingIds = new Set([
      ...Array.from({ length: TOTAL }, (_, i) => String(i + 1)),
      ...Object.keys(remPiles)
    ]);
    if (existingIds.has(trimId1)) { alert(`Pile ID "${trimId1}" ซ้ำกับเข็มที่มีอยู่แล้ว`); return; }
    if (existingIds.has(trimId2)) { alert(`Pile ID "${trimId2}" ซ้ำกับเข็มที่มีอยู่แล้ว`); return; }

    const cell = findCellByPileId(pileId);
    if (!cell) return;

    const newRemPiles = {
      ...remPiles,
      [trimId1]: {
        id: trimId1, s: ST.P, parentPileId: pileId, remCase,
        issueColor: "", date: "", startTime: "", endTime: "",
        pileTip: "", pileTop: "", pressure: "", note: ""
      },
      [trimId2]: {
        id: trimId2, s: ST.P, parentPileId: pileId, remCase,
        issueColor: "", date: "", startTime: "", endTime: "",
        pileTip: "", pileTop: "", pressure: "", note: ""
      },
    };

    const groupKey = `RG-${pileId}`;
    const newRemGroups = {
      ...remGroups,
      [groupKey]: {
        parentPileId: pileId,
        remCase,
        direction,
        spacing: getRemSpacing(remCase),
        rowId: cell.rowId,
        colIdx: cell.colIdx,
        remPileIds: [trimId1, trimId2],
        createdAt: new Date().toISOString().slice(0, 10),
      },
    };

    try {
      await updateDoc(docRef, { _remPiles: newRemPiles, _remGroups: newRemGroups });
      setRemDialog(null);
    } catch (error) {
      alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่");
    }
  };

  // ── ลบเสาเข็มแก้ไข ──
  const removeRemediation = async (pileId) => {
    const groupKey = `RG-${pileId}`;
    const group = remGroups[groupKey];
    if (!group) return;
    if (!confirm("ต้องการลบเสาเข็มแก้ไขของเข็ม #" + pileId + " หรือไม่?")) return;

    const newRemPiles = { ...remPiles };
    group.remPileIds.forEach(rid => delete newRemPiles[rid]);
    const newRemGroups = { ...remGroups };
    delete newRemGroups[groupKey];

    try {
      await updateDoc(docRef, { _remPiles: newRemPiles, _remGroups: newRemGroups });
    } catch (error) {
      alert("ไม่สามารถลบได้ กรุณาลองใหม่");
    }
  };

  const f2IsHorizontal = (ci, rowType) => {
    if (ci === 0 || ci === 40) return true;
    if ((ci === 16 || ci === 24) && rowType === "mid") return true;
    return false;
  };

  const Dot = ({ id }) => {
    const p = piles[id];
    let dim = false;
    if (filter !== "all") {
      if (filter === "rem") {
        dim = true; // dim ทุก dot ปกติ ตอนกรอง "แก้ไข"
      } else if (filter.startsWith("x_")) {
        const fc = filter.replace("x_", "");
        dim = !(p.s === ST.X && (p.issueColor || DEFAULT_ISSUE_COLOR) === fc);
      } else {
        dim = p.s !== filter;
      }
    }
    const isSel = selPile === id;
    const isSearched = searchQ && String(id) === searchQ;
    const sz = Math.round(12 * zoom);

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

  // ── RemDot: เข็มแก้ไข (diamond) ──
  const RemDot = ({ remId }) => {
    const rp = remPiles[remId];
    if (!rp) return null;
    const sz = Math.round(10 * zoom);
    const isSel = selRemPile === remId;
    const color = rp.s === ST.D ? "#22c55e" : rp.s === ST.X ? "#ef4444" : REM_DOT_COLOR;
    const bdColor = rp.s === ST.D ? "#16703a" : rp.s === ST.X ? "#8c1c1c" : REM_DOT_BD;
    let dim = false;
    if (filter !== "all" && filter !== "rem") dim = true;

    return (
      <div
        title={`แก้ไข #${remId} (เข็มเดิม #${rp.parentPileId})`}
        onClick={e => { e.stopPropagation(); openRemPile(remId); }}
        style={{
          width: sz, height: sz, flexShrink: 0, cursor: "pointer",
          background: color,
          border: `1px solid ${isSel ? "#fbbf24" : bdColor}`,
          boxShadow: isSel ? "0 0 0 2px #fbbf24" : "none",
          transform: "rotate(45deg)",
          opacity: dim ? 0.15 : 1,
          position: "relative", zIndex: isSel ? 10 : 2,
          transition: "transform .08s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "rotate(45deg) scale(1.7)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "rotate(45deg) scale(1)"; }}
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

    // หา remGroups สำหรับ cell นี้
    const cellRemGroups = findRemGroupsForCell(remGroups, pileIds);
    const hasRem = cellRemGroups.length > 0;

    // คำนวณขนาด cell โดยรวมเข็มแก้ไข
    let cellW, cellH;
    if (hasRem) {
      const remDotSz = Math.round(10 * zoom);
      const remGap = Math.round(4 * zoom);
      // ดูทิศทางของ remGroup แรก (cell มักมีแค่ 1 group)
      const dir = cellRemGroups[0]?.direction || "horizontal";
      if (dir === "horizontal") {
        // เข็มแก้ไขอยู่ซ้าย-ขวา
        const innerW = isF2 ? (horiz ? dotSz * 2 + gap : dotSz) : dotSz;
        cellW = remDotSz + remGap + innerW + remGap + remDotSz + pad * 2;
        cellH = isF2 ? (horiz ? dotSz + pad * 2 : dotSz * 2 + gap + pad * 2) : dotSz + pad * 2;
      } else {
        // เข็มแก้ไขอยู่บน-ล่าง
        cellW = isF2 ? (horiz ? dotSz * 2 + gap + pad * 2 : dotSz + pad * 2) : dotSz + pad * 2;
        const innerH = isF2 ? (!horiz ? dotSz * 2 + gap : dotSz) : dotSz;
        cellH = remDotSz + remGap + innerH + remGap + remDotSz + pad * 2;
      }
    } else {
      cellW = isF2 ? (horiz ? dotSz * 2 + gap + pad * 2 : dotSz + pad * 2) : dotSz + pad * 2;
      cellH = isF2 ? (horiz ? dotSz + pad * 2 : dotSz * 2 + gap + pad * 2) : dotSz + pad * 2;
    }

    // สร้าง remDots สำหรับ render
    const remDotIds = cellRemGroups.flatMap(g => g.remPileIds || []);
    const remDirection = cellRemGroups[0]?.direction || "horizontal";

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
          display: "flex",
          flexDirection: hasRem ? (remDirection === "horizontal" ? "row" : "column") : (isF2 && !horiz ? "column" : "row"),
          gap: hasRem ? Math.round(4 * zoom) : (isF2 ? gap : 0),
          alignItems: "center",
          background: "#080a10", padding: 3, borderRadius: 10, zIndex: 1
        }}>
          {hasRem && remDotIds[0] && <RemDot remId={remDotIds[0]} />}
          <div style={{
            display: "flex", flexDirection: isF2 && !horiz ? "column" : "row", gap: isF2 ? gap : 0,
            alignItems: "center",
          }}>
            {pileIds.map(id => <Dot key={id} id={id} />)}
          </div>
          {hasRem && remDotIds[1] && <RemDot remId={remDotIds[1]} />}
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

  const isPanelOpen = selCell || selPile || selRemPile || remDialog;

  // ── เปิด remediation dialog ──
  const openRemDialog = (pileId) => {
    const cell = findCellByPileId(pileId);
    if (!cell) return;
    const rowMeta = ROWS_META.find(r => r.id === cell.rowId);
    const detectedType = getFoundationType(cell.pileIds, rowMeta?.type);
    setRemDialog({
      pileId,
      remCase: detectedType,
      direction: "horizontal",
      id1: "",
      id2: "",
    });
  };

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

      {/* Settings Dialog */}
      {showApiKeyDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0f18", border: "1px solid #1e2235", borderRadius: 8, padding: 24, width: "100%", maxWidth: 420, fontFamily: "'Sarabun',sans-serif" }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#cdd1e0", marginBottom: 16 }}>⚙️ ตั้งค่า</div>

            {/* Gemini API Key */}
            <div style={{ fontWeight: 600, fontSize: 14, color: "#cdd1e0", marginBottom: 6 }}>🔑 Gemini API Key</div>
            <div style={{ fontSize: 11, color: "#555d7a", marginBottom: 8, lineHeight: 1.6 }}>
              รับ API Key ฟรีได้ที่{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: "#a855f7" }}>
                aistudio.google.com/apikey
              </a>
            </div>
            <input
              className="inp"
              type="password"
              placeholder="AIzaSy..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              style={{ width: "100%", marginBottom: 16, fontSize: 13 }}
              autoFocus
            />

            {/* Google Drive Script URL */}
            <div style={{ fontWeight: 600, fontSize: 14, color: "#cdd1e0", marginBottom: 6 }}>📁 Google Drive Script URL</div>
            <div style={{ fontSize: 11, color: "#555d7a", marginBottom: 8, lineHeight: 1.6 }}>
              สำหรับอัพโหลดรูปถ่ายลง Google Drive (ไม่ใส่ = ไม่เก็บรูป)
            </div>
            <input
              className="inp"
              type="text"
              placeholder="https://script.google.com/macros/s/..."
              value={driveUrlInput}
              onChange={e => setDriveUrlInput(e.target.value)}
              style={{ width: "100%", marginBottom: 16, fontSize: 13 }}
            />

            <div style={{ fontSize: 10, color: "#555d7a", marginBottom: 12 }}>ตั้งค่าครั้งเดียว ใช้ได้ทุกเครื่อง (เก็บใน cloud)</div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if (apiKeyInput.trim()) saveGeminiKey(apiKeyInput);
                  saveDriveScriptUrl(driveUrlInput);
                  setShowApiKeyDialog(false);
                }}
                style={{ flex: 1, padding: "10px", borderRadius: 4, border: "1px solid #16703a", background: "#0b2117", color: "#22c55e", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
              >บันทึก</button>
              <button
                onClick={() => setShowApiKeyDialog(false)}
                style={{ padding: "10px 14px", borderRadius: 4, border: "1px solid #1e2235", background: "transparent", color: "#555d7a", cursor: "pointer", fontSize: 13 }}
              >ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

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
          <input ref={scanInputRef} type="file" accept="image/*" hidden onChange={handleScanPhoto} />
          <button
            onClick={() => {
              if (!geminiKey) { setApiKeyInput(""); setShowApiKeyDialog(true); return; }
              scanInputRef.current?.click();
            }}
            disabled={ocrLoading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 4,
              border: "1px solid #1e2235", background: ocrLoading ? "#141825" : "#0d0f18",
              color: ocrLoading ? "#555d7a" : "#a855f7", cursor: ocrLoading ? "wait" : "pointer",
              fontFamily: "'Sarabun',sans-serif", fontSize: 13, fontWeight: 600,
              transition: "all .15s",
            }}
            onMouseEnter={e => { if (!ocrLoading) { e.currentTarget.style.background = "#141825"; e.currentTarget.style.borderColor = "#7c3aed"; }}}
            onMouseLeave={e => { e.currentTarget.style.background = ocrLoading ? "#141825" : "#0d0f18"; e.currentTarget.style.borderColor = "#1e2235"; }}
          >
            {ocrLoading ? "AI กำลังอ่าน..." : "📷 สแกน"}
          </button>
          <button
            onClick={() => { setApiKeyInput(geminiKey); setDriveUrlInput(driveScriptUrl); setShowApiKeyDialog(true); }}
            title="ตั้งค่า Gemini API Key"
            style={{ background: "none", border: "none", color: geminiKey ? "#22c55e" : "#ef4444", cursor: "pointer", fontSize: 18, padding: "4px 6px" }}
          >⚙️</button>
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
          {[
            { l: "ทั้งหมด", v: TOTAL, c: "#cdd1e0" },
            { l: "กดแล้ว", v: stats.done, c: "#22c55e" },
            { l: "ยังไม่กด", v: stats.pending, c: "#333c5a" },
            { l: "มีปัญหา", v: stats.issue, c: "#ef4444" },
            ...(remStats.total > 0 ? [{ l: "แก้ไข", v: remStats.total, c: REM_DOT_COLOR }] : []),
          ].map(({ l, v, c }) => (
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

          {/* ── Remediation Dialog ── */}
          {remDialog && (
            <div style={{ padding: 16, flex: 1, overflow: "auto", animation: "slideIn .15s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#1e2235", letterSpacing: 2 }}>เพิ่มเสาเข็มแก้ไข</div>
                  <div style={{ fontFamily: "'Sarabun',sans-serif", fontSize: 20, fontWeight: 700, color: REM_DOT_COLOR }}>เข็มเดิม #{remDialog.pileId}</div>
                </div>
                <button onClick={() => setRemDialog(null)} style={{ background: "none", border: "none", color: "#333c5a", cursor: "pointer", fontSize: 24, padding: "0 5px" }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* ประเภทฐานราก */}
                <div>
                  <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>ประเภทฐานราก</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["F1", "F2", "F-Drop"].map(t => (
                      <button key={t} onClick={() => setRemDialog(d => ({ ...d, remCase: t }))}
                        style={{ flex: 1, padding: "10px 4px", fontSize: 13, borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: remDialog.remCase === t ? 700 : 400, background: remDialog.remCase === t ? "#1a0f2e" : "transparent", border: `1px solid ${remDialog.remCase === t ? REM_DOT_BD : "#1e2235"}`, color: remDialog.remCase === t ? REM_DOT_COLOR : "#555d7a" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ทิศทาง */}
                <div>
                  <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>ทิศทางวางเข็มแก้ไข</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[{ v: "horizontal", l: "◇ ● ◇ ซ้าย-ขวา" }, { v: "vertical", l: "◇ ● ◇ บน-ล่าง" }].map(({ v, l }) => (
                      <button key={v} onClick={() => setRemDialog(d => ({ ...d, direction: v }))}
                        style={{ flex: 1, padding: "10px 4px", fontSize: 12, borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: remDialog.direction === v ? 700 : 400, background: remDialog.direction === v ? "#1a0f2e" : "transparent", border: `1px solid ${remDialog.direction === v ? REM_DOT_BD : "#1e2235"}`, color: remDialog.direction === v ? REM_DOT_COLOR : "#555d7a" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ระยะห่าง */}
                <div style={{ background: "#0d0f18", borderRadius: 4, padding: 10, fontSize: 13, color: "#8a94b5", border: "1px solid #111420", fontFamily: "'Sarabun',sans-serif" }}>
                  ระยะห่าง: <span style={{ color: REM_DOT_COLOR, fontWeight: 700 }}>{getRemSpacing(remDialog.remCase).toFixed(2)} ม.</span> จากแนวเดิม
                </div>

                {/* Pile ID inputs */}
                <div>
                  <div style={{ fontSize: 11, color: "#333c5a", marginBottom: 6, fontFamily: "'Sarabun',sans-serif" }}>Pile ID เสาเข็มแก้ไข (พิมพ์เอง)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#555d7a", marginBottom: 4, fontFamily: "'Sarabun',sans-serif" }}>ต้นที่ 1 ({remDialog.direction === "horizontal" ? "ซ้าย" : "บน"})</div>
                      <input className="inp" type="text" placeholder="เช่น 1112" value={remDialog.id1} onChange={e => setRemDialog(d => ({ ...d, id1: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#555d7a", marginBottom: 4, fontFamily: "'Sarabun',sans-serif" }}>ต้นที่ 2 ({remDialog.direction === "horizontal" ? "ขวา" : "ล่าง"})</div>
                      <input className="inp" type="text" placeholder="เช่น 1113" value={remDialog.id2} onChange={e => setRemDialog(d => ({ ...d, id2: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* สรุป */}
                <div style={{ background: "#1a0f2e", borderRadius: 4, padding: 12, fontSize: 13, border: `1px solid ${REM_DOT_BD}`, fontFamily: "'Sarabun',sans-serif", color: "#cdd1e0" }}>
                  จะเพิ่มเสาเข็มแก้ไข <span style={{ color: REM_DOT_COLOR, fontWeight: 700 }}>2 ต้น</span> ให้เข็ม #{remDialog.pileId}
                  <br />ประเภท: {remDialog.remCase} · ทิศทาง: {remDialog.direction === "horizontal" ? "ซ้าย-ขวา" : "บน-ล่าง"}
                </div>
              </div>

              <div style={{ padding: "16px 0", display: "flex", gap: 10 }}>
                <button onClick={applyRemediation} style={{ flex: 1, padding: "12px", borderRadius: 4, border: `1px solid ${REM_DOT_BD}`, background: "#1a0f2e", color: REM_DOT_COLOR, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 15 }}>ยืนยัน เพิ่มเข็มแก้ไข</button>
                <button onClick={() => setRemDialog(null)} style={{ padding: "12px 16px", borderRadius: 4, border: "1px solid #1e2235", background: "#0d0f18", color: "#555d7a", cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontSize: 14 }}>ยกเลิก</button>
              </div>
            </div>
          )}

          {/* ── Cell Selected View ── */}
          {selCell && !selPile && !selRemPile && !remDialog && (
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
                {/* แสดงเข็มแก้ไขของ cell นี้ */}
                {findRemGroupsForCell(remGroups, selCell.pileIds).flatMap(g => g.remPileIds).map(rid => {
                  const rp = remPiles[rid];
                  if (!rp) return null;
                  const color = rp.s === ST.D ? "#22c55e" : rp.s === ST.X ? "#ef4444" : REM_DOT_COLOR;
                  return (
                    <div key={rid} onClick={() => openRemPile(rid)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a0f2e", border: `1px solid ${REM_DOT_BD}`, borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "#cdd1e0" }}>
                      <div style={{ width: 10, height: 10, background: color, transform: "rotate(45deg)", flexShrink: 0 }} />
                      #{rid}
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

          {/* ── Pile Detail Form (ทั้งเข็มปกติและเข็มแก้ไข) ── */}
          {(selPile || selRemPile) && form && !remDialog && (
            <div style={{ padding: 16, flex: 1, overflow: "auto", animation: "slideIn .15s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#1e2235", letterSpacing: 2 }}>
                    {selRemPile ? "บันทึกข้อมูลเข็มแก้ไข" : "บันทึกข้อมูลหน้างาน"}
                  </div>
                  <div style={{ fontFamily: "'Sarabun',sans-serif", fontSize: 22, fontWeight: 700, color: selRemPile ? REM_DOT_COLOR : "#fbbf24" }}>
                    {selRemPile ? (
                      <>
                        <span style={{ fontSize: 13, color: "#555d7a", fontWeight: 400 }}>แก้ไข</span> #{selRemPile}
                      </>
                    ) : (
                      <>เสาเข็ม #{selPile}</>
                    )}
                  </div>
                  {selRemPile && remPiles[selRemPile] && (
                    <div style={{ fontSize: 11, color: "#555d7a", fontFamily: "'Sarabun',sans-serif", marginTop: 2 }}>
                      เข็มเดิม: #{remPiles[selRemPile].parentPileId} · {remPiles[selRemPile].remCase}
                    </div>
                  )}
                </div>
                <button onClick={closePanel} style={{ background: "none", border: "none", color: "#333c5a", cursor: "pointer", fontSize: 24, padding: "0 5px" }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* ── Photo Upload + OCR ── */}
                <div>
                  <input id="pile-photo-input" type="file" accept="image/*" hidden onChange={handlePhotoSelect} />
                  {!photoPreview ? (
                    <label htmlFor="pile-photo-input" style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "12px", borderRadius: 4, cursor: "pointer",
                      fontFamily: "'Sarabun',sans-serif", fontWeight: 600, fontSize: 14,
                      background: "#0d0f18", border: "1px dashed #333c5a", color: "#8a94b5",
                      transition: "all .15s",
                    }}>
                      📷 ถ่ายรูป / เลือกรูป
                    </label>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <img src={photoPreview} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 4, border: "1px solid #1e2235" }} />
                      <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); setOcrResult(null); }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", border: "none", color: "#ef4444", cursor: "pointer", borderRadius: "50%", width: 24, height: 24, fontSize: 14, display: "grid", placeItems: "center" }}>✕</button>
                      {!ocrResult && (
                        <button onClick={handleOcrRead} disabled={ocrLoading} style={{
                          width: "100%", marginTop: 8, padding: "10px", borderRadius: 4, cursor: ocrLoading ? "wait" : "pointer",
                          fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 13,
                          background: ocrLoading ? "#141825" : "#1a0f2e", border: `1px solid ${ocrLoading ? "#333c5a" : "#7c3aed"}`,
                          color: ocrLoading ? "#555d7a" : "#a855f7",
                        }}>
                          {ocrLoading ? (
                            <span style={{ animation: "pulse 1s infinite" }}>AI กำลังอ่านข้อมูล...</span>
                          ) : (
                            "🤖 อ่านข้อมูลจากรูป"
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  {ocrResult && (
                    <div style={{ marginTop: 8, background: "#0b2117", borderRadius: 4, padding: 12, border: "1px solid #16703a", fontSize: 12, fontFamily: "'Sarabun',sans-serif" }}>
                      <div style={{ color: "#22c55e", fontWeight: 700, marginBottom: 8 }}>AI อ่านข้อมูลได้:</div>
                      <div style={{ color: "#8a94b5", lineHeight: 2 }}>
                        {ocrResult.pileNo && <div>Pile No: <span style={{ color: "#fbbf24", fontWeight: 700 }}>#{ocrResult.pileNo}</span></div>}
                        {ocrResult.date && <div>วันที่: <span style={{ color: "#cdd1e0" }}>{ocrResult.date}</span></div>}
                        {ocrResult.startTime && <div>เริ่มกด: <span style={{ color: "#cdd1e0" }}>{ocrResult.startTime}</span></div>}
                        {ocrResult.endTime && <div>กดจบ: <span style={{ color: "#cdd1e0" }}>{ocrResult.endTime}</span></div>}
                        {ocrResult.pileTip && <div>PileTip: <span style={{ color: "#cdd1e0" }}>{ocrResult.pileTip}</span></div>}
                        {ocrResult.pileTop && <div>PileTop: <span style={{ color: "#cdd1e0" }}>{ocrResult.pileTop}</span></div>}
                        {ocrResult.pressure && <div>Pressure: <span style={{ color: "#cdd1e0" }}>{ocrResult.pressure}</span></div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={applyOcrToForm} style={{ flex: 1, padding: "8px", borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 13, background: "#0b2117", border: "1px solid #16703a", color: "#22c55e" }}>
                          ✓ ใช้ข้อมูลนี้
                        </button>
                        <button onClick={() => setOcrResult(null)} style={{ padding: "8px 12px", borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontSize: 12, background: "transparent", border: "1px solid #1e2235", color: "#555d7a" }}>
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}
                </div>

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

                {/* ปุ่มเพิ่มเสาเข็มแก้ไข (เฉพาะเข็มปกติที่เฟล + ยังไม่มี remediation) */}
                {selPile && piles[selPile]?.s === ST.X && !findRemGroupForPile(remGroups, selPile) && (
                  <button onClick={() => openRemDialog(selPile)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 14, background: "#1a0f2e", border: `1px solid ${REM_DOT_BD}`, color: REM_DOT_COLOR }}>
                    <div style={{ width: 10, height: 10, background: REM_DOT_COLOR, transform: "rotate(45deg)" }} />
                    เพิ่มเสาเข็มแก้ไข
                  </button>
                )}

                {/* แสดงข้อมูล remediation group ถ้ามี */}
                {selPile && findRemGroupForPile(remGroups, selPile) && (() => {
                  const group = findRemGroupForPile(remGroups, selPile);
                  return (
                    <div style={{ background: "#1a0f2e", borderRadius: 4, padding: 12, border: `1px solid ${REM_DOT_BD}`, fontSize: 12, fontFamily: "'Sarabun',sans-serif" }}>
                      <div style={{ color: REM_DOT_COLOR, fontWeight: 700, marginBottom: 6 }}>เสาเข็มแก้ไข ({group.remCase})</div>
                      <div style={{ color: "#8a94b5", lineHeight: 1.8 }}>
                        ทิศทาง: {group.direction === "horizontal" ? "ซ้าย-ขวา" : "บน-ล่าง"}<br />
                        ระยะห่าง: {group.spacing} ม.<br />
                        เข็มแก้ไข: {group.remPileIds.map(rid => `#${rid}`).join(", ")}
                      </div>
                      <button onClick={() => removeRemediation(selPile)} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontSize: 11, background: "#210b0b", border: "1px solid #8c1c1c", color: "#ef4444" }}>
                        ลบเข็มแก้ไข
                      </button>
                    </div>
                  );
                })()}

                {/* Last record (เข็มปกติ) */}
                {selPile && piles[selPile]?.date && (
                  <div style={{ background: "#0d0f18", borderRadius: 4, padding: 12, fontSize: 12, color: "#333c5a", border: "1px solid #111420", lineHeight: 1.8 }}>
                    <div style={{ color: "#16703a", fontFamily: "'Sarabun',sans-serif", fontSize: 12, marginBottom: 6, fontWeight: "bold" }}>บันทึกล่าสุด ☁️</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      <div>📅 วันที่: <span style={{ color: "#8a94b5" }}>{piles[selPile].date}</span></div>
                      <div>⏱️ เวลา: <span style={{ color: "#8a94b5" }}>{piles[selPile].startTime || "-"} ถึง {piles[selPile].endTime || "-"} น.</span></div>
                      <div>⏬ Tip: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{piles[selPile].pileTip || "-"}</span> ม.</div>
                      <div>⏫ Top: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{piles[selPile].pileTop || "-"}</span> ม.</div>
                      <div>🗜️ Press: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{piles[selPile].pressure || "-"}</span></div>
                    </div>
                    {piles[selPile].photoUrl && (
                      <a href={piles[selPile].photoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 8 }}>
                        <img src={piles[selPile].photoUrl} alt="pile photo" style={{ width: "100%", maxHeight: 150, objectFit: "contain", borderRadius: 4, border: "1px solid #1e2235" }} />
                      </a>
                    )}
                  </div>
                )}

                {/* Last record (เข็มแก้ไข) */}
                {selRemPile && remPiles[selRemPile]?.date && (
                  <div style={{ background: "#0d0f18", borderRadius: 4, padding: 12, fontSize: 12, color: "#333c5a", border: "1px solid #111420", lineHeight: 1.8 }}>
                    <div style={{ color: REM_DOT_BD, fontFamily: "'Sarabun',sans-serif", fontSize: 12, marginBottom: 6, fontWeight: "bold" }}>บันทึกล่าสุด ☁️</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      <div>📅 วันที่: <span style={{ color: "#8a94b5" }}>{remPiles[selRemPile].date}</span></div>
                      <div>⏱️ เวลา: <span style={{ color: "#8a94b5" }}>{remPiles[selRemPile].startTime || "-"} ถึง {remPiles[selRemPile].endTime || "-"} น.</span></div>
                      <div>⏬ Tip: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{remPiles[selRemPile].pileTip || "-"}</span> ม.</div>
                      <div>⏫ Top: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{remPiles[selRemPile].pileTop || "-"}</span> ม.</div>
                      <div>🗜️ Press: <span style={{ color: "#cdd1e0", fontWeight: "bold" }}>{remPiles[selRemPile].pressure || "-"}</span></div>
                    </div>
                    {remPiles[selRemPile].photoUrl && (
                      <a href={remPiles[selRemPile].photoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 8 }}>
                        <img src={remPiles[selRemPile].photoUrl} alt="pile photo" style={{ width: "100%", maxHeight: 150, objectFit: "contain", borderRadius: 4, border: "1px solid #1e2235" }} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(selPile || selRemPile) && form && !remDialog ? (
            <div style={{ padding: 16, borderTop: "1px solid #111420", display: "flex", gap: 10, background: "#060810" }}>
              <button onClick={savePile} style={{ flex: 1, padding: "12px", borderRadius: 4, border: `1px solid ${selRemPile ? REM_DOT_BD : "#16703a"}`, background: selRemPile ? "#1a0f2e" : "#0b2117", color: selRemPile ? REM_DOT_COLOR : "#22c55e", cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 15 }}>บันทึก ☁️</button>
              <button onClick={closePanel} style={{ padding: "12px 16px", borderRadius: 4, border: "1px solid #1e2235", background: "#0d0f18", color: "#555d7a", cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontSize: 14 }}>ยกเลิก</button>
            </div>
          ) : !selCell && !remDialog && (
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
