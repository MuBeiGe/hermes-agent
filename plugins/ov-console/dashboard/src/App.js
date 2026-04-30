/* ─── App ──────────────────────────────────────────────────────────────── */
function App() {
  return React.createElement(Tabs, {defaultValue: "dashboard", className: "w-full"},
    function(active, setActive) {
      return React.createElement(React.Fragment, null,
        React.createElement(TabsList, null,
          React.createElement(TabsTrigger, {value:"dashboard", active:active==="dashboard", onClick:function(){setActive("dashboard")}}, "仪表盘"),
          React.createElement(TabsTrigger, {value:"browse",    active:active==="browse",    onClick:function(){setActive("browse")}},    "浏览"),
          React.createElement(TabsTrigger, {value:"search",    active:active==="search",    onClick:function(){setActive("search")}},    "搜索")
        ),
        active === "dashboard" && React.createElement(DashboardTab, {setActive: setActive}),
        active === "browse"    && React.createElement(BrowseTab, null),
        active === "search"    && React.createElement(SearchTab, null)
      );
    }
  );
}
