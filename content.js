// 設定定数
const TRIGGER_KEY = 'l'; // PNG保存のトリガーキー（L）
const HOVER_CLASS = 'png-saver-hover'; // ホバー状態のクラス名

// 現在ホバー中の画像要素を保持
let currentHoveredImage = null;

// 初期化処理
document.addEventListener('DOMContentLoaded', function () {
    initializeImageSaver();
});

// ページが既に読み込まれている場合
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeImageSaver);
} else {
    initializeImageSaver();
}

function initializeImageSaver() {
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('keydown', handleKeyDown);
    console.log('PNG画像保存機能が初期化されました（トリガーキー: L）');
}

function handleMouseOver(event) {
    if (event.target.tagName === 'IMG') {
        const img = event.target;
        const postElement = img.closest('article');
        if (!postElement) return;

        // 1. ユーザーID (@〜 の形式) を data-testid="User-Name" の中から取得
        let username = 'unknown-user';
        const userBlock = postElement.querySelector('[data-testid="User-Name"]');
        if (userBlock) {
            const spans = userBlock.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent.trim();
                if (text.startsWith('@')) {
                    username = text.replace('@', '');
                    break;
                }
            }
        }

        // 2. 投稿日時の取得（yyyy/mm/dd形式に整形）
        const rawDate = postElement.querySelector('time')?.getAttribute('datetime');
        let formattedDate = 'unknown-date';
        if (rawDate) {
            try {
                const date = new Date(rawDate);
                formattedDate = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
            } catch (e) {
                console.warn('日付のパースに失敗:', rawDate);
            }
        }

        // 3. データセットに保存
        img.dataset.postUsername = username;
        img.dataset.postTime = formattedDate;

        currentHoveredImage = img;
        img.classList.add(HOVER_CLASS);
        img.style.outline = '2px solid #1da1f2';
        img.style.outlineOffset = '2px';
    }
}



function handleMouseOut(event) {
    if (event.target.tagName === 'IMG') {
        currentHoveredImage = null;
        event.target.classList.remove(HOVER_CLASS);
        event.target.style.outline = '';
        event.target.style.outlineOffset = '';
    }
}

function handleKeyDown(event) {
    if (event.key.toLowerCase() === TRIGGER_KEY && currentHoveredImage) {
        event.preventDefault();
        const imageUrl = currentHoveredImage.src;

        if (imageUrl) {
            console.log('L キーで PNG保存を開始:', imageUrl);

            const nav = document.createElement('nav');
            nav.innerHTML = `
<style>
#png-saving {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 99999;
    background-color: rgba(0, 0, 0, 0.85);
    padding: 20px 30px;
    border-radius: 15px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}
#png-saving h3 {
    color: #ffffff;
    font-size: 24px;
    font-family: sans-serif;
    margin: 0;
    text-align: center;
}
</style>
<div id="png-saving">
  <h3>PNG保存中...</h3>
</div>`;
            const element = document.body.appendChild(nav);
            setTimeout(() => element.remove(), 1500);

            convertAndSaveAsPNG(imageUrl);
        }
    }
}

async function convertAndSaveAsPNG(imageUrl) {
    try {
        const urlInfo = convertToHighResolution(imageUrl);

        if (urlInfo.resolutions.length > 0) {
            await tryMultipleResolutions(urlInfo.baseUrl, urlInfo.resolutions);
        } else {
            await loadAndConvertImage(imageUrl);
        }
    } catch (error) {
        console.error('PNG変換エラー:', error);
    }
}

function convertToHighResolution(imageUrl) {
    if (imageUrl.includes('pbs.twimg.com') || imageUrl.includes('x.com')) {
        const url = new URL(imageUrl);
        url.searchParams.delete('name');
        const resolutions = ['4096x4096', 'large', 'medium', 'small'];
        return { baseUrl: url.toString(), resolutions };
    }
    return { baseUrl: imageUrl, resolutions: [] };
}

async function tryMultipleResolutions(baseUrl, resolutions) {
    for (let resolution of resolutions) {
        const testUrl = `${baseUrl}&name=${resolution}`;
        console.log(`試行中: ${resolution} - ${testUrl}`);
        try {
            const success = await loadAndConvertImage(testUrl);
            if (success) {
                console.log(`成功: ${resolution}で画像を取得しました`);
                return;
            }
        } catch (error) {
            console.log(`${resolution}で失敗、次の解像度を試行中...`);
        }
    }
    console.log('すべての高解像度版で失敗、元のURLで試行中...');
    await loadAndConvertImage(baseUrl);
}

async function loadAndConvertImage(imageUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const pngDataUrl = canvas.toDataURL('image/png');
            const filename = generateFilename(imageUrl);

            chrome.runtime.sendMessage({
                action: "download",
                url: pngDataUrl,
                filename: filename
            });

            resolve(true);
        };

        img.onerror = function () {
            console.error('画像の読み込みに失敗しました:', imageUrl);
            reject(new Error('画像読み込み失敗'));
        };

        img.src = imageUrl;
    });
}

function generateFilename(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'image';
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    const user = currentHoveredImage?.dataset.postUsername || 'unknown';
    const time = currentHoveredImage?.dataset.postTime?.replace(/\//g, '-') || 'no-date';

    return `${user}-${time}.png`;
}