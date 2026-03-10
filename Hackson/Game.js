// =====================
// 型定義 (JSDoc)
// =====================

/**
 * @typedef {Object} Card カードの型定義
 * @property {string} type - パーツの種類 ("cpu", "gpu", "memory", "motherboard", "psu" など)
 * @property {number} cost - 価格（コスト）
 * @property {"new"|"used"|"junk"} [reliability] - 信頼度
 * @property {string}[brand] - メーカー・ブランド ("AMD", "Intel", "NVIDIA" など)
 * @property {string} [socket] - CPUソケット形状
 * @property {string} [memoryType] - メモリ規格 (例: "DDR4")
 * @property {number} [power] - 消費電力 (W)
 * @property {number} [capacity] - 容量 (メモリのGB、またはPSUのW)
 * @property {number} [score] - ベンチマークスコア
 * @property {"Bronze"|"Gold"|"Platinum"} [rating] - PSUの評価
 * @property {string} [effect] - 特殊効果 (例: "5%プラス")
 */

/**
 * @typedef {Object} Build PC構成の型定義
 * @property {Card|undefined} cpu
 * @property {Card|undefined} gpu
 * @property {Card|undefined} memory
 * @property {Card|undefined} motherboard
 * @property {Card|undefined} psu
 */

/**
 * @typedef {Object} GameState ゲーム状態の型定義
 * @property {Player[]} players - プレイヤー一覧
 * @property {Card[]} deck - 山札
 * @property {Card[]} field - 場のカード
 * @property {number} turn - 現在のターンのプレイヤーインデックス
 * @property {string|null} event - 現在のイベント
 * @property {boolean} gameOver - ゲーム終了判定フラグ
 */

// =====================
// プレイヤー
// =====================

/**
 * プレイヤークラス
 */
class Player {
  /**
   * @param {string} name - プレイヤー名
   * @param {number} budget - 初期予算
   */
  constructor(name, budget) {
    /** @type {string} プレイヤー名 */
    this.name = name
    /** @type {number} 残予算 */
    this.budget = budget
    /** @type {Card[]} 手札 */
    this.hand =[]
    /** @type {Build|null} 最終的な構成 */
    this.build = null
    /** @type {number} 最終スコア */
    this.score = 0
    /** @type {boolean} 故障フラグ */
    this.broken = false
  }
}

// =====================
// ゲーム状態
// =====================

/** @type {GameState} */
let gameState = {
  players: [],
  deck: [],
  field:[],
  turn: 0,
  event: null,
  gameOver: false
}

// =====================
// イベント
// =====================

/**
 * ランダムなイベントを生成する
 * @returns {string} イベント名
 */
function generateEvent() {
  const events =[
    "gpu_up",
    "memory_up",
    "all_up",
    "none"
  ]
  return events[Math.floor(Math.random() * events.length)]
}

/**
 * イベントを山札に適用する
 * @param {string} event - イベント名
 * @param {Card[]} deck - 山札
 */
function applyEvent(event, deck) {
  if (event === "gpu_up") {
    deck.forEach(c => {
      if (c.type === "gpu") c.cost += 5
    })
  }

  if (event === "memory_up") {
    deck.forEach(c => {
      if (c.type === "memory") c.cost += 3
    })
  }

  if (event === "all_up") {
    deck.forEach(c => {
      if (typeof c.cost === 'number') c.cost += 2
    })
  }
}

// =====================
// シャッフル
// =====================

/**
 * 配列をシャッフルする
 * @param {any[]} array - シャッフルする配列
 * @returns {any[]} シャッフルされた新しい配列
 */
function shuffle(array) {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// =====================
// 山札作成
// =====================

/**
 * 山札(デッキ)を作成する
 * @returns {Card[]} シャッフル済みの山札
 */
function createDeck() {
  /** @type {Card[]} */
  let deck =[]

  Object.values(cards).forEach(list => {
    // 参照渡しを防ぐためディープコピー風に複製
    const copy = list.map(c => ({ ...c }))
    deck = deck.concat(copy)
  })

  return shuffle(deck)
}

// =====================
// 場カード生成
// =====================

/**
 * 初期の場札を生成する
 * @param {Card[]} deck - 山札
 * @returns {Card[]} 場札配列
 */
function createField(deck) {
  /** @type {Card[]} */
  const field =[]

  /**
   * 指定タイプのカードを山札から1枚抜き出す
   * @param {string} type - 抜き出すカードの種類
   * @returns {Card|null}
   */
  const extractCard = (type) => {
    const idx = deck.findIndex(c => c.type === type)
    if (idx !== -1) {
      return deck.splice(idx, 1)[0]
    }
    return null
  }

  field.push(extractCard("cpu"))
  field.push(extractCard("gpu"))
  field.push(extractCard("motherboard"))
  field.push(extractCard("memory"))
  field.push(extractCard("psu"))

  for (let i = 0; i < 3; i++) {
    if (deck.length > 0) {
      field.push(deck.shift())
    }
  }

  return field.filter(c => c !== null)
}

// =====================
// パーツ所持チェック
// =====================

/**
 * 指定のパーツを既に手札に持っているかチェック
 * @param {Player} player - プレイヤー
 * @param {string} type - パーツの種類
 * @returns {boolean} 持っていればtrue
 */
function hasPart(player, type) {
  const uniqueParts =[
    "cpu",
    "gpu",
    "memory",
    "motherboard",
    "psu"
  ]

  if (!uniqueParts.includes(type)) return false

  return player.hand.some(c => c.type === type)
}

// =====================
// ターンパス
// =====================

/**
 * ターンを次のプレイヤーへ回す
 */
function passTurn() {
  gameState.turn =
    (gameState.turn + 1) %
    gameState.players.length

  checkGameEnd()
}

// =====================
// ゲーム終了判定
// =====================

/**
 * ゲームの終了条件を満たしているかチェックする
 */
function checkGameEnd(){
  const allFull =
    gameState.players.every(
      p => p.hand.length >= 8
    )
  
  // 山札も場札も無くなった場合も終了とする
  const noCardsLeft = 
    gameState.deck.length === 0 && gameState.field.length === 0

  if(allFull || noCardsLeft){
    gameState.gameOver = true
  }
}

// =====================
// ゲーム開始
// =====================

/**
 * ゲームを初期化して開始する
 * @returns {GameState} 初期化後のゲーム状態
 */
function initGame() {
  const players =[
    new Player("P1", 20),
    new Player("P2", 20),
    new Player("P3", 20),
    new Player("P4", 20)
  ]

  const deck = createDeck()
  const event = generateEvent()

  applyEvent(event, deck)

  const field = createField(deck)

  gameState.players = players
  gameState.deck = deck
  gameState.field = field
  gameState.turn = 0
  gameState.event = event
  gameState.gameOver = false 

  return gameState
}

// =====================
// カード取得
// =====================

/**
 * 場札からカードを取得する
 * @param {number} index - 取得する場札のインデックス
 * @returns {boolean} 取得に成功した場合はtrue、失敗した場合はfalse
 */
function pickCard(index) {
  if (gameState.gameOver) return false

  const player = gameState.players[gameState.turn]
  const card = gameState.field[index]

  if (!card) return false
  if (hasPart(player, card.type)) return false
  if (card.cost > player.budget) return false

  // カードを手札に加え、予算を減らす
  player.hand.push(card)
  player.budget -= card.cost

  // 場札から削除し、可能なら山札から補充
  gameState.field.splice(index, 1)
  if (gameState.deck.length > 0) {
    gameState.field.push(gameState.deck.shift())
  }

  passTurn()
  checkGameEnd()

  return true
}

// =====================
// 互換チェック 
// =====================

/**
 * PC構成の互換性をチェックする
 * @param {Build} build - 組み立てたPC構成
 * @param {string} playerName - プレイヤー名（ログ出力用）
 * @returns {boolean} 互換性があればtrue
 */
function checkCompatibility(build, playerName) {
  // ① CPUソケットのチェック
  if (build.cpu.socket !== build.motherboard.socket) {
    console.log(`❌ [${playerName}] 互換性エラー: CPUソケット不一致`)
    console.log(`   ├─ CPU: ${build.cpu.socket} (${typeof build.cpu.socket})`)
    console.log(`   └─ M/B: ${build.motherboard.socket} (${typeof build.motherboard.socket})`)
    return false
  }

  // ② メモリ規格のチェック
  if (build.memory.memoryType !== build.motherboard.memoryType) {
    console.log(`❌[${playerName}] 互換性エラー: メモリ規格不一致`)
    console.log(`   ├─ Memory: ${build.memory.memoryType} (${typeof build.memory.memoryType})`)
    console.log(`   └─ M/B   : ${build.motherboard.memoryType} (${typeof build.motherboard.memoryType})`)
    return false
  }

  // ③ 電力チェック
  // ※念のためNumber()で数値化して計算します
  const power = Number(build.cpu.power) + Number(build.gpu.power)
  const capacity = Number(build.psu.capacity)
  
  if (power > capacity) {
    console.log(`❌ [${playerName}] 互換性エラー: 電力不足`)
    console.log(`   ├─ 必要電力: ${power}W (CPU: ${build.cpu.power}W + GPU: ${build.gpu.power}W)`)
    console.log(`   └─ 電源容量: ${capacity}W`)
    return false
  }

  return true
}

// =====================
// 信頼度 
// =====================

/**
 * 構成パーツが故障しないかチェックする
 * @param {Build} build - 組み立てたPC構成
 * @param {string} playerName - プレイヤー名（ログ出力用）
 * @returns {boolean} 故障しなければtrue（成功）
 */
function reliabilityCheck(build, playerName) {
  const rates = {
    new: 1,      // 100%成功
    used: 0.8,   // 80%成功
    junk: 0.5    // 50%成功
  }

  // どのパーツが壊れたか分かるようにラベルを付ける
  const parts =[
    { label: "CPU", data: build.cpu },
    { label: "GPU", data: build.gpu },
    { label: "Memory", data: build.memory },
    { label: "Motherboard", data: build.motherboard },
    { label: "PSU", data: build.psu } 
  ]

  for (let p of parts) {
    const rel = p.data.reliability || "new"
    const successRate = rates[rel]

    // 乱数と確率を比較
    const roll = Math.random()
    if (roll > successRate) {
      console.log(`💥 [${playerName}] 起動失敗: パーツが故障しました！`)
      console.log(`   └─ 原因パーツ: ${p.label} (状態: ${rel}, 成功率: ${successRate * 100}%)`)
      return false
    }
  }

  return true
}

// =====================
// ベンチ
// =====================

/**
 * PCのベーススコアを計算する（ボトルネック考慮）
 * @param {Build} build - 組み立てたPC構成
 * @returns {number} ベーススコア
 */
function benchmark(build) {
  const cpu = build.cpu.score || 0
  const gpu = build.gpu.score || 0

  const baseScore = cpu + gpu
  const ratio = Math.min(cpu, gpu) / Math.max(cpu, gpu)
  const bottleneck = 0.5 + 0.5 * ratio

  return baseScore * bottleneck
}

// =====================
// 相性
// =====================

/**
 * CPUとGPUのメーカーシナジーボーナスを計算
 * @param {number} score - 現在のスコア
 * @param {Build} build - PC構成
 * @returns {number} 計算後のスコア
 */
function synergyBonus(score, build) {
  let multiplier = 1

  if (build.cpu.brand === "AMD" && build.gpu.brand === "AMD") {
    multiplier += 0.1
  }
  if (build.cpu.brand === "Intel" && build.gpu.brand === "NVIDIA") {
    multiplier += 0.05
  }

  return score * multiplier
}

// =====================
// 電源余裕
// =====================

/**
 * 電源容量の余裕によるボーナスを計算
 * @param {number} score - 現在のスコア
 * @param {Build} build - PC構成
 * @returns {number} 計算後のスコア
 */
function powerBonus(score, build) {
  const power = build.cpu.power + build.gpu.power
  let marginRate = (build.psu.capacity - power) / build.psu.capacity

  marginRate = Math.min(Math.max(marginRate, 0), 0.3)

  return score * (1 + marginRate)
}

// =====================
// ボーナス
// =====================

/**
 * その他のボーナス計算（PSU品質、メモリ容量、手札エフェクト）
 * @param {number} score - 現在のスコア
 * @param {Build} build - PC構成
 * @param {Card[]} hand - プレイヤーの手札
 * @returns {number} 最終スコア（整数切り捨て）
 */
function bonus(score, build, hand) {
  let multiplier = 1

  const psuBonus = {
    Bronze: 0.02,
    Gold: 0.05,
    Platinum: 0.08
  }

  multiplier += psuBonus[build.psu.rating] || 0
  multiplier += (build.memory.capacity || 0) * 0.005

  hand.forEach(c => {
    if (c.effect === "5%プラス") {
      multiplier += 0.05
    }
  })

  return Math.floor(score * multiplier)
}

// =====================
// PC構成
// =====================

/**
 * 手札から必須パーツを抽出して構成を作成する
 * @param {Card[]} hand - 手札
 * @returns {Build} 組まれた構成オブジェクト
 */
function autoBuild(hand) {
  return {
    cpu: hand.find(c => c.type === "cpu"),
    gpu: hand.find(c => c.type === "gpu"),
    memory: hand.find(c => c.type === "memory"),
    motherboard: hand.find(c => c.type === "motherboard"),
    psu: hand.find(c => c.type === "psu")
  }
}

// =====================
// 結果計算
// =====================

function calculateResult() {

  gameState.players.forEach(player => {

    console.log("\n==============================")
    console.log("PLAYER:", player.name)
    console.log("==============================")

    const build = autoBuild(player.hand)

    console.log("build:", build)

    if (!build.cpu || !build.gpu || !build.memory || !build.motherboard || !build.psu) {
      console.log("Missing parts")
      player.score = 0
      return
    }

    // =====================
    // 互換チェック
    // =====================

    const compatibility = checkCompatibility(build)

    console.log("compatibility:", compatibility)

    if (!compatibility) {
      player.score = 0
      return
    }

    // =====================
    // 故障チェック
    // =====================

    player.broken = !reliabilityCheck(build)

    console.log("broken:", player.broken)

    if (player.broken) {
      player.score = 0
      return
    }

    // =====================
    // ベンチ計算
    // =====================

    const cpu = build.cpu.score || 0
    const gpu = build.gpu.score || 0

    const baseScore = cpu + gpu

    const ratio =
      Math.min(cpu, gpu) /
      Math.max(cpu, gpu)

    const bottleneck =
      0.5 + 0.5 * ratio

    let score = baseScore * bottleneck

    console.log("CPU score:", cpu)
    console.log("GPU score:", gpu)
    console.log("Base score:", baseScore)
    console.log("Ratio:", ratio)
    console.log("Bottleneck:", bottleneck)
    console.log("After benchmark:", score)

    // =====================
    // シナジー
    // =====================

    const beforeSynergy = score
    score = synergyBonus(score, build)

    console.log("Synergy before:", beforeSynergy)
    console.log("Synergy after:", score)

    // =====================
    // 電源余裕
    // =====================

    const power =
      (build.cpu.power || 0) +
      (build.gpu.power || 0)

    const marginRate =
      (build.psu.capacity - power) /
      build.psu.capacity

    console.log("Power usage:", power)
    console.log("PSU capacity:", build.psu.capacity)
    console.log("Power margin rate:", marginRate)

    const beforePower = score
    score = powerBonus(score, build)

    console.log("Power bonus before:", beforePower)
    console.log("Power bonus after:", score)

    // =====================
    // その他ボーナス
    // =====================

    console.log("Memory capacity:", build.memory.capacity)
    console.log("PSU rating:", build.psu.rating)

    console.log("Hand effects:")
    player.hand.forEach(c => {
      if (c.effect) {
        console.log("-", c.effect)
      }
    })

    const beforeBonus = score
    score = bonus(score, build, player.hand)

    console.log("Bonus before:", beforeBonus)
    console.log("Final score:", score)

    player.score = score

  })

  console.log("\n====== RESULT ======")

  // スコアの降順（高い順）にソート
  gameState.players.sort((a, b) => b.score - a.score)

  gameState.players.forEach((p, i) => {
    console.log(
      `${i + 1}位`,
      p.name,
      "score:",
      p.score
    )
  })

  return gameState.players
}
// =====================
// exports
// =====================

module.exports = {
  gameState,
  initGame,
  pickCard,
  passTurn,
  calculateResult
}




