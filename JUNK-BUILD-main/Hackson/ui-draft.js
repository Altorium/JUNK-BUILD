// ui-draft.js
import { initSync, watchGameState, stopGameState, pickCard, skipTurn } from './sync.js';
// =====================
// 画面切り替え（全体共通）
// =====================
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'))
  document.getElementById(id).classList.remove('hidden')
}

// =====================
// ゲーム状態
// =====================
export let players = []
export let deck = []
let field = []

// ドラフト管理
let draftOrder = [0, 1, 2, 3]
let draftOrderIndex = 0
let draftRound = 1
let selectedCard = null

// セットフェーズ管理
export let currentBuild = {}   // { cpu, gpu, memory, motherboard, psu }

// 高騰イベント（準備画面で決定し、デッキ生成後に適用する）
let currentEvent = null

const HUMAN_INDEX = 0   // P1が人間（ソロモード用）
const CPU_DELAY_MS = 600  // CPUの自動ピック間隔（ms）

export let myUid = null      // null=ソロモード、UIDあり=オンラインモード
let onlineTurn = 0         // Firestoreから来るturn（オンラインのみ使用）
let onlineDraftRound = 1   // Firestoreから来るdraftRound（オンラインのみ使用）

// 「自分」のプレイヤーインデックスを返す
export function getMyIndex() {
  if (myUid === null) return HUMAN_INDEX
  return players.findIndex(p => p.id === myUid)
}

// オンライン時、Firestoreから受け取った全プレイヤーで上書きする
export function setPlayers(p) { players = p }

// 「今のターン」のプレイヤーインデックスを返す
function getCurrentTurnIndex() {
  if (myUid === null) return draftOrder[draftOrderIndex]
  return onlineTurn
}

// =====================
// カードのカテゴリ判定
// =====================
export function getCardType(card) {
  if (card.socket && card.score !== undefined) return 'CPU'
  if (card.score !== undefined && !card.socket) return 'GPU'
  if (card.memoryType && card.capacity !== undefined && !card.socket) return 'MEM'
  if (card.memoryType && card.socket) return 'MB'
  if (card.rating !== undefined) return 'PSU'
  return 'SUP'
}

// =====================
// カードのステータスHTML生成
// =====================
function buildStatsHTML(card) {
  const type = getCardType(card)
  let html = ''
  if (card.score !== undefined) html += row('スコア', card.score.toLocaleString())
  if (card.power !== undefined) html += row('消費電力', card.power + 'W')
  if (card.socket) html += row('ソケット', card.socket)
  if (card.memoryType) html += row('規格', card.memoryType)
  if (card.capacity !== undefined) {
    const unit = (type === 'PSU') ? 'W' : 'GB'
    html += row('容量', card.capacity + unit)
  }
  if (card.rating) html += row('認証', card.rating)
  if (card.effect) html += row('効果', card.effect)
  return html
}

function row(label, value) {
  return `<span><span>${label}</span><span>${value}</span></span>`
}

// =====================
// カード要素の生成
// =====================
const cardTypeImageMap = {
  cpu: 'images/computer_cpu.png',
  gpu: 'images/computer_gpu.png',
  memory: 'images/computer_memory.png',
  motherboard: 'images/computer_motherboard.png',
  psu: 'images/computer_dengen_unit.png',
  support: 'images/computer_support.png'
}

export function createCardEl(card) {
  const el = document.createElement('div')
  el.className = 'card'

  const costEl = document.createElement('div')
  costEl.className = 'card-cost'
  costEl.textContent = '¥' + (card.cost ?? '—')

  const typeEl = document.createElement('div')
  const typeClassMap = { CPU: 'cpu', GPU: 'gpu', MEM: 'mem', MB: 'mb', PSU: 'psu', SUP: 'sup' }
  const typeKey = getCardType(card)
  typeEl.className = `card-type card-type-${typeClassMap[typeKey] ?? 'sup'}`
  typeEl.textContent = typeKey

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
    new Player('あなた', 130),
    new Player('CPU-A', 130),
    new Player('CPU-B', 130),
    new Player('CPU-C', 130),
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

  currentEvent = generateEvent()

  const eventLabels = {
    gpu_up: 'グラボ高騰：全GPUカードのコストが上昇',
    memory_up: 'メモリ高騰：全メモリカードのコストが上昇',
    all_up: '半導体不足：全パーツのコストが上昇',
    none: 'イベントなし：通常価格のまま'
  }
  document.getElementById('event-display').textContent = eventLabels[currentEvent] ?? currentEvent
}

document.getElementById('btn-to-draft').addEventListener('click', () => {
  deck = createDeck()
  applyEvent(currentEvent, deck)
  field = createField(deck)
  draftOrder = [0, 1, 2, 3]
  draftOrderIndex = 0
  draftRound = 1
  selectedCard = null

  renderDraftScreen()
  showScreen('screen-draft')
})

// =====================
// ドラフト画面：描画
// =====================
function renderDraftScreen() {
  const currentIndex = getCurrentTurnIndex()
  const currentPlayer = players[currentIndex]
  const myIndex = getMyIndex()
  const isMyTurn = currentIndex === myIndex

  document.getElementById('draft-current-player').textContent =
    isMyTurn ? 'あなたのターン' : `${currentPlayer.name} が選択中…`
  const currentRound = myUid !== null ? onlineDraftRound : draftRound
  document.getElementById('draft-round').textContent = `ラウンド ${currentRound}`
  document.getElementById('draft-budget-amount').textContent = `¥${players[myIndex].budget}`

  renderField(currentPlayer, isMyTurn)
  renderHand(myIndex)
  renderOtherPlayers(myIndex)

  selectedCard = null
  document.getElementById('selected-card-preview').textContent = ''
  updatePickButton()

  // ソロモードのみCPU自動処理
  if (!isMyTurn && myUid === null) {
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
  if (isHuman && !canAffordAny) {
    skipBtn.classList.remove('hidden')
  } else {
    skipBtn.classList.add('hidden')
  }
}

function renderHand(myIndex = HUMAN_INDEX) {
  const human = players[myIndex]
  const container = document.getElementById('hand-cards')
  container.innerHTML = ''
  document.getElementById('hand-count').textContent = human.hand.length

  human.hand.forEach(card => {
    const el = createCardEl(card)
    container.appendChild(el)
  })
}

function renderOtherPlayers(myIndex = HUMAN_INDEX) {
  const container = document.getElementById('other-players-info')
  container.innerHTML = ''

  players.forEach((p, i) => {
    if (i === myIndex) return
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

document.getElementById('btn-pick-card').addEventListener('click', async () => {
  if (!selectedCard) return
  if (myUid !== null) {
    const fieldIndex = field.indexOf(selectedCard)
    await pickCard(fieldIndex)         // オンライン：Firestoreを更新
  } else {
    const currentIndex = getCurrentTurnIndex()
    pickCardLocal(currentIndex, selectedCard)  // ソロ：ローカル処理
    nextDraftTurn()
  }
})

document.getElementById('btn-skip-turn').addEventListener('click', async () => {
  if (myUid !== null) {
    await skipTurn()   // オンライン：Firestoreのturnを進める
  } else {
    nextDraftTurn()    // ソロ：ローカルで次のターンへ
  }
})

// =====================
// ドラフト：CPUの自動ピック
// =====================
function processCpuTurn() {
  const currentIndex = draftOrder[draftOrderIndex]
  const currentPlayer = players[currentIndex]

  const uniqueTypes = ['cpu', 'gpu', 'memory', 'motherboard', 'psu']

  // 予算内 かつ 未取得タイプのみ
  const baseAvailable = field.filter(c => {
    if (c.cost > currentPlayer.budget) return false
    if (uniqueTypes.includes(c.type) && currentPlayer.hand.some(h => h.type === c.type)) return false
    return true
  })

  // 互換性の絞り込み
  const heldCpu = currentPlayer.hand.find(c => c.type === 'cpu')
  const heldMb = currentPlayer.hand.find(c => c.type === 'motherboard')

  let available = baseAvailable.filter(c => {
    // マザーボード：手持ちCPUのソケットに合うもの
    if (c.type === 'motherboard' && heldCpu) return c.socket === heldCpu.socket
    // メモリ：手持ちマザーボードの規格に合うもの
    if (c.type === 'memory' && heldMb) return c.memoryType === heldMb.memoryType
    return true
  })

  // 互換フィルター後に空なら互換なしのリストにフォールバック
  if (available.length === 0) available = baseAvailable

  // それでも空なら重複タイプOK・予算内なら何でも買う
  if (available.length === 0) {
    available = field.filter(c => c.cost <= currentPlayer.budget)
  }

  // 予算が尽きて何も買えない場合のみスキップ
  if (available.length === 0) {
    nextDraftTurn()
    return
  }

  // スコアが最も高いカードを選ぶ（スコアがなければ最初の1枚）
  const pick = available.reduce((best, card) => {
    return (card.score ?? 0) > (best.score ?? 0) ? card : best
  }, available[0])

  pickCardLocal(currentIndex, pick)
  nextDraftTurn()
}

// =====================
// カードを取る共通処理
// =====================
function pickCardLocal(playerIndex, card) {
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
  const myIndex = getMyIndex()

  // ソロモードのみCPUプレイヤーを自動組み立て
  if (myUid === null) {
    players.forEach((p, i) => {
      if (i !== myIndex) p.build = autoBuild(p.hand)
    })
  }

  currentBuild = { cpu: null, gpu: null, memory: null, motherboard: null, psu: null }
  document.getElementById('set-player-name').textContent = players[myIndex].name

  renderSetHand(myIndex)
  clearSlots()
  document.getElementById('compatibility-check-result').textContent = ''
  document.getElementById('btn-boot').disabled = true

  const required = ['CPU', 'GPU', 'MEM', 'MB', 'PSU']
  const hand = players[myIndex].hand
  const canBuild = required.every(t => hand.some(c => getCardType(c) === t))
  document.getElementById('btn-set-skip').classList.toggle('hidden', canBuild)

  showScreen('screen-set')
}

// =====================
// セット画面：手札描画
// =====================
function renderSetHand(myIndex = HUMAN_INDEX) {
  const player = players[myIndex]
  const container = document.getElementById('set-hand-cards')
  container.innerHTML = ''

  player.hand.forEach(card => {
    const el = createCardEl(card)
    const type = getCardType(card)
    const slotKey = typeToSlotKey(type)

    if (slotKey) {
      el.addEventListener('click', () => onSetCardClick(card, el, slotKey))
    } else {
      el.style.opacity = '0.5'
    }

    container.appendChild(el)
  })
}

export function typeToSlotKey(type) {
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
  el.style.opacity = '0.35'
  el.style.pointerEvents = 'none'

  updateSlotDisplay(slotKey, card)
  checkAllSlotsFilled()
}

function restoreCardToHand(card) {
  document.querySelectorAll('#set-hand-cards .card').forEach(el => {
    if (el.querySelector('.card-name')?.textContent === card.name) {
      el.style.opacity = ''
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


const EVENT_LABELS = {
  gpu_up: 'グラボ高騰：全GPUカードのコストが上昇',
  memory_up: 'メモリ高騰：全メモリカードのコストが上昇',
  all_up: '半導体不足：全パーツのコストが上昇',
  none: 'イベントなし：通常価格のまま'
}

export function startOnlineGame(uid) {
  myUid = uid
  document.getElementById('btn-to-draft').classList.add('hidden')

  let prepScreenShown = false

  watchGameState((room) => {
    // ゲーム状態がFirestoreにまだ書き込まれていない場合は待つ
    if (!room.field || !room.deck) return

    players = room.players
    field = room.field
    deck = room.deck
    onlineTurn = room.turn
    onlineDraftRound = room.draftRound || 1

    // ラウンド8終了 or 全員8枚でドラフト終了
    const roundOver = onlineDraftRound > 8
    const allHaveCards = room.players.every(p => p.hand.length >= 8)
    if (roundOver || allHaveCards) {
      stopGameState()
      startSetPhase()
      return
    }

    // 初回のみ：準備画面にイベントと予算を表示し、3秒後にドラフトへ
    if (!prepScreenShown) {
      prepScreenShown = true
      document.getElementById('event-display').textContent = EVENT_LABELS[room.event] ?? room.event ?? ''
      const budgetList = document.getElementById('budget-list')
      budgetList.innerHTML = ''
      room.players.forEach(p => {
        const div = document.createElement('div')
        div.className = 'budget-row'
        div.innerHTML = `<span>${p.name}</span><span class="amount">¥${p.budget}</span>`
        budgetList.appendChild(div)
      })
      setTimeout(() => {
        renderDraftScreen()
        showScreen('screen-draft')
      }, 3000)
      return
    }

    renderDraftScreen()
    showScreen('screen-draft')
  })
}
