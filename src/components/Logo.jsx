import { useState } from 'react';

// Simple claw/log mark SVG
const SVG_SRC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#1e293b"/>
  <path d="M8 22 L12 10 L16 18 L20 10 L24 22" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="26" r="1.5" fill="#3b82f6"/>
</svg>`;

export default function Logo() {
  const [copied, setCopied] = useState(false);

  function copySvg() {
    navigator.clipboard.writeText(SVG_SRC).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={copySvg}
      title={copied ? 'Copied!' : 'Copy SVG'}
      className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent transition duration-100 hover:border-slate-700 hover:bg-slate-800"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-6 w-6">
        <rect width="32" height="32" rx="8" fill="#1e293b"/>
        <path d="M8 22 L12 10 L16 18 L20 10 L24 22" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="26" r="1.5" fill="#3b82f6"/>
      </svg>
    </button>
  );
}
