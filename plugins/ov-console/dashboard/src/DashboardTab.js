/* ─── Tab 1: Dashboard ────────────────────────────────────────────────── */
function DashboardTab(p) {
  var _h = useState(null), sysHealth = _h[0], setSysHealth = _h[1];
  var _s = useState(null), sessions = _s[0], setSessions = _s[1];
  var _l = useState(true), loading = _l[0], setLoading = _l[1];
  var _e = useState(null), error = _e[0], setError = _e[1];

  useEffect(function() {
    setLoading(true);
    Promise.all([
      SDK.fetchJSON("/api/plugins/ov-console/observer/system").catch(function(e) { return {status:"error", result:null}; }),
      SDK.fetchJSON("/api/plugins/ov-console/sessions").catch(function(e) { return {status:"error", result:[]}; }),
    ]).then(function(rs) {
      setSysHealth(rs[0]);
      var s = rs[1];
      setSessions(s && s.result ? s.result : (s || []));
    }).catch(function(e) { setError(String(e)); })
     .finally(function() { setLoading(false); });
  }, []);

  var components = (sysHealth && sysHealth.result) ? sysHealth.result.components || {} : {};
  var recent = useMemo(function() { return (Array.isArray(sessions) ? sessions : []).slice(0, 5); }, [sessions]);
  var healthItems = [
    {key:"retrieval", label:"检索"}, {key:"vikingdb", label:"数据库"},
    {key:"models", label:"嵌入"}, {key:"lock", label:"锁"}, {key:"queue", label:"队列"},
  ];

  if (loading) return React.createElement(Spinner, {text: "加载仪表盘..."});

  return React.createElement("div", {className: "flex flex-col gap-3"},
    React.createElement(ErrMsg, {error: error}),

    /* System Health */
    React.createElement(Card, null,
      React.createElement(CardHeader, {className: "pb-1"},
        React.createElement(CardTitle, {className: "text-sm"}, "系统健康")
      ),
      React.createElement(CardContent, null,
        React.createElement("div", {className: "grid grid-cols-5 gap-1.5"},
          healthItems.map(function(it) {
            var c = components[it.key];
            var ok = c && c.is_healthy !== false;
            return React.createElement("div", {key: it.key, className: "flex flex-col items-center gap-0.5 p-1.5 border border-border rounded text-center"},
              ok ? React.createElement(I.checkCircle, {className: "w-3 h-3 text-green-500"})
                 : React.createElement(I.alertCircle, {className: "w-3 h-3 text-yellow-500"}),
              React.createElement("span", {className: "text-xs"}, it.label),
              React.createElement(Badge, {variant:"outline", className: cn("text-xs px-1 py-0 h-4", ok ? "border-green-500/40 text-green-500" : "border-yellow-500/40 text-yellow-500")}, ok ? "正常" : "异常")
            );
          })
        )
      )
    ),

    /* Recent Sessions */
    React.createElement(Card, null,
      React.createElement(CardHeader, {className: "pb-1"},
        React.createElement(CardTitle, {className: "text-sm"}, "最新会话")
      ),
      React.createElement(CardContent, null,
        recent.length === 0
          ? React.createElement(Empty, {icon: I.file, text: "暂无会话记录"})
          : React.createElement("div", {className: "flex flex-col gap-0.5"},
              recent.map(function(s) {
                var name = s.uri ? s.uri.replace(/^viking:\/\/session\/[^/]+\//, '').substring(0, 40) : "未命名";
                return React.createElement("div", {key: s.session_id || s.uri || name, className: "flex items-center gap-1.5 py-1 text-xs"},
                  React.createElement(I.chevronRight, {className: "w-3 h-3 text-muted-foreground flex-shrink-0"}),
                  React.createElement("span", {className: "truncate flex-1 font-mono"}, name),
                  React.createElement("span", {className: "text-muted-foreground flex-shrink-0"}, s.session_id ? s.session_id.substring(0,8) : "—")
                );
              })
            )
      )
    ),

    /* Quick Actions */
    React.createElement(Card, null,
      React.createElement(CardHeader, {className: "pb-1"},
        React.createElement(CardTitle, {className: "text-sm"}, "快捷入口")
      ),
      React.createElement(CardContent, null,
        React.createElement("div", {className: "flex flex-wrap gap-1.5"},
          [
            {label:"语义搜索", icon:React.createElement(I.search,{className:"w-3 h-3"}), tab:"search"},
            {label:"浏览资源", icon:React.createElement(I.folder,{className:"w-3 h-3"}), tab:"browse"},
          ].map(function(b) {
            return React.createElement(Button, {key: b.label, variant:"outline", size:"sm", className:"gap-1 text-xs h-7",
              onClick: function() { p.setActive && p.setActive(b.tab); }}, b.icon, b.label);
          })
        )
      )
    )
  );
}
