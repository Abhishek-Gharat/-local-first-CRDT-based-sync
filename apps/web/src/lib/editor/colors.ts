export interface ColorSwatch {
  label: string;
  value: string;
  bgClass?: string;
  textClass?: string;
}

export const TEXT_COLORS: ColorSwatch[] = [
  { label: "Default", value: "", bgClass: "bg-foreground" },
  { label: "Blue", value: "#3b82f6", bgClass: "bg-blue-500" },
  { label: "Green", value: "#10b981", bgClass: "bg-emerald-500" },
  { label: "Amber", value: "#f59e0b", bgClass: "bg-amber-500" },
  { label: "Rose", value: "#ef4444", bgClass: "bg-rose-500" },
  { label: "Purple", value: "#8b5cf6", bgClass: "bg-purple-500" },
  { label: "Slate", value: "#64748b", bgClass: "bg-slate-500" },
];

export const HIGHLIGHT_COLORS: ColorSwatch[] = [
  { label: "None", value: "", bgClass: "bg-transparent border border-dashed border-border" },
  { label: "Yellow", value: "#fef08a", bgClass: "bg-yellow-200" },
  { label: "Green", value: "#bbf7d0", bgClass: "bg-emerald-200" },
  { label: "Blue", value: "#bfdbfe", bgClass: "bg-blue-200" },
  { label: "Purple", value: "#e9d5ff", bgClass: "bg-purple-200" },
  { label: "Pink", value: "#fbcfe8", bgClass: "bg-pink-200" },
  { label: "Orange", value: "#fed7aa", bgClass: "bg-orange-200" },
];
