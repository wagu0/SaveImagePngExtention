// バックグラウンドスクリプト
chrome.runtime.onInstalled.addListener(() => {
    console.log('PNG画像保存拡張機能がインストールされました');
    // 右クリックメニューは削除（ホバー+キー方式に変更）
});

// Content scriptからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "download") {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename
        });
    }
});