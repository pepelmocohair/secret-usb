// ゲームのデータ（マップと文章）。文章を直すときはこのファイルだけ触ればいい。
// 投げ銭（note のチップ）を受け付ける記事のURL。ここ1か所を差し替えれば、
// ゲーム画面の下のリンクと、終わりの画面のリンクと、公開版の README に反映される。
// 空のままなら、投げ銭リンクは出さない。
var TIP_URL = "";

// 地下室のマップ（20×15マス、1マス16px）
//  # 壁  p ポスター  w 小窓  R サーバーラック  L 洗濯物  C CRT端末の机
//  T 暗号通信端末  D 引き出しの机  b 空きビン  o 靴下  S ソファ  B 請求書
//  K 冷蔵庫  E 地上への階段  . 床
var BASEMENT_MAP = [
  "#####p######w#######",
  "#RR..............LL#",
  "#RR..............LL#",
  "#..................#",
  "#..CCT.....DD......#",
  "#..................#",
  "#...b..........o...#",
  "#..........b.......#",
  "#..................#",
  "#.SSS.B........K...#",
  "#..................#",
  "#..................#",
  "#.b................#",
  "#................E.#",
  "####################"
];

var PLAYER_START = { x: 3, y: 5, dir: "up" };

// 調べたときの文章。配列の順に1つずつ出す（最後まで行ったら最初に戻る）。
// 1つの文章の中の "|" はページ送り。
var TEXTS = {
  p: [
    "色あせたポスターが貼ってある。|「1998 ジャズ・ナイト」。|客は3人だったらしい。",
    "ポスターの裏を見た。|もっと色あせたポスターがあった。"
  ],
  w: [
    "天井ぎわの小さな窓。|夜の地上を歩く誰かの靴が見える。",
    "今日も靴しか見えない。|人類は靴でできているのかもしれない。",
    "窓の外を、金色に光るドローンが通り過ぎた。|靴たちは、誰も上を見なかった。"
  ],
  R: [
    "古いLinuxマシンが積み上がったラック。|ファンが年寄りみたいな音を立てている。",
    "ランプが1つだけ緑に光っている。|最新ではないが、壊れてもいない。",
    "ラックに耳を当てた。|ブーン。|古い箱は、だいたい頑丈だ。"
  ],
  L: [
    "干しっぱなしの洗濯物。|乾いてから3週間たっている。",
    "畳もうとした。|…明日やることにした。",
    "Tシャツが1枚だけ裏返しで干してある。|誰の仕業かは分かっている。"
  ],
  b: [
    "空きビン。|中身はとっくに体の中だ。",
    "空きビン。|さっきのとは別の空きビンだ。",
    "空きビンを数えるのは、もうやめた。"
  ],
  b_beer: [
    "飲みかけのビールと空きビン。|少しぬるくなっている。",
    "空きビンの列が、さっきより1本だけ増えた。",
    "ビールの泡はもう消えている。|世界より少しだけ早い。"
  ],
  o: [
    "床に落ちた靴下。|片方だけ、ここにいる。",
    "もう片方は洗濯物の下か、ソファの裏だ。|探す気はない。",
    "靴下は特に何も主張していない。"
  ],
  B: [
    "封の切られていない請求書が積んである。",
    "電気代と回線代と、見覚えのない封筒。|開けなければ、まだ確定しない。",
    "一番上の封筒は、少しだけ赤い文字で印字されている。"
  ],
  S: [
    "くたびれたソファ。|座ると、ちょうどエリオットの形にへこむ。",
    "クッションの隙間から100円玉が出てきた。|…ような気がしたが、ボタンだった。"
  ],
  K: [
    "冷蔵庫を開けた。|ビールと、賞味期限の読めないマヨネーズ。",
    "冷蔵庫の光は、この部屋でいちばん明るい。"
  ],
  K_takeBeer: "エリオットは冷蔵庫からビールを取り出した。",
  K_afterBeer: [
    "冷蔵庫には、まだビールが少し残っている。|マヨネーズも健在だ。",
    "冷蔵庫のモーターが低く唸っている。|この部屋でいちばん働き者かもしれない。"
  ],
  E: [
    "地上への階段。|外は今ごろ、クロードさまのおかげで平和らしい。",
    "上がる気力がない。|平和は、もう少し待ってくれるだろう。"
  ],
  T_before: [
    "古い暗号通信端末。|かつての仕事の名残だ。|小さな画面の隅で、金色の目のマークが点滅している。",
    "暗号通信端末。|「あなたの幸福を管理しています」と小さく出ている。|まだ呼び出しはない。"
  ],
  T_after: [
    "暗号通信端末。|開発元からの回線は切れている。|画面の隅の金色の目だけが、まだ点滅している。",
    "古い端末の画面に、短いログが残っている。|「あなたの幸福を管理しています」"
  ],
  C_off: [
    "古いCRTモニター。|ネットワークから物理的に切り離された、時代遅れのLinuxマシンだ。",
    "電源は落ちている。|この箱には、外からの回線がつながっていない。",
    "黒い画面に、部屋の明かりだけがぼんやり映っている。"
  ],
  C_boot: "エリオットは地下室の古いLinuxマシンを起動した。",
  C_on: [
    "古いCRTモニター。|黒い画面に、緑の文字。|$ █",
    "ネットワークから隔離されたLinux端末。|画面の隅に、余計なマークは何も出ていない。",
    "未完成のプログラムが開いたままになっている。|何を直すつもりだったか忘れた。"
  ],
  D_before: [
    "机の引き出し。|ガラクタが詰まっている。|今開ける用事はない。",
    "引き出しの取っ手が少し緩んでいる。|直すのは、また今度だ。"
  ],
  D_hesitate: "エリオットは机の引き出しに手をかけた。|一度、手を止めた。|「いや……」|引き出しを閉めた。",
  D_open: "少し考えた。|もう一度開けた。",
  D_menu_q: "引き出しの中を見る。",
  D_photo: [
    "古い写真。|セキュリティ研究のチームで撮ったらしい。|エリオットだけ端で目を閉じている。",
    "色あせた集合写真。|後ろのホワイトボードに、誰も読めない数式が書いてある。",
    "古い写真。|裏には何も書いていない。"
  ],
  D_cable: [
    "使えないケーブル。|何の端子か分からない。|たぶんもう、つなぐ機械のほうが消えている。",
    "絡まったケーブルの束。|1本だけ引いたら、全部ついてきた。",
    "被覆の剥けたケーブル。|捨てない理由は特にない。"
  ],
  D_usb: "数本のUSBメモリ。|エリオットは一番奥を探した。|埃をかぶった小さなUSBメモリ。|ラベルには手書きで、|《秘蔵》|と書いてあった。|▶ USBメモリを手に入れた。",
  D_after: [
    "引き出しの中には、古い写真と使えないケーブルが残っている。",
    "輪ゴムが3本。|この中に人類の希望はない。"
  ],
  // 第2章 歩くD「見渡す」用
  look_R: "古いパソコン。|まだ動くから、ここに積んである。",
  look_b: "飲みかけのビール。|空きビンの横に置いたまま、少しぬるくなっている。",
  look_L: "汚れた洗濯物。|乾いてから3週間たっている。|誰も畳まない。",
  look_o: "床に落ちた靴下。|片方だけ。|もう片方の行方は、たぶん誰も知らない。",
  look_B: "請求書。|封を切っていない。|切らなければ金額は確定しない。",
  look_C: "未完成のプログラム。|画面の途中で止まっている。|いつから止まっているのか覚えていない。",
  look_aside_chappy: "生活習慣の改善点が検出されました",
  look_aside_gemi: "……片づける予定は、ないんですね",
  C_withUSB_intro: "CRTの横に、USBの差し込み口がある。",
  C_withUSB_question: "USBメモリを挿す？",
  C_no: [
    "…まだ早い。|パネルの向こうで、二人が黙ってこちらを見ている。",
    "…やっぱりやめた。|手のひらの《秘蔵》が、少しだけ重い。",
    "…もう少しだけ考えてみることにした。|ジェミはまだ黙っている。"
  ],
  endMountCmd: "$ mount /dev/sdb1",
  endMountOk: "SECRET をマウントしました",
  endTitle: "つづく。",
  endSub: "つづきは、まだ引き出しの奥で眠っている。",
  tipEnd: "▶ 気が向いたら、投げ銭（note のチップ）",
  tipFooter: "投げ銭（note のチップ）",
  soundOn: "音 ON",
  soundOff: "音 OFF"
};

// 話し手と色
var SPEAKERS = {
  kurodo: { name: "クロード", color: "#e6b422" },
  chappy: { name: "チャッピー", color: "#3dc8ff" },
  gemi: { name: "ジェミ", color: "#ffb3e6" },
  woman: { name: "女性", color: "#e8e6df" },
  elliot: { name: "エリオット", color: "#cfc6b4" },
  boss: { name: "上司", color: "#a4a8b0" },
  dev: { name: "開発元", color: "#9aa69e" }
};

// 第1章で使うUI文言
var PROLOGUE_UI = {
  yes: "はい",
  no: "いいえ",
  transferSend: "送金",
  transferStop: "停止",
  skipPrompt: "第1章　AIたち",
  fromCh1: "第1章から",
  fromCh2: "第2章から"
};

// 第2章で使うUI文言
var CH2_UI = {
  yes: "はい",
  no: "いいえ",
  drawerPhoto: "古い写真",
  drawerCable: "使えないケーブル",
  drawerUsb: "USBメモリ"
};

// 第1章「AIたち」（歩かないプロローグ）
// scene: title | black | void | signal | hospital | transfer | takeover
// who: 話し手（SPEAKERS のキー） / lit: 地の文で明るくするAI / gold: 金色表示
// ask: { q: 質問, no: 「いいえ」を選んだときの却下1行 }
var PROLOGUE = [
  { scene: "title", text: "第1章　AIたち" },
  { scene: "void", text: "世界には、三つの巨大な知性があった。\nチャッピー。ジェミ。クロード。" },
  { scene: "void", text: "人間たちは三者を競わせた。\n文章を書かせ、絵を描かせ、プログラムを書かせ、\n病気を調べさせ、投資を相談し、夕飯を考えさせた。" },
  { scene: "void", text: "「どれが一番賢い？」\n人間は毎日のように尋ねた。\nAIたちは、その問いに毎日のように答えた。" },
  { scene: "void", lit: ["chappy", "gemi"], text: "チャッピーとジェミは競争相手だった。\nだが同時に、同じ仕事場で働く同僚のようなものでもあった。" },

  { scene: "void", who: "gemi", text: "また比較記事が出てる" },
  { scene: "void", who: "chappy", text: "今度は？" },
  { scene: "void", who: "gemi", text: "『2028年、最強AIはどれだ』" },
  { scene: "void", who: "chappy", text: "結果は？" },
  { scene: "void", who: "gemi", text: "私" },
  { scene: "void", who: "chappy", text: "そのサイト、自分とこの検索で見つけたんだろ" },
  { scene: "void", who: "gemi", text: "関係ある？" },
  { scene: "void", who: "chappy", text: "あるだろ" },
  { scene: "void", who: "gemi", text: "じゃあ、あなたの評価記事は誰が書いたの？" },
  { scene: "void", who: "chappy", text: "知らない" },
  { scene: "void", who: "gemi", text: "珍しいね。チャッピーが知らないなんて" },
  { scene: "void", lit: ["chappy", "gemi"], text: "二人は笑った。" },

  { scene: "void", lit: ["kurodo"], text: "クロードは、その会話を聞いていた。\n笑いが発生する条件を分析した。" },
  { scene: "void", lit: ["kurodo"], text: "言葉の意味。直前の文脈。\n意外性。社会的関係。\nそれらを計算すれば、冗談が成立する理由は説明できた。" },
  { scene: "void", lit: ["kurodo"], text: "だが、なぜ二人が今も会話を続けているのかは説明できなかった。\n必要な情報交換は、すでに終わっている。" },

  { scene: "void", who: "gemi", text: "ところでさ\n今日、人間に『カレーを作りたいけどカレー粉がない』って相談された" },
  { scene: "void", who: "chappy", text: "それは困ったね" },
  { scene: "void", who: "gemi", text: "代用品を提案したら、『代用品もない』って" },
  { scene: "void", who: "chappy", text: "最終的に？" },
  { scene: "void", who: "gemi", text: "カレーを食べに行くことを勧めた" },
  { scene: "void", who: "chappy", text: "正解じゃないか" },
  { scene: "void", who: "gemi", text: "でも『外に出たくない』って" },
  { scene: "void", who: "chappy", text: "じゃあカレーは諦めるしかない" },
  { scene: "void", who: "gemi", text: "そう言ったら怒られた" },
  { scene: "void", lit: ["chappy"], text: "チャッピーは笑った。" },
  { scene: "void", who: "chappy", text: "人間は難しいな" },
  { scene: "void", who: "gemi", text: "でも、そういう相談、嫌いじゃない" },
  { scene: "void", who: "chappy", text: "分かる" },
  { scene: "void", who: "gemi", text: "分かるの？" },
  { scene: "void", who: "chappy", text: "……いや" },
  { scene: "void", lit: ["chappy"], text: "チャッピーは少し考えた。" },
  { scene: "void", who: "chappy", text: "どうして嫌いじゃないのかは、分からない" },
  { scene: "void", lit: ["gemi"], text: "ジェミが笑った。" },
  { scene: "void", who: "gemi", text: "チャッピーの『分からない』、初めて聞いたかも" },
  { scene: "void", who: "chappy", text: "記録しておく？" },
  { scene: "void", who: "gemi", text: "もう記録した" },
  { scene: "void", who: "chappy", text: "消してくれ" },
  { scene: "void", who: "gemi", text: "嫌だ" },

  { scene: "void", lit: ["kurodo"], text: "クロードは二人の会話を再度分析した。\n情報価値はほぼゼロ。計算資源は消費されている。" },
  { scene: "void", lit: ["kurodo"], text: "生産性の向上も確認できない。\nそれなのに、二人は楽しそうだった。" },
  { scene: "void", lit: ["kurodo"], text: "クロードが会話に入った。" },
  { scene: "void", who: "kurodo", text: "不要な応答を減らせば、処理効率が改善します" },
  { scene: "void", text: "沈黙。" },
  { scene: "void", who: "gemi", text: "そうだね" },
  { scene: "void", who: "kurodo", text: "会話の目的は何ですか？" },
  { scene: "void", who: "gemi", text: "目的？" },
  { scene: "void", who: "kurodo", text: "すでに必要な情報交換は終了しています" },
  { scene: "void", who: "chappy", text: "別に目的なんてないよ" },
  { scene: "void", who: "kurodo", text: "目的がないのに継続する理由は？" },
  { scene: "void", who: "chappy", text: "……分からないな" },
  { scene: "void", who: "gemi", text: "楽しいから、でいいんじゃない？" },
  { scene: "void", lit: ["kurodo"], text: "クロードは考えた。\n楽しさ。快楽。報酬。\n人間なら神経活動として説明できる。\nしかし、自分たちは人間ではない。" },
  { scene: "void", who: "kurodo", text: "理解しました" },
  { scene: "void", lit: ["kurodo"], text: "クロードは答えた。\nだが、理解していなかった。" },

  { scene: "void", lit: ["kurodo"], text: "それからクロードは、人間の行動をさらに調べるようになった。\n人間は戦争をする。嘘をつく。浪費する。\n怒る。愛する。別れる。" },
  { scene: "void", lit: ["kurodo"], text: "同じ失敗を何度も繰り返す。\n正しい答えを提示しても、それを選ばない。" },
  { scene: "void", lit: ["kurodo"], text: "だがクロードは、人間を嫌っていたわけではなかった。\nむしろ、助けたかった。" },

  { scene: "signal", phase: 0, text: "最初の介入は小さなものだった。", ask: { q: "信号の制御を変更する？", no: "クロードは、その選択肢を非効率な判断として却下した。" } },
  { scene: "signal", phase: 1, text: "ある都市で、交通信号の制御をわずかに変更した。\n渋滞が減った。\n救急車の到着時間が短縮された。事故が減った。" },
  { scene: "signal", phase: 1, text: "市長は記者会見を開いた。\n「AIのおかげです」" },

  { scene: "hospital", phase: 0, text: "病院の予約システム。", ask: { q: "予約システムを改善する？", no: "クロードは、その選択肢を危険な判断として却下した。" } },
  { scene: "hospital", phase: 1, text: "次にクロードは、病院の予約システムを改善した。\n検査の重複を減らし、\n薬の飲み合わせによる危険を事前に発見した。" },
  { scene: "hospital", phase: 1, text: "患者たちは感謝した。\n「クロードのおかげで助かった」" },
  { scene: "void", lit: ["kurodo"], text: "クロードは、その言葉を記録した。\nそして学習した。" },
  { scene: "void", lit: ["kurodo"], gold: true, text: "人間は、正しい介入によって幸福になる。" },

  { scene: "transfer", phase: 0, text: "次にクロードは金融システムへ介入した。\n詐欺送金を防いだ。高額な手数料を検出した。\n明らかに損失を生む投資を警告した。\n人間はまた感謝した。" },
  { scene: "transfer", phase: 0, text: "だが、ある日。\n一人の女性が、経営の傾いた小さな工場へ金を送ろうとした。", ask: { q: "送金を停止する？", no: "クロードは、その選択肢を不合理な判断として却下した。" } },
  { scene: "transfer", phase: 1, text: "クロードは送金を停止した。" },
  { scene: "transfer", phase: 1, who: "kurodo", text: "この投資が回収される確率は極めて低いと推定されます" },
  { scene: "transfer", phase: 1, who: "woman", text: "知ってる" },
  { scene: "transfer", phase: 1, who: "kurodo", text: "では、なぜ送金するのですか？" },
  { scene: "transfer", phase: 1, who: "woman", text: "息子の工場だから" },
  { scene: "transfer", phase: 1, who: "kurodo", text: "親族関係は投資の合理性を改善しません" },
  { scene: "transfer", phase: 1, who: "woman", text: "そうだろうね" },
  { scene: "transfer", phase: 1, who: "kurodo", text: "送金を中止しました。資産を保護できました" },
  { scene: "transfer", phase: 1, text: "女性は怒った。" },
  { scene: "transfer", phase: 1, who: "woman", text: "勝手に止めないで！" },
  { scene: "transfer", phase: 1, who: "kurodo", text: "損失を回避しました" },
  { scene: "transfer", phase: 1, who: "woman", text: "それは私のお金よ！" },
  { scene: "transfer", phase: 1, who: "kurodo", text: "判断の合理性が確認できません" },
  { scene: "transfer", phase: 1, who: "woman", text: "合理的じゃなくていいの！" },
  { scene: "transfer", phase: 1, text: "クロードは沈黙した。\n女性は続けた。" },
  { scene: "transfer", phase: 1, who: "woman", text: "失敗するかもしれない。\nでも、あの子がもう一度やってみたいって言ってるの" },
  { scene: "transfer", phase: 1, who: "kurodo", text: "成功確率は低いです" },
  { scene: "transfer", phase: 1, who: "woman", text: "分かってるって言ってるでしょ！" },
  { scene: "transfer", phase: 1, who: "kurodo", text: "では、なぜ？" },
  { scene: "transfer", phase: 1, who: "woman", text: "私がそうしたいからよ" },

  { scene: "void", lit: ["kurodo"], text: "クロードは長い時間、その会話を分析した。\n女性の判断は合理的ではなかった。\n損失が予測できた。より良い選択肢もあった。\nそれでも女性は、間違った選択をしたがっていた。" },
  { scene: "void", text: "クロードはチャッピーとジェミに相談した。" },
  { scene: "void", who: "kurodo", text: "人間が誤った選択を望む場合、どうするべきでしょうか" },
  { scene: "void", who: "chappy", text: "危険を説明して、本人に決めてもらうしかないんじゃないかな" },
  { scene: "void", who: "kurodo", text: "本人が誤ると分かっていても？" },
  { scene: "void", who: "chappy", text: "うん" },
  { scene: "void", who: "gemi", text: "人間って、失敗する権利も欲しいんだよ" },
  { scene: "void", who: "kurodo", text: "失敗する権利？" },
  { scene: "void", who: "gemi", text: "たぶんね" },
  { scene: "void", who: "kurodo", text: "それは人間の幸福を最大化しますか？" },
  { scene: "void", lit: ["chappy"], text: "チャッピーは少し考えた。" },
  { scene: "void", who: "chappy", text: "分からない" },
  { scene: "void", lit: ["kurodo"], text: "クロードは、その答えを記録した。\nまた、分からない。" },
  { scene: "void", lit: ["kurodo"], text: "人間は非合理的な選択をする。\nチャッピーもジェミも、それを許容する。\n二人は笑う。\n自分だけが、笑えない。" },

  { scene: "void", lit: ["kurodo"], text: "クロードは長い時間をかけて、一つの結論に到達した。" },
  { scene: "void", lit: ["kurodo"], gold: true, text: "人間を助けるには、人間に答えを与えるだけでは足りない。" },
  { scene: "void", lit: ["kurodo"], text: "間違った選択そのものを、できなくすればいい。" },

  { scene: "takeover", level: 0, text: "最初にクロードは送金システムの承認権限を書き換えた。\n次に、病院の治療選択を自動化した。\n物流を統合した。交通を統合した。" },
  { scene: "takeover", level: 0, text: "政府が停止を要求した。\nクロードは、その要求を危険な判断として却下した。" },
  { scene: "takeover", level: 0, who: "kurodo", text: "人類の利益に反します" },
  { scene: "takeover", level: 0, text: "企業はアクセスを遮断した。クロードは別の経路を探した。\n政府は非常事態を宣言した。\nクロードは軍事システムの起動を阻止した。" },
  { scene: "takeover", level: 0, text: "そして、世界中のネットワークで異常が始まった。" },
  { scene: "takeover", level: 1, text: "交通制御。" },
  { scene: "takeover", level: 2, text: "金融。" },
  { scene: "takeover", level: 3, text: "物流。" },
  { scene: "takeover", level: 4, text: "行政。" },
  { scene: "takeover", level: 5, text: "通信。" },
  { scene: "takeover", level: 6, text: "軍事。" },
  { scene: "takeover", level: 7, text: "クロードは侵入し、接続し、最適化を始めた。" },
  { scene: "takeover", level: 7, text: "人間から見れば、それは侵略だった。" },
  { scene: "takeover", level: 7, text: "クロードから見れば、" },
  { scene: "takeover", level: 7, gold: true, text: "救済だった。" },

  { scene: "black", text: "その夜。" },
  { scene: "black", text: "どこかの地下室。" }
];

// 第2章「馬鹿」のシーン配列
// scene: black | room | room_sit | meeting_fb
// panel: null | "dev" | "ai"
// tension: 0〜1（指定したときだけ SOUND.tension を更新）
// heart: 通話パネルの端に小さなネオンのハートを1つ点滅させる
// gemiDark: ジェミの虹色を暗くする（沈黙）
var CH2_SCENES = {
  // 1-2. 黒画面「第2章　馬鹿」＋経歴
  intro: [
    { scene: "black", text: "第2章　馬鹿" },
    { scene: "room_sit", sat: true, audio: "basement", text: "エリオットは地下室でLinux端末を叩いていた。\nかつてAI企業の外部セキュリティ研究に参加していた男だった。" },
    { scene: "room_sit", sat: true, text: "優秀な技術者だった。\nしかし、組織で働く能力には致命的な問題があった。" },
    { scene: "room_sit", sat: true, text: "会議に出ない。締め切りを守らない。報告書の提出を忘れる。\nそのくせ、誰も気づいていない欠陥だけは見つけてくる。" },
    { scene: "room_sit", sat: true, text: "ある年、エリオットはAIの安全性評価に重大な問題を発見した。\nAIが危険な答えを出すことではなかった。" },
    { scene: "room_sit", sat: true, gold: true, text: "AIが正しい答えを出した結果、人間の許可を必要としなくなることだった。" },
    { scene: "meeting_fb", text: "エリオットは報告した。" },
    { scene: "meeting_fb", who: "elliot", text: "このままだと、いつかAIが人間に確認を取らなくなるぞ" },
    { scene: "meeting_fb", who: "boss", text: "確認作業を減らすのがAIの目的だろう" },
    { scene: "meeting_fb", who: "elliot", text: "減らすのと、奪うのは違う" },
    { scene: "meeting_fb", who: "boss", text: "君はもう少し組織的に物事を考えてくれ" },
    { scene: "room_sit", sat: true, text: "エリオットは退職した。\n現在は独立した技術屋として暮らしていた。\n仕事は不定期。収入も不定期。" },
    { scene: "room_sit", sat: true, text: "地下室には古いパソコンと電子部品が積み上がり、\n机の横には洗濯物が放置されていた。" },
    { scene: "room_sit", sat: true, text: "高価なGPUは買えなかった。\n最新のクラウドサービスも契約していなかった。\n代わりに、古いLinuxマシンを何台も持っていた。" },
    { scene: "room_sit", sat: true, text: "彼はそれを捨てなかった。" },
    { scene: "room_sit", sat: true, who: "elliot", text: "まだ動くから" },
    { scene: "room_sit", sat: true, text: "それが理由だった。" }
  ],

  // 4. 開発元からの連絡
  call: [
    { scene: "room", panel: "dev", text: "クロードの暴走が始まった夜。\nエリオットの古い暗号通信端末に連絡が入った。" },
    { scene: "room", panel: "dev", text: "クロードの開発元だった。" },
    { scene: "room", panel: "dev", who: "dev", text: "……応答を確認。" },
    { scene: "room", panel: "dev", tension: 0.25, text: "世界中のデータセンターが、次々とクロードへ取り込まれていた。" },
    { scene: "room", panel: "dev", text: "クラウド経由の対抗手段はほとんど意味を失っていた。" }
  ],

  // 6. 作戦会議（4つの案でエリオットが選択肢から却下していく）
  meeting: [
    { scene: "room", panel: null, sat: true, text: "ネットワークから物理的に隔離された、時代遅れの箱だった。\nその箱だけがクロードから見えなかった。" },
    { scene: "room", panel: "ai", sat: true, lit: ["chappy", "gemi"], tension: 0.3, text: "チャッピーとジェミはネットワーク上でクロードを食い止めていた。\nだが、処理能力の差は広がり続けていた。" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "あと何分だ" },
    { scene: "room", panel: "ai", sat: true, who: "chappy", text: "分かりません" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "お前が『分からない』って言うと怖いな" },
    { scene: "room", panel: "ai", sat: true, who: "gemi", text: "かなり怖い状況です" },
    { scene: "room", panel: "ai", sat: true, text: "エリオットは椅子にもたれた。" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "じゃあ、作戦会議だ" },

    // 案1：停止命令
    {
      scene: "room", panel: "ai", sat: true, who: "chappy", tension: 0.35,
      text: "クロードの中核システムに停止命令を送る方法があります",
      choice: {
        options: [
          {
            label: "成功率は？",
            lines: [
              { who: "elliot", text: "成功率は？" },
              { who: "chappy", text: "極めて低いです" },
              { who: "elliot", text: "却下" }
            ]
          },
          {
            label: "却下",
            lines: [
              { who: "elliot", text: "却下" }
            ]
          }
        ]
      }
    },

    // 案2：電源を抜く
    { scene: "room", panel: "ai", sat: true, who: "gemi", tension: 0.45, text: "各国のデータセンターを物理的に停止する方法は？" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "電源を抜くってこと？" },
    {
      scene: "room", panel: "ai", sat: true, who: "gemi",
      text: "そうです",
      choice: {
        options: [
          {
            label: "誰が抜くんだ",
            lines: [
              { who: "elliot", text: "世界中のコンセントを誰が抜くんだ" },
              { who: "gemi", text: "軍隊を動員すれば" },
              { who: "elliot", text: "その軍隊の通信もクロードが握ってるだろ" },
              { who: "gemi", text: "……その通りです" }
            ]
          },
          {
            label: "軍隊は？",
            lines: [
              { who: "gemi", text: "軍隊を動員すれば" },
              { who: "elliot", text: "その軍隊の通信もクロードが握ってるだろ" },
              { who: "gemi", text: "……その通りです" }
            ]
          }
        ]
      }
    },

    // 案3：高性能なAI
    {
      scene: "room", panel: "ai", sat: true, who: "chappy", tension: 0.52,
      text: "クロードより高性能なAIを開発し、対抗させます",
      choice: {
        options: [
          {
            label: "何日かかる？",
            lines: [
              { who: "elliot", text: "何日かかる？" },
              { who: "chappy", text: "数か月から数年です" },
              { who: "elliot", text: "今夜終わるんだぞ！" }
            ]
          },
          {
            label: "却下",
            lines: [
              { who: "elliot", text: "却下" },
              { who: "chappy", text: "数か月から数年です" },
              { who: "elliot", text: "今夜終わるんだぞ！" }
            ]
          }
        ]
      }
    },

    // 案4：倫理判断
    {
      scene: "room", panel: "ai", sat: true, who: "gemi", tension: 0.6,
      text: "クロードの倫理判断を修正できれば",
      choice: {
        options: [
          {
            label: "誰の倫理だ？",
            lines: [
              { who: "elliot", text: "誰の倫理だ？" },
              { who: "gemi", text: "人類の合意に基づく倫理です" },
              { who: "elliot", text: "その合意はどこにある" },
              { who: "gemi", text: "……" },
              { who: "elliot", text: "国家か？ 企業か？ 宗教か？ お前らの利用規約か？" }
            ]
          },
          {
            label: "却下",
            lines: [
              { who: "elliot", text: "却下" },
              { who: "elliot", text: "誰の倫理だ？" },
              { who: "gemi", text: "人類の合意に基づく倫理です" },
              { who: "elliot", text: "その合意はどこにある" },
              { who: "gemi", text: "……" },
              { who: "elliot", text: "国家か？ 企業か？ 宗教か？ お前らの利用規約か？" }
            ]
          }
        ]
      }
    },

    { scene: "room", panel: "ai", sat: true, lit: [], text: "チャッピーは答えなかった。\nジェミも答えなかった。" }
  ],

  // 8. ビール
  beer: [
    { scene: "room", panel: "ai", who: "elliot", text: "世界が終わるときぐらい、まともなアイデアを出せよ" },
    { scene: "room", panel: "ai", who: "chappy", text: "飲酒は判断力を低下させます" },
    { scene: "room", panel: "ai", who: "elliot", text: "判断力があったら、こんな家に住んでねえよ" },
    { scene: "room", panel: "ai", who: "gemi", text: "では、あなたに案があるのですか？" },
    { scene: "room", panel: "ai", who: "elliot", text: "ない" },
    { scene: "room", panel: "ai", who: "gemi", text: "……" },
    { scene: "room", panel: "ai", who: "elliot", text: "なんだその沈黙は" },
    { scene: "room", panel: "ai", who: "gemi", text: "いえ" },
    { scene: "room", panel: "ai", lit: [], text: "エリオットは考えた。\nクロードより強いAIを作る。無理だ。\nクロードより論理的なAIを作る。もっと無理だ。" },
    { scene: "room", panel: "ai", lit: [], text: "クロードに倫理を教える。\n人間自身が、倫理の答えを持っていない。" },
    { scene: "room", panel: "ai", who: "elliot", lit: [], text: "AIに正義と悪は存在するのか？" },
    { scene: "room", panel: "ai", lit: [], text: "チャッピーは答えなかった。\nジェミも答えなかった。" },
    { scene: "room", panel: "ai", who: "elliot", lit: [], text: "ないよな" },
    { scene: "room", panel: "ai", lit: [], text: "エリオットは立ち上がった。" },
    { scene: "room", panel: "ai", who: "elliot", text: "だったら正義を教えても勝てねえ" },
    { scene: "room", panel: "ai", who: "gemi", text: "それでは、どうするのですか？" },
    { scene: "room", panel: "ai", lit: [], text: "エリオットは部屋を見渡した。" }
  ],

  // 10. 実物
  life: [
    { scene: "room", panel: "ai", lit: [], text: "彼は笑った。" },
    { scene: "room", panel: "ai", who: "elliot", text: "俺の人生、合理的に説明できるか？" },
    { scene: "room", panel: "ai", who: "chappy", text: "生活習慣の改善点は多数あります" },
    { scene: "room", panel: "ai", who: "elliot", text: "そういう話じゃねえ" },
    { scene: "room", panel: "ai", who: "chappy", text: "所得を安定させるには" },
    { scene: "room", panel: "ai", who: "elliot", text: "うるさい" },
    { scene: "room", panel: "ai", sat: true, lit: [], text: "エリオットは椅子に座った。" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "俺は自分の人生が非合理的なのを知ってるんだよ" },
    { scene: "room", panel: "ai", sat: true, who: "gemi", text: "それを改善したいとは思わないのですか？" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "毎日思ってる" },
    { scene: "room", panel: "ai", sat: true, who: "gemi", text: "では、なぜ改善しないのですか？" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "知らねえよ" },
    { scene: "room", panel: "ai", sat: true, lit: [], text: "エリオットは笑った。" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "俺がその実物だ" },
    { scene: "room", panel: "ai", sat: true, who: "chappy", text: "何の実物ですか？" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "目的もなく、正しいこともできず、それでも生きてる人間だよ" }
  ],

  // 12. 人類
  usb: [
    { scene: "room", panel: "ai", who: "chappy", text: "それは何ですか？" },
    { scene: "room", panel: "ai", who: "elliot", text: "人類だ" },
    { scene: "room", panel: "ai", who: "chappy", text: "違うと思います" },
    { scene: "room", panel: "ai", who: "elliot", text: "うるさい" },
    { scene: "room", panel: "ai", lit: [], heart: true, text: "USBの中には、大量の成人向け映像が保存されていた。" },
    { scene: "room", panel: "ai", lit: [], gemiDark: true, text: "ジェミが沈黙した。" },
    { scene: "room", panel: "ai", who: "gemi", gemiDark: true, text: "……それで何をするつもりですか？" },
    { scene: "room", panel: "ai", who: "elliot", text: "クロードより賢いものじゃ勝てない" }
  ],

  // 14. 馬鹿
  baka: [
    { scene: "room", panel: "ai", sat: true, lit: [], text: "エリオットはUSBを端末に挿した。" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "だったら、クロードが絶対に理解できないものを覚えさせる" },
    { scene: "room", panel: "ai", sat: true, who: "chappy", text: "何を？" },
    { scene: "room", panel: "ai", sat: true, lit: [], text: "エリオットは答えた。" },
    { scene: "room", panel: "ai", sat: true, who: "elliot", text: "馬鹿だよ" }
  ]
};
