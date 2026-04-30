/* ─── Tab 3: Search ───────────────────────────────────────────────────── */
function SearchTab() {
  var _q = useState(""), query = _q[0], setQuery = _q[1];
  var _r = useState(null), results = _r[0], setResults = _r[1];
  var _l = useState(false), searching = _l[0], setSearching = _l[1];
  var _s = useState(false), searched = _s[0], setSearched = _s[1];
  var _e = useState(null), error = _e[0], setError = _e[1];
  var _qp = useState(null), queryPlan = _qp[0], setQueryPlan = _qp[1];
  var _m = useState("auto"), searchMode = _m[0], setSearchMode = _m[1];
  var relCache = useRef({});
  var relExpanded = useRef({});
  var contentCache = useRef({});

  var doSearch = useCallback(function() {
    if (!query.trim()) return;
    setSearching(true); setSearched(false); setError(null);
    setQueryPlan(null); setResults(null);
    SDK.fetchJSON("/api/plugins/ov-console/search", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({query: query.trim(), limit: 20, mode: searchMode})
    }).then(function(d) {
      var plan = d && (d.query_plan || d.query_plan_used || (d.result && d.result.query_plan));
      setQueryPlan(plan || null);
      // 支持两种响应格式: 扁平{memories,resources,skills} 或 包装{result:{...}}
      var mems = d.memories || (d.result && d.result.memories) || [];
      var ress = d.resources || (d.result && d.result.resources) || [];
      var skls = d.skills || (d.result && d.result.skills) || [];
      setResults({memories:mems, resources:ress, skills:skls, total: d && d.total !== undefined ? d.total : (mems.length+ress.length+skls.length)});
      setSearched(true);
    }).catch(function(e) {
      setError("搜索失败: " + (e.message || e));
      setSearched(true);
    }).finally(function() { setSearching(false); });
  }, [query, searchMode]);

  var toggleRelations = useCallback(function(uri) {
    if (relCache.current[uri]) {
      relExpanded.current[uri] = !relExpanded.current[uri];
      setResults(function(prev) { return prev ? Object.assign({}, prev) : prev; });
      return;
    }
    SDK.fetchJSON("/api/plugins/ov-console/relations?uri=" + encodeURIComponent(uri)).then(function(d) {
      relCache.current[uri] = d && d.result ? d.result : [];
      relExpanded.current[uri] = true;
      setResults(function(prev) { return prev ? Object.assign({}, prev) : prev; });
    }).catch(function() { relCache.current[uri] = []; relExpanded.current[uri] = true; });
  }, []);

  var loadContent = useCallback(function(uri) {
    if (contentCache.current[uri]) return;
    SDK.fetchJSON("/api/plugins/ov-console/content/read?uri=" + encodeURIComponent(uri) + "&mode=full").then(function(d) {
      var text = d && d.result !== undefined ? d.result : (d.content || d.data || "");
      contentCache.current[uri] = typeof text === "string" ? text : JSON.stringify(text, null, 2);
      setResults(function(prev) { return prev ? Object.assign({}, prev) : prev; });
    }).catch(function() { contentCache.current[uri] = "(加载失败)"; });
  }, []);

  var toggleContent = useCallback(function(uri) {
    if (contentCache.current[uri]) {
      contentCache.current[uri] = null;
    } else {
      loadContent(uri);
    }
    setResults(function(prev) { return prev ? Object.assign({}, prev) : prev; });
  }, [loadContent]);

  var sendFeedback = useCallback(function(uri, outcome) {
    SDK.fetchJSON("/api/plugins/ov-console/feedback", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({uri: uri, outcome: outcome})
    }).then(function(d) {
      var strength = d && d.result && d.result.synapse_strength !== undefined ? d.result.synapse_strength : null;
      if (strength !== null) {
        relCache.current["_synapse_" + uri] = strength;
        setResults(function(prev) { return prev ? Object.assign({}, prev) : prev; });
      }
    }).catch(function() {});
  }, []);

  var copyUri = useCallback(function(uri) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(uri).then(function() {
        alert("URI 已复制: " + uri);
      });
    }
  }, []);

  function ResultCard(p) {
    var item = p.item, type = p.type;
    var uri = item.uri || "";
    var name = uri.split("/").pop() || "?";
    var abs = (item.abstract || item.snippet || item.content || "—") + "";
    var shortAbs = abs.substring(0, 300);
    var score = item.score !== undefined ? (item.score * 100).toFixed(0) : null;
    var syn = relCache.current["_synapse_" + uri];
    var rels = relCache.current[uri] || [];
    var relsOpen = !!relExpanded.current[uri];
    var fullContent = contentCache.current[uri];
    var contentOpen = fullContent !== undefined && fullContent !== null;
    var cfg = {memory:{badge:"bg-purple-500/20 text-purple-500 border-purple-500/30", label:"记忆"},
               resource:{badge:"bg-blue-500/20 text-blue-500 border-blue-500/30", label:"资源"},
               skill:{badge:"bg-green-500/20 text-green-500 border-green-500/30", label:"技能"}}[type] || {badge:"", label:type};

    return React.createElement("div", {className: "border border-border rounded-md p-2.5 flex flex-col gap-1.5"},
      /* 标题行: 名称 + 分数 + 类型badge */
      React.createElement("div", {className: "flex items-center gap-1.5 flex-wrap"},
        React.createElement(I.file, {className:"w-3.5 h-3.5 text-muted-foreground flex-shrink-0"}),
        React.createElement("span", {
          className: "text-sm font-medium truncate flex-1 cursor-pointer hover:text-blue-500 hover:underline transition-colors",
          title: "点击复制 URI",
          onClick: function(e) { e.stopPropagation(); copyUri(uri); }
        }, name),
        score && React.createElement(Badge, {variant:"outline", className:"text-xs px-1.5 py-0"}, "⭐" + score + "%"),
        React.createElement(Badge, {className: cn("text-xs px-1.5 py-0 border", cfg.badge)}, cfg.label)
      ),

      /* URI行 */
      React.createElement("div", {className: "flex items-center gap-1"},
        React.createElement("span", {
          className: "text-xs text-muted-foreground font-mono truncate cursor-pointer hover:text-foreground",
          title: "点击复制",
          onClick: function(e) { e.stopPropagation(); copyUri(uri); }
        }, uri.length > 80 ? uri.substring(0, 77) + "..." : uri)
      ),

      /* 摘要 */
      abs && React.createElement("p", {className: "text-xs text-muted-foreground leading-relaxed"}, shortAbs),

      /* 操作按钮栏 */
      React.createElement("div", {className: "flex items-center gap-1.5 flex-wrap"},
        React.createElement(Button, {variant:"outline", size:"sm", className:"h-6 text-xs px-2",
          onClick: function() { toggleContent(uri); }},
          contentOpen ? "收起原文" : "查看原文"),
        React.createElement(Button, {variant:"ghost", size:"sm", className:"h-6 text-xs px-2 text-muted-foreground",
          onClick: function(e) { e.stopPropagation(); copyUri(uri); }},
          "复制出处"),
        React.createElement("span", {className: "flex-1"}),
        React.createElement(Button, {variant:"outline", size:"icon", className:"h-5 w-5", onClick:function(){sendFeedback(uri,"success")}, title:"有用"},
          React.createElement(I.thumbUp, {className:"w-2.5 h-2.5"})),
        React.createElement(Button, {variant:"outline", size:"icon", className:"h-5 w-5", onClick:function(){sendFeedback(uri,"failure")}, title:"没用"},
          React.createElement(I.thumbDown, {className:"w-2.5 h-2.5"}))
      ),

      /* 原文展开区 */
      contentOpen && fullContent && React.createElement("div", {className: "mt-1 border-t border-border pt-2"},
        React.createElement("div", {className: "font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-[400px] overflow-auto bg-foreground/5 rounded p-2"},
          fullContent.length > 5000 ? fullContent.substring(0, 5000) + "\n\n... (内容过长，显示前5000字)" : fullContent)
      ),

      /* 关联 */
      React.createElement("div", {className: "flex flex-col gap-0.5"},
        React.createElement("button", {
          className: "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors text-left",
          onClick: function() { toggleRelations(uri); }
        },
          React.createElement(I.link, {className:"w-2.5 h-2.5"}),
          "关联: ", rels.length > 0 ? rels.length + " 项" : (relsOpen ? "无关联" : "加载关联"),
          relsOpen ? React.createElement(I.chevronDown, {className:"w-2.5 h-2.5"}) : React.createElement(I.chevronRight, {className:"w-2.5 h-2.5"})
        ),
        relsOpen && rels.length > 0 && React.createElement("div", {className: "pl-4 flex flex-col gap-0.5"},
          rels.map(function(rel, i) {
            return React.createElement("span", {key: i, className: "text-xs text-muted-foreground truncate"},
              (rel.edge_type || "related") + " → " + (rel.to || rel.from || "—"));
          })
        )
      )
    );
  }

  var typeOrder = ["memories", "resources", "skills"];
  var typeNames = {memories:"记忆", resources:"资源", skills:"技能"};

  return React.createElement("div", {className: "flex flex-col gap-2"},
    React.createElement(ErrMsg, {error: error}),

    /* Search bar */
    React.createElement("div", {className: "flex gap-2 flex-wrap"},
      React.createElement("div", {className: "relative flex-1 min-w-[200px]"},
        React.createElement("span", {className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"},
          React.createElement(I.search, {className:"w-3.5 h-3.5"})),
        React.createElement(Input, {className:"pl-8 h-8 text-sm", placeholder:"语义搜索资源库...",
          value: query,
          onChange: function(e) { setQuery(e.target.value); },
          onKeyDown: function(e) { if (e.key === "Enter") doSearch(); }})
      ),
      React.createElement("select", {className:"h-8 px-2 text-xs border border-border rounded-md bg-background",
        value: searchMode, onChange: function(e) { setSearchMode(e.target.value); }},
        React.createElement("option", {value:"auto"}, "自动"),
        React.createElement("option", {value:"fast"}, "快速"),
        React.createElement("option", {value:"deep"}, "深度")
      ),
      React.createElement(Button, {onClick:doSearch, disabled:searching || !query.trim(), size:"sm", className:"h-8"}, searching ? "搜索中..." : "搜索")
    ),

    /* Result counts */
    searched && results && React.createElement("div", {className:"flex gap-2 items-center flex-wrap text-xs text-muted-foreground"},
      React.createElement("span", null, "共 ", results.total || 0, " 条结果"),
      typeOrder.map(function(t) {
        var arr = results[t] || [];
        return arr.length > 0
          ? React.createElement(Badge, {key:t, variant:"outline", className:"text-xs px-1.5 py-0"}, typeNames[t] + " " + arr.length)
          : null;
      })
    ),

    /* Results — 按相关性混合排列，不按type分组 */
    React.createElement("div", {className:"flex flex-col gap-2"},
      !searched ? React.createElement(Empty, {icon:I.search, text:"输入关键词开始搜索"})
      : (results && results.total === 0) ? React.createElement(Empty, {icon:I.search, text:"未找到结果"})
      : function() {
          // 混合排列所有结果（保持搜索结果原始顺序）
          var all = [];
          typeOrder.forEach(function(t) {
            var arr = results && results[t] ? results[t] : [];
            arr.forEach(function(item) {
              all.push({item: item, type: t === "memories" ? "memory" : t === "resources" ? "resource" : "skill"});
            });
          });
          return all.map(function(e, i) {
            return React.createElement(ResultCard, {key: e.item.uri || i, item: e.item, type: e.type});
          });
        }()
    )
  );
}
