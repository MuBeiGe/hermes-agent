/* ─── Tab 2: Browse ───────────────────────────────────────────────────── */
function BrowseTab() {
  var initState = {
    selectedUri: null, tree: [], contents: [], previewMode: "abstract",
    searchMode: "browse", searchResults: [], relations: [], loading: false,
    treeLoading: false, previewLoading: false, error: null, grepPattern: "", globPattern: "",
  };
  var reducer = function(s, a) {
    switch (a.type) {
      case "SET_STATE": return Object.assign({}, s, a.payload);
      case "SET_TREE_LOADING": return Object.assign({}, s, {treeLoading: a.v});
      case "SET_LOADING": return Object.assign({}, s, {loading: a.v});
      case "SET_PREVIEW_LOADING": return Object.assign({}, s, {previewLoading: a.v});
      case "SET_ERROR": return Object.assign({}, s, {error: a.v});
      case "SET_CONTENTS": return Object.assign({}, s, {contents: a.v, loading: false});
      case "SET_SELECTED": return Object.assign({}, s, {selectedUri: a.uri, contents:[], relations:[], previewLoading:false});
      case "SET_PREVIEW_MODE": return Object.assign({}, s, {previewMode: a.v});
      case "SET_SEARCH_MODE": return Object.assign({}, s, {searchMode: a.v, searchResults: []});
      case "SET_SEARCH_RESULTS": return Object.assign({}, s, {searchResults: a.v, loading: false});
      case "SET_RELATIONS": return Object.assign({}, s, {relations: a.v});
      default: return s;
    }
  };
  var _s = useState(initState), st = _s[0], setSt = _s[1];
  var dispatch = useCallback(function(action) { setSt(function(prev) { return reducer(prev, action); }); }, []);
  var _fu = useState(null), fileUri = _fu[0], setFileUri = _fu[1];
  var _fc = useState(null), fileContent = _fc[0], setFileContent = _fc[1];
  var _fe = useState(false), fileExpanded = _fe[0], setFileExpanded = _fe[1];

  // Category definitions — map viking:// prefixes to human labels
  var CATEGORIES = [
    {prefix:"viking://resources/", label:"资源库", icon:I.folder, color:"text-blue-400"},
    {prefix:"viking://agent/skills/", label:"技能库", icon:I.file, color:"text-green-400"},
    {prefix:"viking://user/memories/", label:"记忆库", icon:I.database, color:"text-purple-400"},
    {prefix:"viking://session/", label:"会话记录", icon:I.file, color:"text-yellow-400"},
  ];

  var categorizeItems = useCallback(function(items) {
    var cats = {};
    var uncat = [];
    (items || []).forEach(function(n) {
      var uri = n.uri || "";
      var matched = false;
      for (var i = 0; i < CATEGORIES.length; i++) {
        if (uri.indexOf(CATEGORIES[i].prefix) === 0) {
          if (!cats[CATEGORIES[i].prefix]) cats[CATEGORIES[i].prefix] = {cat: CATEGORIES[i], items: []};
          cats[CATEGORIES[i].prefix].items.push(n);
          matched = true;
          break;
        }
      }
      if (!matched) uncat.push(n);
    });
    return {cats: cats, uncat: uncat};
  }, []);

  var loadTree = useCallback(function() {
    dispatch({type:"SET_TREE_LOADING", v:true});
    SDK.fetchJSON("/api/plugins/ov-console/fs/tree?depth=1").then(function(d) {
      var items = d && d.result ? d.result : [];
      dispatch({type:"SET_STATE", payload:{tree: items, treeLoading:false}});
    }).catch(function(e) {
      dispatch({type:"SET_ERROR", v:"加载目录树失败: "+(e.message||e)});
      dispatch({type:"SET_TREE_LOADING", v:false});
    });
  }, []);

  var loadDir = useCallback(function(uri) {
    dispatch({type:"SET_LOADING", v:true});
    dispatch({type:"SET_ERROR", v:null});
    SDK.fetchJSON("/api/plugins/ov-console/fs/ls?uri=" + encodeURIComponent(uri || "")).then(function(d) {
      var items = d && d.result ? d.result : [];
      items.sort(function(a, b) {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return (a.uri||"").localeCompare(b.uri||"");
      });
      dispatch({type:"SET_CONTENTS", v:items});
    }).catch(function(e) {
      dispatch({type:"SET_ERROR", v:"加载目录失败: "+(e.message||e)});
      dispatch({type:"SET_LOADING", v:false});
    });
  }, []);

  var loadPreview = useCallback(function(uri) {
    setFileUri(uri); setFileContent(null); setFileExpanded(false);
    if (!uri) return;
    dispatch({type:"SET_PREVIEW_LOADING", v:true});
    var mode = st.previewMode || "abstract";
    SDK.fetchJSON("/api/plugins/ov-console/content/read?uri=" + encodeURIComponent(uri) + "&mode=" + mode).then(function(d) {
      var text = d && d.result !== undefined ? d.result : (d.content || d.data || JSON.stringify(d));
      setFileContent(text); dispatch({type:"SET_PREVIEW_LOADING", v:false});
    }).catch(function(e) {
      dispatch({type:"SET_PREVIEW_LOADING", v:false});
      setFileContent("加载失败: " + (e.message||e));
    });
  }, [st.previewMode]);

  var loadRelations = useCallback(function(uri) {
    if (!uri) { dispatch({type:"SET_RELATIONS", v:[]}); return; }
    SDK.fetchJSON("/api/plugins/ov-console/relations?uri=" + encodeURIComponent(uri)).then(function(d) {
      dispatch({type:"SET_RELATIONS", v: d && d.result ? d.result : []});
    }).catch(function() { dispatch({type:"SET_RELATIONS", v:[]}); });
  }, []);

  var selectItem = useCallback(function(item) {
    if (!item) return;
    dispatch({type:"SET_SELECTED", uri: item.uri});
    setFileExpanded(false);
    if (item.isDir || item.is_directory) { loadDir(item.uri); setFileUri(null); setFileContent(null); }
    else { loadPreview(item.uri); loadRelations(item.uri); }
  }, [loadDir, loadPreview, loadRelations]);

  var setPreviewMode = useCallback(function(mode) {
    dispatch({type:"SET_PREVIEW_MODE", v:mode});
    if (st.selectedUri) {
      dispatch({type:"SET_PREVIEW_LOADING", v:true});
      SDK.fetchJSON("/api/plugins/ov-console/content/read?uri=" + encodeURIComponent(st.selectedUri) + "&mode=" + mode).then(function(d) {
        var text = d && d.result !== undefined ? d.result : (d.content || d.data || JSON.stringify(d));
        setFileContent(text); dispatch({type:"SET_PREVIEW_LOADING", v:false});
      }).catch(function(e) { setFileContent("加载失败: "+(e.message||e)); dispatch({type:"SET_PREVIEW_LOADING", v:false}); });
    }
  }, [st.selectedUri]);

  var setSearchMode = useCallback(function(mode) {
    dispatch({type:"SET_SEARCH_MODE", v:mode});
    if (mode !== "browse") dispatch({type:"SET_CONTENTS", v:[]});
  }, []);

  var doGrep = useCallback(function(pattern) {
    if (!pattern.trim()) return;
    dispatch({type:"SET_LOADING", v:true});
    SDK.fetchJSON("/api/plugins/ov-console/search/grep", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({uri: st.selectedUri || "", pattern: pattern.trim()})
    }).then(function(d) { dispatch({type:"SET_SEARCH_RESULTS", v: d && d.result ? d.result : []}); })
     .catch(function(e) { dispatch({type:"SET_ERROR", v:"Grep失败: "+(e.message||e)}); dispatch({type:"SET_LOADING", v:false}); });
  }, [st.selectedUri]);

  var doGlob = useCallback(function(pattern) {
    if (!pattern.trim()) return;
    dispatch({type:"SET_LOADING", v:true});
    SDK.fetchJSON("/api/plugins/ov-console/search/glob", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({pattern: pattern.trim()})
    }).then(function(d) { dispatch({type:"SET_SEARCH_RESULTS", v: d && d.result ? d.result : []}); })
     .catch(function(e) { dispatch({type:"SET_ERROR", v:"Glob失败: "+(e.message||e)}); dispatch({type:"SET_LOADING", v:false}); });
  }, []);

  useEffect(function() { loadTree(); loadDir(""); }, [loadTree, loadDir]);

  var grouped = useMemo(function() { return categorizeItems(st.tree); }, [st.tree, categorizeItems]);
  var searchMode = st.searchMode;

  // Helper: render a file/dir list item
  function FileRow(p) {
    var item = p.item, isDir = item.isDir || item.is_directory;
    var name = (item.uri || "").split("/").pop() || "?";
    return React.createElement("div", {
      className: cn("flex items-center gap-1.5 py-1 px-2 text-xs cursor-pointer hover:bg-foreground/5 transition-colors rounded", st.selectedUri === item.uri && "bg-foreground/10"),
      onClick: function() { selectItem(item); }
    },
      isDir ? React.createElement(I.folder, {className:"w-3 h-3 text-yellow-500 flex-shrink-0"})
            : React.createElement(I.file, {className:"w-3 h-3 text-muted-foreground flex-shrink-0"}),
      React.createElement("span", {className:"truncate flex-1 font-mono"}, name),
      item.size ? React.createElement("span", {className:"text-muted-foreground flex-shrink-0"}, item.size > 1024 ? Math.round(item.size/1024)+"KB" : item.size+"B") : null
    );
  }

  return React.createElement("div", {className: "flex flex-col gap-2"},
    React.createElement(ErrMsg, {error: st.error}),

    /* Mode toggle */
    React.createElement("div", {className: "flex items-center gap-1.5 flex-wrap"},
      React.createElement("span", {className: "text-xs text-muted-foreground"}, "浏览模式:"),
      [{v:"browse",l:"浏览"},{v:"grep",l:"Grep"},{v:"glob",l:"Glob"}].map(function(m) {
        return React.createElement(Button, {key: m.v, variant: searchMode===m.v ? "default" : "outline", size:"sm", className:"h-6 text-xs px-2",
          onClick: function() { setSearchMode(m.v); if (m.v !== "browse") return; loadDir(st.selectedUri || ""); }}, m.l);
      }),
      React.createElement("div", {className: "flex-1"}),
      React.createElement(Button, {variant:"ghost", size:"icon", className:"h-6 w-6", onClick:loadTree, title:"刷新"},
        React.createElement(I.refresh, {className:"w-3 h-3"}))
    ),

    searchMode !== "browse" && React.createElement("div", {className: "flex gap-1.5"},
      React.createElement(Input, {className:"h-7 text-xs", placeholder: searchMode==="grep" ? "正则表达式..." : "glob 模式...",
        value: searchMode==="grep" ? st.grepPattern : st.globPattern,
        onChange: function(e) {
          var val = e.target.value;
          dispatch({type:"SET_STATE", payload: searchMode==="grep" ? {grepPattern:val} : {globPattern:val}});
        },
        onKeyDown: function(e) { if (e.key === "Enter") { searchMode==="grep" ? doGrep(e.target.value) : doGlob(e.target.value); } }
      }),
      React.createElement(Button, {size:"sm", className:"h-7 text-xs", onClick: function() {
        if (searchMode==="grep") doGrep(st.grepPattern || ""); else doGlob(st.globPattern || ""); }}, "搜索")
    ),

    /* Left tree + Right content */
    React.createElement("div", {className: "flex gap-2 min-h-[350px]"},
      /* Left: Category Tree */
      React.createElement("div", {className: "w-2/5 border border-border rounded-md overflow-y-auto max-h-[450px]"},
        st.treeLoading ? React.createElement(Spinner, {text:"加载目录树..."})
        : (st.tree.length === 0) ? React.createElement(Empty, {icon:I.folder, text:"空集合"})
        : React.createElement("div", {className: "py-1"},
            // Category groups
            Object.keys(grouped.cats).map(function(prefix) {
              var g = grouped.cats[prefix];
              var cat = g.cat;
              return React.createElement("div", {key: prefix},
                React.createElement("div", {className: "flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50"},
                  React.createElement(cat.icon, {className: "w-3 h-3 " + cat.color}),
                  React.createElement("span", null, cat.label),
                  React.createElement(Badge, {variant:"outline", className:"text-xs px-1 py-0 h-4 ml-auto"}, g.items.length)
                ),
                g.items.map(function(node) {
                  return React.createElement(FileRow, {key: node.uri, item: node});
                })
              );
            }),
            // Uncategorized
            grouped.uncat.length > 0 && React.createElement("div", null,
              React.createElement("div", {className: "flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50"},
                React.createElement(I.folder, {className: "w-3 h-3"}),
                React.createElement("span", null, "其他"),
                React.createElement(Badge, {variant:"outline", className:"text-xs px-1 py-0 h-4 ml-auto"}, grouped.uncat.length)
              ),
              grouped.uncat.map(function(node) {
                return React.createElement(FileRow, {key: node.uri, item: node});
              })
            )
          )
      ),

      /* Right panel */
      React.createElement("div", {className: "w-3/5 flex flex-col gap-2"},
        searchMode === "browse" && React.createElement("div", {className: "border border-border rounded-md overflow-y-auto max-h-[180px]"},
          st.loading ? React.createElement(Spinner, {text:"加载中..."})
          : st.contents.length === 0 ? React.createElement(Empty, {icon:I.folder, text: st.selectedUri ? "此目录为空" : "选择一个目录"})
          : React.createElement("div", {className: "py-1"},
              st.contents.map(function(item, i) {
                return React.createElement(FileRow, {key: item.uri || i, item: item});
              })
            )
        ),

        searchMode !== "browse" && React.createElement("div", {className: "border border-border rounded-md overflow-y-auto max-h-[180px]"},
          st.loading ? React.createElement(Spinner, {text:"搜索中..."})
          : st.searchResults.length === 0 ? React.createElement(Empty, {icon:I.search, text:"无搜索结果"})
          : React.createElement("div", {className: "py-1"},
              st.searchResults.map(function(item, i) {
                return React.createElement(FileRow, {key: item.uri || i, item: item});
              })
            )
        ),

        /* Preview */
        React.createElement(Card, null,
          React.createElement(CardHeader, {className: "pb-1"},
            React.createElement("div", {className: "flex items-center gap-1.5"},
              React.createElement(CardTitle, {className: "text-xs"}, "预览"),
              React.createElement("div", {className: "flex gap-1 ml-auto"},
                [{v:"abstract",l:"摘要"},{v:"overview",l:"概览"},{v:"full",l:"全文"}].map(function(m) {
                  return React.createElement(Button, {key: m.v, variant: st.previewMode===m.v ? "default" : "outline", size:"sm", className:"h-5 text-xs px-1.5",
                    onClick: function() { setPreviewMode(m.v); }}, m.l);
                })
              )
            )
          ),
          React.createElement(CardContent, null,
            !fileUri && !st.previewLoading
              ? React.createElement("div", {className:"flex items-center justify-center h-16 text-muted-foreground"},
                  React.createElement("span", {className:"text-xs"}, "选择文件查看预览"))
              : st.previewLoading
                ? React.createElement(Spinner, {text:"加载预览..."})
                : fileContent
                  ? React.createElement(React.Fragment, null,
                      React.createElement("div", {className: cn("font-mono text-xs leading-relaxed whitespace-pre-wrap break-all overflow-auto", fileExpanded ? "max-h-none" : "max-h-[600px]")},
                        typeof fileContent === "string" ? fileContent : JSON.stringify(fileContent, null, 2)),
                      React.createElement(Button, {variant:"ghost", size:"sm", className:"h-5 text-xs text-muted-foreground",
                        onClick: function() { setFileExpanded(!fileExpanded); }},
                        fileExpanded ? "收起" : "展开全文"),
                      fileUri && React.createElement("div", {className:"flex items-center gap-1 mt-1"},
                        React.createElement("span", {className:"text-xs text-muted-foreground font-mono truncate flex-1"}, fileUri),
                        React.createElement(Button, {variant:"ghost", size:"sm", className:"h-4 text-xs text-muted-foreground",
                          onClick: function() { if (navigator.clipboard) { navigator.clipboard.writeText(fileUri); } }},
                          "复制")))
                  : React.createElement("span", {className:"text-xs text-muted-foreground"}, "无内容")
          )
        ),

        /* Relations */
        React.createElement(Card, null,
          React.createElement(CardHeader, {className: "pb-1"},
            React.createElement(CardTitle, {className: "text-xs"}, "关联资源")
          ),
          React.createElement(CardContent, null,
            st.relations.length === 0
              ? React.createElement("span", {className:"text-xs text-muted-foreground"}, "暂无关联")
              : React.createElement("div", {className: "flex flex-col gap-0.5"},
                  st.relations.map(function(rel, i) {
                    return React.createElement("div", {key: i, className: "flex items-center gap-1 text-xs"},
                      React.createElement(I.link, {className:"w-2.5 h-2.5 text-muted-foreground flex-shrink-0"}),
                      React.createElement(Badge, {variant:"outline", className:"text-xs px-1 py-0 h-4"}, rel.edge_type || "related"),
                      React.createElement("span", {className:"truncate flex-1 font-mono"}, rel.to || rel.from || "—")
                    );
                  })
                )
          )
        )
      )
    )
  );
}
