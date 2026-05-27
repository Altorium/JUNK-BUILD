// ui-3d.js
let scene3D, camera3D, renderer3D, controls3D;
const partsInfo3D = { CPU: [], Memory: [], GPU: [], PSU: [] };

function init3D() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    // サイズを正しく取得する関数
    function getSize() {
        let w = container.clientWidth;
        let h = container.clientHeight;
        // 画面が隠れていてサイズが0の時の対策（強制的に画面の右半分のサイズにする）
        if (w === 0) {
            w = window.innerWidth / 2;
            h = window.innerHeight;
        }
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
    
    // マウスホイールでのズームと、右クリックでの平行移動を無効化
    controls3D.enableZoom = false;
    controls3D.enablePan = false;

    camera3D.position.set(-5.5, 5.0, 2.0); 
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
        model.scale.set(55, 55, 55);
        model.position.x = 1.75;
        model.position.y = 0.25;
        scene3D.add(model);

        model.traverse((child) => {
            const name = child.name;
            if (name.includes('Group_CPU')) registerPart3D('CPU', child);
            else if (name.includes('Group_Memory')) registerPart3D('Memory', child);
            else if (name.includes('Group_GPU')) registerPart3D('GPU', child);
            else if (name.includes('Group_PSU') || name.includes('Group_Power')) registerPart3D('PSU', child);
        });
        console.log("3Dモデル準備完了！");
    });

    // 画面サイズが変わった時に再計算
    window.addEventListener('resize', () => {
        if (!container || !camera3D || !renderer3D) return;
        const { w: newWidth, h: newHeight } = getSize();
        camera3D.aspect = newWidth / newHeight;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(newWidth, newHeight);
    });

    // ★重要: 起動画面が表示された瞬間にキャンバスサイズを整える
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
    partsInfo3D[key].push({
        object: object,
        targetY: object.position.y
    });
    object.position.y += 100;
    object.visible = false;
}

window.assemblePart3D = function (slotKey) {
    return new Promise((resolve) => {
        const keyMap = { 'cpu': 'CPU', 'memory': 'Memory', 'gpu': 'GPU', 'psu': 'PSU', 'motherboard': null };
        const targetKey = keyMap[slotKey];
        if (!targetKey) { resolve(); return; } 
        
        const parts = partsInfo3D[targetKey];
        if (!parts || parts.length === 0 || parts.some(p => p.object.visible)) { resolve(); return; }

        const tl = gsap.timeline({ onComplete: resolve });

        parts.forEach((part) => {
            part.object.visible = true;
            tl.to(part.object.position, { y: part.targetY, duration: 0.4, ease: "power4.in" }, 0); 
        });

        tl.to("#flash-overlay", { backgroundColor: "rgba(0, 255, 100, 0.7)", duration: 0.05 })
          .to("#flash-overlay", { backgroundColor: "rgba(0, 255, 100, 0)", duration: 0.4 });

        const effectText = document.getElementById('effect-text');
        effectText.innerText = `${targetKey} セット！`;

        tl.fromTo(effectText, { scale: 0, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.2, ease: "back.out(2)" }, "-=0.4")
          .to(effectText, { scale: 1, duration: 0.1 })
          .to(effectText, { opacity: 0, duration: 0.2 }, "+=0.5");
    });
};

window.hidePart3D = function(slotKey) {
    const keyMap = { 'cpu': 'CPU', 'memory': 'Memory', 'gpu': 'GPU', 'psu': 'PSU' };
    const parts = partsInfo3D[keyMap[slotKey]];
    if (parts) {
        parts.forEach(part => {
            gsap.killTweensOf(part.object.position);
            part.object.position.y = part.targetY + 100;
            part.object.visible = false;
        });
    }
};

window.resetParts3D = function () {
    ['cpu', 'memory', 'gpu', 'psu'].forEach(k => window.hidePart3D(k));
};

window.playFinalBootEffect3D = function() {
    return new Promise((resolve) => {
        const effectText = document.getElementById('effect-text');
        effectText.innerText = `起動成功！`; 
        const tlFinal = gsap.timeline({ onComplete: resolve });
        
        tlFinal.to("#flash-overlay", { backgroundColor: "rgba(255, 255, 255, 0.9)", duration: 0.1 })
               .to("#flash-overlay", { backgroundColor: "rgba(255, 255, 255, 0)", duration: 1.0 });

        tlFinal.fromTo(effectText, { scale: 0, opacity: 0 }, { scale: 1.5, opacity: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" }, "-=0.9")
               .to(effectText, { scale: 1.2, duration: 0.2 })
               .to(effectText, { opacity: 0, duration: 0.5 }, "+=1.5");
    });
}

window.addEventListener('DOMContentLoaded', init3D);