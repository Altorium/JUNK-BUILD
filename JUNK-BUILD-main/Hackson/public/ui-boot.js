// ui-boot.js
import {
  players, deck, currentBuild, getMyIndex,
  showScreen, createCardEl, getCardType, typeToSlotKey
} from './ui-draft.js'

const HUMAN_INDEX = 0

// =====================
// 状態
// =====================
let bootPlayer      = null
let usedDebug       = false
let allFinalScores  = []

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
// BIOS起動アニメーション (3D連動＆爆発追加)
// =====================
function runBiosAnimation(build) {
  const log = document.getElementById('bios-log'); 
  log.innerHTML = '';
  document.getElementById('boot-result').classList.add('hidden');
  document.getElementById('boot-success').classList.add('hidden');
  document.getElementById('boot-failure').classList.add('hidden');

  if (window.resetParts3D) window.resetParts3D();

  const missing = !build.motherboard || !build.cpu || !build.gpu || !build.memory || !build.psu;
  const compatible = missing ? false : checkCompatibility(build); 
  const reliable = missing ? false : (compatible ? reliabilityCheck(build) : false);
  
  const lines = makeBiosLines(build, compatible, reliable, missing);

  let i = 0;
  function showNextLine() {
    if (i >= lines.length) {
      setTimeout(() => {
        if (compatible && reliable && !missing && window.playFinalBootEffect3D) {
          window.playFinalBootEffect3D().then(() => {
            showBootResult(true, true);
          });
        } else {
          showBootResult(false, compatible, missing);
        }
      }, 600);
      return;
    }

    const text = lines[i];
    const div = document.createElement('div'); 
    div.className = 'bios-line'; 
    div.textContent = text;
    div.style.animationDelay = '0s';
    log.appendChild(div);

    // ★爆発判定！
    if (text === 'SYSTEM OVERLOAD...') {
      if (window.playExplosionEffect3D) {
        window.playExplosionEffect3D().then(() => {
            showBootResult(false, compatible, missing); 
        });
      } else {
        showBootResult(false, compatible, missing);
      }
      return; 
    }

    let waitTime = 200;

    if (text.startsWith('Motherboard')) {
      if (window.assemblePart3D && build.motherboard) window.assemblePart3D('motherboard', build.motherboard);
      waitTime = 1500;
    } else if (text.startsWith('CPU detected')) {
      if (window.assemblePart3D && build.cpu) window.assemblePart3D('cpu', build.cpu);
      waitTime = 1500;
    } else if (text.startsWith('GPU detected')) {
      if (window.assemblePart3D && build.gpu) window.assemblePart3D('gpu', build.gpu);
      waitTime = 1500;
    } else if (text.startsWith('Memory')) {
      if (window.assemblePart3D && build.memory) window.assemblePart3D('memory', build.memory);
      waitTime = 1500;
    } else if (text.startsWith('PSU')) {
      if (window.assemblePart3D && build.psu) window.assemblePart3D('psu', build.psu);
      waitTime = 1500;
    }

    i++;
    setTimeout(showNextLine, waitTime);
  }

  showNextLine();
}

function makeBiosLines(build, comp, rel, missing) {
  const l = ['JUNK BUILD BIOS v1.0.0', 'Initializing hardware...'];
  
  l.push(`Motherboard : ${build.motherboard ? build.motherboard.name : 'MISSING!'}`);
  l.push(`CPU detected : ${build.cpu ? build.cpu.name : 'MISSING!'}`);
  l.push(`Memory : ${build.memory ? build.memory.name : 'MISSING!'}`);
  l.push(`GPU detected : ${build.gpu ? build.gpu.name : 'MISSING!'}`);
  l.push(`PSU : ${build.psu ? build.psu.name : 'MISSING!'}`);
  
  l.push('Checking compatibility...');

  if (missing) {
      return [...l, 'FATAL ERROR: Essential parts are missing!', 'SYSTEM OVERLOAD...'];
  }

  if (!comp) return [...l, 'ERROR: Compatibility check FAILED.'];
  
  l.push('Compatibility OK.', 'Running reliability check...');
  
  if (!rel) return [...l, 'ERROR: Hardware fault detected.', 'SYSTEM OVERLOAD...'];
  
  return [...l, 'All checks passed.', 'Booting OS...', 'Boot successful.'];
}

// =====================
// 起動結果の表示
// =====================
function showBootResult(success, compatible, missing = false) {
  document.getElementById('boot-result').classList.remove('hidden')

  if (success) {
    document.getElementById('boot-success').classList.remove('hidden')
  } else {
    document.getElementById('boot-failure').classList.remove('hidden')
    
    let reason = "";
    if (missing) {
      reason = 'パーツ不足による過電流で起動に失敗しました。';
    } else {
      reason = compatible
        ? 'パーツの不具合により起動に失敗しました。'
        : 'パーツの互換性エラーにより起動に失敗しました。';
    }
    document.getElementById('boot-failure-reason').textContent = reason

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

  if (deck.length > 0) {
    const drawn = deck.shift()
    bootPlayer.hand.push(drawn)
  }

  renderDebugHand()
}

function renderDebugHand() {
  const container = document.getElementById('debug-hand-cards')
  container.innerHTML = ''

  ;['cpu', 'gpu', 'memory', 'motherboard', 'psu'].forEach(key => {
    const slotCard = document.querySelector(`#debug-slot-${key} .slot-card`)
    if (slotCard) {
      slotCard.textContent = ''
      slotCard.classList.remove('filled')
    }
  })

  const debugBuild = { cpu: null, gpu: null, memory: null, motherboard: null, psu: null }
  
  bootPlayer.build = { ...debugBuild }

  bootPlayer.hand.forEach(card => {
    const el      = createCardEl(card)
    const type    = getCardType(card)
    const slotKey = typeToSlotKey(type)

    if (slotKey) {
      el.addEventListener('click', () => {
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

        const slotCard = document.querySelector(`#debug-slot-${slotKey} .slot-card`)
        if (slotCard) {
          slotCard.textContent = card.name
          slotCard.classList.add('filled')
        }

        bootPlayer.build = { ...debugBuild }
      })
    } else {
      el.style.opacity = '0.5'
    }

    container.appendChild(el)
  })

  // ★これで「再起動」ボタンが常に押せるようになります
  document.getElementById('btn-debug-boot').disabled = false
}

// ★抜けていた「再起動」ボタンのイベントリスナーを復活
document.getElementById('btn-debug-boot').addEventListener('click', () => {
  showScreen('screen-boot')
  runBiosAnimation(bootPlayer.build)
})

// =====================
// ベンチマーク画面（★復活！）
// =====================
function showBenchmarkScreen(player, penaltyApplied) {
  showScreen('screen-benchmark')
  document.getElementById('benchmark-player-name').textContent = player.name

  const build = player.build
  const cpuScore = build.cpu?.score ?? 0
  const gpuScore = build.gpu?.score ?? 0
  const maxScore = cpuScore + gpuScore

  let totalScore = benchmark(build)
  totalScore = synergyBonus(totalScore, build)
  totalScore = powerBonus(totalScore, build)

  if (penaltyApplied) {
    totalScore = Math.floor(totalScore * 0.7)
  }

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

  const psuBonus = { Bronze: 0.02, Gold: 0.05, Platinum: 0.08 }
  const psuRate  = psuBonus[build.psu?.rating] ?? 0
  if (psuRate > 0) {
    multiplier += psuRate
    addBonusRow(details, `電源品質（${build.psu.rating}）`, `+${psuRate * 100}%`)
  }

  const memRate = (build.memory?.capacity ?? 0) * 0.005
  if (memRate > 0) {
    multiplier += memRate
    addBonusRow(details, `メモリ容量（${build.memory.capacity}GB）`, `+${memRate * 100}%`)
  }

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
// 最終結果画面
// =====================
function showFinalResult() {
  showScreen('screen-result')

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
// PC組み立て → 起動
// =====================
document.getElementById('btn-boot').addEventListener('click', () => {
  players[getMyIndex()].build = { ...currentBuild };
  startBoot(players[getMyIndex()]);
});

document.getElementById('btn-force-boot').addEventListener('click', () => {
  players[getMyIndex()].build = { ...currentBuild };
  startBoot(players[getMyIndex()]);
});

// =====================
// もう一度遊ぶ
// =====================
document.getElementById('btn-restart').addEventListener('click', () => {
  location.reload()
})