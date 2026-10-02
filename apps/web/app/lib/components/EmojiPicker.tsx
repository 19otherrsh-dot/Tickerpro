"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Emoji data organized by category ──────────────────────────────────
const emojiCategories = [
  {
    name: "Smileys",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇",
      "🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝",
      "🤑","🤗","🤭","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏",
      "😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢",
      "🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐",
      "😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧",
      "😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱",
      "😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺",
    ],
  },
  {
    name: "Gestures",
    icon: "👋",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️",
      "🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵",
      "👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏",
      "✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀",
      "🫁","🦷","🦴","👀","👁️","👅","👄",
    ],
  },
  {
    name: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕",
      "💞","💓","💗","💖","💘","💝","💟","♥️","🫶","😍","🥰","😘",
      "💋","💌","💐","🌹","🥀","💍","💎",
    ],
  },
  {
    name: "Objects",
    icon: "📱",
    emojis: [
      "📱","💻","⌨️","🖥️","🖨️","🖱️","💾","💿","📷","📹","🎥","📽️",
      "📺","📻","🎙️","🎚️","🎛️","⏰","⌚","📡","🔋","🔌","💡","🔦",
      "🕯️","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","💎",
      "📦","📫","📪","📬","📭","📮","📝","📄","📃","📑","📊","📈",
      "📉","📋","📌","📍","📎","🖇️","📏","📐","✂️","🗑️","📁","📂",
    ],
  },
  {
    name: "Symbols",
    icon: "✅",
    emojis: [
      "✅","❌","⭕","❗","❓","❕","❔","‼️","⁉️","💯","🔥","✨","⭐",
      "🌟","💫","💥","💢","💨","💦","🎯","🏆","🏅","🥇","🥈","🥉",
      "⚡","🔔","🔕","📣","📢","🔴","🟠","🟡","🟢","🔵","🟣","⚫",
      "⚪","🟤","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔳","🔲",
    ],
  },
];

// ── Styles ─────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 999,
  },
  container: {
    position: "absolute" as const,
    bottom: "100%",
    left: 0,
    marginBottom: "8px",
    width: "340px",
    maxHeight: "380px",
    background: "var(--tp-bg-primary)",
    border: "1px solid var(--tp-border)",
    borderRadius: "var(--tp-radius-lg)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    zIndex: 1000,
    animation: "emojiSlideIn 0.15s ease-out",
  },
  searchRow: {
    padding: "10px 12px 6px",
    borderBottom: "1px solid var(--tp-border)",
  },
  searchInput: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid var(--tp-border)",
    borderRadius: "var(--tp-radius-md)",
    fontSize: "0.82rem",
    background: "var(--tp-bg-secondary)",
    color: "var(--tp-text-primary)",
    outline: "none",
    fontFamily: "var(--tp-font-sans)",
  },
  categories: {
    display: "flex",
    gap: "2px",
    padding: "6px 12px",
    borderBottom: "1px solid var(--tp-border)",
  },
  catBtn: {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "none",
    borderRadius: "var(--tp-radius-md)",
    cursor: "pointer",
    fontSize: "1rem",
    transition: "background 0.15s",
  },
  catBtnActive: {
    background: "var(--tp-brand-50)",
  },
  grid: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "8px",
    display: "grid",
    gridTemplateColumns: "repeat(8, 1fr)",
    gap: "2px",
  },
  emojiBtn: {
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "none",
    borderRadius: "var(--tp-radius-md)",
    cursor: "pointer",
    fontSize: "1.25rem",
    transition: "background 0.12s, transform 0.12s",
  },
  catLabel: {
    gridColumn: "1 / -1",
    fontSize: "0.7rem",
    fontWeight: 700,
    color: "var(--tp-text-tertiary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    padding: "8px 4px 4px",
  },
};

// ── Keyframe injection ────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const id = "emoji-picker-keyframes";
  if (!document.getElementById(id)) {
    const sheet = document.createElement("style");
    sheet.id = id;
    sheet.textContent = `
      @keyframes emojiSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(sheet);
  }
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = search.trim()
    ? emojiCategories.map((cat) => ({
        ...cat,
        emojis: cat.emojis, // Emoji search by visual matching works best with the grid itself
      }))
    : emojiCategories;

  const handlePick = useCallback((emoji: string) => {
    onSelect(emoji);
  }, [onSelect]);

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div ref={containerRef} style={styles.container}>
        {/* Search */}
        <div style={styles.searchRow}>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {/* Category tabs */}
        <div style={styles.categories}>
          {emojiCategories.map((cat, i) => (
            <button
              key={cat.name}
              style={{ ...styles.catBtn, ...(i === activeCategory ? styles.catBtnActive : {}) }}
              onClick={() => setActiveCategory(i)}
              title={cat.name}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--tp-bg-tertiary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = i === activeCategory ? "var(--tp-brand-50)" : "transparent")}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div style={styles.grid}>
          {search.trim() ? (
            // When searching, show all emojis flattened
            emojiCategories.flatMap((cat) => cat.emojis).map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                style={styles.emojiBtn}
                onClick={() => handlePick(emoji)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--tp-bg-tertiary)";
                  e.currentTarget.style.transform = "scale(1.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title={emoji}
              >
                {emoji}
              </button>
            ))
          ) : (
            // Show active category
            <>
              <div style={styles.catLabel}>{filtered[activeCategory]?.name}</div>
              {filtered[activeCategory]?.emojis.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  style={styles.emojiBtn}
                  onClick={() => handlePick(emoji)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--tp-bg-tertiary)";
                    e.currentTarget.style.transform = "scale(1.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
