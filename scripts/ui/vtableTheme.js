(function(factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') {
    window.app = window.app || {};
    window.app.ui = window.app.ui || {};
    window.app.ui.vtableTheme = api;
  }
})(function() {
  var fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
  var tokens = {
    headerHeight: 36,
    rowHeight: 38,
    fontSize: 14,
    mutedFontSize: 13,
    fontFamily: fontFamily,
    text: '#172033',
    muted: '#667085',
    headerText: '#344054',
    border: '#edf1f7',
    accent: '#155eef',
  };

  function palette(mode) {
    if (mode === 'dark') {
      return {
        background: '#182231',
        headerBackground: '#151d2a',
        hover: '#223044',
        text: '#e5e7eb',
        headerText: '#f3f4f6',
        muted: '#9aa7b8',
        border: '#2c3a4d',
        scrollRail: 'rgba(148, 163, 184, 0.10)',
        scrollSlider: 'rgba(148, 163, 184, 0.38)',
      };
    }
    return {
      background: '#ffffff',
      headerBackground: '#ffffff',
      hover: '#f8fafc',
      text: tokens.text,
      headerText: tokens.headerText,
      muted: tokens.muted,
      border: tokens.border,
      scrollRail: 'rgba(99, 115, 129, 0.08)',
      scrollSlider: 'rgba(99, 115, 129, 0.28)',
    };
  }

  function gridBorder() {
    return [0, 1, 1, 0];
  }

  function buildTheme(mode) {
    var colors = palette(mode);
    return {
      underlayBackgroundColor: colors.background,
      bodyStyle: {
        bgColor: colors.background,
        borderColor: colors.border,
        borderLineWidth: gridBorder(),
        color: colors.text,
        fontFamily: tokens.fontFamily,
        fontSize: tokens.fontSize,
        fontWeight: 400,
        hover: {
          cellBgColor: colors.hover,
          inlineRowBgColor: colors.hover,
        },
      },
      headerStyle: {
        bgColor: colors.headerBackground,
        borderColor: colors.border,
        borderLineWidth: gridBorder(),
        color: colors.headerText,
        fontFamily: tokens.fontFamily,
        fontSize: tokens.fontSize,
        fontWeight: 400,
        hover: {
          cellBgColor: colors.hover,
          inlineRowBgColor: colors.hover,
        },
      },
      frameStyle: {
        borderColor: 'transparent',
        borderLineWidth: 0,
        cornerRadius: 0,
      },
      cellBorderClipDirection: 'bottom-right',
      scrollStyle: {
        scrollSliderColor: colors.scrollSlider,
        scrollRailColor: colors.scrollRail,
        width: 8,
        verticalVisible: 'none',
        horizontalVisible: 'none',
      },
      columnResize: {
        lineColor: tokens.accent,
        bgColor: tokens.accent,
        lineWidth: 1,
        width: 3,
      },
    };
  }

  return {
    tokens: tokens,
    palette: palette,
    buildTheme: buildTheme,
  };
});
