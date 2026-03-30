// X箇条書き文字数チェッカー - Content Script

let currentTooltip = null;
let highlightedElements = [];

// 文字数カウント（全角1、半角0.5）
function countChars(text) {
  let count = 0;
  for (let char of text) {
    // ASCII範囲（半角）は0.5、それ以外（全角）は1
    count += char.match(/[\u0000-\u007F]/) ? 0.5 : 1;
  }
  return Math.ceil(count); // 小数点切り上げ
}

// 色を決定
function getColorClass(charCount) {
  if (charCount <= 15) return 'xcc-blue';
  if (charCount <= 17) return 'xcc-yellow';
  return 'xcc-red';
}

// ハイライトとツールチップを削除
function clearHighlights() {
  highlightedElements.forEach(el => {
    if (el && el.parentNode) {
      el.remove(); // オーバーレイ要素を削除
    }
  });
  highlightedElements = [];

  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}

// テキスト選択時の処理
function handleSelection() {
  const selection = window.getSelection();
  const selectedText = selection.toString();

  // 選択解除時はクリア
  if (!selectedText || selectedText.trim() === '') {
    clearHighlights();
    return;
  }

  // 既存のハイライトをクリア
  clearHighlights();

  // 改行で行ごとに分割
  const lines = selectedText.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return;

  // 各行の文字数を計算（半角0.5文字）
  const lineStats = lines.map(line => {
    const count = countChars(line.trim());
    const color = getColorClass(count);
    return { text: line, count, color };
  });

  // 合計文字数
  const totalChars = countChars(selectedText);

  // ハイライト適用（オーバーレイ方式）→ バッジ位置を取得するため先に実行
  const lastBadgeRect = applyHighlight(selection, lineStats);

  // ツールチップ作成（バッジの下に配置）
  createTooltip(lineStats, totalChars, selection, lastBadgeRect);
}

// ツールチップ作成（合計のみ）
function createTooltip(lineStats, totalChars, selection, lastBadgeRect) {
  const tooltip = document.createElement('div');
  tooltip.className = 'xcc-tooltip';

  // 合計のみ表示
  tooltip.innerHTML = `
    <div class="xcc-total">合計: ${totalChars}文字 / 140</div>
  `;

  document.body.appendChild(tooltip);
  currentTooltip = tooltip;

  // 位置調整（最後のバッジの下に配置）
  if (lastBadgeRect) {
    tooltip.style.left = `${lastBadgeRect.left}px`;
    tooltip.style.top = `${lastBadgeRect.bottom + 8}px`;
  } else {
    // フォールバック：選択範囲の右上
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    tooltip.style.left = `${rect.right + window.scrollX + 10}px`;
    tooltip.style.top = `${rect.top + window.scrollY}px`;
  }
}

// 行ごとのハイライト適用（オーバーレイ方式）
function applyHighlight(selection, lineStats) {
  if (!selection.rangeCount) return null;

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString();

  // 選択範囲の矩形を取得
  const rects = range.getClientRects();
  if (rects.length === 0) return null;

  // 矩形をY座標でグループ化（同じ行の矩形をまとめる）
  const lineRects = [];
  let currentY = null;
  let currentLineGroup = [];

  Array.from(rects).forEach(rect => {
    if (rect.width === 0 || rect.height === 0) return;

    const y = Math.round(rect.top);

    if (currentY === null || Math.abs(y - currentY) < 5) {
      // 同じ行
      currentLineGroup.push(rect);
      currentY = y;
    } else {
      // 新しい行
      if (currentLineGroup.length > 0) {
        lineRects.push(currentLineGroup);
      }
      currentLineGroup = [rect];
      currentY = y;
    }
  });

  // 最後のグループを追加
  if (currentLineGroup.length > 0) {
    lineRects.push(currentLineGroup);
  }

  let lastBadgeRect = null;

  // 各行グループに対してハイライトを作成
  lineRects.forEach((rects, index) => {
    const lineIndex = Math.min(index, lineStats.length - 1);
    const color = lineStats[lineIndex].color;
    const charCount = lineStats[lineIndex].count;

    // その行の最後の矩形（右端）を取得
    const lastRect = rects[rects.length - 1];

    rects.forEach(rect => {
      const highlight = document.createElement('div');
      highlight.className = `xcc-highlight-overlay ${color}`;
      highlight.style.position = 'absolute';
      highlight.style.left = `${rect.left + window.scrollX}px`;
      highlight.style.top = `${rect.top + window.scrollY}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.pointerEvents = 'none';
      highlight.style.zIndex = '9999';

      document.body.appendChild(highlight);
      highlightedElements.push(highlight);
    });

    // 行の右端に文字数バッジを表示
    const badge = document.createElement('div');
    badge.className = `xcc-char-badge ${color}`;
    badge.textContent = `${charCount}文字`;
    badge.style.position = 'absolute';
    badge.style.left = `${lastRect.right + window.scrollX + 8}px`;
    badge.style.top = `${lastRect.top + window.scrollY}px`;
    badge.style.pointerEvents = 'none';
    badge.style.zIndex = '10000';

    document.body.appendChild(badge);
    highlightedElements.push(badge);

    // 最後のバッジの位置を記録
    lastBadgeRect = {
      left: lastRect.right + window.scrollX + 8,
      top: lastRect.top + window.scrollY,
      bottom: lastRect.bottom + window.scrollY,
      height: lastRect.height
    };
  });

  return lastBadgeRect;
}

// イベントリスナー
document.addEventListener('mouseup', () => {
  // 少し遅延を入れて選択が確定するのを待つ
  setTimeout(handleSelection, 10);
});

// 選択解除時
document.addEventListener('mousedown', (e) => {
  // ツールチップ以外をクリックしたらクリア
  if (currentTooltip && !currentTooltip.contains(e.target)) {
    clearHighlights();
  }
});

// キーボード操作（Escでクリア）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    clearHighlights();
  }
});
