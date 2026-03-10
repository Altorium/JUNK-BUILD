// ui-draft.js

// =====================
// 画面切り替え（全体共通）
// =====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
}

// =====================
// ゲーム状態
// =====================
let players = []
let deck    = []
let field   = []

// ドラフト管理
let draftOrder      = [0, 1, 2, 3]
let draftOrderIndex = 0
let draftRound      = 1
let selectedCard    = null

// セットフェーズ管理
let currentBuild = {}   // { cpu, gpu, memory, motherboard, psu }

const HUMAN_INDEX = 0   // P1が人間
const CPU_DELAY_MS = 600  // CPUの自動ピック間隔（ms）

// =====================
// カードのカテゴリ判定
// =====================
function getCardType(card) {
  if (card.socket && card.score !== undefined)                        return 'CPU'
  if (card.score !== undefined && !card.socket)                       return 'GPU'
  if (card.memoryType && card.capacity !== undefined && !card.socket) return 'MEM'
  if (card.memoryType && card.socket)                                 return 'MB'
  if (card.rating !== undefined)                                      return 'PSU'
  return 'SUP'
}

// =====================
// カードのステータスHTML生成
// =====================
function buildStatsHTML(card) {
  const type = getCardType(card)
  let html = ''
  if (card.score !== undefined)    html += row('スコア',   card.score.toLocaleString())
  if (card.power !== undefined)    html += row('消費電力', card.power + 'W')
  if (card.socket)                 html += row('ソケット', card.socket)
  if (card.memoryType)             html += row('規格',     card.memoryType)
  if (card.capacity !== undefined) {
    const unit = (type === 'PSU') ? 'W' : 'GB'
    html += row('容量', card.capacity + unit)
  }
  if (card.rating)                 html += row('認証',     card.rating)
  if (card.effect)                 html += row('効果',     card.effect)
  return html
}

function row(label, value) {
  return `<span><span>${label}</span><span>${value}</span></span>`
}

// =====================
// カード要素の生成
// =====================
function createCardEl(card) {
  const el = document.createElement('div')
  el.className = 'card'

  const costEl = document.createElement('div')
  costEl.className = 'card-cost'
  costEl.textContent = '¥' + (card.cost ?? '—')

  const typeEl = document.createElement('div')
  typeEl.className = 'card-type'
  typeEl.textContent = getCardType(card)

  const nameEl = document.createElement('div')
  nameEl.className = 'card-name'
  nameEl.textContent = card.name

  const statsEl = document.createElement('div')
  statsEl.className = 'card-stats'
  statsEl.innerHTML = buildStatsHTML(card)

  if (card.reliability) {
    const labels = { new: 'NEW', used: 'USED', junk: 'JUNK' }
    const relEl = document.createElement('div')
    relEl.className = `card-reliability ${card.reliability}`
    relEl.textContent = labels[card.reliability]
    statsEl.appendChild(relEl)
  }

  el.appendChild(costEl)
  el.appendChild(typeEl)
  el.appendChild(nameEl)
  el.appendChild(statsEl)

  return el
}

// =====================
// タイトル画面
// =====================
document.getElementById('btn-start').addEventListener('click', () => {
  initializePlayers()
  renderPrepScreen()
  showScreen('screen-prep')
})

function initializePlayers() {
  players = [
    new Player('あなた', 200),
    new Player('CPU-A',  200),
    new Player('CPU-B',  200),
    new Player('CPU-C',  200),
  ]
}

// =====================
// 準備画面
// =====================
function renderPrepScreen() {
  const budgetList = document.getElementById('budget-list')
  budgetList.innerHTML = ''
  players.forEach(p => {
    const div = document.createElement('div')
    div.className = 'budget-row'
    div.innerHTML = `<span>${p.name}</span><span class="amount">¥${p.budget}</span>`
    budgetList.appendChild(div)
  })

  const event = generateEvent()
  applyEvent(event)

  const eventLabels = {
    gpu_up:    'グラボ高騰：全GPUカードのコストが上昇',
    memory_up: 'メモリ高騰：全メモリカードのコストが上昇',
    all_up:    '半導体不足：全パーツのコストが上昇',
    none:      'イベントなし：通常価格のまま'
  }
  document.getElementById('event-display').textContent = eventLabels[event] ?? event
}

document.getElementById('btn-to-draft').addEventListener('click', () => {
  deck = createDeck()
  field = createField(deck)
  draftOrder      = [0, 1, 2, 3]
  draftOrderIndex = 0
  draftRound      = 1
  selectedCard    = null

  renderDraftScreen()
  showScreen('screen-draft')
})

// =====================
// ドラフト画面：描画
// =====================
function renderDraftScreen() {
  const currentIndex  = draftOrder[draftOrderIndex]
  const currentPlayer = players[currentIndex]
  const isHuman       = currentIndex === HUMAN_INDEX

  document.getElementById('draft-current-player').textContent =
    isHuman ? 'あなたのターン' : `${currentPlayer.name} が選択中…`
  document.getElementById('draft-round').textContent         = `ラウンド ${draftRound}`
  document.getElementById('draft-budget-amount').textContent = `¥${players[HUMAN_INDEX].budget}`

  renderField(currentPlayer, isHuman)
  renderHand()
  renderOtherPlayers()

  selectedCard = null
  document.getElementById('selected-card-preview').textContent = ''
  updatePickButton()

  // CPUターンなら自動処理
  if (!isHuman) {
    setTimeout(processCpuTurn, CPU_DELAY_MS)
  }
}

function renderField(currentPlayer, isHuman) {
  const container = document.getElementById('field-cards')
  container.innerHTML = ''

  const canAffordAny = field.some(c => c.cost <= currentPlayer.budget)

  field.forEach(card => {
    const el = createCardEl(card)
    const affordable = card.cost <= currentPlayer.budget

    if (isHuman && affordable) {
      el.addEventListener('click', () => onFieldCardClick(card, el))
    } else {
      el.classList.add('disabled')
    }

    container.appendChild(el)
  })

  const skipBtn = document.getElementById('btn-skip-turn')
  if (isHuman && !canAffordAny){
    skipBtn.classList.remove('hidden')
  } else {
    skipBtn.classList.add('hidden')
  }
}

function renderHand() {
  const human     = players[HUMAN_INDEX]
  const container = document.getElementById('hand-cards')
  container.innerHTML = ''
  document.getElementById('hand-count').textContent = human.hand.length

  human.hand.forEach(card => {
    const el = createCardEl(card)
    container.appendChild(el)
  })
}

function renderOtherPlayers() {
  const container = document.getElementById('other-players-info')
  container.innerHTML = ''

  players.forEach((p, i) => {
    if (i === HUMAN_INDEX) return
    const span = document.createElement('span')
    span.textContent = `${p.name}: ${p.hand.length}枚`
    container.appendChild(span)
  })
}

// =====================
// ドラフト：人間のカード選択
// =====================
function onFieldCardClick(card, el) {
  document.querySelectorAll('#field-cards .card.selected')
    .forEach(c => c.classList.remove('selected'))

  selectedCard = card
  el.classList.add('selected')

  document.getElementById('selected-card-preview').textContent =
    `選択中: ${card.name}（¥${card.cost}）`

  updatePickButton()
}

function updatePickButton() {
  document.getElementById('btn-pick-card').disabled = (selectedCard === null)
}

document.getElementById('btn-pick-card').addEventListener('click', () => {
  if (!selectedCard) return
  pickCard(HUMAN_INDEX, selectedCard)
  nextDraftTurn()
})

document.getElementById('btn-skip-turn').addEventListener('click', () => {
  nextDraftTurn()
})

// =====================
// ドラフト：CPUの自動ピック
// =====================
function processCpuTurn() {
  const currentIndex  = draftOrder[draftOrderIndex]
  const currentPlayer = players[currentIndex]

  const available = field.filter(c => c.cost <= currentPlayer.budget)
  if (available.length === 0) {
    // 買えるカードがない場合はスキップ
    nextDraftTurn()
    return
  }

  // スコアが最も高いカードを選ぶ（スコアがなければ最初の1枚）
  const pick = available.reduce((best, card) => {
    return (card.score ?? 0) > (best.score ?? 0) ? card : best
  }, available[0])

  pickCard(currentIndex, pick)
  nextDraftTurn()
}

// =====================
// カードを取る共通処理
// =====================
function pickCard(playerIndex, card) {
  const player = players[playerIndex]
  player.hand.push(card)
  player.budget -= card.cost

  field.splice(field.indexOf(card), 1)
  if (deck.length > 0) {
    field.push(deck.shift())
  }
}

// =====================
// ドラフト：次のターンへ
// =====================
function nextDraftTurn() {
  draftOrderIndex++

  if (draftOrderIndex >= draftOrder.length) {
    draftOrderIndex = 0
    draftRound++
    draftOrder.reverse()
  }

  // 全員の手札が8枚になったらドラフト終了
  if (draftRound > 8) {
    startSetPhase()
    return
  }

  renderDraftScreen()
}

// =====================
// セットフェーズ開始
// =====================
function startSetPhase() {
  // CPUプレイヤーはautoBuildで自動組み立て
  players.forEach((p, i) => {
    if (i !== HUMAN_INDEX) {
      p.build = autoBuild(p.hand)
    }
  })

  // 人間プレイヤーのセット画面へ
  currentBuild = { cpu: null, gpu: null, memory: null, motherboard: null, psu: null }
  document.getElementById('set-player-name').textContent = players[HUMAN_INDEX].name

  renderSetHand()
  clearSlots()
  document.getElementById('compatibility-check-result').textContent = ''
  document.getElementById('btn-boot').disabled = true

  showScreen('screen-set')
}

// =====================
// セット画面：手札描画
// =====================
function renderSetHand() {
  const player    = players[HUMAN_INDEX]
  const container = document.getElementById('set-hand-cards')
  container.innerHTML = ''

  player.hand.forEach(card => {
    const el      = createCardEl(card)
    const type    = getCardType(card)
    const slotKey = typeToSlotKey(type)

    if (slotKey) {
      el.addEventListener('click', () => onSetCardClick(card, el, slotKey))
    } else {
      el.style.opacity = '0.5'
    }

    container.appendChild(el)
  })
}

function typeToSlotKey(type) {
  const map = { CPU: 'cpu', GPU: 'gpu', MEM: 'memory', MB: 'motherboard', PSU: 'psu' }
  return map[type] ?? null
}

// =====================
// セット画面：スロットへ割り当て
// =====================
function onSetCardClick(card, el, slotKey) {
  // 同スロットに既存カードがあれば手札に戻す
  if (currentBuild[slotKey]) {
    restoreCardToHand(currentBuild[slotKey])
  }

  currentBuild[slotKey] = card
  el.style.opacity       = '0.35'
  el.style.pointerEvents = 'none'

  updateSlotDisplay(slotKey, card)
  checkAllSlotsFilled()
}

function restoreCardToHand(card) {
  document.querySelectorAll('#set-hand-cards .card').forEach(el => {
    if (el.querySelector('.card-name')?.textContent === card.name) {
      el.style.opacity       = ''
      el.style.pointerEvents = ''
    }
  })
}

function updateSlotDisplay(slotKey, card) {
  const slotCard = document.querySelector(`#slot-${slotKey} .slot-card`)
  if (!slotCard) return
  slotCard.textContent = card.name
  slotCard.classList.add('filled')
}

function clearSlots() {
  ['cpu', 'gpu', 'memory', 'motherboard', 'psu'].forEach(key => {
    const slotCard = document.querySelector(`#slot-${key} .slot-card`)
    if (!slotCard) return
    slotCard.textContent = ''
    slotCard.classList.remove('filled')
  })
}

function checkAllSlotsFilled() {
  const allFilled = Object.values(currentBuild).every(v => v !== null)
  document.getElementById('btn-boot').disabled = !allFilled
}

// =====================
// PCを起動する
// =====================
document.getElementById('btn-boot').addEventListener('click', () => {
  players[HUMAN_INDEX].build = { ...currentBuild }
  // ui-boot.js に制御を渡す
  startBoot(players[HUMAN_INDEX])
})