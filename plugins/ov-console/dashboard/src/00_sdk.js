/* ================================================================
   SDK bootstrapping — must load first
   ================================================================ */
var SDK = window.__HERMES_PLUGIN_SDK__;
var React = SDK.React;
var h = SDK.hooks;
var comp = SDK.components;
var util = SDK.utils;

var Card = comp.Card, CardHeader = comp.CardHeader, CardTitle = comp.CardTitle, CardContent = comp.CardContent;
var Badge = comp.Badge, Button = comp.Button, Input = comp.Input;
var Tabs = comp.Tabs, TabsList = comp.TabsList, TabsTrigger = comp.TabsTrigger;
var useState = h.useState, useEffect = h.useEffect, useCallback = h.useCallback;
var useMemo = h.useMemo, useRef = h.useRef;
var cn = util.cn, isoTimeAgo = util.isoTimeAgo;
