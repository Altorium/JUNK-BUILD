// ui-boot.js

// =====================
// 状態
// =====================
let bootPlayer      = null   // 現在起動処理中のプレイヤー
let usedDebug       = false  // 起死回生デバッグを使ったか
let allFinalScores  = []     // 全プレイヤーの最終スコア記録用

// =====================
// 諦めスキップ共通処理
// =====================
function skipToResult(player) {
  let assetValue = 0
  player.hand.forEach(c => { assetValue += (c.cost || 0) })
  player.score = assetValue * 5

  calcCpuScores()
  showFinalResult()
}

// =====================
// CPUプレイヤーのスコアを一括計算
// =====================
function calcCpuScores() {
  players.forEach((p, i) => {
    if (i === HUMAN_INDEX) return
    const assetValue = p.hand.reduce((sum, c) => sum + (c.cost || 0), 0)
    if (!p.build) { p.score = assetValue * 5; return }
    const { cpu, gpu, memory, motherboard, psu } = p.build
    if (!cpu || !gpu || !memory || !motherboard || !psu) { p.score = assetValue * 5; return }
    if (!checkCompatibility(p.build)) { p.score = assetValue * 5; return }
    if (!reliabilityCheck(p.build))   { p.score = assetValue * 5; return }

    let s = benchmark(p.build)
    s = synergyBonus(s, p.build)
    s = powerBonus(s, p.build)
    s = bonus(s, p.build, p.hand)
    p.score = Math.floor(s)
  })
}

// =====================
// 起動シーケンス開始（ui-draft.jsから呼ばれる）
// =====================
function startBoot(player) {
  bootPlayer = player
  usedDebug  = false
  showScreen('screen-boot')
  runBiosAnimation(player.build)
}

// =====================
// BIOS起動アニメーション
// =====================
function runBiosAnimation(build) {
  const log = document.getElementById('bios-log')
  log.innerHTML = ''

  document.getElementById('boot-result').classList.add('hidden')
  document.getElementById('boot-success').classList.add('hidden')
  document.getElementById('boot-failure').classList.add('hidden')

  const compatible = checkCompatibility(build)
  const reliable   = compatible ? reliabilityCheck(build) : false

  const lines = makeBiosLines(build, compatible, reliable)

  // 1行ずつ表示
  lines.forEach((text, i) => {
    setTimeout(() => {
      const div = document.createElement('div')
      div.className = 'bios-line'
      div.textContent = text
      div.style.animationDelay = '0s'
      log.appendChild(div)

      // 最後の行が表示されたら結果を表示
      if (i === lines.length - 1) {
        setTimeout(() => showBootResult(compatible && reliable, compatible), 600)
      }
    }, i * 200)
  })
}

function makeBiosLines(build, compatible, reliable) {
  const lines = []
  lines.push('JUNK BUILD BIOS v1.0.0')
  lines.push('Initializing hardware...')
  lines.push(`CPU detected : ${build.cpu?.name ?? 'NONE'}`)
  lines.push(`GPU detected : ${build.gpu?.name ?? 'NONE'}`)
  lines.push(`Memory       : ${build.memory?.name ?? 'NONE'}`)
  lines.push(`Motherboard  : ${build.motherboard?.name ?? 'NONE'}`)
  lines.push(`PSU          : ${build.psu?.name ?? 'NONE'}`)
  lines.push('Checking compatibility...')

  if (!compatible) {
    lines.push('ERROR: Compatibility check FAILED.')
    lines.push('> Socket mismatch or insufficient power.')
    return lines
  }

  lines.push('Compatibility OK.')
  lines.push('Running reliability check...')

  if (!reliable) {
    lines.push('ERROR: Hardware fault detected.')
    lines.push('> System cannot boot.')
    return lines
  }

  lines.push('All checks passed.')
  lines.push('Booting OS...')
  lines.push('Boot successful.')
  return lines
}

// =====================
// 起動結果の表示
// =====================
function showBootResult(success, compatible) {
  document.getElementById('boot-result').classList.remove('hidden')

  if (success) {
    document.getElementById('boot-success').classList.remove('hidden')
  } else {
    document.getElementById('boot-failure').classList.remove('hidden')
    const reason = compatible
      ? 'パーツの不具合により起動に失敗しました。'
      : 'パーツの互換性エラーにより起動に失敗しました。'
    document.getElementById('boot-failure-reason').textContent = reason

    // 起死回生デバッグ済みなら再挑戦ボタンを隠す
    if (usedDebug) {
      document.getElementById('btn-debug').classList.add('hidden')
    } else {
      document.getElementById('btn-debug').classList.remove('hidden')
    }
  }
}

// =====================
// 起動成功 → ベンチマークへ
// =====================
document.getElementById('btn-to-benchmark').addEventListener('click', () => {
  showBenchmarkScreen(bootPlayer, usedDebug)
})

// =====================
// 起動失敗 → 起死回生デバッグへ
// =====================
document.getElementById('btn-debug').addEventListener('click', () => {
  showDebugScreen()
})

// 諦めてスキップ → 大幅減点（手札パーツ資産 × 5）してCPUスコア計算後に最終結果へ
document.getElementById('btn-skip-benchmark').addEventListener('click', () => {
  skipToResult(bootPlayer)
})

// =====================
// 起死回生デバッグ画面
// =====================
function showDebugScreen() {
  usedDebug = true
  showScreen('screen-debug')

  // 山札から1枚ドロー（deckはui-draft.jsで管理）
  if (deck.length > 0) {
    const drawn = deck.shift()
    bootPlayer.hand.push(drawn)
  }

  renderDebugHand()
}

function renderDebugHand() {
  const container = document.getElementById('debug-hand-cards')
  container.innerHTML = ''

  // スロットをリセット
  ;['cpu', 'gpu', 'memory', 'motherboard', 'psu'].forEach(key => {
    const slotCard = document.querySelector(`#debug-slot-${key} .slot-card`)
    if (slotCard) {
      slotCard.textContent = ''
      slotCard.classList.remove('filled')
    }
  })

  const debugBuild = { cpu: null, gpu: null, memory: null, motherboard: null, psu: null }

  bootPlayer.hand.forEach(card => {
    const el      = createCardEl(card)
    const type    = getCardType(card)
    const slotKey = typeToSlotKey(type)

    if (slotKey) {
      el.addEventListener('click', () => {
        // 同スロットに既存カードがあれば手札に戻す
        if (debugBuild[slotKey]) {
          const prevCard = debugBuild[slotKey]
          container.querySelectorAll('.card').forEach(c => {
            if (c.querySelector('.card-name')?.textContent === prevCard.name) {
              c.style.opacity       = ''
              c.style.pointerEvents = ''
            }
          })
        }

        debugBuild[slotKey]    = card
        el.style.opacity       = '0.35'
        el.style.pointerEvents = 'none'

        // スロット表示を更新
        const slotCard = document.querySelector(`#debug-slot-${slotKey} .slot-card`)
        if (slotCard) {
          slotCard.textContent = card.name
          slotCard.classList.add('filled')
        }

        // 全スロット揃ったら再起動ボタン有効化
        const filled = Object.values(debugBuild).every(v => v !== null)
        document.getElementById('btn-debug-boot').disabled = !filled
        if (filled) {
          bootPlayer.build = { ...debugBuild }
        }
      })
    } else {
      el.style.opacity = '0.5'
    }

    container.appendChild(el)
  })

  document.getElementById('btn-debug-boot').disabled = true
}

document.getElementById('btn-debug-boot').addEventListener('click', () => {
  showScreen('screen-boot')
  runBiosAnimation(bootPlayer.build)
})

// =====================
// ベンチマーク画面
// =====================
function showBenchmarkScreen(player, penaltyApplied) {
  showScreen('screen-benchmark')
  document.getElementById('benchmark-player-name').textContent = player.name

  const build = player.build
  const cpuScore = build.cpu?.score ?? 0
  const gpuScore = build.gpu?.score ?? 0
  const maxScore = cpuScore + gpuScore

  let totalScore = benchmark(build)
  totalScore = synergyBonus(totalScore, build)  // シナジーボーナス
  totalScore = powerBonus(totalScore, build)    // 電源ボーナス 

  
  if (penaltyApplied) {
    totalScore = Math.floor(totalScore * 0.7)   // デバッグペナルティ30%
  }

  // スコアバーをアニメーション表示
  setTimeout(() => {
    const cpuPct = maxScore > 0 ? (cpuScore / maxScore * 100) : 0
    const gpuPct = maxScore > 0 ? (gpuScore / maxScore * 100) : 0

    document.getElementById('bar-cpu').style.width = cpuPct + '%'
    document.getElementById('bar-gpu').style.width = gpuPct + '%'
    document.getElementById('val-cpu').textContent = cpuScore.toLocaleString()
    document.getElementById('val-gpu').textContent = gpuScore.toLocaleString()

    const ratio = Math.min(cpuScore, gpuScore) / Math.max(cpuScore, gpuScore)
    const bottleneckPct = Math.round((0.5 + 0.5 * ratio) * 100)
    document.getElementById('val-bottleneck').textContent =
      bottleneckPct < 100 ? `${bottleneckPct}%（ボトルネックあり）` : 'なし'

    document.getElementById('val-total-score').textContent = Math.floor(totalScore).toLocaleString()
  }, 100)

  // ボタン押下時にスコアを保持して得点変動へ
  document.getElementById('btn-to-bonus').onclick = () => {
    showBonusScreen(player, Math.floor(totalScore))
  }
}

// =====================
// 得点変動画面
// =====================
function showBonusScreen(player, baseScore) {
  showScreen('screen-bonus')
  document.getElementById('bonus-player-name').textContent = player.name

  const build   = player.build
  const details = document.getElementById('bonus-details')
  details.innerHTML = ''

  let multiplier = 1

  // 電源ボーナス
  const psuBonus = { Bronze: 0.02, Gold: 0.05, Platinum: 0.08 }
  const psuRate  = psuBonus[build.psu?.rating] ?? 0
  if (psuRate > 0) {
    multiplier += psuRate
    addBonusRow(details, `電源品質（${build.psu.rating}）`, `+${psuRate * 100}%`)
  }

  // メモリ容量ボーナス
  const memRate = (build.memory?.capacity ?? 0) * 0.005
  if (memRate > 0) {
    multiplier += memRate
    addBonusRow(details, `メモリ容量（${build.memory.capacity}GB）`, `+${memRate * 100}%`)
  }

  // サポートカードボーナス
  player.hand.forEach(c => {
    if (c.effect === '5%プラス') {
      multiplier += 0.05
      addBonusRow(details, c.name, '+5%')
    }
  })

  const finalScore = Math.floor(baseScore * multiplier)
  player.score = finalScore

  document.getElementById('val-final-score').textContent = finalScore.toLocaleString()

  calcCpuScores()

  document.getElementById('btn-next-player').onclick = () => {
    showFinalResult()
  }
}

function addBonusRow(container, label, value) {
  const div = document.createElement('div')
  div.className = 'bonus-row'
  div.innerHTML = `<span>${label}</span><span class="bonus-val">${value}</span>`
  container.appendChild(div)
}

// =====================
// 最終結果画面（ui-draft.jsからも呼ばれる）
// =====================
function showFinalResult() {
  showScreen('screen-result')

  // スコア順にソート
  const ranking = [...players].sort((a, b) => b.score - a.score)

  const rankingEl = document.getElementById('result-ranking')
  rankingEl.innerHTML = ''

  ranking.forEach((p, i) => {
    const div = document.createElement('div')
    div.className = `rank-row${i === 0 ? ' rank-1' : ''}`
    div.innerHTML = `
      <span class="rank-num">#${i + 1}</span>
      <span class="rank-name">${p.name}</span>
      <span class="rank-score">${Math.floor(p.score).toLocaleString()} pt</span>
    `
    rankingEl.appendChild(div)
  })

  document.getElementById('winner-name').textContent = ranking[0].name
}

// =====================
// もう一度遊ぶ
// =====================
document.getElementById('btn-restart').addEventListener('click', () => {
  // ページをリロードして全状態をリセット
  location.reload()
})
