// happening.js - ハプニングカード定義

const happeningPre = [
  {
    id: 'blind_field',
    name: '暗闇のジャンク市',
    desc: 'このターンのみ！場のパーツはコストと種類しか確認できない！'
  },
  {
    id: 'shuffle_field',
    name: '大特価！在庫入れ替え',
    desc: '場のパーツが全て山札と入れ替わる！'
  },
  {
    id: 'field_rel_up',
    name: '品質チェック完了',
    desc: '場に出ているパーツの信頼度が全て1段階アップ！'
  },
  {
    id: 'field_rel_down',
    name: '水没倉庫からの在庫',
    desc: '場に出ているパーツの信頼度が全て1段階ダウン！'
  },
  {
    id: 'self_budget_up',
    name: '臨時収入！',
    desc: '自分の所持金が¥15増加！'
  },
  {
    id: 'opponent_budget_down',
    name: 'お前の財布を狙え！',
    desc: '相手全員の所持金が¥10減少！'
  }
]

const happeningPost = [
  {
    id: 'my_rel_up',
    name: '動作確認済み！',
    desc: '自分の手持ちパーツを1枚選んで、信頼度を1段階アップ！',
    interactive: true
  },
  {
    id: 'someone_rel_down',
    name: 'ハンマーで一撃',
    desc: '誰かの手持ちパーツを1枚選んで、信頼度を1段階ダウン！',
    interactive: true
  },
  {
    id: 'type_swap',
    name: 'パーツ交換交渉',
    desc: '種類を選ぶと、誰かの同じ種類のパーツとランダム交換！',
    interactive: true
  },
  {
    id: 'score_boost',
    name: 'オーバークロック！',
    desc: '自分のCPUとGPUのスコアがそれぞれ+500！',
    interactive: false
  },
  {
    id: 'buy_neighbor',
    name: '強制メルカリ',
    desc: '隣のプレイヤーのパーツを1枚、定価の1.5倍で買える！（任意）',
    interactive: true
  }
]
