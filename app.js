// 🇯🇵 日本旅遊可愛記帳趣 - 核心邏輯 JavaScript 🐈

// 1. 全域狀態管理
let state = {
    exchangeRate: 0.201, // 預設信用卡匯率 (0.198 * 1.015)
    parentPin: "1234",
    activeUser: null, // 目前登入的角色物件
    selectedCategory: "扭蛋", // 目前選擇的記帳類別
    selectedParentCategory: "交通",
    pinBuffer: "", // PIN 輸入緩衝
    members: [],
    creditCards: [],
    transactions: [],
    lastUpdated: 0
};

// 預設初使化數據
const DEFAULT_STATE = {
    exchangeRate: 0.201,
    parentPin: "1234",
    lastUpdated: 0,
    members: [
        { id: "parent", name: "媽媽/爸爸", avatar: "🐶", type: "parent", budget: 0 },
        { id: "kid1", name: "樂樂", avatar: "🐱", type: "kid", budget: 2000 },
        { id: "kid2", name: "咪咪", avatar: "🐰", type: "kid", budget: 2500 },
        { id: "kid3", name: "嘟嘟", avatar: "🦊", type: "kid", budget: 1500 }
    ],
    creditCards: [
        { name: "富邦Ｊ卡媽", rate: 0.5, threshold: 0, cap: 0 },
        { name: "富邦Ｊ卡爸", rate: 0.5, threshold: 0, cap: 0 },
        { name: "玉山熊本", rate: 2.5, threshold: 0, cap: 0 },
        { name: "第一銀行JCB", rate: 1.5, threshold: 0, cap: 0 }
    ],
    transactions: [
        {
            id: "init-1",
            userId: "kid1",
            userName: "樂樂",
            userAvatar: "🐱",
            jpy: 500,
            twd: 101,
            category: "扭蛋",
            note: "柴犬公仔扭蛋 🪙",
            payMethod: "cash",
            cardName: null,
            timestamp: Date.now() - 3600000 * 2
        },
        {
            id: "init-2",
            userId: "kid2",
            userName: "咪咪",
            userAvatar: "🐰",
            jpy: 1500,
            twd: 302,
            category: "玩具",
            note: "卡皮巴拉娃娃 🧸",
            payMethod: "card",
            cardName: "富邦Ｊ卡媽",
            timestamp: Date.now() - 3600000
        }
    ]
};

// 2. 初始化應用程式
function initApp() {
    try {
        loadStateFromStorage();
        initSakuraBackground();
        renderRoleGrid();
        setupEventListeners();
        
        // 初始化 Firebase 雲端同步
        initFirebaseSync();
    } catch (e) {
        alert("程式初始化失敗：" + e.message + "\n" + e.stack);
    }
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

// Firebase 私人雲端設定管理
let firebaseConfig = null;
try {
    const savedConfig = localStorage.getItem("japan_travel_budget_firebase_config");
    if (savedConfig) {
        firebaseConfig = JSON.parse(savedConfig);
    }
} catch (e) {
    console.warn("無法載入 Firebase 設定:", e);
}

// 從 LocalStorage 載入資料
function loadStateFromStorage() {
    let saved = null;
    try {
        saved = localStorage.getItem("japan_travel_budget_data");
    } catch (e) {
        console.warn("LocalStorage 讀取被瀏覽器封鎖：", e);
    }
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
            
            // 安全防護：若讀取出的成員或卡片為空，強制修復為預設值
            if (!state.members || state.members.length === 0) {
                state.members = [...DEFAULT_STATE.members];
            }
            if (!state.creditCards || state.creditCards.length === 0) {
                state.creditCards = [...DEFAULT_STATE.creditCards];
            }
            
            // 自動遷移：如果本機快取仍包含舊的預設卡片，自動更新為新的專屬卡片與回饋設定
            if (state.creditCards.some(c => c.name === "富邦 J卡")) {
                state.creditCards = DEFAULT_STATE.creditCards;
                state.transactions.forEach(tx => {
                    if (tx.cardName === "富邦 J卡") {
                        tx.cardName = "富邦Ｊ卡媽";
                    }
                });
                saveStateToStorage();
            }
        } catch (e) {
            console.error("載入本機資料失敗，使用預設值", e);
            state = { ...DEFAULT_STATE };
        }
    } else {
        state = { ...DEFAULT_STATE };
        saveStateToStorage();
    }
}

// 儲存資料至 LocalStorage
function saveStateToStorage() {
    state.lastUpdated = Date.now();
    const serializedState = {
        exchangeRate: state.exchangeRate,
        parentPin: state.parentPin,
        members: state.members,
        creditCards: state.creditCards,
        transactions: state.transactions,
        lastUpdated: state.lastUpdated
    };
    
    try {
        localStorage.setItem("japan_travel_budget_data", JSON.stringify(serializedState));
    } catch (e) {
        console.warn("LocalStorage 寫入被瀏覽器封鎖：", e);
    }
    
    // 同步推送到 Firebase
    if (firebaseConfig && typeof firebase !== "undefined" && firebase.apps.length > 0) {
        try {
            firebase.database().ref("travel_budget_state").set(serializedState)
                .then(() => console.log("☁️ 雲端同步成功"))
                .catch(err => console.error("☁️ 雲端同步失敗:", err));
        } catch (e) {
            console.error("Firebase 推送失敗:", e);
        }
    }
}

// 初始化 Firebase 同步
function initFirebaseSync() {
    if (!firebaseConfig || typeof firebase === "undefined") return;
    try {
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        
        console.log("☁️ 已連線至您的專屬 Firebase 雲端資料庫");
        
        // 監聽變更
        firebase.database().ref("travel_budget_state").on("value", snapshot => {
            const val = snapshot.val();
            if (val && val.lastUpdated) {
                // 雲端資料比本地新時才更新
                if (val.lastUpdated > (state.lastUpdated || 0)) {
                    console.log("☁️ 偵測到雲端有較新資料，進行更新...");
                    state = val;
                    try {
                        localStorage.setItem("japan_travel_budget_data", JSON.stringify(state));
                    } catch (e) {}
                    
                    // 重繪當前頁面
                    if (state.activeUser) {
                        if (state.activeUser.id === "parent") {
                            initParentDashboard();
                        } else {
                            updateChildBudgetDisplay();
                            renderChildHistory();
                        }
                    } else {
                        renderRoleGrid();
                    }
                }
            }
        });
    } catch (e) {
        console.error("Firebase 初始化失敗:", e);
    }
}

// 3. 櫻花飄落動畫效果
function initSakuraBackground() {
    const container = document.getElementById("sakura-container");
    if (!container) return;
    
    // 定時產生櫻花瓣
    setInterval(() => {
        if (document.hidden) return; // 視窗隱藏時不產生
        createSakuraPetal(container);
    }, 1500);
}

function createSakuraPetal(container) {
    const petal = document.createElement("div");
    petal.classList.add("sakura-petal");
    
    const size = Math.random() * 8 + 6; // 花瓣大小 6px ~ 14px
    petal.style.width = `${size}px`;
    petal.style.height = `${size}px`;
    
    petal.style.left = `${Math.random() * 100}vw`; // 隨機水平起點
    petal.style.animationDuration = `${Math.random() * 5 + 5}s`; // 隨機飄落速度 5s ~ 10s
    petal.style.opacity = Math.random() * 0.5 + 0.5; // 隨機透明度
    
    container.appendChild(petal);
    
    // 飄落完自動刪除
    setTimeout(() => {
        petal.remove();
    }, 10000);
}

// 點擊記帳成功時的櫻花碎屑特效 (Explosion)
function triggerMascotAnimation() {
    const container = document.getElementById("sakura-container");
    if (!container) return;
    
    for (let i = 0; i < 15; i++) {
        const petal = document.createElement("div");
        petal.classList.add("sakura-petal");
        
        const size = Math.random() * 10 + 6;
        petal.style.width = `${size}px`;
        petal.style.height = `${size}px`;
        
        // 集中在螢幕中央附近向外散開
        petal.style.left = `calc(50vw + ${Math.random() * 200 - 100}px)`;
        petal.style.top = `calc(40vh + ${Math.random() * 200 - 100}px)`;
        petal.style.animation = `fall ${Math.random() * 2 + 1}s ease-out forwards`;
        
        container.appendChild(petal);
        setTimeout(() => petal.remove(), 3000);
    }
}

// 4. 角色登入系統
function renderRoleGrid() {
    const grid = document.getElementById("role-grid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    // 渲染小孩卡片
    state.members.forEach(member => {
        if (member.type === "kid") {
            const card = document.createElement("div");
            card.className = "role-card";
            card.onclick = () => selectRole(member.id);
            
            // 計算個人剩餘預算百分比
            const totalSpent = getMemberSpent(member.id);
            const budgetPercent = member.budget > 0 ? Math.min(Math.round((totalSpent / member.budget) * 100), 100) : 0;
            
            card.innerHTML = `
                <div class="role-avatar">${member.avatar}</div>
                <div class="role-name">${member.name}</div>
                <div class="role-type" style="background-color: var(--primary);">預算 NT$ ${member.budget}</div>
                <div style="font-size: 11px; margin-top: 5px; color: var(--text-muted);">
                    已花費 ${budgetPercent}%
                </div>
            `;
            grid.appendChild(card);
        }
    });
    
    // 渲染家長卡片（置底滿寬）
    const parentMember = state.members.find(m => m.type === "parent");
    if (parentMember) {
        const parentCard = document.createElement("div");
        parentCard.className = "role-card parent";
        parentCard.onclick = () => selectRole(parentMember.id);
        parentCard.innerHTML = `
            <div class="role-avatar">${parentMember.avatar}</div>
            <div class="role-info">
                <div class="role-name">${parentMember.name}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">管理全家預算、查看信用卡回饋</div>
            </div>
        `;
        grid.appendChild(parentCard);
    }
}

function selectRole(userId) {
    const user = state.members.find(m => m.id === userId);
    if (!user) return;
    
    state.activeUser = user;
    
    if (user.type === "parent") {
        // 家長需要密碼驗證
        state.pinBuffer = "";
        updatePinDots();
        document.getElementById("pin-error").innerText = "";
        switchScreen("pin-screen");
    } else {
        // 小孩直接進入個人面板
        initChildDashboard();
        switchScreen("child-screen");
    }
}

// 5. PIN 碼鎖機制
function pressPin(key) {
    const errorEl = document.getElementById("pin-error");
    errorEl.innerText = "";
    
    if (key === "cls") {
        state.pinBuffer = "";
    } else if (key === "del") {
        state.pinBuffer = state.pinBuffer.slice(0, -1);
    } else {
        if (state.pinBuffer.length < 4) {
            state.pinBuffer += key;
        }
    }
    
    updatePinDots();
    
    if (state.pinBuffer.length === 4) {
        // 延遲一點點，讓第四個點點亮起後才驗證，體驗較好
        setTimeout(() => {
            if (state.pinBuffer === state.parentPin) {
                state.pinBuffer = "";
                updatePinDots();
                initParentDashboard();
                switchScreen("parent-screen");
            } else {
                errorEl.innerText = "❌ 密碼錯誤！請再試一次。";
                state.pinBuffer = "";
                updatePinDots();
                // 震動/閃爍特效
                const pinCard = document.querySelector(".pin-card");
                pinCard.style.animation = "shake 0.3s ease-in-out";
                setTimeout(() => pinCard.style.animation = "", 300);
            }
        }, 150);
    }
}

function updatePinDots() {
    const dots = document.querySelectorAll(".pin-dots .dot");
    dots.forEach((dot, index) => {
        if (index < state.pinBuffer.length) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });
}

// 畫面切換控制
function switchScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(screenId).classList.add("active");
    
    // 如果返回角色選擇，重新渲染角色列表以更新最新預算進度
    if (screenId === "role-select-screen") {
        renderRoleGrid();
    }
}

// 家長分頁切換
function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    
    // 尋找對應的按鈕並啟動
    const btn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.getAttribute("onclick").includes(tabId));
    if (btn) btn.classList.add("active");
    
    document.getElementById(tabId).classList.add("active");
    
    if (tabId === "parent-dashboard") {
        renderParentOverview();
    } else if (tabId === "parent-cards") {
        renderParentCards();
    } else if (tabId === "parent-settings") {
        renderParentSettings();
    }
}

// 6. 小孩記帳介面邏輯
function initChildDashboard() {
    if (!state.activeUser) return;
    
    // 設定頭像與名字
    document.getElementById("child-avatar").innerText = state.activeUser.avatar;
    document.getElementById("child-name").innerText = state.activeUser.name;
    document.getElementById("current-rate-display").innerText = state.exchangeRate;
    
    // 清空輸入框
    document.getElementById("jpy-calc").value = "";
    document.getElementById("twd-calc").value = "";
    document.getElementById("log-jpy").value = "";
    document.getElementById("log-twd").value = "";
    document.getElementById("log-note").value = "";
    
    // 初始化類別晶片
    selectCategory("扭蛋", document.querySelector("#child-log-form .chip"));
    
    // 初始化付款方式為現金
    document.querySelector('input[name="pay-method"][value="cash"]').checked = true;
    toggleCardDropdown(false);
    
    // 渲染信用卡下拉選單
    populateCardDropdown("log-card-name");
    
    // 渲染個人預算狀態
    updateChildBudgetDisplay();
    
    // 渲染歷史清單
    renderChildHistory();
}

// 預算及吉祥物狀態更新
function updateChildBudgetDisplay() {
    const user = state.activeUser;
    const spent = getMemberSpent(user.id);
    const limit = user.budget;
    const remaining = limit - spent;
    const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    
    document.getElementById("child-spent-display").innerText = `NT$ ${Math.round(spent)}`;
    document.getElementById("child-limit-display").innerText = `NT$ ${Math.round(limit)}`;
    
    const remainingEl = document.getElementById("child-remaining-display");
    remainingEl.innerText = `NT$ ${Math.round(remaining)}`;
    
    const progressBar = document.getElementById("child-progress-bar");
    progressBar.style.width = `${percent}%`;
    
    // 移除舊的樣式
    progressBar.classList.remove("success", "warning", "danger");
    remainingEl.classList.remove("highlight-green", "highlight-orange", "highlight-red");
    
    const mascot = document.getElementById("budget-mascot");
    const bTitle = document.getElementById("budget-title");
    const bSubtitle = document.getElementById("budget-subtitle");
    
    // 根據花費比例顯示不同顏色與吉祥物表情
    if (percent < 70) {
        progressBar.classList.add("success");
        remainingEl.classList.add("highlight-green");
        mascot.innerText = "😄";
        bTitle.innerText = "預算還很充足唷！";
        bSubtitle.innerText = "買東西時別忘了先想一想再記帳喔！";
    } else if (percent >= 70 && percent < 100) {
        progressBar.classList.add("warning");
        remainingEl.classList.add("highlight-orange");
        mascot.innerText = "😮";
        bTitle.innerText = "注意！預算快要滿囉！";
        bSubtitle.innerText = "請仔細想想是不是真的很想要這件東西？";
    } else {
        progressBar.classList.add("danger");
        remainingEl.classList.add("highlight-red");
        mascot.innerText = "😭";
        bTitle.innerText = "啊！你的預算超額了！";
        bSubtitle.innerText = "預算已經用完囉，建議不要再花錢了！";
    }
}

// 即時匯率換算
function convertCurrency(source) {
    const rate = state.exchangeRate;
    const jpyInput = document.getElementById("jpy-calc");
    const twdInput = document.getElementById("twd-calc");
    
    if (source === "jpy") {
        const jpy = parseFloat(jpyInput.value);
        if (isNaN(jpy) || jpy <= 0) {
            twdInput.value = "";
        } else {
            twdInput.value = Math.round(jpy * rate);
        }
    } else {
        const twd = parseFloat(twdInput.value);
        if (isNaN(twd) || twd <= 0) {
            jpyInput.value = "";
        } else {
            jpyInput.value = Math.round(twd / rate);
        }
    }
}

// 新增記帳表單輸入的日幣與台幣即時連動
function syncLogTwd() {
    const jpy = parseFloat(document.getElementById("log-jpy").value);
    const twdInput = document.getElementById("log-twd");
    if (isNaN(jpy) || jpy <= 0) {
        twdInput.value = "";
    } else {
        twdInput.value = Math.round(jpy * state.exchangeRate);
    }
}

function syncParentLogTwd() {
    const jpy = parseFloat(document.getElementById("p-log-jpy").value);
    const twdInput = document.getElementById("p-log-twd");
    if (isNaN(jpy) || jpy <= 0) {
        twdInput.value = "";
    } else {
        twdInput.value = Math.round(jpy * state.exchangeRate);
    }
}

// 選擇品項類別晶片
function selectCategory(category, element) {
    state.selectedCategory = category;
    
    // 移除表單內其他晶片的 active
    const parentNode = element.parentNode;
    parentNode.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    element.classList.add("active");
}

function selectParentCategory(category, element) {
    state.selectedParentCategory = category;
    const parentNode = element.parentNode;
    parentNode.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    element.classList.add("active");
}

// 顯示/隱藏信用卡下拉選單
function toggleCardDropdown(show) {
    const group = document.getElementById("card-select-group");
    if (show) {
        group.classList.remove("hidden");
    } else {
        group.classList.add("hidden");
    }
}

function toggleParentCardDropdown(show) {
    const group = document.getElementById("p-card-select-group");
    if (show) {
        group.classList.remove("hidden");
    } else {
        group.classList.add("hidden");
    }
}

// 填充信用卡下拉選單
function populateCardDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = "";
    if (state.creditCards.length === 0) {
        select.innerHTML = '<option value="">(尚未設定任何信用卡)</option>';
        return;
    }
    
    state.creditCards.forEach(card => {
        const option = document.createElement("option");
        option.value = card.name;
        // 如果是小孩記帳的下拉選單，只顯示卡名，不顯示回饋％
        if (selectId === "log-card-name") {
            option.innerText = card.name;
        } else {
            option.innerText = `${card.name} (${card.rate}% 回饋)`;
        }
        select.appendChild(option);
    });
}

// 7. 記帳資料處理
// 快速記帳扭蛋
function quickLogGacha(jpy) {
    if (!state.activeUser) return;
    
    const twd = Math.round(jpy * state.exchangeRate);
    const newTx = {
        id: "tx-" + Date.now() + Math.random().toString(36).substr(2, 5),
        userId: state.activeUser.id,
        userName: state.activeUser.name,
        userAvatar: state.activeUser.avatar,
        jpy: jpy,
        twd: twd,
        category: "扭蛋",
        note: `快速扭蛋記帳 🪙`,
        payMethod: "cash",
        cardName: null,
        timestamp: Date.now()
    };
    
    state.transactions.unshift(newTx);
    saveStateToStorage();
    
    triggerMascotAnimation();
    updateChildBudgetDisplay();
    renderChildHistory();
}

// 一般手動記帳儲存
function saveTransaction(e) {
    e.preventDefault();
    if (!state.activeUser) return;
    
    const jpyInput = document.getElementById("log-jpy");
    const twdInput = document.getElementById("log-twd");
    const noteInput = document.getElementById("log-note");
    const payMethod = document.querySelector('input[name="pay-method"]:checked').value;
    const cardSelect = document.getElementById("log-card-name");
    
    const jpy = parseFloat(jpyInput.value);
    const twd = parseFloat(twdInput.value);
    if (isNaN(jpy) || jpy <= 0) return;
    
    let cardName = null;
    if (payMethod === "card") {
        if (state.creditCards.length === 0) {
            alert("請先到家長設定中新增您的信用卡唷！");
            return;
        }
        cardName = cardSelect.value;
    }
    
    const note = noteInput.value.trim() || `${state.selectedCategory}支出`;
    
    const newTx = {
        id: "tx-" + Date.now() + Math.random().toString(36).substr(2, 5),
        userId: state.activeUser.id,
        userName: state.activeUser.name,
        userAvatar: state.activeUser.avatar,
        jpy: jpy,
        twd: twd,
        category: state.selectedCategory,
        note: note,
        payMethod: payMethod,
        cardName: cardName,
        timestamp: Date.now()
    };
    
    state.transactions.unshift(newTx);
    saveStateToStorage();
    
    triggerMascotAnimation();
    
    // 重置欄位與更新介面
    jpyInput.value = "";
    twdInput.value = "";
    noteInput.value = "";
    
    updateChildBudgetDisplay();
    renderChildHistory();
}

// 家長手動新增公務/公用記帳儲存
function saveParentTransaction(e) {
    e.preventDefault();
    
    const jpyInput = document.getElementById("p-log-jpy");
    const twdInput = document.getElementById("p-log-twd");
    const noteInput = document.getElementById("p-log-note");
    const payMethod = document.querySelector('input[name="p-pay-method"]:checked').value;
    const cardSelect = document.getElementById("p-log-card-name");
    
    const jpy = parseFloat(jpyInput.value);
    const twd = parseFloat(twdInput.value);
    if (isNaN(jpy) || jpy <= 0) return;
    
    let cardName = null;
    if (payMethod === "card") {
        if (state.creditCards.length === 0) {
            alert("請先設定您的信用卡！");
            return;
        }
        cardName = cardSelect.value;
    }
    
    const note = noteInput.value.trim() || `公用${state.selectedParentCategory}支出`;
    
    const parentMember = state.members.find(m => m.type === "parent") || { id: "parent", name: "家長", avatar: "🐕" };
    
    const newTx = {
        id: "tx-" + Date.now() + Math.random().toString(36).substr(2, 5),
        userId: parentMember.id,
        userName: parentMember.name,
        userAvatar: parentMember.avatar,
        jpy: jpy,
        twd: twd,
        category: state.selectedParentCategory,
        note: note,
        payMethod: payMethod,
        cardName: cardName,
        timestamp: Date.now()
    };
    
    state.transactions.unshift(newTx);
    saveStateToStorage();
    
    triggerMascotAnimation();
    
    // 重置欄位與更新介面
    jpyInput.value = "";
    twdInput.value = "";
    noteInput.value = "";
    
    renderParentOverview();
}

// 刪除記帳
function deleteTransaction(id, isParentView) {
    if (confirm("確認要刪除這一筆記帳嗎？")) {
        state.transactions = state.transactions.filter(tx => tx.id !== id);
        saveStateToStorage();
        
        if (isParentView) {
            renderParentOverview();
        } else {
            updateChildBudgetDisplay();
            renderChildHistory();
        }
    }
}

// 小孩個人歷史明細渲染
function renderChildHistory() {
    const list = document.getElementById("child-history-list");
    if (!list) return;
    
    list.innerHTML = "";
    
    // 篩選目前小孩的支出
    const childTxs = state.transactions.filter(tx => tx.userId === state.activeUser.id);
    
    if (childTxs.length === 0) {
        list.innerHTML = '<div class="empty-history-text">🦕 這裡空空如也，快去買點東西記帳吧！</div>';
        return;
    }
    
    childTxs.forEach(tx => {
        const item = document.createElement("div");
        item.className = "history-item";
        
        // 類別對應 Emoji
        let icon = "🏷️";
        if (tx.category === "扭蛋") icon = "🪙";
        else if (tx.category === "玩具") icon = "🧸";
        else if (tx.category === "零食") icon = "🍬";
        else if (tx.category === "飲料") icon = "🥤";
        else if (tx.category === "紀念品") icon = "🛍️";
        
        const timeStr = formatTime(tx.timestamp);
        const payBadge = tx.payMethod === "card" 
            ? `<span class="pay-badge card-badge">💳 刷卡: ${tx.cardName}</span>` 
            : `<span class="pay-badge cash-badge">💵 現金</span>`;
            
        item.innerHTML = `
            <div class="history-item-left">
                <div class="history-item-icon">${icon}</div>
                <div class="history-item-details">
                    <span class="history-item-note">${escapeHTML(tx.note)}</span>
                    <span class="history-item-meta">${timeStr} ${payBadge}</span>
                </div>
            </div>
            <div class="history-item-right">
                <div class="history-item-amount">
                    <span class="amount-jpy">¥${tx.jpy}</span>
                    <span class="amount-twd">NT$ ${tx.twd}</span>
                </div>
                <button class="card-icon-btn" style="margin-right: 6px;" onclick="editTransaction('${tx.id}', false, this); event.stopPropagation();">✏️</button>
                <button class="delete-item-btn" onclick="deleteTransaction('${tx.id}', false); event.stopPropagation();">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// 8. 家長後台管理邏輯
function initParentDashboard() {
    // 渲染三個分頁
    renderParentOverview();
    
    // 填充家長新增表單的信用卡下拉選單
    populateCardDropdown("p-log-card-name");
    document.querySelector('input[name="p-pay-method"][value="cash"]').checked = true;
    toggleParentCardDropdown(false);
    
    // 填充交易記錄篩選的成員選項
    const filterUser = document.getElementById("filter-user");
    if (filterUser) {
        filterUser.innerHTML = '<option value="all">所有成員</option>';
        state.members.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.innerText = `${m.avatar} ${m.name}`;
            filterUser.appendChild(opt);
        });
    }
}

// Tab 1: 渲染全家總覽
function renderParentOverview() {
    // 1. 統計總預算與支出
    let totalBudget = 0;
    let totalSpent = 0;
    let cashSpent = 0;
    let cardSpent = 0;
    
    let kidsSpent = 0;
    
    // 計算小孩預算總和 (家長不計入)
    state.members.forEach(m => {
        if (m.type === "kid") totalBudget += m.budget;
    });
    
    // 分開統計全體消費，排除小孩重複計入全家總體支出
    state.transactions.forEach(tx => {
        const member = state.members.find(m => m.id === tx.userId);
        if (member && member.type === "kid") {
            kidsSpent += tx.twd;
        } else {
            totalSpent += tx.twd;
            if (tx.payMethod === "card") {
                cardSpent += tx.twd;
            } else {
                cashSpent += tx.twd;
            }
        }
    });
    
    // 小孩的剩餘預算 = 小孩總預算 - 小孩總花費
    const totalRemaining = totalBudget - kidsSpent;
    
    document.getElementById("parent-total-budget").innerText = `NT$ ${Math.round(totalBudget)}`;
    document.getElementById("parent-total-spent").innerText = `NT$ ${Math.round(totalSpent)}`;
    
    const remainingValEl = document.getElementById("parent-total-remaining");
    remainingValEl.innerText = `NT$ ${Math.round(totalRemaining)}`;
    if (totalRemaining >= 0) {
        remainingValEl.className = "stat-value remaining-highlight";
    } else {
        remainingValEl.className = "stat-value spent-highlight";
    }
    
    document.getElementById("parent-cash-total").innerText = `NT$ ${Math.round(cashSpent)}`;
    document.getElementById("parent-card-total").innerText = `NT$ ${Math.round(cardSpent)}`;
    
    // 2. 渲染小孩進度卡片
    const membersList = document.getElementById("parent-members-list");
    if (membersList) {
        membersList.innerHTML = "";
        state.members.forEach(member => {
            if (member.type === "kid") {
                const spent = getMemberSpent(member.id);
                const limit = member.budget;
                const remaining = limit - spent;
                const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                
                let barClass = "success";
                if (percent >= 70 && percent < 100) barClass = "warning";
                else if (percent >= 100) barClass = "danger";
                
                const card = document.createElement("div");
                card.className = "member-progress-card";
                card.innerHTML = `
                    <div class="member-card-header">
                        <div class="member-card-user">
                            <span class="avatar-emoji" style="font-size: 20px; width: 30px; height: 30px;">${member.avatar}</span>
                            <span class="member-name-text">${member.name}</span>
                        </div>
                        <div class="member-limit-action">
                            <span class="limit-text">上限：NT$<span class="limit-value">${member.budget}</span></span>
                            <button class="edit-budget-btn" onclick="editBudgetPrompt('${member.id}')">✏️</button>
                        </div>
                    </div>
                    <div class="budget-progress-container">
                        <div class="progress-bar-bg" style="height: 10px;">
                            <div class="progress-bar-fill ${barClass}" style="width: ${percent}%"></div>
                        </div>
                        <div class="budget-labels" style="font-size: 11px; margin-top: 2px;">
                            <span>已花: NT$ ${Math.round(spent)}</span>
                            <span>剩餘: <strong class="${remaining >= 0 ? 'highlight-green' : 'highlight-red'}">NT$ ${Math.round(remaining)}</strong></span>
                        </div>
                    </div>
                `;
                membersList.appendChild(card);
            }
        });
    }
    
    // 3. 渲染分類進度條圖表
    renderCategoryChart();
    
    // 4. 渲染家長交易明細
    renderParentHistory();
}

// 分類支出計算與圖表渲染
function renderCategoryChart() {
    const chartList = document.getElementById("category-chart-list");
    if (!chartList) return;
    
    chartList.innerHTML = "";
    
    // 統計分類消費
    const categoryTotals = {};
    let totalSpent = 0;
    
    state.transactions.forEach(tx => {
        const member = state.members.find(m => m.id === tx.userId);
        if (member && member.type === "kid") return;
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.twd;
        totalSpent += tx.twd;
    });
    
    if (totalSpent === 0) {
        chartList.innerHTML = '<div class="empty-history-text">無消費統計數據</div>';
        return;
    }
    
    // 排序
    const sortedCategories = Object.keys(categoryTotals).sort((a,b) => categoryTotals[b] - categoryTotals[a]);
    
    sortedCategories.forEach(cat => {
        const spent = categoryTotals[cat];
        const percent = Math.round((spent / totalSpent) * 100);
        
        const row = document.createElement("div");
        row.className = "chart-row";
        
        // 幫分類加上 emoji
        let emoji = "🏷️";
        if (cat === "交通") emoji = "🚊";
        else if (cat === "住宿") emoji = "🏨";
        else if (cat === "飲食") emoji = "🍱";
        else if (cat === "活動") emoji = "🎡";
        else if (cat === "購物") emoji = "🛍️";
        else if (cat === "扭蛋") emoji = "🪙";
        else if (cat === "玩具") emoji = "🧸";
        else if (cat === "零食") emoji = "🍬";
        else if (cat === "飲料") emoji = "🥤";
        else if (cat === "紀念品") emoji = "🛍️";
        
        row.innerHTML = `
            <div class="chart-row-meta">
                <span>${emoji} ${cat}</span>
                <span>NT$ ${Math.round(spent)} (${percent}%)</span>
            </div>
            <div class="chart-bar-bg">
                <div class="chart-bar-fill" style="width: ${percent}%"></div>
            </div>
        `;
        chartList.appendChild(row);
    });
}

// 家長綜合交易歷史渲染 (支援篩選)
function renderParentHistory() {
    const list = document.getElementById("parent-history-list");
    if (!list) return;
    
    list.innerHTML = "";
    
    const userFilter = document.getElementById("filter-user")?.value || "all";
    const categoryFilter = document.getElementById("filter-category")?.value || "all";
    
    // 篩選
    let filtered = state.transactions;
    if (userFilter !== "all") {
        filtered = filtered.filter(tx => tx.userId === userFilter);
    }
    if (categoryFilter !== "all") {
        filtered = filtered.filter(tx => tx.category === categoryFilter);
    }
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-history-text">無符合篩選條件的交易記錄</div>';
        return;
    }
    
    filtered.forEach(tx => {
        const item = document.createElement("div");
        item.className = "history-item";
        
        let icon = "🏷️";
        if (tx.category === "交通") icon = "🚊";
        else if (tx.category === "住宿") icon = "🏨";
        else if (tx.category === "飲食") icon = "🍱";
        else if (tx.category === "活動") icon = "🎡";
        else if (tx.category === "購物") icon = "🛍️";
        else if (tx.category === "扭蛋") icon = "🪙";
        else if (tx.category === "玩具") icon = "🧸";
        else if (tx.category === "零食") icon = "🍬";
        else if (tx.category === "飲料") icon = "🥤";
        
        const payBadge = tx.payMethod === "card" 
            ? `<span class="pay-badge card-badge">💳 刷卡: ${tx.cardName}</span>` 
            : `<span class="pay-badge cash-badge">💵 現金</span>`;
            
        item.innerHTML = `
            <div class="history-item-left">
                <div class="history-item-icon">${icon}</div>
                <div class="history-item-details">
                    <span class="history-item-note"><strong>[${tx.userAvatar}${tx.userName}]</strong> ${escapeHTML(tx.note)}</span>
                    <span class="history-item-meta">${formatTime(tx.timestamp)} ${payBadge}</span>
                </div>
            </div>
            <div class="history-item-right">
                <div class="history-item-amount">
                    <span class="amount-jpy">¥${tx.jpy}</span>
                    <span class="amount-twd">NT$ ${tx.twd}</span>
                </div>
                <button class="card-icon-btn" style="margin-right: 6px;" onclick="editTransaction('${tx.id}', true, this); event.stopPropagation();">✏️</button>
                <button class="delete-item-btn" onclick="deleteTransaction('${tx.id}', true); event.stopPropagation();">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// 快速彈窗修改預算上限
function editBudgetPrompt(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    const newVal = prompt(`請輸入 ${member.name} 的預算上限 (台幣)：`, member.budget);
    if (newVal !== null) {
        const budget = parseInt(newVal);
        if (!isNaN(budget) && budget >= 0) {
            member.budget = budget;
            saveStateToStorage();
            renderParentOverview();
        } else {
            alert("請輸入有效的正整數預算金額！");
        }
    }
}

// 判斷是否為日本指定商店 (用於玉山熊本熊卡 8.5% 回饋判定)
function isDesignatedStore(tx) {
    // 1. 如果類別是「交通」，通常是 Suica (西瓜卡) / PASMO / ICOCA 手機加值，這算指定商店
    if (tx.category === "交通") return true;
    
    // 2. 檢查備註內的關鍵字 (不分大小寫)
    const note = (tx.note || "").toLowerCase();
    const designatedKeywords = [
        "suica", "西瓜", "pasmo", "icoca", 
        "唐吉", "donki", "don quijote", "donkey",
        "bic", "yodobashi", "友都八喜", "電器",
        "松本清", "matsumoto", "cocokara", "藥妝", "sundrug", "三千里", "大國", "os drug",
        "迪士尼", "disney", "環球影城", "usj",
        "toyoko", "東橫", "apa hotel", "星野",
        "ots", "toyota", "times", "nippon", "orix", "budget", "租車", "car rental"
    ];
    return designatedKeywords.some(kw => note.includes(kw));
}

function calculateDetailedCashback(card, transactions) {
    const cardTxs = transactions.filter(tx => {
        if (tx.payMethod !== "card" || tx.cardName !== card.name) return false;
        const member = state.members.find(m => m.id === tx.userId);
        if (member && member.type === "kid") return false;
        return true;
    });
    const spentTwd = cardTxs.reduce((sum, tx) => sum + tx.twd, 0);
    const spentJpy = cardTxs.reduce((sum, tx) => sum + tx.jpy, 0);
    
    let cashback = 0;
    let details = [];
    
    if (card.name === "富邦Ｊ卡媽" || card.name === "富邦Ｊ卡爸") {
        // 1. Basic 0.5%
        const basicRebate = spentTwd * 0.005;
        cashback += basicRebate;
        details.push(`基本回饋 0.5%：NT$ ${Math.round(basicRebate)}`);
        
        // 2. Physical single transaction >= NT$1000 -> 3% extra, cap 1000
        let extraPool = 0;
        let count = 0;
        cardTxs.forEach(tx => {
            if (tx.twd >= 1000) {
                extraPool += tx.twd * 0.03;
                count++;
            }
        });
        const extraCapped = Math.min(extraPool, 1000);
        cashback += extraCapped;
        const capReached = extraPool >= 1000 ? " (已達季上限 NT$1,000)" : "";
        details.push(`單筆滿千加碼 3% (共 ${count} 筆)：NT$ ${Math.round(extraCapped)}${capReached}`);
        
        // 3. Donki 30% JCB: JPY 20,000 -> JPY 6,000
        const donkiJpy = cardTxs
            .filter(tx => tx.note && (tx.note.includes("唐吉") || tx.note.toLowerCase().includes("donki") || tx.note.toLowerCase().includes("don quijote")))
            .reduce((sum, tx) => sum + tx.jpy, 0);
        if (donkiJpy >= 20000) {
            const donkiCashback = 6000 * state.exchangeRate;
            cashback += donkiCashback;
            details.push(`🎉 唐吉訶德 JCB 30% 加碼：NT$ ${Math.round(donkiCashback)} (消費 JPY ${donkiJpy} 達標)`);
        } else if (donkiJpy > 0) {
            const diff = 20000 - donkiJpy;
            details.push(`⏳ 唐吉訶德 JCB 30%：還差 JPY ${Math.round(diff)} (目前: JPY ${donkiJpy})`);
        }
        
        // 4. MyJapan+ 10% JCB: JPY 100,000 -> JPY 10,000
        if (spentJpy >= 100000) {
            const myJapanCashback = 10000 * state.exchangeRate;
            cashback += myJapanCashback;
            details.push(`🎉 MyJapan+ JCB 10% 加碼：NT$ ${Math.round(myJapanCashback)} (消費 JPY ${spentJpy} 達標)`);
        } else if (spentJpy > 0) {
            const diff = 100000 - spentJpy;
            details.push(`⏳ MyJapan+ JCB 10%：還差 JPY ${Math.round(diff)} (目前: JPY ${spentJpy})`);
        }
        
    } else if (card.name === "玉山熊本") {
        // 1. Basic 2.5%
        const basicRebate = spentTwd * 0.025;
        cashback += basicRebate;
        details.push(`日本消費基本 2.5% (無上限)：NT$ ${Math.round(basicRebate)}`);
        
        // 2. Designated stores 6% extra, cap NT$500
        let extraPool = 0;
        let count = 0;
        let designatedTwd = 0;
        cardTxs.forEach(tx => {
            if (isDesignatedStore(tx)) {
                extraPool += tx.twd * 0.06;
                designatedTwd += tx.twd;
                count++;
            }
        });
        
        const extraCapped = Math.min(extraPool, 500);
        cashback += extraCapped;
        const capReached = extraPool >= 500 ? " (已達期上限 NT$500)" : "";
        if (extraPool > 0) {
            details.push(`指定日本商店加碼 6% (共 ${count} 筆，累積 NT$ ${Math.round(designatedTwd)})：NT$ ${Math.round(extraCapped)}${capReached}`);
        } else {
            details.push(`指定日本商店加碼 6%：NT$ 0 (無符合指定商店之消費)`);
        }
        
        // 3. MyJapan+ 10% JCB: JPY 100,000 -> JPY 10,000
        if (spentJpy >= 100000) {
            const myJapanCashback = 10000 * state.exchangeRate;
            cashback += myJapanCashback;
            details.push(`🎉 MyJapan+ JCB 10% 加碼：NT$ ${Math.round(myJapanCashback)} (消費 JPY ${spentJpy} 達標)`);
        } else if (spentJpy > 0) {
            const diff = 100000 - spentJpy;
            details.push(`⏳ MyJapan+ JCB 10%：還差 JPY ${Math.round(diff)} (目前: JPY ${spentJpy})`);
        }
        
    } else if (card.name === "第一銀行JCB") {
        // Basic: card.rate%
        const basicRebate = spentTwd * (card.rate / 100);
        cashback += basicRebate;
        details.push(`基本回饋：NT$ ${Math.round(basicRebate)}`);
        
        // 1. Donki 30% JCB: JPY 20,000 -> JPY 6,000
        const donkiJpy = cardTxs
            .filter(tx => tx.note && (tx.note.includes("唐吉") || tx.note.toLowerCase().includes("donki") || tx.note.toLowerCase().includes("don quijote")))
            .reduce((sum, tx) => sum + tx.jpy, 0);
        if (donkiJpy >= 20000) {
            const donkiCashback = 6000 * state.exchangeRate;
            cashback += donkiCashback;
            details.push(`🎉 唐吉訶德 JCB 30% 加碼：NT$ ${Math.round(donkiCashback)} (消費 JPY ${donkiJpy} 達標)`);
        } else if (donkiJpy > 0) {
            const diff = 20000 - donkiJpy;
            details.push(`⏳ 唐吉訶德 JCB 30%：還差 JPY ${Math.round(diff)} (目前: JPY ${donkiJpy})`);
        }
        
    } else {
        // Generic card calculations
        let isQualified = true;
        let diffToQualify = 0;
        
        if (card.threshold > 0 && spentTwd < card.threshold) {
            isQualified = false;
            diffToQualify = card.threshold - spentTwd;
        }
        
        if (isQualified) {
            let val = spentTwd * (card.rate / 100);
            if (card.cap > 0 && val > card.cap) {
                val = card.cap;
                details.push(`一般回饋 ${card.rate}%：NT$ ${Math.round(val)} (已達上限 NT$ ${card.cap})`);
            } else {
                const capText = card.cap > 0 ? ` (上限 NT$ ${card.cap})` : "";
                details.push(`一般回饋 ${card.rate}%：NT$ ${Math.round(val)}${capText}`);
            }
            cashback = val;
        } else {
            details.push(`未達起刷門檻 NT$ ${card.threshold} (還差 NT$ ${Math.round(diffToQualify)})`);
        }
    }
    
    return {
        spent: spentTwd,
        spentJpy: spentJpy,
        cashback: cashback,
        details: details
    };
}

// Tab 2: 渲染信用卡回饋統計與設定
function renderParentCards() {
    const container = document.getElementById("cards-stats-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    if (state.creditCards.length === 0) {
        container.innerHTML = '<div class="empty-history-text">😢 尚未設定任何信用卡，請在下方新增。</div>';
        return;
    }
    
    state.creditCards.forEach((card, index) => {
        const calc = calculateDetailedCashback(card, state.transactions);
        
        // 渲染回饋明細列
        let detailsHtml = "";
        calc.details.forEach(det => {
            detailsHtml += `<div style="font-size: 12px; margin-top: 5px; padding-left: 8px; border-left: 3px solid var(--accent-purple); color: var(--text-main); font-weight: 600;">${det}</div>`;
        });
        
        const cardBox = document.createElement("div");
        cardBox.className = "card-stat-card";
        
        // 如果是特殊的卡片，我們顯示自訂的規則文字，否則顯示一般規則文字
        let ruleText = `規則：回饋比例 ${card.rate}%`;
        if (card.name === "富邦Ｊ卡媽" || card.name === "富邦Ｊ卡爸") {
            ruleText = "規則：基本 0.5% + 單筆滿千加碼 3% (季上限 $1000) + JCB 唐吉訶德 30% (滿兩萬日圓) + JCB MyJapan+ 10% (滿十萬日圓)";
        } else if (card.name === "玉山熊本") {
            ruleText = "規則：日本基本 2.5% + 指定商店加碼 6% (期上限 $500) + JCB MyJapan+ 10% (滿十萬日圓)";
        } else if (card.name === "第一銀行JCB") {
            ruleText = `規則：基本 ${card.rate}% + JCB 唐吉訶德 30% (滿兩萬日圓)`;
        } else {
            const capText = card.cap > 0 ? ` (上限 NT$${card.cap})` : " (無上限)";
            const thresholdText = card.threshold > 0 ? ` (滿 NT$${card.threshold}起)` : " (無門檻)";
            ruleText += `${thresholdText}${capText}`;
        }
        
        cardBox.innerHTML = `
            <div class="card-stat-header">
                <div class="card-stat-title">
                    <span class="card-stat-name">💳 ${escapeHTML(card.name)}</span>
                    <span class="card-rate-badge">${card.rate}% 基本</span>
                </div>
                <div class="card-actions-btn-group">
                    <button class="card-icon-btn" onclick="editCreditCard(${index})">✏️</button>
                    <button class="card-icon-btn" onclick="deleteCreditCard(${index})">🗑️</button>
                </div>
            </div>
            <div class="card-stat-body">
                <div class="card-amount-summary">
                    <span>累計刷卡總額：</span>
                    <span class="bold-twd">NT$ ${Math.round(calc.spent)} <span style="font-size:12px; font-weight:700; color:var(--text-muted);">(¥${Math.round(calc.spentJpy)})</span></span>
                </div>
                <div style="font-size:11px; color: var(--text-muted); margin-bottom: 8px; line-height: 1.4;">
                    ${ruleText}
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; background-color: var(--bg-primary); padding: 8px; border-radius: var(--radius-sm); border: 1.5px dashed var(--text-muted);">
                    <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">📋 回饋金細目計算：</div>
                    ${detailsHtml}
                </div>

                <div class="card-rewards-output">
                    <span class="reward-label">💰 預估回饋金總額</span>
                    <span class="reward-value">NT$ ${Math.round(calc.cashback)}</span>
                </div>
            </div>
        `;
        container.appendChild(cardBox);
    });
}

// 新增/修改信用卡存檔
function saveCreditCard(e) {
    e.preventDefault();
    
    const nameInput = document.getElementById("new-card-name");
    const rateInput = document.getElementById("new-card-rate");
    const thresholdInput = document.getElementById("new-card-threshold");
    const capInput = document.getElementById("new-card-cap");
    const editIndexEl = document.getElementById("card-edit-index");
    
    const name = nameInput.value.trim();
    const rate = parseFloat(rateInput.value);
    const threshold = parseFloat(thresholdInput.value) || 0;
    const cap = parseFloat(capInput.value) || 0;
    const editIndex = editIndexEl.value;
    
    if (!name || isNaN(rate)) return;
    
    const newCard = { name, rate, threshold, cap };
    
    if (editIndex !== "") {
        // 更新原有信用卡交易記錄中的舊信用卡名稱
        const oldName = state.creditCards[editIndex].name;
        state.creditCards[editIndex] = newCard;
        
        state.transactions.forEach(tx => {
            if (tx.cardName === oldName) {
                tx.cardName = name;
            }
        });
    } else {
        // 新增
        state.creditCards.push(newCard);
    }
    
    saveStateToStorage();
    cancelCardEdit();
    renderParentCards();
}

function editCreditCard(index) {
    const card = state.creditCards[index];
    if (!card) return;
    
    document.getElementById("new-card-name").value = card.name;
    document.getElementById("new-card-rate").value = card.rate;
    document.getElementById("new-card-threshold").value = card.threshold;
    document.getElementById("new-card-cap").value = card.cap;
    document.getElementById("card-edit-index").value = index;
    
    document.getElementById("card-submit-btn").innerText = "更新信用卡資料 💳";
    document.getElementById("card-cancel-edit-btn").classList.remove("hidden");
    
    // 捲動到編輯表單
    document.getElementById("add-card-form").scrollIntoView({ behavior: "smooth" });
}

function cancelCardEdit() {
    document.getElementById("new-card-name").value = "";
    document.getElementById("new-card-rate").value = "";
    document.getElementById("new-card-threshold").value = "0";
    document.getElementById("new-card-cap").value = "0";
    document.getElementById("card-edit-index").value = "";
    
    document.getElementById("card-submit-btn").innerText = "儲存信用卡 💳";
    document.getElementById("card-cancel-edit-btn").classList.add("hidden");
}

function deleteCreditCard(index) {
    const card = state.creditCards[index];
    if (!card) return;
    
    if (confirm(`確認要刪除「${card.name}」嗎？這會清除關聯帳目的卡片顯示，但不會刪除帳目本身。`)) {
        // 將該信用卡的記帳卡名清空
        state.transactions.forEach(tx => {
            if (tx.cardName === card.name) {
                tx.payMethod = "cash"; // 退回現金支付
                tx.cardName = null;
            }
        });
        
        state.creditCards.splice(index, 1);
        saveStateToStorage();
        renderParentCards();
    }
}

// Tab 3: 渲染系統設定
function renderParentSettings() {
    document.getElementById("settings-rate").value = state.exchangeRate;
    document.getElementById("rate-preview-twd").innerText = Math.round(100 * state.exchangeRate);
    document.getElementById("settings-pin").value = state.parentPin;
    
    // 渲染 Firebase 雲端設定狀態
    renderFirebaseSettingsUI();
    
    const membersList = document.getElementById("member-settings-list");
    if (membersList) {
        membersList.innerHTML = "";
        state.members.forEach((m, idx) => {
            const row = document.createElement("div");
            row.className = "settings-member-row";
            
            // 家長不允許被刪除與更改類別
            const deleteBtn = m.type === "parent" 
                ? "" 
                : `<button class="settings-btn delete" onclick="deleteMember(${idx})">刪除</button>`;
                
            row.innerHTML = `
                <div class="settings-member-info">
                    <span style="font-size: 20px;">${m.avatar}</span>
                    <span class="settings-member-name">${escapeHTML(m.name)} ${m.type === "parent" ? "(管理員)" : `(預算:NT$ ${m.budget})`}</span>
                </div>
                <div class="settings-member-actions">
                    <button class="settings-btn" onclick="openMemberModal(${idx})">編輯</button>
                    ${deleteBtn}
                </div>
            `;
            membersList.appendChild(row);
        });
    }
}

// 彈窗編輯或新增成員
function openMemberModal(index = null) {
    const titleEl = document.getElementById("member-modal-title");
    const nameInput = document.getElementById("member-name-input");
    const avatarInput = document.getElementById("member-avatar-input");
    const budgetInput = document.getElementById("member-budget-input");
    const budgetGroup = document.getElementById("member-budget-group");
    const indexInput = document.getElementById("member-edit-index");
    
    if (index !== null) {
        // 編輯模式
        const member = state.members[index];
        if (!member) return;
        
        indexInput.value = index;
        titleEl.innerText = `✏️ 編輯成員: ${member.name}`;
        nameInput.value = member.name;
        avatarInput.value = member.avatar;
        budgetInput.value = member.budget;
        
        if (member.type === "parent") {
            budgetGroup.classList.add("hidden");
        } else {
            budgetGroup.classList.remove("hidden");
        }
    } else {
        // 新增模式
        indexInput.value = "";
        titleEl.innerText = "➕ 新增家庭成員";
        nameInput.value = "";
        avatarInput.value = "🐼";
        budgetInput.value = "2000";
        budgetGroup.classList.remove("hidden");
    }
    
    document.getElementById("member-modal").classList.add("active");
    document.getElementById("member-modal").style.display = "flex";
}

function closeMemberModal() {
    document.getElementById("member-modal").classList.remove("active");
    document.getElementById("member-modal").style.display = "none";
}

function saveMemberFromUI() {
    const indexVal = document.getElementById("member-edit-index").value;
    const name = document.getElementById("member-name-input").value.trim();
    const avatar = document.getElementById("member-avatar-input").value;
    const budget = parseInt(document.getElementById("member-budget-input").value) || 0;
    
    if (!name) {
        alert("姓名不能為空！");
        return;
    }
    
    if (indexVal !== "") {
        // 編輯模式
        const idx = parseInt(indexVal);
        const member = state.members[idx];
        if (!member) return;
        
        const oldId = member.id;
        member.name = name;
        member.avatar = avatar;
        if (member.type === "kid") {
            member.budget = budget;
        }
        
        // 更新歷史交易記錄的頭像和姓名
        state.transactions.forEach(tx => {
            if (tx.userId === oldId) {
                tx.userName = name;
                tx.userAvatar = avatar;
            }
        });
    } else {
        // 新增模式
        const newMember = {
            id: "member-" + Date.now(),
            name: name,
            avatar: avatar,
            type: "kid",
            budget: budget
        };
        state.members.push(newMember);
    }
    
    saveStateToStorage();
    closeMemberModal();
    renderParentSettings();
}

// 刪除家庭成員
function deleteMember(index) {
    const member = state.members[index];
    if (!member) return;
    
    if (confirm(`確認要刪除成員「${member.name}」嗎？這會清除本機該成員的預算，並清除其歷史記帳資料。`)) {
        // 清除該成員的交易明細
        state.transactions = state.transactions.filter(tx => tx.userId !== member.id);
        
        state.members.splice(index, 1);
        saveStateToStorage();
        renderParentSettings();
    }
}

// 更新匯率
function updateExchangeRate(val) {
    const rate = parseFloat(val);
    if (!isNaN(rate) && rate > 0) {
        state.exchangeRate = rate;
        saveStateToStorage();
        document.getElementById("rate-preview-twd").innerText = Math.round(100 * rate);
    }
}

// 更新解鎖密碼
function updateParentPin(val) {
    const pin = val.trim();
    if (pin.length === 4 && /^\d+$/.test(pin)) {
        state.parentPin = pin;
        saveStateToStorage();
        alert("家長驗證 PIN 碼已成功修改為 " + pin);
    } else {
        alert("PIN 碼必須為 4 位純數字！");
        document.getElementById("settings-pin").value = state.parentPin;
    }
}

// 9. 離線二維碼與同步模組
let qrCodeInstance = null;
let html5QrcodeScanner = null;

// 打開同步視窗
function openSyncModal(type) {
    const overlay = document.getElementById("sync-modal");
    overlay.classList.add("active");
    overlay.style.display = "flex";
    
    document.querySelectorAll(".modal-section").forEach(s => s.classList.remove("active"));
    
    if (type === "export") {
        document.getElementById("modal-export-section").classList.add("active");
        generateSyncQRCode();
    } else {
        document.getElementById("modal-import-section").classList.add("active");
        document.getElementById("sync-key-input").value = "";
    }
}

// 關閉同步視窗
function closeSyncModal() {
    const overlay = document.getElementById("sync-modal");
    overlay.classList.remove("active");
    overlay.style.display = "none";
    stopCameraScanner();
}

// 生成同步二維碼與同步金鑰 (Base64)
function generateSyncQRCode() {
    // 壓縮同步資料以減小體積
    const syncData = {
        exRate: state.exchangeRate,
        pin: state.parentPin,
        mbs: state.members.map(m => ({ id: m.id, n: m.name, a: m.avatar, t: m.type, b: m.budget })),
        cards: state.creditCards.map(c => ({ n: c.name, r: c.rate, t: c.threshold, c: c.cap })),
        txs: state.transactions.map(t => ({
            id: t.id,
            u: t.userId,
            n: t.userName,
            a: t.userAvatar,
            j: t.jpy,
            t: t.twd,
            c: t.category,
            d: t.note,
            p: t.payMethod,
            cd: t.cardName,
            ts: t.timestamp
        }))
    };
    
    const jsonStr = JSON.stringify(syncData);
    // 使用 Base64 編碼避免字元傳輸錯誤
    const base64 = btoa(encodeURIComponent(jsonStr));
    
    document.getElementById("sync-key-output").value = base64;
    
    // 生成 QR 碼
    const qrContainer = document.getElementById("qrcode-container");
    qrContainer.innerHTML = "";
    
    try {
        qrCodeInstance = new QRCode(qrContainer, {
            text: base64,
            width: 180,
            height: 180,
            colorDark : "#4A3E3D",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.L // 使用 L 等級以最大化存儲容量
        });
    } catch (e) {
        console.error("生成 QR Code 失敗 (可能因為資料量太大)", e);
        qrContainer.innerHTML = '<div style="font-size:11px;color:red;padding-top:50px;">資料量較大，請使用下方複製金鑰進行同步！</div>';
    }
}

function copySyncKeyToClipboard() {
    const el = document.getElementById("sync-key-output");
    el.select();
    document.execCommand("copy");
    
    const toast = document.getElementById("copy-success");
    toast.style.display = "block";
    setTimeout(() => {
        toast.style.display = "none";
    }, 2000);
}

// 貼上文字合併資料
function importSyncKeyFromInput() {
    const key = document.getElementById("sync-key-input").value.trim();
    if (!key) return;
    
    if (mergeSyncData(key)) {
        alert("🎉 資料同步與合併成功！");
        closeSyncModal();
        
        // 重新渲染畫面
        if (state.activeUser.type === "parent") {
            initParentDashboard();
        } else {
            initChildDashboard();
        }
    } else {
        alert("❌ 同步金鑰格式錯誤，請重新確認！");
    }
}

// 核心合併演算法 (去重合併)
function mergeSyncData(base64Data) {
    try {
        const decoded = decodeURIComponent(atob(base64Data));
        const importData = JSON.parse(decoded);
        
        // 驗證關鍵欄位是否存在
        if (!importData.mbs || !importData.txs) return false;
        
        // 1. 合併匯率與密碼 (採用匯入的，或是取較大者/最新設定)
        if (importData.exRate) state.exchangeRate = importData.exRate;
        if (importData.pin) state.parentPin = importData.pin;
        
        // 2. 合併信用卡
        if (importData.cards) {
            importData.cards.forEach(ic => {
                const existCard = state.creditCards.find(c => c.name === ic.n);
                if (!existCard) {
                    state.creditCards.push({
                        name: ic.n,
                        rate: ic.r,
                        threshold: ic.t,
                        cap: ic.c
                    });
                }
            });
        }
        
        // 3. 合併成員
        importData.mbs.forEach(im => {
            const existMem = state.members.find(m => m.id === im.id);
            if (existMem) {
                // 更新預算與資料 (如果不同)
                existMem.budget = im.b;
                existMem.name = im.n;
                existMem.avatar = im.a;
            } else {
                state.members.push({
                    id: im.id,
                    name: im.n,
                    avatar: im.a,
                    type: im.t,
                    budget: im.b
                });
            }
        });
        
        // 4. 合併交易明細 (關鍵：以交易 id 去重合併)
        let newTxsCount = 0;
        importData.txs.forEach(itx => {
            const existTx = state.transactions.find(t => t.id === itx.id);
            if (!existTx) {
                state.transactions.push({
                    id: itx.id,
                    userId: itx.u,
                    userName: itx.n,
                    userAvatar: itx.a,
                    jpy: itx.j,
                    twd: itx.t,
                    category: itx.c,
                    note: itx.d,
                    payMethod: itx.p,
                    cardName: itx.cd,
                    timestamp: itx.ts
                });
                newTxsCount++;
            }
        });
        
        // 按時間倒序排列
        state.transactions.sort((a, b) => b.timestamp - a.timestamp);
        
        saveStateToStorage();
        console.log(`同步合併完成：新增了 ${newTxsCount} 筆交易記錄`);
        return true;
        
    } catch (e) {
        console.error("解碼合併同步資料失敗", e);
        return false;
    }
}

// 啟動相機掃描
function startCameraScanner() {
    const scannerDiv = document.getElementById("scanner-container");
    const startBtn = document.getElementById("start-scan-btn");
    
    scannerDiv.classList.remove("hidden");
    startBtn.classList.add("hidden");
    
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length > 0) {
            // 優先使用後置鏡頭
            let cameraId = devices[0].id;
            const backCamera = devices.find(device => device.label.toLowerCase().includes("back") || device.label.toLowerCase().includes("環境"));
            if (backCamera) cameraId = backCamera.id;
            
            html5QrcodeScanner = new Html5Qrcode("interactive-scanner");
            html5QrcodeScanner.start(
                cameraId, 
                {
                    fps: 10,
                    qrbox: 180
                },
                qrCodeMessage => {
                    // 掃描成功回調
                    if (mergeSyncData(qrCodeMessage)) {
                        alert("🎉 相機掃描並合併成功！");
                        stopCameraScanner();
                        closeSyncModal();
                        
                        if (state.activeUser.type === "parent") {
                            initParentDashboard();
                        } else {
                            initChildDashboard();
                        }
                    } else {
                        alert("掃描到了二維碼，但格式不對唷！");
                    }
                },
                errorMessage => {
                    // 忽略頻繁出現的掃描失敗 log
                }
            ).catch(err => {
                console.error("啟動相機失败", err);
                alert("無法啟動相機，請手動複製貼上同步金鑰！");
                stopCameraScanner();
            });
        } else {
            alert("找不到相機裝置！");
            stopCameraScanner();
        }
    }).catch(err => {
        console.error("獲取相機列表失敗", err);
        alert("無法讀取相機，請手動輸入同步金鑰！");
        stopCameraScanner();
    });
}

function stopCameraScanner() {
    const scannerDiv = document.getElementById("scanner-container");
    const startBtn = document.getElementById("start-scan-btn");
    
    scannerDiv.classList.add("hidden");
    startBtn.classList.remove("hidden");
    
    if (html5QrcodeScanner) {
        try {
            html5QrcodeScanner.stop().then(() => {
                html5QrcodeScanner = null;
            });
        } catch (e) {
            html5QrcodeScanner = null;
        }
    }
}

// 10. 重置全部資料
function resetAllDataConfirm() {
    if (confirm("🚨 警告：這將徹底清空本手機上的所有記帳資料、成員設定、信用卡與匯率，且無法還原！\n\n確定要清空嗎？")) {
        if (confirm("這是最後一次確認：真的要清空所有資料嗎？")) {
            try {
                localStorage.removeItem("japan_travel_budget_data");
            } catch (e) {
                console.warn("LocalStorage 刪除被瀏覽器封鎖：", e);
            }
            loadStateFromStorage();
            alert("本機資料已全部清空並重設。");
            closeSyncModal();
            switchScreen("role-select-screen");
        }
    }
}

// 11. 輔助函數
function getMemberSpent(userId) {
    if (!state || !state.transactions) return 0;
    return state.transactions
        .filter(tx => tx && tx.userId === userId)
        .reduce((sum, tx) => sum + (tx.twd || 0), 0);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hr = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${m}/${d} ${hr}:${min}`;
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// 匯出 CSV 記帳明細
function exportToCSV() {
    if (!state.transactions || state.transactions.length === 0) {
        alert("目前沒有任何記帳資料可供匯出！");
        return;
    }
    
    // CSV Headers (BOM 確保 Excel 中文不亂碼)
    let csvContent = "\uFEFF";
    csvContent += "時間,記帳成員,日幣金額(JPY),匯率,台幣金額(TWD),消費類別,付款方式,刷卡卡別,備註\n";
    
    // 按時間排序
    const sortedTxs = [...state.transactions].sort((a, b) => a.timestamp - b.timestamp);
    
    sortedTxs.forEach(tx => {
        const timeStr = formatTime(tx.timestamp);
        const payMethodStr = tx.payMethod === "card" ? "刷卡" : "現金";
        const cardNameStr = tx.cardName || "";
        const noteStr = (tx.note || "").replace(/"/g, '""'); // 雙引號跳脫
        
        csvContent += `"${timeStr}","${tx.userName}",${tx.jpy},${state.exchangeRate},${tx.twd},"${tx.category}","${payMethodStr}","${cardNameStr}","${noteStr}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `日本旅遊記帳_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function setupEventListeners() {
    // 監聽點擊彈窗外部關閉
    window.addEventListener("click", e => {
        const overlay = document.getElementById("sync-modal");
        if (e.target === overlay) {
            closeSyncModal();
        }
        
        const editOverlay = document.getElementById("edit-transaction-modal");
        if (e.target === editOverlay) {
            closeEditTransactionModal();
        }
        
        const memberOverlay = document.getElementById("member-modal");
        if (e.target === memberOverlay) {
            closeMemberModal();
        }
    });
}

// ==================== 12. 記帳修改與雲端資料庫同步功能 ====================

// 編輯記帳 (行內展開修改表單，防範任何彈窗遮罩與 Z-Index 衝突)
function editTransaction(id, isParentView, btnEl) {
    try {
        const tx = state.transactions.find(t => t.id === id);
        if (!tx) {
            alert("找不到該筆交易記錄！");
            return;
        }
        
        const itemEl = btnEl.closest('.history-item');
        if (!itemEl) {
            alert("找不到消費明細的 HTML 節點！");
            return;
        }
        
        // 純手動字串格式化本地日期時間，防範時區溢出錯誤
        let timestamp = tx.timestamp || tx.ts || Date.now();
        let date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            date = new Date();
        }
        const y = date.getFullYear();
        const mo = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        const localISOTime = `${y}-${mo}-${d}T${h}:${mi}`;
        
        // 渲染成員下拉選單
        let memberOptions = "";
        state.members.forEach(m => {
            memberOptions += `<option value="${m.id}" ${m.id === tx.userId ? 'selected' : ''}>${m.avatar} ${m.name}</option>`;
        });
        
        // 渲染消費類別下拉選單
        const categories = ["交通", "住宿", "飲食", "活動", "購物", "扭蛋", "玩具", "零食", "飲料", "紀念品"];
        let catOptions = "";
        categories.forEach(c => {
            catOptions += `<option value="${c}" ${c === tx.category ? 'selected' : ''}>${c}</option>`;
        });
        
        // 支付方式選項
        let payOptions = `
            <option value="cash" ${tx.payMethod === 'cash' ? 'selected' : ''}>💵 現金</option>
            <option value="card" ${tx.payMethod === 'card' ? 'selected' : ''}>💳 刷卡</option>
        `;
        
        // 信用卡選項
        let cardOptions = '<option value="">-- 選擇信用卡 --</option>';
        state.creditCards.forEach(c => {
            cardOptions += `<option value="${c.name}" ${c.name === tx.cardName ? 'selected' : ''}>${c.name}</option>`;
        });
        
        // 替換該筆明細 HTML 為行內編輯表單
        itemEl.innerHTML = `
            <div class="inline-edit-form" style="width: 100%; display: flex; flex-direction: column; gap: 10px; padding: 12px; background-color: var(--accent-purple-light); border-radius: var(--radius-md); border: 2px solid var(--accent-purple); box-sizing: border-box; text-align: left;">
                <div style="font-weight: bold; font-size: 14px; color: var(--text-main); display: flex; justify-content: space-between; align-items: center;">
                    <span>📝 快速修改此筆消費</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>
                        <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px; color: var(--text-main);">消費成員</label>
                        <select id="inline-tx-user-${tx.id}" style="width: 100%; padding: 6px; border: 1.5px solid var(--text-main); border-radius: 6px; background: white; font-size: 13px;">
                            ${memberOptions}
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px; color: var(--text-main);">消費時間</label>
                        <input type="datetime-local" id="inline-tx-date-${tx.id}" value="${localISOTime}" style="width: 100%; padding: 4px; border: 1.5px solid var(--text-main); border-radius: 6px; font-size: 12px; background: white; box-sizing: border-box;">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>
                        <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px; color: var(--text-main);">日幣金額 (¥)</label>
                        <input type="number" id="inline-tx-jpy-${tx.id}" value="${tx.jpy}" style="width: 100%; padding: 5px; border: 1.5px solid var(--text-main); border-radius: 6px; font-size: 13px; background: white; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px; color: var(--text-main);">消費類別</label>
                        <select id="inline-tx-category-${tx.id}" style="width: 100%; padding: 6px; border: 1.5px solid var(--text-main); border-radius: 6px; background: white; font-size: 13px;">
                            ${catOptions}
                        </select>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>
                        <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px; color: var(--text-main);">支付方式</label>
                        <select id="inline-tx-pay-${tx.id}" onchange="toggleInlineCardGroup('${tx.id}', this.value)" style="width: 100%; padding: 6px; border: 1.5px solid var(--text-main); border-radius: 6px; background: white; font-size: 13px;">
                            ${payOptions}
                        </select>
                    </div>
                    <div id="inline-tx-card-group-${tx.id}" style="display: ${tx.payMethod === 'card' ? 'block' : 'none'};">
                        <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px; color: var(--text-main);">刷卡卡別</label>
                        <select id="inline-tx-card-${tx.id}" style="width: 100%; padding: 6px; border: 1.5px solid var(--text-main); border-radius: 6px; background: white; font-size: 13px;">
                            ${cardOptions}
                        </select>
                    </div>
                </div>
                
                <div>
                    <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px; color: var(--text-main);">備註項目</label>
                    <input type="text" id="inline-tx-note-${tx.id}" value="${tx.note || ''}" placeholder="寫點什麼..." style="width: 100%; padding: 6px; border: 1.5px solid var(--text-main); border-radius: 6px; font-size: 13px; background: white; box-sizing: border-box;">
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 5px;">
                    <button onclick="saveInlineTransactionEdit('${tx.id}', ${isParentView})" style="flex: 1; padding: 8px; background-color: var(--accent-green); border: 2px solid var(--text-main); border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 0 var(--text-main); font-size: 13px;">💾 儲存</button>
                    <button onclick="cancelInlineTransactionEdit(${isParentView})" style="flex: 1; padding: 8px; background-color: var(--bg-primary); border: 2px solid var(--text-main); border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 0 var(--text-main); font-size: 13px;">取消</button>
                </div>
            </div>
        `;
    } catch (err) {
        alert("開啟行內修改表單失敗！錯誤原因：\n" + err.message);
    }
}

function toggleInlineCardGroup(id, value) {
    const cardGroup = document.getElementById(`inline-tx-card-group-${id}`);
    if (cardGroup) {
        cardGroup.style.display = (value === "card") ? "block" : "none";
    }
}

function cancelInlineTransactionEdit(isParentView) {
    if (isParentView) {
        renderParentOverview();
    } else {
        renderChildHistory();
    }
}

function saveInlineTransactionEdit(id, isParentView) {
    try {
        const txIndex = state.transactions.findIndex(t => t.id === id);
        if (txIndex === -1) {
            alert("找不到該筆交易記錄！");
            return;
        }
        
        const userId = document.getElementById(`inline-tx-user-${id}`).value;
        const dateVal = document.getElementById(`inline-tx-date-${id}`).value;
        const jpyVal = parseFloat(document.getElementById(`inline-tx-jpy-${id}`).value) || 0;
        const category = document.getElementById(`inline-tx-category-${id}`).value;
        const payMethod = document.getElementById(`inline-tx-pay-${id}`).value;
        const cardName = document.getElementById(`inline-tx-card-${id}`).value;
        const note = document.getElementById(`inline-tx-note-${id}`).value;
        
        if (!dateVal) {
            alert("請選擇消費時間！");
            return;
        }
        if (jpyVal <= 0) {
            alert("金額必須大於 0！");
            return;
        }
        if (payMethod === "card" && !cardName) {
            alert("請選擇刷卡信用卡！");
            return;
        }
        
        const member = state.members.find(m => m.id === userId);
        if (!member) {
            alert("找不到對應的家庭成員！");
            return;
        }
        
        // 更新該筆記帳記錄
        state.transactions[txIndex] = {
            ...state.transactions[txIndex],
            userId: userId,
            userName: member.name,
            userAvatar: member.avatar,
            timestamp: new Date(dateVal).getTime(),
            jpy: jpyVal,
            twd: Math.round(jpyVal * state.exchangeRate),
            category: category,
            payMethod: payMethod,
            cardName: payMethod === "card" ? cardName : null,
            note: note.trim()
        };
        
        // 按時間排序
        state.transactions.sort((a, b) => b.timestamp - a.timestamp);
        
        saveStateToStorage();
        
        // 重新繪製畫面並完成同步
        if (isParentView) {
            renderParentOverview();
        } else {
            updateChildBudgetDisplay();
            renderChildHistory();
        }
    } catch (err) {
        alert("儲存修改資料失敗！錯誤訊息：\n" + err.message);
    }
}

// 儲存與清除 Firebase 設定
function saveFirebaseConfigFromUI() {
    const apiKey = document.getElementById("fb-api-key").value;
    const dbUrl = document.getElementById("fb-db-url").value;
    const projId = document.getElementById("fb-proj-id").value;
    
    if (!apiKey || !dbUrl || !projId) {
        alert("請填寫完整的 Firebase 雲端資料庫設定！");
        return;
    }
    
    const config = {
        apiKey: apiKey.trim(),
        authDomain: `${projId.trim()}.firebaseapp.com`,
        databaseURL: dbUrl.trim(),
        projectId: projId.trim(),
        storageBucket: `${projId.trim()}.appspot.com`
    };
    
    try {
        localStorage.setItem("japan_travel_budget_firebase_config", JSON.stringify(config));
        alert("🎉 專屬雲端設定已儲存！網頁將自動重新整理以啟用同步。");
        location.reload();
    } catch (e) {
        alert("儲存設定失敗：" + e.message);
    }
}

function clearFirebaseConfigFromUI() {
    if (confirm("確定要中斷雲端連線並清除金鑰嗎？這將變回純單機模式。")) {
        try {
            localStorage.removeItem("japan_travel_budget_firebase_config");
            alert("已中斷雲端連線。");
            location.reload();
        } catch (e) {}
    }
}

function renderFirebaseSettingsUI() {
    const apiKeyEl = document.getElementById("fb-api-key");
    const dbUrlEl = document.getElementById("fb-db-url");
    const projIdEl = document.getElementById("fb-proj-id");
    const statusTextEl = document.getElementById("fb-status-text");
    const clearBtnEl = document.getElementById("fb-clear-btn");
    
    if (!apiKeyEl) return;
    
    if (firebaseConfig) {
        apiKeyEl.value = firebaseConfig.apiKey;
        dbUrlEl.value = firebaseConfig.databaseURL;
        projIdEl.value = firebaseConfig.projectId;
        statusTextEl.innerHTML = "🟢 專屬雲端同步：已連線啟用中";
        statusTextEl.style.color = "var(--color-success)";
        clearBtnEl.classList.remove("hidden");
    } else {
        statusTextEl.innerHTML = "🔴 專屬雲端同步：未啟用 (純單機儲存)";
        statusTextEl.style.color = "var(--color-danger)";
        clearBtnEl.classList.add("hidden");
    }
}
