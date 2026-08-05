# 🇯🇵 日本旅遊可愛記帳趣 3.0

這是一個專為日本旅行設計的家庭記帳網頁，支援**完全離線記帳**、**單鍵日幣換算**、**信用卡達標與回饋追蹤**，以及**專屬 Firebase 實時資料庫即時同步**！

---

## 🚀 3 分鐘一鍵發布至 GitHub Pages（方案 B）

我們提供了一個純 Python 的上傳腳本，**不需要**您的 Mac 安裝 Xcode 或 Git，就能一鍵發布：

1. **申請 GitHub Access Token**：
   * 前往 GitHub 官網，點擊頭像 ➔ `Settings` ➔ 最下方的 `Developer settings` ➔ `Personal access tokens` ➔ `Tokens (classic)`。
   * 或直接開啟網址：[https://github.com/settings/tokens](https://github.com/settings/tokens)
   * 點選 **「Generate new token (classic)」**。
   * 「Note」寫：`japan_budget`。
   * **「Select scopes」勾選 `repo`**（或公用儲存庫只需勾選 `public_repo`）。
   * 捲動到最下方點擊 **「Generate token」**，複製產出的一長串 `ghp_...` 金鑰（離開網頁後就看不到了，請務必先複製起來）。

2. **執行部署腳本**：
   * 開啟 Mac 的 **終端機 (Terminal)**。
   * 切換到這個專案資料夾下，執行以下指令：
     ```bash
     python3 deploy_to_github.py
     ```
   * 依提示輸入您的 **GitHub 帳號名稱** 與剛才複製的 **Access Token**，腳本將自動在您的 GitHub 建立儲存庫、上傳檔案並開通網頁！
   * 開通成功後，您就能獲得專屬的 HTTPS 記帳網址（例如：`https://您的帳號.github.io/japan_travel_budget/`）。

---

## 🔒 設定您專屬的 Firebase 即時同步雲端資料庫（100% 隱私）

為了讓家人在旅途中隨時同步，請在 Google 的 **Firebase** 建立一個免費的實時資料庫：

1. **建立專案**：
   * 開啟 [Firebase 控制台](https://console.firebase.google.com/)。
   * 使用您的 Google 帳號登入，點選 **「建立專案 (Create a project)」**。
   * 輸入專案名稱（例如：`japan-budget-2026`），一律選擇免費方案並完成建立。

2. **建立實時資料庫 (Realtime Database)**：
   * 進入專案後台，點選左側選單的 **「建置 (Build)」➔「Realtime Database」**。
   * 點選 **「建立資料庫 (Create Database)」**，區域選擇預設（比利時或美國皆可），點選下一步。
   * 在「安全規則」步驟，請選擇 **「以測試模式啟動 (Start in test mode)」**（這會允許您的手機直接讀寫，測試模式有 30 天效期，您可以在「規則 Rules」中將讀寫權限設為 `true` 來永久開放）。

3. **複製設定值填入 App**：
   * 點選左上角專案概觀旁的 ⚙️「專案設定 (Project settings)」。
   * 在「一般 (General)」分頁下方，點選網頁圖示 `</>` 來新增一個 Web 應用程式。
   * 註冊後，會看到一段 `firebaseConfig` 物件程式碼，請記下裡面的：
     * `apiKey`
     * `databaseURL`
     * `projectId`
   * 用手機開啟您的記帳網頁，點選 **「登入家長管理」**（預設密碼 `1234`）➔ 切換到 **「設定頁面」** ➔ 找到 **「專屬雲端即時同步 (Firebase)」** ➔ 填入上述三個設定值並點選「儲存並啟用」。
   * **大功告成！** 全家人的手機只要輸入相同的這三個欄位，就會自動連線到您的私有雲端，一人記帳、全家秒級即時同步！
