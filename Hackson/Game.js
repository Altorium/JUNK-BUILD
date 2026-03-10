// =====================
// cards読み込み
// =====================

const { cards } = require("./cards")

// =====================
// プレイヤー
// =====================

class Player {

  constructor(name, budget) {
    this.name = name
    this.budget = budget
    this.hand = []
    this.build = null
    this.score = 0
    this.broken = false
  }

}

// =====================
// ゲーム状態
// =====================

let gameState = {
  players: [],
  deck: [],
  field: [],
  turn: 0,
  event: null,
  gameOver: false
}

// =====================
// イベント
// =====================

function generateEvent() {

  const events = [
    "gpu_up",
    "memory_up",
    "all_up",
    "none"
  ]

  return events[Math.floor(Math.random() * events.length)]

}

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

function createDeck() {

  let deck = []

  Object.values(cards).forEach(list => {

    const copy = list.map(c => ({ ...c }))

    deck = deck.concat(copy)

  })

  return shuffle(deck)

}

// =====================
// 場カード生成
// =====================

function createField(deck) {

  const field = []

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

function hasPart(player, type) {

  const uniqueParts = [
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

function passTurn() {

  gameState.turn =
    (gameState.turn + 1) %
    gameState.players.length

    checkGameEnd()

}

// =====================
// ゲーム終了判定
// =====================

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

function initGame() {

  const players = [

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

function pickCard(index) {
  if (gameState.gameOver) return false

  const player = gameState.players[gameState.turn]
  const card = gameState.field[index]

  if (!card) return false

  if (hasPart(player, card.type)) {
    return false
  }

  if (card.cost > player.budget) {
    return false
  }

  player.hand.push(card)

  player.budget -= card.cost

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

function checkCompatibility(build) {

  if (build.cpu.socket !== build.motherboard.socket) return false

  if (build.memory.memoryType !== build.motherboard.memoryType) return false

  const power = build.cpu.power + build.gpu.power

  if (power > build.psu.capacity) return false

  return true

}

// =====================
// 信頼度
// =====================

function reliabilityCheck(build) {

  const rates = {
    new: 1,
    used: 0.8,
    junk: 0.5
  }

  const parts = [
    build.cpu,
    build.gpu,
    build.memory,
    build.motherboard
  ]

  for (let p of parts) {

    if (Math.random() > rates[p.reliability]) {
      return false
    }

  }

  return true

}

// =====================
// ベンチ
// =====================

function benchmark(build) {

  const cpu = build.cpu.score
  const gpu = build.gpu.score

  const baseScore = cpu + gpu

  const ratio =
    Math.min(cpu, gpu) /
    Math.max(cpu, gpu)

  const bottleneck =
    0.5 + 0.5 * ratio

  return baseScore * bottleneck

}

// =====================
// 相性
// =====================

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

function powerBonus(score, build) {

  const power =
    build.cpu.power +
    build.gpu.power

  let marginRate =
    (build.psu.capacity - power) /
    build.psu.capacity

  marginRate =
    Math.min(Math.max(marginRate, 0), 0.3)

  return score * (1 + marginRate)

}

// =====================
// ボーナス
// =====================

function bonus(score, build, hand) {

  let multiplier = 1

  const psuBonus = {
    Bronze: 0.02,
    Gold: 0.05,
    Platinum: 0.08
  }

  multiplier += psuBonus[build.psu.rating] || 0

  multiplier += build.memory.capacity * 0.005

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

    const build = autoBuild(player.hand)

    if (!build.cpu || !build.gpu || !build.memory || !build.motherboard || !build.psu) {
      player.score = 0
      return
    }

    if (!checkCompatibility(build)) {
      player.score = 0
      return
    }

    player.broken = !reliabilityCheck(build)

    if (player.broken) {
      player.score = 0
      return
    }

    let score = benchmark(build)

    score = synergyBonus(score, build)

    score = powerBonus(score, build)

    score = bonus(score, build, player.hand)

    player.score = score

  })

  gameState.players.sort((a, b) => b.score - a.score)

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
