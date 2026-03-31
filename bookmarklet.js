// X箇条書き文字数チェッカー - ブックマークレット用スクリプト

(function() {
  'use strict';

  // 既に起動済みチェック
  if (window.xccBookmarklet) {
    alert('既に起動しています！テキストを選択してください。');
    return;
  }
  window.xccBookmarklet = true;

  // スタイルを追加
  const style = document.createElement('style');
  style.textContent = `
    .xcc-highlight-overlay {
      position: absolute;
      border-radius: 4px;
      opacity: 0.4;
      pointer-events: none;
      z-index: 9999;
      transition: opacity 0.2s;
    }
    .xcc-highlight-overlay.xcc-blue {
      background: linear-gradient(135deg, rgba(173, 216, 230, 0.7), rgba(176, 224, 230, 0.6));
    }
    .xcc-highlight-overlay.xcc-yellow {
      background: linear-gradient(135deg, rgba(255, 218, 185, 0.7), rgba(255, 228, 196, 0.6));
    }
    .xcc-highlight-overlay.xcc-red {
      background: linear-gradient(135deg, rgba(255, 192, 203, 0.7), rgba(255, 182, 193, 0.6));
    }
    .xcc-char-badge {
      position: absolute;
      padding: 4px 10px;
      border-radius: 12px;
      font-family: 'Comic Sans MS', 'Hiragino Maru Gothic Pro', 'Meiryo', sans-serif;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      pointer-events: none;
      z-index: 10000;
      animation: xcc-badge-fadein 0.2s;
    }
    @keyframes xcc-badge-fadein {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }
    .xcc-char-badge.xcc-blue {
      background: linear-gradient(135deg, #add8e6, #b0e0e6);
      color: #2c5f7a;
      border: 2px solid #87ceeb;
    }
    .xcc-char-badge.xcc-yellow {
      background: linear-gradient(135deg, #ffdab9, #ffe4c4);
      color: #8b5a00;
      border: 2px solid #ffb84d;
    }
    .xcc-char-badge.xcc-red {
      background: linear-gradient(135deg, #ffc0cb, #ffb6c1);
      color: #8b3a62;
      border: 2px solid #ff69b4;
    }
    .xcc-tooltip {
      position: absolute;
      z-index: 999999;
      background: linear-gradient(145deg, #fff, #fef9f3);
      border: 2px solid #ffd4e5;
      border-radius: 16px;
      padding: 16px 18px;
      box-shadow: 0 8px 24px rgba(255, 182, 193, 0.25), 0 4px 8px rgba(0, 0, 0, 0.05);
      font-family: 'Comic Sans MS', 'Hiragino Maru Gothic Pro', 'Meiryo', sans-serif;
      font-size: 14px;
      line-height: 1.8;
      min-width: 160px;
      pointer-events: none;
      animation: xcc-tooltip-fadein 0.2s;
    }
    @keyframes xcc-tooltip-fadein {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .xcc-tooltip .xcc-total {
      font-weight: 700;
      color: #ff6b9d;
      font-size: 16px;
      background: linear-gradient(90deg, #ff6b9d, #ffa8c5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-align: center;
    }
  `;
  document.head.appendChild(style);

  let currentTooltip = null;
  let highlightedElements = [];

  // 文字数カウント（全角1、半角0.5）
  function countChars(text) {
    let count = 0;
    for (let char of text) {
      count += char.match(/[\u0000-\u007F]/) ? 0.5 : 1;
    }
    return Math.ceil(count);
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
        el.remove();
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

    if (!selectedText || selectedText.trim() === '') {
      clearHighlights();
      return;
    }

    clearHighlights();

    const lines = selectedText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    const lineStats = lines.map(line => {
      const count = countChars(line.trim());
      const color = getColorClass(count);
      return { text: line, count, color };
    });

    const totalChars = countChars(selectedText);

    const lastBadgeRect = applyHighlight(selection, lineStats);
    createTooltip(lineStats, totalChars, selection, lastBadgeRect);
  }

  // 行ごとのハイライト適用
  function applyHighlight(selection, lineStats) {
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length === 0) return null;

    const lineRects = [];
    let currentY = null;
    let currentLineGroup = [];

    Array.from(rects).forEach(rect => {
      if (rect.width === 0 || rect.height === 0) return;

      const y = Math.round(rect.top);

      if (currentY === null || Math.abs(y - currentY) < 5) {
        currentLineGroup.push(rect);
        currentY = y;
      } else {
        if (currentLineGroup.length > 0) {
          lineRects.push(currentLineGroup);
        }
        currentLineGroup = [rect];
        currentY = y;
      }
    });

    if (currentLineGroup.length > 0) {
      lineRects.push(currentLineGroup);
    }

    let lastBadgeRect = null;

    lineRects.forEach((rects, index) => {
      const lineIndex = Math.min(index, lineStats.length - 1);
      const color = lineStats[lineIndex].color;
      const charCount = lineStats[lineIndex].count;

      const lastRect = rects[rects.length - 1];

      rects.forEach(rect => {
        const highlight = document.createElement('div');
        highlight.className = `xcc-highlight-overlay ${color}`;
        highlight.style.position = 'absolute';
        highlight.style.left = `${rect.left + window.scrollX}px`;
        highlight.style.top = `${rect.top + window.scrollY}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;

        document.body.appendChild(highlight);
        highlightedElements.push(highlight);
      });

      const badge = document.createElement('div');
      badge.className = `xcc-char-badge ${color}`;
      badge.textContent = `${charCount}文字`;
      badge.style.position = 'absolute';
      badge.style.left = `${lastRect.right + window.scrollX + 8}px`;
      badge.style.top = `${lastRect.top + window.scrollY}px`;

      document.body.appendChild(badge);
      highlightedElements.push(badge);

      lastBadgeRect = {
        left: lastRect.right + window.scrollX + 8,
        top: lastRect.top + window.scrollY,
        bottom: lastRect.bottom + window.scrollY,
        height: lastRect.height
      };
    });

    return lastBadgeRect;
  }

  // ツールチップ作成（合計のみ）
  function createTooltip(lineStats, totalChars, selection, lastBadgeRect) {
    const tooltip = document.createElement('div');
    tooltip.className = 'xcc-tooltip';

    tooltip.innerHTML = `
      <div class="xcc-total">合計: ${totalChars}文字 / 140</div>
    `;

    document.body.appendChild(tooltip);
    currentTooltip = tooltip;

    if (lastBadgeRect) {
      tooltip.style.left = `${lastBadgeRect.left}px`;
      tooltip.style.top = `${lastBadgeRect.bottom + 8}px`;
    } else {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      tooltip.style.left = `${rect.right + window.scrollX + 10}px`;
      tooltip.style.top = `${rect.top + window.scrollY}px`;
    }
  }

  // イベントリスナー
  document.addEventListener('mouseup', () => {
    setTimeout(handleSelection, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (currentTooltip && !currentTooltip.contains(e.target)) {
      clearHighlights();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearHighlights();
    }
  });

  alert('X箇条書き文字数チェッカーを起動しました！\nテキストを選択してください。');
})();
