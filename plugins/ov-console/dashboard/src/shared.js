/* ─── Shared UI ────────────────────────────────────────────────────────── */
function Spinner(p) {
  return React.createElement("div", {className: "flex items-center justify-center py-8 text-muted-foreground"},
    React.createElement("span", {className: "text-sm animate-pulse"}, p.text || "加载中..."));
}
function ErrMsg(p) { if (!p.error) return null;
  return React.createElement("div", {className: "text-sm text-red-500 px-3 py-2 bg-red-500/10 rounded-md"}, p.error); }
function Empty(p) {
  return React.createElement("div", {className: "flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"},
    React.createElement(p.icon || I.file, {className: "w-3.5 h-3.5 opacity-25"}),
    React.createElement("p", {className: "text-sm"}, p.text || "暂无数据"));
}
