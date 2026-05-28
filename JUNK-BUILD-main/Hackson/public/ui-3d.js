// ui-3d.js
let scene3D, camera3D, renderer3D, controls3D;
const partsInfo3D = {};

function init3D() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    function getSize() {
        let w = container.clientWidth;
        let h = container.clientHeight;
        if (w === 0) { w = window.innerWidth / 2; h = window.innerHeight; }
        return { w, h };
    }

    const { w: width, h: height } = getSize();

    scene3D = new THREE.Scene();
    camera3D = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    renderer3D = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer3D.setSize(width, height);
    renderer3D.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer3D.domElement);

    controls3D = new THREE.OrbitControls(camera3D, renderer3D.domElement);
    controls3D.enableDamping = true;
    controls3D.enableZoom = false;
    controls3D.enablePan = false;

    camera3D.position.set(-7.0, 5.0, 2.0); 
    controls3D.target.set(0, 0, 0);
    controls3D.update();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene3D.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 30, 20);
    scene3D.add(dirLight);

    const loader = new THREE.GLTFLoader();
    loader.load('pc_build.glb', (gltf) => {
        const model = gltf.scene;
        model.scale.set(50, 50, 50);
        scene3D.add(model);
        model.position.x = 0.75;
        model.position.y = 0.5;

        model.traverse((child) => {
            const name = child.name;
            if (name.includes('Group_Motherboard')) registerPart3D('Motherboard', child);
            else if (name.includes('Group_CPU')) registerPart3D('CPU', child);
            else if (name.includes('Group_GPU_2Fan')) registerPart3D('GPU_2Fan', child);
            else if (name.includes('Group_GPU_3Fan')) registerPart3D('GPU_3Fan', child);
            else if (name.includes('Group_Memory_1')) registerPart3D('Memory_1', child);
            else if (name.includes('Group_Memory_2')) registerPart3D('Memory_2', child);
            else if (name.includes('Group_PSU') || name.includes('Group_Power')) registerPart3D('PSU', child);
        });
        console.log("3Dモデル準備完了！");
    });

    window.addEventListener('resize', () => {
        if (!container || !camera3D || !renderer3D) return;
        const { w: newWidth, h: newHeight } = getSize();
        camera3D.aspect = newWidth / newHeight;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(newWidth, newHeight);
    });

    const observer = new MutationObserver(() => {
        if (container.clientWidth > 0 && renderer3D.domElement.width < container.clientWidth) {
            const { w: newWidth, h: newHeight } = getSize();
            camera3D.aspect = newWidth / newHeight;
            camera3D.updateProjectionMatrix();
            renderer3D.setSize(newWidth, newHeight);
        }
    });
    observer.observe(document.getElementById('screen-boot'), { attributes: true, attributeFilter: ['class'] });

    function animate3D() {
        requestAnimationFrame(animate3D);
        controls3D.update();
        renderer3D.render(scene3D, camera3D);
    }
    animate3D();
}

function registerPart3D(key, object) {
    if (!partsInfo3D[key]) partsInfo3D[key] = [];
    partsInfo3D[key].push({
        object: object,
        targetY: object.position.y
    });
    object.position.y += 100;
    object.visible = false;
}

window.assemblePart3D = function (slotKey, cardData) {
    return new Promise((resolve) => {
        if (!cardData) { resolve(); return; } 
        
        // ★ 複数のパーツを同時に動かせるように配列に変更
        let targetKeys = [];

        if (slotKey === 'motherboard') targetKeys.push('Motherboard');
        if (slotKey === 'cpu') targetKeys.push('CPU');
        if (slotKey === 'psu') targetKeys.push('PSU');
        
        if (slotKey === 'gpu') {
            if (cardData.score >= 6000) targetKeys.push('GPU_3Fan');
            else targetKeys.push('GPU_2Fan');
        }
        if (slotKey === 'memory') {
            // ★ 8GBと32GBの場合は2枚挿し (Memory_1 と Memory_2 の両方を追加)
            if (cardData.capacity === 8 || cardData.capacity === 32) {
                targetKeys.push('Memory_1', 'Memory_2');
            } else {
                // 4GB, 16GBなどは1枚挿し
                targetKeys.push('Memory_1');
            }
        }

        if (targetKeys.length === 0) { resolve(); return; }

        const tl = gsap.timeline({ onComplete: resolve });
        let partsToAnimate = [];

        // ★ targetKeys に入っている全ての3Dオブジェクトをアニメーション対象にする
        targetKeys.forEach(key => {
            const parts = partsInfo3D[key];
            if (parts && parts.length > 0) {
                parts.forEach(p => {
                    if (!p.object.visible) partsToAnimate.push(p);
                });
            }
        });

        if (partsToAnimate.length === 0) { resolve(); return; }

        // 抽出したパーツを全て同時に落下させる
        partsToAnimate.forEach((part) => {
            part.object.visible = true;
            tl.to(part.object.position, { y: part.targetY, duration: 1.0, ease: "bounce.out" }, 0); 
        });

        tl.to("#flash-overlay", { backgroundColor: "rgba(0, 255, 100, 0.4)", duration: 0.1 }, "-=0.2")
          .to("#flash-overlay", { backgroundColor: "rgba(0, 255, 100, 0)", duration: 0.6 });

        const effectText = document.getElementById('effect-text');
        
        // ★ エフェクト文字の調整
        let textToShow = targetKeys[0].replace('_', ' ');
        
        if (slotKey === 'memory' && targetKeys.length > 1) {
            textToShow = 'Memory x2';
        } else if (slotKey === 'gpu') {
            // ★ 追加: GPUの場合はファン数に合わせて文字を変える
            if (targetKeys.includes('GPU_3Fan')) {
                textToShow = '3連GPU';
            } else {
                textToShow = '2連GPU';
            }
        }
        
        effectText.innerText = `${textToShow} セット！`;

        tl.fromTo(effectText, { scale: 0, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.4, ease: "back.out(1.5)" }, 0)
          .to(effectText, { scale: 1, duration: 0.6 })
          .to(effectText, { opacity: 0, duration: 0.4 }, "+=0.2");
    });
};

window.hidePart3D = function(slotKey) {
    const targetKeys = [];
    if (slotKey === 'motherboard') targetKeys.push('Motherboard');
    if (slotKey === 'cpu') targetKeys.push('CPU');
    if (slotKey === 'psu') targetKeys.push('PSU');
    if (slotKey === 'gpu') targetKeys.push('GPU_2Fan', 'GPU_3Fan');
    if (slotKey === 'memory') targetKeys.push('Memory_1', 'Memory_2');

    targetKeys.forEach(k => {
        const parts = partsInfo3D[k];
        if (parts) {
            parts.forEach(part => {
                gsap.killTweensOf(part.object.position);
                part.object.position.y = part.targetY + 100;
                part.object.visible = false;
            });
        }
    });
};

window.resetParts3D = function () {
    ['motherboard', 'cpu', 'memory', 'gpu', 'psu'].forEach(k => window.hidePart3D(k));
};

window.playFinalBootEffect3D = function() {
    return new Promise((resolve) => {
        const effectText = document.getElementById('effect-text');
        effectText.innerText = `起動開始！`; 
        const tlFinal = gsap.timeline({ onComplete: resolve });
        
        tlFinal.to("#flash-overlay", { backgroundColor: "rgba(255, 255, 255, 0.9)", duration: 0.1 })
               .to("#flash-overlay", { backgroundColor: "rgba(255, 255, 255, 0)", duration: 1.0 });

        tlFinal.fromTo(effectText, { scale: 0, opacity: 0 }, { scale: 1.5, opacity: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" }, "-=0.9")
               .to(effectText, { scale: 1.2, duration: 0.2 })
               .to(effectText, { opacity: 0, duration: 0.5 }, "+=1.5");
    });
}

// ★変更：爆発エフェクトを「だんだん大きく」「長く滞在する」ように変更
window.playExplosionEffect3D = function() {
    return new Promise((resolve) => {
        const effectText = document.getElementById('effect-text');
        effectText.innerText = `BOOOM!!`; // 文字はここでお好きに変更してください
        effectText.style.color = '#ff0000';
        effectText.style.textShadow = '0 0 30px #ff0000, 0 0 60px #ff0000';
        
        const tlFinal = gsap.timeline({ onComplete: () => {
            effectText.style.color = '#00ff66';
            effectText.style.textShadow = '0 0 20px #00ff66, 0 0 40px #00ff66';
            resolve();
        }});
        
        // 画面の赤フラッシュを少し長く残す
        tlFinal.to("#explosion-overlay", { opacity: 1, duration: 0.2 })
               .to("#explosion-overlay", { opacity: 0, duration: 3.5, ease: "power2.out" }, "+=0.3");

        // カメラの揺れ（シェイク）も長めに
        tlFinal.to(camera3D.position, {
            x: "+=0.8", y: "+=0.8", z: "+=0.8",
            yoyo: true, repeat: 60, duration: 0.05
        }, 0);

        // ★変更: 文字が小さめからスタートし、じわじわと巨大化しながら3秒間かけて迫ってくる
        tlFinal.fromTo(effectText, { scale: 0.5, opacity: 0 }, { scale: 4.5, opacity: 1, duration: 3.0, ease: "power1.out" }, 0)
               // ★変更: 大きくなりきったら、1秒間表示を維持してからゆっくり消える
               .to(effectText, { opacity: 0, duration: 1.0 }, "+=1.0");
    });
}

window.addEventListener('DOMContentLoaded', init3D);