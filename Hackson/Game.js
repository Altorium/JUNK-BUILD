// game.js
const { cards } = require("./cards.js")

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
  }

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

function applyEvent(event) {

  if (event === "gpu_up") {
    cards.gpu.forEach(c => c.cost += 5)
  }

  if (event === "memory_up") {
    cards.memory.forEach(c => c.cost += 3)
  }

  if (event === "all_up") {

    Object.values(cards).forEach(list => {

      list.forEach(c => {

        if (c.cost) {
          c.cost += 2
        }

      })

    })

  }

}

// =====================
// シャッフル
// =====================

function shuffle(array) {

  for (let i = array.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1))

    ;[array[i], array[j]] = [array[j], array[i]]

  }

  return array
}

// =====================
// 山札作成
// =====================

function createDeck() {

  let deck = []

  Object.values(cards).forEach(list => {

    deck = deck.concat(list)

  })

  return shuffle(deck)

}

// =====================
// カードを1枚引く
// =====================

function drawRandom(list) {

  const index = Math.floor(Math.random() * list.length)

  return list[index]

}

// =====================
// 場のカード生成
// =====================

function createField(deck) {

  const field = []

  field.push(drawRandom(cards.cpu))
  field.push(drawRandom(cards.gpu))
  field.push(drawRandom(cards.motherboard))
  field.push(drawRandom(cards.psu))

  for (let i = 0; i < 4; i++) {

    field.push(deck.shift())

  }

  return field

}

// =====================
// ドラフト
// =====================

function draft(players, deck) {

  let field = createField(deck)

  let order = [0,1,2,3]

  while (players[0].hand.length < 8) {

    for (let i of order) {

      const player = players[i]

      const available = field.filter(c => c.cost <= player.budget)

      if (available.length === 0) continue

      const pick = available[0]

      player.hand.push(pick)

      player.budget -= pick.cost

      field.splice(field.indexOf(pick),1)

      if (deck.length > 0) {

        field.push(deck.shift())

      }

    }

    order.reverse()

  }

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
// ベンチマーク
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
// CPU/GPU相性ボーナス
// =====================

function synergyBonus(score, build){

  let multiplier = 1

  if (build.cpu.brand === "AMD" && build.gpu.brand === "AMD"){
    multiplier += 0.1
  }

  if (build.cpu.brand === "Intel" && build.gpu.brand === "NVIDIA"){
    multiplier += 0.05
  }

  return score * multiplier

}

// =====================
// 電源余裕ボーナス
// =====================

function powerBonus(score, build) {

  const power = build.cpu.power + build.gpu.power

  let marginRate =
    (build.psu.capacity - power) / build.psu.capacity

  marginRate = Math.min(Math.max(marginRate,0),0.3)

  return score * (1 + marginRate)

}

// =====================
// 得点変動
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
// PC構成（仮）
// =====================

function autoBuild(hand) {

  return {

    cpu: hand.find(c => c.score && c.socket),
    gpu: hand.find(c => c.score && !c.socket),
    memory: hand.find(c => c.capacity && c.memoryType),
    motherboard: hand.find(c => c.memoryType && c.socket),
    psu: hand.find(c => c.rating)

  }

}

// =====================
// ゲーム
// =====================

function playGame() {

  const players = [

    new Player("P1",20),
    new Player("P2",20),
    new Player("P3",20),
    new Player("P4",20)

  ]

  const event = generateEvent()

  console.log("イベント:",event)

  applyEvent(event)

  const deck = createDeck()

  draft(players,deck)

  players.forEach(player => {

    const build = autoBuild(player.hand)

    if (!build) {
      player.score = 0
      return
    }

    if (!checkCompatibility(build)) {
      player.score = 0
      return
    }

    if (!reliabilityCheck(build)) {
      player.score = 0
      return
    }

    let score = benchmark(build)

    score = synergyBonus(score,build)

    score = powerBonus(score,build)

    score = bonus(score,build,player.hand)

    player.score = score

  })

  players.sort((a,b)=>b.score-a.score)

  console.log("結果")

  players.forEach(p => {

    console.log(p.name,p.score)

  })

}

playGame()