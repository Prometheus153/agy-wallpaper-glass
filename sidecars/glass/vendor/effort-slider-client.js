"use strict";

/**
 * Antigravity Codex 风格推理等级滑条 (antigravity-codex-effort-slider)
 *
 * 设计目标与核心约束：
 * 1. 深度适配 Google Antigravity 原生架构（基于 React Fiber 状态树与模型选择器 DOM）：
 *    支持主模型列表与 Antigravity 2.34.0 Orchestrator 规划器二级子菜单联动。
 * 2. 在原生模型菜单 ([data-testid="model-selector-panel"]) 底部（模型列表与 View Usage 之间）
 *    挂载专属「推理等级」滑条行；屏蔽模型行与 Orchestrator 规划器右侧冗余档位子菜单，
 *    保留档位文字并按所属主题（Codex 星尘 / Claude 像素点阵）随档位着色。
 * 3. 在菜单内点击上方模型行或 Orchestrator 规划器切换时保持主菜单常开，下方滑条即时联动
 *    可用档位（单档位模型自动置灰锁定，Orchestrator 与普通模型各自独立记忆上次档位）。
 * 4. 拖动滑条或点击轨道切档时，滑过档位边界立即通过 React Fiber 提交真实档位（无需等待松手），
 *    同时保持主菜单常开与零焦点框选。
 * 5. 自动适配多档位能量映射（无 Off 档三档 0 -> 0.5 -> 1.0；含 Off 首档四档 1/3 -> 2/3 -> 1.0；
 *    四档含 Extra 时按实际档位等比映射），默认启用「完整动画」模式。
 */
(function (root, factory) {
  try {
    var exportsObj = factory(root);
    if (typeof module === "object" && module && typeof module.exports === "object") {
      module.exports = exportsObj;
    }
    if (root && typeof root === "object") {
      root.AntigravityCodexEffortSlider = exportsObj;
    }
  } catch (err) {
    // Factory error handled silently
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this, function (globalRoot) {

  // ── 多语言 i18n 引擎（支持 7 语，未命中系统语言统一回退英语） ──────────────
  function resolveUiLocale(rawLocale) {
    var raw = String(rawLocale || "").trim().toLowerCase().replace(/_/g, "-");
    if (!raw) return "en";
    if (raw === "zh-tw" || raw === "zh-hk" || raw === "zh-mo" || raw.indexOf("zh-hant") === 0) {
      return "zh-TW";
    }
    if (raw === "zh" || raw.indexOf("zh-") === 0) {
      return "zh-CN";
    }
    if (raw === "ja" || raw.indexOf("ja-") === 0) return "ja";
    if (raw === "ko" || raw.indexOf("ko-") === 0) return "ko";
    if (raw === "fr" || raw.indexOf("fr-") === 0) return "fr";
    if (raw === "ru" || raw.indexOf("ru-") === 0) return "ru";
    return "en";
  }

  function detectUiLocale(win) {
    var w = win || (typeof window !== "undefined" ? window : globalRoot);
    try {
      var nav = w && w.navigator;
      if (nav) {
        if (Array.isArray(nav.languages) && nav.languages.length > 0 && nav.languages[0]) {
          return resolveUiLocale(nav.languages[0]);
        }
        if (typeof nav.language === "string" && nav.language.trim()) {
          return resolveUiLocale(nav.language);
        }
      }
    } catch (err) {}
    try {
      if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
        var sysLoc = Intl.DateTimeFormat().resolvedOptions().locale;
        if (sysLoc) return resolveUiLocale(sysLoc);
      }
    } catch (err) {}
    return "en";
  }

  var I18N_MESSAGES = Object.freeze({
    "zh-CN": Object.freeze({
      sliderLabel: "推理等级",
      panelTitle: "推理等级滑条",
      panelAriaLabel: "推理等级滑条设置",
      motionLabel: "动画效果",
      motionFull: "完整动画",
      motionFullHint: "默认 · 匀变速追赶 + 星尘渐亮",
      motionFast: "快速动画",
      motionFastHint: "拨过 1/3 即切档 · ~70ms 快速吸附",
      motionQuick: "简洁动画",
      motionQuickHint: "无过渡 · 直接跳档",
      ticksLabel: "已到达档位的刻度点",
      ticksHighlight: "亮白显示",
      ticksHighlightHint: "默认 · 已滑过档位高亮",
      ticksDim: "与未到达同色",
      ticksDimHint: "所有刻度点保持柔和半透明",
      ticksHidden: "隐藏",
      ticksHiddenHint: "不显示任何刻度点",
      updateSectionTag: "版本与自动更新",
      pendingTitle: "新版本 v{version} 已准备就绪",
      pendingTitleFallback: "新版本已就绪",
      pendingDescIde: "重载窗口即可生效",
      pendingDescDesktop: "重启 Antigravity 立即生效",
      relaunchNowIde: "立即重载生效",
      relaunchNowDesktop: "立即重启生效",
      currentVersion: "当前版本：v{version}",
      lastCheckPrefix: "上次检查：{time}",
      lastCheckNever: "尚未检查",
      timeJustNow: "刚刚",
      timeMinutesAgo: "{n} 分钟前",
      timeHoursAgo: "{n} 小时前",
      timeDaysAgo: "{n} 天前",
      checkUpdate: "检查更新",
      checkingUpdate: "检查中...",
      checkingRelease: "正在检查 GitHub Release...",
      upToDate: "已是最新版本 (v{version})",
      downloadedReady: "已下载 v{version}，重启生效",
      checkFailed: "检查失败：{err}",
      stateReadFailed: "上次检查：状态读取失败",
      networkError: "网络错误",
      autoUpdateTitle: "每 12 小时自动检查更新",
      autoUpdateDesc: "后台静默拉取轻量更新包并弹窗提醒重启生效",
      enabled: "已启用",
      disabled: "已禁用",
      mirrorTitle: "GitHub 镜像前缀",
      mirrorDesc: "留空使用系统代理直连；国内可填入加速前缀（如 https://gh-proxy.com/）",
      mirrorPlaceholder: "留空直连，如 https://gh-proxy.com/",
      save: "保存",
      saved: "已保存",
      copyDiag: "复制诊断",
      copied: "已复制",
      resetDefault: "恢复默认",
      close: "关闭",
      uninstallBtn: "卸载本插件",
      uninstallConfirmTitle: "确认卸载「推理等级滑条」？",
      uninstallConfirmDesc: "仅移除本插件的补丁与插件目录，不会影响其他已安装的插件及原有设置。",
      cancel: "取消",
      confirmUninstall: "确认卸载",
      uninstalling: "卸载中...",
      uninstallFailed: "卸载失败",
      uninstallError: "卸载异常：{err}",
      unknownError: "未知错误",
      updateToastTitle: "推理等级滑条 v{version} 已就绪",
      updateToastDescIde: "新版已校验完成，重新加载窗口即可生效。",
      updateToastDescDesktop: "新版已校验完成，重启 Antigravity 即可生效。",
      later: "稍后",
      restartNow: "立即重启",
      reloadNow: "立即重载",
      reloading: "重载中...",
      restarting: "重启中...",
      uninstallToastTitle: "推理等级滑条已卸载",
      uninstallToastDescIde: "已移除本插件补丁与插件目录，其他已安装插件不受影响；重新加载窗口后彻底生效。",
      uninstallToastDescDesktop: "已移除本插件补丁与插件目录，其他已安装插件不受影响；重启 Antigravity 后彻底生效。"
    }),
    "zh-TW": Object.freeze({
      sliderLabel: "推理等級",
      panelTitle: "推理等級滑桿",
      panelAriaLabel: "推理等級滑桿設定",
      motionLabel: "動畫效果",
      motionFull: "完整動畫",
      motionFullHint: "預設 · 勻變速追趕 + 星塵漸亮",
      motionFast: "快速動畫",
      motionFastHint: "撥過 1/3 即切檔 · ~70ms 快速吸附",
      motionQuick: "簡潔動畫",
      motionQuickHint: "無過渡 · 直接跳檔",
      ticksLabel: "已到達檔位的刻度點",
      ticksHighlight: "亮白顯示",
      ticksHighlightHint: "預設 · 已滑過檔位高亮",
      ticksDim: "與未到達同色",
      ticksDimHint: "所有刻度點保持柔和半透明",
      ticksHidden: "隱藏",
      ticksHiddenHint: "不顯示任何刻度點",
      updateSectionTag: "版本與自動更新",
      pendingTitle: "新版本 v{version} 已準備就緒",
      pendingTitleFallback: "新版本已就緒",
      pendingDescIde: "重新載入視窗即可生效",
      pendingDescDesktop: "重啟 Antigravity 立即生效",
      relaunchNowIde: "立即重載生效",
      relaunchNowDesktop: "立即重啟生效",
      currentVersion: "目前版本：v{version}",
      lastCheckPrefix: "上次檢查：{time}",
      lastCheckNever: "尚未檢查",
      timeJustNow: "剛剛",
      timeMinutesAgo: "{n} 分鐘前",
      timeHoursAgo: "{n} 小時前",
      timeDaysAgo: "{n} 天前",
      checkUpdate: "檢查更新",
      checkingUpdate: "檢查中...",
      checkingRelease: "正在檢查 GitHub Release...",
      upToDate: "目前已是最新版本 (v{version})",
      downloadedReady: "已下載 v{version}，重啟生效",
      checkFailed: "檢查失敗：{err}",
      stateReadFailed: "上次檢查：狀態讀取失敗",
      networkError: "網路錯誤",
      autoUpdateTitle: "每 12 小時自動檢查更新",
      autoUpdateDesc: "背景靜默拉取輕量更新包並彈窗提醒重啟生效",
      enabled: "已啟用",
      disabled: "已停用",
      mirrorTitle: "GitHub 鏡像前綴",
      mirrorDesc: "留空使用系統代理直連；需要時可填入加速前綴（如 https://gh-proxy.com/）",
      mirrorPlaceholder: "留空直連，如 https://gh-proxy.com/",
      save: "儲存",
      saved: "已儲存",
      copyDiag: "複製診斷",
      copied: "已複製",
      resetDefault: "恢復預設",
      close: "關閉",
      uninstallBtn: "解除安裝本外掛",
      uninstallConfirmTitle: "確認解除安裝「推理等級滑桿」？",
      uninstallConfirmDesc: "僅移除本外掛的修補與外掛目錄，不會影響其他已安裝的外掛與原有設定。",
      cancel: "取消",
      confirmUninstall: "確認解除安裝",
      uninstalling: "解除安裝中...",
      uninstallFailed: "解除安裝失敗",
      uninstallError: "解除安裝異常：{err}",
      unknownError: "未知錯誤",
      updateToastTitle: "推理等級滑桿 v{version} 已就緒",
      updateToastDescIde: "新版本已校驗完成，重新載入視窗即可生效。",
      updateToastDescDesktop: "新版本已校驗完成，重啟 Antigravity 即可生效。",
      later: "稍後",
      restartNow: "立即重啟",
      reloadNow: "立即重載",
      reloading: "重載中...",
      restarting: "重啟中...",
      uninstallToastTitle: "推理等級滑桿已解除安裝",
      uninstallToastDescIde: "已移除本外掛修補與外掛目錄，其他已安裝外掛不受影響；重新載入視窗後徹底生效。",
      uninstallToastDescDesktop: "已移除本外掛修補與外掛目錄，其他已安裝外掛不受影響；重啟 Antigravity 後徹底生效。"
    }),
    "en": Object.freeze({
      sliderLabel: "Reasoning effort",
      panelTitle: "Effort Slider",
      panelAriaLabel: "Reasoning effort slider settings",
      motionLabel: "Animation",
      motionFull: "Full",
      motionFullHint: "Default · Smooth ease & stardust glow",
      motionFast: "Fast",
      motionFastHint: "Snaps at 1/3 threshold · ~70ms",
      motionQuick: "Minimal",
      motionQuickHint: "Instant snap without transition",
      ticksLabel: "Reached Tick Dots",
      ticksHighlight: "Bright",
      ticksHighlightHint: "Default · Highlight reached ticks",
      ticksDim: "Uniform",
      ticksDimHint: "Keep all ticks subtle and translucent",
      ticksHidden: "Hidden",
      ticksHiddenHint: "Hide all tick dots",
      updateSectionTag: "Version & Auto-Update",
      pendingTitle: "Update v{version} is ready",
      pendingTitleFallback: "New version is ready",
      pendingDescIde: "Reload window to apply",
      pendingDescDesktop: "Restart Antigravity to apply",
      relaunchNowIde: "Reload Now",
      relaunchNowDesktop: "Restart Now",
      currentVersion: "Current version: v{version}",
      lastCheckPrefix: "Last checked: {time}",
      lastCheckNever: "Never",
      timeJustNow: "Just now",
      timeMinutesAgo: "{n}m ago",
      timeHoursAgo: "{n}h ago",
      timeDaysAgo: "{n}d ago",
      checkUpdate: "Check Updates",
      checkingUpdate: "Checking...",
      checkingRelease: "Checking GitHub Release...",
      upToDate: "Up to date (v{version})",
      downloadedReady: "Downloaded v{version}, restart to apply",
      checkFailed: "Check failed: {err}",
      stateReadFailed: "Last checked: Failed to read state",
      networkError: "Network error",
      autoUpdateTitle: "Auto-check every 12h",
      autoUpdateDesc: "Silently fetch updates in background and prompt to restart",
      enabled: "Enabled",
      disabled: "Disabled",
      mirrorTitle: "GitHub Mirror Prefix",
      mirrorDesc: "Leave blank to use system proxy directly; optional mirror prefix (e.g. https://gh-proxy.com/)",
      mirrorPlaceholder: "Direct by default, e.g. https://gh-proxy.com/",
      save: "Save",
      saved: "Saved",
      copyDiag: "Copy Trace",
      copied: "Copied",
      resetDefault: "Reset",
      close: "Close",
      uninstallBtn: "Uninstall Plugin",
      uninstallConfirmTitle: "Uninstall Effort Slider?",
      uninstallConfirmDesc: "Only removes this plugin's patches and directory; other installed plugins and settings remain untouched.",
      cancel: "Cancel",
      confirmUninstall: "Uninstall",
      uninstalling: "Removing...",
      uninstallFailed: "Uninstall failed",
      uninstallError: "Uninstall error: {err}",
      unknownError: "Unknown error",
      updateToastTitle: "Effort Slider v{version} Ready",
      updateToastDescIde: "Verified update is ready. Reload window to apply.",
      updateToastDescDesktop: "Verified update is ready. Restart Antigravity to apply.",
      later: "Later",
      restartNow: "Restart",
      reloadNow: "Reload",
      reloading: "Reloading...",
      restarting: "Restarting...",
      uninstallToastTitle: "Effort Slider Uninstalled",
      uninstallToastDescIde: "Plugin patches and files removed cleanly; other plugins remain intact. Reload window to finish.",
      uninstallToastDescDesktop: "Plugin patches and files removed cleanly; other plugins remain intact. Restart Antigravity to finish."
    }),
    "ja": Object.freeze({
      sliderLabel: "推論レベル",
      panelTitle: "推論スライダー",
      panelAriaLabel: "推論レベルスライダー設定",
      motionLabel: "アニメーション",
      motionFull: "フル",
      motionFullHint: "既定 · なめらかな追従 + 星屑発光",
      motionFast: "高速",
      motionFastHint: "1/3 到達で即切替 · ~70ms",
      motionQuick: "シンプル",
      motionQuickHint: "トランジションなし · 即時移動",
      ticksLabel: "到達済み目盛り点",
      ticksHighlight: "明るく表示",
      ticksHighlightHint: "既定 · 到達済み目盛りをハイライト",
      ticksDim: "未到達と同色",
      ticksDimHint: "すべての目盛りを半透明で表示",
      ticksHidden: "非表示",
      ticksHiddenHint: "目盛り点をすべて隠す",
      updateSectionTag: "バージョンと自動更新",
      pendingTitle: "新バージョン v{version} の準備完了",
      pendingTitleFallback: "新バージョンの準備完了",
      pendingDescIde: "ウィンドウを再読み込みして適用",
      pendingDescDesktop: "Antigravity を再起動して適用",
      relaunchNowIde: "今すぐ再読込",
      relaunchNowDesktop: "今すぐ再起動",
      currentVersion: "現在バージョン: v{version}",
      lastCheckPrefix: "最終確認: {time}",
      lastCheckNever: "未確認",
      timeJustNow: "たった今",
      timeMinutesAgo: "{n} 分前",
      timeHoursAgo: "{n} 時間前",
      timeDaysAgo: "{n} 日前",
      checkUpdate: "更新を確認",
      checkingUpdate: "確認中...",
      checkingRelease: "GitHub Release を確認中...",
      upToDate: "最新バージョンです (v{version})",
      downloadedReady: "v{version} を取得しました（再起動で適用）",
      checkFailed: "確認失敗: {err}",
      stateReadFailed: "最終確認: 状態取得に失敗",
      networkError: "ネットワークエラー",
      autoUpdateTitle: "12時間ごとに自動確認",
      autoUpdateDesc: "バックグラウンドで更新を取得し再起動を通知します",
      enabled: "有効",
      disabled: "無効",
      mirrorTitle: "GitHub ミラー接頭辞",
      mirrorDesc: "空欄でシステムプロキシ直結、必要に応じてミラー接頭辞を入力",
      mirrorPlaceholder: "空欄で直結（例: https://gh-proxy.com/）",
      save: "保存",
      saved: "保存済み",
      copyDiag: "診断コピー",
      copied: "コピー完了",
      resetDefault: "初期化",
      close: "閉じる",
      uninstallBtn: "プラグインを削除",
      uninstallConfirmTitle: "「推論スライダー」を削除しますか？",
      uninstallConfirmDesc: "本プラグインのパッチとフォルダのみを削除します。他のプラグインや設定には影響しません。",
      cancel: "キャンセル",
      confirmUninstall: "削除する",
      uninstalling: "削除中...",
      uninstallFailed: "削除に失敗しました",
      uninstallError: "削除エラー: {err}",
      unknownError: "不明なエラー",
      updateToastTitle: "推論スライダー v{version} 準備完了",
      updateToastDescIde: "検証済みアップデートがあります。ウィンドウを再読み込みしてください。",
      updateToastDescDesktop: "検証済みアップデートがあります。Antigravity を再起動してください。",
      later: "後で",
      restartNow: "再起動",
      reloadNow: "再読み込み",
      reloading: "再読込中...",
      restarting: "再起動中...",
      uninstallToastTitle: "推論スライダーを削除しました",
      uninstallToastDescIde: "本プラグインのパッチとフォルダを削除しました。他のプラグインは維持されます。再読み込みで完了します。",
      uninstallToastDescDesktop: "本プラグインのパッチとフォルダを削除しました。他のプラグインは維持されます。再起動で完了します。"
    }),
    "ko": Object.freeze({
      sliderLabel: "추론 수준",
      panelTitle: "추론 슬라이더",
      panelAriaLabel: "추론 수준 슬라이더 설정",
      motionLabel: "애니메이션",
      motionFull: "전체",
      motionFullHint: "기본 · 부드러운 가속 + 별빛 효과",
      motionFast: "빠름",
      motionFastHint: "1/3 지점에서 즉시 전환 · ~70ms",
      motionQuick: "간결",
      motionQuickHint: "전환 효과 없이 즉시 이동",
      ticksLabel: "도달한 눈금 점",
      ticksHighlight: "밝게 표시",
      ticksHighlightHint: "기본 · 도달한 눈금 강조",
      ticksDim: "동일 색상",
      ticksDimHint: "모든 눈금을 반투명하게 유지",
      ticksHidden: "숨김",
      ticksHiddenHint: "눈금 점 숨기기",
      updateSectionTag: "버전 및 자동 업데이트",
      pendingTitle: "새 버전 v{version} 준비 완료",
      pendingTitleFallback: "새 버전 준비 완료",
      pendingDescIde: "창을 다시 로드하여 적용",
      pendingDescDesktop: "Antigravity를 재시작하여 적용",
      relaunchNowIde: "지금 다시 로드",
      relaunchNowDesktop: "지금 재시작",
      currentVersion: "현재 버전: v{version}",
      lastCheckPrefix: "마지막 확인: {time}",
      lastCheckNever: "확인 안 함",
      timeJustNow: "방금 전",
      timeMinutesAgo: "{n}분 전",
      timeHoursAgo: "{n}시간 전",
      timeDaysAgo: "{n}일 전",
      checkUpdate: "업데이트 확인",
      checkingUpdate: "확인 중...",
      checkingRelease: "GitHub Release 확인 중...",
      upToDate: "최신 버전입니다 (v{version})",
      downloadedReady: "v{version} 다운로드 완료 (재시작 시 적용)",
      checkFailed: "확인 실패: {err}",
      stateReadFailed: "마지막 확인: 상태 읽기 실패",
      networkError: "네트워크 오류",
      autoUpdateTitle: "12시간마다 자동 확인",
      autoUpdateDesc: "백그라운드에서 업데이트를 받고 재시작 알림을 표시합니다",
      enabled: "사용 중",
      disabled: "비활성",
      mirrorTitle: "GitHub 미러 접두사",
      mirrorDesc: "비워두면 시스템 프록시로 직접 연결됩니다 (예: https://gh-proxy.com/)",
      mirrorPlaceholder: "비워두면 직접 연결",
      save: "저장",
      saved: "저장됨",
      copyDiag: "진단 복사",
      copied: "복사됨",
      resetDefault: "초기화",
      close: "닫기",
      uninstallBtn: "플러그인 제거",
      uninstallConfirmTitle: "추론 슬라이더를 제거할까요?",
      uninstallConfirmDesc: "이 플러그인의 패치와 폴더만 제거하며 다른 설치된 플러그인과 설정에는 영향을 주지 않습니다.",
      cancel: "취소",
      confirmUninstall: "제거 확인",
      uninstalling: "제거 중...",
      uninstallFailed: "제거 실패",
      uninstallError: "제거 오류: {err}",
      unknownError: "알 수 없는 오류",
      updateToastTitle: "추론 슬라이더 v{version} 준비됨",
      updateToastDescIde: "검증된 업데이트가 준비되었습니다. 창을 다시 로드하세요.",
      updateToastDescDesktop: "검증된 업데이트가 준비되었습니다. Antigravity를 재시작하세요.",
      later: "나중에",
      restartNow: "재시작",
      reloadNow: "다시 로드",
      reloading: "다시 로드 중...",
      restarting: "재시작 중...",
      uninstallToastTitle: "추론 슬라이더가 제거되었습니다",
      uninstallToastDescIde: "플러그인 패치와 폴더를 제거했습니다. 다른 플러그인은 유지됩니다. 창을 다시 로드하면 완료됩니다.",
      uninstallToastDescDesktop: "플러그인 패치와 폴더를 제거했습니다. 다른 플러그인은 유지됩니다. 재시작하면 완료됩니다."
    }),
    "fr": Object.freeze({
      sliderLabel: "Effort de raisonnement",
      panelTitle: "Curseur d'effort",
      panelAriaLabel: "Paramètres du curseur d'effort",
      motionLabel: "Animation",
      motionFull: "Complète",
      motionFullHint: "Défaut · Fluide + éclat stellaire",
      motionFast: "Rapide",
      motionFastHint: "Seuil 1/3 · ~70 ms",
      motionQuick: "Minimale",
      motionQuickHint: "Instantané sans transition",
      ticksLabel: "Repères atteints",
      ticksHighlight: "Lumineux",
      ticksHighlightHint: "Défaut · Mettre en valeur",
      ticksDim: "Uniforme",
      ticksDimHint: "Tous les repères translucides",
      ticksHidden: "Masqué",
      ticksHiddenHint: "Masquer les repères",
      updateSectionTag: "Version & Mise à jour",
      pendingTitle: "Version v{version} prête",
      pendingTitleFallback: "Nouvelle version prête",
      pendingDescIde: "Recharger la fenêtre pour appliquer",
      pendingDescDesktop: "Redémarrer Antigravity pour appliquer",
      relaunchNowIde: "Recharger",
      relaunchNowDesktop: "Redémarrer",
      currentVersion: "Version : v{version}",
      lastCheckPrefix: "Vérifié : {time}",
      lastCheckNever: "Jamais",
      timeJustNow: "À l'instant",
      timeMinutesAgo: "Il y a {n} min",
      timeHoursAgo: "Il y a {n} h",
      timeDaysAgo: "Il y a {n} j",
      checkUpdate: "Vérifier",
      checkingUpdate: "En cours...",
      checkingRelease: "Vérification GitHub Release...",
      upToDate: "À jour (v{version})",
      downloadedReady: "v{version} prêt au redémarrage",
      checkFailed: "Échec : {err}",
      stateReadFailed: "Vérifié : erreur de lecture",
      networkError: "Erreur réseau",
      autoUpdateTitle: "Vérif. auto toutes les 12h",
      autoUpdateDesc: "Téléchargement silencieux en arrière-plan avec rappel",
      enabled: "Activé",
      disabled: "Désactivé",
      mirrorTitle: "Préfixe miroir GitHub",
      mirrorDesc: "Laisser vide pour connexion directe ; préfixe optionnel (ex. https://gh-proxy.com/)",
      mirrorPlaceholder: "Direct par défaut",
      save: "Enreg.",
      saved: "Enregistré",
      copyDiag: "Diagnostic",
      copied: "Copié",
      resetDefault: "Réinit.",
      close: "Fermer",
      uninstallBtn: "Désinstaller le plugin",
      uninstallConfirmTitle: "Désinstaller le curseur ?",
      uninstallConfirmDesc: "Supprime uniquement les patchs et fichiers de ce plugin sans affecter les autres extensions.",
      cancel: "Annuler",
      confirmUninstall: "Confirmer",
      uninstalling: "Suppression...",
      uninstallFailed: "Échec de désinstallation",
      uninstallError: "Erreur : {err}",
      unknownError: "Erreur inconnue",
      updateToastTitle: "Curseur d'effort v{version} prêt",
      updateToastDescIde: "Mise à jour vérifiée prête. Rechargez la fenêtre.",
      updateToastDescDesktop: "Mise à jour vérifiée prête. Redémarrez Antigravity.",
      later: "Plus tard",
      restartNow: "Redémarrer",
      reloadNow: "Recharger",
      reloading: "Rechargement...",
      restarting: "Redémarrage...",
      uninstallToastTitle: "Plugin désinstallé",
      uninstallToastDescIde: "Patchs et fichiers supprimés sans toucher aux autres plugins. Rechargez la fenêtre.",
      uninstallToastDescDesktop: "Patchs et fichiers supprimés sans toucher aux autres plugins. Redémarrez Antigravity."
    }),
    "ru": Object.freeze({
      sliderLabel: "Уровень рассуждения",
      panelTitle: "Слайдер усилий",
      panelAriaLabel: "Настройки слайдера усилий",
      motionLabel: "Анимация",
      motionFull: "Полная",
      motionFullHint: "По умолчанию · Плавный ход + звёзды",
      motionFast: "Быстрая",
      motionFastHint: "Порог 1/3 · ~70 мс",
      motionQuick: "Простая",
      motionQuickHint: "Мгновенно без перехода",
      ticksLabel: "Пройденные деления",
      ticksHighlight: "Яркие",
      ticksHighlightHint: "По умолчанию · Подсветка пройденных",
      ticksDim: "Обычные",
      ticksDimHint: "Все деления полупрозрачные",
      ticksHidden: "Скрыты",
      ticksHiddenHint: "Скрыть все деления",
      updateSectionTag: "Версия и обновления",
      pendingTitle: "Версия v{version} готова",
      pendingTitleFallback: "Новая версия готова",
      pendingDescIde: "Перезагрузите окно для применения",
      pendingDescDesktop: "Перезапустите Antigravity",
      relaunchNowIde: "Перезагрузить",
      relaunchNowDesktop: "Перезапустить",
      currentVersion: "Версия: v{version}",
      lastCheckPrefix: "Проверка: {time}",
      lastCheckNever: "Никогда",
      timeJustNow: "Только что",
      timeMinutesAgo: "{n} мин назад",
      timeHoursAgo: "{n} ч назад",
      timeDaysAgo: "{n} дн назад",
      checkUpdate: "Проверить",
      checkingUpdate: "Проверка...",
      checkingRelease: "Проверка GitHub Release...",
      upToDate: "Актуально (v{version})",
      downloadedReady: "v{version} скачана, нужен перезапуск",
      checkFailed: "Ошибка: {err}",
      stateReadFailed: "Проверка: ошибка чтения",
      networkError: "Ошибка сети",
      autoUpdateTitle: "Автопроверка каждые 12 ч",
      autoUpdateDesc: "Тихая загрузка обновлений в фоне с уведомлением",
      enabled: "Вкл",
      disabled: "Выкл",
      mirrorTitle: "Зеркало GitHub",
      mirrorDesc: "Оставьте пустым для прямого подключения (или напр. https://gh-proxy.com/)",
      mirrorPlaceholder: "По умолчанию напрямую",
      save: "Сохр.",
      saved: "Сохранено",
      copyDiag: "Диагностика",
      copied: "Скопировано",
      resetDefault: "Сброс",
      close: "Закрыть",
      uninstallBtn: "Удалить плагин",
      uninstallConfirmTitle: "Удалить слайдер усилий?",
      uninstallConfirmDesc: "Удалит только файлы и патчи этого плагина, не затрагивая другие установленные плагины.",
      cancel: "Отмена",
      confirmUninstall: "Удалить",
      uninstalling: "Удаление...",
      uninstallFailed: "Ошибка удаления",
      uninstallError: "Сбой: {err}",
      unknownError: "Неизвестная ошибка",
      updateToastTitle: "Слайдер v{version} готов",
      updateToastDescIde: "Обновление проверено. Перезагрузите окно.",
      updateToastDescDesktop: "Обновление проверено. Перезапустите Antigravity.",
      later: "Позже",
      restartNow: "Перезапуск",
      reloadNow: "Перезагрузить",
      reloading: "Загрузка...",
      restarting: "Перезапуск...",
      uninstallToastTitle: "Плагин удалён",
      uninstallToastDescIde: "Файлы и патчи удалены, другие плагины сохранены. Перезагрузите окно.",
      uninstallToastDescDesktop: "Файлы и патчи удалены, другие плагины сохранены. Перезапустите Antigravity."
    })
  });

  function t(locale, key, vars) {
    var dict = I18N_MESSAGES[locale] || I18N_MESSAGES.en;
    var text = (dict && dict[key]) || (I18N_MESSAGES.en && I18N_MESSAGES.en[key]) || String(key);
    if (vars && typeof vars === "object") {
      var keys = Object.keys(vars);
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        text = text.split("{" + k + "}").join(String(vars[k]));
      }
    }
    return text;
  }

  // ── 常量与默认几何参数 ──────────────────────────────────────────────────────
  var PLUGIN_VERSION = "1.5.1";
  var STYLE_ELEMENT_ID = "ag-codex-effort-slider-styles";
  var TRACK_HEIGHT = 28;
  var KNOB_SIZE = 28;
  var KNOB_RADIUS = KNOB_SIZE / 2;

  // Antigravity 默认三档模型 (Low / Medium / High) 无 Off 档，因此能量起点为 0、中点为 0.5；
  // 若遇到首档为 Off 的四档模型 (Off / Low / High / Max)，energyStopsFor 会自动返回 { start: 1/3, end: 2/3 }。
  var ENERGY_START = 0;
  var ENERGY_END = 0.5;
  var MIN_HEIGHT_SLOTS = 3;

  // Antigravity 官方推理档位枚举与展示名映射
  var AG_EFFORT_ORDER = ["off", "low", "medium", "high", "xhigh", "max"];
  var AG_EFFORT_LABELS = {
    off: "Off",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra",
    max: "Max"
  };
  var AG_MODEL_LABEL_RE = /^(.*?)\s*\((off|low|medium|high|xhigh|extra\s+high|extra|max)(?:\s+thinking)?\)\s*$/i;
  var AG_DISPLAY_EFFORT_RE = /^(.*?)\s+(off|low|medium|high|xhigh|extra\s+high|extra|max)$/i;

  // Claude 专属主题常量（6×60 点阵、1.6s 从右至左扫掠、Capsule 胶囊滑块）
  var CLAUDE_CELL = 28 / 6; // ≈ 4.67px
  var CLAUDE_ROWS = 6;
  var CLAUDE_SWEEP_MS = 1600;
  var CLAUDE_KNOB_W = 24;
  var CLAUDE_KNOB_H = 30;
  var CLAUDE_KNOB_R = 7;

  function isClaudeModel(name) {
    if (!name || typeof name !== "string") return false;
    return /claude/i.test(name);
  }

  // ── 连续物理运动参数 ────────────────────────────────────────────────────────
  // full: 完整星云阻尼变速动画（默认）；fast: 快速 ~70ms 跟手吸附；quick: 0 动画直接跳格
  var MOTION = Object.freeze({
    maxSpeed: 3.2,
    accel: 28,
    decel: 18,
    snapEps: 0.0015,
    velEps: 0.01
  });

  var MOTION_REDUCED = Object.freeze({
    maxSpeed: 1e6,
    accel: 1e9,
    decel: 1e9,
    snapEps: 1e-4,
    velEps: 1e6
  });

  var MOTION_FAST = Object.freeze({
    maxSpeed: 18,
    accel: 260,
    decel: 180,
    snapEps: 0.002,
    velEps: 0.04
  });

  var RELEASE_PROJECT_S = 0.09;
  var POINTER_SPEED_EMA = 0.45;
  var POINTER_STALE_S = 0.05;
  var POINTER_SPEED_TAU = 0.035;
  var DRAG_THRESHOLD_PX = 3;

  // ── 用户设置 Schema 与持久化 ────────────────────────────────────────────────
  var SETTINGS_KEY = "ag.codexEffortSlider.settings.v1";
  var SETTINGS_EVENT = "ag:codex-effort-slider:settings";
  var SETTINGS_VERSION = 1;

  var SETTINGS_SCHEMA = Object.freeze([
    Object.freeze({
      key: "motion",
      label: "动画效果",
      defaultValue: "full",
      options: Object.freeze([
        Object.freeze({ value: "full", label: "完整动画", hint: "默认 · 匀变速追赶 + 星尘渐亮" }),
        Object.freeze({ value: "fast", label: "快速动画", hint: "拨过 1/3 即切档 · ~70ms 快速吸附" }),
        Object.freeze({ value: "quick", label: "简洁动画", hint: "无过渡 · 直接跳档" })
      ])
    }),
    Object.freeze({
      key: "ticks",
      label: "已到达档位的刻度点",
      defaultValue: "highlight",
      options: Object.freeze([
        Object.freeze({ value: "highlight", label: "亮白显示", hint: "默认 · 已滑过档位高亮" }),
        Object.freeze({ value: "dim", label: "与未到达同色", hint: "所有刻度点保持柔和半透明" }),
        Object.freeze({ value: "hidden", label: "隐藏", hint: "不显示任何刻度点" })
      ])
    })
  ]);

  function schemaDefaults() {
    var out = { v: SETTINGS_VERSION };
    for (var i = 0; i < SETTINGS_SCHEMA.length; i += 1) {
      var item = SETTINGS_SCHEMA[i];
      out[item.key] = item.defaultValue;
    }
    return out;
  }

  function normalizeSettings(raw) {
    var base = schemaDefaults();
    if (!raw || typeof raw !== "object") return base;
    for (var i = 0; i < SETTINGS_SCHEMA.length; i += 1) {
      var item = SETTINGS_SCHEMA[i];
      var candidate = raw[item.key];
      var matched = false;
      for (var j = 0; j < item.options.length; j += 1) {
        if (item.options[j].value === candidate) {
          matched = true;
          break;
        }
      }
      if (matched) base[item.key] = candidate;
    }
    return base;
  }

  function resolveStorage(win) {
    var w = win || (typeof window !== "undefined" ? window : globalRoot);
    try {
      if (w && w.localStorage) return w.localStorage;
    } catch (err) {
      // 沙箱或隐私上下文禁用 localStorage 时降级为内存模式
    }
    return null;
  }

  function readSettings(win) {
    var store = resolveStorage(win);
    if (!store) return schemaDefaults();
    try {
      var text = store.getItem(SETTINGS_KEY);
      if (!text) return schemaDefaults();
      return normalizeSettings(JSON.parse(text));
    } catch (err) {
      return schemaDefaults();
    }
  }

  function writeSettings(patch, win, options) {
    var w = win || (typeof window !== "undefined" ? window : globalRoot);
    var opts = options || {};
    var current = readSettings(w);
    var merged = Object.assign({}, current, patch || {});
    var next = normalizeSettings(merged);
    var store = resolveStorage(w);
    if (store) {
      try {
        store.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch (err) {
        // 忽略配额或权限异常
      }
    }
    try {
      if (w && typeof w.dispatchEvent === "function" && typeof w.CustomEvent === "function") {
        var detail = Object.assign({}, next, { __fromRemote: Boolean(opts.fromRemote) });
        w.dispatchEvent(new w.CustomEvent(SETTINGS_EVENT, { detail: detail }));
      }
    } catch (err) {
      // 忽略无 CustomEvent 构造器的测试环境
    }
    return next;
  }

  function resetSettings(win, options) {
    return writeSettings(schemaDefaults(), win, options);
  }

  function onSettingsChange(listener, win) {
    var w = win || (typeof window !== "undefined" ? window : globalRoot);
    if (!w || typeof w.addEventListener !== "function") return function () {};
    function handleCustom(ev) {
      listener(ev && ev.detail ? normalizeSettings(ev.detail) : readSettings(w));
    }
    function handleStorage(ev) {
      if (!ev || ev.key !== SETTINGS_KEY) return;
      listener(readSettings(w));
    }
    w.addEventListener(SETTINGS_EVENT, handleCustom);
    w.addEventListener("storage", handleStorage);
    return function () {
      w.removeEventListener(SETTINGS_EVENT, handleCustom);
      w.removeEventListener("storage", handleStorage);
    };
  }

  function prefersReducedMotion(win) {
    var w = win || (typeof window !== "undefined" ? window : globalRoot);
    try {
      if (w && typeof w.matchMedia === "function") {
        var mq = w.matchMedia("(prefers-reduced-motion: reduce)");
        if (mq && mq.matches) return true;
      }
    } catch (err) {
      // 忽略不支持 matchMedia 的环境
    }
    return false;
  }

  function motionMode(win, explicitSettings) {
    if (prefersReducedMotion(win)) return "quick";
    var s = explicitSettings ? normalizeSettings(explicitSettings) : readSettings(win);
    return s.motion || "full";
  }

  function motionParamsForMode(mode) {
    if (mode === "quick") return MOTION_REDUCED;
    if (mode === "fast") return MOTION_FAST;
    return MOTION;
  }

  // ── 诊断环形缓冲区 ──────────────────────────────────────────────────────────
  var TRACE_CAPACITY = 200;
  var traceRingBuffer = [];

  function tracePush(type, detail) {
    var entry = { t: Date.now(), type: String(type || "event") };
    if (detail && typeof detail === "object") {
      var keys = Object.keys(detail);
      for (var i = 0; i < keys.length; i += 1) {
        entry[keys[i]] = detail[keys[i]];
      }
    }
    traceRingBuffer.push(entry);
    if (traceRingBuffer.length > TRACE_CAPACITY) {
      traceRingBuffer.splice(0, traceRingBuffer.length - TRACE_CAPACITY);
    }
  }

  function dumpTrace(win) {
    var w = win || (typeof window !== "undefined" ? window : globalRoot);
    return {
      plugin: "antigravity-codex-effort-slider@" + PLUGIN_VERSION,
      time: new Date().toISOString(),
      ua: w && w.navigator ? w.navigator.userAgent : "node",
      settings: readSettings(w),
      events: traceRingBuffer.slice()
    };
  }

  function traceClear() {
    traceRingBuffer.length = 0;
  }

  // ── 数学、物理与刻度换算 ────────────────────────────────────────────────────
  function clamp01(value) {
    var num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    if (num >= 1) return 1;
    return num;
  }

  function clampAbs(value, limit) {
    var lim = Math.max(0, Number(limit) || 0);
    var num = Number(value) || 0;
    if (num > lim) return lim;
    if (num < -lim) return -lim;
    return num;
  }

  function pctFromIndex(index, count) {
    var n = Number(count) || 0;
    if (n <= 1) return 0;
    var idx = Math.max(0, Math.min(n - 1, Math.round(Number(index) || 0)));
    return idx / (n - 1);
  }

  function indexFromPct(pct, count) {
    var n = Number(count) || 0;
    if (n <= 1) return 0;
    var p = clamp01(pct);
    return Math.max(0, Math.min(n - 1, Math.round(p * (n - 1))));
  }

  /**
   * 迟滞棘轮分档器（Hysteresis Detent）：
   * - 向新档位方向推进过 1/3 格宽即刻触发跳档，保证「拖过边界立即切档」的轻快手感；
   * - 往回退则需要退过 2/3 格宽（留出 [1/3, 2/3] 迟滞带），防止手指停在边界附近时左右抖动。
   */
  function detentTargetIndex(currentIndex, ptrPct, count) {
    var n = Number(count) || 0;
    if (n <= 1) return 0;
    var p = clamp01(ptrPct);
    if (typeof currentIndex !== "number" || currentIndex < 0 || currentIndex >= n) {
      return indexFromPct(p, n);
    }
    var step = 1 / (n - 1);
    var forwardThreshold = 1 / 3;
    var idx = currentIndex;
    var curCenter = idx * step;
    if (p >= curCenter) {
      while (idx < n - 1 && p >= (idx + forwardThreshold) * step - 1e-9) {
        idx += 1;
      }
    } else {
      while (idx > 0 && p <= (idx - forwardThreshold) * step + 1e-9) {
        idx -= 1;
      }
    }
    return idx;
  }

  function knobOffsetOf(pct, radiusPx) {
    var p = clamp01(pct);
    var r = typeof radiusPx === "number" && Number.isFinite(radiusPx) ? radiusPx : KNOB_RADIUS;
    return "calc(" + r + "px + (100% - " + (r * 2) + "px) * " + p + ")";
  }

  function motionSettled(state, params) {
    if (!state) return true;
    var cfg = params || MOTION;
    var dist = Math.abs((Number(state.target) || 0) - (Number(state.x) || 0));
    var vel = Math.abs(Number(state.v) || 0);
    return dist <= cfg.snapEps && vel <= cfg.velEps;
  }

  /**
   * 连续物理步进器：基于刹车距离 v^2 / (2 * decel) 平滑追赶 target，无过冲回弹
   */
  function motionStep(state, dtSeconds, params) {
    if (!state) return;
    var cfg = params || MOTION;
    var dt = Number(dtSeconds);
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (dt > 0.05) dt = 0.05;

    var target = clamp01(state.target);
    var x = clamp01(state.x);
    var v = Number(state.v) || 0;
    var diff = target - x;
    var dist = Math.abs(diff);

    if (dist <= cfg.snapEps && Math.abs(v) <= cfg.velEps) {
      state.x = target;
      state.v = 0;
      state.a = 0;
      return;
    }

    var dir = diff >= 0 ? 1 : -1;
    var movingTowards = v * dir >= 0;
    var stopDist = (v * v) / (2 * cfg.decel);
    var a = 0;

    if (!movingTowards) {
      a = dir * cfg.accel;
    } else if (stopDist >= dist) {
      a = -dir * cfg.decel;
    } else {
      a = dir * cfg.accel;
    }

    var nextV = clampAbs(v + a * dt, cfg.maxSpeed);
    var nextX = x + nextV * dt;

    // 防止单步跨越目标造成振荡
    if ((target - x) * (target - nextX) <= 0 && Math.abs(nextV) <= cfg.maxSpeed) {
      state.x = target;
      state.v = 0;
      state.a = 0;
      return;
    }

    if (nextX <= 0) {
      state.x = 0;
      state.v = Math.max(0, nextV);
      state.a = a;
      return;
    }
    if (nextX >= 1) {
      state.x = 1;
      state.v = Math.min(0, nextV);
      state.a = a;
      return;
    }

    state.x = nextX;
    state.v = nextV;
    state.a = a;
  }

  function decayPointerSpeed(rawSpeed, idleSeconds) {
    var v = Number(rawSpeed) || 0;
    var idle = Number(idleSeconds) || 0;
    if (idle <= POINTER_STALE_S) return v;
    var decay = Math.exp(-(idle - POINTER_STALE_S) / POINTER_SPEED_TAU);
    var out = v * decay;
    return Math.abs(out) < 1e-4 ? 0 : out;
  }

  function releaseIndexFor(ptrPct, rawSpeed, idleSeconds, count) {
    var v = decayPointerSpeed(rawSpeed, idleSeconds);
    var projected = clamp01((Number(ptrPct) || 0) + v * RELEASE_PROJECT_S);
    return indexFromPct(projected, count);
  }

  // ── 22 颗黄金分割确定性星尘与色彩引擎（右向左横穿星空） ──────────────────────
  var PARTICLE_COUNT = 22;
  var STARFIELD_DURATION_MEAN = 1.5;
  var STARFIELD_DURATION_SPREAD = 0.08;
  var STARFIELD_MIN = 0.5;
  var GOLDEN_RATIO = 0.6180339887498949;
  var MAX_SPEED_FACTOR = 2;
  var REDUCED_MOTION_SLOWDOWN = 2.6;

  /** 确定性伪随机 [0,1)：不用 Math.random，每次渲染完全一致且可离线断言 */
  function starHash01(index, salt) {
    var value = ((index + 1) * (salt || 1) * 2654435761) % 4294967296;
    return ((value >>> 8) % 1000) / 1000;
  }

  /**
   * 22 颗星尘粒子（形态 = 3px 圆点；运动 = 从右向左连续横穿已填充轨道，不消失、不上下飘动）：
   * - 相位：黄金比低差异序列（任意前缀均匀铺开）
   * - 高度：与相位排名解耦的确定性哈希排列，且相位相邻两星高度至少差 MIN_HEIGHT_SLOTS 槽
   */
  var PARTICLES = (function buildParticles() {
    var count = PARTICLE_COUNT;
    var minSlots = MIN_HEIGHT_SLOTS;
    var out = [];
    var i;
    for (i = 0; i < count; i += 1) {
      var b = STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(i, 61);
      out.push({
        id: i,
        y: 0,
        phase: ((i + 1) * GOLDEN_RATIO) % 1,
        threshold: i / count,
        brightness: Math.round(b * 1000) / 1000
      });
    }
    var byPhase = [];
    for (i = 0; i < count; i += 1) byPhase.push(i);
    byPhase.sort(function (a, b) {
      return out[a].phase - out[b].phase;
    });
    var slots = null;
    for (var salt = 71; salt < 4000 && slots === null; salt += 1) {
      var candidate = [];
      for (i = 0; i < count; i += 1) candidate.push(i);
      candidate.sort(function (a, b) {
        var ha = starHash01(a, salt);
        var hb = starHash01(b, salt);
        return ha === hb ? a - b : ha - hb;
      });
      var ok = true;
      for (var k = 1; k < count && ok; k += 1) {
        if (Math.abs(candidate[k] - candidate[k - 1]) < minSlots) ok = false;
      }
      if (ok) slots = candidate;
    }
    if (slots === null) {
      slots = [];
      for (i = 0; i < count; i += 1) slots.push((i * 5) % count);
    }
    for (var rank = 0; rank < count; rank += 1) {
      var yVal = 8 + (slots[rank] / (count - 1)) * 84;
      out[byPhase[rank]].y = Math.round(yVal * 100) / 100;
    }
    for (i = 0; i < count; i += 1) {
      Object.freeze(out[i]);
    }
    return Object.freeze(out);
  })();

  function isOffLevel(text) {
    if (text === null || text === undefined) return false;
    if (typeof text === "object") {
      return isOffLevel(text.id || text.name || text.effort || text.label || "");
    }
    var s = String(text).trim().toLowerCase();
    if (!s) return false;
    return (
      s === "off" ||
      s === "none" ||
      s === "disabled" ||
      s === "0" ||
      s === "关闭" ||
      s === "关" ||
      s === "不推理" ||
      s === "无"
    );
  }

  /* ── Claude Ultracode 像素点阵抖动引擎 ──────────────────────────────── */
  function hash01(a, b, c) {
    var h = (a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 1274126177;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 100000) / 100000;
  }

  function ditherAlphaAt(x, w, col, row) {
    var t = clamp01(x / Math.max(1, w));
    var ramp = 0.92 + 0.08 * t;
    var jitter = 0.25 + 0.75 * hash01(col, row, 7);
    return clamp01(ramp * jitter);
  }

  function fillRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function valueNoise(col, row, timeSec, speed, seed) {
    var tt = timeSec * speed + hash01(col, row, seed) * 17;
    var step = Math.floor(tt);
    var f = tt - step;
    var e = f * f * (3 - 2 * f);
    var a = hash01(col, row, (step % 997) + seed * 11);
    var b = hash01(col, row, ((step + 1) % 997) + seed * 11);
    return a + (b - a) * e;
  }

  var mergeCache = null;
  var mergeCacheKey = "";
  function getMergeMap(cols, rows) {
    var key = cols + "x" + rows;
    if (mergeCache && mergeCacheKey === key) return mergeCache;
    var map = new Uint8Array(cols * rows);
    for (var r = 0; r < rows; r += 1) {
      for (var c = 0; c < cols; c += 1) {
        var i = r * cols + c;
        if (map[i]) continue;
        var h = hash01(c, r, 91);
        if (h < 0.02 && c + 1 < cols && r + 1 < rows && !map[i + 1] && !map[i + cols] && !map[i + cols + 1]) {
          map[i] = 1; map[i + 1] = 2; map[i + cols] = 2; map[i + cols + 1] = 2;
        } else if (h < 0.06 && c + 1 < cols && !map[i + 1]) {
          map[i] = 3; map[i + 1] = 2;
        } else if (h < 0.08 && r + 1 < rows && !map[i + cols]) {
          map[i] = 4; map[i + cols] = 2;
        }
      }
    }
    mergeCache = map;
    mergeCacheKey = key;
    return map;
  }

  function surfaceIsDark(win, doc) {
    try {
      var d = doc || (typeof document !== "undefined" ? document : null);
      var w = win || (typeof window !== "undefined" ? window : globalRoot);
      if (!d || !d.body || !w) return true;
      if (d.documentElement && d.documentElement.classList.contains("dark")) return true;
      if (d.body && d.body.classList.contains("dark")) return true;
      var bg = (w.getComputedStyle && w.getComputedStyle(d.body).backgroundColor) || "";
      var parts = bg.match(/[\d.]+/g);
      if (!parts || parts.length < 3) return true;
      if (parts.length > 3 && Number(parts[3]) < 0.5) return true;
      var luminance = (0.2126 * Number(parts[0]) + 0.7152 * Number(parts[1]) + 0.0722 * Number(parts[2])) / 255;
      return luminance < 0.5;
    } catch (err) {
      return true;
    }
  }

  /**
   * Claude 点阵绘制。intensity ∈ [0,1] 连续控制特效强度（中档约 0.35，最高档 1）：
   * - 底晕 wash 透明度按 intensity 缩放；
   * - 像素密度：按每格固定哈希做确定性稀疏剔除，intensity 越低保留越少（不会随帧闪烁）；
   * - 像素亮度：整体 alpha 乘以 (0.45 + 0.55 * intensity)。
   * intensity = 1 时三项系数均为 1，输出与旧版完全一致。
   */
  function paintDither(ctx, w, h, dark, progress, timeSec, intensity) {
    if (!ctx) return;
    var strength = typeof intensity === "number" ? clamp01(intensity) : 1;
    ctx.clearRect(0, 0, w, h);
    if (strength <= 0 || w <= 0) return;
    // 密度阈值：strength=1 → 1.0（全保留）；strength=0.35 → ~0.51（约一半格子）
    var keepRatio = strength >= 1 ? 1 : 0.25 + 0.75 * strength;
    var alphaMul = 0.45 + 0.55 * strength;
    var k = 1 - progress;
    var s1 = Math.max(0, Math.min(1, k - 0.08));
    var s2 = Math.max(s1, Math.min(1, k + 0.18));
    var wash = ctx.createLinearGradient(0, 0, w, 0);
    if (dark) {
      wash.addColorStop(0, "rgba(112, 78, 162, 0)");
      wash.addColorStop(s1, "rgba(112, 78, 162, 0)");
      wash.addColorStop(s2, "rgba(118, 84, 169, 0.3)");
      wash.addColorStop(1, "rgba(116, 84, 170, 0.75)");
    } else {
      wash.addColorStop(0, "rgba(142, 118, 192, 0)");
      wash.addColorStop(s1, "rgba(142, 118, 192, 0)");
      wash.addColorStop(s2, "rgba(142, 118, 192, 0.45)");
      wash.addColorStop(1, "rgba(142, 118, 192, 1)");
    }
    ctx.globalAlpha = strength;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    var purple = dark ? [208, 192, 246] : [150, 130, 205];
    var rows = CLAUDE_ROWS;
    var cell = h / rows > 0 ? h / rows : CLAUDE_CELL;
    var cols = Math.ceil(w / cell);

    for (var col = 0; col < cols; col += 1) {
      var x = col * cell;
      var t = clamp01(x / Math.max(1, w));
      var fade = clamp01((t - 0.02) / 0.48);
      for (var row = 0; row < rows; row += 1) {
        // 确定性稀疏：同一格在同一强度下始终同样保留/剔除，避免拖动时整片闪烁
        if (keepRatio < 1 && hash01(col, row, 101) > keepRatio) continue;
        var base = ditherAlphaAt(x, w, col, row) * alphaMul;
        if (base < 0.05) continue;
        var front = 1 - progress;
        var edgeJit = (hash01(col, row, 31) - 0.5) * 0.05;
        if (t < front + edgeJit) continue;
        var appear = (0.35 + 0.65 * clamp01((t - front - edgeJit) / 0.04)) * (dark ? 1 : alphaMul);

        var rowWaves = 3 + Math.floor(hash01(0, row, 47) * 5);
        var rowSpeed = 5.0 + 10.0 * hash01(0, row, 43);
        var rowPhase = hash01(0, row, 53) * Math.PI * 2;
        var rowWaves2 = 2 + Math.floor(hash01(0, row, 61) * 4);
        var rowSpeed2 = rowSpeed * (rowWaves2 / rowWaves);
        var rowPhase2 = hash01(0, row, 71) * Math.PI * 2;

        var u1 = ((t * rowWaves * Math.PI * 2 + timeSec * rowSpeed + rowPhase) / (Math.PI * 2)) % 1;
        if (u1 < 0) u1 += 1;
        var u2 = ((t * rowWaves2 * Math.PI * 2 + timeSec * rowSpeed2 + rowPhase2) / (Math.PI * 2)) % 1;
        if (u2 < 0) u2 += 1;

        var p1 = Math.pow(1 - u1, 2.6 + 3.4 * hash01(col, row, 17));
        var p2 = Math.pow(1 - u2, 3.4);
        var pulse = Math.max(p1, p2 * (0.55 + 0.45 * hash01(col, row, 19))) * 0.85;

        if (!dark) {
          var lt = clamp01((t - 0.05) / 0.2);
          if (lt <= 0) continue;
          var lmap = getMergeMap(cols, rows);
          var mi = row * cols + col;
          var mv = lmap[mi];
          if (mv === 2) continue;
          if (hash01(col, row, 95) < 0.03) continue;
          var wide = mv === 3 || mv === 1;
          var tall = mv === 4 || mv === 1;
          var y2 = row * cell;
          var u = hash01(col, row, 93);
          var sp = 22 + 66 * t;
          var off = (u - 0.42) * sp;
          if (off > 0) off *= 1.1;
          var br = 187 - 32 * t;
          var bg = 184 - 46 * t;
          var bb = 206 + 4 * t;
          var lr = br + off;
          var lg = bg + (off < 0 ? off : off * 1.05);
          var lb = bb + (off < 0 ? off : off * 0.65);
          lr = Math.max(124, Math.min(240, Math.round(lr + 12 * pulse)));
          lg = Math.max(100, Math.min(232, Math.round(lg + 12 * pulse)));
          lb = Math.max(180, Math.min(252, Math.round(lb + 8 * pulse)));
          var lw = cell * (wide ? 2 : 1) * 0.88;
          var lh = cell * (tall ? 2 : 1) * 0.88;
          var flicker = valueNoise(col, row, timeSec, 0.9, 83);
          var density = clamp01((t - 0.12) / 0.35);
          var threshold = 0.2 + 0.8 * density;
          var presence = density > 0.9 ? 1 : clamp01((threshold - flicker) / 0.2);
          if (presence <= 0.01) continue;
          var lAlpha = clamp01(lt * appear * presence * (0.7 + 0.3 * (1 - flicker)) * (0.85 + 0.15 * hash01(col, row, 29)));
          ctx.globalAlpha = lAlpha;
          ctx.fillStyle = "rgb(" + lr + "," + lg + "," + lb + ")";
          fillRoundRect(ctx, x + 0.5, y2 + 0.5, lw, lh, 1);
          // 流光脉冲是点阵“流动”的唯一来源：亮度不随强度衰减（中档只靠点更少、底色更淡、速度更慢来区分）
          var whiteAmt = clamp01(pulse * (0.35 + 0.65 * t)) * (0.55 + 0.45 * hash01(col, row, 71));
          if (progress < 0.999) {
            var flash = clamp01(1 - (t - front) / 0.16) * (0.55 + 0.45 * hash01(col, row, 73));
            whiteAmt = Math.max(whiteAmt, flash);
          }
          if (whiteAmt > 0.03) {
            // 除回 alphaMul，让高光核心亮度与 High 一致
            ctx.globalAlpha = Math.min(1, (lAlpha / alphaMul) * (0.12 + 0.88 * whiteAmt));
            ctx.fillStyle = "rgb(247, 243, 255)";
            var ins = lw * 0.14;
            fillRoundRect(ctx, x + 0.5 + ins, y2 + 0.5 + ins, lw - ins * 2, lh - ins * 2, 0.7);
          }
          continue;
        }

        var flick = valueNoise(col, row, timeSec, 1.5, 5);
        var gap = 0.6 + 0.4 * clamp01((flick - (1 - fade) * 0.5) / 0.3);
        var vis = clamp01((t - 0.2) / 0.18);
        var ghost = 0.06 * clamp01((flick - 0.5) / 0.5) * (1 - vis);
        var baseAlpha = 0.04 + 0.96 * vis + ghost;
        var gridAlpha = clamp01(base * baseAlpha * gap * appear * 1.15 * (0.9 + 0.1 * hash01(col, row, 29)));
        if (gridAlpha < 0.008) continue;
        var y = row * cell;
        var size = cell * 0.72;
        ctx.globalAlpha = Math.min(1, gridAlpha * 0.55);
        ctx.fillStyle = "rgb(" + purple[0] + "," + purple[1] + "," + purple[2] + ")";
        fillRoundRect(ctx, x + 0.5, y + 0.5, size, size, 1.1);

        // 同浅色模式：流光亮度不随强度衰减
        var whiteAmtDark = clamp01(pulse * (0.35 + 0.65 * t)) * (0.55 + 0.45 * hash01(col, row, 71));
        if (progress < 0.999) {
          var flashDark = clamp01(1 - (t - front) / 0.16) * (0.55 + 0.45 * hash01(col, row, 73));
          whiteAmtDark = Math.max(whiteAmtDark, flashDark);
        }
        if (whiteAmtDark > 0.03) {
          ctx.globalAlpha = Math.min(1, (gridAlpha / alphaMul) * (0.1 + 0.72 * whiteAmtDark));
          ctx.fillStyle = "rgb(220, 204, 255)";
          fillRoundRect(ctx, x + 0.5, y + 0.5, size, size, 0.7);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 根据档位列表自动推导能量起点与中点：
   * - 若首档为 Off（如 4 档 Off / Low / High / Max），则第 1 档 (Low) 为纯蓝无星尘起点：
   *   start = 1 / (count - 1), end = (start + 1) / 2
   * - 若首档不是 Off（如 Antigravity 的 3 档 Low / Medium / High），则第 0 档 (Low) 为纯蓝起点：
   *   start = 0, end = 0.5
   */
  function energyStopsFor(levels) {
    var list = Array.isArray(levels) ? levels : [];
    var n = list.length;
    if (n <= 1) return { start: 0, end: 0.5, hasOffFirst: false };
    var first = list[0];
    var firstLabel = first && typeof first === "object" ? (first.effort || first.label || first.id || "") : String(first || "");
    var hasOffFirst = isOffLevel(firstLabel);
    var start = hasOffFirst ? 1 / (n - 1) : 0;
    var end = (start + 1) / 2;
    return { start: start, end: end, hasOffFirst: hasOffFirst };
  }

  function energyForPct(pct, startOverride) {
    var p = clamp01(pct);
    var start = typeof startOverride === "number" && Number.isFinite(startOverride) ? clamp01(startOverride) : ENERGY_START;
    if (p <= start || start >= 1) return 0;
    return clamp01((p - start) / (1 - start));
  }

  /**
   * 位置 → 粒子横穿速率倍数：
   * Medium (energy=0.5) 对应 1×（约 3.0s 横穿），High/Max (energy=1.0) 对应 2×（约 1.5s 横穿），左端下限 0.35×
   */
  function speedFor(pct, startOverride) {
    var e = energyForPct(pct, startOverride);
    return Math.min(MAX_SPEED_FACTOR, Math.max(0.35, 2 * e));
  }

  /**
   * Claude 点阵特效强度（随位置连续变化，与 Codex 能量曲线同源）：
   * energy=0 (Low) → 0 无特效；energy=0.5 (Medium) → ≈0.35 少量点阵；energy=1 (High) → 1 全量。
   * 采用 e^1.5 曲线：低端起势柔和，靠近 High 时加速饱和。
   */
  function claudeIntensityFor(pct, startOverride) {
    var e = energyForPct(pct, startOverride);
    if (e <= 0) return 0;
    return Math.round(Math.pow(e, 1.5) * 1000) / 1000;
  }

  /**
   * Claude 点阵流动速度倍率（以 High = 1 为基准）：Medium = 0.5（慢一倍），下限 0.175。
   * 直接复用 Codex 的 speedFor（Medium 1× / High 2×）再除以 2 归一化。
   */
  function claudeSpeedFor(pct, startOverride) {
    return speedFor(pct, startOverride) / MAX_SPEED_FACTOR;
  }

  /** 位置 → 可见粒子数量（随能量从 0 渐增至 22 颗） */
  function particleCountFor(pct, startOverride) {
    return Math.round(energyForPct(pct, startOverride) * PARTICLES.length);
  }

  function starCountFor(pct, startOverride) {
    return particleCountFor(pct, startOverride);
  }

  /**
   * 第 index 颗粒子的亮度/大小系数（落在 [STARFIELD_MIN, 1]，越亮越大）：
   * - 单参数调用 starBrightnessFor(indexOrStar)：返回该星固有亮度 [0.5, 1]
   * - 双参数调用 starBrightnessFor(starOrIndex, energy)：当 energy 尚未达到该星出现序号时返回 0，已出现则返回固有亮度
   */
  function starBrightnessFor(starOrIndex, energy) {
    var idx = typeof starOrIndex === "number"
      ? starOrIndex
      : (starOrIndex && typeof starOrIndex.id === "number" ? starOrIndex.id : 0);
    var baseB = STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(idx, 61);
    if (energy === undefined) {
      return Math.round(baseB * 1000) / 1000;
    }
    var e = clamp01(energy);
    var visibleCount = Math.round(e * PARTICLES.length);
    if (e <= 0 || idx >= visibleCount) return 0;
    return Math.round(baseB * 1000) / 1000;
  }

  /**
   * 第 index 颗粒子从右向左横穿轨道的时长（秒）：
   * 最高档约 1.5s、中档约 3.0s、低端约 8.6s，各星之间仅差 ±8% 防止追尾成团
   */
  function starDurationFor(starOrIndex, speedFactor) {
    var idx = typeof starOrIndex === "number"
      ? starOrIndex
      : (starOrIndex && typeof starOrIndex.id === "number" ? starOrIndex.id : 0);
    var speed = Math.min(
      MAX_SPEED_FACTOR,
      Math.max(0.35, typeof speedFactor === "number" && Number.isFinite(speedFactor) ? speedFactor : MAX_SPEED_FACTOR)
    );
    var spread = 1 - STARFIELD_DURATION_SPREAD + 2 * STARFIELD_DURATION_SPREAD * starHash01(idx, 29);
    return (STARFIELD_DURATION_MEAN * MAX_SPEED_FACTOR) / speed * spread;
  }

  /**
   * 第 index 颗粒子的负相位延迟（秒）：
   * 按黄金比低差异序列铺开，只与粒子序号与当前周期有关，与当前可见颗数无关
   */
  function starDelayFor(starOrIndex, duration) {
    var idx = typeof starOrIndex === "number"
      ? starOrIndex
      : (starOrIndex && typeof starOrIndex.id === "number" ? starOrIndex.id : 0);
    var particle = PARTICLES[idx];
    var phase = particle && typeof particle.phase === "number" ? particle.phase : 0;
    var dur = typeof duration === "number" && duration > 0 ? duration : starDurationFor(idx, MAX_SPEED_FACTOR);
    var jitter = starHash01(idx, 53) * 0.03;
    return -((phase + jitter) % 1) * dur;
  }

  /**
   * 星星层总不透明度：独立于星云层，保证中档 (energy=0.5) 也有 0.8 的清晰度，最高档为 1.0
   */
  function starLayerOpacityFor(energyOrPct, startOverride) {
    var e = typeof startOverride === "number" ? energyForPct(energyOrPct, startOverride) : clamp01(energyOrPct);
    if (e <= 0) return 0;
    return Math.round((0.6 + 0.4 * e) * 1000) / 1000;
  }

  function parseHexRgb(hex) {
    var clean = String(hex || "").replace(/^#/, "");
    var num = parseInt(clean, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function mixHex(hexA, hexB, t) {
    var ratio = clamp01(t);
    var a = parseHexRgb(hexA);
    var b = parseHexRgb(hexB);
    var r = Math.round(a[0] + (b[0] - a[0]) * ratio);
    var g = Math.round(a[1] + (b[1] - a[1]) * ratio);
    var bl = Math.round(a[2] + (b[2] - a[2]) * ratio);
    return (
      "#" +
      ((1 << 24) | (r << 16) | (g << 8) | bl)
        .toString(16)
        .slice(1)
    );
  }

  /**
   * 填充区末端主色：
   * - pct <= start          : #4d93f8 (Codex 纯蓝)
   * - start < pct <= end    : #4d93f8 -> #9333ea (蓝紫过渡)
   * - end < pct <= 1        : #9333ea -> #4c1d95 (深紫星云)
   */
  function fillColorFor(pct, startOverride, endOverride, isClaude) {
    var p = clamp01(pct);
    var start = typeof startOverride === "number" && Number.isFinite(startOverride) ? startOverride : ENERGY_START;
    var end = typeof endOverride === "number" && Number.isFinite(endOverride) ? endOverride : ENERGY_END;
    if (isClaude) {
      if (p <= start + 1e-6) return "#71717a";
      if (p <= end + 1e-6) {
        var cspan1 = Math.max(1e-6, end - start);
        return mixHex("#71717a", "#a78bfa", (p - start) / cspan1);
      }
      var cspan2 = Math.max(1e-6, 1 - end);
      return mixHex("#a78bfa", "#704ea2", (p - end) / cspan2);
    }
    if (p <= start + 1e-6) return "#4d93f8";
    if (p <= end + 1e-6) {
      var span1 = Math.max(1e-6, end - start);
      return mixHex("#4d93f8", "#9333ea", (p - start) / span1);
    }
    var span2 = Math.max(1e-6, 1 - end);
    return mixHex("#9333ea", "#4c1d95", (p - end) / span2);
  }

  /**
   * 填充区线性渐变背景：
   * 让轨道左侧始终保留蓝色起点，随滑块向右推进依次展开蓝紫过渡与深紫星云
   */
  function fillBackgroundFor(pct, startOverride, endOverride, isClaude) {
    var p = clamp01(pct);
    var start = typeof startOverride === "number" && Number.isFinite(startOverride) ? startOverride : ENERGY_START;
    var end = typeof endOverride === "number" && Number.isFinite(endOverride) ? endOverride : ENERGY_END;
    if (isClaude) {
      if (p <= 0.05) return "rgba(142, 118, 192, 0.15)";
      // 末端颜色随位置连续插值（#71717a → #a78bfa → #704ea2），避免过中点时整条填充色突变
      return "linear-gradient(90deg, rgba(142, 118, 192, 0.25) 0%, " + fillColorFor(p, start, end, true) + " 100%)";
    }
    if (p <= start + 1e-6) return "#4d93f8";
    var endColor = fillColorFor(p, start, end, false);
    if (p <= end + 1e-6) {
      var stopBlue = start > 0 ? Math.round((start / p) * 100) : 0;
      if (stopBlue <= 0) {
        return "linear-gradient(90deg, #4d93f8 0%, " + endColor + " 100%)";
      }
      return "linear-gradient(90deg, #4d93f8 0%, #4d93f8 " + stopBlue + "%, " + endColor + " 100%)";
    }
    var stopStart = start > 0 ? Math.round((start / p) * 100) : 0;
    var stopMid = Math.round((end / p) * 100);
    if (stopStart <= 0) {
      return "linear-gradient(90deg, #4d93f8 0%, #9333ea " + stopMid + "%, " + endColor + " 100%)";
    }
    return (
      "linear-gradient(90deg, #4d93f8 0%, #4d93f8 " +
      stopStart +
      "%, #9333ea " +
      stopMid +
      "%, " +
      endColor +
      " 100%)"
    );
  }

  /**
   * 档位文字着色：
   * - 单档位锁定模型或 Off 档位保持官方默认灰（返回 ""）
   * - Codex 风格：首档蓝 #4d93f8、中档蓝紫 #6c78f7、高档亮紫 #8b5cf6
   * - Claude 风格：首档暖灰/柔紫 #94a3b8、中档紫罗兰 #a78bfa、高档亮淡紫 #c4b5fd
   */
  function valueColorFor(label, index, count, isMax, hasOffFirst, isClaude) {
    if (isOffLevel(label)) return "";
    var n = Number(count) || 0;
    if (n <= 1) return "";
    if (isClaude) {
      if (isMax || index === n - 1) return "#c4b5fd";
      var cIdx = typeof index === "number" && index >= 0 ? index : 0;
      var cFirstActive = hasOffFirst ? 1 : 0;
      if (cIdx <= cFirstActive) return "#94a3b8";
      if (n === 3 && cIdx === 1) return "#a78bfa";
      var cDenom = Math.max(1, n - 1 - cFirstActive);
      var cT = clamp01((cIdx - cFirstActive) / cDenom);
      return mixHex("#94a3b8", "#c4b5fd", cT);
    }
    if (isMax || index === n - 1) return "#8b5cf6";
    var idx = typeof index === "number" && index >= 0 ? index : 0;
    var firstActive = hasOffFirst ? 1 : 0;
    if (idx <= firstActive) return "#4d93f8";
    var denom = Math.max(1, n - 1 - firstActive);
    var t = clamp01((idx - firstActive) / denom);
    return mixHex("#4d93f8", "#8b5cf6", t);
  }

  var FILL_RADIUS_CSS = KNOB_RADIUS + "px 0 0 " + KNOB_RADIUS + "px";

  // ── 样式表注入（右向左星尘横穿 + 星云扫光 + Antigravity 面板适配） ───────────
  var SLIDER_CSS = [
    "@keyframes ces-sweep {",
    "  0% { transform: translateX(100%); }",
    "  100% { transform: translateX(-100%); }",
    "}",
    "@keyframes ces-star-sweep {",
    "  0% { transform: translate3d(0, 0, 0); opacity: 0; }",
    "  6% { opacity: 1; }",
    "  94% { opacity: 1; }",
    "  100% { transform: translate3d(-100%, 0, 0); opacity: 0; }",
    "}",
    ".ces-inline {",
    "  width: 100%;",
    "  box-sizing: border-box;",
    "  padding-top: 6px;",
    "  user-select: none !important;",
    "  -webkit-user-select: none !important;",
    "}",
    ".ces-root,",
    ".ces-root:focus,",
    ".ces-root:focus-visible,",
    ".ces-root:focus-within {",
    "  position: relative;",
    "  width: 100%;",
    "  box-sizing: border-box;",
    "  outline: none !important;",
    "  outline-width: 0 !important;",
    "  box-shadow: none !important;",
    "  user-select: none !important;",
    "  -webkit-user-select: none !important;",
    "  -webkit-tap-highlight-color: transparent !important;",
    "}",
    ".ces-track {",
    "  position: relative;",
    "  width: 100%;",
    "  height: " + TRACK_HEIGHT + "px;",
    "  border-radius: 999px;",
    "  background: rgba(128, 128, 145, 0.18);",
    "  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(255, 255, 255, 0.06);",
    "  cursor: pointer;",
    "  touch-action: none;",
    "  box-sizing: border-box;",
    "  contain: layout style;",
    "  transition: opacity 0.15s ease;",
    "}",
    "/* 固定模糊半径的外发光伪元素，仅以 opacity 淡入避免 calc() 阴影每帧重栅格化 */",
    ".ces-track::after {",
    "  content: '';",
    "  position: absolute;",
    "  inset: 0;",
    "  border-radius: inherit;",
    "  pointer-events: none;",
    "  box-shadow: 0 0 16px rgba(168, 85, 247, 0.5);",
    "  opacity: 0;",
    "  transition: opacity 0.2s ease;",
    "}",
    ".ces-inline[data-energy='1'] .ces-track::after,",
    ".ces-root[data-energy='1'] .ces-track::after {",
    "  opacity: var(--ces-energy, 0);",
    "}",
    ".ces-inline[data-energy='0'] .ces-star,",
    ".ces-inline[data-energy='0'] .ces-energy__sweep,",
    ".ces-root[data-energy='0'] .ces-star,",
    ".ces-root[data-energy='0'] .ces-energy__sweep {",
    "  animation-play-state: paused;",
    "}",
    ".ces-track.is-locked {",
    "  opacity: 0.45;",
    "  cursor: not-allowed;",
    "  filter: saturate(0.25);",
    "}",
    ".ces-fill {",
    "  position: absolute;",
    "  inset: 0;",
    "  width: 100%;",
    "  border-radius: " + FILL_RADIUS_CSS + ";",
    "  background: #4d93f8;",
    "  clip-path: inset(0 calc(100% - var(--ces-fill, 14px)) 0 0);",
    "  pointer-events: none;",
    "  contain: layout style paint;",
    "}",
    ".ces-energy {",
    "  position: absolute;",
    "  inset: 0;",
    "  width: 100%;",
    "  border-radius: " + FILL_RADIUS_CSS + ";",
    "  clip-path: inset(0 calc(100% - var(--ces-fill, 14px)) 0 0);",
    "  overflow: hidden;",
    "  pointer-events: none;",
    "  opacity: var(--ces-energy, 0);",
    "  transition: opacity 0.2s ease;",
    "  contain: layout style paint;",
    "  background: linear-gradient(90deg, #3b1178 0%, #6d28d9 30%, #9333ea 62%, #c084fc 100%);",
    "}",
    ".ces-energy__sweep {",
    "  position: absolute;",
    "  inset: 0;",
    "  background: linear-gradient(100deg, transparent 18%, rgba(255, 255, 255, 0.30) 50%, transparent 82%);",
    "  transform: translateX(100%);",
    "  animation: ces-sweep 2.4s linear infinite;",
    "  pointer-events: none;",
    "}",
    ".ces-stars {",
    "  position: absolute;",
    "  inset: 0;",
    "  width: 100%;",
    "  border-radius: " + FILL_RADIUS_CSS + ";",
    "  clip-path: inset(0 calc(100% - var(--ces-fill, 14px)) 0 0);",
    "  opacity: 0;",
    "  transition: opacity 0.2s ease;",
    "  pointer-events: none;",
    "  overflow: hidden;",
    "  contain: layout style paint;",
    "}",
    "/* 星尘舞台固定 100% 宽度并通过 GPU transform 将右缘对齐圆钮中心，避免容器缩宽触发 22 颗星尘重排 */",
    ".ces-stars__stage {",
    "  position: absolute;",
    "  inset: 0;",
    "  width: 100%;",
    "  pointer-events: none;",
    "  transform: translate3d(calc(var(--ces-fill, 14px) - 100%), 0, 0);",
    "  will-change: transform;",
    "}",
    ".ces-star {",
    "  position: absolute;",
    "  left: 0;",
    "  right: 0;",
    "  height: 3px;",
    "  margin-top: -1.5px;",
    "  pointer-events: none;",
    "  animation-name: ces-star-sweep;",
    "  animation-timing-function: linear;",
    "  animation-iteration-count: infinite;",
    "}",
    ".ces-star.is-hidden {",
    "  visibility: hidden;",
    "  animation-play-state: paused !important;",
    "}",
    ".ces-star__dot {",
    "  position: absolute;",
    "  left: 100%;",
    "  top: 0;",
    "  width: 3px;",
    "  height: 3px;",
    "  margin-left: -1.5px;",
    "  border-radius: 50%;",
    "  background: #f5f3ff;",
    "  box-shadow: 0 0 5px rgba(216, 180, 254, 0.95);",
    "  opacity: var(--ces-b, 1);",
    "  transform: scale(var(--ces-b, 1));",
    "}",
    ".ces-ticks {",
    "  position: absolute;",
    "  inset: 0;",
    "  pointer-events: none;",
    "}",
    ".ces-tick {",
    "  position: absolute;",
    "  top: 50%;",
    "  width: 3px;",
    "  height: 3px;",
    "  margin: -1.5px 0 0 -1.5px;",
    "  border-radius: 50%;",
    "  background: rgba(255, 255, 255, 0.28);",
    "  pointer-events: none;",
    "  transition: background-color 0.12s ease;",
    "}",
    ".ces-tick.is-on {",
    "  background: rgba(255, 255, 255, 0.65);",
    "}",
    ".ces-tick.is-dim {",
    "  background: rgba(255, 255, 255, 0.28);",
    "}",
    ".ces-knob-rail {",
    "  position: absolute;",
    "  top: 50%;",
    "  left: " + KNOB_RADIUS + "px;",
    "  right: " + KNOB_RADIUS + "px;",
    "  height: 0;",
    "  pointer-events: none;",
    "}",
    ".ces-knob-carrier {",
    "  position: absolute;",
    "  left: 0;",
    "  top: 0;",
    "  width: 100%;",
    "  height: 0;",
    "  pointer-events: none;",
    "  transform: translate3d(calc(var(--ces-p, 0) * 100%), 0, 0);",
    "  will-change: transform;",
    "}",
    ".ces-knob {",
    "  position: absolute;",
    "  top: 0;",
    "  left: 0;",
    "  width: " + KNOB_SIZE + "px;",
    "  height: " + KNOB_SIZE + "px;",
    "  margin: " + (-KNOB_RADIUS) + "px 0 0 " + (-KNOB_RADIUS) + "px;",
    "  border-radius: 50%;",
    "  background: #ffffff;",
    "  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.34), 0 0 0 0.5px rgba(0, 0, 0, 0.06);",
    "  pointer-events: none;",
    "}",
    "/* ── Claude 专属主题适配 (data-theme='claude') ── */",
    ".ces-root[data-theme='claude'] .ces-stars,",
    ".ces-root[data-theme='claude'] .ces-energy,",
    ".ces-inline[data-theme='claude'] .ces-stars,",
    ".ces-inline[data-theme='claude'] .ces-energy {",
    "  display: none !important;",
    "}",
    ".ces-root[data-theme='claude'] .ces-track,",
    ".ces-inline[data-theme='claude'] .ces-track {",
    "  height: 28px;",
    "  border-radius: 999px;",
    "  background: rgba(128, 128, 145, 0.16);",
    "  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.22), inset 0 0 0 1px rgba(255, 255, 255, 0.08);",
    "}",
    ".ces-root[data-theme='claude'][data-energy='1'] .ces-track::after,",
    ".ces-inline[data-theme='claude'][data-energy='1'] .ces-track::after {",
    "  box-shadow: 0 0 16px rgba(167, 139, 250, 0.45);",
    "  opacity: var(--ces-energy, 0);",
    "}",
    ".ces-root[data-theme='claude'] .ces-knob,",
    ".ces-inline[data-theme='claude'] .ces-knob {",
    "  width: " + CLAUDE_KNOB_W + "px;",
    "  height: " + CLAUDE_KNOB_H + "px;",
    "  margin: " + (-CLAUDE_KNOB_H / 2) + "px 0 0 " + (-CLAUDE_KNOB_W / 2) + "px;",
    "  border-radius: " + CLAUDE_KNOB_R + "px;",
    "  background: #ffffff;",
    "  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), 0 0 0 0.5px rgba(0, 0, 0, 0.12);",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "}",
    ".ces-knob-notch {",
    "  display: none;",
    "  width: 2px;",
    "  height: 10px;",
    "  border-radius: 999px;",
    "  background: rgba(0, 0, 0, 0.28);",
    "}",
    ".ces-root[data-theme='claude'] .ces-knob-notch,",
    ".ces-inline[data-theme='claude'] .ces-knob-notch {",
    "  display: block;",
    "}",
    ".ces-claude-canvas {",
    "  position: absolute;",
    "  inset: 0;",
    "  /* 固定全宽并通过 GPU clip-path 裁切至圆钮中心，避免拖动期间改变 canvas CSS width 与重建像素缓冲 */",
    "  width: 100%;",
    "  height: 100%;",
    "  border-radius: 999px;",
    "  clip-path: inset(0 calc(100% - var(--ces-fill, 14px)) 0 0);",
    "  display: none;",
    "  pointer-events: none;",
    "  contain: layout style paint;",
    "}",
    ".ces-root[data-theme='claude'][data-energy='1'] .ces-claude-canvas,",
    ".ces-inline[data-theme='claude'][data-energy='1'] .ces-claude-canvas {",
    "  display: block;",
    "}",
    "@keyframes ces-claude-rise {",
    "  0% { transform: translateY(85%) scale(0.96); opacity: 0; }",
    "  55% { opacity: 1; }",
    "  80% { transform: translateY(-6%) scale(1.01); }",
    "  100% { transform: translateY(0) scale(1); opacity: 1; }",
    "}",
    ".ces-ag-effort-value.is-claude-changing,",
    ".ces-ag-effort-value.ces-text-rise {",
    "  animation: ces-claude-rise 0.3s cubic-bezier(0.2, 0.85, 0.25, 1);",
    "}",
    "/* 当同时触发文字向上翻转与 High 光斑爆散时，以 CSS 复合动画并发执行，防止相互覆盖打断 */",
    ".ces-ag-effort-value.is-claude-changing.is-glowing,",
    ".ces-ag-effort-value.ces-text-rise.is-glowing {",
    "  animation: ces-claude-rise 0.3s cubic-bezier(0.2, 0.85, 0.25, 1), ces-text-bloom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;",
    "}",
    "/* Antigravity 原生模型菜单底部专属「推理等级」区域 */",
    "[data-testid='model-selector-panel'].ces-ag-panel-enhanced {",
    "  max-height: 26rem !important;",
    "}",
    ".ces-ag-section,",
    ".ces-ag-section:focus,",
    ".ces-ag-section:focus-visible,",
    ".ces-ag-section * {",
    "  outline: none !important;",
    "  outline-width: 0 !important;",
    "  user-select: none !important;",
    "  -webkit-user-select: none !important;",
    "  -webkit-tap-highlight-color: transparent !important;",
    "}",
    ".ces-ag-section {",
    "  display: flex;",
    "  flex-direction: column;",
    "  flex-shrink: 0;",
    "  width: 100%;",
    "  box-sizing: border-box;",
    "}",
    ".ces-ag-effort-row {",
    "  display: flex;",
    "  flex-direction: column;",
    "  width: 100%;",
    "  box-sizing: border-box;",
    "  padding: 6px 8px 8px 8px;",
    "  border-radius: 6px;",
    "  transition: box-shadow 0.2s ease, background-color 0.2s ease;",
    "}",
    ".ces-ag-effort-row:hover {",
    "  background-color: rgba(128, 128, 145, 0.08);",
    "}",
    ".ces-ag-effort-row[data-ces-max='true'], [data-ces-effort-row='true'][data-ces-max='true'] {",
    "  box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.42), 0 0 14px -4px rgba(139, 92, 246, 0.45) !important;",
    "  background-color: rgba(139, 92, 246, 0.06);",
    "}",
    ".ces-ag-effort-head {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  gap: 8px;",
    "  width: 100%;",
    "  font-size: 12px;",
    "  line-height: 16px;",
    "}",
    ".ces-ag-effort-title {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 5px;",
    "  min-width: 0;",
    "  flex: 1;",
    "  overflow: hidden;",
    "  color: inherit;",
    "  font-weight: 500;",
    "  opacity: 0.9;",
    "}",
    ".ces-ag-effort-title-label {",
    "  flex-shrink: 0;",
    "}",
    ".ces-ag-effort-subtitle {",
    "  min-width: 0;",
    "  overflow: hidden;",
    "  text-overflow: ellipsis;",
    "  white-space: nowrap;",
    "  font-size: 11px;",
    "  font-weight: 400;",
    "  opacity: 0.72;",
    "}",
    "/* ── 面板到达最高档时的物理微震颤 (0.18s 快速阻尼撞墙感；独立 translate 避免覆盖弹层定位 transform) ── */",
    "@keyframes ces-panel-shake {",
    "  0% { translate: 0 0; }",
    "  20% { translate: 2.5px 0; }",
    "  40% { translate: -2px 0; }",
    "  60% { translate: 1.5px 0; }",
    "  80% { translate: -0.8px 0; }",
    "  100% { translate: 0 0; }",
    "}",
    ".ces-panel-shaking {",
    "  animation: ces-panel-shake 0.18s cubic-bezier(0.36, 0.07, 0.19, 0.97) both !important;",
    "}",
    "/* ── 'High' / 'Extra' 档位文字到达最高档时的模糊光斑爆散 (约 0.4s 淡淡消失) ── */",
    ".ces-ag-effort-value {",
    "  position: relative;",
    "  z-index: 1;",
    "  display: inline-block;",
    "  flex-shrink: 0;",
    "  font-size: 12px;",
    "  font-weight: 600;",
    "  transition: color 0.15s ease;",
    "}",
    ".ces-ag-effort-value::after {",
    "  content: '';",
    "  position: absolute;",
    "  top: 50%;",
    "  left: 50%;",
    "  width: 52px;",
    "  height: 26px;",
    "  border-radius: 999px;",
    "  transform: translate(-50%, -50%) scale(0.6);",
    "  background: radial-gradient(ellipse at center, var(--ces-glow-color, rgba(168, 85, 247, 0.85)) 0%, var(--ces-glow-color, rgba(168, 85, 247, 0.45)) 45%, rgba(168, 85, 247, 0) 75%);",
    "  filter: blur(8px);",
    "  pointer-events: none;",
    "  opacity: 0;",
    "  z-index: -1;",
    "}",
    "@keyframes ces-glow-flash {",
    "  0% {",
    "    opacity: 0.95;",
    "    transform: translate(-50%, -50%) scale(0.65);",
    "    filter: blur(6px);",
    "  }",
    "  25% {",
    "    opacity: 1;",
    "    transform: translate(-50%, -50%) scale(1.15);",
    "    filter: blur(8px);",
    "  }",
    "  100% {",
    "    opacity: 0;",
    "    transform: translate(-50%, -50%) scale(1.5);",
    "    filter: blur(14px);",
    "  }",
    "}",
    "@keyframes ces-text-bloom {",
    "  0% { text-shadow: 0 0 8px var(--ces-glow-color, #c084fc); }",
    "  30% { text-shadow: 0 0 14px var(--ces-glow-color, #c084fc), 0 0 3px #ffffff; }",
    "  100% { text-shadow: none; }",
    "}",
    ".ces-ag-effort-value.is-glowing {",
    "  animation: ces-text-bloom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;",
    "}",
    ".ces-ag-effort-value.is-glowing::after {",
    "  animation: ces-glow-flash 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;",
    "}",
    "@media (prefers-reduced-motion: reduce) {",
    "  .ces-panel-shaking { animation: none !important; }",
    "  .ces-ag-effort-value.is-glowing { animation: none !important; }",
    "  .ces-ag-effort-value.is-glowing::after { animation: none !important; }",
    "  .ces-ag-effort-value.ces-text-rise { animation: none !important; }",
    "  .ces-ag-effort-value.is-claude-changing { animation: none !important; }",
    "}",
    "/* 屏蔽模型行悬停弹出的冗余右侧二级档位子菜单，及 Orchestrator 规划器悬停弹出的第 3 级档位子菜单（保留第 2 级规划器子菜单与外层主面板） */",
    "[role='menu']:has([data-testid='model-selector-effort-option']):not(:has([data-testid='model-selector-panel'])),",
    "div[role='presentation']:has(> [role='menu'] [data-testid='model-selector-effort-option']):not(:has([data-testid='model-selector-panel'])),",
    "[role='menu']:has([data-testid='orchestrator-picker-effort']):not(:has([data-testid='model-selector-panel'])):not(:has([data-testid='orchestrator-picker-row'])),",
    "div[role='presentation']:has(> [role='menu'] [data-testid='orchestrator-picker-effort']):not(:has([data-testid='model-selector-panel'])):not(:has([data-testid='orchestrator-picker-row'])) {",
    "  display: none !important;",
    "  visibility: hidden !important;",
    "  pointer-events: none !important;",
    "  opacity: 0 !important;",
    "}",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > .can-hover\\:group-hover\\:hidden,",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > .can-hover\\:group-focus\\:hidden,",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > .group-hover\\:hidden,",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > .group-focus\\:hidden,",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > .group-focus-visible\\:hidden,",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > [class*='highlighted:hidden'],",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > span:not(:first-child):not(:last-child) {",
    "  display: flex !important;",
    "  visibility: visible !important;",
    "  opacity: 1 !important;",
    "}",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > span:not(:first-child) + span.shrink-0:last-child:not(.group-hover\\:hidden):not(.group-focus\\:hidden):not(.ml-auto) {",
    "  display: none !important;",
    "}",
    ".ces-ag-panel-enhanced [role='menuitem']:has([data-testid='model-selector-effort-group']) > span:first-child + span.shrink-0:last-child:not(.group-hover\\:hidden):not(.group-focus\\:hidden):not(.ml-auto) {",
    "  display: flex !important;",
    "  visibility: hidden !important;",
    "  pointer-events: none !important;",
    "}",
    ".ces-ag-panel-enhanced [role='menuitem'][data-ces-model-selected='true'],",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'][data-ces-model-selected='true'] {",
    "  background-color: rgba(128, 128, 145, 0.14);",
    "}",
    "/* Orchestrator 二级规划器子菜单：保持选中 √ 稳态显示，屏蔽末尾 › 箭头（已屏蔽第 3 级档位子菜单）并保留等宽占位 */",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > .can-hover\\:group-hover\\:hidden,",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > .can-hover\\:group-focus\\:hidden,",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > .group-hover\\:hidden,",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > .group-focus\\:hidden,",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > .group-focus-visible\\:hidden,",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > [class*='highlighted:hidden'],",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > span:not(:first-child):not(:last-child) {",
    "  display: flex !important;",
    "  visibility: visible !important;",
    "  opacity: 1 !important;",
    "}",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > span:not(:first-child) + span.shrink-0:last-child:not(.group-hover\\:hidden):not(.group-focus\\:hidden):not(.ml-auto) {",
    "  display: none !important;",
    "}",
    ".ces-ag-orch-submenu [data-testid='orchestrator-picker-row'] > span:first-child + span.shrink-0:last-child:not(.group-hover\\:hidden):not(.group-focus\\:hidden):not(.ml-auto) {",
    "  display: flex !important;",
    "  visibility: hidden !important;",
    "  pointer-events: none !important;",
    "}",
    "/* 右键 / 长按 设置浮层 */",
    ".ces-set {",
    "  position: fixed;",
    "  z-index: 2147483646;",
    "  width: 316px;",
    "  max-width: calc(100vw - 20px);",
    "  max-height: calc(100vh - 20px);",
    "  overflow-y: auto;",
    "  padding: 12px;",
    "  border-radius: 10px;",
    "  background: rgba(24, 22, 34, 0.96);",
    "  color: #f4f4f6;",
    "  border: 1px solid rgba(168, 85, 247, 0.28);",
    "  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);",
    "  backdrop-filter: blur(12px);",
    "  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  font-size: 12px;",
    "  box-sizing: border-box;",
    "  user-select: none;",
    "}",
    ".ces-set.is-light {",
    "  background: rgba(255, 255, 255, 0.97);",
    "  color: #18181b;",
    "  border-color: rgba(124, 58, 237, 0.22);",
    "  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.16);",
    "}",
    ".ces-set-head {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  margin-bottom: 10px;",
    "  padding-bottom: 7px;",
    "  border-bottom: 1px solid rgba(255, 255, 255, 0.08);",
    "  font-weight: 600;",
    "  font-size: 12.5px;",
    "}",
    ".ces-set-head-brand {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 6px;",
    "}",
    ".ces-set-logo {",
    "  width: 16px;",
    "  height: 16px;",
    "  flex-shrink: 0;",
    "}",
    ".ces-set.is-light .ces-set-head {",
    "  border-bottom-color: rgba(24, 24, 27, 0.08);",
    "}",
    ".ces-set-ver {",
    "  font-size: 11px;",
    "  font-weight: 400;",
    "  opacity: 0.6;",
    "}",
    ".ces-set-sec {",
    "  margin-top: 10px;",
    "  padding-top: 9px;",
    "  border-top: 1px solid rgba(255, 255, 255, 0.08);",
    "}",
    ".ces-set.is-light .ces-set-sec {",
    "  border-top-color: rgba(24, 24, 27, 0.08);",
    "}",
    ".ces-set-sec-tag {",
    "  display: inline-block;",
    "  margin-bottom: 7px;",
    "  padding: 2px 8px;",
    "  border-radius: 4px;",
    "  border: 1px solid rgba(168, 85, 247, 0.36);",
    "  background: rgba(168, 85, 247, 0.16);",
    "  color: #e9d5ff;",
    "  font-size: 10.5px;",
    "  font-weight: 700;",
    "  letter-spacing: 0.3px;",
    "}",
    ".ces-set.is-light .ces-set-sec-tag {",
    "  border-color: rgba(124, 58, 237, 0.28);",
    "  background: rgba(124, 58, 237, 0.1);",
    "  color: #6d28d9;",
    "}",
    ".ces-set-card {",
    "  padding: 7px 9px;",
    "  border-radius: 7px;",
    "  border: 1px solid rgba(168, 85, 247, 0.22);",
    "  background: rgba(255, 255, 255, 0.03);",
    "  margin-bottom: 6px;",
    "}",
    ".ces-set.is-light .ces-set-card {",
    "  border-color: rgba(124, 58, 237, 0.16);",
    "  background: rgba(124, 58, 237, 0.03);",
    "}",
    ".ces-set-card-row {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  gap: 8px;",
    "}",
    ".ces-set-card-info {",
    "  min-width: 0;",
    "  flex: 1;",
    "}",
    ".ces-set-card-title {",
    "  font-size: 11.5px;",
    "  font-weight: 600;",
    "  line-height: 1.35;",
    "}",
    ".ces-set-card-desc {",
    "  margin-top: 2px;",
    "  font-size: 10.5px;",
    "  color: #a1a1aa;",
    "  line-height: 1.35;",
    "  word-break: break-word;",
    "}",
    ".ces-set.is-light .ces-set-card-desc {",
    "  color: #52525b;",
    "}",
    ".ces-set-primary-btn {",
    "  padding: 4px 10px;",
    "  border-radius: 6px;",
    "  border: 1px solid #c084fc;",
    "  background: #c084fc;",
    "  color: #180f2e;",
    "  font-size: 11px;",
    "  font-weight: 700;",
    "  cursor: pointer;",
    "  white-space: nowrap;",
    "  flex-shrink: 0;",
    "}",
    ".ces-set-primary-btn:hover:not(:disabled) {",
    "  background: #d8b4fe;",
    "}",
    ".ces-set-primary-btn:disabled {",
    "  opacity: 0.55;",
    "  cursor: not-allowed;",
    "}",
    ".ces-set-primary-btn.is-off {",
    "  background: transparent;",
    "  border-color: rgba(255, 255, 255, 0.16);",
    "  color: #a1a1aa;",
    "  font-weight: 600;",
    "}",
    ".ces-set.is-light .ces-set-primary-btn {",
    "  border-color: #7c3aed;",
    "  background: #7c3aed;",
    "  color: #ffffff;",
    "}",
    ".ces-set.is-light .ces-set-primary-btn.is-off {",
    "  background: transparent;",
    "  border-color: rgba(24, 24, 27, 0.16);",
    "  color: #52525b;",
    "}",
    ".ces-set-mirror-row {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 6px;",
    "  margin-top: 6px;",
    "}",
    ".ces-set-mirror-row .ces-set-input {",
    "  margin-top: 0;",
    "  flex: 1;",
    "  min-width: 0;",
    "}",
    ".ces-set-pending {",
    "  display: none;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  gap: 8px;",
    "  padding: 7px 9px;",
    "  margin-bottom: 6px;",
    "  border-radius: 7px;",
    "  border: 1px solid rgba(34, 197, 94, 0.38);",
    "  background: rgba(34, 197, 94, 0.12);",
    "}",
    ".ces-set-pending.is-visible {",
    "  display: flex;",
    "}",
    ".ces-set-danger-zone {",
    "  margin-top: 8px;",
    "  padding-top: 8px;",
    "  border-top: 1px dashed rgba(239, 68, 68, 0.32);",
    "}",
    ".ces-set-danger-btn {",
    "  width: 100%;",
    "  padding: 6px 10px;",
    "  border-radius: 6px;",
    "  border: 1px solid rgba(239, 68, 68, 0.45);",
    "  background: rgba(239, 68, 68, 0.12);",
    "  color: #fca5a5;",
    "  font-size: 11.5px;",
    "  font-weight: 700;",
    "  cursor: pointer;",
    "}",
    ".ces-set-danger-btn:hover:not(:disabled) {",
    "  background: rgba(239, 68, 68, 0.24);",
    "  border-color: #ef4444;",
    "}",
    ".ces-set.is-light .ces-set-danger-btn {",
    "  color: #b91c1c;",
    "  background: rgba(220, 38, 38, 0.08);",
    "}",
    ".ces-set-confirm-box {",
    "  margin-top: 6px;",
    "  padding: 8px 9px;",
    "  border-radius: 7px;",
    "  border: 1px solid rgba(239, 68, 68, 0.45);",
    "  background: rgba(239, 68, 68, 0.12);",
    "}",
    ".ces-set-confirm-box[hidden] {",
    "  display: none !important;",
    "}",
    ".ces-set-confirm-actions {",
    "  display: flex;",
    "  justify-content: flex-end;",
    "  gap: 6px;",
    "  margin-top: 7px;",
    "}",
    ".ces-set-danger-solid {",
    "  padding: 4px 10px;",
    "  border-radius: 6px;",
    "  border: 1px solid #ef4444;",
    "  background: #ef4444;",
    "  color: #ffffff;",
    "  font-size: 11px;",
    "  font-weight: 700;",
    "  cursor: pointer;",
    "}",
    ".ces-set-tabs {",
    "  display: flex;",
    "  gap: 4px;",
    "  padding: 3px;",
    "  margin-bottom: 10px;",
    "  border-radius: 8px;",
    "  background: rgba(255, 255, 255, 0.05);",
    "  border: 1px solid rgba(255, 255, 255, 0.08);",
    "}",
    ".ces-set.is-light .ces-set-tabs {",
    "  background: rgba(24, 24, 27, 0.04);",
    "  border-color: rgba(24, 24, 27, 0.08);",
    "}",
    ".ces-set-tab {",
    "  flex: 1;",
    "  display: inline-flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: 5px;",
    "  padding: 4px 8px;",
    "  border-radius: 6px;",
    "  border: none;",
    "  background: transparent;",
    "  color: #a1a1aa;",
    "  font-size: 11.5px;",
    "  cursor: pointer;",
    "  outline: none !important;",
    "  transition: background 0.12s ease, color 0.12s ease;",
    "}",
    ".ces-set-tab:hover {",
    "  color: #f4f4f6;",
    "}",
    ".ces-set-tab.is-active {",
    "  background: rgba(139, 92, 246, 0.28);",
    "  color: #ffffff;",
    "  font-weight: 600;",
    "}",
    ".ces-set.is-light .ces-set-tab {",
    "  color: #52525b;",
    "}",
    ".ces-set.is-light .ces-set-tab:hover {",
    "  color: #18181b;",
    "}",
    ".ces-set.is-light .ces-set-tab.is-active {",
    "  background: rgba(124, 58, 237, 0.14);",
    "  color: #6d28d9;",
    "}",
    ".ces-set-tab-dot {",
    "  display: none;",
    "  width: 6px;",
    "  height: 6px;",
    "  border-radius: 999px;",
    "  background: #a855f7;",
    "  box-shadow: 0 0 6px rgba(168, 85, 247, 0.75);",
    "}",
    ".ces-set-tab-dot.is-visible {",
    "  display: inline-block;",
    "}",
    ".ces-set-pane[hidden] {",
    "  display: none !important;",
    "}",
    ".ces-set-group {",
    "  margin-bottom: 10px;",
    "}",
    ".ces-set-label {",
    "  margin-bottom: 5px;",
    "  font-size: 11px;",
    "  opacity: 0.72;",
    "}",
    ".ces-set-opts {",
    "  display: flex;",
    "  gap: 4px;",
    "}",
    ".ces-set-opt {",
    "  flex: 1;",
    "  padding: 5px 6px;",
    "  border-radius: 6px;",
    "  border: 1px solid rgba(255, 255, 255, 0.1);",
    "  background: rgba(255, 255, 255, 0.04);",
    "  color: #d4d4d8;",
    "  font-size: 11.5px;",
    "  white-space: normal;",
    "  line-height: 1.25;",
    "  cursor: pointer;",
    "  text-align: center;",
    "  transition: all 0.12s ease;",
    "}",
    ".ces-set-opt:hover {",
    "  background: rgba(255, 255, 255, 0.1);",
    "  color: #ffffff;",
    "}",
    ".ces-set-opt.is-on {",
    "  background: rgba(139, 92, 246, 0.28);",
    "  border-color: rgba(139, 92, 246, 0.75);",
    "  color: #ffffff;",
    "  font-weight: 600;",
    "}",
    ".ces-set.is-light .ces-set-opt {",
    "  border-color: rgba(24, 24, 27, 0.12);",
    "  background: rgba(24, 24, 27, 0.04);",
    "  color: #3f3f46;",
    "}",
    ".ces-set.is-light .ces-set-opt:hover {",
    "  background: rgba(24, 24, 27, 0.08);",
    "  color: #18181b;",
    "}",
    ".ces-set.is-light .ces-set-opt.is-on {",
    "  background: rgba(124, 58, 237, 0.14);",
    "  border-color: rgba(124, 58, 237, 0.65);",
    "  color: #6d28d9;",
    "}",
    ".ces-set-actions {",
    "  display: flex;",
    "  gap: 6px;",
    "  margin-top: 8px;",
    "  padding-top: 8px;",
    "  border-top: 1px solid rgba(255, 255, 255, 0.08);",
    "}",
    ".ces-set.is-light .ces-set-actions {",
    "  border-top-color: rgba(24, 24, 27, 0.08);",
    "}",
    ".ces-set-btn {",
    "  flex: 1;",
    "  padding: 5px 8px;",
    "  border-radius: 6px;",
    "  border: 1px solid rgba(255, 255, 255, 0.12);",
    "  background: rgba(255, 255, 255, 0.06);",
    "  color: #e4e4e7;",
    "  font-size: 11px;",
    "  white-space: normal;",
    "  line-height: 1.25;",
    "  cursor: pointer;",
    "}",
    ".ces-set-btn:hover {",
    "  background: rgba(255, 255, 255, 0.14);",
    "}",
    ".ces-set.is-light .ces-set-btn {",
    "  border-color: rgba(24, 24, 27, 0.14);",
    "  background: rgba(24, 24, 27, 0.05);",
    "  color: #27272a;",
    "}",
    ".ces-set.is-light .ces-set-btn:hover {",
    "  background: rgba(24, 24, 27, 0.1);",
    "}",
    ".ces-set-row {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  gap: 6px;",
    "}",
    ".ces-set-input {",
    "  width: 100%;",
    "  margin-top: 5px;",
    "  padding: 5px 7px;",
    "  border-radius: 6px;",
    "  border: 1px solid rgba(255, 255, 255, 0.14);",
    "  background: rgba(0, 0, 0, 0.25);",
    "  color: #f4f4f6;",
    "  font-size: 11px;",
    "  box-sizing: border-box;",
    "  outline: none;",
    "}",
    ".ces-set.is-light .ces-set-input {",
    "  border-color: rgba(24, 24, 27, 0.14);",
    "  background: rgba(24, 24, 27, 0.04);",
    "  color: #18181b;",
    "}",
    ".ces-set-input:focus {",
    "  border-color: rgba(139, 92, 246, 0.75);",
    "}",
    ".ces-set-status {",
    "  margin-top: 5px;",
    "  font-size: 10.5px;",
    "  color: #a1a1aa;",
    "  line-height: 1.4;",
    "  word-break: break-all;",
    "}",
    ".ces-set.is-light .ces-set-status {",
    "  color: #52525b;",
    "}",
    "/* 更新就绪应用内原生风格 Toast */",
    ".ces-update-toast {",
    "  position: fixed;",
    "  right: 18px;",
    "  bottom: 18px;",
    "  z-index: 2147483647;",
    "  width: 292px;",
    "  padding: 12px 14px;",
    "  border-radius: 10px;",
    "  background: rgba(24, 24, 28, 0.96);",
    "  color: #f4f4f6;",
    "  border: 1px solid rgba(139, 92, 246, 0.38);",
    "  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.48);",
    "  backdrop-filter: blur(12px);",
    "  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
    "  font-size: 12px;",
    "  box-sizing: border-box;",
    "  user-select: none;",
    "}",
    ".ces-update-toast.is-light {",
    "  background: rgba(255, 255, 255, 0.96);",
    "  color: #18181b;",
    "  border-color: rgba(124, 58, 237, 0.3);",
    "  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);",
    "}",
    ".ces-update-toast-title {",
    "  font-weight: 600;",
    "  font-size: 12.5px;",
    "  margin-bottom: 4px;",
    "}",
    ".ces-update-toast-desc {",
    "  font-size: 11.5px;",
    "  opacity: 0.78;",
    "  line-height: 1.45;",
    "  margin-bottom: 10px;",
    "}",
    ".ces-update-toast-actions {",
    "  display: flex;",
    "  gap: 8px;",
    "  justify-content: flex-end;",
    "}",
    ".ces-update-toast-btn {",
    "  padding: 5px 10px;",
    "  border-radius: 6px;",
    "  border: 1px solid rgba(255, 255, 255, 0.14);",
    "  background: rgba(255, 255, 255, 0.08);",
    "  color: inherit;",
    "  font-size: 11.5px;",
    "  cursor: pointer;",
    "  outline: none !important;",
    "}",
    ".ces-update-toast.is-light .ces-update-toast-btn {",
    "  border-color: rgba(24, 24, 27, 0.14);",
    "  background: rgba(24, 24, 27, 0.05);",
    "}",
    ".ces-update-toast-btn.is-primary {",
    "  background: #7c3aed;",
    "  border-color: #7c3aed;",
    "  color: #ffffff;",
    "  font-weight: 600;",
    "}",
    ".ces-update-toast-btn.is-primary:hover {",
    "  background: #6d28d9;",
    "}"
  ].join("\n");

  function installStyles(doc) {
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d || !d.head) return null;
    var existing = d.getElementById(STYLE_ELEMENT_ID);
    if (existing) {
      if (existing.textContent !== SLIDER_CSS) {
        existing.textContent = SLIDER_CSS;
      }
      return existing;
    }
    var style = d.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = SLIDER_CSS;
    d.head.appendChild(style);
    return style;
  }

  // ── 宿主桥接适配层（Desktop contextBridge / IDE 本地反向代理） ──────────────
  function resolveHostBridge(win, explicitBridge) {
    if (explicitBridge && typeof explicitBridge === "object") {
      return explicitBridge;
    }
    var w = win || (typeof window !== "undefined" ? window : globalRoot);
    if (w && w.__agCodexSliderBridge && typeof w.__agCodexSliderBridge.getState === "function") {
      return w.__agCodexSliderBridge;
    }
    try {
      if (
        w &&
        w.location &&
        (w.location.protocol === "http:" || w.location.protocol === "https:") &&
        (w.location.hostname === "127.0.0.1" || w.location.hostname === "localhost") &&
        typeof w.fetch === "function"
      ) {
        return {
          platform: "ide",
          getState: function () {
            return w.fetch("/__ag_codex_slider/state").then(function (r) { return r.json(); });
          },
          saveConfig: function (cfg) {
            return w.fetch("/__ag_codex_slider/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cfg || {})
            }).then(function (r) { return r.json(); });
          },
          checkUpdate: function () {
            return w.fetch("/__ag_codex_slider/check-update", { method: "POST" }).then(function (r) { return r.json(); });
          },
          uninstall: function () {
            return w.fetch("/__ag_codex_slider/uninstall", { method: "POST" }).then(function (r) { return r.json(); });
          },
          relaunch: function () {
            return w.fetch("/__ag_codex_slider/reload", { method: "POST" }).then(function (r) { return r.json(); });
          },
          onStateChanged: function (callback) {
            if (typeof callback !== "function" || typeof w.EventSource !== "function") return function () {};
            try {
              var es = new w.EventSource("/__ag_codex_slider/events");
              var onEvt = function (ev) {
                try {
                  var parsed = JSON.parse(ev.data);
                  callback(parsed);
                } catch (err) {}
              };
              es.addEventListener("state-changed", onEvt);
              return function () {
                try { es.close(); } catch (err) {}
              };
            } catch (err) {
              return function () {};
            }
          }
        };
      }
    } catch (err) {
      // 非宿主环境（例如离线预览或单元测试）静默回退
    }
    return null;
  }

  // ── 应用内原生风格更新就绪 Toast ─────────────────────────────────────────────
  function showUpdateReadyToast(options) {
    var opts = options || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
    if (!doc || !doc.body) return function () {};
    installStyles(doc);

    var prev = doc.querySelector(".ces-update-toast");
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    var version = String(opts.version || PLUGIN_VERSION);
    var isIde = opts.platform === "ide";
    var locale = opts.locale ? resolveUiLocale(opts.locale) : detectUiLocale(win);
    var isDark = true;
    try {
      isDark = surfaceIsDark(win, doc);
    } catch (err) {
      isDark = true;
    }

    var toast = doc.createElement("div");
    toast.className = "ces-update-toast" + (isDark ? "" : " is-light");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    var titleEl = doc.createElement("div");
    titleEl.className = "ces-update-toast-title";
    titleEl.textContent = t(locale, "updateToastTitle", { version: version });
    toast.appendChild(titleEl);

    var descEl = doc.createElement("div");
    descEl.className = "ces-update-toast-desc";
    descEl.textContent = t(locale, isIde ? "updateToastDescIde" : "updateToastDescDesktop");
    toast.appendChild(descEl);

    var actionsEl = doc.createElement("div");
    actionsEl.className = "ces-update-toast-actions";

    var laterBtn = doc.createElement("button");
    laterBtn.type = "button";
    laterBtn.className = "ces-update-toast-btn";
    laterBtn.textContent = t(locale, "later");

    var restartBtn = doc.createElement("button");
    restartBtn.type = "button";
    restartBtn.className = "ces-update-toast-btn is-primary";
    restartBtn.textContent = t(locale, isIde ? "reloadNow" : "restartNow");

    function dismiss() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      if (typeof opts.onDismiss === "function") {
        opts.onDismiss();
      }
    }

    laterBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      dismiss();
    });

    restartBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      restartBtn.disabled = true;
      restartBtn.textContent = t(locale, isIde ? "reloading" : "restarting");
      if (typeof opts.onRestart === "function") {
        Promise.resolve(opts.onRestart()).catch(function () {
          restartBtn.disabled = false;
          restartBtn.textContent = t(locale, isIde ? "reloadNow" : "restartNow");
        });
      }
    });

    actionsEl.appendChild(laterBtn);
    actionsEl.appendChild(restartBtn);
    toast.appendChild(actionsEl);
    doc.body.appendChild(toast);
    return dismiss;
  }

  function showUninstallCompleteToast(options) {
    var opts = options || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
    if (!doc || !doc.body) return function () {};
    installStyles(doc);

    var prev = doc.querySelector(".ces-update-toast");
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    var isIde = opts.platform === "ide";
    var locale = opts.locale ? resolveUiLocale(opts.locale) : detectUiLocale(win);
    var isDark = true;
    try {
      isDark = surfaceIsDark(win, doc);
    } catch (err) {
      isDark = true;
    }

    var toast = doc.createElement("div");
    toast.className = "ces-update-toast" + (isDark ? "" : " is-light");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    var titleEl = doc.createElement("div");
    titleEl.className = "ces-update-toast-title";
    titleEl.textContent = t(locale, "uninstallToastTitle");
    toast.appendChild(titleEl);

    var descEl = doc.createElement("div");
    descEl.className = "ces-update-toast-desc";
    descEl.textContent = t(locale, isIde ? "uninstallToastDescIde" : "uninstallToastDescDesktop");
    toast.appendChild(descEl);

    var actionsEl = doc.createElement("div");
    actionsEl.className = "ces-update-toast-actions";

    var laterBtn = doc.createElement("button");
    laterBtn.type = "button";
    laterBtn.className = "ces-update-toast-btn";
    laterBtn.textContent = t(locale, "later");

    var restartBtn = doc.createElement("button");
    restartBtn.type = "button";
    restartBtn.className = "ces-update-toast-btn is-primary";
    restartBtn.textContent = t(locale, isIde ? "reloadNow" : "restartNow");

    function dismiss() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }

    laterBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      dismiss();
    });

    restartBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      restartBtn.disabled = true;
      restartBtn.textContent = t(locale, isIde ? "reloading" : "restarting");
      if (typeof opts.onRestart === "function") {
        Promise.resolve(opts.onRestart()).catch(function () {
          restartBtn.disabled = false;
          restartBtn.textContent = t(locale, isIde ? "reloadNow" : "restartNow");
        });
      }
    });

    actionsEl.appendChild(laterBtn);
    actionsEl.appendChild(restartBtn);
    toast.appendChild(actionsEl);
    doc.body.appendChild(toast);
    return dismiss;
  }

  function formatRelativeCheckTime(ts, locale) {
    var loc = locale || "en";
    var raw = Number(ts || 0);
    if (!raw) return t(loc, "lastCheckNever");
    var ms = raw > 1e11 ? raw : raw * 1000;
    var diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
    if (diffMin < 1) return t(loc, "timeJustNow");
    if (diffMin < 60) return t(loc, "timeMinutesAgo", { n: diffMin });
    var diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t(loc, "timeHoursAgo", { n: diffHour });
    return t(loc, "timeDaysAgo", { n: Math.floor(diffHour / 24) });
  }

  function createSliderBrandIcon(doc) {
    if (typeof doc.createElementNS !== "function") {
      var fallback = doc.createElement("span");
      fallback.className = "ces-set-logo";
      fallback.setAttribute("aria-hidden", "true");
      return fallback;
    }
    var NS = "http://www.w3.org/2000/svg";
    var svg = doc.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("fill", "none");
    svg.setAttribute("class", "ces-set-logo");
    svg.setAttribute("aria-hidden", "true");
    var bg = doc.createElementNS(NS, "rect");
    bg.setAttribute("x", "4");
    bg.setAttribute("y", "4");
    bg.setAttribute("width", "56");
    bg.setAttribute("height", "56");
    bg.setAttribute("rx", "14");
    bg.setAttribute("fill", "#23173d");
    bg.setAttribute("stroke", "rgba(168,85,247,0.55)");
    bg.setAttribute("stroke-width", "3");
    var track = doc.createElementNS(NS, "rect");
    track.setAttribute("x", "10");
    track.setAttribute("y", "23");
    track.setAttribute("width", "44");
    track.setAttribute("height", "18");
    track.setAttribute("rx", "9");
    track.setAttribute("fill", "rgba(255,255,255,0.14)");
    var act = doc.createElementNS(NS, "rect");
    act.setAttribute("x", "10");
    act.setAttribute("y", "23");
    act.setAttribute("width", "35");
    act.setAttribute("height", "18");
    act.setAttribute("rx", "9");
    act.setAttribute("fill", "#9333ea");
    var knob = doc.createElementNS(NS, "circle");
    knob.setAttribute("cx", "43");
    knob.setAttribute("cy", "32");
    knob.setAttribute("r", "7.5");
    knob.setAttribute("fill", "#ffffff");
    svg.appendChild(bg);
    svg.appendChild(track);
    svg.appendChild(act);
    svg.appendChild(knob);
    return svg;
  }

  // ── 右键 / 长按 设置面板（单页纵向布局：外观 + 图二更新区 + 底部红色二次确认卸载） ──
  function openSettingsPanel(options) {
    var opts = options || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
    if (!doc || !doc.body) return function () {};
    installStyles(doc);

    var prev = doc.querySelector(".ces-set");
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    var bridge = resolveHostBridge(win, opts.bridge);
    var locale = opts.locale ? resolveUiLocale(opts.locale) : detectUiLocale(win);
    var isDark = true;
    try {
      isDark = surfaceIsDark(win, doc);
    } catch (err) {
      isDark = true;
    }

    var panel = doc.createElement("div");
    panel.className = "ces-set" + (isDark ? "" : " is-light");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", t(locale, "panelAriaLabel"));

    var x = typeof opts.x === "number" ? opts.x : 120;
    var y = typeof opts.y === "number" ? opts.y : 120;

    function positionPanel() {
      var MARGIN = 10;
      var FLIP_GAP = 6;
      var vw = (win && win.innerWidth) || (doc.documentElement && doc.documentElement.clientWidth) || 800;
      var vh = (win && win.innerHeight) || (doc.documentElement && doc.documentElement.clientHeight) || 600;
      var rect = typeof panel.getBoundingClientRect === "function" ? panel.getBoundingClientRect() : null;
      var rectW = rect && rect.width > 0 ? rect.width : 316;
      var rectH = rect && rect.height > 0 ? rect.height : (bridge ? 470 : 210);

      var targetLeft = x + rectW + MARGIN <= vw ? x : vw - rectW - MARGIN;
      var clampedLeft = Math.max(MARGIN, Math.min(Math.max(MARGIN, vw - rectW - MARGIN), targetLeft));

      var targetTop;
      if (y + rectH + MARGIN <= vh) {
        targetTop = y;
      } else if (y - rectH - FLIP_GAP >= MARGIN) {
        targetTop = y - rectH - FLIP_GAP;
      } else {
        targetTop = vh - rectH - MARGIN;
      }
      var clampedTop = Math.max(MARGIN, Math.min(Math.max(MARGIN, vh - rectH - MARGIN), targetTop));

      panel.style.left = Math.round(clampedLeft) + "px";
      panel.style.top = Math.round(clampedTop) + "px";
    }

    var head = doc.createElement("div");
    head.className = "ces-set-head";
    var brandSpan = doc.createElement("span");
    brandSpan.className = "ces-set-head-brand";
    brandSpan.appendChild(createSliderBrandIcon(doc));
    var titleSpan = doc.createElement("span");
    titleSpan.textContent = t(locale, "panelTitle");
    brandSpan.appendChild(titleSpan);
    var verSpan = doc.createElement("span");
    verSpan.className = "ces-set-ver";
    verSpan.textContent = "v" + PLUGIN_VERSION;
    head.appendChild(brandSpan);
    head.appendChild(verSpan);
    panel.appendChild(head);

    var appearancePane = doc.createElement("div");
    appearancePane.className = "ces-set-pane";
    appearancePane.setAttribute("data-ces-section", "appearance");

    var optButtons = [];
    function refreshActiveButtons() {
      var cur = readSettings(win);
      for (var i = 0; i < optButtons.length; i += 1) {
        var item = optButtons[i];
        var isOn = cur[item.key] === item.value;
        if (isOn) item.btn.classList.add("is-on");
        else item.btn.classList.remove("is-on");
        item.btn.setAttribute("aria-pressed", isOn ? "true" : "false");
      }
    }

    var SCHEMA_I18N_KEYS = {
      motion: {
        label: "motionLabel",
        options: {
          full: { label: "motionFull", hint: "motionFullHint" },
          fast: { label: "motionFast", hint: "motionFastHint" },
          quick: { label: "motionQuick", hint: "motionQuickHint" }
        }
      },
      ticks: {
        label: "ticksLabel",
        options: {
          highlight: { label: "ticksHighlight", hint: "ticksHighlightHint" },
          dim: { label: "ticksDim", hint: "ticksDimHint" },
          hidden: { label: "ticksHidden", hint: "ticksHiddenHint" }
        }
      }
    };

    for (var sIdx = 0; sIdx < SETTINGS_SCHEMA.length; sIdx += 1) {
      (function (schemaItem) {
        var i18nGroup = SCHEMA_I18N_KEYS[schemaItem.key] || null;
        var group = doc.createElement("div");
        group.className = "ces-set-group";
        var label = doc.createElement("div");
        label.className = "ces-set-label";
        label.textContent = i18nGroup ? t(locale, i18nGroup.label) : schemaItem.label;
        group.appendChild(label);

        var row = doc.createElement("div");
        row.className = "ces-set-opts";
        for (var oIdx = 0; oIdx < schemaItem.options.length; oIdx += 1) {
          (function (optionItem) {
            var optI18n = i18nGroup && i18nGroup.options[optionItem.value];
            var btn = doc.createElement("button");
            btn.type = "button";
            btn.className = "ces-set-opt";
            btn.textContent = optI18n ? t(locale, optI18n.label) : optionItem.label;
            var hintText = optI18n ? t(locale, optI18n.hint) : optionItem.hint;
            if (hintText) btn.title = hintText;
            btn.addEventListener("click", function (ev) {
              ev.stopPropagation();
              var patch = {};
              patch[schemaItem.key] = optionItem.value;
              writeSettings(patch, win);
              refreshActiveButtons();
            });
            optButtons.push({ key: schemaItem.key, value: optionItem.value, btn: btn });
            row.appendChild(btn);
          })(schemaItem.options[oIdx]);
        }
        group.appendChild(row);
        appearancePane.appendChild(group);
      })(SETTINGS_SCHEMA[sIdx]);
    }
    panel.appendChild(appearancePane);

    var applyRemoteHostState = null;
    var offBridgeState = null;

    if (bridge) {
      (function () {
        var updateSec = doc.createElement("div");
        updateSec.className = "ces-set-sec";
        updateSec.setAttribute("data-ces-section", "update");

        var secTag = doc.createElement("div");
        secTag.className = "ces-set-sec-tag";
        secTag.textContent = t(locale, "updateSectionTag");
        updateSec.appendChild(secTag);

        var pendingBanner = doc.createElement("div");
        pendingBanner.className = "ces-set-pending";
        pendingBanner.setAttribute("data-ces-part", "pending-banner");
        var pendingInfo = doc.createElement("div");
        pendingInfo.className = "ces-set-card-info";
        var pendingTitle = doc.createElement("div");
        pendingTitle.className = "ces-set-card-title";
        pendingTitle.textContent = t(locale, "pendingTitleFallback");
        var pendingDesc = doc.createElement("div");
        pendingDesc.className = "ces-set-card-desc";
        pendingDesc.textContent = t(locale, bridge.platform === "ide" ? "pendingDescIde" : "pendingDescDesktop");
        pendingInfo.appendChild(pendingTitle);
        pendingInfo.appendChild(pendingDesc);
        var relaunchBtn = doc.createElement("button");
        relaunchBtn.type = "button";
        relaunchBtn.className = "ces-set-primary-btn";
        relaunchBtn.textContent = t(locale, bridge.platform === "ide" ? "relaunchNowIde" : "relaunchNowDesktop");
        relaunchBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (typeof bridge.relaunch === "function") {
            void bridge.relaunch();
          }
        });
        pendingBanner.appendChild(pendingInfo);
        pendingBanner.appendChild(relaunchBtn);
        updateSec.appendChild(pendingBanner);

        // 卡片 1：当前版本 + 上次检查 + 检查更新
        var cardVer = doc.createElement("div");
        cardVer.className = "ces-set-card";
        var cardVerRow = doc.createElement("div");
        cardVerRow.className = "ces-set-card-row";
        var cardVerInfo = doc.createElement("div");
        cardVerInfo.className = "ces-set-card-info";
        var cardVerTitle = doc.createElement("div");
        cardVerTitle.className = "ces-set-card-title";
        cardVerTitle.textContent = t(locale, "currentVersion", { version: PLUGIN_VERSION });
        var cardVerDesc = doc.createElement("div");
        cardVerDesc.className = "ces-set-card-desc";
        cardVerDesc.textContent = t(locale, "lastCheckPrefix", { time: t(locale, "lastCheckNever") });
        cardVerInfo.appendChild(cardVerTitle);
        cardVerInfo.appendChild(cardVerDesc);
        var checkBtn = doc.createElement("button");
        checkBtn.type = "button";
        checkBtn.className = "ces-set-primary-btn";
        checkBtn.textContent = t(locale, "checkUpdate");
        cardVerRow.appendChild(cardVerInfo);
        cardVerRow.appendChild(checkBtn);
        cardVer.appendChild(cardVerRow);
        updateSec.appendChild(cardVer);

        // 卡片 2：每 12 小时自动检查更新开关
        var cardAuto = doc.createElement("div");
        cardAuto.className = "ces-set-card";
        var cardAutoRow = doc.createElement("div");
        cardAutoRow.className = "ces-set-card-row";
        var cardAutoInfo = doc.createElement("div");
        cardAutoInfo.className = "ces-set-card-info";
        var cardAutoTitle = doc.createElement("div");
        cardAutoTitle.className = "ces-set-card-title";
        cardAutoTitle.textContent = t(locale, "autoUpdateTitle");
        var cardAutoDesc = doc.createElement("div");
        cardAutoDesc.className = "ces-set-card-desc";
        cardAutoDesc.textContent = t(locale, "autoUpdateDesc");
        cardAutoInfo.appendChild(cardAutoTitle);
        cardAutoInfo.appendChild(cardAutoDesc);
        var autoToggleBtn = doc.createElement("button");
        autoToggleBtn.type = "button";
        autoToggleBtn.className = "ces-set-primary-btn";
        autoToggleBtn.setAttribute("data-ces-action", "toggle-auto-update");
        autoToggleBtn.textContent = t(locale, "enabled");
        cardAutoRow.appendChild(cardAutoInfo);
        cardAutoRow.appendChild(autoToggleBtn);
        cardAuto.appendChild(cardAutoRow);
        updateSec.appendChild(cardAuto);

        // 卡片 3：GitHub 镜像前缀 + 保存按钮
        var cardMirror = doc.createElement("div");
        cardMirror.className = "ces-set-card";
        var mirrorTitle = doc.createElement("div");
        mirrorTitle.className = "ces-set-card-title";
        mirrorTitle.textContent = t(locale, "mirrorTitle");
        var mirrorDesc = doc.createElement("div");
        mirrorDesc.className = "ces-set-card-desc";
        mirrorDesc.textContent = t(locale, "mirrorDesc");
        var mirrorRow = doc.createElement("div");
        mirrorRow.className = "ces-set-mirror-row";
        var mirrorInput = doc.createElement("input");
        mirrorInput.type = "text";
        mirrorInput.className = "ces-set-input";
        mirrorInput.placeholder = t(locale, "mirrorPlaceholder");
        var saveMirrorBtn = doc.createElement("button");
        saveMirrorBtn.type = "button";
        saveMirrorBtn.className = "ces-set-primary-btn";
        saveMirrorBtn.setAttribute("data-ces-action", "save-mirror");
        saveMirrorBtn.textContent = t(locale, "save");
        mirrorRow.appendChild(mirrorInput);
        mirrorRow.appendChild(saveMirrorBtn);
        cardMirror.appendChild(mirrorTitle);
        cardMirror.appendChild(mirrorDesc);
        cardMirror.appendChild(mirrorRow);
        updateSec.appendChild(cardMirror);

        var currentAutoUpdate = true;
        var customHint = "";

        applyRemoteHostState = function (st) {
          if (!st || typeof st !== "object") return;
          currentAutoUpdate = st.autoUpdate !== false;
          if (currentAutoUpdate) {
            autoToggleBtn.classList.remove("is-off");
            autoToggleBtn.textContent = t(locale, "enabled");
          } else {
            autoToggleBtn.classList.add("is-off");
            autoToggleBtn.textContent = t(locale, "disabled");
          }
          if (typeof st.mirrorPrefix === "string" && doc.activeElement !== mirrorInput) {
            mirrorInput.value = st.mirrorPrefix;
          }
          if (st.version) {
            verSpan.textContent = "v" + st.version;
            cardVerTitle.textContent = t(locale, "currentVersion", { version: st.version });
          }
          if (st.pendingUpdateVersion) {
            pendingBanner.classList.add("is-visible");
            pendingTitle.textContent = t(locale, "pendingTitle", { version: st.pendingUpdateVersion });
          } else {
            pendingBanner.classList.remove("is-visible");
          }
          if (!customHint) {
            cardVerDesc.textContent = t(locale, "lastCheckPrefix", { time: formatRelativeCheckTime(st.lastCheckAt, locale) });
          }
          var appearancePatch = {};
          if (typeof st.motion === "string") appearancePatch.motion = st.motion;
          if (typeof st.ticks === "string") appearancePatch.ticks = st.ticks;
          if (appearancePatch.motion || appearancePatch.ticks) {
            var localCur = readSettings(win);
            if (
              (appearancePatch.motion && appearancePatch.motion !== localCur.motion) ||
              (appearancePatch.ticks && appearancePatch.ticks !== localCur.ticks)
            ) {
              writeSettings(appearancePatch, win, { fromRemote: true });
              refreshActiveButtons();
            }
          }
          positionPanel();
        };

        autoToggleBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var nextAuto = !currentAutoUpdate;
          customHint = "";
          if (typeof bridge.saveConfig === "function") {
            Promise.resolve(bridge.saveConfig({ autoUpdate: nextAuto })).then(applyRemoteHostState);
          }
        });

        function commitMirror() {
          customHint = "";
          if (typeof bridge.saveConfig === "function") {
            Promise.resolve(bridge.saveConfig({ mirrorPrefix: mirrorInput.value.trim() })).then(function (st) {
              applyRemoteHostState(st);
              saveMirrorBtn.textContent = t(locale, "saved");
              setTimeout(function () { saveMirrorBtn.textContent = t(locale, "save"); }, 1200);
            });
          }
        }
        saveMirrorBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          commitMirror();
        });
        mirrorInput.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.stopPropagation();
            commitMirror();
            mirrorInput.blur();
          }
        });

        checkBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (typeof bridge.checkUpdate !== "function") return;
          checkBtn.disabled = true;
          checkBtn.textContent = t(locale, "checkingUpdate");
          customHint = t(locale, "checkingRelease");
          cardVerDesc.textContent = customHint;
          positionPanel();
          Promise.resolve(bridge.checkUpdate())
            .then(function (res) {
              checkBtn.disabled = false;
              checkBtn.textContent = t(locale, "checkUpdate");
              if (res && res.status === "updated" && res.version) {
                customHint = t(locale, "downloadedReady", { version: res.version });
                cardVerDesc.textContent = customHint;
                showUpdateReadyToast({
                  document: doc,
                  window: win,
                  locale: locale,
                  version: res.version,
                  platform: bridge.platform,
                  onRestart: function () {
                    return typeof bridge.relaunch === "function" ? bridge.relaunch() : null;
                  }
                });
              } else if (res && res.status === "up_to_date") {
                customHint = t(locale, "upToDate", { version: res.version || PLUGIN_VERSION });
                cardVerDesc.textContent = customHint;
              } else if (res && res.message) {
                customHint = res.message;
                cardVerDesc.textContent = customHint;
              } else {
                customHint = "";
              }
              if (res && res.state) applyRemoteHostState(res.state);
              positionPanel();
            })
            .catch(function (err) {
              checkBtn.disabled = false;
              checkBtn.textContent = t(locale, "checkUpdate");
              customHint = t(locale, "checkFailed", { err: err && err.message ? err.message : t(locale, "networkError") });
              cardVerDesc.textContent = customHint;
              positionPanel();
            });
        });

        if (typeof bridge.getState === "function") {
          Promise.resolve(bridge.getState())
            .then(applyRemoteHostState)
            .catch(function () {
              cardVerDesc.textContent = t(locale, "stateReadFailed");
              positionPanel();
            });
        }
        if (typeof bridge.onStateChanged === "function") {
          offBridgeState = bridge.onStateChanged(applyRemoteHostState);
        }

        panel.appendChild(updateSec);
      })();
    }

    var actions = doc.createElement("div");
    actions.className = "ces-set-actions";

    var copyBtn = doc.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ces-set-btn";
    copyBtn.textContent = t(locale, "copyDiag");
    copyBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var payload = JSON.stringify(dumpTrace(win), null, 2);
      try {
        if (win && win.navigator && win.navigator.clipboard && typeof win.navigator.clipboard.writeText === "function") {
          win.navigator.clipboard.writeText(payload);
        }
      } catch (err) {
        // 忽略剪贴板权限错误
      }
      copyBtn.textContent = t(locale, "copied");
    });

    var resetBtn = doc.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "ces-set-btn";
    resetBtn.textContent = t(locale, "resetDefault");
    resetBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      resetSettings(win);
      refreshActiveButtons();
    });

    var closeBtn = doc.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ces-set-btn";
    closeBtn.textContent = t(locale, "close");

    actions.appendChild(copyBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(closeBtn);
    panel.appendChild(actions);

    if (bridge) {
      (function () {
        var dangerZone = doc.createElement("div");
        dangerZone.className = "ces-set-danger-zone";
        dangerZone.setAttribute("data-ces-section", "danger");

        var uninstallOpenBtn = doc.createElement("button");
        uninstallOpenBtn.type = "button";
        uninstallOpenBtn.className = "ces-set-danger-btn";
        uninstallOpenBtn.setAttribute("data-ces-action", "uninstall-open");
        uninstallOpenBtn.textContent = t(locale, "uninstallBtn");

        var confirmBox = doc.createElement("div");
        confirmBox.className = "ces-set-confirm-box";
        confirmBox.setAttribute("data-ces-part", "uninstall-confirm");
        confirmBox.hidden = true;

        var confirmTitle = doc.createElement("div");
        confirmTitle.className = "ces-set-card-title";
        confirmTitle.textContent = t(locale, "uninstallConfirmTitle");
        var confirmDesc = doc.createElement("div");
        confirmDesc.className = "ces-set-card-desc";
        confirmDesc.textContent = t(locale, "uninstallConfirmDesc");
        var confirmErr = doc.createElement("div");
        confirmErr.className = "ces-set-card-desc";
        confirmErr.style.color = "#f87171";
        confirmErr.hidden = true;

        var confirmActions = doc.createElement("div");
        confirmActions.className = "ces-set-confirm-actions";
        var cancelBtn = doc.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "ces-set-btn";
        cancelBtn.style.flex = "0 0 auto";
        cancelBtn.setAttribute("data-ces-action", "uninstall-cancel");
        cancelBtn.textContent = t(locale, "cancel");

        var confirmBtn = doc.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "ces-set-danger-solid";
        confirmBtn.setAttribute("data-ces-action", "uninstall-confirm");
        confirmBtn.textContent = t(locale, "confirmUninstall");

        confirmActions.appendChild(cancelBtn);
        confirmActions.appendChild(confirmBtn);
        confirmBox.appendChild(confirmTitle);
        confirmBox.appendChild(confirmDesc);
        confirmBox.appendChild(confirmErr);
        confirmBox.appendChild(confirmActions);

        uninstallOpenBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          confirmBox.hidden = false;
          confirmErr.hidden = true;
          positionPanel();
        });

        cancelBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          confirmBox.hidden = true;
          positionPanel();
        });

        confirmBtn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (typeof bridge.uninstall !== "function") return;
          confirmBtn.disabled = true;
          confirmBtn.textContent = t(locale, "uninstalling");
          confirmErr.hidden = true;
          Promise.resolve(bridge.uninstall())
            .then(function (rep) {
              if (rep && rep.ok === false) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = t(locale, "confirmUninstall");
                confirmErr.textContent = Array.isArray(rep.errors) && rep.errors.length
                  ? rep.errors.join("; ")
                  : (rep.error || t(locale, "uninstallFailed"));
                confirmErr.hidden = false;
                positionPanel();
                return;
              }
              closePanel();
              if (typeof opts.onUninstalled === "function") {
                opts.onUninstalled();
              } else {
                if (win && win.__agCodexEffortSliderInstance && typeof win.__agCodexEffortSliderInstance.stop === "function") {
                  win.__agCodexEffortSliderInstance.stop();
                }
                showUninstallCompleteToast({
                  document: doc,
                  window: win,
                  locale: locale,
                  platform: bridge.platform,
                  onRestart: function () {
                    return typeof bridge.relaunch === "function" ? bridge.relaunch() : null;
                  }
                });
              }
            })
            .catch(function (err) {
              confirmBtn.disabled = false;
              confirmBtn.textContent = t(locale, "confirmUninstall");
              confirmErr.textContent = t(locale, "uninstallError", {
                err: err && err.message ? err.message : t(locale, "unknownError")
              });
              confirmErr.hidden = false;
              positionPanel();
            });
        });

        dangerZone.appendChild(uninstallOpenBtn);
        dangerZone.appendChild(confirmBox);
        panel.appendChild(dangerZone);
      })();
    }

    refreshActiveButtons();
    var offSettings = onSettingsChange(function () {
      refreshActiveButtons();
    }, win);

    function closePanel() {
      offSettings();
      if (offBridgeState) {
        try { offBridgeState(); } catch (err) {}
        offBridgeState = null;
      }
      doc.removeEventListener("pointerdown", onDocPointerDown, true);
      doc.removeEventListener("keydown", onDocKeyDown, true);
      if (win && typeof win.removeEventListener === "function") {
        win.removeEventListener("resize", positionPanel);
      }
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    }

    closeBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      closePanel();
    });

    function onDocPointerDown(ev) {
      if (!panel.contains(ev.target)) {
        closePanel();
      }
    }
    function onDocKeyDown(ev) {
      if (ev && ev.key === "Escape") {
        ev.stopPropagation();
        closePanel();
      }
    }

    doc.addEventListener("pointerdown", onDocPointerDown, true);
    doc.addEventListener("keydown", onDocKeyDown, true);
    if (win && typeof win.addEventListener === "function") {
      win.addEventListener("resize", positionPanel);
    }

    panel.style.visibility = "hidden";
    doc.body.appendChild(panel);
    positionPanel();
    panel.style.visibility = "";
    return closePanel;
  }

  function installSettingsUi(options) {
    var opts = options || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
    if (!doc) return { stop: function () {} };

    var activeClose = null;
    var longPressTimer = null;
    var pressStartPos = null;

    function isInsideSlider(target) {
      if (!target || typeof target.closest !== "function") return null;
      return target.closest(".ces-inline, .ces-root, .ces-ag-effort-row");
    }

    function clearLongPress() {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      pressStartPos = null;
    }

    function onContextMenu(ev) {
      var host = isInsideSlider(ev.target);
      if (!host) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (activeClose) activeClose();
      activeClose = openSettingsPanel({
        document: doc,
        window: win,
        x: ev.clientX || 120,
        y: ev.clientY || 120
      });
    }

    function onKeyDown(ev) {
      var host = isInsideSlider(ev.target);
      if (!host) return;
      if (ev.key === "ContextMenu" || (ev.key === "F10" && ev.shiftKey)) {
        ev.preventDefault();
        ev.stopPropagation();
        var rect = host.getBoundingClientRect ? host.getBoundingClientRect() : { left: 120, bottom: 120 };
        if (activeClose) activeClose();
        activeClose = openSettingsPanel({
          document: doc,
          window: win,
          x: rect.left,
          y: rect.bottom + 4
        });
      }
    }

    function onPointerDown(ev) {
      var host = isInsideSlider(ev.target);
      if (!host || ev.button === 2) return;
      clearLongPress();
      pressStartPos = { x: ev.clientX || 0, y: ev.clientY || 0 };
      longPressTimer = setTimeout(function () {
        longPressTimer = null;
        if (activeClose) activeClose();
        activeClose = openSettingsPanel({
          document: doc,
          window: win,
          x: (pressStartPos && pressStartPos.x) || 120,
          y: (pressStartPos && pressStartPos.y) || 120
        });
      }, 500);
    }

    function onPointerMove(ev) {
      if (!pressStartPos || longPressTimer === null) return;
      var dx = (ev.clientX || 0) - pressStartPos.x;
      var dy = (ev.clientY || 0) - pressStartPos.y;
      if (dx * dx + dy * dy > 36) {
        clearLongPress();
      }
    }

    function onPointerUp() {
      clearLongPress();
    }

    doc.addEventListener("contextmenu", onContextMenu, true);
    doc.addEventListener("keydown", onKeyDown, true);
    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("pointermove", onPointerMove, true);
    doc.addEventListener("pointerup", onPointerUp, true);
    doc.addEventListener("pointercancel", onPointerUp, true);

    return {
      stop: function () {
        clearLongPress();
        if (activeClose) {
          activeClose();
          activeClose = null;
        }
        doc.removeEventListener("contextmenu", onContextMenu, true);
        doc.removeEventListener("keydown", onKeyDown, true);
        doc.removeEventListener("pointerdown", onPointerDown, true);
        doc.removeEventListener("pointermove", onPointerMove, true);
        doc.removeEventListener("pointerup", onPointerUp, true);
        doc.removeEventListener("pointercancel", onPointerUp, true);
      }
    };
  }

  // ── DOM 与 Antigravity React Fiber 解析辅助函数 ─────────────────────────────
  var INFERENCE_LABELS = [
    "推理等级",
    "推理等級",
    "Reasoning effort",
    "Reasoning Effort",
    "Thinking effort",
    "推理强度",
    "推論レベル",
    "추론 수준",
    "Effort de raisonnement",
    "Уровень рассуждения"
  ];

  function parseModelLabel(label) {
    if (!label || typeof label !== "string") return null;
    var match = AG_MODEL_LABEL_RE.exec(label.trim());
    if (!match) return null;
    var base = match[1].trim();
    var effort = normalizeEffortKey(match[2]);
    return {
      base: base,
      effort: effort,
      effortLabel: AG_EFFORT_LABELS[effort] || match[2]
    };
  }

  function parseModelDisplayText(text) {
    if (!text || typeof text !== "string") return null;
    var trimmed = text.trim();
    if (!trimmed) return null;
    var paren = parseModelLabel(trimmed);
    if (paren) return paren;
    var match = AG_DISPLAY_EFFORT_RE.exec(trimmed);
    if (!match) return null;
    var base = match[1].trim();
    if (!base) return null;
    var effort = normalizeEffortKey(match[2]);
    return {
      base: base,
      effort: effort,
      effortLabel: AG_EFFORT_LABELS[effort] || match[2]
    };
  }

  function isOrchestratorModelId(modelId) {
    if (!modelId || typeof modelId !== "string") return false;
    return (
      modelId === "gemini-pro-coordinator" ||
      modelId === "gemini-pro-orchestrator" ||
      modelId.indexOf("gemini-pro-orchestrator-") === 0
    );
  }

  function isOrchestratorOption(opt) {
    if (!opt || typeof opt !== "object" || opt.isCustom) return false;
    if (isOrchestratorModelId(opt.modelId)) return true;
    if (typeof opt.label === "string") {
      return /^orchestrator(?:\b|\s*\()/i.test(opt.label.trim());
    }
    return false;
  }

  function findAntigravityTrigger(doc) {
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d || typeof d.querySelector !== "function") return null;
    return (
      d.querySelector('[data-testid="model-selector-trigger"]') ||
      d.querySelector('button[aria-label^="Select model"]')
    );
  }

  function findAntigravityPanel(doc) {
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d || typeof d.querySelector !== "function") return null;
    return d.querySelector('[data-testid="model-selector-panel"]');
  }

  function findOrchestratorSubmenu(doc) {
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d || typeof d.querySelector !== "function") return null;
    var row = d.querySelector('[data-testid="orchestrator-picker-row"]');
    if (!row) return null;
    if (typeof row.closest === "function") {
      return row.closest('[role="menu"]') || row.parentElement || null;
    }
    return row.parentElement || null;
  }

  function findInferenceRow(doc) {
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d || typeof d.querySelectorAll !== "function") return null;
    var explicit = d.querySelector('[data-ces-effort-row="true"]');
    if (explicit) return explicit;

    var menus = d.querySelectorAll('[role="menu"], .surface-menu, [data-testid="model-selector-panel"]');
    for (var mIdx = 0; mIdx < menus.length; mIdx += 1) {
      var menu = menus[mIdx];
      var items = menu.querySelectorAll('[role="menuitem"], .ces-ag-effort-row, div, button');
      for (var i = 0; i < items.length; i += 1) {
        var el = items[i];
        var txt = (el.textContent || "").trim();
        for (var k = 0; k < INFERENCE_LABELS.length; k += 1) {
          var kw = INFERENCE_LABELS[k];
          if (txt === kw || txt.indexOf(kw) === 0) {
            return el.closest('[role="menuitem"]') || el;
          }
        }
      }
    }
    return null;
  }

  function findValueElement(row) {
    if (!row || typeof row.querySelector !== "function") return null;
    var explicit = row.querySelector('[data-ces-part="value"], .ces-ag-effort-value');
    if (explicit) return explicit;

    var children = row.querySelectorAll("span, div");
    var candidate = null;
    for (var i = 0; i < children.length; i += 1) {
      var child = children[i];
      if (child.closest && child.closest(".ces-inline")) continue;
      if (child.children && child.children.length > 0) continue;
      var t = (child.textContent || "").trim();
      if (!t) continue;
      var isHeaderLabel = false;
      for (var k = 0; k < INFERENCE_LABELS.length; k += 1) {
        if (t === INFERENCE_LABELS[k]) {
          isHeaderLabel = true;
          break;
        }
      }
      if (!isHeaderLabel) candidate = child;
    }
    return candidate;
  }

  function findEffortTrigger(doc) {
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d || typeof d.querySelectorAll !== "function") return null;

    // 1. 优先匹配 Antigravity 原生模型选择器按钮中的档位 span (<span class="opacity-70"> High</span>)
    var agTrigger = findAntigravityTrigger(d);
    if (agTrigger) {
      var effortSpan = agTrigger.querySelector("span.opacity-70, [data-ces-part='trigger-effort']");
      if (effortSpan) return effortSpan;
      return agTrigger;
    }

    // 2. 兼容通用 composer 触发器（如包含 " · " 的按钮）
    var composers = d.querySelectorAll(".surface-composer, .surface-composer-card, form, body");
    for (var cIdx = 0; cIdx < composers.length; cIdx += 1) {
      var buttons = composers[cIdx].querySelectorAll('button[aria-haspopup="menu"]');
      for (var bIdx = 0; bIdx < buttons.length; bIdx += 1) {
        var btn = buttons[bIdx];
        if ((btn.textContent || "").indexOf(" · ") >= 0) return btn;
      }
    }
    return null;
  }

  function syncTriggerColor(doc, label, index, count, isMax, hasOffFirst, isClaude, triggerOverride) {
    var d = doc || (typeof document !== "undefined" ? document : null);
    if (!d) return;
    var agTrigger = triggerOverride || findAntigravityTrigger(d);
    var claudeFlag = typeof isClaude === "boolean" ? isClaude : isClaudeModel(agTrigger ? agTrigger.textContent : "");
    var color = valueColorFor(label, index, count, isMax, hasOffFirst, claudeFlag) || "";

    // 1. Antigravity 原生触发按钮：只给档位后缀 span 着色，保持模型名称本身清晰易读（写前判脏防止互激回流）
    if (agTrigger) {
      var effortSpan = agTrigger.querySelector
        ? agTrigger.querySelector("span.opacity-70, [data-ces-part='trigger-effort']")
        : null;
      if (effortSpan) {
        var splitEffortEl = effortSpan.querySelector
          ? effortSpan.querySelector('[data-ces-part="trigger-orch-effort"]')
          : null;
        if (splitEffortEl) {
          if (splitEffortEl.style) {
            var splitOpacity = color ? "1" : "";
            var splitWeight = color ? "600" : "";
            if (splitEffortEl.style.color !== color) splitEffortEl.style.color = color;
            if (splitEffortEl.style.opacity !== splitOpacity) splitEffortEl.style.opacity = splitOpacity;
            if (splitEffortEl.style.fontWeight !== splitWeight) splitEffortEl.style.fontWeight = splitWeight;
          }
          if (effortSpan.style) {
            if (effortSpan.style.opacity !== "1") effortSpan.style.opacity = "1";
            if (effortSpan.style.color !== "") effortSpan.style.color = "";
            if (effortSpan.style.fontWeight !== "") effortSpan.style.fontWeight = "";
          }
          return;
        }
        if (typeof effortSpan.getAttribute !== "function" || effortSpan.getAttribute("data-ces-part") !== "trigger-effort") {
          effortSpan.setAttribute("data-ces-part", "trigger-effort");
        }
        if (effortSpan.style) {
          var nextOpacity = color ? "1" : "";
          var nextWeight = color ? "600" : "";
          if (effortSpan.style.color !== color) effortSpan.style.color = color;
          if (effortSpan.style.opacity !== nextOpacity) effortSpan.style.opacity = nextOpacity;
          if (effortSpan.style.fontWeight !== nextWeight) effortSpan.style.fontWeight = nextWeight;
        }
      }
      return;
    }

    // 2. 兼容通用触发按钮
    var trigger = findEffortTrigger(d);
    if (!trigger) return;
    var spans = trigger.querySelectorAll ? trigger.querySelectorAll("span") : [];
    var target = spans.length > 0 ? spans[spans.length - 1] : trigger;
    if (target.style && target.style.color !== color) {
      target.style.color = color;
    }
  }

  /**
   * 零强制回流重播 CSS 类动画：
   * 首次触发直接添加类名；重复触发优先通过 Web Animations API (getAnimations) 重启，绝不读 offsetWidth。
   */
  function replayAnimationClasses(el, classNames, options) {
    if (!el || !el.classList || !Array.isArray(classNames) || classNames.length === 0) return;
    var opts = options || {};
    var includeSubtree = Boolean(opts.includeSubtree);
    var allowedNames =
      Array.isArray(opts.animationNames) && opts.animationNames.length > 0 ? opts.animationNames : null;
    var hadAny = false;
    for (var i = 0; i < classNames.length; i += 1) {
      if (el.classList.contains(classNames[i])) {
        hadAny = true;
        break;
      }
    }
    if (!hadAny) {
      for (var j = 0; j < classNames.length; j += 1) {
        el.classList.add(classNames[j]);
      }
      return;
    }
    if (typeof el.getAnimations === "function") {
      try {
        var anims = null;
        if (includeSubtree) {
          try {
            anims = el.getAnimations({ subtree: true });
          } catch (errSub) {
            anims = el.getAnimations();
          }
        } else {
          anims = el.getAnimations();
        }
        for (var k = 0; k < classNames.length; k += 1) {
          el.classList.add(classNames[k]);
        }
        if (anims && anims.length > 0) {
          for (var a = 0; a < anims.length; a += 1) {
            var anim = anims[a];
            if (!anim) continue;
            if (typeof anim.transitionProperty === "string") continue;
            if (typeof anim.animationName === "string") {
              if (allowedNames) {
                if (allowedNames.indexOf(anim.animationName) < 0) continue;
              } else if (anim.animationName.indexOf("ces-") !== 0) {
                continue;
              }
            }
            if (typeof anim.cancel === "function" && typeof anim.play === "function") {
              anim.cancel();
              anim.play();
            }
          }
        }
        return;
      } catch (err) {
        // 忽略 Web Animations API 不可用或异常，降级为无回流类名切换
      }
    }
    for (var r = 0; r < classNames.length; r += 1) {
      el.classList.remove(classNames[r]);
    }
    for (var aIdx = 0; aIdx < classNames.length; aIdx += 1) {
      el.classList.add(classNames[aIdx]);
    }
  }

  var cachedReactFiberKey = "";

  function getReactFiber(el) {
    if (!el || typeof el !== "object") return null;
    var raw = cachedReactFiberKey && el[cachedReactFiberKey] ? el[cachedReactFiberKey] : null;
    if (!raw) {
      var keys = Object.keys(el);
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        if (k.indexOf("__reactFiber$") === 0 || k.indexOf("__reactInternalInstance$") === 0) {
          cachedReactFiberKey = k;
          raw = el[k];
          break;
        }
      }
    }
    if (!raw) return null;
    if (raw.alternate) {
      var root = raw;
      var guard = 0;
      while (root.return && guard < 80) {
        root = root.return;
        guard += 1;
      }
      if (root && root.stateNode && root.stateNode.current && root.stateNode.current !== root) {
        return raw.alternate;
      }
    }
    return raw;
  }

  var effortIndexCache = typeof WeakMap === "function" ? new WeakMap() : null;
  var normalizedEffortIndexCache = typeof WeakMap === "function" ? new WeakMap() : null;

  function buildEffortIndexFromOptions(modelOptions) {
    var list = Array.isArray(modelOptions) ? modelOptions : [];
    var firstItem = list[0];
    var lastItem = list[list.length - 1];
    if (effortIndexCache && Array.isArray(modelOptions)) {
      var cached = effortIndexCache.get(modelOptions);
      if (
        cached &&
        cached.length === list.length &&
        cached.first === firstItem &&
        cached.last === lastItem
      ) {
        return cached.map;
      }
    }
    var indexMap = new Map();
    for (var i = 0; i < list.length; i += 1) {
      var opt = list[i];
      if (!opt || opt.isCustom || typeof opt.label !== "string") continue;
      var parsed = parseModelLabel(opt.label);
      if (!parsed) continue;
      var byEffort = indexMap.get(parsed.base);
      if (!byEffort) {
        byEffort = new Map();
        indexMap.set(parsed.base, byEffort);
      }
      if (!byEffort.has(parsed.effort)) {
        byEffort.set(parsed.effort, opt);
      }
    }
    if (effortIndexCache && Array.isArray(modelOptions)) {
      effortIndexCache.set(modelOptions, {
        length: list.length,
        first: firstItem,
        last: lastItem,
        map: indexMap
      });
    }
    return indexMap;
  }

  function normalizeEffortKey(rawKey) {
    var key = String(rawKey || "").trim().toLowerCase().replace(/\s+/g, " ");
    // 兼容展示名 Extra / Extra High 与内部枚举 xhigh，统一归并到 xhigh
    if (key === "extra" || key === "extra high" || key === "extra-high" || key === "extra_high") {
      return "xhigh";
    }
    return key;
  }

  /**
   * 规范化单个模型的档位 Map 键名（小写并将 extra 归并到 xhigh）；
   * 若所有键名均已规范则零拷贝直接返回原 Map，避免热路径额外分配。
   */
  function normalizeEffortByMap(rawByEffort) {
    if (!(rawByEffort instanceof Map) || rawByEffort.size === 0) return null;
    var needsCopy = false;
    rawByEffort.forEach(function (_opt, rawKey) {
      if (needsCopy) return;
      if (typeof rawKey !== "string" || !rawKey || rawKey !== normalizeEffortKey(rawKey)) {
        needsCopy = true;
      }
    });
    if (!needsCopy) return rawByEffort;
    var out = new Map();
    rawByEffort.forEach(function (opt, rawKey) {
      var normKey = normalizeEffortKey(rawKey);
      if (normKey && !out.has(normKey)) {
        out.set(normKey, opt);
      }
    });
    return out;
  }

  /**
   * 将 Antigravity 宿主提供的 selectorCtx.effortIndex 规范化为同时支持「模型 slug ID」
   * （如 gemini-4-neon / gemini-3.8-flash / claude-opus-5-5）与「展示基础名」（如 Gemini 4 Neon）
   * 的双键索引，并通过 WeakMap 缓存实现 O(1) 复用。
   */
  function normalizeEffortIndex(rawEffortIndex, modelOptions, groups) {
    if (!(rawEffortIndex instanceof Map) || rawEffortIndex.size === 0) {
      return buildEffortIndexFromOptions(modelOptions);
    }
    var optsList = Array.isArray(modelOptions) ? modelOptions : [];
    var optsLen = optsList.length;
    var optsFirst = optsList[0];
    var optsLast = optsList[optsLen - 1];
    if (normalizedEffortIndexCache) {
      var cached = normalizedEffortIndexCache.get(rawEffortIndex);
      if (
        cached &&
        cached.rawSize === rawEffortIndex.size &&
        cached.optsRef === modelOptions &&
        cached.optsLen === optsLen &&
        cached.optsFirst === optsFirst &&
        cached.optsLast === optsLast
      ) {
        return cached.map;
      }
    }

    var merged = new Map();

    // 1. 保留原始 key（slug 或旧版显示名），同时从内层 opt.label 反解展示基础名写入别名
    rawEffortIndex.forEach(function (rawByEffort, rawKey) {
      var byEffort = normalizeEffortByMap(rawByEffort);
      if (!byEffort || byEffort.size === 0) return;
      if (typeof rawKey === "string" && rawKey && !merged.has(rawKey)) {
        merged.set(rawKey, byEffort);
      }
      byEffort.forEach(function (opt) {
        if (!opt || opt.isCustom || typeof opt.label !== "string") return;
        var parsed = parseModelLabel(opt.label);
        if (parsed && parsed.base && !merged.has(parsed.base)) {
          merged.set(parsed.base, byEffort);
        }
      });
    });

    // 2. 补充从 selectorCtx.groups 提取的 key -> displayName 别名映射
    if (Array.isArray(groups)) {
      for (var gIdx = 0; gIdx < groups.length; gIdx += 1) {
        var g = groups[gIdx];
        if (!g || typeof g !== "object") continue;
        var gKey = g.key || g.id || g.groupKey || g.familyKey || g.slug || g.baseId;
        var gDisplay = g.baseName || g.base || g.label || g.displayName || g.name;
        if (
          typeof gKey === "string" &&
          gKey &&
          typeof gDisplay === "string" &&
          gDisplay &&
          merged.has(gKey) &&
          !merged.has(gDisplay)
        ) {
          merged.set(gDisplay, merged.get(gKey));
        }
      }
    }

    // 3. 合并由 modelOptions 解析得到的条目，兜底 rawEffortIndex 未覆盖的模型（如单档模型）
    var optIndex = buildEffortIndexFromOptions(modelOptions);
    if (optIndex instanceof Map && optIndex.size > 0) {
      optIndex.forEach(function (byEff, baseKey) {
        if (baseKey && byEff instanceof Map && byEff.size > 0 && !merged.has(baseKey)) {
          merged.set(baseKey, byEff);
        }
      });
    }

    if (normalizedEffortIndexCache) {
      normalizedEffortIndexCache.set(rawEffortIndex, {
        rawSize: rawEffortIndex.size,
        optsRef: modelOptions,
        optsLen: optsLen,
        optsFirst: optsFirst,
        optsLast: optsLast,
        map: merged
      });
    }
    return merged;
  }

  /**
   * 按模型基础名查询档位映射；直查未命中时依次尝试保留小数点 slug（如 gemini-3.8-flash）
   * 与全横杠 slug（如 claude-opus-5-5）兜底，零常规路径额外开销。
   */
  function lookupEffortByBaseName(effortIndex, baseName) {
    if (typeof baseName !== "string" || !baseName || !(effortIndex instanceof Map)) return null;
    var direct = effortIndex.get(baseName);
    if (direct instanceof Map) return direct;
    var lower = baseName.toLowerCase();
    var slugWithDot = lower.replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
    if (slugWithDot && slugWithDot !== baseName) {
      var dotHit = effortIndex.get(slugWithDot);
      if (dotHit instanceof Map) return dotHit;
    }
    var slugAllDash = lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (slugAllDash && slugAllDash !== slugWithDot && slugAllDash !== baseName) {
      var dashHit = effortIndex.get(slugAllDash);
      if (dashHit instanceof Map) return dashHit;
    }
    return null;
  }

  var docGlobalCtxPresence = typeof WeakMap === "function" ? new WeakMap() : null;

  /**
   * 从 Antigravity 的 DOM 节点向上遍历 React Fiber 树，提取：
   * - ModelSelectorProvider: effortIndex, modelOptions, selectedModel, groups, orchestrator*
   * - ModelSelectorPopover : 未包装 setIsOpen(false) 的外层 setSelectedModel, open, setIsOpen
   * - ConversationModelSelector: conversationId
   * - 旧版 GlobalModelContext: setModelConfigByLabelForConversation（直接切档不关菜单、不抢焦点）
   */
  function readAntigravityFiberContext(el) {
    var startFiber = getReactFiber(el);
    if (!startFiber) return null;

    var ownerDoc = el && el.ownerDocument && typeof el.ownerDocument === "object" ? el.ownerDocument : null;
    var globalCtxConfirmedAbsent = Boolean(
      ownerDoc && docGlobalCtxPresence && docGlobalCtxPresence.get(ownerDoc) === false
    );

    var selectorCtx = null;
    var innerPopoverProps = null;
    var outerPopoverProps = null;
    var conversationId = undefined;
    var hasConversationSelector = false;
    var globalModelCtx = null;

    var cur = startFiber;
    for (var step = 0; cur && step < 500; step += 1, cur = cur.return) {
      var props = cur.memoizedProps;
      if (!props || typeof props !== "object") continue;

      // 1. ModelSelectorProvider
      if (!selectorCtx && props.value && typeof props.value === "object") {
        var val = props.value;
        if (val.effortIndex instanceof Map && Array.isArray(val.modelOptions)) {
          selectorCtx = val;
        }
      }

      // 2. ModelSelectorPopover 及其各层包装
      if (
        typeof props.setIsOpen === "function" &&
        typeof props.setSelectedModel === "function" &&
        Array.isArray(props.modelOptions)
      ) {
        if (!innerPopoverProps) innerPopoverProps = props;
        outerPopoverProps = props;
      }

      // 3. ConversationModelSelector
      if (!hasConversationSelector && ("conversationId" in props) && ("placement" in props)) {
        hasConversationSelector = true;
        conversationId = props.conversationId;
      }

      // 4. 旧版 GlobalModelContext（新版 Antigravity 2.34+ 已移除）
      if (
        !globalModelCtx &&
        props.value &&
        typeof props.value === "object" &&
        typeof props.value.setModelConfigByLabelForConversation === "function"
      ) {
        globalModelCtx = props.value;
        if (ownerDoc && docGlobalCtxPresence) {
          docGlobalCtxPresence.set(ownerDoc, true);
        }
      }

      if (
        selectorCtx &&
        outerPopoverProps &&
        hasConversationSelector &&
        (globalModelCtx || globalCtxConfirmedAbsent)
      ) {
        break;
      }
      if (
        !globalModelCtx &&
        globalCtxConfirmedAbsent &&
        outerPopoverProps &&
        hasConversationSelector &&
        (selectorCtx || step > 60)
      ) {
        break;
      }
    }

    if (
      !cur &&
      !globalModelCtx &&
      outerPopoverProps &&
      hasConversationSelector &&
      ownerDoc &&
      docGlobalCtxPresence &&
      !docGlobalCtxPresence.has(ownerDoc)
    ) {
      docGlobalCtxPresence.set(ownerDoc, false);
    }

    if (!selectorCtx && !innerPopoverProps && !outerPopoverProps && !globalModelCtx) return null;

    var modelOptions =
      (outerPopoverProps && outerPopoverProps.modelOptions) ||
      (innerPopoverProps && innerPopoverProps.modelOptions) ||
      (selectorCtx && selectorCtx.modelOptions) ||
      (globalModelCtx && globalModelCtx.visibleModelConfigs) ||
      [];

    var selectedModel =
      (outerPopoverProps && outerPopoverProps.selectedModel) ||
      (innerPopoverProps && innerPopoverProps.selectedModel) ||
      (selectorCtx && selectorCtx.selectedModel) ||
      (globalModelCtx &&
        (hasConversationSelector && typeof globalModelCtx.getModelConfigForConversation === "function"
          ? globalModelCtx.getModelConfigForConversation(conversationId)
          : globalModelCtx.currentModelConfig)) ||
      null;

    var effortIndex = normalizeEffortIndex(
      selectorCtx && selectorCtx.effortIndex instanceof Map ? selectorCtx.effortIndex : null,
      modelOptions,
      selectorCtx && selectorCtx.groups
    );

    // ★ 关键：在 Antigravity IDE (VSCode / agy.exe) 中：
    // 外层 ConversationModelSelector 将原始未包装的 setSelectedModel 传给外层 Popover；
    // 内层 Popover 包装层将其包装为关闭菜单的版本再传给子组件和 Provider；
    // 爬树遍历时从内部向外爬，innerPopoverProps 是带强制闭合菜单逻辑的内层包装，
    // 而最外层的 outerPopoverProps 才是最原始未包装关菜单的纯净 setter！
    var unwrappedSetter =
      (outerPopoverProps && typeof outerPopoverProps.setSelectedModel === "function" ? outerPopoverProps.setSelectedModel : null) ||
      (innerPopoverProps && typeof innerPopoverProps.setSelectedModel === "function" ? innerPopoverProps.setSelectedModel : null) ||
      (selectorCtx && typeof selectorCtx.setSelectedModel === "function" ? selectorCtx.setSelectedModel : null);

    var setIsOpenFn =
      (outerPopoverProps && typeof outerPopoverProps.setIsOpen === "function" ? outerPopoverProps.setIsOpen : null) ||
      (innerPopoverProps && typeof innerPopoverProps.setIsOpen === "function" ? innerPopoverProps.setIsOpen : null) ||
      (selectorCtx && typeof selectorCtx.setIsOpen === "function" ? selectorCtx.setIsOpen : null);

    var orchestratorPlanners =
      (selectorCtx && Array.isArray(selectorCtx.orchestratorPlanners) ? selectorCtx.orchestratorPlanners : null) ||
      (outerPopoverProps && Array.isArray(outerPopoverProps.orchestratorPlanners) ? outerPopoverProps.orchestratorPlanners : null) ||
      (innerPopoverProps && Array.isArray(innerPopoverProps.orchestratorPlanners) ? innerPopoverProps.orchestratorPlanners : null) ||
      [];

    var rawOrchIndex =
      (selectorCtx && selectorCtx.orchestratorPlannerIndex instanceof Map ? selectorCtx.orchestratorPlannerIndex : null) ||
      (outerPopoverProps && outerPopoverProps.orchestratorPlannerIndex instanceof Map ? outerPopoverProps.orchestratorPlannerIndex : null) ||
      (innerPopoverProps && innerPopoverProps.orchestratorPlannerIndex instanceof Map ? innerPopoverProps.orchestratorPlannerIndex : null);

    var orchestratorPlannerIndex = orchestratorPlanners.length > 0
      ? normalizeEffortIndex(rawOrchIndex, orchestratorPlanners, null)
      : new Map();

    var orchestratorDefaultPlanner =
      (selectorCtx && selectorCtx.orchestratorDefaultPlanner) ||
      (outerPopoverProps && outerPopoverProps.orchestratorDefaultPlanner) ||
      (innerPopoverProps && innerPopoverProps.orchestratorDefaultPlanner) ||
      null;

    var orchestratorPick =
      (selectorCtx && selectorCtx.orchestratorPick) ||
      (outerPopoverProps && outerPopoverProps.orchestratorPick) ||
      (innerPopoverProps && innerPopoverProps.orchestratorPick) ||
      null;

    var orchestratorModelOption = null;
    for (var mIdx = 0; mIdx < modelOptions.length; mIdx += 1) {
      var optItem = modelOptions[mIdx];
      if (!optItem || !isOrchestratorOption(optItem)) continue;
      if (!optItem.disabled) {
        orchestratorModelOption = optItem;
        break;
      }
      if (!orchestratorModelOption) {
        orchestratorModelOption = optItem;
      }
    }

    var hasOrchestratorPlanners = Boolean(
      orchestratorPlanners.length > 0 &&
      orchestratorPick &&
      typeof orchestratorPick.select === "function"
    );

    var isOrchestratorSelected = Boolean(
      selectedModel &&
      isOrchestratorOption(selectedModel) &&
      hasOrchestratorPlanners
    );

    return {
      effortIndex: effortIndex,
      modelOptions: modelOptions,
      selectedModel: selectedModel,
      groups: (selectorCtx && selectorCtx.groups) || [],
      conversationId: conversationId,
      hasConversationSelector: hasConversationSelector,
      setModelConfigByLabelForConversation:
        globalModelCtx && typeof globalModelCtx.setModelConfigByLabelForConversation === "function"
          ? globalModelCtx.setModelConfigByLabelForConversation
          : null,
      setCurrentModelConfigByLabel:
        globalModelCtx && typeof globalModelCtx.setCurrentModelConfigByLabel === "function"
          ? globalModelCtx.setCurrentModelConfigByLabel
          : null,
      unwrappedSetSelectedModel: unwrappedSetter,
      setIsOpen: setIsOpenFn,
      isOpen: Boolean((outerPopoverProps && outerPopoverProps.open) || (innerPopoverProps && innerPopoverProps.open)),
      orchestratorPlanners: orchestratorPlanners,
      orchestratorPlannerIndex: orchestratorPlannerIndex,
      orchestratorDefaultPlanner: orchestratorDefaultPlanner,
      orchestratorPick: orchestratorPick,
      orchestratorModelOption: orchestratorModelOption,
      hasOrchestratorPlanners: hasOrchestratorPlanners,
      isOrchestratorSelected: isOrchestratorSelected
    };
  }

  /**
   * 解析当前 Orchestrator 会话选用的规划器子模型：
   * 1. 若 orchestratorPick.model 非 0 (UNSPECIFIED)，直接按枚举 value 在 orchestratorPlanners 中查找；
   * 2. 若为 0，则尝试从 DOM（主面板 Orchestrator 行或触发按钮）反查全局默认规划器；
   * 3. 否则回退到 orchestratorDefaultPlanner 或列表首项。
   */
  function resolveCurrentOrchestratorPlanner(ctx, doc) {
    if (!ctx || !Array.isArray(ctx.orchestratorPlanners) || ctx.orchestratorPlanners.length === 0) {
      return null;
    }
    var planners = ctx.orchestratorPlanners;
    var pickModel = ctx.orchestratorPick ? ctx.orchestratorPick.model : undefined;
    if (pickModel !== undefined && pickModel !== null && pickModel !== 0) {
      for (var i = 0; i < planners.length; i += 1) {
        if (planners[i] && planners[i].value === pickModel) {
          return planners[i];
        }
      }
    }

    var d = doc || (typeof document !== "undefined" ? document : null);
    if (d && typeof d.querySelector === "function" && ctx.orchestratorPlannerIndex instanceof Map) {
      var orchSpan = d.querySelector('[data-testid="model-selector-orchestrator-model"]');
      if (orchSpan) {
        var dataBase = typeof orchSpan.getAttribute === "function" ? orchSpan.getAttribute("data-ces-planner-base") : "";
        var dataEffort = typeof orchSpan.getAttribute === "function" ? orchSpan.getAttribute("data-ces-planner-effort") : "";
        if (dataBase && dataEffort) {
          var dataMap = lookupEffortByBaseName(ctx.orchestratorPlannerIndex, dataBase);
          var normDataEffort = normalizeEffortKey(dataEffort);
          if (dataMap && dataMap.has(normDataEffort)) {
            return dataMap.get(normDataEffort);
          }
        }
        var parsedSpan = parseModelDisplayText(orchSpan.textContent || "");
        if (parsedSpan) {
          var spanMap = lookupEffortByBaseName(ctx.orchestratorPlannerIndex, parsedSpan.base);
          if (spanMap && spanMap.has(parsedSpan.effort)) {
            return spanMap.get(parsedSpan.effort);
          }
        }
      }
      var triggerBtn = findAntigravityTrigger(d);
      if (triggerBtn) {
        var outerSpan = triggerBtn.querySelector ? triggerBtn.querySelector("span.min-w-0") : null;
        var mainText = outerSpan && outerSpan.firstChild && outerSpan.firstChild.nodeType === 3
          ? String(outerSpan.firstChild.nodeValue || "").trim()
          : "";
        if (mainText === "Orchestrator") {
          var trigEffort = outerSpan.querySelector ? outerSpan.querySelector("span.opacity-70, [data-ces-part='trigger-effort']") : null;
          if (trigEffort) {
            var parsedTrig = parseModelDisplayText(trigEffort.textContent || "");
            if (parsedTrig) {
              var trigMap = lookupEffortByBaseName(ctx.orchestratorPlannerIndex, parsedTrig.base);
              if (trigMap && trigMap.has(parsedTrig.effort)) {
                return trigMap.get(parsedTrig.effort);
              }
            }
          }
        }
      }
    }

    if (ctx.orchestratorDefaultPlanner) {
      for (var j = 0; j < planners.length; j += 1) {
        if (planners[j] && planners[j].value === ctx.orchestratorDefaultPlanner.value) {
          return planners[j];
        }
      }
      return ctx.orchestratorDefaultPlanner;
    }
    return planners[0] || null;
  }

  function resolveOrchestratorPlannerProfile(ctx, targetPlannerOrBase, perOrchestratorEffortMap, doc) {
    if (!ctx || !ctx.hasOrchestratorPlanners) return null;
    var activePlanner = resolveCurrentOrchestratorPlanner(ctx, doc);
    var plannerObj = null;
    var plannerBase = "";
    var activeEffort = "";

    if (typeof targetPlannerOrBase === "string" && targetPlannerOrBase) {
      plannerBase = targetPlannerOrBase;
    } else if (targetPlannerOrBase && typeof targetPlannerOrBase === "object") {
      plannerObj = targetPlannerOrBase;
    } else {
      plannerObj = activePlanner;
    }

    if (plannerObj && typeof plannerObj.label === "string") {
      var parsed = parseModelLabel(plannerObj.label);
      if (parsed) {
        plannerBase = parsed.base;
        activeEffort = parsed.effort;
      } else {
        plannerBase = plannerObj.label;
      }
    }

    var byEffort = lookupEffortByBaseName(ctx.orchestratorPlannerIndex, plannerBase);
    if (byEffort && byEffort.size >= 2) {
      var sortedKeys = [];
      for (var i = 0; i < AG_EFFORT_ORDER.length; i += 1) {
        var key = AG_EFFORT_ORDER[i];
        if (byEffort.has(key)) sortedKeys.push(key);
      }
      if (!activeEffort) {
        if (perOrchestratorEffortMap && perOrchestratorEffortMap.has(plannerBase)) {
          var remembered = perOrchestratorEffortMap.get(plannerBase);
          if (byEffort.has(remembered)) activeEffort = remembered;
        }
        if (!activeEffort) {
          var actParsed = activePlanner && parseModelLabel(activePlanner.label);
          if (actParsed && actParsed.base === plannerBase && byEffort.has(actParsed.effort)) {
            activeEffort = actParsed.effort;
          } else if (byEffort.has("medium")) {
            activeEffort = "medium";
          } else {
            activeEffort = sortedKeys[0] || "";
          }
        }
      }
      var levels = sortedKeys.map(function (k) {
        var opt = byEffort.get(k);
        return {
          effort: k,
          label: AG_EFFORT_LABELS[k] || k,
          modelOption: opt
        };
      });
      var currentIndex = Math.max(0, sortedKeys.indexOf(activeEffort));
      var resolvedEffort = sortedKeys[currentIndex] || activeEffort;
      var isClaude = isClaudeModel(plannerBase);
      return {
        isOrchestrator: true,
        orchestratorLabel: "Orchestrator",
        baseName: plannerBase,
        plannerBaseName: plannerBase,
        isClaude: isClaude,
        theme: isClaude ? "claude" : "codex",
        locked: false,
        levels: levels,
        currentIndex: currentIndex,
        currentEffort: resolvedEffort,
        currentLabel: AG_EFFORT_LABELS[resolvedEffort] || resolvedEffort,
        modelOption: byEffort.get(resolvedEffort) || plannerObj,
        orchestratorOption: ctx.orchestratorModelOption
      };
    }

    var singleParsed = plannerObj && parseModelLabel(plannerObj.label);
    var singleEffort = singleParsed ? singleParsed.effort : "medium";
    var singleLabel = singleParsed ? singleParsed.effortLabel : "固定";
    var resolvedSingleBase = plannerBase || (plannerObj && plannerObj.label) || "";
    var isClaudeSingle = isClaudeModel(resolvedSingleBase);
    return {
      isOrchestrator: true,
      orchestratorLabel: "Orchestrator",
      baseName: resolvedSingleBase,
      plannerBaseName: resolvedSingleBase,
      isClaude: isClaudeSingle,
      theme: isClaudeSingle ? "claude" : "codex",
      locked: true,
      levels: [
        {
          effort: singleEffort,
          label: singleLabel,
          modelOption: plannerObj
        }
      ],
      currentIndex: 0,
      currentEffort: singleEffort,
      currentLabel: singleLabel,
      modelOption: plannerObj,
      orchestratorOption: ctx.orchestratorModelOption
    };
  }

  /**
   * 剖析当前选中模型（或指定 baseName 模型）在 Antigravity 中的可用推理档位列表
   */
  function resolveModelEffortProfile(ctx, targetModelOrBase, perModelEffortMap, perOrchestratorEffortMap, doc) {
    if (!ctx) return null;
    var selected = ctx.selectedModel;
    var modelObj = null;
    var baseName = "";
    var activeEffort = "";

    if (typeof targetModelOrBase === "string" && targetModelOrBase) {
      baseName = targetModelOrBase;
    } else if (targetModelOrBase && typeof targetModelOrBase === "object") {
      modelObj = targetModelOrBase;
    } else {
      modelObj = selected;
    }

    if (
      ctx.hasOrchestratorPlanners &&
      ((modelObj && isOrchestratorOption(modelObj)) || (!modelObj && /^orchestrator$/i.test(baseName.trim())))
    ) {
      return resolveOrchestratorPlannerProfile(ctx, null, perOrchestratorEffortMap || null, doc);
    }

    if (modelObj && typeof modelObj.label === "string") {
      var parsed = parseModelLabel(modelObj.label);
      if (parsed) {
        baseName = parsed.base;
        activeEffort = parsed.effort;
      } else {
        baseName = modelObj.label;
      }
    }

    var byEffort = lookupEffortByBaseName(ctx.effortIndex, baseName);
    if (byEffort && byEffort.size >= 2) {
      var sortedKeys = [];
      for (var i = 0; i < AG_EFFORT_ORDER.length; i += 1) {
        var key = AG_EFFORT_ORDER[i];
        if (byEffort.has(key)) sortedKeys.push(key);
      }
      if (!activeEffort) {
        if (perModelEffortMap && perModelEffortMap.has(baseName)) {
          var remembered = perModelEffortMap.get(baseName);
          if (byEffort.has(remembered)) activeEffort = remembered;
        }
        if (!activeEffort) {
          var selParsed = selected && parseModelLabel(selected.label);
          if (selParsed && selParsed.base === baseName && byEffort.has(selParsed.effort)) {
            activeEffort = selParsed.effort;
          } else if (byEffort.has("medium")) {
            activeEffort = "medium";
          } else {
            activeEffort = sortedKeys[0] || "";
          }
        }
      }
      var levels = sortedKeys.map(function (k) {
        var opt = byEffort.get(k);
        return {
          effort: k,
          label: AG_EFFORT_LABELS[k] || k,
          modelOption: opt
        };
      });
      var currentIndex = Math.max(0, sortedKeys.indexOf(activeEffort));
      var isClaude = isClaudeModel(baseName);
      var theme = isClaude ? "claude" : "codex";
      return {
        baseName: baseName,
        isClaude: isClaude,
        theme: theme,
        locked: false,
        levels: levels,
        currentIndex: currentIndex,
        currentEffort: sortedKeys[currentIndex] || activeEffort,
        currentLabel: AG_EFFORT_LABELS[sortedKeys[currentIndex]] || activeEffort,
        modelOption: byEffort.get(sortedKeys[currentIndex]) || modelObj
      };
    }

    // 单档位模型（如 GPT-OSS 120B (Medium)）或自定义模型：锁定不可拖动
    var singleParsed = modelObj && parseModelLabel(modelObj.label);
    var singleEffort = singleParsed ? singleParsed.effort : "medium";
    var singleLabel = singleParsed ? singleParsed.effortLabel : "固定";
    var isClaudeSingle = isClaudeModel(baseName || (modelObj && modelObj.label));
    return {
      baseName: baseName || (modelObj && modelObj.label) || "",
      isClaude: isClaudeSingle,
      theme: isClaudeSingle ? "claude" : "codex",
      locked: true,
      levels: [
        {
          effort: singleEffort,
          label: singleLabel,
          modelOption: modelObj
        }
      ],
      currentIndex: 0,
      currentEffort: singleEffort,
      currentLabel: singleLabel,
      modelOption: modelObj
    };
  }

  function commitOrchestratorPlannerOption(ctx, targetPlannerOption, ensureOrchestratorSelected) {
    if (!ctx || !targetPlannerOption) return false;
    var ok = false;
    if (ctx.orchestratorPick && typeof ctx.orchestratorPick.select === "function") {
      try {
        ctx.orchestratorPick.select(targetPlannerOption.value);
        ok = true;
      } catch (err) {
        tracePush("ag-orch-commit-error", { message: String(err && err.message ? err.message : err) });
      }
    }
    if (ensureOrchestratorSelected && ctx.orchestratorModelOption) {
      ok = commitAntigravityModelOption(ctx, ctx.orchestratorModelOption) || ok;
    }
    return ok;
  }

  var cachedEditableEl = null;

  function commitAntigravityModelOption(ctx, targetOption) {
    if (!ctx || !targetOption || !targetOption.label) return false;
    try {
      // 优先调用旧版 GlobalModelContext 的 setModelConfigByLabelForConversation：
      // 直接更新当前会话与全局默认模型，不触发 Popover 的 setIsOpen(false) 关菜单，也不触发编辑器抢焦点
      if (typeof ctx.setModelConfigByLabelForConversation === "function") {
        ctx.setModelConfigByLabelForConversation(targetOption.label, ctx.conversationId, true);
        return true;
      }
      if (typeof ctx.unwrappedSetSelectedModel === "function") {
        // 核心保护：
        // 1. 宿主 setSelectedModel 内部最后会同步调用 getLexicalEditor()?.focus() 抢夺焦点，
        //    导致 Radix Popover / @base-ui/react 菜单捕获 focusout/onFocusOutside 触发关闭；
        //    此处在调用期间临时屏蔽 Lexical editor 及全局 DOM focus 抢夺
        var doc = typeof document !== "undefined" ? document : null;
        var editable =
          cachedEditableEl && cachedEditableEl.ownerDocument === doc && cachedEditableEl.isConnected === true
            ? cachedEditableEl
            : (doc && doc.querySelector ? doc.querySelector('[contenteditable="true"]') : null);
        if (editable && editable.isConnected === true) {
          cachedEditableEl = editable;
        } else if (!editable) {
          cachedEditableEl = null;
        }
        var editorInst = editable ? editable.__lexicalEditor : null;
        var editorProto = editorInst ? Object.getPrototypeOf(editorInst) : null;
        var origEditorFocus = editorProto && typeof editorProto.focus === "function" ? editorProto.focus : null;
        var origInstFocus = editorInst && Object.prototype.hasOwnProperty.call(editorInst, "focus") ? editorInst.focus : null;

        var origHtmlFocus = typeof HTMLElement !== "undefined" && HTMLElement.prototype ? HTMLElement.prototype.focus : null;
        var origElemFocus = typeof Element !== "undefined" && Element.prototype ? Element.prototype.focus : null;

        var noop = function () {};
        if (origEditorFocus) editorProto.focus = noop;
        if (origInstFocus) editorInst.focus = noop;
        if (origHtmlFocus) HTMLElement.prototype.focus = noop;
        if (origElemFocus) Element.prototype.focus = noop;

        try {
          ctx.unwrappedSetSelectedModel(targetOption);
        } finally {
          if (origEditorFocus) editorProto.focus = origEditorFocus;
          if (origInstFocus) editorInst.focus = origInstFocus;
          if (origHtmlFocus) HTMLElement.prototype.focus = origHtmlFocus;
          if (origElemFocus) Element.prototype.focus = origElemFocus;
        }

        // 2. 强保障：确保菜单保持开启状态
        if (typeof ctx.setIsOpen === "function") {
          try {
            ctx.setIsOpen(true);
          } catch (err) {
            // 忽略外部状态同步异常
          }
        }
        return true;
      }
      if (typeof ctx.setCurrentModelConfigByLabel === "function") {
        ctx.setCurrentModelConfigByLabel(targetOption.label);
        return true;
      }
    } catch (err) {
      tracePush("ag-commit-error", { message: String(err && err.message ? err.message : err) });
    }
    return false;
  }

  // ── 核心滑条挂载器（零外部框架依赖，纯 DOM + 连续物理帧循环） ─────────────────
  function extractEffortKey(item) {
    if (item === null || item === undefined) return "";
    if (typeof item === "string") return item;
    if (typeof item === "object") {
      return String(item.effort || item.id || item.value || item.key || item.label || "");
    }
    return String(item);
  }

  function extractEffortDisplayLabel(item, effortKey, seat) {
    if (item && typeof item === "object" && typeof item.label === "string" && item.label) {
      return item.label;
    }
    if (seat && typeof seat.formatEffortLabel === "function") {
      try {
        var formatted = seat.formatEffortLabel(effortKey);
        if (formatted) return String(formatted);
      } catch (err) {
        // 忽略格式化异常
      }
    }
    var lower = String(effortKey || "").toLowerCase();
    if (AG_EFFORT_LABELS[lower]) return AG_EFFORT_LABELS[lower];
    return String(effortKey || "");
  }

  function mountCodexEffortSlider(options) {
    var opts = options || {};
    var container = opts.container;
    var seat = opts.seat;
    var doc = opts.document || (container && container.ownerDocument) || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);

    if (!container || !doc) {
      return { unmount: function () {}, refresh: function () {} };
    }

    installStyles(doc);

    // 清空宿主容器并构建四层轨道 DOM 结构：fill / energy+sweep / stars+dot / knob
    container.innerHTML = "";
    var rootEl = doc.createElement("div");
    rootEl.className = "ces-root";
    rootEl.setAttribute("role", "slider");
    rootEl.setAttribute("aria-label", t(detectUiLocale(win), "sliderLabel"));

    var trackEl = doc.createElement("div");
    trackEl.className = "ces-track";
    trackEl.setAttribute("data-ces-part", "track");

    var fillEl = doc.createElement("div");
    fillEl.className = "ces-fill";
    fillEl.setAttribute("data-ces-part", "fill");
    trackEl.appendChild(fillEl);

    var energyEl = doc.createElement("div");
    energyEl.className = "ces-energy";
    energyEl.setAttribute("data-ces-part", "energy");
    var sweepEl = doc.createElement("div");
    sweepEl.className = "ces-energy__sweep";
    sweepEl.setAttribute("data-ces-part", "sweep");
    energyEl.appendChild(sweepEl);
    trackEl.appendChild(energyEl);

    var starsEl = doc.createElement("div");
    starsEl.className = "ces-stars";
    starsEl.setAttribute("data-ces-part", "stars");

    var starsStageEl = doc.createElement("div");
    starsStageEl.className = "ces-stars__stage";
    starsStageEl.setAttribute("data-ces-part", "stars-stage");

    var starNodes = [];
    for (var sIdx = 0; sIdx < PARTICLES.length; sIdx += 1) {
      var p = PARTICLES[sIdx];
      var starEl = doc.createElement("span");
      starEl.className = "ces-star is-hidden";
      starEl.setAttribute("data-ces-part", "star");
      starEl.style.top = p.y + "%";

      var dotEl = doc.createElement("span");
      dotEl.className = "ces-star__dot";
      dotEl.setAttribute("data-ces-part", "particle");
      var bStr = p.brightness.toFixed(3);
      dotEl.setAttribute("data-brightness", bStr);
      dotEl.style.setProperty("--ces-b", bStr);
      starEl.appendChild(dotEl);

      starsStageEl.appendChild(starEl);
      starNodes.push({ el: starEl, dot: dotEl, meta: p });
    }
    starsEl.appendChild(starsStageEl);
    trackEl.appendChild(starsEl);

    var ticksEl = doc.createElement("div");
    ticksEl.className = "ces-ticks";
    ticksEl.setAttribute("data-ces-part", "ticks");
    trackEl.appendChild(ticksEl);

    var claudeCanvasEl = doc.createElement("canvas");
    claudeCanvasEl.className = "ces-claude-canvas";
    claudeCanvasEl.setAttribute("data-ces-part", "claude-canvas");
    claudeCanvasEl.width = 280;
    claudeCanvasEl.height = 28;
    trackEl.appendChild(claudeCanvasEl);

    var knobRailEl = doc.createElement("div");
    knobRailEl.className = "ces-knob-rail";
    knobRailEl.setAttribute("data-ces-part", "knob-rail");
    var knobCarrierEl = doc.createElement("div");
    knobCarrierEl.className = "ces-knob-carrier";
    knobCarrierEl.setAttribute("data-ces-part", "knob-carrier");
    var knobEl = doc.createElement("div");
    knobEl.className = "ces-knob";
    knobEl.setAttribute("data-ces-part", "knob");
    var knobNotchEl = doc.createElement("div");
    knobNotchEl.className = "ces-knob-notch";
    knobEl.appendChild(knobNotchEl);
    knobCarrierEl.appendChild(knobEl);
    knobRailEl.appendChild(knobCarrierEl);
    trackEl.appendChild(knobRailEl);

    rootEl.appendChild(trackEl);
    container.appendChild(rootEl);

    // ── 内部状态机 ──────────────────────────────────────────────────────────
    var destroyed = false;
    var rafId = null;
    var lastFrameMs = 0;

    var claudeRafId = null;
    var claudeAnimStart = 0;
    // 点阵流动相位（秒）：按「帧间隔 × 当前速度倍率」累加，而不是 elapsed × 倍率，
    // 这样拖动中速度连续变化时波纹不会因倍率突变而跳帧/倒退
    var claudeFlowTime = 0;
    var claudeLastTs = 0;
    // 当前位置对应的强度、速度与激活标记（由 applyVisualPct 刷新，60fps 循环零 Fiber 遍历读取）
    var claudeIntensity = 0;
    var claudeSpeed = 0;
    var claudeActive = false;

    var dragging = false;
    var hasDragged = false;
    var downClientX = null;
    var buttonDown = false;
    var draftPct = null;
    var draftIndex = null;
    var snapIndex = null;
    var detentIndex = -1;
    var lastCommittedIndex = -1;

    var lastPtrPct = null;
    var lastPtrMs = 0;
    var ptrSpeed = 0;

    var motionState = null;
    var tickNodes = [];
    var lastRenderedTickCount = -1;
    var lastAppliedEnergy = -1;
    var lastAppliedSlowdown = -1;
    var lastAppliedVisibleCount = -1;
    var lastAppliedStarSpeed = -1;
    var lastAppliedIsClaude = null;
    var lastAppliedOffsetCss = null;
    var lastAppliedFillBg = null;
    var lastVisualSyncSig = "";
    var dragSnapCache = null;

    var cachedSettings = schemaDefaults();
    var cachedReducedMotion = false;
    var cachedMotionMode = "full";

    function refreshCachedSettings() {
      cachedSettings = readSettings(win);
      cachedReducedMotion = prefersReducedMotion(win);
      cachedMotionMode = cachedReducedMotion ? "quick" : (cachedSettings.motion || "full");
    }
    refreshCachedSettings();

    var cachedTrackRect = null;
    var cachedCanvasTrackW = 280;
    var cachedCanvasTrackH = TRACK_HEIGHT;
    var hasCachedCanvasRect = false;

    function refreshTrackRectCache() {
      var rect = trackEl.getBoundingClientRect ? trackEl.getBoundingClientRect() : null;
      if (rect && rect.width > 0) {
        cachedTrackRect = { left: rect.left, width: rect.width, height: rect.height };
        cachedCanvasTrackW = rect.width;
        cachedCanvasTrackH = rect.height > 0 ? Math.round(rect.height) : TRACK_HEIGHT;
        hasCachedCanvasRect = true;
      }
      return cachedTrackRect;
    }

    var cachedDarkMode = null;
    var cachedDarkTime = 0;

    function invalidateDarkCache() {
      cachedDarkMode = null;
      cachedDarkTime = 0;
    }

    function resolveCachedIsDark() {
      try {
        var rootCls = doc.documentElement && doc.documentElement.classList;
        var bodyCls = doc.body && doc.body.classList;
        if (rootCls) {
          if (rootCls.contains("dark")) return true;
          if (rootCls.contains("light")) return false;
        }
        if (bodyCls) {
          if (bodyCls.contains("dark")) return true;
          if (bodyCls.contains("light")) return false;
        }
      } catch (err) {
        // 忽略主题类读取异常
      }
      var now = nowMs();
      if (cachedDarkMode !== null && now - cachedDarkTime < 500) {
        return cachedDarkMode;
      }
      cachedDarkMode = surfaceIsDark(win, doc);
      cachedDarkTime = now;
      return cachedDarkMode;
    }

    var trackResizeObserver = null;
    var TrackRO = (win && win.ResizeObserver) || (typeof ResizeObserver === "function" ? ResizeObserver : null);
    if (typeof TrackRO === "function") {
      try {
        trackResizeObserver = new TrackRO(function (entries) {
          if (destroyed) return;
          var entry = entries && entries[0];
          var w = entry && entry.contentRect ? entry.contentRect.width : 0;
          var h = entry && entry.contentRect ? entry.contentRect.height : 0;
          if (w > 0) {
            cachedCanvasTrackW = w;
            cachedCanvasTrackH = h > 0 ? Math.round(h) : cachedCanvasTrackH;
            hasCachedCanvasRect = true;
            if (dragging) {
              cachedTrackRect = null;
            }
          }
        });
        trackResizeObserver.observe(trackEl);
      } catch (err) {
        trackResizeObserver = null;
      }
    }

    var starSyncRafId = null;
    var pendingStarParams = null;
    var lastStarSpeedFactor = -1;
    var lastStarSlowdown = -1;
    var starVisibleStates = new Array(starNodes.length);
    for (var svIdx = 0; svIdx < starVisibleStates.length; svIdx += 1) {
      starVisibleStates[svIdx] = false;
    }

    function applyStarNodesNow(visibleCount, speedFactor, slowdown) {
      var speedChanged =
        slowdown !== lastStarSlowdown ||
        lastStarSpeedFactor < 0 ||
        Math.abs(speedFactor - lastStarSpeedFactor) >= 0.04;
      for (var i = 0; i < starNodes.length; i += 1) {
        var sNode = starNodes[i];
        var shouldShow = i < visibleCount;
        var wasShown = starVisibleStates[i];
        if (shouldShow !== wasShown) {
          if (sNode.el.classList) {
            if (shouldShow) {
              sNode.el.classList.remove("is-hidden");
            } else {
              sNode.el.classList.add("is-hidden");
            }
          }
          starVisibleStates[i] = shouldShow;
        }
        if (shouldShow && (speedChanged || !wasShown)) {
          var dur = starDurationFor(i, speedFactor) * slowdown;
          var delay = starDelayFor(i, dur);
          sNode.el.style.animationDuration = dur.toFixed(3) + "s";
          sNode.el.style.animationDelay = delay.toFixed(3) + "s";
        }
      }
      if (speedChanged) {
        lastStarSpeedFactor = speedFactor;
        lastStarSlowdown = slowdown;
      }
    }

    function cancelStarSync() {
      if (starSyncRafId !== null && win && typeof win.cancelAnimationFrame === "function") {
        win.cancelAnimationFrame(starSyncRafId);
      }
      starSyncRafId = null;
      pendingStarParams = null;
    }

    function scheduleStarNodesSync(visibleCount, speedFactor, slowdown) {
      if (!(dragging && hasDragged) || !win || typeof win.requestAnimationFrame !== "function") {
        cancelStarSync();
        applyStarNodesNow(visibleCount, speedFactor, slowdown);
        return;
      }
      pendingStarParams = {
        visibleCount: visibleCount,
        speedFactor: speedFactor,
        slowdown: slowdown
      };
      if (starSyncRafId !== null) return;
      starSyncRafId = win.requestAnimationFrame(function () {
        starSyncRafId = null;
        if (destroyed || !pendingStarParams) return;
        var params = pendingStarParams;
        pendingStarParams = null;
        applyStarNodesNow(params.visibleCount, params.speedFactor, params.slowdown);
      });
    }

    function nowMs() {
      if (win && win.performance && typeof win.performance.now === "function") {
        return win.performance.now();
      }
      return Date.now();
    }

    function readSeatSnapshot() {
      var snapSource = seat && typeof seat.getSnapshot === "function" ? seat.getSnapshot() : seat;
      var rawLevels = (snapSource && Array.isArray(snapSource.effortLevels) ? snapSource.effortLevels : []).slice();
      var levels = rawLevels.map(function (item) {
        var key = extractEffortKey(item);
        return {
          raw: item,
          effort: key,
          label: extractEffortDisplayLabel(item, key, seat)
        };
      });
      var count = levels.length;
      var curEffort = extractEffortKey(snapSource && snapSource.currentEffort);
      var officialIndex = 0;
      for (var i = 0; i < count; i += 1) {
        if (String(levels[i].effort).toLowerCase() === String(curEffort).toLowerCase()) {
          officialIndex = i;
          break;
        }
      }
      var locked = Boolean((snapSource && snapSource.locked) || count <= 1);
      var stops = energyStopsFor(levels);
      var baseName = (snapSource && snapSource.baseName) || (snapSource && snapSource.modelName) || "";
      var isClaude = Boolean((snapSource && snapSource.isClaude) || isClaudeModel(baseName));
      var theme = (snapSource && snapSource.theme) || (isClaude ? "claude" : "codex");
      var subtitle = snapSource && typeof snapSource.subtitle === "string"
        ? snapSource.subtitle
        : (snapSource && snapSource.isOrchestrator && baseName ? "· " + baseName : "");
      return {
        baseName: baseName,
        subtitle: subtitle,
        isClaude: isClaude,
        theme: theme,
        levels: levels,
        count: count,
        officialIndex: officialIndex,
        locked: locked,
        energyStart: stops.start,
        energyEnd: stops.end,
        hasOffFirst: stops.hasOffFirst
      };
    }

    function currentShownIndex(snap) {
      if (dragging && draftIndex !== null) return draftIndex;
      if (snapIndex !== null) return snapIndex;
      return snap.officialIndex;
    }

    function ensureMotion(snap) {
      if (!motionState) {
        var initPct = pctFromIndex(currentShownIndex(snap), snap.count);
        motionState = {
          x: initPct,
          v: 0,
          a: 0,
          target: initPct
        };
      }
      return motionState;
    }

    function syncHeaderAndTrigger(snap, showIdx, visualOpts) {
      var count = snap.count;
      var safeIdx = Math.max(0, Math.min(Math.max(0, count - 1), showIdx));
      var levelItem = snap.levels[safeIdx];
      var label = levelItem ? levelItem.label : "";
      var isMax = !snap.locked && count > 1 && safeIdx === count - 1 && !isOffLevel(label);

      var rowEl =
        opts.row ||
        (container.closest &&
          (container.closest(".ces-ag-effort-row") ||
            container.closest('[data-ces-effort-row="true"]') ||
            container.closest('[role="menuitem"]')));

      if (rowEl) {
        if (rowEl.getAttribute("data-ces-effort-row") !== "true") {
          rowEl.setAttribute("data-ces-effort-row", "true");
        }
        if (isMax) {
          if (rowEl.getAttribute("data-ces-max") !== "true") {
            rowEl.setAttribute("data-ces-max", "true");
          }
        } else if (rowEl.hasAttribute("data-ces-max")) {
          rowEl.removeAttribute("data-ces-max");
        }
      }

      var subtitleEl =
        opts.subtitleElement ||
        (rowEl && rowEl.querySelector ? rowEl.querySelector('[data-ces-part="subtitle"]') : null);
      if (subtitleEl) {
        var nextSub = snap.subtitle || "";
        if (subtitleEl.textContent !== nextSub) {
          subtitleEl.textContent = nextSub;
        }
        if (subtitleEl.style) {
          var nextSubDisplay = nextSub ? "" : "none";
          if (subtitleEl.style.display !== nextSubDisplay) {
            subtitleEl.style.display = nextSubDisplay;
          }
        }
      }

      var valEl = opts.valueElement || (rowEl && findValueElement(rowEl));
      if (valEl) {
        if (label && valEl.textContent !== label) {
          valEl.textContent = label;
          // 无论是 Claude 还是 Codex (Argon / Flash)，文字切换时统一触发零回流向上翻转动效
          if (!cachedReducedMotion) {
            if (valEl.__cesRiseTimer) {
              clearTimeout(valEl.__cesRiseTimer);
              valEl.__cesRiseTimer = null;
            }
            replayAnimationClasses(valEl, ["ces-text-rise", "is-claude-changing"], {
              includeSubtree: false,
              animationNames: ["ces-claude-rise", "ces-text-rise"]
            });
            valEl.__cesRiseTimer = setTimeout(function () {
              if (valEl && valEl.classList) {
                valEl.classList.remove("ces-text-rise");
                valEl.classList.remove("is-claude-changing");
              }
              valEl.__cesRiseTimer = null;
            }, 320);
          }
        }
        var vColor = snap.locked ? "" : valueColorFor(label, safeIdx, count, isMax, snap.hasOffFirst, snap.isClaude) || "";
        if (valEl.style && valEl.style.color !== vColor) {
          valEl.style.color = vColor;
        }
      }

      var visualSig =
        (snap.baseName || "") +
        "|" +
        (snap.subtitle || "") +
        "|" +
        safeIdx +
        "|" +
        label +
        "|" +
        count +
        "|" +
        (isMax ? "1" : "0") +
        "|" +
        (snap.locked ? "1" : "0") +
        "|" +
        (snap.isClaude ? "1" : "0");

      if (visualSig !== lastVisualSyncSig) {
        lastVisualSyncSig = visualSig;
        if (typeof opts.onVisualChange === "function") {
          if (!(visualOpts && visualOpts.skipExternalVisualCallback)) {
            try {
              opts.onVisualChange({
                index: safeIdx,
                count: count,
                label: label,
                effort: levelItem ? levelItem.effort : "",
                isMax: isMax,
                locked: snap.locked
              });
            } catch (err) {
              // 忽略外部视觉回调错误
            }
          }
        } else {
          syncTriggerColor(doc, label, safeIdx, count, isMax, snap.hasOffFirst, snap.isClaude);
        }
      }
    }

    function renderTicks(snap, effectivePct) {
      var tickMode = cachedSettings.ticks || "highlight";
      var count = snap.count;

      if (tickMode === "hidden" || count <= 1) {
        if (ticksEl.style.display !== "none") {
          ticksEl.style.display = "none";
        }
        return;
      }
      if (ticksEl.style.display !== "") {
        ticksEl.style.display = "";
      }

      if (lastRenderedTickCount !== count) {
        ticksEl.innerHTML = "";
        tickNodes = [];
        for (var i = 0; i < count; i += 1) {
          var tick = doc.createElement("span");
          tick.className = "ces-tick";
          tick.setAttribute("data-ces-part", "tick");
          var tickPct = pctFromIndex(i, count);
          tick.style.left = knobOffsetOf(tickPct, KNOB_RADIUS);
          ticksEl.appendChild(tick);
          tickNodes.push({ el: tick, pct: tickPct });
        }
        lastRenderedTickCount = count;
      }

      for (var j = 0; j < tickNodes.length; j += 1) {
        var node = tickNodes[j];
        var reached = effectivePct + 1e-4 >= node.pct;
        var nextTickClass = tickMode === "dim" ? "ces-tick is-dim" : reached ? "ces-tick is-on" : "ces-tick";
        if (node.el.className !== nextTickClass) {
          node.el.className = nextTickClass;
        }
      }
    }

    function stopClaudeCanvasAnimation() {
      if (claudeRafId !== null && win && typeof win.cancelAnimationFrame === "function") {
        win.cancelAnimationFrame(claudeRafId);
      }
      claudeRafId = null;
    }

    function stepClaudeCanvas(nowTs) {
      claudeRafId = null;
      if (destroyed) return;
      // 强度归零（回到 Low / 切走 Claude / 锁定）即停止循环，零 Fiber 遍历与布局查询开销
      if (!claudeActive || claudeIntensity <= 0) {
        stopClaudeCanvasAnimation();
        return;
      }
      var now = typeof nowTs === "number" && nowTs > 0 ? nowTs : nowMs();
      var elapsed = Math.max(0, now - claudeAnimStart);
      var progress = Math.min(1, elapsed / CLAUDE_SWEEP_MS);
      // 相位按帧累加：dt 上限 50ms，防止切后台回来后一次性跳很远
      var frameDt = claudeLastTs > 0 ? Math.min(0.05, Math.max(0, (now - claudeLastTs) / 1000)) : 0;
      claudeLastTs = now;
      claudeFlowTime += frameDt * claudeSpeed;
      var isDark = resolveCachedIsDark();
      if (!hasCachedCanvasRect) {
        refreshTrackRectCache();
        hasCachedCanvasRect = true;
      }
      var trackW = cachedCanvasTrackW > 0 ? cachedCanvasTrackW : 280;
      var canvasW = Math.max(1, Math.round(trackW));
      var th = cachedCanvasTrackH > 0 ? cachedCanvasTrackH : (claudeCanvasEl.height || 28);
      // 画布像素总宽维持与轨道一致（仅 resize 时重分配），绘制范围按圆钮中心 tw 裁切，零 CSS 宽度重排
      var curPct = motionState ? clamp01(motionState.x) : 0;
      var tw = Math.max(1, Math.round(KNOB_RADIUS + (canvasW - KNOB_RADIUS * 2) * curPct));
      if (claudeCanvasEl.width !== canvasW) claudeCanvasEl.width = canvasW;
      if (claudeCanvasEl.height !== th) claudeCanvasEl.height = th;
      var cctx = claudeCanvasEl.getContext && claudeCanvasEl.getContext("2d");
      if (cctx) {
        if (tw < canvasW) {
          cctx.clearRect(0, 0, canvasW, th);
        }
        paintDither(cctx, tw, th, isDark, progress, claudeFlowTime, claudeIntensity);
      }
      if (win && typeof win.requestAnimationFrame === "function") {
        claudeRafId = win.requestAnimationFrame(stepClaudeCanvas);
      }
    }

    function startClaudeCanvasAnimation() {
      if (destroyed || claudeRafId !== null) return;
      if (win && typeof win.requestAnimationFrame === "function") {
        claudeRafId = win.requestAnimationFrame(stepClaudeCanvas);
      } else {
        stepClaudeCanvas(nowMs());
      }
    }

    function applyVisualPct(snap, effectivePct, showIdx, visualOpts) {
      var p = clamp01(effectivePct);
      var count = snap.count;
      var safeIdx = Math.max(0, Math.min(Math.max(0, count - 1), showIdx));
      var levelItem = snap.levels[safeIdx];
      var label = levelItem ? levelItem.label : "";

      var theme = snap.theme || "codex";
      if (rootEl.getAttribute("data-theme") !== theme) rootEl.setAttribute("data-theme", theme);
      if (trackEl.getAttribute("data-theme") !== theme) trackEl.setAttribute("data-theme", theme);
      if (container && container.setAttribute && container.getAttribute("data-theme") !== theme) {
        container.setAttribute("data-theme", theme);
      }

      // 设为 -1，防止 Radix/Base UI FocusScope 在重新打开菜单时将焦点自动抢到推理条上导致框选
      var nextTabIndex = "-1";
      if (rootEl.getAttribute("tabindex") !== nextTabIndex) rootEl.setAttribute("tabindex", nextTabIndex);
      if (rootEl.getAttribute("aria-valuemin") !== "0") rootEl.setAttribute("aria-valuemin", "0");
      var nextValMax = String(Math.max(0, count - 1));
      if (rootEl.getAttribute("aria-valuemax") !== nextValMax) rootEl.setAttribute("aria-valuemax", nextValMax);
      var nextValNow = String(safeIdx);
      if (rootEl.getAttribute("aria-valuenow") !== nextValNow) rootEl.setAttribute("aria-valuenow", nextValNow);
      if (rootEl.getAttribute("aria-valuetext") !== label) rootEl.setAttribute("aria-valuetext", label);
      var nextDisabled = snap.locked ? "true" : "false";
      if (rootEl.getAttribute("aria-disabled") !== nextDisabled) rootEl.setAttribute("aria-disabled", nextDisabled);

      if (snap.locked) {
        if (!trackEl.classList.contains("is-locked")) trackEl.classList.add("is-locked");
      } else if (trackEl.classList.contains("is-locked")) {
        trackEl.classList.remove("is-locked");
      }

      var offsetCss = knobOffsetOf(p, KNOB_RADIUS);
      if (offsetCss !== lastAppliedOffsetCss) {
        lastAppliedOffsetCss = offsetCss;
        trackEl.style.setProperty("--ces-fill", offsetCss);
        trackEl.style.setProperty("--ces-p", String(p));
      }

      var fillBg = fillBackgroundFor(p, snap.energyStart, snap.energyEnd, snap.isClaude);
      if (fillBg !== lastAppliedFillBg) {
        lastAppliedFillBg = fillBg;
        fillEl.style.background = fillBg;
      }

      // Claude 点阵：按圆钮实际位置连续计算强度/速度（Medium ≈0.35 强度、半速；High 全量、全速）
      claudeIntensity = snap.isClaude && !snap.locked && count > 1 ? claudeIntensityFor(p, snap.energyStart) : 0;
      claudeSpeed = claudeSpeedFor(p, snap.energyStart);
      claudeActive = Boolean(snap.isClaude && !snap.locked && count > 1 && claudeIntensity > 0);
      if (claudeActive) {
        if (claudeCanvasEl.style.display !== "block") {
          // 仅「无特效 → 有特效」时重置入场扫掠；之后拖动只调强度/速度，不重播
          claudeCanvasEl.style.display = "block";
          claudeAnimStart = nowMs();
          claudeLastTs = 0;
        }
        startClaudeCanvasAnimation();
      } else {
        if (claudeCanvasEl.style.display !== "none") {
          claudeCanvasEl.style.display = "none";
        }
        stopClaudeCanvasAnimation();
      }

      var energy = snap.locked ? 0 : energyForPct(p, snap.energyStart);
      var slowdown = cachedMotionMode === "quick" ? REDUCED_MOTION_SLOWDOWN : 1;
      var themeChanged = lastAppliedIsClaude !== Boolean(snap.isClaude);
      if (Math.abs(energy - lastAppliedEnergy) > 1e-5 || slowdown !== lastAppliedSlowdown || themeChanged) {
        lastAppliedEnergy = energy;
        lastAppliedSlowdown = slowdown;
        lastAppliedIsClaude = Boolean(snap.isClaude);

        var energyOn = energy > 0 ? "1" : "0";
        var energyStr = String(Math.round(energy * 50) / 50);
        if (rootEl.getAttribute("data-energy") !== energyOn) rootEl.setAttribute("data-energy", energyOn);
        if (container && container.setAttribute && container.getAttribute("data-energy") !== energyOn) {
          container.setAttribute("data-energy", energyOn);
        }
        trackEl.style.setProperty("--ces-energy", energyStr);
        energyEl.style.opacity = energyStr;

        if (!snap.isClaude) {
          var starLayerOpacity = starLayerOpacityFor(energy);
          starsEl.style.opacity = String(starLayerOpacity);

          var visibleCount = Math.round(energy * PARTICLES.length);
          var speedFactor = speedFor(p, snap.energyStart);
          if (
            visibleCount !== lastAppliedVisibleCount ||
            Math.abs(speedFactor - lastAppliedStarSpeed) >= 0.04 ||
            themeChanged
          ) {
            lastAppliedVisibleCount = visibleCount;
            lastAppliedStarSpeed = speedFactor;
            var nextCountStr = String(visibleCount);
            if (starsEl.getAttribute("data-count") !== nextCountStr) {
              starsEl.setAttribute("data-count", nextCountStr);
            }
            scheduleStarNodesSync(visibleCount, speedFactor, slowdown);
          }
        }
      }

      renderTicks(snap, p);
      syncHeaderAndTrigger(snap, safeIdx, visualOpts);
    }

    function getActiveSnapshot() {
      return dragging && dragSnapCache ? dragSnapCache : readSeatSnapshot();
    }

    function stopFrames() {
      if (rafId !== null && win && typeof win.cancelAnimationFrame === "function") {
        win.cancelAnimationFrame(rafId);
      }
      rafId = null;
      lastFrameMs = 0;
    }

    function stepFrame(ts) {
      rafId = null;
      if (destroyed) return;
      var snap = readSeatSnapshot();
      var m = ensureMotion(snap);
      var mode = cachedMotionMode;
      var params = motionParamsForMode(mode);

      var now = typeof ts === "number" && ts > 0 ? ts : nowMs();
      var dt = lastFrameMs > 0 ? (now - lastFrameMs) / 1000 : 1 / 60;
      lastFrameMs = now;

      motionStep(m, dt, params);
      var showIdx = currentShownIndex(snap);
      applyVisualPct(snap, m.x, showIdx);

      if (!motionSettled(m, params)) {
        startFrames();
      } else {
        m.x = clamp01(m.target);
        m.v = 0;
        m.a = 0;
        lastFrameMs = 0;
        if (!dragging) {
          snapIndex = null;
        }
        applyVisualPct(snap, m.x, currentShownIndex(snap));
      }
    }

    function startFrames() {
      if (destroyed || rafId !== null) return;
      if (win && typeof win.requestAnimationFrame === "function") {
        rafId = win.requestAnimationFrame(stepFrame);
      } else {
        stepFrame(nowMs());
      }
    }

    function resolveShakePanelEl() {
      return (
        opts.panel ||
        (container.closest &&
          (container.closest('[data-testid="model-selector-panel"]') ||
            container.closest(".ces-ag-panel-enhanced") ||
            container.closest(".ag-menu-popup"))) ||
        findAntigravityPanel(doc)
      );
    }

    function clearMaxEffects() {
      var rowEl =
        opts.row ||
        (container.closest &&
          (container.closest(".ces-ag-effort-row") ||
            container.closest('[data-ces-effort-row="true"]')));
      var valEl = opts.valueElement || findValueElement(rowEl);
      if (valEl && valEl.classList && valEl.classList.contains("is-glowing")) {
        valEl.classList.remove("is-glowing");
      }
      if (valEl && valEl.__cesGlowTimer) {
        clearTimeout(valEl.__cesGlowTimer);
        valEl.__cesGlowTimer = null;
      }
      var panelEl = resolveShakePanelEl();
      if (panelEl && panelEl.classList && panelEl.classList.contains("ces-panel-shaking")) {
        panelEl.classList.remove("ces-panel-shaking");
      }
      if (panelEl && panelEl.__cesShakeTimer) {
        clearTimeout(panelEl.__cesShakeTimer);
        panelEl.__cesShakeTimer = null;
      }
    }

    function triggerMaxEffects(isClaude) {
      if (cachedReducedMotion) return;

      // 1. 整个模型选择面板物理微震颤（左右 ±2.5px、0.18s 快速阻尼撞墙感；简洁动画模式下自动静默）
      if (cachedMotionMode !== "quick") {
        var panelEl = resolveShakePanelEl();
        if (panelEl && panelEl.classList) {
          if (panelEl.__cesShakeTimer) {
            clearTimeout(panelEl.__cesShakeTimer);
          }
          replayAnimationClasses(panelEl, ["ces-panel-shaking"], {
            includeSubtree: false,
            animationNames: ["ces-panel-shake"]
          });
          panelEl.__cesShakeTimer = setTimeout(function () {
            if (panelEl && panelEl.classList) panelEl.classList.remove("ces-panel-shaking");
            panelEl.__cesShakeTimer = null;
          }, 220);
        }
      }

      // 2. "High" / "Extra" 文字到达最高档时的模糊光斑爆散 (约 0.4s 淡淡消失)
      var rowEl =
        opts.row ||
        (container.closest &&
          (container.closest(".ces-ag-effort-row") ||
            container.closest('[data-ces-effort-row="true"]')));
      var valEl = opts.valueElement || findValueElement(rowEl);
      if (valEl && valEl.classList) {
        var glowColor = isClaude ? "rgba(196, 181, 253, 0.9)" : "rgba(168, 85, 247, 0.9)";
        if (valEl.style && typeof valEl.style.setProperty === "function") {
          valEl.style.setProperty("--ces-glow-color", glowColor);
        }
        if (valEl.__cesGlowTimer) {
          clearTimeout(valEl.__cesGlowTimer);
        }
        replayAnimationClasses(valEl, ["is-glowing"], {
          includeSubtree: true,
          animationNames: ["ces-text-bloom", "ces-glow-flash"]
        });
        valEl.__cesGlowTimer = setTimeout(function () {
          if (valEl && valEl.classList) valEl.classList.remove("is-glowing");
          valEl.__cesGlowTimer = null;
        }, 450);
      }
    }

    /**
     * 立即把目标档位写回宿主（Antigravity React Fiber 或 Seat）：
     * 拖过档位边界时同步触发，无需等待 pointerup 松手。
     */
    function commitAtIndex(targetIndex, reason, snapHint) {
      var snap = snapHint || readSeatSnapshot();
      if (snap.locked || snap.count <= 1) return;
      var clampedIdx = Math.max(0, Math.min(snap.count - 1, targetIndex));
      var item = snap.levels[clampedIdx];
      if (!item) return;

      var isNowMax = clampedIdx === snap.count - 1 && !isOffLevel(item.label);
      var wasMax = lastCommittedIndex === snap.count - 1;

      lastCommittedIndex = clampedIdx;
      tracePush("commit", {
        reason: reason || "drag",
        index: clampedIdx,
        effort: item.effort,
        label: item.label
      });

      if (isNowMax && !wasMax) {
        triggerMaxEffects(snap.isClaude);
      } else if (!isNowMax && wasMax) {
        clearMaxEffects();
      }

      if (seat && typeof seat.selectEffort === "function") {
        try {
          seat.selectEffort(item.raw !== undefined ? item.raw : item.effort, clampedIdx);
        } catch (err) {
          tracePush("commit-error", { message: String(err && err.message ? err.message : err) });
        }
      }
      if (dragSnapCache && dragSnapCache === snap) {
        dragSnapCache.officialIndex = clampedIdx;
      }
      if (typeof opts.onCommit === "function") {
        try {
          opts.onCommit(item, clampedIdx, reason || "drag");
        } catch (err) {
          // 忽略外部回调异常
        }
      }
    }

    function pctAtClientX(clientX) {
      var rect = dragging && cachedTrackRect ? cachedTrackRect : refreshTrackRectCache();
      if (!rect || !(rect.width > 0)) return null;
      var usable = Math.max(1, rect.width - KNOB_RADIUS * 2);
      var raw = (clientX - rect.left - KNOB_RADIUS) / usable;
      return clamp01(raw);
    }

    function moveToClientX(clientX, isInitialDown) {
      var snap = getActiveSnapshot();
      if (snap.locked || snap.count <= 0) return;

      var ptrPct = pctAtClientX(clientX);
      if (ptrPct === null) ptrPct = pctFromIndex(snap.officialIndex, snap.count);

      var now = nowMs();
      if (lastPtrPct !== null && lastPtrMs > 0) {
        var dt = (now - lastPtrMs) / 1000;
        if (dt > 1e-4 && dt < 0.25) {
          var instSpeed = (ptrPct - lastPtrPct) / dt;
          ptrSpeed = ptrSpeed * (1 - POINTER_SPEED_EMA) + instSpeed * POINTER_SPEED_EMA;
        }
      } else {
        ptrSpeed = 0;
      }
      lastPtrPct = ptrPct;
      lastPtrMs = now;

      var mode = cachedMotionMode;
      var nowIndex;
      var targetPct;

      if (mode === "fast") {
        if (isInitialDown || detentIndex < 0 || detentIndex >= snap.count) {
          // 按下时若点击位置跨格，直接按最近格响应；随后的拖动按 1/3 边界迟滞棘轮触发
          nowIndex = isInitialDown
            ? indexFromPct(ptrPct, snap.count)
            : detentTargetIndex(snap.officialIndex, ptrPct, snap.count);
        } else {
          nowIndex = detentTargetIndex(detentIndex, ptrPct, snap.count);
        }
        // 仅当指针已进入 nowIndex 自身的稳定死区时才把棘轮锚点推进到 nowIndex，
        // 否则保持在过渡区来源侧相邻格，防止在 [1/3, 2/3] 区间连续微移或松手时来回翻转
        if (detentTargetIndex(nowIndex, ptrPct, snap.count) === nowIndex) {
          detentIndex = nowIndex;
        } else if (ptrPct < pctFromIndex(nowIndex, snap.count)) {
          detentIndex = Math.max(0, nowIndex - 1);
        } else {
          detentIndex = Math.min(snap.count - 1, nowIndex + 1);
        }
        targetPct = ptrPct;
      } else {
        nowIndex = indexFromPct(ptrPct, snap.count);
        targetPct = ptrPct;
      }

      draftPct = ptrPct;
      draftIndex = nowIndex;

      var m = ensureMotion(snap);

      // ★ 核心交互：只要滑过档位边界（或者点击了另一档位），不用等松手，立即切换官方真实档位 ★
      var committed = false;
      if (nowIndex !== lastCommittedIndex) {
        commitAtIndex(nowIndex, isInitialDown ? "down" : "drag", snap);
        committed = true;
      }

      if (isInitialDown && !hasDragged) {
        var slotPct = pctFromIndex(nowIndex, snap.count);
        m.target = slotPct;
        if (mode === "quick") {
          m.x = slotPct;
          m.v = 0;
          m.a = 0;
          stopFrames();
          applyVisualPct(snap, m.x, nowIndex);
        } else {
          // 纯点击（full / fast）：保留当前 m.x / m.v，从原位平滑滑行至目标档位圆心
          applyVisualPct(snap, m.x, nowIndex);
          if (!motionSettled(m, motionParamsForMode(mode))) {
            startFrames();
          }
        }
        return;
      }

      m.target = targetPct;

      // ★ 顺滑连续跟手：拖动中圆钮直接 1:1 跟随鼠标连续浮点位置，不卡顿、不硬吸附 ★
      // 松手（endDrag）时再以 ~100ms 轻快阻尼磁吸至最终离散档位圆心
      m.x = targetPct;
      m.v = 0;
      m.a = 0;
      stopFrames();
      applyVisualPct(snap, m.x, nowIndex);
    }

    function endDrag(clientX) {
      if (!dragging) return;
      var wasDragged = hasDragged;
      var clickedIndex = draftIndex;
      var snap = getActiveSnapshot();
      var ptrPct = draftPct !== null ? draftPct : pctFromIndex(snap.officialIndex, snap.count);
      if (wasDragged && typeof clientX === "number") {
        var p = pctAtClientX(clientX);
        if (p !== null) ptrPct = p;
      }

      var mode = cachedMotionMode;
      var finalIndex;
      if (!wasDragged) {
        finalIndex = clickedIndex !== null ? clickedIndex : indexFromPct(ptrPct, snap.count);
      } else if (mode === "fast") {
        var baseDetent = detentIndex >= 0 && detentIndex < snap.count ? detentIndex : snap.officialIndex;
        finalIndex = detentTargetIndex(baseDetent, ptrPct, snap.count);
      } else if (mode === "quick") {
        finalIndex = indexFromPct(ptrPct, snap.count);
      } else {
        var idleS = lastPtrMs > 0 ? Math.max(0, (nowMs() - lastPtrMs) / 1000) : 1;
        finalIndex = releaseIndexFor(ptrPct, ptrSpeed, idleS, snap.count);
      }

      dragging = false;
      dragSnapCache = null;
      hasDragged = false;
      downClientX = null;
      activePointerId = null;
      detachWinDragFallback();
      cachedTrackRect = null;
      buttonDown = false;
      draftPct = null;
      draftIndex = null;
      detentIndex = -1;
      lastPtrPct = null;
      ptrSpeed = 0;
      snapIndex = finalIndex;
      notifyDraggingChange(false);

      if (finalIndex !== lastCommittedIndex) {
        commitAtIndex(finalIndex, "release", snap);
      }

      var m = ensureMotion(snap);
      m.target = pctFromIndex(finalIndex, snap.count);

      if (mode === "quick") {
        m.x = m.target;
        m.v = 0;
        m.a = 0;
        snapIndex = null;
        stopFrames();
        applyVisualPct(snap, m.x, finalIndex);
      } else if (wasDragged) {
        m.x = ptrPct;
        m.v = 0;
        m.a = 0;
        applyVisualPct(snap, m.x, finalIndex);
        startFrames();
      } else {
        if (motionSettled(m, motionParamsForMode(mode))) {
          m.x = m.target;
          m.v = 0;
          m.a = 0;
          snapIndex = null;
          stopFrames();
          applyVisualPct(snap, m.x, finalIndex);
        } else {
          applyVisualPct(snap, m.x, finalIndex);
          startFrames();
        }
      }
    }

    function swallowEvent(ev) {
      if (!ev) return;
      if (typeof ev.stopPropagation === "function") ev.stopPropagation();
    }

    var activePointerId = null;
    var winDragFallbackBound = false;
    var lastHandledPointerEv = null;
    var lastNotifiedDragging = false;

    function notifyDraggingChange(isNowDragging) {
      var next = Boolean(isNowDragging);
      if (next === lastNotifiedDragging) return;
      lastNotifiedDragging = next;
      if (typeof opts.onDraggingChange === "function") {
        try {
          opts.onDraggingChange(next);
        } catch (err) {
          // 忽略外部拖动状态回调异常
        }
      }
    }

    function onWinPointerMove(ev) {
      if (!dragging || ev === lastHandledPointerEv) return;
      if (activePointerId !== null && ev && ev.pointerId !== undefined && ev.pointerId !== activePointerId) return;
      if (ev && typeof ev.buttons === "number" && (ev.buttons & 1) === 0) {
        buttonDown = false;
        endDrag(typeof ev.clientX === "number" ? ev.clientX : undefined);
        return;
      }
      onPointerMove(ev);
    }

    function onWinPointerUp(ev) {
      if (!dragging || ev === lastHandledPointerEv) return;
      if (activePointerId !== null && ev && ev.pointerId !== undefined && ev.pointerId !== activePointerId) return;
      onPointerUp(ev);
    }

    function onWinPointerCancel(ev) {
      if (!dragging || ev === lastHandledPointerEv) return;
      if (activePointerId !== null && ev && ev.pointerId !== undefined && ev.pointerId !== activePointerId) return;
      onPointerCancel(ev);
    }

    function attachWinDragFallback() {
      if (winDragFallbackBound || !win || typeof win.addEventListener !== "function") return;
      winDragFallbackBound = true;
      try {
        win.addEventListener("pointermove", onWinPointerMove, false);
        win.addEventListener("pointerup", onWinPointerUp, false);
        win.addEventListener("pointercancel", onWinPointerCancel, false);
      } catch (err) {
        winDragFallbackBound = false;
      }
    }

    function detachWinDragFallback() {
      if (!winDragFallbackBound || !win || typeof win.removeEventListener !== "function") {
        winDragFallbackBound = false;
        return;
      }
      winDragFallbackBound = false;
      try {
        win.removeEventListener("pointermove", onWinPointerMove, false);
        win.removeEventListener("pointerup", onWinPointerUp, false);
        win.removeEventListener("pointercancel", onWinPointerCancel, false);
      } catch (err) {
        // 忽略窗口监听器移除失败
      }
    }

    function onPointerDown(ev) {
      if (ev && typeof ev.button === "number" && ev.button !== 0) return;
      lastHandledPointerEv = ev || null;
      refreshCachedSettings();
      var snap = readSeatSnapshot();
      if (snap.locked || snap.count <= 1) return;
      swallowEvent(ev);
      if (typeof ev.preventDefault === "function") ev.preventDefault();

      refreshTrackRectCache();
      dragging = true;
      dragSnapCache = snap;
      hasDragged = false;
      downClientX = ev && typeof ev.clientX === "number" ? ev.clientX : null;
      activePointerId = ev && ev.pointerId !== undefined ? ev.pointerId : null;
      buttonDown = true;
      // 起手时对齐当前官方档位，若起手点就在当前档位则不重复触发无意义的写入；若点在其他档位则立即切过去
      lastCommittedIndex = snap.officialIndex;
      detentIndex = snap.officialIndex;
      snapIndex = null;
      lastPtrPct = null;
      notifyDraggingChange(true);
      attachWinDragFallback();

      try {
        if (trackEl.setPointerCapture && ev.pointerId !== undefined) {
          trackEl.setPointerCapture(ev.pointerId);
        }
      } catch (err) {
        // 忽略不支持 pointerCapture 的环境
      }

      moveToClientX(ev.clientX, true);
    }

    function onPointerMove(ev) {
      if (!dragging) return;
      lastHandledPointerEv = ev || null;
      if (ev && ev.buttons === 0 && !buttonDown) return;
      swallowEvent(ev);
      if (
        !hasDragged &&
        downClientX !== null &&
        ev &&
        typeof ev.clientX === "number" &&
        Math.abs(ev.clientX - downClientX) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      hasDragged = true;
      moveToClientX(ev.clientX, false);
    }

    function onPointerUp(ev) {
      if (!dragging) return;
      lastHandledPointerEv = ev || null;
      swallowEvent(ev);
      buttonDown = false;
      try {
        if (trackEl.releasePointerCapture && ev && ev.pointerId !== undefined) {
          trackEl.releasePointerCapture(ev.pointerId);
        }
      } catch (err) {
        // 忽略释放失败
      }
      endDrag(ev && typeof ev.clientX === "number" ? ev.clientX : undefined);
    }

    function onPointerCancel(ev) {
      if (!dragging) return;
      lastHandledPointerEv = ev || null;
      swallowEvent(ev);
      buttonDown = false;
      endDrag(undefined);
    }

    // 拖动按住期间若因宿主重绘或焦点波动提前丢失指针捕获，不直接终止拖动，交由 window 级兜底监听无缝接管
    function onLostPointerCapture(ev) {
      if (!dragging) return;
      if (!buttonDown || (ev && typeof ev.buttons === "number" && (ev.buttons & 1) === 0)) {
        buttonDown = false;
        endDrag(undefined);
        return;
      }
      attachWinDragFallback();
    }

    function onKeyDown(ev) {
      refreshCachedSettings();
      var snap = readSeatSnapshot();
      if (snap.locked || snap.count <= 1) return;
      var key = ev && ev.key;
      var curIdx = currentShownIndex(snap);
      var nextIdx = null;
      if (key === "ArrowLeft" || key === "ArrowDown") {
        nextIdx = Math.max(0, curIdx - 1);
      } else if (key === "ArrowRight" || key === "ArrowUp") {
        nextIdx = Math.min(snap.count - 1, curIdx + 1);
      } else if (key === "Home") {
        nextIdx = 0;
      } else if (key === "End") {
        nextIdx = snap.count - 1;
      } else {
        return;
      }
      swallowEvent(ev);
      if (typeof ev.preventDefault === "function") ev.preventDefault();

      if (lastCommittedIndex < 0) {
        lastCommittedIndex = snap.officialIndex;
      }
      if (nextIdx === curIdx && nextIdx === snap.officialIndex) return;

      snapIndex = nextIdx;
      commitAtIndex(nextIdx, "key", snap);
      var m = ensureMotion(snap);
      m.target = pctFromIndex(nextIdx, snap.count);
      var visualSnap = readSeatSnapshot();

      if (cachedMotionMode === "quick") {
        m.x = m.target;
        m.v = 0;
        m.a = 0;
        snapIndex = null;
        stopFrames();
        applyVisualPct(visualSnap, m.x, nextIdx);
      } else {
        applyVisualPct(visualSnap, m.x, nextIdx);
        startFrames();
      }
    }

    // 阻断 click / mouseup 冒泡到外层 MenuItem，防止拖动松手时意外关闭官方菜单
    function onBlockMenuClose(ev) {
      swallowEvent(ev);
    }

    trackEl.addEventListener("pointerdown", onPointerDown);
    trackEl.addEventListener("pointermove", onPointerMove);
    trackEl.addEventListener("pointerup", onPointerUp);
    trackEl.addEventListener("pointercancel", onPointerCancel);
    trackEl.addEventListener("lostpointercapture", onLostPointerCapture);
    trackEl.addEventListener("click", onBlockMenuClose);
    trackEl.addEventListener("mouseup", onBlockMenuClose);
    rootEl.addEventListener("keydown", onKeyDown);

    function syncFromExternal() {
      if (destroyed || dragging) return;
      var snap = readSeatSnapshot();
      var m = ensureMotion(snap);
      var targetIdx = snap.officialIndex;
      var targetPct = pctFromIndex(targetIdx, snap.count);
      m.target = targetPct;
      lastCommittedIndex = targetIdx;

      if (
        snap.locked ||
        cachedMotionMode === "quick" ||
        motionSettled(m, motionParamsForMode(cachedMotionMode))
      ) {
        m.x = targetPct;
        m.v = 0;
        m.a = 0;
        snapIndex = null;
        stopFrames();
        applyVisualPct(snap, m.x, targetIdx, { skipExternalVisualCallback: true });
      } else {
        applyVisualPct(snap, m.x, targetIdx, { skipExternalVisualCallback: true });
        startFrames();
      }
    }

    var offSeat =
      seat && typeof seat.subscribe === "function"
        ? seat.subscribe(function () {
            syncFromExternal();
          })
        : function () {};

    var offSettings = onSettingsChange(function (nextSettings) {
      cachedSettings = nextSettings || readSettings(win);
      cachedReducedMotion = prefersReducedMotion(win);
      cachedMotionMode = cachedReducedMotion ? "quick" : (cachedSettings.motion || "full");
      var snap = readSeatSnapshot();
      var m = ensureMotion(snap);
      applyVisualPct(snap, m.x, currentShownIndex(snap));
    }, win);

    var motionMql = null;
    var onMotionMqlChange = null;
    try {
      if (win && typeof win.matchMedia === "function") {
        motionMql = win.matchMedia("(prefers-reduced-motion: reduce)");
        if (motionMql && typeof motionMql.addEventListener === "function") {
          onMotionMqlChange = function () {
            refreshCachedSettings();
          };
          motionMql.addEventListener("change", onMotionMqlChange);
        }
      }
    } catch (err) {
      motionMql = null;
    }

    function onWinResize() {
      invalidateDarkCache();
      cachedTrackRect = null;
      hasCachedCanvasRect = false;
    }
    if (win && typeof win.addEventListener === "function") {
      try {
        win.addEventListener("resize", onWinResize);
      } catch (err) {
        // 忽略 resize 监听失败
      }
    }

    // 首次同步渲染
    var initSnap = readSeatSnapshot();
    lastCommittedIndex = initSnap.officialIndex;
    var initMotion = ensureMotion(initSnap);
    initMotion.x = pctFromIndex(initSnap.officialIndex, initSnap.count);
    initMotion.target = initMotion.x;
    applyVisualPct(initSnap, initMotion.x, initSnap.officialIndex);

    return {
      unmount: function () {
        destroyed = true;
        dragging = false;
        dragSnapCache = null;
        buttonDown = false;
        activePointerId = null;
        detachWinDragFallback();
        notifyDraggingChange(false);
        stopFrames();
        stopClaudeCanvasAnimation();
        cancelStarSync();
        clearMaxEffects();
        cachedTrackRect = null;
        if (trackResizeObserver) {
          try {
            trackResizeObserver.disconnect();
          } catch (err) {}
          trackResizeObserver = null;
        }
        if (motionMql && onMotionMqlChange && typeof motionMql.removeEventListener === "function") {
          try {
            motionMql.removeEventListener("change", onMotionMqlChange);
          } catch (err) {}
        }
        if (win && typeof win.removeEventListener === "function") {
          try {
            win.removeEventListener("resize", onWinResize);
          } catch (err) {}
        }
        var rowEl =
          opts.row ||
          (container.closest &&
            (container.closest(".ces-ag-effort-row") ||
              container.closest('[data-ces-effort-row="true"]')));
        var valEl = opts.valueElement || findValueElement(rowEl);
        if (valEl && valEl.__cesRiseTimer) {
          clearTimeout(valEl.__cesRiseTimer);
          valEl.__cesRiseTimer = null;
        }
        if (typeof offSeat === "function") offSeat();
        if (typeof offSettings === "function") offSettings();
        trackEl.removeEventListener("pointerdown", onPointerDown);
        trackEl.removeEventListener("pointermove", onPointerMove);
        trackEl.removeEventListener("pointerup", onPointerUp);
        trackEl.removeEventListener("pointercancel", onPointerCancel);
        trackEl.removeEventListener("lostpointercapture", onLostPointerCapture);
        trackEl.removeEventListener("click", onBlockMenuClose);
        trackEl.removeEventListener("mouseup", onBlockMenuClose);
        rootEl.removeEventListener("keydown", onKeyDown);
        if (rootEl.parentNode === container) {
          container.removeChild(rootEl);
        }
      },
      refresh: function () {
        syncFromExternal();
      }
    };
  }

  // ── 通用菜单观察器（兼容预置「推理等级」行的 DOM 结构与独立预览页） ────────────
  function installMenuObserver(options) {
    var opts = options || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
    var onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};
    if (!doc || !doc.body) {
      return { stop: function () {}, rescan: function () {}, getCurrent: function () { return null; } };
    }

    var current = null;
    var observer = null;
    var isInternalMutating = false;
    var scanRafId = null;
    var scanScheduled = false;
    var stopped = false;

    function isOwnMenuNode(node) {
      if (!node) return false;
      var el = node.nodeType === 1 ? node : node.parentElement || node.parentNode;
      if (!el) return false;
      if (typeof el.closest === "function" && el.closest(".ces-inline, .ces-root, .ces-set")) {
        return true;
      }
      return Boolean(typeof el.getAttribute === "function" && el.getAttribute("data-ces-part"));
    }

    function isOwnMenuMutation(record) {
      if (!record) return false;
      if (isOwnMenuNode(record.target)) return true;
      if (record.type === "childList") {
        var added = record.addedNodes;
        var removed = record.removedNodes;
        var i;
        if (added) {
          for (i = 0; i < added.length; i += 1) {
            if (!isOwnMenuNode(added[i])) return false;
          }
        }
        if (removed) {
          for (i = 0; i < removed.length; i += 1) {
            if (!isOwnMenuNode(removed[i])) return false;
          }
        }
        return true;
      }
      return false;
    }

    function detach() {
      if (!current) return;
      var prev = current;
      current = null;
      try {
        if (prev.container && prev.container.parentNode) {
          prev.container.parentNode.removeChild(prev.container);
        }
        if (prev.row && prev.previousStyle) {
          prev.row.style.height = prev.previousStyle.height;
          prev.row.style.flexWrap = prev.previousStyle.flexWrap;
          prev.row.style.paddingTop = prev.previousStyle.paddingTop;
          prev.row.style.paddingBottom = prev.previousStyle.paddingBottom;
        }
      } catch (err) {
        // 忽略清理异常
      }
      onChange(null);
    }

    function scan() {
      if (stopped || isInternalMutating) return;
      isInternalMutating = true;
      try {
        // 若页面存在 Antigravity 原生模型面板，交由 installAntigravityObserver 接管
        if (findAntigravityPanel(doc) || findAntigravityTrigger(doc)) return;

        var row = findInferenceRow(doc);
        if (!row) {
          if (current) detach();
          return;
        }
        if (current && current.row === row && current.container && row.contains(current.container)) {
          return;
        }
        if (current) detach();

        var previousStyle = {
          height: row.style.height || "",
          flexWrap: row.style.flexWrap || "",
          paddingTop: row.style.paddingTop || "",
          paddingBottom: row.style.paddingBottom || ""
        };

        row.setAttribute("data-ces-effort-row", "true");
        row.style.height = "auto";
        row.style.flexWrap = "wrap";
        row.style.paddingTop = "8px";
        row.style.paddingBottom = "8px";

        var valEl = findValueElement(row);
        var host = doc.createElement("div");
        host.className = "ces-inline";
        host.setAttribute("data-ces-part", "host");
        row.appendChild(host);

        current = {
          row: row,
          container: host,
          value: valEl ? (valEl.textContent || "").trim() : "",
          previousStyle: previousStyle
        };
        onChange(current);
      } finally {
        if (observer && typeof observer.takeRecords === "function") {
          try {
            observer.takeRecords();
          } catch (err) {}
        }
        isInternalMutating = false;
      }
    }

    function scheduleScan() {
      if (stopped || scanScheduled) return;
      scanScheduled = true;
      if (win && typeof win.requestAnimationFrame === "function") {
        scanRafId = win.requestAnimationFrame(function () {
          scanRafId = null;
          scanScheduled = false;
          if (!stopped) scan();
        });
      } else {
        scanScheduled = false;
        scan();
      }
    }

    scan();
    var MO = (win && win.MutationObserver) || (typeof MutationObserver === "function" ? MutationObserver : null);
    if (typeof MO === "function") {
      observer = new MO(function (records) {
        if (stopped || isInternalMutating) return;
        for (var i = 0; i < records.length; i += 1) {
          if (!isOwnMenuMutation(records[i])) {
            scheduleScan();
            return;
          }
        }
      });
      observer.observe(doc.body, { childList: true, subtree: true });
    }

    return {
      stop: function () {
        stopped = true;
        if (scanRafId !== null && win && typeof win.cancelAnimationFrame === "function") {
          win.cancelAnimationFrame(scanRafId);
        }
        scanRafId = null;
        scanScheduled = false;
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        detach();
      },
      rescan: scan,
      getCurrent: function () {
        return current;
      }
    };
  }

  // ── Antigravity 原生模型选择器深度桥接器 ───────────────────────────────────
  function installAntigravityObserver(options) {
    var opts = options || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
    if (!doc || !doc.body) {
      return { stop: function () {}, rescan: function () {} };
    }

    installStyles(doc);

    // 记录每个基础模型在当前会话最后选定的推理档位（默认跟随 selectedModel 或 medium）
    // Orchestrator 规划器与普通模型分开独立记忆
    var perModelEffortMap = new Map();
    var perOrchestratorEffortMap = new Map();
    var activeMount = null;
    var activePanel = null;
    var activeSection = null;
    var activeSeatListeners = new Set();
    var activeBaseOverride = null;
    var activeModelOptionOverride = null;
    var activeOrchestratorMode = false;
    var activeOrchestratorPlannerOverride = null;
    var isInternalMutating = false;
    var isStopped = false;
    var nativeDetected = false;

    var MO = (win && win.MutationObserver) || (typeof MutationObserver === "function" ? MutationObserver : null);
    var bodyPortalObserver = null;
    var triggerObserver = null;
    var observedTriggerEl = null;
    var panelObserver = null;
    var observedPanelEl = null;
    var orchSubmenuObserver = null;
    var observedOrchSubmenuEl = null;
    var bootObserver = null;
    var panelResizeObserver = null;
    var postMountRafId = null;
    var scanRafId = null;
    var scanScheduled = false;
    var panelResizeDispatched = false;

    var lastTriggerEl = null;
    var lastTriggerSig = "";
    var triggerDomDirty = true;
    var lastPanelEl = null;
    var lastPanelSig = "";
    var cachedGroupSpans = null;
    var cachedSingleItems = null;
    var cachedOrchRow = null;
    var panelRowsDirty = true;
    var panelDecorDirty = true;
    var lastOrchSubmenuEl = null;
    var lastOrchSubmenuSig = "";
    var orchSubmenuDirty = true;
    var lastCommittedSyncKey = "";
    var isSliderDragging = false;
    var deferredScanWhileDragging = false;
    var mayHaveOrchSubmenu = false;

    function isNodeDetached(node) {
      return Boolean(node && node.isConnected === false);
    }

    function isOwnCesNode(node) {
      if (!node) return false;
      var el = node.nodeType === 1 ? node : node.parentElement || node.parentNode;
      if (!el) return false;
      if (typeof el.closest === "function") {
        if (el.closest(".ces-ag-section, .ces-inline, .ces-root, .ces-set")) {
          return true;
        }
      }
      if (typeof el.getAttribute === "function") {
        var cesPart = el.getAttribute("data-ces-part");
        if (
          cesPart &&
          cesPart !== "trigger-effort" &&
          cesPart !== "trigger-orch-name" &&
          cesPart !== "trigger-orch-effort" &&
          cesPart !== "orch-model-name" &&
          cesPart !== "orch-effort"
        ) {
          return true;
        }
      }
      if (activeSection && (el === activeSection || (typeof activeSection.contains === "function" && activeSection.contains(el)))) {
        return true;
      }
      return false;
    }

    function isOwnMutationRecord(record) {
      if (!record) return false;
      if (isOwnCesNode(record.target)) return true;
      if (record.type === "childList") {
        var added = record.addedNodes;
        var removed = record.removedNodes;
        var i;
        if (added) {
          for (i = 0; i < added.length; i += 1) {
            if (!isOwnCesNode(added[i])) return false;
          }
        }
        if (removed) {
          for (i = 0; i < removed.length; i += 1) {
            if (!isOwnCesNode(removed[i])) return false;
          }
        }
        return true;
      }
      return false;
    }

    function drainObservers() {
      var list = [bodyPortalObserver, triggerObserver, panelObserver, orchSubmenuObserver, bootObserver];
      for (var i = 0; i < list.length; i += 1) {
        var obs = list[i];
        if (obs && typeof obs.takeRecords === "function") {
          try {
            obs.takeRecords();
          } catch (err) {
            // 忽略 takeRecords 异常
          }
        }
      }
    }

    function runInternalMutation(fn) {
      if (isInternalMutating) {
        return fn();
      }
      isInternalMutating = true;
      try {
        return fn();
      } finally {
        drainObservers();
        isInternalMutating = false;
      }
    }

    function notifySeatListeners() {
      activeSeatListeners.forEach(function (fn) {
        try {
          fn();
        } catch (err) {
          // 忽略订阅者异常
        }
      });
    }

    /**
     * 定位模型菜单弹层外层宽度容器（在 Antigravity 中通常为带 !w-max 的 [role="menu"]），
     * 若面板本身无外层 [role="menu"] 则回退到 panel 自身。
     */
    function resolvePanelWidthTarget(panel) {
      if (!panel) return null;
      var popup = typeof panel.closest === "function" ? panel.closest('[role="menu"]') : null;
      return popup || panel;
    }

    /**
     * 锁定面板开启后的最小布局宽度，防止因字重、档位文本长度或右侧指示器微调导致面板收缩抖动。
     * 异步 ResizeObserver 回调直接传入 measuredWidthHint（零强制同步回流）；仅无提示时兜底读取布局宽度。
     */
    function stabilizePanelWidth(panel, measuredWidthHint) {
      var target = resolvePanelWidthTarget(panel);
      if (!target || !target.style) return;
      var layoutW = typeof measuredWidthHint === "number" && measuredWidthHint > 0
        ? Math.ceil(measuredWidthHint)
        : 0;
      if (!(layoutW > 0)) {
        layoutW = Number(target.offsetWidth) || 0;
      }
      if (!(layoutW > 0) && typeof target.getBoundingClientRect === "function") {
        var rect = target.getBoundingClientRect();
        layoutW = rect && rect.width > 0 ? Math.ceil(rect.width) : 0;
      }
      if (!(layoutW > 0)) return;
      var prevLocked = Number(target.getAttribute("data-ces-locked-width") || "0");
      var nextLocked = Math.max(prevLocked, layoutW);
      if (nextLocked > prevLocked) {
        target.setAttribute("data-ces-locked-width", String(nextLocked));
        target.style.minWidth = nextLocked + "px";
        if (panel !== target && panel.style && panel.style.minWidth !== "100%") {
          panel.style.minWidth = "100%";
        }
      }
    }

    function clearPanelWidthLock(panel) {
      if (!panel) return;
      var target = resolvePanelWidthTarget(panel);
      if (target && target.style && target.hasAttribute && target.hasAttribute("data-ces-locked-width")) {
        target.removeAttribute("data-ces-locked-width");
        target.style.minWidth = "";
      }
      if (panel.style && panel.hasAttribute && panel.hasAttribute("data-ces-locked-width")) {
        panel.removeAttribute("data-ces-locked-width");
        panel.style.minWidth = "";
      }
      if (panel !== target && panel.style && panel.style.minWidth === "100%") {
        panel.style.minWidth = "";
      }
    }

    function getLiveContext(triggerHint, panelHint) {
      var trigger =
        triggerHint !== undefined
          ? triggerHint
          : (observedTriggerEl && !isNodeDetached(observedTriggerEl) ? observedTriggerEl : findAntigravityTrigger(doc));
      var panel =
        panelHint !== undefined
          ? panelHint
          : (activePanel && !isNodeDetached(activePanel) ? activePanel : findAntigravityPanel(doc));
      var target = trigger || panel;
      if (!target) {
        target =
          observedOrchSubmenuEl && !isNodeDetached(observedOrchSubmenuEl)
            ? observedOrchSubmenuEl
            : findOrchestratorSubmenu(doc);
      }
      return readAntigravityFiberContext(target);
    }

    function resolveOrchSubmenuForSync(orchMenuHint, profile) {
      if (orchMenuHint !== undefined) return orchMenuHint;
      if (observedOrchSubmenuEl && !isNodeDetached(observedOrchSubmenuEl)) {
        return observedOrchSubmenuEl;
      }
      if (mayHaveOrchSubmenu || activeOrchestratorMode || (profile && profile.isOrchestrator)) {
        return findOrchestratorSubmenu(doc);
      }
      return null;
    }

    function requestForeignScan(forceImmediate) {
      if (isStopped) return;
      // 拖动途中宿主 React 异步回响不立即打断当前帧，延后到松手后统一合帧同步
      if (isSliderDragging && !forceImmediate) {
        deferredScanWhileDragging = true;
        return;
      }
      scheduleScan();
    }

    function getActiveProfile(ctx) {
      if (!ctx) return null;
      if (activeOrchestratorMode && ctx.hasOrchestratorPlanners) {
        return resolveOrchestratorPlannerProfile(ctx, activeOrchestratorPlannerOverride, perOrchestratorEffortMap, doc);
      }
      var target = activeModelOptionOverride || activeBaseOverride || ctx.selectedModel;
      return resolveModelEffortProfile(ctx, target, perModelEffortMap, perOrchestratorEffortMap, doc);
    }

    function buildSeatSnapshot(ctx, prof) {
      if (!prof) {
        return {
          effortLevels: [],
          currentEffort: "",
          locked: true,
          baseName: "",
          isOrchestrator: false,
          subtitle: "",
          isClaude: false,
          theme: "codex"
        };
      }
      return {
        effortLevels: prof.levels,
        currentEffort: prof.currentEffort,
        locked: prof.locked,
        baseName: prof.baseName,
        isOrchestrator: Boolean(prof.isOrchestrator),
        subtitle: prof.isOrchestrator && prof.baseName ? "· " + prof.baseName : "",
        isClaude: Boolean(prof.isClaude),
        theme: prof.theme || "codex"
      };
    }

    /**
     * 将承载「规划器名称 + 档位词」的 span 拆分为两段内联子 span：
     * 前段保持柔和半透明灰（opacity: 0.7），仅末尾档位词按所属主题色板高亮着色（opacity: 1, fontWeight: 600）。
     */
    function renderSplitEffortSpan(hostSpan, leadingText, effortLabel, color, namePart, effortPart) {
      if (!hostSpan || !doc) return;
      var nameNode = null;
      var effortNode = null;
      if (hostSpan.children && hostSpan.children.length === 2) {
        var c0 = hostSpan.children[0];
        var c1 = hostSpan.children[1];
        if (
          c0 && c1 &&
          typeof c0.getAttribute === "function" &&
          typeof c1.getAttribute === "function" &&
          c0.getAttribute("data-ces-part") === namePart &&
          c1.getAttribute("data-ces-part") === effortPart
        ) {
          nameNode = c0;
          effortNode = c1;
        }
      }
      if (!nameNode || !effortNode) {
        hostSpan.textContent = "";
        if (hostSpan.children && hostSpan.children.length > 0 && typeof hostSpan.removeChild === "function") {
          while (hostSpan.children.length > 0) {
            hostSpan.removeChild(hostSpan.children[hostSpan.children.length - 1]);
          }
        }
        nameNode = doc.createElement("span");
        nameNode.setAttribute("data-ces-part", namePart);
        effortNode = doc.createElement("span");
        effortNode.setAttribute("data-ces-part", effortPart);
        hostSpan.appendChild(nameNode);
        hostSpan.appendChild(effortNode);
      }
      if (hostSpan.style) {
        if (hostSpan.style.opacity !== "1") hostSpan.style.opacity = "1";
        if (hostSpan.style.color !== "") hostSpan.style.color = "";
        if (hostSpan.style.fontWeight !== "") hostSpan.style.fontWeight = "";
      }
      if (nameNode.style && nameNode.style.opacity !== "0.7") {
        nameNode.style.opacity = "0.7";
      }
      if (nameNode.textContent !== leadingText) {
        nameNode.textContent = leadingText;
      }
      if (effortNode.textContent !== effortLabel) {
        effortNode.textContent = effortLabel;
      }
      if (effortNode.style) {
        var nextColor = color || "";
        var nextOpacity = nextColor ? "1" : "";
        var nextWeight = nextColor ? "600" : "";
        if (effortNode.style.color !== nextColor) effortNode.style.color = nextColor;
        if (effortNode.style.opacity !== nextOpacity) effortNode.style.opacity = nextOpacity;
        if (effortNode.style.fontWeight !== nextWeight) effortNode.style.fontWeight = nextWeight;
      }
    }

    function findOrchestratorPickerEffortSpan(row) {
      if (!row) return null;
      var leftWrap = row.firstElementChild;
      if (leftWrap && leftWrap.tagName === "SPAN" && leftWrap.children && leftWrap.children.length >= 2) {
        var candidate = leftWrap.children[1];
        if (candidate && candidate.tagName === "SPAN") return candidate;
      }
      if (typeof row.querySelector === "function") {
        var opSpan = row.querySelector("span.opacity-70");
        if (opSpan) return opSpan;
      }
      if (row.children && row.children.length >= 2 && row.children[1] && row.children[1].tagName === "SPAN") {
        return row.children[1];
      }
      return null;
    }

    function bindOrchestratorSubmenuInteractions(orchMenu) {
      if (!orchMenu || orchMenu.__cesAgOrchBound) return;
      orchMenu.__cesAgOrchBound = true;

      function findClickedOrchRow(target) {
        if (!target || typeof target.closest !== "function") return null;
        var row = target.closest('[data-testid="orchestrator-picker-row"]');
        if (!row || (typeof orchMenu.contains === "function" && !orchMenu.contains(row))) return null;
        return {
          row: row,
          base: row.getAttribute ? (row.getAttribute("data-model-base") || "") : "",
          label: row.getAttribute ? (row.getAttribute("data-model-label") || "") : ""
        };
      }

      function onOrchPointerOrMouseUpCapture(ev) {
        var hit = findClickedOrchRow(ev.target);
        if (!hit) return;
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      }

      function onOrchClickCapture(ev) {
        var hit = findClickedOrchRow(ev.target);
        if (!hit) return;

        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();

        var livePanel = activePanel || findAntigravityPanel(doc);
        var ctx = getLiveContext(undefined, livePanel || orchMenu);
        if (!ctx || !ctx.hasOrchestratorPlanners) return;

        var targetOption = null;
        if (hit.base) {
          var orchProf = resolveOrchestratorPlannerProfile(ctx, hit.base, perOrchestratorEffortMap, doc);
          if (orchProf && orchProf.modelOption) {
            targetOption = orchProf.modelOption;
          }
        } else if (hit.label) {
          var planners = Array.isArray(ctx.orchestratorPlanners) ? ctx.orchestratorPlanners : [];
          for (var i = 0; i < planners.length; i += 1) {
            if (planners[i] && planners[i].label === hit.label) {
              targetOption = planners[i];
              break;
            }
          }
        }

        if (targetOption) {
          var parsed = parseModelLabel(targetOption.label);
          if (parsed) {
            perOrchestratorEffortMap.set(parsed.base, parsed.effort);
          }
          activeOrchestratorMode = true;
          activeOrchestratorPlannerOverride = targetOption;
          activeBaseOverride = null;
          activeModelOptionOverride = ctx.orchestratorModelOption || null;

          tracePush("ag-select-orchestrator-planner", { label: targetOption.label });
          commitOrchestratorPlannerOption(ctx, targetOption, !ctx.isOrchestratorSelected);
          runInternalMutation(function () {
            var nextProf = resolveOrchestratorPlannerProfile(ctx, targetOption, perOrchestratorEffortMap, doc);
            syncAntigravityDomDecorations(ctx, nextProf, undefined, livePanel, orchMenu);
            notifySeatListeners();
          });
        }
      }

      orchMenu.addEventListener("pointerup", onOrchPointerOrMouseUpCapture, true);
      orchMenu.addEventListener("mouseup", onOrchPointerOrMouseUpCapture, true);
      orchMenu.addEventListener("click", onOrchClickCapture, true);
    }

    function syncOrchestratorSubmenuDecorations(ctx, activeProfile, orchMenuHint) {
      var profile = activeProfile || getActiveProfile(ctx);
      var orchMenu = resolveOrchSubmenuForSync(orchMenuHint, profile);
      if (!orchMenu || !ctx || !ctx.hasOrchestratorPlanners) {
        lastOrchSubmenuEl = null;
        lastOrchSubmenuSig = "";
        orchSubmenuDirty = true;
        return;
      }
      if (orchMenu.classList && !orchMenu.classList.contains("ces-ag-orch-submenu")) {
        orchMenu.classList.add("ces-ag-orch-submenu");
      }
      bindOrchestratorSubmenuInteractions(orchMenu);

      var rows = orchMenu.querySelectorAll ? orchMenu.querySelectorAll('[data-testid="orchestrator-picker-row"]') : [];
      var curOrchPlanner = resolveCurrentOrchestratorPlanner(ctx, doc);
      var curOrchParsed = curOrchPlanner && curOrchPlanner.label ? parseModelLabel(curOrchPlanner.label) : null;
      var activePlannerBase =
        profile && profile.isOrchestrator
          ? profile.baseName
          : (curOrchParsed ? curOrchParsed.base : (curOrchPlanner && curOrchPlanner.label) || "");
      var activePlannerLabel =
        profile && profile.isOrchestrator
          ? profile.currentLabel
          : (curOrchParsed ? curOrchParsed.effortLabel : "");

      var submenuSig =
        (profile && profile.isOrchestrator ? "O" : "M") +
        "|" +
        activePlannerBase +
        "|" +
        activePlannerLabel +
        "|" +
        rows.length +
        "|" +
        (ctx.orchestratorPick ? String(ctx.orchestratorPick.model) : "");

      if (!orchSubmenuDirty && orchMenu === lastOrchSubmenuEl && submenuSig === lastOrchSubmenuSig) {
        return;
      }

      for (var rIdx = 0; rIdx < rows.length; rIdx += 1) {
        var rowEl = rows[rIdx];
        var rBase = rowEl.getAttribute ? (rowEl.getAttribute("data-model-base") || "") : "";
        var rLabel = rowEl.getAttribute ? (rowEl.getAttribute("data-model-label") || "") : "";
        if (rBase) {
          var rowProf = resolveOrchestratorPlannerProfile(ctx, rBase, perOrchestratorEffortMap, doc);
          if (!rowProf) continue;
          var isRowSelected = Boolean(profile && profile.isOrchestrator && activePlannerBase === rBase);
          var nextAttr = isRowSelected ? "true" : "false";
          if (rowEl.getAttribute("data-ces-model-selected") !== nextAttr) {
            rowEl.setAttribute("data-ces-model-selected", nextAttr);
          }
          if (rowEl.classList) {
            if (isRowSelected) {
              if (rowEl.classList.contains("text-secondary-foreground")) rowEl.classList.remove("text-secondary-foreground");
              if (!rowEl.classList.contains("text-foreground")) rowEl.classList.add("text-foreground");
            } else {
              if (rowEl.classList.contains("text-foreground")) rowEl.classList.remove("text-foreground");
              if (!rowEl.classList.contains("text-secondary-foreground")) rowEl.classList.add("text-secondary-foreground");
            }
          }
          var effSpan = findOrchestratorPickerEffortSpan(rowEl);
          if (effSpan) {
            var dispLabel = isRowSelected ? profile.currentLabel : rowProf.currentLabel;
            var dispIdx = isRowSelected ? profile.currentIndex : rowProf.currentIndex;
            var dispCount = rowProf.levels.length;
            var dispMax = dispCount > 1 && dispIdx === dispCount - 1 && !isOffLevel(dispLabel);
            if (effSpan.textContent !== dispLabel) {
              effSpan.textContent = dispLabel;
            }
            var rColor = valueColorFor(dispLabel, dispIdx, dispCount, dispMax, false, rowProf.isClaude) || "";
            if (effSpan.style) {
              if (effSpan.style.color !== rColor) effSpan.style.color = rColor;
              var rOpacity = rColor ? "1" : "";
              if (effSpan.style.opacity !== rOpacity) effSpan.style.opacity = rOpacity;
              var rWeight = rColor ? "600" : "";
              if (effSpan.style.fontWeight !== rWeight) effSpan.style.fontWeight = rWeight;
            }
          }
        } else if (rLabel) {
          var isSingleSel = Boolean(
            profile &&
            profile.isOrchestrator &&
            ((profile.modelOption && profile.modelOption.label === rLabel) || activePlannerBase === rLabel)
          );
          var nextSingleOrchAttr = isSingleSel ? "true" : "false";
          if (rowEl.getAttribute && rowEl.getAttribute("data-ces-model-selected") !== nextSingleOrchAttr) {
            rowEl.setAttribute("data-ces-model-selected", nextSingleOrchAttr);
          }
          if (rowEl.classList) {
            if (isSingleSel) {
              if (rowEl.classList.contains("text-secondary-foreground")) rowEl.classList.remove("text-secondary-foreground");
              if (!rowEl.classList.contains("text-foreground")) rowEl.classList.add("text-foreground");
            } else {
              if (rowEl.classList.contains("text-foreground")) rowEl.classList.remove("text-foreground");
              if (!rowEl.classList.contains("text-secondary-foreground")) rowEl.classList.add("text-secondary-foreground");
            }
          }
        }
      }

      lastOrchSubmenuEl = orchMenu;
      lastOrchSubmenuSig = submenuSig;
      orchSubmenuDirty = false;
    }

    /**
     * 立即同步更新：
     * 1. 底部 Composer 折叠触发按钮的模型名与档位颜色
     * 2. 展开菜单中每一行模型右侧的档位文字与颜色、以及选中态高亮
     * 3. Orchestrator 主行及右侧二级子菜单的规划器档位与颜色
     */
    function syncAntigravityDomDecorations(ctx, activeProfile, triggerHint, panelHint, orchMenuHint) {
      if (!ctx) return;
      var profile = activeProfile || getActiveProfile(ctx);
      if (!profile) return;

      if (!profile.locked && profile.baseName && profile.currentEffort) {
        if (profile.isOrchestrator) {
          perOrchestratorEffortMap.set(profile.baseName, profile.currentEffort);
        } else {
          perModelEffortMap.set(profile.baseName, profile.currentEffort);
        }
      }

      var count = profile.levels.length;
      var idx = profile.currentIndex;
      var isMax = !profile.locked && count > 1 && idx === count - 1 && !isOffLevel(profile.currentLabel);

      // 1. 同步底部折叠按钮 (button[data-testid="model-selector-trigger"])
      var triggerBtn = triggerHint !== undefined ? triggerHint : findAntigravityTrigger(doc);
      var triggerSig =
        (profile.isOrchestrator ? "O" : "M") +
        "|" +
        (profile.locked ? "1" : "0") +
        "|" +
        (profile.baseName || "") +
        "|" +
        (profile.currentLabel || "") +
        "|" +
        idx +
        "|" +
        count +
        "|" +
        (isMax ? "1" : "0") +
        "|" +
        (profile.isClaude ? "1" : "0");

      if (triggerBtn) {
        if (triggerDomDirty || triggerBtn !== lastTriggerEl || triggerSig !== lastTriggerSig) {
          var outerSpan = triggerBtn.querySelector ? triggerBtn.querySelector("span.min-w-0") : null;
          if (outerSpan) {
            var allSpans = outerSpan.querySelectorAll ? outerSpan.querySelectorAll("span") : [];
            for (var sIdx = 1; sIdx < allSpans.length; sIdx += 1) {
              if (allSpans[sIdx].parentNode === outerSpan) {
                outerSpan.removeChild(allSpans[sIdx]);
              }
            }
            var effortSpan = outerSpan.querySelector
              ? outerSpan.querySelector("span.opacity-70, [data-ces-part='trigger-effort']")
              : null;
            if (profile.isOrchestrator && profile.baseName) {
              var orchFirstNode = outerSpan.firstChild;
              if (orchFirstNode && orchFirstNode.nodeType === 3 && orchFirstNode.nodeValue !== "Orchestrator") {
                orchFirstNode.nodeValue = "Orchestrator";
              }
              if (effortSpan) {
                var trigOrchColor = profile.locked
                  ? ""
                  : valueColorFor(profile.currentLabel, idx, count, isMax, false, profile.isClaude) || "";
                renderSplitEffortSpan(
                  effortSpan,
                  " " + profile.baseName + " ",
                  profile.currentLabel,
                  trigOrchColor,
                  "trigger-orch-name",
                  "trigger-orch-effort"
                );
              }
            } else if (!profile.locked && profile.baseName) {
              var firstNode = outerSpan.firstChild;
              if (firstNode && firstNode.nodeType === 3 && firstNode.nodeValue !== profile.baseName) {
                firstNode.nodeValue = profile.baseName;
              }
              if (effortSpan) {
                var nextEffortText = " " + profile.currentLabel;
                if (effortSpan.querySelector && effortSpan.querySelector('[data-ces-part="trigger-orch-name"]')) {
                  effortSpan.textContent = nextEffortText;
                  if (effortSpan.children && effortSpan.children.length > 0 && typeof effortSpan.removeChild === "function") {
                    while (effortSpan.children.length > 0) {
                      effortSpan.removeChild(effortSpan.children[effortSpan.children.length - 1]);
                    }
                  }
                } else if (effortSpan.textContent !== nextEffortText) {
                  effortSpan.textContent = nextEffortText;
                }
              }
            }
          }
          syncTriggerColor(doc, profile.currentLabel, idx, count, isMax, false, profile.isClaude, triggerBtn);
          lastTriggerEl = triggerBtn;
          lastTriggerSig = triggerSig;
          triggerDomDirty = false;
        }
      } else {
        lastTriggerEl = null;
        lastTriggerSig = "";
        syncTriggerColor(doc, profile.currentLabel, idx, count, isMax, false, profile.isClaude, null);
      }

      // 2. 同步展开菜单中的各模型行
      var panel = panelHint !== undefined ? panelHint : findAntigravityPanel(doc);
      if (!panel) {
        lastPanelEl = null;
        lastPanelSig = "";
        cachedGroupSpans = null;
        cachedSingleItems = null;
        cachedOrchRow = null;
        panelRowsDirty = true;
        syncOrchestratorSubmenuDecorations(ctx, profile, orchMenuHint);
        return;
      }

      var orchRowProf = null;
      var orchRowSig = "";
      if (ctx.hasOrchestratorPlanners) {
        if (profile.isOrchestrator) {
          orchRowProf = profile;
          orchRowSig = orchRowProf.baseName + ":" + orchRowProf.currentLabel;
        } else if (
          ctx.orchestratorPick &&
          (ctx.orchestratorPick.model === 0 || ctx.orchestratorPick.model === undefined) &&
          !panelRowsDirty &&
          !panelDecorDirty &&
          cachedOrchRow
        ) {
          var cachedOrchModelSpan = cachedOrchRow.querySelector
            ? cachedOrchRow.querySelector('[data-testid="model-selector-orchestrator-model"]')
            : null;
          var cBase = cachedOrchModelSpan && cachedOrchModelSpan.getAttribute
            ? (cachedOrchModelSpan.getAttribute("data-ces-planner-base") || "")
            : "";
          var cEffort = cachedOrchModelSpan && cachedOrchModelSpan.getAttribute
            ? (cachedOrchModelSpan.getAttribute("data-ces-planner-effort") || "")
            : "";
          if (cBase && cEffort) {
            orchRowSig = cBase + ":" + (AG_EFFORT_LABELS[normalizeEffortKey(cEffort)] || cEffort);
          }
        }
        if (!orchRowSig) {
          orchRowProf = resolveOrchestratorPlannerProfile(ctx, null, perOrchestratorEffortMap, doc);
          orchRowSig = orchRowProf ? (orchRowProf.baseName + ":" + orchRowProf.currentLabel) : "";
        }
      }

      var panelSig =
        (profile.isOrchestrator ? "O" : "M") +
        "|" +
        orchRowSig +
        "|" +
        (profile.baseName || "") +
        "|" +
        (profile.currentLabel || "") +
        "|" +
        idx +
        "|" +
        count +
        "|" +
        (isMax ? "1" : "0") +
        "|" +
        (profile.isClaude ? "1" : "0") +
        "|" +
        (profile.locked ? "1" : "0") +
        "|" +
        (ctx.effortIndex instanceof Map ? ctx.effortIndex.size : 0);

      if (!panelDecorDirty && !panelRowsDirty && panel === lastPanelEl && panelSig === lastPanelSig) {
        syncOrchestratorSubmenuDecorations(ctx, profile, orchMenuHint);
        return;
      }

      if (panelRowsDirty || panel !== lastPanelEl || !cachedGroupSpans || !cachedSingleItems || typeof MO !== "function") {
        cachedGroupSpans = panel.querySelectorAll('[data-testid="model-selector-effort-group"]');
        cachedSingleItems = panel.querySelectorAll('[data-testid="model-selector-item"]');
        cachedOrchRow = panel.querySelector('[data-testid="model-selector-orchestrator"]');
        panelRowsDirty = false;
      }

      if (cachedOrchRow && orchRowProf) {
        var isOrchRowSelected = Boolean(profile.isOrchestrator);
        var nextOrchAttr = isOrchRowSelected ? "true" : "false";
        if (cachedOrchRow.getAttribute("data-ces-model-selected") !== nextOrchAttr) {
          cachedOrchRow.setAttribute("data-ces-model-selected", nextOrchAttr);
        }
        if (cachedOrchRow.classList) {
          if (isOrchRowSelected) {
            if (cachedOrchRow.classList.contains("text-secondary-foreground")) {
              cachedOrchRow.classList.remove("text-secondary-foreground");
            }
            if (!cachedOrchRow.classList.contains("text-foreground")) {
              cachedOrchRow.classList.add("text-foreground");
            }
          } else {
            if (cachedOrchRow.classList.contains("text-foreground")) {
              cachedOrchRow.classList.remove("text-foreground");
            }
            if (!cachedOrchRow.classList.contains("text-secondary-foreground")) {
              cachedOrchRow.classList.add("text-secondary-foreground");
            }
          }
        }
        var orchModelSpan = cachedOrchRow.querySelector
          ? cachedOrchRow.querySelector('[data-testid="model-selector-orchestrator-model"]')
          : null;
        if (orchModelSpan) {
          if (orchRowProf.baseName && orchModelSpan.getAttribute("data-ces-planner-base") !== orchRowProf.baseName) {
            orchModelSpan.setAttribute("data-ces-planner-base", orchRowProf.baseName);
          }
          if (orchRowProf.currentEffort && orchModelSpan.getAttribute("data-ces-planner-effort") !== orchRowProf.currentEffort) {
            orchModelSpan.setAttribute("data-ces-planner-effort", orchRowProf.currentEffort);
          }
          var orchRowCount = orchRowProf.levels.length;
          var orchRowIdx = orchRowProf.currentIndex;
          var orchRowMax = !orchRowProf.locked && orchRowCount > 1 && orchRowIdx === orchRowCount - 1 && !isOffLevel(orchRowProf.currentLabel);
          var orchRowColor = orchRowProf.locked
            ? ""
            : valueColorFor(orchRowProf.currentLabel, orchRowIdx, orchRowCount, orchRowMax, false, orchRowProf.isClaude) || "";
          renderSplitEffortSpan(
            orchModelSpan,
            orchRowProf.baseName + " ",
            orchRowProf.currentLabel,
            orchRowColor,
            "orch-model-name",
            "orch-effort"
          );
        }
      }

      var groupSpans = cachedGroupSpans;
      for (var i = 0; i < groupSpans.length; i += 1) {
        var gSpan = groupSpans[i];
        var base = gSpan.getAttribute("data-model-base") || (gSpan.textContent || "").trim();
        var menuItem = gSpan.closest('[role="menuitem"]');
        var rowProf = resolveModelEffortProfile(ctx, base, perModelEffortMap, perOrchestratorEffortMap, doc);
        if (!rowProf) continue;

        var isSelectedModel = !profile.isOrchestrator && profile.baseName === base;
        if (menuItem) {
          var nextSelectedAttr = isSelectedModel ? "true" : "false";
          if (menuItem.getAttribute("data-ces-model-selected") !== nextSelectedAttr) {
            menuItem.setAttribute("data-ces-model-selected", nextSelectedAttr);
          }
          if (isSelectedModel) {
            if (menuItem.classList.contains("text-secondary-foreground")) {
              menuItem.classList.remove("text-secondary-foreground");
            }
            if (!menuItem.classList.contains("text-foreground")) {
              menuItem.classList.add("text-foreground");
            }
          } else {
            if (menuItem.classList.contains("text-foreground")) {
              menuItem.classList.remove("text-foreground");
            }
            if (!menuItem.classList.contains("text-secondary-foreground")) {
              menuItem.classList.add("text-secondary-foreground");
            }
          }
        }

        // 模型名右侧的档位标签 (<span class="shrink-0 opacity-70 text-xs">)
        var sib = gSpan.nextElementSibling;
        if (sib && sib.tagName === "SPAN") {
          var displayEffort = isSelectedModel ? profile.currentLabel : rowProf.currentLabel;
          var displayIdx = isSelectedModel ? profile.currentIndex : rowProf.currentIndex;
          var displayCount = rowProf.levels.length;
          var displayMax = displayCount > 1 && displayIdx === displayCount - 1 && !isOffLevel(displayEffort);
          if (sib.textContent !== displayEffort) {
            sib.textContent = displayEffort;
          }
          var rowColor = valueColorFor(displayEffort, displayIdx, displayCount, displayMax, false, rowProf.isClaude) || "";
          if (sib.style.color !== rowColor) sib.style.color = rowColor;
          var rowOpacity = rowColor ? "1" : "";
          if (sib.style.opacity !== rowOpacity) sib.style.opacity = rowOpacity;
          var rowWeight = rowColor ? "600" : "";
          if (sib.style.fontWeight !== rowWeight) sib.style.fontWeight = rowWeight;
        }
      }

      var singleItems = cachedSingleItems;
      for (var j = 0; j < singleItems.length; j += 1) {
        var sItem = singleItems[j];
        var sLabel = sItem.getAttribute("data-model-label") || "";
        var isSingleSelected =
          !profile.isOrchestrator &&
          ((profile.modelOption && profile.modelOption.label === sLabel) ||
            profile.baseName === sLabel);
        var nextSingleAttr = isSingleSelected ? "true" : "false";
        if (sItem.getAttribute("data-ces-model-selected") !== nextSingleAttr) {
          sItem.setAttribute("data-ces-model-selected", nextSingleAttr);
        }
        if (isSingleSelected) {
          if (sItem.classList.contains("text-secondary-foreground")) {
            sItem.classList.remove("text-secondary-foreground");
          }
          if (!sItem.classList.contains("text-foreground")) {
            sItem.classList.add("text-foreground");
          }
        } else {
          if (sItem.classList.contains("text-foreground")) {
            sItem.classList.remove("text-foreground");
          }
          if (!sItem.classList.contains("text-secondary-foreground")) {
            sItem.classList.add("text-secondary-foreground");
          }
        }
      }

      lastPanelEl = panel;
      lastPanelSig = panelSig;
      panelDecorDirty = false;
      syncOrchestratorSubmenuDecorations(ctx, profile, orchMenuHint);
    }

    var agSeatAdapter = {
      getSnapshot: function () {
        var ctx = getLiveContext();
        var prof = getActiveProfile(ctx);
        return buildSeatSnapshot(ctx, prof);
      },
      get effortLevels() {
        var ctx = getLiveContext();
        var prof = getActiveProfile(ctx);
        return prof ? prof.levels : [];
      },
      get currentEffort() {
        var ctx = getLiveContext();
        var prof = getActiveProfile(ctx);
        return prof ? prof.currentEffort : "";
      },
      get locked() {
        var ctx = getLiveContext();
        var prof = getActiveProfile(ctx);
        return prof ? prof.locked : true;
      },
      get baseName() {
        var ctx = getLiveContext();
        var prof = getActiveProfile(ctx);
        return prof ? prof.baseName : "";
      },
      get isClaude() {
        var ctx = getLiveContext();
        var prof = getActiveProfile(ctx);
        return prof ? Boolean(prof.isClaude) : false;
      },
      get theme() {
        var ctx = getLiveContext();
        var prof = getActiveProfile(ctx);
        return prof ? (prof.theme || "codex") : "codex";
      },
      selectEffort: function (levelItem) {
        var ctx = getLiveContext();
        if (!ctx || !levelItem) return;
        var targetOpt = levelItem.modelOption || (levelItem.raw && levelItem.raw.modelOption);
        if (!targetOpt) return;

        var curProf = getActiveProfile(ctx);
        var isOrchMode = Boolean(curProf && curProf.isOrchestrator && ctx.hasOrchestratorPlanners);
        var parsed = parseModelLabel(targetOpt.label);

        if (isOrchMode) {
          if (parsed) {
            perOrchestratorEffortMap.set(parsed.base, parsed.effort);
          }
          activeOrchestratorMode = true;
          activeOrchestratorPlannerOverride = targetOpt;
          if (!ctx.isOrchestratorSelected && ctx.orchestratorModelOption) {
            activeModelOptionOverride = ctx.orchestratorModelOption;
            activeBaseOverride = null;
          }
          commitOrchestratorPlannerOption(ctx, targetOpt, !ctx.isOrchestratorSelected);
          runInternalMutation(function () {
            var updatedProfile = resolveOrchestratorPlannerProfile(ctx, targetOpt, perOrchestratorEffortMap, doc);
            syncAntigravityDomDecorations(
              ctx,
              updatedProfile,
              observedTriggerEl || undefined,
              activePanel || undefined,
              observedOrchSubmenuEl || null
            );
            lastCommittedSyncKey = updatedProfile
              ? ("O|" + (updatedProfile.baseName || "") + "|" + (updatedProfile.currentLabel || ""))
              : "";
          });
          return;
        }

        activeOrchestratorMode = false;
        activeOrchestratorPlannerOverride = null;
        if (parsed) {
          perModelEffortMap.set(parsed.base, parsed.effort);
          activeBaseOverride = parsed.base;
        }
        activeModelOptionOverride = targetOpt;

        commitAntigravityModelOption(ctx, targetOpt);

        runInternalMutation(function () {
          var updatedProfile = resolveModelEffortProfile(ctx, targetOpt, perModelEffortMap, perOrchestratorEffortMap, doc);
          syncAntigravityDomDecorations(
            ctx,
            updatedProfile,
            observedTriggerEl || undefined,
            activePanel || undefined,
            observedOrchSubmenuEl || null
          );
          lastCommittedSyncKey = updatedProfile
            ? ("M|" + (updatedProfile.baseName || "") + "|" + (updatedProfile.currentLabel || ""))
            : "";
        });
      },
      subscribe: function (fn) {
        activeSeatListeners.add(fn);
        return function () {
          activeSeatListeners.delete(fn);
        };
      }
    };

    function bindPanelInteractions(panel) {
      if (!panel || panel.__cesAgBound) return;
      panel.__cesAgBound = true;

      function findClickedModelRow(target) {
        if (!target || typeof target.closest !== "function") return null;
        if (target.closest(".ces-ag-section, .ces-set")) return null;
        if (target.closest('button[aria-label="Edit Model"]')) return null;
        if (target.closest('[data-testid="orchestrator-picker-row"]')) return null;

        var orchRow = target.closest('[data-testid="model-selector-orchestrator"]');
        if (orchRow && panel.contains(orchRow)) {
          return { type: "orchestrator", row: orchRow };
        }

        var singleRow = target.closest('[data-testid="model-selector-item"]');
        if (singleRow && panel.contains(singleRow)) {
          return { type: "single", row: singleRow, label: singleRow.getAttribute("data-model-label") || "" };
        }

        var menuItem = target.closest('[role="menuitem"]');
        if (!menuItem || !panel.contains(menuItem)) return null;
        var groupSpan = menuItem.querySelector('[data-testid="model-selector-effort-group"]');
        if (groupSpan) {
          var base = groupSpan.getAttribute("data-model-base") || (groupSpan.textContent || "").trim();
          return { type: "group", row: menuItem, base: base };
        }
        return null;
      }

      // 捕获阶段拦截模型行 pointerup / mouseup，阻止 @base-ui/react 菜单因抬起指针而自动关闭
      function onPointerOrMouseUpCapture(ev) {
        if (ev.target && typeof ev.target.closest === "function" && ev.target.closest(".ces-ag-section")) {
          return;
        }
        var hit = findClickedModelRow(ev.target);
        if (!hit) return;
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      }

      // 捕获阶段拦截模型行 click：切换选中模型但保持菜单常开，下方滑条即时联动该模型的档位
      function onClickCapture(ev) {
        if (ev.target && typeof ev.target.closest === "function" && ev.target.closest(".ces-ag-section")) {
          return;
        }
        var hit = findClickedModelRow(ev.target);
        if (!hit) return;

        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();

        var ctx = getLiveContext(undefined, panel);
        if (!ctx) return;

        if (hit.type === "orchestrator") {
          if (ctx.hasOrchestratorPlanners && ctx.orchestratorModelOption) {
            var orchProf = resolveOrchestratorPlannerProfile(ctx, null, perOrchestratorEffortMap, doc);
            activeOrchestratorMode = true;
            activeOrchestratorPlannerOverride = (orchProf && orchProf.modelOption) || null;
            activeBaseOverride = null;
            activeModelOptionOverride = ctx.orchestratorModelOption;

            tracePush("ag-select-orchestrator-in-menu", {
              label: orchProf ? (orchProf.baseName + " " + orchProf.currentLabel) : ctx.orchestratorModelOption.label
            });
            commitAntigravityModelOption(ctx, ctx.orchestratorModelOption);
            runInternalMutation(function () {
              var nextProf = resolveOrchestratorPlannerProfile(
                ctx,
                activeOrchestratorPlannerOverride,
                perOrchestratorEffortMap,
                doc
              );
              syncAntigravityDomDecorations(ctx, nextProf, undefined, panel);
              notifySeatListeners();
            });
          }
          return;
        }

        activeOrchestratorMode = false;
        activeOrchestratorPlannerOverride = null;

        var targetOption = null;
        if (hit.type === "group" && hit.base) {
          var prof = resolveModelEffortProfile(ctx, hit.base, perModelEffortMap, perOrchestratorEffortMap, doc);
          if (prof && prof.modelOption) {
            targetOption = prof.modelOption;
            activeBaseOverride = hit.base;
            activeModelOptionOverride = targetOption;
          }
        } else if (hit.type === "single" && hit.label) {
          var optsList = Array.isArray(ctx.modelOptions) ? ctx.modelOptions : [];
          for (var i = 0; i < optsList.length; i += 1) {
            if (optsList[i] && optsList[i].label === hit.label) {
              targetOption = optsList[i];
              break;
            }
          }
          if (targetOption) {
            activeBaseOverride = hit.label;
            activeModelOptionOverride = targetOption;
          }
        }

        if (targetOption) {
          tracePush("ag-select-model-in-menu", { label: targetOption.label });
          commitAntigravityModelOption(ctx, targetOption);
          runInternalMutation(function () {
            var nextProf = resolveModelEffortProfile(ctx, targetOption, perModelEffortMap, perOrchestratorEffortMap, doc);
            syncAntigravityDomDecorations(ctx, nextProf, undefined, panel);
            notifySeatListeners();
          });
        }
      }

      // 拦截 View Usage 触发项的划过展开，增加 0.3s (300ms) 停留防误触展开延迟
      var usageHoverTimer = null;
      var usageTriggerEl = null;
      var usageHoverAllowed = false;
      var isDispatchingSynthetic = false;

      function findViewUsageTrigger(target) {
        if (!target || typeof target.closest !== "function") return null;
        var item = target.closest('[role="menuitem"], .agy-overlay-item, button');
        if (!item) {
          var div = target.closest('div');
          if (div && div !== panel && panel.contains(div)) {
            var text = (div.textContent || "").trim();
            if ((text.startsWith("View Usage") || text === "Usage") && !text.includes("Claude") && !text.includes("Gemini") && !text.includes("GPT")) {
              item = div;
            }
          }
        }
        if (!item || !panel.contains(item) || item === panel) return null;
        var itemText = (item.textContent || "").trim();
        if (itemText.includes("View Usage") || itemText.includes("Usage")) {
          return item;
        }
        return null;
      }

      function resetUsageHover() {
        if (usageHoverTimer) {
          clearTimeout(usageHoverTimer);
          usageHoverTimer = null;
        }
        usageHoverAllowed = false;
        usageTriggerEl = null;
      }

      function onTriggerLeave() {
        resetUsageHover();
      }

      function onPointerEnterCapture(ev) {
        if (isDispatchingSynthetic) return;

        var trigger = findViewUsageTrigger(ev.target);
        if (!trigger) {
          resetUsageHover();
          return;
        }

        if (usageHoverAllowed && usageTriggerEl === trigger) {
          return;
        }

        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();

        resetUsageHover();
        usageTriggerEl = trigger;

        // 直接在目标元素上注册离开监听（W3C 规范：pointerleave 仅在离开该元素时触发且不冒泡）
        try {
          trigger.addEventListener("pointerleave", onTriggerLeave, { once: true });
          trigger.addEventListener("mouseleave", onTriggerLeave, { once: true });
        } catch (e) {}

        var clientX = ev.clientX;
        var clientY = ev.clientY;
        var pointerId = ev.pointerId || 1;
        var pointerType = ev.pointerType || "mouse";

        usageHoverTimer = setTimeout(function () {
          usageHoverTimer = null;
          if (trigger && panel.contains(trigger)) {
            usageHoverAllowed = true;
            isDispatchingSynthetic = true;
            try {
              var PE = (win && win.PointerEvent) || (typeof PointerEvent !== "undefined" ? PointerEvent : null);
              var ME = (win && win.MouseEvent) || (typeof MouseEvent !== "undefined" ? MouseEvent : null);
              var EV = (win && win.Event) || (typeof Event !== "undefined" ? Event : null);

              if (typeof PE === "function") {
                trigger.dispatchEvent(new PE("pointerenter", {
                  bubbles: false,
                  cancelable: true,
                  pointerId: pointerId,
                  pointerType: pointerType,
                  clientX: clientX,
                  clientY: clientY
                }));
                trigger.dispatchEvent(new PE("pointerover", {
                  bubbles: true,
                  cancelable: true,
                  pointerId: pointerId,
                  pointerType: pointerType,
                  clientX: clientX,
                  clientY: clientY
                }));
                trigger.dispatchEvent(new PE("pointermove", {
                  bubbles: true,
                  cancelable: true,
                  pointerId: pointerId,
                  pointerType: pointerType,
                  clientX: clientX,
                  clientY: clientY
                }));
              } else if (typeof ME === "function") {
                trigger.dispatchEvent(new ME("mouseenter", {
                  bubbles: false,
                  cancelable: true,
                  clientX: clientX,
                  clientY: clientY
                }));
              } else if (typeof EV === "function") {
                trigger.dispatchEvent(new EV("pointerenter", { bubbles: false, cancelable: true }));
              }
            } catch (err) {
              // 忽略派发失败
            } finally {
              isDispatchingSynthetic = false;
            }
          }
        }, 300);
      }

      function onPointerOverCapture(ev) {
        if (isDispatchingSynthetic) return;
        var trigger = findViewUsageTrigger(ev.target);
        if (!trigger) {
          // 鼠标移动到模型项或其它非 View Usage 元素，立即重置延迟状态
          if (usageHoverAllowed || usageHoverTimer) {
            resetUsageHover();
          }
          return;
        }
        if (!usageHoverAllowed) {
          ev.stopPropagation();
          if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
        }
      }

      function onPointerOutCapture(ev) {
        if (isDispatchingSynthetic) return;
        var trigger = findViewUsageTrigger(ev.target);
        if (trigger) {
          var rel = ev.relatedTarget;
          // 若相关目标已不在当前 trigger 内部，说明鼠标已移出 View Usage
          if (!rel || !trigger.contains(rel)) {
            resetUsageHover();
          }
        }
      }

      function onPointerMoveCapture(ev) {
        if (isDispatchingSynthetic) return;
        var trigger = findViewUsageTrigger(ev.target);
        if (trigger && !usageHoverAllowed) {
          ev.stopPropagation();
          if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
        }
      }

      function onPointerLeaveCapture(ev) {
        // panel 自身的 pointerleave，或鼠标彻底移出面板
        var rel = ev.relatedTarget;
        if (!rel || !panel.contains(rel)) {
          resetUsageHover();
        }
      }

      panel.addEventListener("pointerenter", onPointerEnterCapture, true);
      panel.addEventListener("pointerover", onPointerOverCapture, true);
      panel.addEventListener("pointerout", onPointerOutCapture, true);
      panel.addEventListener("pointerleave", onPointerLeaveCapture, true);
      panel.addEventListener("pointermove", onPointerMoveCapture, true);
      panel.addEventListener("pointerup", onPointerOrMouseUpCapture, true);
      panel.addEventListener("mouseup", onPointerOrMouseUpCapture, true);
      panel.addEventListener("click", onClickCapture, true);

      panel.__cesAgResetUsageHover = resetUsageHover;
    }

    function rebindPanelObserver(panel) {
      if (isStopped) return;
      var target = panel ? resolvePanelWidthTarget(panel) || panel : null;
      if (observedPanelEl === target && (!target || panelObserver)) return;
      if (panelObserver) {
        panelObserver.disconnect();
        panelObserver = null;
      }
      observedPanelEl = target;
      if (!observedPanelEl || typeof MO !== "function") return;
      panelObserver = new MO(function (records) {
        if (isStopped || isInternalMutating) return;
        var hasForeign = false;
        for (var i = 0; i < records.length; i += 1) {
          var rec = records[i];
          if (isOwnMutationRecord(rec)) continue;
          hasForeign = true;
          panelDecorDirty = true;
          if (rec.type === "childList") {
            panelRowsDirty = true;
            mayHaveOrchSubmenu = true;
          }
        }
        if (hasForeign) {
          requestForeignScan(false);
        }
      });
      try {
        panelObserver.observe(observedPanelEl, {
          childList: true,
          subtree: true,
          characterData: true
        });
      } catch (err) {
        panelObserver = null;
      }
    }

    function rebindOrchestratorSubmenuObserver(orchMenu) {
      if (isStopped) return;
      if (observedOrchSubmenuEl === orchMenu && (!orchMenu || orchSubmenuObserver)) return;
      if (orchSubmenuObserver) {
        orchSubmenuObserver.disconnect();
        orchSubmenuObserver = null;
      }
      observedOrchSubmenuEl = orchMenu || null;
      if (!observedOrchSubmenuEl || typeof MO !== "function") return;
      orchSubmenuObserver = new MO(function (records) {
        if (isStopped || isInternalMutating) return;
        for (var i = 0; i < records.length; i += 1) {
          if (!isOwnMutationRecord(records[i])) {
            orchSubmenuDirty = true;
            mayHaveOrchSubmenu = true;
            requestForeignScan(false);
            return;
          }
        }
      });
      try {
        orchSubmenuObserver.observe(observedOrchSubmenuEl, {
          childList: true,
          subtree: true,
          characterData: true
        });
      } catch (err) {
        orchSubmenuObserver = null;
      }
    }

    function unmountActiveSection() {
      if (postMountRafId !== null && win && typeof win.cancelAnimationFrame === "function") {
        win.cancelAnimationFrame(postMountRafId);
      }
      postMountRafId = null;
      if (panelResizeObserver) {
        try {
          panelResizeObserver.disconnect();
        } catch (err) {}
        panelResizeObserver = null;
      }
      rebindPanelObserver(null);
      rebindOrchestratorSubmenuObserver(null);
      if (activePanel && typeof activePanel.__cesAgResetUsageHover === "function") {
        try {
          activePanel.__cesAgResetUsageHover();
        } catch (e) {}
      }
      if (activePanel) {
        clearPanelWidthLock(activePanel);
      }
      if (doc && doc.activeElement && activeSection && activeSection.contains(doc.activeElement)) {
        try {
          doc.activeElement.blur();
        } catch (e) {}
      }
      if (activeMount) {
        activeMount.unmount();
        activeMount = null;
      }
      if (activeSection && activeSection.parentNode) {
        activeSection.parentNode.removeChild(activeSection);
      }
      activeSection = null;
      activePanel = null;
      activeBaseOverride = null;
      activeModelOptionOverride = null;
      activeOrchestratorMode = false;
      activeOrchestratorPlannerOverride = null;
      panelResizeDispatched = false;
      lastPanelEl = null;
      lastPanelSig = "";
      cachedGroupSpans = null;
      cachedSingleItems = null;
      cachedOrchRow = null;
      panelRowsDirty = true;
      panelDecorDirty = true;
      lastOrchSubmenuEl = null;
      lastOrchSubmenuSig = "";
      orchSubmenuDirty = true;
      lastCommittedSyncKey = "";
      isSliderDragging = false;
      deferredScanWhileDragging = false;
      mayHaveOrchSubmenu = false;
    }

    function mountSectionIntoPanel(panel, ctx) {
      if (!panel.classList.contains("ces-ag-panel-enhanced")) {
        panel.classList.add("ces-ag-panel-enhanced");
      }
      bindPanelInteractions(panel);

      var section = doc.createElement("div");
      section.className = "ces-ag-section";
      section.setAttribute("data-ces-part", "ag-section");
      section.addEventListener("pointerdown", function (ev) {
        if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
      });
      section.addEventListener("mousedown", function (ev) {
        if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
      });
      section.addEventListener("pointerup", function (ev) {
        if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
      });
      section.addEventListener("mouseup", function (ev) {
        if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
      });
      section.addEventListener("click", function (ev) {
        if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
      });

      var sep = doc.createElement("div");
      sep.setAttribute("role", "separator");
      sep.setAttribute("aria-orientation", "horizontal");
      sep.className = "h-px bg-border my-1 -mx-1";
      section.appendChild(sep);

      var row = doc.createElement("div");
      row.className = "ces-ag-effort-row text-foreground";
      row.setAttribute("data-ces-effort-row", "true");

      var head = doc.createElement("div");
      head.className = "ces-ag-effort-head";

      var title = doc.createElement("span");
      title.className = "ces-ag-effort-title";

      var titleLabel = doc.createElement("span");
      titleLabel.className = "ces-ag-effort-title-label";
      titleLabel.textContent = t(detectUiLocale(win), "sliderLabel");

      var subtitleEl = doc.createElement("span");
      subtitleEl.className = "ces-ag-effort-subtitle";
      subtitleEl.setAttribute("data-ces-part", "subtitle");

      var initProf = getActiveProfile(ctx);
      var initSubtitle = initProf && initProf.isOrchestrator && initProf.baseName ? "· " + initProf.baseName : "";
      subtitleEl.textContent = initSubtitle;
      if (!initSubtitle && subtitleEl.style) {
        subtitleEl.style.display = "none";
      }
      title.appendChild(titleLabel);
      title.appendChild(subtitleEl);

      var valueEl = doc.createElement("span");
      valueEl.className = "ces-ag-effort-value";
      valueEl.setAttribute("data-ces-part", "value");
      if (initProf && initProf.currentLabel) {
        valueEl.textContent = initProf.currentLabel;
      }

      head.appendChild(title);
      head.appendChild(valueEl);
      row.appendChild(head);

      var hostEl = doc.createElement("div");
      hostEl.className = "ces-inline";
      hostEl.setAttribute("data-ces-part", "host");
      row.appendChild(hostEl);

      section.appendChild(row);

      // 挂载位置：模型列表容器 (panel.firstElementChild) 之后、View Usage 分隔线之前
      var modelListWrapper = panel.firstElementChild;
      if (modelListWrapper && modelListWrapper.nextSibling) {
        panel.insertBefore(section, modelListWrapper.nextSibling);
      } else {
        panel.appendChild(section);
      }

      activePanel = panel;
      activeSection = section;
      panelResizeDispatched = false;
      panelRowsDirty = true;
      panelDecorDirty = true;
      mayHaveOrchSubmenu = true;

      activeMount = mountCodexEffortSlider({
        container: hostEl,
        panel: panel,
        row: row,
        valueElement: valueEl,
        subtitleElement: subtitleEl,
        seat: agSeatAdapter,
        document: doc,
        window: win,
        onDraggingChange: function (isNowDragging) {
          isSliderDragging = Boolean(isNowDragging);
          if (!isSliderDragging && deferredScanWhileDragging && !isStopped) {
            deferredScanWhileDragging = false;
            scheduleScan();
          }
        },
        onVisualChange: function (vState) {
          if (lastCommittedSyncKey) {
            var expectedSuffix = "|" + (vState && vState.label ? vState.label : "");
            if (lastCommittedSyncKey.slice(-expectedSuffix.length) === expectedSuffix) {
              lastCommittedSyncKey = "";
              return;
            }
            lastCommittedSyncKey = "";
          }
          runInternalMutation(function () {
            var liveCtx = getLiveContext(observedTriggerEl || undefined, panel);
            if (liveCtx) {
              syncAntigravityDomDecorations(
                liveCtx,
                getActiveProfile(liveCtx),
                observedTriggerEl || undefined,
                panel,
                observedOrchSubmenuEl || null
              );
            } else {
              syncTriggerColor(doc, vState.label, vState.index, vState.count, vState.isMax, false, undefined, observedTriggerEl);
            }
          });
        }
      });

      var widthTarget = resolvePanelWidthTarget(panel);
      var RO = (win && win.ResizeObserver) || (typeof ResizeObserver === "function" ? ResizeObserver : null);
      if (typeof RO === "function" && widthTarget) {
        try {
          panelResizeObserver = new RO(function (entries) {
            if (isStopped || activePanel !== panel) return;
            var measuredW = 0;
            if (entries && entries.length > 0) {
              var entry = entries[0];
              if (entry && entry.borderBoxSize) {
                var box = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
                if (box && box.inlineSize > 0) measuredW = box.inlineSize;
              }
              if (!(measuredW > 0) && entry && entry.contentRect && entry.contentRect.width > 0) {
                measuredW = entry.contentRect.width;
              }
            }
            if (measuredW > 0) {
              runInternalMutation(function () {
                stabilizePanelWidth(panel, measuredW);
              });
            }
          });
          panelResizeObserver.observe(widthTarget);
        } catch (err) {
          panelResizeObserver = null;
        }
      } else {
        stabilizePanelWidth(panel);
      }

      try {
        if (win && typeof win.requestAnimationFrame === "function") {
          postMountRafId = win.requestAnimationFrame(function () {
            postMountRafId = null;
            if (isStopped || activePanel !== panel) return;
            if (doc.body && typeof doc.body.contains === "function" && !doc.body.contains(panel)) return;
            if (!panelResizeObserver) {
              runInternalMutation(function () {
                stabilizePanelWidth(panel);
              });
            }
            if (!panelResizeDispatched && widthTarget && typeof widthTarget.getBoundingClientRect === "function") {
              var rect = widthTarget.getBoundingClientRect();
              var vh = Number(win.innerHeight) || 0;
              var vw = Number(win.innerWidth) || 0;
              var outOfBounds =
                Boolean(rect && rect.height > 0 && vh > 0) &&
                (rect.top < 4 ||
                  rect.bottom > vh - 4 ||
                  (vw > 0 && (rect.left < 4 || rect.right > vw - 4)));
              if (outOfBounds) {
                panelResizeDispatched = true;
                try {
                  if (typeof win.dispatchEvent === "function" && typeof win.Event === "function") {
                    win.dispatchEvent(new win.Event("resize"));
                  }
                } catch (err) {
                  // 忽略 resize 触发失败
                }
              }
            }
          });
        }
      } catch (err) {
        // 忽略 rAF 不可用环境
      }
    }

    function isPotentialPanelPortalNode(node) {
      if (!node || node.nodeType !== 1 || isOwnCesNode(node)) return false;
      if (typeof node.getAttribute === "function") {
        if (node.getAttribute("data-testid") === "model-selector-panel") return true;
        var role = node.getAttribute("role");
        if (role === "menu" || role === "dialog") return true;
        if (
          node.hasAttribute &&
          (node.hasAttribute("data-radix-portal") ||
            node.hasAttribute("data-base-ui-portal") ||
            node.hasAttribute("data-floating-ui-portal"))
        ) {
          return true;
        }
      }
      if (typeof node.querySelector === "function") {
        if (node.querySelector('[data-testid="model-selector-panel"], [data-testid="orchestrator-picker-row"]')) return true;
        if (!observedTriggerEl && node.querySelector('[data-testid="model-selector-trigger"], button[aria-label^="Select model"]')) {
          return true;
        }
      }
      return false;
    }

    function listContainsTarget(nodeList, target) {
      if (!nodeList || !target) return false;
      for (var i = 0; i < nodeList.length; i += 1) {
        var n = nodeList[i];
        if (n === target || (typeof n.contains === "function" && n.contains(target))) {
          return true;
        }
      }
      return false;
    }

    function rebindTriggerObserver(triggerBtn) {
      if (isStopped) return;
      if (observedTriggerEl === triggerBtn && triggerObserver) return;
      if (triggerObserver) {
        triggerObserver.disconnect();
        triggerObserver = null;
      }
      observedTriggerEl = triggerBtn || null;
      if (!observedTriggerEl || typeof MO !== "function") return;
      triggerObserver = new MO(function (records) {
        if (isStopped || isInternalMutating) return;
        for (var i = 0; i < records.length; i += 1) {
          if (!isOwnMutationRecord(records[i])) {
            triggerDomDirty = true;
            requestForeignScan(false);
            return;
          }
        }
      });
      try {
        triggerObserver.observe(observedTriggerEl, {
          attributes: true,
          attributeFilter: ["aria-expanded", "data-state", "data-popup-open"],
          childList: true,
          subtree: true,
          characterData: true
        });
      } catch (err) {
        triggerObserver = null;
      }
    }

    function ensureBootObserver() {
      if (isStopped || bootObserver || typeof MO !== "function") return;
      bootObserver = new MO(function (records) {
        if (isStopped || isInternalMutating) return;
        for (var i = 0; i < records.length; i += 1) {
          if (isOwnMutationRecord(records[i])) continue;
          if (findAntigravityTrigger(doc) || findAntigravityPanel(doc)) {
            if (bootObserver) {
              bootObserver.disconnect();
              bootObserver = null;
            }
            scheduleScan();
            return;
          }
        }
      });
      try {
        bootObserver.observe(doc.body, { childList: true, subtree: true });
      } catch (err) {
        bootObserver = null;
      }
    }

    function scan(scanOpts) {
      if (isStopped || isInternalMutating) return;
      var explicitRescan = Boolean(scanOpts && scanOpts.explicitRescan);
      runInternalMutation(function () {
        var trigger = findAntigravityTrigger(doc);
        var panel = findAntigravityPanel(doc);

        if ((trigger || panel) && !nativeDetected) {
          nativeDetected = true;
          if (bootObserver) {
            bootObserver.disconnect();
            bootObserver = null;
          }
          if (typeof opts.onNativeDetected === "function") {
            try {
              opts.onNativeDetected();
            } catch (err) {
              // 忽略原生探测通知异常
            }
          }
        }

        rebindTriggerObserver(trigger);

        if (!trigger && !panel) {
          ensureBootObserver();
        } else if (bootObserver) {
          bootObserver.disconnect();
          bootObserver = null;
        }

        if (!panel) {
          if (activeSection) {
            unmountActiveSection();
          } else {
            rebindPanelObserver(null);
            rebindOrchestratorSubmenuObserver(null);
          }
          if (trigger && (triggerDomDirty || trigger !== lastTriggerEl || explicitRescan)) {
            var idleCtx = getLiveContext(trigger, null);
            if (idleCtx) {
              syncAntigravityDomDecorations(
                idleCtx,
                resolveModelEffortProfile(idleCtx, idleCtx.selectedModel, perModelEffortMap, perOrchestratorEffortMap, doc),
                trigger,
                null
              );
            }
          }
          return;
        }

        var ctx = getLiveContext(trigger, panel);

        // 若外部修改了 selectedModel，清除临时 override 对齐最新模型
        if (ctx && ctx.selectedModel && activeModelOptionOverride) {
          if (ctx.selectedModel.label === activeModelOptionOverride.label) {
            activeModelOptionOverride = null;
            activeBaseOverride = null;
          }
        }
        if (ctx && ctx.orchestratorPick && activeOrchestratorPlannerOverride) {
          if (ctx.orchestratorPick.model === activeOrchestratorPlannerOverride.value) {
            activeOrchestratorPlannerOverride = null;
          }
        }
        if (ctx && activeOrchestratorMode && !activeModelOptionOverride && !ctx.isOrchestratorSelected) {
          activeOrchestratorMode = false;
          activeOrchestratorPlannerOverride = null;
        }

        if (activePanel !== panel || !activeSection || !panel.contains(activeSection)) {
          unmountActiveSection();
          mountSectionIntoPanel(panel, ctx);
        } else if (explicitRescan && !panelResizeObserver) {
          stabilizePanelWidth(panel);
        }

        if (explicitRescan) {
          panelRowsDirty = true;
          panelDecorDirty = true;
          orchSubmenuDirty = true;
          mayHaveOrchSubmenu = true;
        }

        var activeProfForScan = ctx ? getActiveProfile(ctx) : null;
        var orchMenu = resolveOrchSubmenuForSync(undefined, activeProfForScan);
        if (!orchMenu && !activeOrchestratorMode && !(activeProfForScan && activeProfForScan.isOrchestrator)) {
          mayHaveOrchSubmenu = false;
        }
        rebindPanelObserver(panel);
        var needsSeparateOrchObserver = Boolean(
          orchMenu &&
          (!observedPanelEl || typeof observedPanelEl.contains !== "function" || !observedPanelEl.contains(orchMenu))
        );
        rebindOrchestratorSubmenuObserver(needsSeparateOrchObserver ? orchMenu : null);

        if (ctx) {
          syncAntigravityDomDecorations(ctx, activeProfForScan, trigger, panel, orchMenu);
        }
        notifySeatListeners();
      });
    }

    function cancelScheduledScan() {
      if (scanRafId !== null && win && typeof win.cancelAnimationFrame === "function") {
        win.cancelAnimationFrame(scanRafId);
      }
      scanRafId = null;
      scanScheduled = false;
    }

    function scheduleScan() {
      if (isStopped || scanScheduled) return;
      scanScheduled = true;
      if (win && typeof win.requestAnimationFrame === "function") {
        scanRafId = win.requestAnimationFrame(function () {
          scanRafId = null;
          scanScheduled = false;
          if (!isStopped) {
            scan();
          }
        });
      } else {
        scanScheduled = false;
        scan();
      }
    }

    scan();

    if (typeof MO === "function") {
      bodyPortalObserver = new MO(function (records) {
        if (isStopped || isInternalMutating) return;
        if (isNodeDetached(observedTriggerEl) || isNodeDetached(activePanel)) {
          requestForeignScan(true);
          return;
        }
        for (var i = 0; i < records.length; i += 1) {
          var rec = records[i];
          if (isOwnMutationRecord(rec)) continue;
          if (rec.addedNodes) {
            for (var a = 0; a < rec.addedNodes.length; a += 1) {
              if (isPotentialPanelPortalNode(rec.addedNodes[a])) {
                mayHaveOrchSubmenu = true;
                requestForeignScan(false);
                return;
              }
            }
          }
          if (rec.removedNodes) {
            if (listContainsTarget(rec.removedNodes, observedOrchSubmenuEl)) {
              mayHaveOrchSubmenu = false;
              requestForeignScan(false);
              return;
            }
            if (
              listContainsTarget(rec.removedNodes, activePanel) ||
              listContainsTarget(rec.removedNodes, observedTriggerEl)
            ) {
              requestForeignScan(true);
              return;
            }
          }
        }
      });
      bodyPortalObserver.observe(doc.body, {
        childList: true,
        subtree: false
      });
    }

    function onDocPointerOrClickCapture(ev) {
      if (isStopped || !ev) return;
      var target = ev.target;
      if (isOwnCesNode(target)) return;
      var hitTrigger =
        (observedTriggerEl && typeof observedTriggerEl.contains === "function" && observedTriggerEl.contains(target)) ||
        (target &&
          typeof target.closest === "function" &&
          target.closest('[data-testid="model-selector-trigger"], button[aria-label^="Select model"]'));
      if (hitTrigger || isNodeDetached(observedTriggerEl) || activePanel) {
        requestForeignScan(false);
      }
    }

    function onDocKeyDownCapture(ev) {
      if (isStopped || !ev) return;
      var key = ev.key;
      var mayToggleMenu =
        activePanel ||
        key === "Escape" ||
        key === "Enter" ||
        key === " " ||
        key === "ArrowDown" ||
        key === "ArrowUp" ||
        ev.ctrlKey ||
        ev.metaKey ||
        ev.altKey;
      if (!mayToggleMenu || isOwnCesNode(ev.target)) return;
      if (
        activePanel ||
        ev.ctrlKey ||
        ev.metaKey ||
        ev.altKey ||
        (observedTriggerEl &&
          (ev.target === observedTriggerEl ||
            (typeof observedTriggerEl.contains === "function" && observedTriggerEl.contains(ev.target))))
      ) {
        requestForeignScan(false);
      }
    }

    if (typeof doc.addEventListener === "function") {
      doc.addEventListener("pointerdown", onDocPointerOrClickCapture, true);
      doc.addEventListener("click", onDocPointerOrClickCapture, true);
      doc.addEventListener("keydown", onDocKeyDownCapture, true);
    }

    return {
      stop: function () {
        isStopped = true;
        cancelScheduledScan();
        if (typeof doc.removeEventListener === "function") {
          doc.removeEventListener("pointerdown", onDocPointerOrClickCapture, true);
          doc.removeEventListener("click", onDocPointerOrClickCapture, true);
          doc.removeEventListener("keydown", onDocKeyDownCapture, true);
        }
        if (bodyPortalObserver) {
          bodyPortalObserver.disconnect();
          bodyPortalObserver = null;
        }
        if (triggerObserver) {
          triggerObserver.disconnect();
          triggerObserver = null;
        }
        if (panelObserver) {
          panelObserver.disconnect();
          panelObserver = null;
        }
        if (orchSubmenuObserver) {
          orchSubmenuObserver.disconnect();
          orchSubmenuObserver = null;
        }
        if (bootObserver) {
          bootObserver.disconnect();
          bootObserver = null;
        }
        observedTriggerEl = null;
        observedPanelEl = null;
        observedOrchSubmenuEl = null;
        unmountActiveSection();
      },
      rescan: function () {
        scan({ explicitRescan: true });
      },
      bindPanelInteractions: bindPanelInteractions
    };
  }

  // ── 一键安装到当前窗口（同时兼容 Antigravity 原生环境与 Seat 预览环境） ────────
  function installCodexEffortSlider(options) {
    var opts = options || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var win = opts.window || (doc && doc.defaultView) || (typeof window !== "undefined" ? window : globalRoot);
    if (!doc || !doc.body) return null;

    if (win && win.__agCodexEffortSliderInstance && typeof win.__agCodexEffortSliderInstance.stop === "function") {
      try {
        win.__agCodexEffortSliderInstance.stop();
      } catch (err) {
        // 忽略旧实例卸载错误
      }
    }

    installStyles(doc);
    var settingsUi = installSettingsUi({ document: doc, window: win });
    var bridge = resolveHostBridge(win, opts.bridge);
    var closeUpdateToast = null;
    var offUpdateReady = null;
    var offStateChanged = null;
    var offUninstalled = null;
    var offLocalSettingsSync = null;
    var updateToastDismissed = false;

    function syncRemoteAppearance(st) {
      if (!st || typeof st !== "object") return;
      var cur = readSettings(win);
      var patch = {};
      if (typeof st.motion === "string" && st.motion !== cur.motion) {
        patch.motion = st.motion;
      }
      if (typeof st.ticks === "string" && st.ticks !== cur.ticks) {
        patch.ticks = st.ticks;
      }
      if (patch.motion || patch.ticks) {
        writeSettings(patch, win, { fromRemote: true });
      }
    }

    function presentUpdateToast(version) {
      if (updateToastDismissed || !version) return;
      if (closeUpdateToast) closeUpdateToast();
      closeUpdateToast = showUpdateReadyToast({
        document: doc,
        window: win,
        version: version,
        platform: bridge ? bridge.platform : "desktop",
        onDismiss: function () {
          updateToastDismissed = true;
          closeUpdateToast = null;
        },
        onRestart: function () {
          return bridge && typeof bridge.relaunch === "function" ? bridge.relaunch() : null;
        }
      });
    }

    if (bridge) {
      if (typeof bridge.saveConfig === "function" && win && typeof win.addEventListener === "function") {
        var onLocalSettingsForBridge = function (ev) {
          var detail = ev && ev.detail;
          if (!detail || detail.__fromRemote) return;
          void bridge.saveConfig({ motion: detail.motion, ticks: detail.ticks });
        };
        win.addEventListener(SETTINGS_EVENT, onLocalSettingsForBridge);
        offLocalSettingsSync = function () {
          win.removeEventListener(SETTINGS_EVENT, onLocalSettingsForBridge);
        };
      }
      if (typeof bridge.onStateChanged === "function") {
        offStateChanged = bridge.onStateChanged(function (st) {
          syncRemoteAppearance(st);
        });
      }
      if (typeof bridge.onUninstalled === "function") {
        offUninstalled = bridge.onUninstalled(function () {
          var openPanel = doc.querySelector(".ces-set");
          if (openPanel && openPanel.parentNode) openPanel.parentNode.removeChild(openPanel);
          instance.stop();
          showUninstallCompleteToast({
            document: doc,
            window: win,
            platform: bridge.platform,
            onRestart: function () {
              return typeof bridge.relaunch === "function" ? bridge.relaunch() : null;
            }
          });
        });
      }
      if (typeof bridge.onUpdateReady === "function") {
        offUpdateReady = bridge.onUpdateReady(function (payload) {
          if (payload && payload.version) {
            presentUpdateToast(payload.version);
          }
        });
      }
      if (typeof bridge.getState === "function") {
        Promise.resolve(bridge.getState())
          .then(function (st) {
            syncRemoteAppearance(st);
            if (st && st.pendingUpdateVersion) {
              presentUpdateToast(st.pendingUpdateVersion);
            }
          })
          .catch(function () {});
      }
    }

    var activeGenericMount = null;
    var menuObs = null;

    function stopMenuObserver() {
      if (menuObs) {
        menuObs.stop();
        menuObs = null;
      }
      if (activeGenericMount) {
        activeGenericMount.unmount();
        activeGenericMount = null;
      }
    }

    var agObs = installAntigravityObserver({
      document: doc,
      window: win,
      onNativeDetected: function () {
        if (!opts.seat) {
          stopMenuObserver();
        }
      }
    });

    var hasNativeInitially = Boolean(findAntigravityTrigger(doc) || findAntigravityPanel(doc));
    if (!hasNativeInitially || opts.seat) {
      menuObs = installMenuObserver({
        document: doc,
        window: win,
        onChange: function (current) {
          if (activeGenericMount) {
            activeGenericMount.unmount();
            activeGenericMount = null;
          }
          if (!current || !current.container) return;
          var seat = opts.seat;
          if (!seat) return;
          activeGenericMount = mountCodexEffortSlider({
            container: current.container,
            row: current.row,
            seat: seat,
            document: doc,
            window: win
          });
        }
      });
    }

    var instance = {
      stop: function () {
        stopMenuObserver();
        agObs.stop();
        settingsUi.stop();
        if (offUpdateReady) {
          try { offUpdateReady(); } catch (err) {}
          offUpdateReady = null;
        }
        if (offStateChanged) {
          try { offStateChanged(); } catch (err) {}
          offStateChanged = null;
        }
        if (offUninstalled) {
          try { offUninstalled(); } catch (err) {}
          offUninstalled = null;
        }
        if (offLocalSettingsSync) {
          try { offLocalSettingsSync(); } catch (err) {}
          offLocalSettingsSync = null;
        }
        if (closeUpdateToast) {
          try { closeUpdateToast(); } catch (err) {}
          closeUpdateToast = null;
        }
        if (win && win.__agCodexEffortSliderInstance === instance) {
          delete win.__agCodexEffortSliderInstance;
        }
      },
      rescan: function () {
        agObs.rescan();
        if (menuObs) {
          menuObs.rescan();
        }
      }
    };

    if (win) {
      win.__agCodexEffortSliderInstance = instance;
    }
    return instance;
  }

  // 在浏览器主世界（非 Node 测试环境且非禁用自动启动）下自动挂载
  if (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    !window.__agCodexEffortSliderDisableAutoBoot
  ) {
    var boot = function () {
      if (document.body) {
        installCodexEffortSlider({ document: document, window: window });
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  }

  return {
    PLUGIN_VERSION: PLUGIN_VERSION,
    resolveUiLocale: resolveUiLocale,
    detectUiLocale: detectUiLocale,
    I18N_MESSAGES: I18N_MESSAGES,
    resolveHostBridge: resolveHostBridge,
    showUpdateReadyToast: showUpdateReadyToast,
    showUninstallCompleteToast: showUninstallCompleteToast,
    mountCodexEffortSlider: mountCodexEffortSlider,
    installMenuObserver: installMenuObserver,
    installAntigravityObserver: installAntigravityObserver,
    installCodexEffortSlider: installCodexEffortSlider,
    findInferenceRow: findInferenceRow,
    findEffortTrigger: findEffortTrigger,
    findAntigravityTrigger: findAntigravityTrigger,
    findAntigravityPanel: findAntigravityPanel,
    findOrchestratorSubmenu: findOrchestratorSubmenu,
    readAntigravityFiberContext: readAntigravityFiberContext,
    resolveModelEffortProfile: resolveModelEffortProfile,
    resolveCurrentOrchestratorPlanner: resolveCurrentOrchestratorPlanner,
    resolveOrchestratorPlannerProfile: resolveOrchestratorPlannerProfile,
    commitAntigravityModelOption: commitAntigravityModelOption,
    commitOrchestratorPlannerOption: commitOrchestratorPlannerOption,
    parseModelLabel: parseModelLabel,
    parseModelDisplayText: parseModelDisplayText,
    isOrchestratorOption: isOrchestratorOption,
    syncTriggerColor: syncTriggerColor,
    pctFromIndex: pctFromIndex,
    indexFromPct: indexFromPct,
    detentTargetIndex: detentTargetIndex,
    energyForPct: energyForPct,
    energyStopsFor: energyStopsFor,
    speedFor: speedFor,
    particleCountFor: particleCountFor,
    starCountFor: starCountFor,
    PARTICLES: PARTICLES,
    starBrightnessFor: starBrightnessFor,
    starDurationFor: starDurationFor,
    starDelayFor: starDelayFor,
    starLayerOpacityFor: starLayerOpacityFor,
    starHash01: starHash01,
    STARFIELD_DURATION_MEAN: STARFIELD_DURATION_MEAN,
    STARFIELD_DURATION_SPREAD: STARFIELD_DURATION_SPREAD,
    STARFIELD_MIN: STARFIELD_MIN,
    GOLDEN_RATIO: GOLDEN_RATIO,
    MAX_SPEED_FACTOR: MAX_SPEED_FACTOR,
    REDUCED_MOTION_SLOWDOWN: REDUCED_MOTION_SLOWDOWN,
    readSettings: readSettings,
    writeSettings: writeSettings,
    resetSettings: resetSettings,
    onSettingsChange: onSettingsChange,
    normalizeSettings: normalizeSettings,
    schemaDefaults: schemaDefaults,
    motionMode: motionMode,
    motionParamsForMode: motionParamsForMode,
    tracePush: tracePush,
    dumpTrace: dumpTrace,
    traceClear: traceClear,
    installSettingsUi: installSettingsUi,
    openSettingsPanel: openSettingsPanel,
    SETTINGS_SCHEMA: SETTINGS_SCHEMA,
    SETTINGS_VERSION: SETTINGS_VERSION,
    SETTINGS_KEY: SETTINGS_KEY,
    SETTINGS_EVENT: SETTINGS_EVENT,
    MIN_HEIGHT_SLOTS: MIN_HEIGHT_SLOTS,
    fillColorFor: fillColorFor,
    fillBackgroundFor: fillBackgroundFor,
    valueColorFor: valueColorFor,
    isOffLevel: isOffLevel,
    findValueElement: findValueElement,
    knobOffsetOf: knobOffsetOf,
    KNOB_RADIUS: KNOB_RADIUS,
    KNOB_SIZE: KNOB_SIZE,
    TRACK_HEIGHT: TRACK_HEIGHT,
    ENERGY_START: ENERGY_START,
    ENERGY_END: ENERGY_END,
    clamp01: clamp01,
    clampAbs: clampAbs,
    installStyles: installStyles,
    MOTION: MOTION,
    MOTION_REDUCED: MOTION_REDUCED,
    MOTION_FAST: MOTION_FAST,
    RELEASE_PROJECT_S: RELEASE_PROJECT_S,
    POINTER_SPEED_EMA: POINTER_SPEED_EMA,
    POINTER_STALE_S: POINTER_STALE_S,
    POINTER_SPEED_TAU: POINTER_SPEED_TAU,
    DRAG_THRESHOLD_PX: DRAG_THRESHOLD_PX,
    motionStep: motionStep,
    motionSettled: motionSettled,
    decayPointerSpeed: decayPointerSpeed,
    releaseIndexFor: releaseIndexFor,
    isClaudeModel: isClaudeModel,
    claudeIntensityFor: claudeIntensityFor,
    claudeSpeedFor: claudeSpeedFor,
    paintDither: paintDither,
    ditherAlphaAt: ditherAlphaAt,
    valueNoise: valueNoise,
    hash01: hash01,
    fillRoundRect: fillRoundRect,
    surfaceIsDark: surfaceIsDark,
    CLAUDE_CELL: CLAUDE_CELL,
    CLAUDE_ROWS: CLAUDE_ROWS,
    CLAUDE_SWEEP_MS: CLAUDE_SWEEP_MS,
    CLAUDE_KNOB_W: CLAUDE_KNOB_W,
    CLAUDE_KNOB_H: CLAUDE_KNOB_H,
    CLAUDE_KNOB_R: CLAUDE_KNOB_R
  };
});
