import { db } from "./firebase-config.js";
import { doc, updateDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentRoomId = null; //今どのルームを監視しているか
let gameUnsubscribe = null; // watchGameStateの解除用関数

export function initSync(roomId) {
    currentRoomId = roomId; //監視するルームIDをセット　=　初期化
}

export function watchGameState(onUpdate) {
    // 既存のリスナーがあれば先に止める（二重登録防止）
    if (gameUnsubscribe) { gameUnsubscribe(); gameUnsubscribe = null; }

    const roomRef = doc(db, "rooms", currentRoomId);
    gameUnsubscribe = onSnapshot(roomRef, (snap) => {
        onUpdate(snap.data());
    });
}

export function stopGameState() {
    if (gameUnsubscribe) { gameUnsubscribe(); gameUnsubscribe = null; }
}

export async function updateGameState(data) {
    const roomRef = doc(db, "rooms", currentRoomId);
    await updateDoc(roomRef, data);
}

export async function skipTurn() {
    const roomRef = doc(db, "rooms", currentRoomId);
    const roomSnap = await getDoc(roomRef);
    const room = roomSnap.data();
    const newTurn = (room.turn + 1) % room.players.length;
    const newRound = newTurn === 0 ? (room.draftRound || 1) + 1 : (room.draftRound || 1);
    await updateDoc(roomRef, { turn: newTurn, draftRound: newRound });
}

export async function submitBuild(uid, build) {
    const roomRef = doc(db, "rooms", currentRoomId);
    await updateDoc(roomRef, { [`builds.${uid}`]: build });
}

export async function submitScore(uid, score) {
    const roomRef = doc(db, "rooms", currentRoomId);
    await updateDoc(roomRef, { [`scores.${uid}`]: score });
}

export function watchScores(playerUids, onAllDone) {
    const roomRef = doc(db, "rooms", currentRoomId);
    const unsub = onSnapshot(roomRef, (snap) => {
        const room = snap.data();
        const scores = room.scores || {};
        if (playerUids.every(uid => scores[uid] !== undefined)) {
            unsub();
            onAllDone(room.players, scores);
        }
    });
}

export async function pickCard(fieldIndex) {
    const roomRef = doc(db, "rooms", currentRoomId);
    const roomSnap = await getDoc(roomRef);
    const room = roomSnap.data();

    const card = room.field[fieldIndex];          // fieldから取り出す

    const players = room.players;
    players[room.turn].hand.push(card);
    players[room.turn].budget -= card.cost;       // 予算も減らす

    const newField = room.field.filter((_, i) => i !== fieldIndex);
    if (room.deck.length > 0) {
        newField.push(room.deck[0]);              // deckから補充
    }
    const newDeck = room.deck.slice(1);           // deckの先頭を削除

    const newTurn = (room.turn + 1) % players.length;
    const newRound = newTurn === 0 ? (room.draftRound || 1) + 1 : (room.draftRound || 1);

    await updateGameState({ field: newField, deck: newDeck, players, turn: newTurn, draftRound: newRound });
}