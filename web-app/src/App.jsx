import { useState, useMemo, useEffect } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase"; // ดึงฐานข้อมูลที่เราตั้งค่าไว้มาใช้

// ============================================================
// ข้อมูล GRID คงเดิม ไม่เปลี่ยนแปลง
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

function initPiles() {
  const m = {};
  for (let i = 1; i <= TOTAL; i++) m[i] = { id: i, s: ST.P, depth: "", set: "", note: "", date: "" };
  return m;
}

export default function App() {
  const [piles, setPiles] = useState(initPiles());
  const [selPile, setSelPile] = useState(null);
  const [selCell, setSelCell] = useState(null);
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState("all");
  const [zoom, setZoom] = useState(1.0);
  const [loading, setLoading] = useState(true); // เพิ่ม State สำหรับโหลดข้อมูล

  // ระบุตำแหน่งที่จะเก็บข้อมูลใน Firestore (Collection: projects, Document: pile-st04)
  const docRef = doc(db, "projects", "pile-st04");

  // ============================================================
  // ดึงข้อมูลและอัปเดตแบบ Real-time จาก Firebase
  // ============================================================
  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        // ถ้ามีข้อมูลในฐานข้อมูล ให้นำมาใช้
        setPiles(prev => ({ ...prev, ...docSnap.data() }));
      } else {
        // ถ้าเป็นการใช้งานครั้งแรกสุด ให้สร้างข้อมูลเปล่าๆ ขึ้นไปเซฟบน Firebase
        setDoc(docRef, initPiles());
      }
      setLoading(false);
    });

    return () => unsubscribe(); // ล้างการเชื่อมต่อเมื่อปิดหน้าเว็บ
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
    setForm({ s: p.s, depth: p.depth || "", set: p.set || "", note: p.note || "", date: p.date || "" });
  };

  // ============================================================
  // บันทึกข้อมูลเสาเข็ม 1 ต้น ลง Firebase
  // ============================================================
  const savePile = async () => {
    if (!selPile) return;
    const updatedPile = {
      ...piles[selPile],
      ...form,
      date: form.date || new Date().toISOString().slice(0, 10)
    };

    // เซฟทับลงฐานข้อมูลเฉพาะต้นที่แก้ไข
    try {
      await updateDoc(docRef, {
        [selPile]: updatedPile
      });
      setSelPile(null); setForm(null);
    } catch (error) {
      console.error("Error saving pile:", error);
      alert("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่");
    }
  };

  // ============================================================
  // อัปเดตสถานะแบบรวดเดียว (ทั้ง Cell) ลง Firebase
  // ============================================================
  const markCell = async (ids, status) => {
    const date = new Date().toISOString().slice(0, 10);
    const updates = {};

    ids.forEach(id => {
      updates[id] = { ...piles[id], s: status, date };
    });

    try {
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error("Error updating cell:", error);
      alert("ไม่สามารถบันทึกข้อมูลได้");
    }
  };

  // ฟังก์ชันคำนวณ Grid คงเดิม
  const isMainCol = (ci) => ci % 2 === 0;
  const isInterRow = (meta) => meta.type === "inter";
  const f2IsHorizontal = (ci, rowType) => {
    if (ci === 0 || ci === 40) return true;
    if ((ci === 16 || ci === 24) && rowType === "mid") return true;
    return false;
  };

  const Dot = ({ id }) => {
    const p = piles[id];
    const dim = filter !== "all" && p.s !== filter;
    const isSel = selPile === id;
    const sz = Math.round(8 * zoom);
    return (
      <div
        title={`#${id}`}
        onClick={e => { e.stopPropagation(); openPile(id); }}
        style={{
          width: sz, height: sz, borderRadius: "50%", flexShrink: 0,
          background: ST_DOT[p.s],
          border: `1px solid ${isSel ? "#fbbf24" : p.s === ST.D ? "#16703a" : p.s === ST.X ? "#8c1c1c" : "#272c42"}`,
          boxShadow: isSel ? `0 0 0 2px #fbbf24` : p.s === ST.D ? "0 0 3px rgba(34,197,94,0.5)" : "none",
          opacity: dim ? 0.1 : 1,
          cursor: "pointer",
          transition: "transform .08s",
          zIndex: isSel ? 10 : 1, position: "relative",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.7)"; e.currentTarget.style.zIndex = 8; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.zIndex = isSel ? 10 : 1; }}
      />
    );
  };

  const Cell = ({ rowId, colIdx, pileIds, rowType }) => {
    const isF2 = pileIds.length === 2;
    const horiz = f2IsHorizontal(colIdx, rowType);
    const done = pileIds.filter(id => piles[id]?.s === ST.D).length;
    const issue = pileIds.filter(id => piles[id]?.s === ST.X).length;
    const allDone = done === pileIds.length;
    const hasIssue = issue > 0;
    const isSel = selCell?.rowId === rowId && selCell?.colIdx === colIdx;

    const dotSz = Math.round(8 * zoom);
    const gap = Math.round(3 * zoom);
    const pad = Math.round(3 * zoom);
    const cellW = isF2
      ? (horiz ? dotSz * 2 + gap + pad * 2 : dotSz + pad * 2)
      : dotSz + pad * 2;
    const cellH = isF2
      ? (horiz ? dotSz + pad * 2 : dotSz * 2 + gap + pad * 2)
      : dotSz + pad * 2;

    return (
      <div
        title={`${rowId}-${COL_LABELS[colIdx]}: #${pileIds.join(", #")}`}
        onClick={() => setSelCell(isSel ? null : { rowId, colIdx, pileIds })}
        style={{
          width: cellW, height: cellH, flexShrink: 0,
          display: "flex",
          flexDirection: isF2 && !horiz ? "column" : "row",
          gap: isF2 ? gap : 0,
          alignItems: "center", justifyContent: "center",
          background: isSel ? "#1a1f38" : allDone ? "#0b2117" : hasIssue ? "#210b0b" : "#0f1118",
          border: `1px solid ${isSel ? "#fbbf24" : allDone ? "#1a7a3c" : hasIssue ? "#7a1c1c" : "#181c2a"}`,
          borderRadius: 3, cursor: "pointer",
          boxShadow: isSel ? "0 0 0 1px #fbbf2460" : "none",
          padding: pad, position: "relative",
          transition: "background .1s, border .1s",
        }}
      >
        {pileIds.map(id => <Dot key={id} id={id} />)}
      </div>
    );
  };

  // แสดงหน้าจอโหลดก่อน Firebase จะดึงข้อมูลเสร็จ
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

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", minHeight: "100vh", background: "#080a10", color: "#cdd1e0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Sarabun:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#0d0f18}
        ::-webkit-scrollbar-thumb{background:#1e2235;border-radius:3px}
        .pill{padding:4px 10px;border-radius:3px;border:1px solid #1e2235;background:transparent;color:#555d7a;cursor:pointer;font-size:11px;font-family:'IBM Plex Mono',monospace;transition:all .15s}
        .pill.on{background:#141825;color:#cdd1e0;border-color:#333c5a}
        .pill:hover{color:#cdd1e0}
        .inp{background:#080a10;border:1px solid #1e2235;border-radius:3px;color:#cdd1e0;padding:6px 9px;font-family:'IBM Plex Mono',monospace;font-size:12px;width:100%;outline:none}
        .inp:focus{border-color:#16703a}
        @keyframes slideIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>

      {/* HEADER */}
      <div style={{ background: "#060810", borderBottom: "1px solid #111420", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#0b2117,#16703a)", borderRadius: 4, display: "grid", placeItems: "center", fontSize: 13 }}>⬛</div>
        <div>
          <div style={{ fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 14 }}>ติดตามการกดเสาเข็ม (Cloud Sync ☁️)</div>
          <div style={{ fontSize: 8, color: "#1e2235", letterSpacing: 3 }}>GRID A–M × 1–21 · F1/F2 · 1,111 PILES</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 100, height: 3, background: "#111420", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${stats.pct}%`, background: "linear-gradient(90deg,#0b2117,#22c55e)", borderRadius: 2, transition: "width .5s" }} />
            </div>
            <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>{stats.pct}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 8, color: "#1e2235" }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* CONTROLS */}
      <div style={{ borderBottom: "1px solid #111420", padding: "7px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        {[{ l: "ทั้งหมด", v: TOTAL, c: "#cdd1e0" }, { l: "กดแล้ว", v: stats.done, c: "#22c55e" }, { l: "ยังไม่กด", v: stats.pending, c: "#333c5a" }, { l: "มีปัญหา", v: stats.issue, c: "#ef4444" }].map(({ l, v, c }) => (
          <div key={l} style={{ background: "#0d0f18", border: "1px solid #111420", borderRadius: 3, padding: "5px 12px", marginRight: 3 }}>
            <div style={{ fontSize: 7, color: "#252c42", fontFamily: "'Sarabun',sans-serif" }}>{l}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: c }}>{v.toLocaleString()}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "p", "d", "x"].map(s => (
              <button key={s} className={`pill ${filter === s ? "on" : ""}`} onClick={() => setFilter(s)}>
                {s === "all" ? "ทั้งหมด" : ST_TH[s]}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#333c5a", marginLeft: 8 }}>
            <span>ขนาด</span>
            <input type="range" min="0.6" max="2.0" step="0.1" value={zoom} onChange={e => setZoom(+e.target.value)} style={{ width: 60, accentColor: "#16703a" }} />
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* GRID */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
          <div style={{ display: "inline-block", minWidth: "max-content" }}>
            {(() => {
              const dotSz = Math.round(8 * zoom);
              const gap3 = Math.round(3 * zoom);
              const pad = Math.round(3 * zoom);

              const cellW = (ci, rowType) => {
                const isMain = ci % 2 === 0;
                const horiz = f2IsHorizontal(ci, rowType);
                if (!isMain) return dotSz + pad * 2;
                if (horiz) return dotSz * 2 + gap3 + pad * 2;
                return dotSz + pad * 2;
              };

              const LABEL_W = 30;
              const ROW_GAP = Math.round(4 * zoom);
              const INTER_ROW_GAP = Math.round(2 * zoom);
              const colSlotW = Array.from({ length: 41 }, (_, ci) => cellW(ci, "edge") + 4);

              return (
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", marginLeft: LABEL_W, marginBottom: 6 }}>
                    {COL_LABELS.map((lbl, ci) => {
                      const isMain = ci % 2 === 0;
                      return (
                        <div key={ci} style={{
                          width: colSlotW[ci], flexShrink: 0, textAlign: "center",
                          fontSize: Math.max(7, Math.round(8 * zoom)),
                          color: isMain ? "#4a5580" : "#1e2338",
                          fontWeight: isMain ? 700 : 400,
                          paddingBottom: 2,
                          borderBottom: isMain ? "1px solid #252c45" : "none",
                        }}>
                          {isMain ? lbl : ""}
                        </div>
                      );
                    })}
                  </div>

                  {ROWS_META.map((meta, ri) => {
                    const isInter = meta.type === "inter";
                    const isEdge = meta.type === "edge";
                    const rowBg = isInter ? "transparent" : isEdge ? "#0e1020" : "#0c0e1a";

                    return (
                      <div key={meta.id} style={{
                        display: "flex", alignItems: "center",
                        marginBottom: isInter ? INTER_ROW_GAP : ROW_GAP,
                        background: rowBg,
                        borderTop: !isInter ? `1px solid ${isEdge ? "#2a3060" : "#1a1f38"}` : "none",
                        borderBottom: !isInter ? `1px solid ${isEdge ? "#2a3060" : "#1a1f38"}` : "none",
                        borderRadius: 2,
                      }}>
                        <div style={{
                          width: LABEL_W, flexShrink: 0,
                          fontSize: Math.max(8, Math.round(9 * zoom)),
                          fontWeight: isInter ? 400 : 700,
                          color: isInter ? "#1e2338" : isEdge ? "#5a6090" : "#3a4270",
                          textAlign: "right", paddingRight: 5,
                          fontFamily: "'IBM Plex Mono'",
                        }}>
                          {meta.id}
                        </div>

                        {GRID_DATA[meta.id].map((pileIds, ci) => {
                          const isMainC = ci % 2 === 0;
                          return (
                            <div key={ci} style={{
                              width: colSlotW[ci], flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              borderLeft: isMainC && ci > 0 ? `1px solid #1a1f38` : "none",
                              paddingTop: Math.round(2 * zoom),
                              paddingBottom: Math.round(2 * zoom),
                            }}>
                              <Cell rowId={meta.id} colIdx={ci} pileIds={pileIds} rowType={meta.type} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* SIDE PANEL */}
        <div style={{ width: 255, borderLeft: "1px solid #111420", background: "#060810", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Cell panel */}
          {selCell && !selPile && (
            <div style={{ padding: 12, borderBottom: "1px solid #111420", animation: "slideIn .15s ease" }}>
              <div style={{ fontSize: 8, color: "#1e2235", letterSpacing: 2, marginBottom: 3 }}>FOOTING SELECTED</div>
              <div style={{ fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 14, color: "#fbbf24", marginBottom: 6 }}>
                แถว {selCell.rowId} · Col {COL_LABELS[selCell.colIdx]}
                <span style={{ marginLeft: 8, fontSize: 10, color: selCell.pileIds.length === 2 ? "#60a5fa" : "#a78bfa", fontWeight: 400 }}>
                  F{selCell.pileIds.length}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                {selCell.pileIds.map(id => {
                  const p = piles[id];
                  return (
                    <div key={id} onClick={() => openPile(id)} style={{ display: "flex", alignItems: "center", gap: 4, background: ST_BG[p.s], border: `1px solid ${ST_BD[p.s]}`, borderRadius: 3, padding: "3px 8px", cursor: "pointer", fontSize: 10, color: "#cdd1e0" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: ST_DOT[p.s] }} />
                      #{id}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 9, color: "#333c5a", marginBottom: 5, fontFamily: "'Sarabun',sans-serif" }}>อัปเดตทั้ง footing</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => markCell(selCell.pileIds, ST.D)} style={{ flex: 1, padding: "5px 3px", fontSize: 10, borderRadius: 3, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", background: "#0b2117", border: "1px solid #16703a", color: "#22c55e" }}>✓ กดแล้ว</button>
                <button onClick={() => markCell(selCell.pileIds, ST.X)} style={{ flex: 1, padding: "5px 3px", fontSize: 10, borderRadius: 3, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", background: "#210b0b", border: "1px solid #8c1c1c", color: "#ef4444" }}>! ปัญหา</button>
                <button onClick={() => markCell(selCell.pileIds, ST.P)} style={{ flex: 1, padding: "5px 3px", fontSize: 10, borderRadius: 3, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", background: "#141620", border: "1px solid #272c42", color: "#555d7a" }}>↺ รีเซ็ต</button>
              </div>
            </div>
          )}

          {/* Pile edit form */}
          {selPile && form && (
            <div style={{ padding: 12, flex: 1, overflow: "auto", animation: "slideIn .15s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 8, color: "#1e2235", letterSpacing: 2 }}>บันทึกข้อมูล</div>
                  <div style={{ fontFamily: "'Sarabun',sans-serif", fontSize: 16, fontWeight: 700, color: "#fbbf24" }}>เสาเข็ม #{selPile}</div>
                </div>
                <button onClick={() => { setSelPile(null); setForm(null); }} style={{ background: "none", border: "none", color: "#333c5a", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#333c5a", marginBottom: 5, fontFamily: "'Sarabun',sans-serif" }}>สถานะ</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {Object.entries(ST_TH).map(([k, v]) => (
                      <button key={k} onClick={() => setForm(f => ({ ...f, s: k }))} style={{ flex: 1, padding: "5px 2px", fontSize: 10, borderRadius: 3, cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: form.s === k ? 700 : 400, background: form.s === k ? ST_BG[k] : "transparent", border: `1px solid ${form.s === k ? ST_BD[k] : "#1e2235"}`, color: form.s === k ? "#cdd1e0" : "#333c5a" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#333c5a", marginBottom: 4, fontFamily: "'Sarabun',sans-serif" }}>วันที่กด</div>
                  <input className="inp" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  <div>
                    <div style={{ fontSize: 9, color: "#333c5a", marginBottom: 4, fontFamily: "'Sarabun',sans-serif" }}>ความลึก (ม.)</div>
                    <input className="inp" type="number" step="0.1" placeholder="12.50" value={form.depth} onChange={e => setForm(f => ({ ...f, depth: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "#333c5a", marginBottom: 4, fontFamily: "'Sarabun',sans-serif" }}>ค่า Set (มม.)</div>
                    <input className="inp" type="number" step="0.5" placeholder="5" value={form.set} onChange={e => setForm(f => ({ ...f, set: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#333c5a", marginBottom: 4, fontFamily: "'Sarabun',sans-serif" }}>หมายเหตุ</div>
                  <textarea className="inp" rows={3} placeholder="บันทึกเพิ่มเติม..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ resize: "vertical" }} />
                </div>
                {piles[selPile]?.date && (
                  <div style={{ background: "#0d0f18", borderRadius: 3, padding: 9, fontSize: 10, color: "#333c5a", border: "1px solid #111420", lineHeight: 1.8 }}>
                    <div style={{ color: "#16703a", fontFamily: "'Sarabun',sans-serif", fontSize: 11, marginBottom: 2 }}>บันทึกล่าสุด</div>
                    <div>วันที่: {piles[selPile].date}</div>
                    {piles[selPile].depth && <div>ลึก: {piles[selPile].depth} ม.</div>}
                    {piles[selPile].set && <div>Set: {piles[selPile].set} มม.</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save bar */}
          {selPile && form ? (
            <div style={{ padding: 12, borderTop: "1px solid #111420", display: "flex", gap: 7 }}>
              <button onClick={savePile} style={{ flex: 1, padding: "8px", borderRadius: 3, border: "1px solid #16703a", background: "#0b2117", color: "#22c55e", cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontWeight: 700, fontSize: 13 }}>บันทึก ☁️</button>
              <button onClick={() => { setSelPile(null); setForm(null); }} style={{ padding: "8px 12px", borderRadius: 3, border: "1px solid #1e2235", background: "#0d0f18", color: "#555d7a", cursor: "pointer", fontFamily: "'Sarabun',sans-serif", fontSize: 12 }}>ยกเลิก</button>
            </div>
          ) : !selCell ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#151825", textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 26, marginBottom: 10, opacity: .4 }}>☁️</div>
              <div style={{ fontSize: 11, fontFamily: "'Sarabun',sans-serif", lineHeight: 1.9 }}>
                ซิงค์ข้อมูลกับ Firebase แล้ว<br />คลิก cell เพื่อทดสอบอัปเดต
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}