// ui-draft.js
import { initSync, watchGameState, stopGameState, skipTurn, updateGameState } from './sync.js';
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

// フェードインアニメーション管理
let fieldCardElements = new Map()    // card → DOM要素（フィールド上の永続要素管理）
let prevHappeningBlindField = false  // blind_field 状態の前回値（変化検出用）
let prevHandLength = 0             // 自分の手札の前回描画時の枚数
let prevOpponentHandLengths = {}   // 相手ごとの前回手札枚数 { playerIndex: number }

const HUMAN_INDEX = 0   // P1が人間（ソロモード用）
const CPU_DELAY_MS = 600  // CPUの自動ピック間隔（ms）

let happeningBlindField = false  // 暗闇のジャンク市: このターンは場の詳細を隠す
let lastHandledTurnKey = ''      // オンライン：処理済みターンキー "turn-round"
let preHappeningInProgress = false  // オンライン：pre-happening モーダル表示中フラグ

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

// =====================
// ハプニングカード
// =====================

const RELIABILITY_ORDER = ['junk', 'used', 'new']

function upgradeRel(rel) {
  const idx = RELIABILITY_ORDER.indexOf(rel || 'new')
  return RELIABILITY_ORDER[Math.min(idx + 1, 2)]
}

function downgradeRel(rel) {
  const idx = RELIABILITY_ORDER.indexOf(rel || 'new')
  return RELIABILITY_ORDER[Math.max(idx - 1, 0)]
}

function applyPreEffect(card, playerIndex) {
  const myIdx = getMyIndex()
  const player = players[myIdx]

  switch (card.id) {
    case 'blind_field':
      happeningBlindField = true
      return '場のパーツの詳細情報がこのターン隠れます...'

    case 'shuffle_field': {
      const prevCount = field.length
      deck.push(...field)
      field.length = 0
      const sh = shuffle([...deck])
      deck.length = 0
      sh.forEach(c => deck.push(c))
      while (field.length < 10 && deck.length > 0) field.push(deck.shift())
      return `場の${prevCount}枚を山札と入れ替えました！`
    }

    case 'field_rel_up': {
      let count = 0
      field.forEach(c => {
        if (c.reliability && c.reliability !== 'new') {
          c.reliability = upgradeRel(c.reliability)
          count++
        }
      })
      return count > 0 ? `場の${count}枚のパーツの信頼度がアップ！` : '効果対象なし（全てNEW）'
    }

    case 'field_rel_down': {
      let count = 0
      field.forEach(c => {
        if (c.reliability && c.reliability !== 'junk') {
          c.reliability = downgradeRel(c.reliability)
          count++
        }
      })
      return count > 0 ? `場の${count}枚のパーツの信頼度がダウン...` : '効果対象なし（全てJUNK）'
    }

    case 'self_budget_up':
      player.budget += 15
      return `所持金が¥15増加！ → ¥${player.budget}`

    case 'opponent_budget_down': {
      let affected = 0
      players.forEach((p, i) => {
        if (i !== myIdx && p.budget > 0) {
          p.budget = Math.max(0, p.budget - 10)
          affected++
        }
      })
      return `${affected}人の相手の所持金が¥10減少！`
    }

    default:
      return ''
  }
}

function applyPostAutoEffect(card, playerIndex) {
  if (card.id !== 'score_boost') return ''
  const player = players[playerIndex]
  const boosted = []
  player.hand.forEach(c => {
    if (c.type === 'cpu' || c.type === 'gpu') {
      const before = c.score || 0
      c.score = before + 500
      boosted.push(`${c.name}: ${before.toLocaleString()} → ${c.score.toLocaleString()}`)
    }
  })
  return boosted.length > 0 ? boosted.join(' / ') : 'CPU/GPUを持っていません'
}

// --- モーダル制御 ---

function setHappeningContent(card, phase) {
  document.getElementById('happening-phase').textContent = phase
  document.getElementById('happening-card-name').textContent = card.name
  document.getElementById('happening-card-desc').textContent = card.desc
  const resultEl = document.getElementById('happening-effect-result')
  resultEl.textContent = ''
  resultEl.classList.add('hidden')
  document.getElementById('happening-select-area').classList.add('hidden')
  document.getElementById('happening-btn-ok').classList.remove('hidden')
  document.getElementById('happening-btn-skip').classList.add('hidden')
  document.getElementById('happening-btn-ok').onclick = null
  document.getElementById('happening-btn-skip').onclick = null
}

function showHappeningResult(msg) {
  const el = document.getElementById('happening-effect-result')
  el.textContent = msg
  el.classList.remove('hidden')
}

function openHappeningModal() {
  document.getElementById('happening-modal').classList.remove('hidden')
}

function closeHappeningModal() {
  document.getElementById('happening-modal').classList.add('hidden')
}

async function maybeTriggerPreHappening(playerIndex) {
  const player = players[playerIndex]
  if (!player.happeningPreCard) return

  const card = player.happeningPreCard

  if (playerIndex !== getMyIndex()) {
    // CPU：自動使用
    applyPreEffect(card, playerIndex)
    player.happeningPreCard = null
    return
  }

  // 人間プレイヤー：使う／スキップを選択させる
  setHappeningContent(card, 'ターン開始前ハプニングカード')
  const okBtn = document.getElementById('happening-btn-ok')
  const skipBtn = document.getElementById('happening-btn-skip')
  okBtn.textContent = '使う！'
  skipBtn.textContent = '今は使わない'
  skipBtn.classList.remove('hidden')
  openHappeningModal()

  await new Promise(resolve => {
    okBtn.onclick = () => {
      player.happeningPreCard = null
      skipBtn.classList.add('hidden')
      okBtn.classList.add('hidden')
      const resultMsg = applyPreEffect(card, playerIndex)
      if (resultMsg) showHappeningResult(resultMsg)
      okBtn.textContent = '了解！'
      okBtn.classList.remove('hidden')
      okBtn.onclick = () => {
        closeHappeningModal()
        document.getElementById('draft-budget-amount').textContent =
          `¥${players[getMyIndex()].budget}`
        renderHappeningHand()
        resolve()
      }
    }
    skipBtn.onclick = () => {
      closeHappeningModal()
      resolve()
    }
  })
}

async function maybeTriggerPostHappening(playerIndex) {
  const player = players[playerIndex]
  if (!player.happeningPostCard) return

  const card = player.happeningPostCard

  if (playerIndex !== getMyIndex()) {
    // CPU：自動使用（インタラクティブ系は自動スキップ）
    if (!card.interactive) applyPostAutoEffect(card, playerIndex)
    player.happeningPostCard = null
    return
  }

  // 人間プレイヤー：使う／スキップを選択させる
  setHappeningContent(card, 'ターン終了後ハプニングカード')
  const okBtn = document.getElementById('happening-btn-ok')
  const skipBtn = document.getElementById('happening-btn-skip')
  okBtn.textContent = '使う！'
  skipBtn.textContent = '今は使わない'
  skipBtn.classList.remove('hidden')
  openHappeningModal()

  await new Promise(resolve => {
    okBtn.onclick = () => {
      player.happeningPostCard = null
      skipBtn.classList.add('hidden')
      okBtn.classList.add('hidden')

      if (!card.interactive) {
        const resultMsg = applyPostAutoEffect(card, playerIndex)
        if (resultMsg) showHappeningResult(resultMsg)
        okBtn.textContent = '了解！'
        okBtn.classList.remove('hidden')
        okBtn.onclick = () => {
          closeHappeningModal()
          document.getElementById('draft-budget-amount').textContent =
            `¥${players[getMyIndex()].budget}`
          renderHappeningHand()
          resolve()
        }
      } else {
        showInteractivePostHappening(card, playerIndex).then(() => {
          document.getElementById('draft-budget-amount').textContent =
            `¥${players[getMyIndex()].budget}`
          renderHappeningHand()
          resolve()
        })
      }
    }
    skipBtn.onclick = () => {
      closeHappeningModal()
      resolve()
    }
  })
}

function showInteractivePostHappening(card, playerIndex) {
  return new Promise(resolve => {
    const player = players[playerIndex]
    const area = document.getElementById('happening-select-area')
    const choices = document.getElementById('happening-choices')
    const stepLabel = document.getElementById('happening-step-label')

    document.getElementById('happening-btn-ok').classList.add('hidden')

    const done = (msg) => {
      if (msg) showHappeningResult(msg)
      area.classList.add('hidden')
      document.getElementById('happening-btn-skip').classList.add('hidden')
      const okBtn = document.getElementById('happening-btn-ok')
      okBtn.textContent = '了解！'
      okBtn.classList.remove('hidden')
      okBtn.onclick = () => { closeHappeningModal(); resolve() }
    }

    if (card.id === 'my_rel_up') {
      const upgradeable = player.hand.filter(
        c => c.reliability && c.reliability !== 'new'
      )
      if (upgradeable.length === 0) { done('信頼度をアップできるパーツがありません'); return }

      stepLabel.textContent = 'アップグレードするパーツを選んでください'
      area.classList.remove('hidden')
      choices.innerHTML = ''
      upgradeable.forEach(c => {
        const btn = document.createElement('button')
        btn.className = 'btn btn-secondary happening-choice-btn'
        btn.textContent = `${c.name}  [${c.reliability.toUpperCase()}]`
        btn.onclick = () => {
          const before = c.reliability.toUpperCase()
          c.reliability = upgradeRel(c.reliability)
          done(`${c.name}: ${before} → ${c.reliability.toUpperCase()}`)
        }
        choices.appendChild(btn)
      })

    } else if (card.id === 'someone_rel_down') {
      const others = players.filter(
        (p, i) => i !== playerIndex &&
          p.hand.some(c => c.reliability && c.reliability !== 'junk')
      )
      if (others.length === 0) { done('ダウングレードできる相手がいません'); return }

      stepLabel.textContent = '対象のプレイヤーを選んでください'
      area.classList.remove('hidden')
      choices.innerHTML = ''
      others.forEach(targetPlayer => {
        const btn = document.createElement('button')
        btn.className = 'btn btn-secondary happening-choice-btn'
        btn.textContent = targetPlayer.name
        btn.onclick = () => {
          const downgradeable = targetPlayer.hand.filter(
            c => c.reliability && c.reliability !== 'junk'
          )
          choices.innerHTML = ''
          stepLabel.textContent = `${targetPlayer.name}のパーツを選んでください`
          downgradeable.forEach(c => {
            const btn2 = document.createElement('button')
            btn2.className = 'btn btn-secondary happening-choice-btn'
            btn2.textContent = `${c.name}  [${c.reliability.toUpperCase()}]`
            btn2.onclick = () => {
              const before = c.reliability.toUpperCase()
              c.reliability = downgradeRel(c.reliability)
              done(`${targetPlayer.name}の${c.name}: ${before} → ${c.reliability.toUpperCase()}`)
            }
            choices.appendChild(btn2)
          })
        }
        choices.appendChild(btn)
      })

    } else if (card.id === 'type_swap') {
      const myMainParts = player.hand.filter(
        c => ['cpu', 'gpu', 'memory', 'motherboard', 'psu'].includes(c.type)
      )
      const swappable = myMainParts.filter(myCard =>
        players.some((p, i) => i !== playerIndex && p.hand.some(c => c.type === myCard.type))
      )
      if (swappable.length === 0) { done('交換できる相手がいません'); return }

      stepLabel.textContent = '交換するパーツを選んでください'
      area.classList.remove('hidden')
      choices.innerHTML = ''
      swappable.forEach(myCard => {
        const btn = document.createElement('button')
        btn.className = 'btn btn-secondary happening-choice-btn'
        btn.textContent = `${myCard.name}  [${myCard.type.toUpperCase()}]`
        btn.onclick = () => {
          const candidates = players
            .map((p, i) => ({ p, i }))
            .filter(({ p, i }) => i !== playerIndex && p.hand.some(c => c.type === myCard.type))
          const { p: targetP } = candidates[Math.floor(Math.random() * candidates.length)]
          const theirCard = targetP.hand.find(c => c.type === myCard.type)

          const myIdx = player.hand.indexOf(myCard)
          const theirIdx = targetP.hand.indexOf(theirCard)
          player.hand[myIdx] = theirCard
          targetP.hand[theirIdx] = myCard

          done(`${player.name}の${myCard.name} <-> ${targetP.name}の${theirCard.name}`)
        }
        choices.appendChild(btn)
      })

    } else if (card.id === 'buy_neighbor') {
      const neighborIdx = (playerIndex + 1) % players.length
      const neighbor = players[neighborIdx]
      const buyable = neighbor.hand.filter(c => {
        const price = Math.ceil(c.cost * 1.5)
        if (price > player.budget) return false
        if (['cpu', 'gpu', 'memory', 'motherboard', 'psu'].includes(c.type) &&
          player.hand.some(h => h.type === c.type)) return false
        return true
      })

      if (buyable.length === 0) {
        done(`${neighbor.name}から購入できるパーツがありません（予算不足または重複）`)
        return
      }

      const skipBtn = document.getElementById('happening-btn-skip')
      skipBtn.textContent = 'パスする'
      skipBtn.classList.remove('hidden')
      skipBtn.onclick = () => { closeHappeningModal(); resolve() }

      stepLabel.textContent = `${neighbor.name}のパーツを選んでください（定価×1.5）`
      area.classList.remove('hidden')
      choices.innerHTML = ''
      buyable.forEach(c => {
        const price = Math.ceil(c.cost * 1.5)
        const btn = document.createElement('button')
        btn.className = 'btn btn-secondary happening-choice-btn'
        const rel = c.reliability ? `  ${c.reliability.toUpperCase()}` : ''
        btn.textContent = `${c.name}${rel}  [¥${price}]`
        btn.onclick = () => {
          player.budget -= price
          neighbor.budget += price
          player.hand.push(c)
          neighbor.hand.splice(neighbor.hand.indexOf(c), 1)
          done(`${neighbor.name}から${c.name}を¥${price}で購入！`)
        }
        choices.appendChild(btn)
      })
    }
  })
}

// ブラインド場札用カード要素
function createBlindCardEl(card) {
  const el = document.createElement('div')
  el.className = 'card card-blind'

  const costEl = document.createElement('div')
  costEl.className = 'card-cost'
  costEl.textContent = '¥' + (card.cost ?? '—')

  const typeKey = getCardType(card)
  const typeClassMap = { CPU: 'cpu', GPU: 'gpu', MEM: 'mem', MB: 'mb', PSU: 'psu', SUP: 'sup' }
  const typeEl = document.createElement('div')
  typeEl.className = `card-type card-type-${typeClassMap[typeKey] ?? 'sup'}`
  typeEl.textContent = typeKey

  const unknownEl = document.createElement('div')
  unknownEl.className = 'card-blind-unknown'
  unknownEl.textContent = '???'

  el.appendChild(costEl)
  el.appendChild(typeEl)
  el.appendChild(unknownEl)

  return el
}

// 「今のターン」のプレイヤーインデックスを返す
function getCurrentTurnIndex() {
  if (myUid === null) return draftOrder[draftOrderIndex]
  return onlineTurn
}

function dealHappeningCards() {
  players.forEach(p => {
    p.happeningPreCard  = happeningPre[Math.floor(Math.random() * happeningPre.length)]
    p.happeningPostCard = happeningPost[Math.floor(Math.random() * happeningPost.length)]
  })
}

function renderHappeningHand() {
  const myIdx = getMyIndex()
  const p = players[myIdx]
  if (!p) return
  const preEl  = document.getElementById('happening-hand-pre')
  const postEl = document.getElementById('happening-hand-post')
  if (preEl)  preEl.textContent  = p.happeningPreCard  ? p.happeningPreCard.name  : '(使用済み)'
  if (postEl) postEl.textContent = p.happeningPostCard ? p.happeningPostCard.name : '(使用済み)'
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

document.getElementById('btn-to-draft').addEventListener('click', async () => {
  if (myUid !== null) {
    // オンライン：ホストがFirestoreにdraftStartedを書き込む → 全員が一斉に遷移
    await updateGameState({ draftStarted: true })
    return
  }
  // ソロモード
  deck = createDeck()
  applyEvent(currentEvent, deck)
  field = createField(deck)
  draftOrder = [0, 1, 2, 3]
  draftOrderIndex = 0
  draftRound = 1
  selectedCard = null
  happeningBlindField = false
  dealHappeningCards()

  fieldCardElements = new Map()
  prevHappeningBlindField = false
  prevHandLength = 0
  prevOpponentHandLengths = {}

  renderDraftScreen()
  showScreen('screen-draft')
  await maybeTriggerPreHappening(draftOrder[0])
})

// =====================
// ドラフト画面：描画
// =====================
function renderDraftScreen() {
  const currentIndex = getCurrentTurnIndex()
  const currentPlayer = players[currentIndex]
  if (!currentPlayer) return  // 状態不整合のガード
  const myIndex = getMyIndex()
  const isMyTurn = currentIndex === myIndex

  // ラウンド・予算・アナウンス更新
  const currentRound = myUid !== null ? onlineDraftRound : draftRound
  document.getElementById('draft-round').textContent = currentRound
  document.getElementById('draft-budget-amount').textContent = `¥${players[myIndex].budget}`
  document.getElementById('field-announce-text').textContent =
    isMyTurn ? 'あなたのターン' : `${currentPlayer.name} が選択中…`

  // ソロモード：イベントをコーナーに表示
  if (myUid === null && currentEvent) {
    document.getElementById('draft-event-display').textContent = EVENT_LABELS[currentEvent] ?? currentEvent
  }

  renderField(currentPlayer, isMyTurn)
  renderHand(myIndex)
  renderOtherPlayers(myIndex)
  renderHappeningHand()

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
  const canAffordAny = field.some(c => c.cost <= currentPlayer.budget)
  // Firestoreから返るたびに新しいオブジェクトになるため、card.nameを安定キーとして使う
  const currentFieldNames = new Set(field.map(c => c.name))

  // blind_field 状態が変化したら既存要素を全破棄して再生成
  if (happeningBlindField !== prevHappeningBlindField) {
    prevHappeningBlindField = happeningBlindField
    for (const [, el] of fieldCardElements) el.remove()
    fieldCardElements.clear()
  }

  // フィールドから消えたカードをフェードアウトして削除
  for (const [name, el] of [...fieldCardElements]) {
    if (!currentFieldNames.has(name)) {
      if (!el.classList.contains('card-leaving')) {
        el.classList.add('card-leaving')
        el.addEventListener('animationend', () => el.remove(), { once: true })
      }
      fieldCardElements.delete(name)
    }
  }

  // 既存カードの状態更新 & 新規カードのフェードイン追加
  let newCardIdx = 0
  field.forEach(card => {
    const affordable = card.cost <= currentPlayer.budget

    if (fieldCardElements.has(card.name)) {
      // 既存要素：フェードイン中でなければ選択可否を更新
      const el = fieldCardElements.get(card.name)
      if (!el.classList.contains('card-appear')) {
        if (isHuman && affordable) {
          el.onclick = () => onFieldCardClick(card, el)
          el.classList.remove('disabled')
        } else {
          el.onclick = null
          el.classList.add('disabled')
        }
      }
    } else {
      // 新規カード：フェードインで追加（アニメーション中は disabled）
      const el = happeningBlindField ? createBlindCardEl(card) : createCardEl(card)
      el.classList.add('disabled', 'card-appear')
      el.style.animationDelay = `${newCardIdx * 55}ms`
      el.addEventListener('animationend', () => {
        el.classList.remove('card-appear')
        el.style.animationDelay = ''
        // アニメーション完了時点のターン状態を再評価（アニメーション中にターンが変わる可能性があるため）
        const curIdx = getCurrentTurnIndex()
        const curPlayer = players[curIdx]
        if (!curPlayer) return
        const curIsHuman = curIdx === getMyIndex()
        const curAffordable = card.cost <= curPlayer.budget
        if (curIsHuman && curAffordable) {
          el.onclick = () => onFieldCardClick(card, el)
          el.classList.remove('disabled')
        } else {
          el.onclick = null
          el.classList.add('disabled')
        }
      }, { once: true })
      container.appendChild(el)
      fieldCardElements.set(card.name, el)
      newCardIdx++
    }
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

  human.hand.forEach((card, idx) => {
    const el = createCardEl(card)
    if (idx >= prevHandLength) {
      el.classList.add('card-appear')
      el.style.animationDelay = `${(idx - prevHandLength) * 40}ms`
    }
    container.appendChild(el)
  })
  prevHandLength = human.hand.length
}

function renderOtherPlayers(myIndex = HUMAN_INDEX) {
  const zoneIds = ['top', 'left', 'right']

  // 全ゾーンをリセット
  zoneIds.forEach(pos => {
    const zone = document.getElementById(`opponent-${pos}`)
    zone.classList.add('hidden')
    zone.classList.remove('active-turn')
    zone.querySelector('.opp-hand-cards').innerHTML = ''
    zone.querySelector('.opp-name').textContent = ''
  })

  // 対戦相手リスト（自分を除く）
  const opponents = players
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i !== myIndex)

  const currentTurnIndex = getCurrentTurnIndex()
  // 相手の人数に応じてゾーンを割り当て（1人→top、2人→top+left、3人→top+left+right）
  const usedZones = zoneIds.slice(0, opponents.length)

  opponents.forEach(({ p, i }, idx) => {
    const zone = document.getElementById(`opponent-${usedZones[idx]}`)
    zone.classList.remove('hidden')

    // アクティブターンをハイライト
    if (i === currentTurnIndex) zone.classList.add('active-turn')

    zone.querySelector('.opp-name').textContent = p.name

    // 手札をカード裏面ボックスで表示（追加分だけアニメーション）
    const handContainer = zone.querySelector('.opp-hand-cards')
    const prevLen = prevOpponentHandLengths[i] ?? 0
    for (let j = 0; j < p.hand.length; j++) {
      const back = document.createElement('div')
      back.className = 'card-back'
      if (j >= prevLen) {
        back.classList.add('card-appear')
        back.style.animationDelay = `${(j - prevLen) * 40}ms`
      }
      handContainer.appendChild(back)
    }
    prevOpponentHandLengths[i] = p.hand.length
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

// ピックされたカードをフェードアウトして DOM から削除（完了まで待機）
async function fadeOutPickedCard(card) {
  const el = fieldCardElements.get(card.name)
  if (!el || el.classList.contains('card-leaving')) return
  el.classList.add('card-leaving')
  await new Promise(resolve => {
    el.addEventListener('animationend', () => { el.remove(); resolve() }, { once: true })
  })
  fieldCardElements.delete(card.name)
}

document.getElementById('btn-pick-card').addEventListener('click', async () => {
  if (!selectedCard) return
  const cardToPick = selectedCard
  if (myUid !== null) {
    // フィールドインデックスを先に確保
    const fieldIndex = field.indexOf(cardToPick)
    const myIdx = getMyIndex()
    // ピックされたカードをフェードアウト（完了を待つ → 完了後に Firestore 更新）
    await fadeOutPickedCard(cardToPick)
    // post-happening モーダルを表示
    await maybeTriggerPostHappening(myIdx)
    renderHappeningHand()
    // ローカルでピックを適用してから1回だけ Firestore に書き込む
    // （中間書き込みを挟むとリスナーが再描画してカードが一瞬再表示される問題を防止）
    players[myIdx].hand.push(cardToPick)
    players[myIdx].budget -= cardToPick.cost
    field.splice(fieldIndex, 1)
    if (deck.length > 0) field.push(deck.shift())
    const newTurn = (onlineTurn + 1) % players.length
    const newRound = newTurn === 0 ? onlineDraftRound + 1 : onlineDraftRound
    await updateGameState({ players, field: [...field], deck: [...deck], turn: newTurn, draftRound: newRound })
  } else {
    const currentIndex = getCurrentTurnIndex()
    // ピックされたカードをフェードアウト（完了を待つ → 完了後にローカル処理）
    await fadeOutPickedCard(cardToPick)
    pickCardLocal(currentIndex, cardToPick)
    await maybeTriggerPostHappening(currentIndex)
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

  // フェードアウト完了後にピック処理（11枚問題を防ぐ）
  fadeOutPickedCard(pick).then(() => {
    pickCardLocal(currentIndex, pick)
    maybeTriggerPostHappening(currentIndex).then(() => nextDraftTurn())
  })
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
  happeningBlindField = false

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

  const nextIndex = draftOrder[draftOrderIndex]
  maybeTriggerPreHappening(nextIndex).then(() => renderDraftScreen())
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

export function startOnlineGame(uid, isHostPlayer) {
  myUid = uid
  document.getElementById('btn-to-draft').classList.add('hidden')

  let prepScreenShown = false
  let draftAnimInitialized = false

  watchGameState((room) => {
    // ホストのgame state書き込みが完了するまで待つ
    if (!room.field || !room.deck) return

    // Firestoreで上書きされる前にハプニングカードの状態を退避
    const savedHappening = {}
    players.forEach(p => {
      if (p.id) savedHappening[p.id] = { pre: p.happeningPreCard, post: p.happeningPostCard }
    })

    players = room.players
    field = room.field
    deck = room.deck
    onlineTurn = room.turn
    onlineDraftRound = room.draftRound || 1

    // 退避したハプニングカードを復元
    players.forEach(p => {
      if (savedHappening[p.id]) {
        p.happeningPreCard  = savedHappening[p.id].pre
        p.happeningPostCard = savedHappening[p.id].post
      }
    })

    // ホストが「ドラフト開始」を押した後 → 全員がドラフト画面へ
    if (room.draftStarted) {
      if (!draftAnimInitialized) {
        fieldCardElements = new Map()
        prevHappeningBlindField = false
        prevHandLength = 0
        prevOpponentHandLengths = {}
        lastHandledTurnKey = ''
        preHappeningInProgress = false
        draftAnimInitialized = true
        dealHappeningCards()
      }
      const roundOver = onlineDraftRound > 8
      const allHaveCards = room.players.every(p => p.hand.length >= 8)
      if (roundOver || allHaveCards) {
        stopGameState()
        startSetPhase()
        return
      }
      // 市場イベントをコーナーに表示
      document.getElementById('draft-event-display').textContent = EVENT_LABELS[room.event] ?? room.event ?? '-'
      renderDraftScreen()
      showScreen('screen-draft')

      // 自分のターン開始時に pre-happening を発火（未処理のターンのみ）
      const myIdx = getMyIndex()
      const turnKey = `${onlineTurn}-${onlineDraftRound}`
      if (onlineTurn === myIdx && !preHappeningInProgress && turnKey !== lastHandledTurnKey) {
        lastHandledTurnKey = turnKey
        preHappeningInProgress = true
        maybeTriggerPreHappening(myIdx).then(async () => {
          preHappeningInProgress = false
          renderHappeningHand()
          renderDraftScreen()
          await updateGameState({ field: [...field], deck: [...deck], players })
        })
      }
      return
    }

    // 準備画面（初回のみUI更新）
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
      if (isHostPlayer) {
        // ホストのみドラフト開始ボタンを表示
        document.getElementById('btn-to-draft').textContent = 'ドラフト開始（ホスト）'
        document.getElementById('btn-to-draft').classList.remove('hidden')
      } else {
        // 非ホストは待機メッセージ
        document.getElementById('event-display').insertAdjacentHTML(
          'afterend',
          '<p id="online-wait-msg" style="color:#aaa;margin-top:12px;">ホストがドラフトを開始するまでお待ちください…</p>'
        )
      }
    }
    // prepScreenShown済み・draftStartedなし → 待機中のまま何もしない
  })
}
