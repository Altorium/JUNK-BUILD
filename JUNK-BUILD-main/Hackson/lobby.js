import { db, loginAnonymously } from "./firebase-config.js";
import {
    doc, setDoc, updateDoc, onSnapshot, getDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initSync, updateGameState } from "./sync.js";
import { startOnlineGame } from "./ui-draft.js";

//「自分のID」「今いるルームのID」「自分がホストかどうか」を記憶する変数
let myUid = null;
let currentRoomId = null;
let isHost = false;

function generateRoomId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id = "";
    for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

// ゲーム開始前のロビー画面の処理をまとめたファイル,ルームを作るファイル
async function createRoom() {
    const name = document.getElementById("input-player-name").value.trim(); //trimは末尾や先頭の不要なものを削除　スペースや改行
    if (!name) { alert("名前を入力してください"); return; }

    myUid = await loginAnonymously();
    isHost = true;
    currentRoomId = generateRoomId();

    const roomData = {  //FireStoreに保存するデータの設計図
        status: "waiting",
        hostId: myUid,
        players: [{
            id: myUid,
            name: name,
            budget: 130,
            hand: [],
            build: {},
            score: 0,
            broken: false,
            ready: false
        }]
    };

    await setDoc(doc(db, "rooms", currentRoomId), roomData); //setDoc(パス、データ)はパスにデータを書き込む、doc(db, "rooms", currentRoomId) → rooms/XXXXXX というFirestoreのパス

    document.getElementById("display-room-id").textContent = currentRoomId; //生成したルームIDを表示
    document.getElementById("lobby-waiting").classList.remove("hidden");  // 隠す状態をリムーブして待機状態を表示する
    document.getElementById("lobby-actions").classList.add("hidden");  //隠す状態を付与してロビーアクション、ルーム作成や参加するボタンを隠す

    watchRoom();
}

//ルームに参加する処理、ルームIDを入力して参加する  

async function joinRoom() {
    const name = document.getElementById("input-player-name").value.trim();
    const roomId = document.getElementById("input-room-id").value.trim().toUpperCase(); //toUpperCaseは受け取った小文字をすべて大文字にする

    if (!name) { alert("名前を入力してください"); return; }
    if (roomId.length !== 6) { alert("ルームIDは6文字です"); return; } //roomId.length(roomIdの文字数)が !== 6　(6でないとき)

    myUid = await loginAnonymously();
    currentRoomId = roomId;

    const roomRef = doc(db, "rooms", roomId); // 参加したいルームのパス
    const roomSnap = await getDoc(roomRef); //そのルームが実際に存在するか確認、さっきsetDocしたものをgetDocする

    if (!roomSnap.exists()) { alert("ルームが見つかりません"); return; }

    const currentPlayers = roomSnap.data().players; //取得したルームデータの中身を取り出す
    if (currentPlayers.length >= 4) { alert("ルームが満員です"); return; }

    const newPlayer = {
        id: myUid,
        name: name,
        budget: 130,
        hand: [],
        build: {},
        score: 0,
        broken: false,
        ready: false
    };


    await updateDoc(roomRef, {
        players: arrayUnion(newPlayer)
    });

    document.getElementById("lobby-waiting").classList.remove("hidden");
    document.getElementById("lobby-actions").classList.add("hidden");

    watchRoom();
}

let lobbyUnsubscribe = null;

// ルームの状態をリアルタイムで監視する関数、参加者の一覧やゲーム開始の合図を受け取る
function watchRoom() {
    const roomRef = doc(db, "rooms", currentRoomId);

    lobbyUnsubscribe = onSnapshot(roomRef, (snap) => {
        const room = snap.data();

        // 参加者一覧を表示
        const ul = document.getElementById("lobby-players");
        ul.innerHTML = "";
        room.players.forEach(p => {
            const li = document.createElement("li");
            li.textContent = p.name;
            ul.appendChild(li);
        });

        // ホストだけ「ゲーム開始」ボタンを表示
        if (isHost && room.players.length >= 2) {
            document.getElementById("btn-start-game").classList.remove("hidden");
        }

        // ゲーム開始されたら画面遷移（ロビーの監視は止める）
        if (room.status === "playing") {
            if (lobbyUnsubscribe) { lobbyUnsubscribe(); lobbyUnsubscribe = null; }
            startGame(room);
        }
    });
}

async function hostStartGame() {
    const roomRef = doc(db, "rooms", currentRoomId);
    await updateDoc(roomRef, { status: "playing" });
}

function startGame(room) {
    document.getElementById("screen-lobby").classList.add("hidden");
    document.getElementById("screen-prep").classList.remove("hidden");

    initSync(currentRoomId);

    if (isHost) {
        const state = initGame(); // deck と field だけ使う

        // room の参加者で players を上書き
        const players = room.players.map(p => ({
            id: p.id,
            name: p.name,
            budget: 130,
            hand: [],
            build: {},
            score: 0,
            broken: false
        }));

        updateGameState({
            deck: state.deck,
            field: state.field,
            turn: state.turn,
            event: state.event,
            players: players,   // ← 実際の参加者
            gameOver: false,
            draftRound: 1
        });
    }
    
    startOnlineGame(myUid);
}

document.getElementById("btn-online").addEventListener("click", () => {
    document.getElementById("screen-title").classList.add("hidden");
    document.getElementById("screen-lobby").classList.remove("hidden");
});
document.getElementById("btn-create-room").addEventListener("click", createRoom);
document.getElementById("btn-join-room").addEventListener("click", joinRoom);
document.getElementById("btn-start-game").addEventListener("click", hostStartGame);

